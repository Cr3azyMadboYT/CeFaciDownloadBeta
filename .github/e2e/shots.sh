#!/usr/bin/env bash
# Runs inside the Android emulator job (.github/workflows/emulator.yml): bash shots.sh <apk> <e2e|release> <HHMM>
# Writes to the log, for each screen: where the app ends and where the phone's buttons begin (OVERLAP lines when a
# button of the app sits under them), every visible button with its place (UI lines), and a small photo between
# =====SHOT <name> BEGIN/END lines (JPEG, base64). For the screens with a bar at the bottom also everything in the
# last 400 px (BOTTOM lines) and a sharper photo of the bottom (<name>-jos).
set -u
APK="$1"; MODE="$2"; CLOCK="$3"
PKG=ro.cefaci.app
mkdir -p shots
command -v convert >/dev/null || sudo apt-get install -y -qq imagemagick >/dev/null 2>&1 || true

adb wait-for-device
adb root >/dev/null 2>&1; sleep 3; adb wait-for-device
# the 3 buttons at the bottom, like on Cornel's Samsung
adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton || true
adb shell cmd overlay disable com.android.internal.systemui.navbar.gestural || true
adb shell settings put global hide_error_dialogs 1 || true
adb shell settings put global auto_time 0 || true
adb shell settings put global auto_time_zone 0 || true
adb shell setprop persist.sys.timezone Europe/Bucharest || true
adb shell cmd alarm set-timezone Europe/Bucharest 2>/dev/null || true
# Friday 9 October 2026 at the hour asked (before 05:00: the night after it, Saturday)
DAY=2026-10-09; [ "${CLOCK:0:2}" -lt 5 ] && DAY=2026-10-10
EPOCH=$(TZ=Europe/Bucharest date -d "$DAY ${CLOCK:0:2}:${CLOCK:2:2}:00" +%s)
adb shell "date -u $(date -u -d @"$EPOCH" +%m%d%H%M%Y.%S)" || true
echo "CLOCK device: $(adb shell date)"
sleep 3
adb install -r -g "$APK" || { echo "INSTALL FAILED"; exit 1; }

NAVTOP=""
navbar() {
  # where the phone's own bar starts (px from the top): the screen's height minus the bar's height the app measured
  local h d nav
  h=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | cut -dx -f2)
  d=$(adb shell wm density | grep -oE '[0-9]+' | tail -1)
  nav=$(adb logcat -d -s ReactNativeJS:V | grep -oE ' nav=[0-9]+' | tail -1 | grep -oE '[0-9]+')
  adb shell dumpsys window | grep -E "type=navigationBars" | head -4 | sed 's/^ */NAVBAR /'
  [ -z "$nav" ] && nav=48
  [ -n "$h" ] && [ -n "$d" ] && NAVTOP=$(( h - nav * d / 160 ))
  echo "NAVTOP ${NAVTOP:-?} (screen ${h:-?} px, density ${d:-?}, bar $nav dp)"
}
anr() {
  # a system "isn't responding" box from the slow emulator would take the taps: wait it out
  local xy
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml shots/tap.xml >/dev/null 2>&1
  xy=$(python3 .github/e2e/ui.py shots/tap.xml 0 tap "^Wait$")
  if [ -n "$xy" ]; then echo "ANR dismissed"; adb shell input tap $xy; sleep 2; fi
}
ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml "shots/$1.xml" >/dev/null 2>&1
  python3 .github/e2e/ui.py "shots/$1.xml" "${NAVTOP:-0}" "$1"
}
shot() {
  sleep "${2:-2}"
  ui "$1"
  adb exec-out screencap -p > "shots/$1.png"
  convert "shots/$1.png" -resize 300x -quality 50 "shots/$1.jpg" 2>/dev/null || cp "shots/$1.png" "shots/$1.jpg"
  echo "=====SHOT $1 BEGIN"
  base64 -w0 "shots/$1.jpg"; echo
  echo "=====SHOT $1 END"
}
bottom() {
  # the last shot's bottom: every element there, and a sharper photo of the bar and the phone's buttons
  python3 .github/e2e/ui.py "shots/$1.xml" "${NAVTOP:-0}" bottom "$1"
  if convert "shots/$1.png" -gravity south -crop 1080x420+0+0 +repage -resize 540x -quality 70 "shots/$1-jos.jpg" 2>/dev/null; then
    echo "=====SHOT $1-jos BEGIN"; base64 -w0 "shots/$1-jos.jpg"; echo; echo "=====SHOT $1-jos END"
  fi
}
tap() {
  # tap the first element (with "last": the last one) whose text or description matches a regex, e.g. tap 'Creează plan'
  local xy
  anr
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml shots/tap.xml >/dev/null 2>&1
  xy=$(python3 .github/e2e/ui.py shots/tap.xml 0 tap "$1" "${2:-first}")
  if [ -z "$xy" ]; then echo "MISSING $1"; return 1; fi
  echo "TAP $1 at $xy"
  adb shell input tap $xy
}
hidekb() {
  # the on-screen keyboard down (Back only while it is up: otherwise Back would leave the screen)
  if adb shell dumpsys input_method | grep -q "mInputShown=true"; then adb shell input keyevent 4; sleep 1; fi
}
scroll() { adb shell input swipe 540 1700 540 500 400; sleep 1; }
go() { adb shell am start -W -a android.intent.action.VIEW -d "cefaci:///$1" "$PKG" >/dev/null 2>&1; }
logs() { adb logcat -d -s ReactNativeJS:V | grep -E "$1" | tail -"${2:-20}"; }

adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1
sleep 40
navbar
adb shell wm size; adb shell wm density
anr
shot start 1
bottom start
logs "E2E|Error|error"

if [ "$MODE" = "release" ]; then
  # the APK people install: the first screen (no account yet), then the email step
  tap '^Continuă cu email' && shot email 3 && bottom email
fi

if [ "$MODE" = "e2e" ]; then
  # the bottom bar: each tab answers a tap and sits above the phone's buttons
  tap '^Profil$' last && shot tab-profil && bottom tab-profil
  tap '^Planuri$' last && shot tab-planuri
  tap '^Explorează$' last && shot tab-exploreaza 3 && bottom tab-exploreaza
  tap '^Acasă$' last && shot tab-acasa
  logs "E2E tabbar" 4
  # Creează plan, as someone who has never used it: the first answer on each screen
  tap '^Creează plan' && shot pas-1
  tap '^(Toată seara|Toată noaptea|Toată ziua)' && shot pas-2
  tap '^Acum, ' && shot pas-3
  tap '^4 persoane' && shot pas-4
  tap '^Mai departe$' && shot pas-5
  tap '^Gata, fă-mi planul' && shot planuri 10 && bottom planuri
  tap '^Vezi pe hartă' && shot plan 4 && bottom plan
  adb shell input keyevent 4; sleep 2
  scroll; scroll; scroll
  tap '^(mai ieftin|mai aproape)$' && shot mai-vrei 10
  go acasa; sleep 3
  tap '^Surprinde-mă' && shot surpriza 8 && bottom surpriza
  tap '^Altă surpriză' && shot surpriza-2 6
  go acasa; sleep 3
  tap '^Ca data trecută' && shot ca-data-trecuta 8
  # where you set off from: Buftea, 20 km, then Acasă and a surprise from there
  go zona; sleep 4; shot zona 2; bottom zona
  tap '^Ilfov$' && shot zona-ilfov 2
  tap '^Buftea$' && shot zona-buftea 4
  scroll; scroll
  tap '^20 km' && shot zona-raza 3 && bottom zona-raza
  tap '^Gata: ' && sleep 3
  go acasa; sleep 3; shot acasa-buftea 2
  tap '^Surprinde-mă' && shot surpriza-buftea 8
  # the sign-up's new steps
  go cont; sleep 3
  tap '^Continuă cu email' && sleep 2
  tap '^ex: Cornel' && sleep 1 && adb shell input text Test && sleep 1
  hidekb; tap '^cum te găsesc' && sleep 1 && adb shell input text test_e2e && sleep 2
  hidekb; tap '^ZZ.LL.AAAA' && sleep 1 && adb shell input text 05051998 && sleep 1
  hidekb
  shot cont-nume 1; bottom cont-nume
  tap '^Mai departe$' && sleep 2
  tap '^Da, e corectă' && shot cont-unde 3 && bottom cont-unde
  tap '^Ilfov$' && shot cont-ilfov 2
  tap '^Buftea$' && shot cont-raza 6 && bottom cont-raza
  scroll
  tap '^Cu mașina$' && shot cont-raza-pe-jos 3
  tap '^20 km' && shot cont-raza-20 3
  logs "E2E|Error|error|Warning" 30
fi
echo "DONE $MODE $CLOCK"
