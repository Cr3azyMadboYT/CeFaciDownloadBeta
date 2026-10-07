import { afterEach, expect, it, vi } from 'vitest';
import { checkedFor, createLiveChecker } from '../src/app/liveOpen';
afterEach(() => vi.useRealTimers());
it('a venue closed tomorrow can still be open today; times inside one half-hour are distinct',async () => {
  vi.useFakeTimers();
  const invoke=vi.fn().mockResolvedValueOnce({data:{checked:{v:{open:false}}}}).mockResolvedValue({data:{checked:{v:{open:true}}}});
  const c=createLiveChecker(invoke);
  const tomorrow=new Date('2026-10-08T10:00Z'), today=new Date('2026-10-07T10:00Z');
  const item=(at:Date)=>({id:'v',name:'Local',lat:44,lon:26,at});
  await c.checkOpen([item(tomorrow)]);
  expect(c.isClosed('v',tomorrow)).toBe(true); expect(c.isClosed('v',today)).toBe(false);
  await c.checkOpen([item(today)]);
  expect(c.isClosed('v',today)).toBe(false);
  await c.checkOpen([item(new Date('2026-10-08T10:05Z'))]);
  expect(invoke).toHaveBeenCalledTimes(3);
  await c.checkOpen([item(tomorrow)]); expect(invoke).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(3600001);
  await c.checkOpen([item(tomorrow)]);
  expect(c.isClosed('v',tomorrow)).toBe(false);
});
it('a check for a short visit does not certify a longer visit',async () => {
  vi.useFakeTimers();
  const c=createLiveChecker(vi.fn().mockResolvedValue({data:{checked:{v:{open:false}}}}));
  const at=new Date('2026-10-08T10:00Z'), until=new Date('2026-10-08T11:00Z');
  await c.checkOpen([{id:'v',name:'Local',lat:44,lon:26,at,until}]);
  expect(c.isClosed('v',at,until)).toBe(true);
  expect(c.isClosed('v',at,new Date('2026-10-08T10:30Z'))).toBe(false);
});

it('only labels a plan as verified for the interval that was actually checked',async () => {
  vi.useFakeTimers();
  const at=new Date('2026-10-08T10:00Z'), until=new Date('2026-10-08T11:00Z');
  const c=createLiveChecker(async()=>({data:{checked:{v:{open:true}}}}));
  const r=await c.checkOpen([{id:'v',name:'Local',lat:44,lon:26,at,until}]);
  expect(checkedFor(r.v,at,until)).toBe(true);
  expect(checkedFor(r.v,new Date('2026-10-09T10:00Z'),until)).toBe(false);
  expect(checkedFor(r.v,at,new Date('2026-10-08T12:00Z'))).toBe(false);
});
