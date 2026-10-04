#!/usr/bin/env bash
# Runs inside the Android emulator job (.github/workflows/emulator.yml): bash shots.sh <apk> <e2e|release> <HHMM>
# Writes to the log, for each screen: where the app ends and where the phone's buttons begin (OVERLAP lines when a
# button of the app sits under them), every visible button with its place (UI lines), and a small photo between
# =====SHOT <name> BEGIN/END lines (JPEG, base64).
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
  # where the phone's own bar starts (px from the top)
  local line
  line=$(adb shell dumpsys window | grep -m1 -E "type=navigationBars.*frame=\[" || true)
  echo "NAVBAR $line"
  NAVTOP=$(echo "$line" | sed -nE 's/.*frame=\[[0-9]+,([0-9]+)\]\[[0-9]+,([0-9]+)\].*/\1/p')
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
tap() {
  # tap the first element whose text or description matches (a regex), e.g. tap 'Creează plan'
  local xy
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml shots/tap.xml >/dev/null 2>&1
  xy=$(python3 .github/e2e/ui.py shots/tap.xml 0 tap "$1")
  if [ -z "$xy" ]; then echo "MISSING $1"; return 1; fi
  echo "TAP $1 at $xy"
  adb shell input tap $xy
}
go() { adb shell am start -W -a android.intent.action.VIEW -d "cefaci:///$1" "$PKG" >/dev/null 2>&1; }

adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1
sleep 25
navbar
adb shell wm size; adb shell wm density
shot start 1
adb logcat -d -s ReactNativeJS:V | grep -E "E2E|Error|error" | tail -20

if [ "$MODE" = "e2e" ]; then
  # the bottom bar: each tab answers a tap
  tap '^Profil' && shot tab-profil
  tap '^Planuri' && shot tab-planuri
  tap '^Explorează' && shot tab-exploreaza
  adb shell input keyevent 4; sleep 2
  tap '^Acasă' && shot tab-acasa
  # Creează plan, as someone who has never used it: the first answer on each screen
  tap '^Creează plan' && shot pas-1
  tap '^(Toată seara|Toată noaptea|Toată ziua|Mai multe locuri)' && shot pas-2
  tap '^Acum' && shot pas-3
  tap '^4( |$)' && shot pas-4
  tap '^(Mai departe|Gata)' && shot pas-5
  tap '^(Gata, fă-mi planul|Arată-mi planurile|Fă-mi planurile)' && shot planuri 8
  tap '^(Alegem asta|Deschide)' && shot plan 3
  go acasa; sleep 3
  tap '^Surprinde-mă' && shot surpriza 8
  go acasa; sleep 3
  tap '^Ca data trecută' && shot ca-data-trecuta 8
  adb logcat -d -s ReactNativeJS:V | grep -E "E2E|Error|error|Warning" | tail -30
fi
echo "DONE $MODE $CLOCK"
