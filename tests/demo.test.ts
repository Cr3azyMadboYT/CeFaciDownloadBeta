import { describe, expect, it, vi } from 'vitest';
import { DCLogic } from '../src/dc/runtime';
import { make } from '../src/boards/Demo.logic.js';
import { TPL } from '../src/boards/Demo.view.js';
import { APP } from '../src/app/bridge';
import { checker } from './holes';

describe('Demo board on real data', () => {
  it('walks the main journey without missing values', () => {
    vi.useFakeTimers();
    const check = checker(TPL);
    const problems = new Map<string, string>();
    const Comp = (make as any)(DCLogic);
    const c = new Comp({ theme: 'zi' });
    c._rerender = () => {};
    const V = () => c.renderVals();
    const snap = (l: string) => { try { check(l, V(), problems); } catch (e: any) { problems.set('THROW ' + l, String(e.stack).split('\n').slice(0, 3).join(' | ')); } };
    snap('initial');
    c.setState({ tut: { ...c.state.tut, on: false } }); snap('home');
    let v = V();
    console.log('home', v.appZone, 'drops', v.liveCount);
    v.showResults(); v = V(); snap('results');
    console.log('results', v.resTitle, '|', v.resSub, '|', v.cards.map((x: any) => x.name + ' — ' + x.title + ' — ' + x.reason + ' — ' + x.dist).join(' || '));
    v.onSq({ target: { value: 'pizza sector 2' } }); v = V(); snap('search');
    console.log('search', v.resTitle, v.resSub, v.cards.map((x: any) => x.name).join(', '));
    v.cards[0].pick(); vi.runOnlyPendingTimers(); v = V(); snap('ticket');
    console.log('ticket', c.state.screen, v.tName, v.tTitle, v.navUrl, v.showResAsk, v.askTitle, v.ciShow);
    v.openZone(); v = V(); snap('zone'); v.zoneGroups[1].zones[0].pick(); v = V();
    console.log('zone now', v.appZone, c.state.toast);
    c.setState({ sq: '', screen: 'home' }); v = V(); v.startVote && v.startVote(); vi.runOnlyPendingTimers(); snap('vote');
    for (const scr of ['plans', 'profile', 'drops', 'plus', 'carnet', 'friends', 'settings']) { c.setState({ screen: scr }); snap(scr); }
    for (const [k, val] of problems) console.log('PROBLEM', k, '@', val);
    expect([...problems.keys()].filter((k) => k.startsWith('THROW'))).toEqual([]);
  });
});
