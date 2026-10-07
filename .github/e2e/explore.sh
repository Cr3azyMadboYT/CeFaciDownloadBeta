#!/usr/bin/env bash
# Runs inside the Android emulator job (.github/workflows/emulator.yml): bash explore.sh <apk> e2e <HHMM|dst>
# The bug hunt (Cornel, 07.10: „interacționează cu tot, vezi ce buguri găsești”): goes through every screen, presses
# Back everywhere, opens links with wrong ids, then taps at random (monkey). After every step: CRASH if the app is
# gone, JSERR for every red error in the JavaScript log. Photos as in shots.sh (smaller).
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
# Friday 9 October 2026 at the hour asked (before 05:00: the night after it, Saturday); "dst": the night the clocks go
# back in Romania (Sunday 25 October 2026, 02:30 — it happens twice that night)
if [ "$CLOCK" = "dst" ]; then DAY=2026-10-25; CLOCK=0230; else DAY=2026-10-09; [ "${CLOCK:0:2}" -lt 5 ] && DAY=2026-10-10; fi
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
  convert "shots/$1.png" -resize 260x -quality 45 "shots/$1.jpg" 2>/dev/null || cp "shots/$1.png" "shots/$1.jpg"
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
# a swipe that starts high on the screen (lower down a map would take it and move instead of the page)
scrollhigh() { adb shell input swipe 540 1000 540 200 400; sleep 1; }
# a swipe that starts low (under a map near the top)
scrolllow() { adb shell input swipe 540 1980 540 1450 400; sleep 1; }
go() { adb shell am start -W -a android.intent.action.VIEW -d "cefaci:///$1" "$PKG" >/dev/null 2>&1; }
logs() { adb logcat -d -s ReactNativeJS:V | grep -E "$1" | tail -"${2:-20}"; }


STEP=start
alive() {
  # after each step: is the app still there? which red errors did JavaScript write?
  local e
  e=$(adb logcat -d -s ReactNativeJS:E ReactNativeJS:W AndroidRuntime:E | grep -E "Error|TypeError|undefined is not|Exception|FATAL|Unhandled|Possible Unhandled|Cannot read|is not a function" | grep -v "Google sign" | tail -8)
  [ -n "$e" ] && echo "$e" | sed "s/^/JSERR $STEP: /"
  adb logcat -c
  if [ -z "$(adb shell pidof $PKG | tr -d '\r')" ]; then
    echo "CRASH after $STEP"
    adb logcat -d -b crash | tail -40 | sed "s/^/CRASHLOG /"
    adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 15
  fi
}
step() { STEP="$1"; echo "----- STEP $1"; }
back() { adb shell input keyevent 4; sleep "${1:-2}"; }
typeit() { adb shell input text "$1"; sleep 1; }

adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1
sleep 40
navbar
anr
step start; shot x-start 1; alive

# 1. the tabs, and Back from each (Back on a tab must not leave a blank screen)
for t in Explorează Planuri Plus Profil Acasă; do
  step "tab $t"; tap "^$t\$" last && shot "x-tab-$t" 3; alive
done
step "back from Acasă"; back; shot x-back-acasa 2; alive
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 5

# 2. Explorează: search, odd searches, a place, its plan, the filters
step explora; tap '^Explorează$' last; sleep 3; alive
step "cauta pizza"; tap 'Caută un loc' && typeit pizza && adb shell input keyevent 66 && shot x-cauta-pizza 3; alive
step "deschide loc"; scroll; tap '[0-9]+ min' && shot x-loc 4; alive
step "loc jos"; scroll; scroll; shot x-loc-jos 1; alive
step "plan aici"; tap 'Fă-mi plan aici' && shot x-plan-aici 10; alive
back; back; alive
step "cauta ciudat"; go exploreaza; sleep 3; tap 'Șterge căutarea'; tap 'Caută un loc' && typeit 'dupa%s22%sbere%sieftin%sin%sBuftea' && adb shell input keyevent 66 && shot x-cauta-buftea 3; alive
step "cauta gol"; tap 'Șterge căutarea'; tap 'Caută un loc' && typeit 'zzzzqqq' && adb shell input keyevent 66 && shot x-cauta-nimic 3; alive
step filtre; hidekb; tap '^Filtre$' && shot x-filtre 3; tap 'Închide filtrele'; alive
step "lipseste loc"; scroll; scroll; scroll; tap 'Lipsește un loc' && shot x-lipseste 3; back; alive

# 3. Creează plan: one place, each step its first answer, then the plans and a ticket
step "plan un loc"; go acasa; sleep 3; tap '^Creează plan' && sleep 2; tap '^Un singur loc' && sleep 1; tap '^Mai departe$'; sleep 2; shot x-pas-zi 1
tap '^Acum' ; tap '^Mai departe$'; sleep 2; shot x-pas-cati 1
tap '^În doi' ; tap '^Mai departe$'; sleep 2; shot x-pas-buget 1
tap '^Mai departe$'; sleep 2; shot x-pas-vibe 1
tap '^Chill'; tap '^Gata, fă-mi planul' && shot x-planuri 12; alive
step "facem asa"; tap '^Facem așa' && shot x-bilet 5; alive
step "bilet jos"; scroll; scroll; shot x-bilet-jos 1; alive
back; back; alive

# 4. O construiesc eu: two stops, then the plan
step construiesc; go acasa; sleep 3; tap '^Creează plan' && sleep 2; tap '^O construiesc eu' && sleep 1; tap '^Mai departe$'; sleep 2
tap '^Acum'; tap '^Mai departe$'; sleep 2; tap '^Mai departe$'; sleep 2; tap '^Mai departe$'; sleep 2; tap '^(Hai să construim|Gata, fă-mi planul)'; shot x-construiesc 5; alive
step "pas 1"; tap '^Mâncare$' && sleep 2 && tap '^Aleg asta' && shot x-constr-1 3; alive
step "pas 2"; tap '^Un pahar$' && sleep 2 && tap '^Arată-mi altele' && sleep 2 && tap '^Aleg asta' && shot x-constr-2 3; alive
step "gata constr"; tap '^Gata, vezi planul' && shot x-constr-plan 12; alive
back; back; alive

# 5. Surprinde-mă twice, Ca data trecută, Bilu îți sugerează
step surpriza; go acasa; sleep 3; tap 'Surprinde-mă' && shot x-surpriza 10; alive
step "alta surpriza"; tap '^Altă surpriză' && shot x-surpriza-2 8; alive
step "ca data trecuta"; go acasa; sleep 3; tap 'Ca data trecută' && shot x-ca-data 8; alive

# 6. Profil, Setări (themes, fewer animations), friends, a new crew, Plus
step profil; go acasa; sleep 3; tap '^Profil$' last; sleep 3; shot x-profil 1; alive
step setari; tap '^Setări$' && shot x-setari 3; alive
step "tema zi"; tap '^Zi$' && shot x-tema-zi 2; alive
step "tema noapte"; tap '^Noapte$'; sleep 1; tap '^Ca telefonul$'; alive
step "animatii"; tap 'Mai puține' ; sleep 1; alive
back; alive
step prieteni; go prieteni; sleep 3; shot x-prieteni 2; tap 'Username sau cod' && typeit 'cineva_care_nu_exista' && adb shell input keyevent 66 && shot x-prieteni-cauta 4; hidekb; alive
step "gasca noua"; go gasca-noua; sleep 3; shot x-gasca-noua 2; tap 'Numele gășcii' && typeit 'p1zda' && shot x-gasca-urat 2; hidekb; back; alive
step plus; go acasa; sleep 2; tap '^Plus$' last; sleep 3; shot x-plus 1; scroll; shot x-plus-jos 1; alive

# 7. links with ids that do not exist (an old notification, a shared link)
for l in loc/nu-exista plan/99 bilet/nu-exista vot/00000000-0000-0000-0000-000000000000 gasca/00000000-0000-0000-0000-000000000000 prieten/00000000-0000-0000-0000-000000000000 rezultate construiesc planuri-gata; do
  step "link $l"; go "$l"; sleep 5; shot "x-link-$(echo $l | tr '/' '-')" 1; alive; back 1
done

# 8. into the background and back, many Backs in a row
step "fundal"; adb shell input keyevent 3; sleep 3; adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 4; shot x-revenire 1; alive
step "multe inapoi"; for i in 1 2 3 4 5 6; do back 1; done; adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 4; shot x-dupa-inapoi 1; alive

# 9. random taps (monkey), three rounds with different seeds: only crashes and red errors count
for seed in 11 22 33; do
  step "monkey $seed"
  adb shell monkey -p $PKG -s $seed --throttle 120 --pct-syskeys 0 --pct-appswitch 0 --pct-anyevent 0 --ignore-security-exceptions -v 700 2>&1 | grep -E "CRASH|ANR|Exception|aborted" | head -10 | sed 's/^/MONKEY /'
  shot "x-monkey-$seed" 2; alive
  adb shell am start -W -n "$PKG/.MainActivity" >/dev/null 2>&1; sleep 4
done
echo "DONE explore $CLOCK"
