import hashlib,json,os,subprocess,sys,zipfile
from pathlib import Path
folder=sys.argv[1]
name,scheme=('CeFaci-Client','CeFaci') if folder=='mobile' else ('CeFaci-Business','CeFaciBusiness')
root=Path(os.environ['RUNNER_TEMP'])/name
release=Path('release')
products=[(root/'simulator/Build/Products/Release-iphonesimulator'/f'{scheme}.app',release/f'{name}-ios-simulator.zip'),(root/f'{name}.xcarchive',release/f'{name}-ios-device-unsigned.zip')]
for source,dest in products:
    subprocess.run(['ditto','-c','-k','--sequesterRsrc','--keepParent',str(source),str(dest)],check=True)
# Portable generated project + local native modules; dependency sources are installed from lockfiles.
with zipfile.ZipFile(release/f'{name}-ios-project.zip','w',zipfile.ZIP_DEFLATED) as z:
    for base in [Path(folder)/'ios',Path(folder)/'modules']:
        for p in sorted(base.rglob('*')):
            if not p.is_file() or 'Pods' in p.parts or 'build' in p.parts or p.name=='.xcode.env.local' or 'xcuserdata' in p.parts:continue
            z.write(p,str(p))
(release/f'{name}-ios-build.txt').write_text(f"Source {os.environ['GITHUB_SHA']}\nXcode Release simulator .app (ad-hoc simulator signature only)\nXcode Release device .xcarchive UNSIGNED; not installable on an iPhone or TestFlight\nEXPO_PUBLIC_E2E=0; no authentication bypass\n"+subprocess.check_output(['xcodebuild','-version'],text=True))
files=sorted(release.glob(f'{name}-ios*'))
(release/f'{name}-ios-SHA256.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p)+'\n' for p in files if p.is_file() and not p.name.endswith('-SHA256.txt')))
print(f'Packaged {name}: simulator app, unsigned device archive, generated project and build evidence.')
