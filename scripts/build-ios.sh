#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  mobile) ios_scheme=CeFaci; ios_name=CeFaci-Client ;;
  business) ios_scheme=CeFaciBusiness; ios_name=CeFaci-Business ;;
  *) exit 2 ;;
esac
ios_root=$(pwd)
ios_work="$RUNNER_TEMP/$ios_name"
mkdir -p release/ios-diagnostics
xcodebuild -workspace "$1/ios/$ios_scheme.xcworkspace" -scheme "$ios_scheme" \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$ios_work/simulator" CODE_SIGNING_ALLOWED=NO build \
  > "release/ios-diagnostics/$ios_name-simulator-build.log" 2>&1 || { tail -n 100 "release/ios-diagnostics/$ios_name-simulator-build.log"; exit 1; }
codesign --force --sign - --deep "$ios_work/simulator/Build/Products/Release-iphonesimulator/$ios_scheme.app"
xcodebuild -workspace "$1/ios/$ios_scheme.xcworkspace" -scheme "$ios_scheme" \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "$ios_work/device" -archivePath "$ios_work/$ios_name.xcarchive" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO archive \
  > "release/ios-diagnostics/$ios_name-device-build.log" 2>&1 || { tail -n 100 "release/ios-diagnostics/$ios_name-device-build.log"; exit 1; }
python3 scripts/audit-ios-binary.py "$1"
