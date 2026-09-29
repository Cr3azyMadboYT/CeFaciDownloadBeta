import { describe, expect, it, vi } from 'vitest';
import { DCLogic } from '../src/dc/runtime';
import { make } from '../src/boards/Cont.logic.js';
import { TPL } from '../src/boards/Cont.view.js';
import { checker } from './holes';

describe('Cont board', () => {
  it('walks sign-up with real picks', () => {
    vi.useFakeTimers();
    const check = checker(TPL); const problems = new Map<string, string>();
    const c = new ((make as any)(DCLogic))({}); c._rerender = () => {};
    const snap = (l: string) => { try { check(l, c.renderVals(), problems); } catch (e: any) { problems.set('THROW ' + l, String(e.stack).split('\n').slice(0, 3).join(' | ')); } };
    for (const step of ['start', 'phone', 'name', 'zone', 'likes', 'style', 'picks', 'friends', 'done']) { c.setState({ step, likes: ['food', 'party', 'bowl'], zoneId: 's2' }); snap(step); }
    c.setState({ step: 'picks', pick: 0 }); const v = c.renderVals();
    console.log(v.card.title, '|', v.card.tag, '|', v.card.sub);
    c.setState({ step: 'zone' }); console.log(c.renderVals().zoneGroups.map((g: any) => g.area + ':' + g.zones.length));
    for (const [k, val] of problems) console.log('PROBLEM', k, '@', val);
    expect([...problems.keys()].filter((k) => k.startsWith('THROW'))).toEqual([]);
  });
});
