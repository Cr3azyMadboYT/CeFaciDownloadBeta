"""Fail before Xcode on missing native features, unsafe ATS or unusable app icons."""
import json, plistlib, struct, subprocess, sys
from pathlib import Path
folder=sys.argv[1]
assert folder in ('mobile','business')
root=Path(folder)
name='CeFaci' if folder=='mobile' else 'CeFaciBusiness'
module='cefaci-icon' if folder=='mobile' else 'cefaci-business-icon'
first='vara' if folder=='mobile' else 'toamna'
config=json.loads((root/'app.json').read_text())['expo']
info=plistlib.loads((root/'ios'/name/'Info.plist').read_bytes())
assert info['CFBundleVersion']==config['ios']['buildNumber']
assert info['CFBundleShortVersionString']==config['version']
assert info['NSAppTransportSecurity']['NSAllowsArbitraryLoads'] is False
assert not any(key in info for key in ['NSMicrophoneUsageDescription','NSLocationAlwaysUsageDescription','NSLocationAlwaysAndWhenInUseUsageDescription','NSMotionUsageDescription','NSFaceIDUsageDescription'])
assert 'NSCameraUsageDescription' in info and 'NSPhotoLibraryUsageDescription' in info
assert ('NSLocationWhenInUseUsageDescription' in info)==(folder=='mobile')
assert 'location' not in info.get('UIBackgroundModes',[])
assert config['scheme'] in [x for types in info['CFBundleURLTypes'] for x in types['CFBundleURLSchemes']]
expected={'Icon_'+s for s in ['primavara','vara','toamna','iarna','craciun'] if s!=first}
assert set(info['CFBundleIcons']['CFBundleAlternateIcons'])==expected
if folder=='business':assert set(info['CFBundleIcons~ipad']['CFBundleAlternateIcons'])==expected
assets=root/'ios'/name/'Images.xcassets'
for catalog in ['AppIcon']+sorted(expected):
    entries=json.loads((assets/(catalog+'.appiconset')/'Contents.json').read_text())['images']
    for entry in entries:
        if 'filename' not in entry:continue
        png=(assets/(catalog+'.appiconset')/entry['filename']).read_bytes()
        assert png[:8]==b'\x89PNG\r\n\x1a\n' and png[25]==2, f'{catalog}: App Store needs RGB without alpha'
        if catalog!='AppIcon':assert struct.unpack('>II',png[16:24])==(1024,1024)
project=(root/'ios'/(name+'.xcodeproj')/'project.pbxproj').read_text()
assert 'ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES' in project
assert all(icon in project for icon in expected)
modules=json.loads(subprocess.check_output(['npx','expo-modules-autolinking','resolve','--platform','apple','--json'],cwd=root,text=True))['modules']
assert any(m['packageName']==module and (m.get('modules') or m.get('pods')) for m in modules)
print(f'PASS {folder}: bundle/version, foreground-only permissions, TLS, deep link, five opaque icons and Apple native autolinking.')
