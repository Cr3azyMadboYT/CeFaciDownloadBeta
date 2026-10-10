"""Audit generated native resources, app aliases and alternate iOS catalogs before Gradle."""
import json
import pathlib
import plistlib
import re
import subprocess
import xml.etree.ElementTree as ET
root = pathlib.Path('business')
looks = ['primavara', 'vara', 'toamna', 'iarna', 'craciun']
ns = '{http://schemas.android.com/apk/res/android}'
manifest = ET.parse(root / 'android/app/src/main/AndroidManifest.xml').getroot()
app = manifest.find('application')
aliases = [a for a in app.findall('activity-alias') if a.get(ns+'name','').startswith('.Icon_')]
assert {a.get(ns+'name') for a in aliases} == {'.Icon_'+look for look in looks}
assert [a.get(ns+'name') for a in aliases if a.get(ns+'enabled') == 'true'] == ['.Icon_toamna']
main = next(a for a in app.findall('activity') if a.get(ns+'name') == '.MainActivity')
assert not any(c.get(ns+'name') == 'android.intent.category.LAUNCHER' for f in main.findall('intent-filter') for c in f.findall('category'))
assert any(c.get(ns+'name') == 'android.intent.category.BROWSABLE' for f in main.findall('intent-filter') for c in f.findall('category'))
res = root / 'android/app/src/main/res'
for look in looks:
    adaptive = ET.parse(res / ('mipmap-anydpi-v26/ic_launcher_'+look+'.xml')).getroot()
    assert adaptive.find('foreground/inset').get(ns+'inset') == '27%'
    for layer in ['fg','bg']:
        assert (res / ('drawable-nodpi/ic_season_'+look+'_'+layer+'.png')).read_bytes() == (root / ('assets/icons/'+look+'-'+layer+'.png')).read_bytes()
    assert (res / ('mipmap-xxxhdpi/ic_launcher_'+look+'.png')).stat().st_size > 1000
ios = root / 'ios/CeFaciBusiness'
info = plistlib.loads((ios/'Info.plist').read_bytes())
alternate = {'Icon_'+look for look in looks if look != 'toamna'}
for key in ['CFBundleIcons','CFBundleIcons~ipad']:
    assert set(info[key]['CFBundleAlternateIcons']) == alternate
for name in alternate:
    catalog = ios/'Images.xcassets'/(name+'.appiconset')
    image = json.loads((catalog/'Contents.json').read_text())['images'][0]
    assert image['size'] == '1024x1024'
    png = (catalog/image['filename']).read_bytes()
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    assert png[25] == 2, 'App Store icon PNG must have RGB pixels without an alpha channel'
project = (root/'ios/CeFaciBusiness.xcodeproj/project.pbxproj').read_text()
assert 'ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES' in project
for name in alternate:
    assert name in project
for platform in ['android','apple']:
    output = subprocess.check_output(['npx','expo-modules-autolinking','resolve','--platform',platform,'--json'],cwd=root,text=True)
    modules = json.loads(output)['modules']
    module = next(m for m in modules if m['packageName'] == 'cefaci-business-icon')
    assert module.get('modules') or module.get('projects'), module
print('PASS: exactly one Android launcher, five adaptive/legacy resources, preserved deep links, four iPhone/iPad alternate catalogs, Xcode compilation settings, native autolinking Android + Apple.')
