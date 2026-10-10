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
for d in selected:
    sid=d['udid']
    subprocess.run(['xcrun','simctl','boot',sid],check=True)
    try:
        subprocess.run(['xcrun','simctl','bootstatus',sid,'-b'],check=True,timeout=180)
        subprocess.run(['xcrun','simctl','install',sid,str(app)],check=True)
        subprocess.run(['xcrun','simctl','status_bar',sid,'override','--time','9:41','--batteryState','charged','--batteryLevel','100'],check=True)
        screenshots=f"release/ios-screenshots/{name}-{'ipad' if d['name'].startswith('iPad') else 'iphone'}"
        subprocess.run(['maestro','--device',sid,'test','--format','junit','--output',f'{screenshots}-results.xml','-e',f'SCREENSHOT_PREFIX={screenshots}',f'.maestro/ios/{folder}.yaml'],check=True,timeout=240)
        print(f"PASS: {name} pre-login/legal navigation on {d['name']} ({sid}); no OTP requested.")
    finally:subprocess.run(['xcrun','simctl','shutdown',sid],check=False)
