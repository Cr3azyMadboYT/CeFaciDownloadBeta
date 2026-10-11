"""Install the production Release .app and test pre-login UI without live writes."""
import json, os, subprocess, sys
from pathlib import Path
folder=sys.argv[1]
name,scheme,bundle=('CeFaci-Client','CeFaci','ro.cefaci.app') if folder=='mobile' else ('CeFaci-Business','CeFaciBusiness','app.cefaci.business')
app=Path(os.environ['RUNNER_TEMP'])/name/'simulator/Build/Products/Release-iphonesimulator'/f'{scheme}.app'
devices=json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','--json'],text=True))['devices']
selected=[]
for prefix in (['iPhone'] if folder=='mobile' else ['iPhone','iPad']):
    matches=[d for runtime,ds in devices.items() if 'iOS' in runtime for d in ds if d['name'].startswith(prefix) and d.get('isAvailable')]
    assert matches,f'No available {prefix} simulator'
    selected.append(matches[0])
Path('release/ios-screenshots').mkdir(parents=True,exist_ok=True)
Path('release/ios-diagnostics').mkdir(parents=True,exist_ok=True)
if len(sys.argv)>2 and sys.argv[2]=='--prepare':
    # The first boot migrates a fresh runtime; let it run while Xcode compiles.
    first=selected[0]
    if first['state']!='Booted':subprocess.run(['xcrun','simctl','boot',first['udid']],check=True,timeout=180)
    print(f"Preparing {first['name']} in parallel with the native build.")
    sys.exit(0)
for d in selected:
    sid=d['udid']
    if d['state']!='Booted':subprocess.run(['xcrun','simctl','boot',sid],check=True,timeout=180)
    try:
        bootlog=Path(f"release/ios-diagnostics/{name}-{sid}-boot.log")
        print(f"Waiting for {d['name']} to finish runtime migration.",flush=True)
        with bootlog.open('w') as output:
            try:subprocess.run(['xcrun','simctl','bootstatus',sid,'-b'],check=True,timeout=600,stdout=output,stderr=subprocess.STDOUT)
            except (subprocess.CalledProcessError,subprocess.TimeoutExpired):
                print('\n'.join(bootlog.read_text().splitlines()[-25:]),flush=True)
                raise
        subprocess.run(['xcrun','simctl','install',sid,str(app)],check=True)
        subprocess.run(['xcrun','simctl','status_bar',sid,'override','--time','9:41','--batteryState','charged','--batteryLevel','100'],check=True)
        prefix=f"{name}-{'ipad' if d['name'].startswith('iPad') else 'iphone'}"
        output=Path('release/ios-screenshots')/prefix
        output.mkdir(parents=True,exist_ok=True)
        # Maestro 2.11 confines screenshots to the configured run's takeScreenshot folder.
        # A basename is resolved there; an absolute path outside it is rejected.
        subprocess.run(['maestro','--device',sid,'test','--test-output-dir',str(output),'--format','junit','--output',str(output/'results.xml'),'--debug-output',f'release/ios-diagnostics/{name}-{sid}-maestro','-e',f'SCREENSHOT_PREFIX={prefix}',f'.maestro/ios/{folder}.yaml'],check=True,timeout=420)
        # Maestro adds a timestamp and flow directory under the configured output root.
        captures=list(output.rglob(f'{prefix}-*.png'))
        assert len(captures)>=(4 if folder=='mobile' else 3), 'Expected actual native screenshots in the declared output folder'
        print(f"PASS: {name} pre-login/legal navigation on {d['name']} ({sid}); no OTP requested.")
    except Exception:
        subprocess.run(['xcrun','simctl','io',sid,'screenshot',f'release/ios-diagnostics/{name}-{sid}-failure.png'],check=False,timeout=30)
        raise
    finally:subprocess.run(['xcrun','simctl','shutdown',sid],check=False)
