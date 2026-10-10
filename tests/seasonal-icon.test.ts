import {describe, it, expect, vi} from 'vitest';
import {createRequire} from 'node:module';
import {watchSeasonalIcon, type IconNative} from '../shared/seasonal-icon';
import type {Look} from '../src/app/season';
const require = createRequire(import.meta.url);
const {applyAliases, LOOKS} = require('../business/plugins/withSeasonIcons.js');
const flush = async () => {await Promise.resolve(); await Promise.resolve();};
function setup(platform='android', initial='active', nativePresent=true) {
  let listener = (_:string) => {}, look = 'toamna', date = new Date(2026,8,30,12);
  const remove = vi.fn();
  const native: IconNative = {current: vi.fn(() => look),set: vi.fn(async (target:Look) => {look=target;return true;})};
  const stop = watchSeasonalIcon({platform,native:nativePresent?native:null,now:()=>date,appState:{currentState:initial,addEventListener:(_,fn)=>{listener=fn;return {remove};}}});
  return {native,stop,remove,emit:(state:string)=>listener(state),date:(next:Date)=>{date=next;}};
}
describe('Business native seasonal lifecycle',()=>{
 it('Android never changes the launcher while the app is active or inactive',async()=>{
  const f=setup();f.date(new Date(2026,11,1,12));f.emit('active');f.emit('inactive');expect(f.native.set).not.toHaveBeenCalled();f.emit('background');await flush();expect(f.native.set).toHaveBeenCalledWith('craciun');f.emit('background');await flush();expect(f.native.set).toHaveBeenCalledTimes(1);
 });
 it('rechecks the date across all seasons and the Christmas year boundary',async()=>{
  const f=setup();for(const [month,day,year,target] of [[12,1,2026,'craciun'],[1,7,2027,'craciun'],[1,8,2027,'iarna'],[3,1,2027,'primavara'],[6,1,2027,'vara'],[9,1,2027,'toamna']] as const){f.date(new Date(year,month-1,day,12));f.emit('background');await flush();expect(f.native.current()).toBe(target);}expect(f.native.set).toHaveBeenCalledTimes(5);
 });
 it('UIKit uses the foreground and stops after unmount',async()=>{
  const f=setup('ios','background');f.date(new Date(2026,5,1));f.emit('background');expect(f.native.set).not.toHaveBeenCalled();f.emit('active');await flush();expect(f.native.set).toHaveBeenCalledWith('vara');f.stop();f.date(new Date(2026,11,1));f.emit('active');expect(f.remove).toHaveBeenCalledOnce();expect(f.native.set).toHaveBeenCalledOnce();
 });
 it('an unavailable module and web cannot attempt launcher changes',()=>{
  for(const f of [setup('web'),setup('android','active',false)]){f.emit('background');expect(f.native.set).not.toHaveBeenCalled();f.stop();}
 });
 it('OS failure retries only on a later lifecycle event',async()=>{
  const f=setup();vi.mocked(f.native.set).mockRejectedValueOnce(new Error('OS refused'));f.date(new Date(2026,5,1));f.emit('background');await flush();expect(f.native.set).toHaveBeenCalledOnce();f.emit('background');await flush();expect(f.native.current()).toBe('vara');expect(f.native.set).toHaveBeenCalledTimes(2);
 });
 it('coalesces concurrent updates and never switches after returning to foreground',async()=>{
  const f=setup();let resolve!:(v:boolean)=>void;vi.mocked(f.native.set).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));f.date(new Date(2026,5,1));f.emit('background');f.date(new Date(2026,11,1));f.emit('background');expect(f.native.set).toHaveBeenCalledOnce();f.emit('active');resolve(true);await flush();expect(f.native.set).toHaveBeenCalledOnce();f.emit('background');await flush();expect(f.native.set).toHaveBeenLastCalledWith('craciun');
 });
});
describe('Business Android alias configuration',()=>{
 it('repeated prebuild leaves exactly one launcher enabled and preserves deep links and other aliases',()=>{
  const deepLink={action:[{$:{'android:name':'android.intent.action.VIEW'}}],category:[{$:{'android:name':'android.intent.category.BROWSABLE'}}]};
  const launcher={action:[{$:{'android:name':'android.intent.action.MAIN'}}],category:[{$:{'android:name':'android.intent.category.LAUNCHER'}}]};
  const m={application:[{activity:[{$:{'android:name':'.MainActivity'},'intent-filter':[launcher,deepLink]}],'activity-alias':[{$:{'android:name':'.Other'}}]}]};applyAliases(m);applyAliases(m);const app=m.application[0];expect(app.activity[0]['intent-filter']).toEqual([deepLink]);expect(app['activity-alias']).toHaveLength(6);const aliases=app['activity-alias'].filter(a=>a.$['android:name'].startsWith('.Icon_'));expect(aliases.filter(a=>a.$['android:enabled']==='true').map(a=>a.$['android:name'])).toEqual(['.Icon_toamna']);expect(aliases.map(a=>a.$['android:name'])).toEqual(LOOKS.map((look:string)=>'.Icon_'+look));
 });
 it('refuses a manifest missing its target activity',()=>{expect(()=>applyAliases({application:[{activity:[]}]})).toThrow('MainActivity missing');});
});
