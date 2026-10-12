"""Inspect the actual Xcode products, not an Expo JS export."""
import json, os, plistlib, subprocess, sys
from pathlib import Path
folder=sys.argv[1]
name,scheme,bundle=('CeFaci-Client','CeFaci','ro.cefaci.app') if folder=='mobile' else ('CeFaci-Business','CeFaciBusiness','app.cefaci.business')
root=Path(os.environ['RUNNER_TEMP'])/name
config=json.loads(Path(folder,'app.json').read_text())['expo']
results=[]
for kind,app in [('simulator',root/'simulator/Build/Products/Release-iphonesimulator'/f'{scheme}.app'),('device-unsigned',root/f'{name}.xcarchive/Products/Applications'/f'{scheme}.app')]:
    info=plistlib.loads((app/'Info.plist').read_bytes())
    assert info['CFBundleIdentifier']==bundle and info['CFBundleVersion']==config['ios']['buildNumber'] and info['CFBundleShortVersionString']==config['version']
    assert info['NSAppTransportSecurity']['NSAllowsArbitraryLoads'] is False
    assert 'NSMicrophoneUsageDescription' not in info and 'NSLocationAlwaysUsageDescription' not in info
    assert (app/'main.jsbundle').stat().st_size>100_000, 'Release must include its offline JS bundle'
    assert list(app.rglob('*.xcprivacy')), 'Privacy manifests must be included'
    binary=app/info['CFBundleExecutable']
    architectures=subprocess.check_output(['lipo','-archs',str(binary)],text=True).strip()
    assert 'arm64' in architectures if kind=='device-unsigned' else any(a in architectures for a in ['x86_64','arm64'])
    native_name='CefaciIcon' if folder=='mobile' else 'CefaciBusinessIcon'
    assert native_name in subprocess.check_output(['strings',str(binary)],text=True), 'Seasonal native module missing from compiled executable'
    if kind=='simulator':subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
    else:assert subprocess.run(['codesign','--display',str(app)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0, 'Do not claim distribution signing'
    results.append({'kind':kind,'bundle':bundle,'version':info['CFBundleShortVersionString'],'build':info['CFBundleVersion'],'architecture':architectures,'offline_bundle_bytes':(app/'main.jsbundle').stat().st_size})
Path('release').mkdir(exist_ok=True)
Path(f'release/{name}-ios-audit.json').write_text(json.dumps({'commit':os.environ.get('GITHUB_SHA'),'e2e_enabled':False,'products':results},indent=2)+'\n')
print('PASS: actual Mach-O products, native icon module, offline bundle, privacy manifests, simulator ad-hoc signature and unsigned device archive.')
