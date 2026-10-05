// Sign-up without phone, birth date with a check, minors without 18+ places, budget ranges, home filters from the answers.
import { describe, expect, it, vi } from 'vitest';
import { DCLogic } from '../src/dc/runtime';
import { make } from '../src/boards/Cont.logic.js';
import { APP, ageOn, budgetRange } from '../src/app/bridge';
import venues from '../src/data/venues.json';
import { adultOnly, parseQuery, recommend, search, zoneById } from '../src/engine/core';
import type { Ctx, Venue } from '../src/engine/types';

const board = () => { const c = new ((make as any)(DCLogic))({}); c._rerender = () => {}; return c; };
const type = (fn: (e: unknown) => void, value: string) => fn({ target: { value } });
const V = venues as Venue[];

describe('sign-up', () => {
  it('has no phone step and hides Apple', () => {
    const c = board();
    const v = c.renderVals();
    expect(v.showApple).toBe(false);
    v.goLocal();
    expect(c.state.step).toBe('name');
    expect(c.renderVals().progText).toBe('1 din 6');
  });
  it('signs in with an email code', async () => {
    const sent: string[] = [];
    APP.emailStart = async (e: string) => { sent.push(e); return null; };
    APP.emailVerify = async (_e: string, code: string) => (code === '123456' ? null : 'Codul nu e bun sau a expirat.');
    const c = board(); c.renderVals().goEmail();
    expect(c.state.step).toBe('phone');
    type(c.renderVals().onPhone, 'ana@');
    expect(c.renderVals().phoneOff).toBe(true);
    type(c.renderVals().onPhone, ' Ana@Exemplu.ro ');
    expect(c.renderVals().phoneOff).toBe(false);
    c.renderVals().phoneNext(); await Promise.resolve(); await Promise.resolve();
    expect(sent).toEqual(['ana@exemplu.ro']); expect(c.renderVals().codeOpen).toBe(true);
    type(c.renderVals().onCode, '111111'); c.renderVals().phoneNext(); await Promise.resolve(); await Promise.resolve();
    expect(c.renderVals().codeBad).toBe(true); expect(c.state.step).toBe('phone');
    type(c.renderVals().onCode, '123456'); c.renderVals().phoneNext(); await Promise.resolve(); await Promise.resolve();
    expect(c.state.step).toBe('name');
  });
  it('reads the birth date as it is typed and asks before going on', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 3));
    const c = board(); c.renderVals().goLocal();
    let v = c.renderVals();
    type(v.onFirst, 'Ana'); type(c.renderVals().onUser, 'ana.test');
    type(c.renderVals().onBirth, '14052004');
    v = c.renderVals();
    expect(v.birth).toBe('14.05.2004');
    expect(v.nameOff).toBe(false);
    v.nameNext(); v = c.renderVals();
    expect(v.ageAsk).toBe(true); expect(v.ageMinor).toBe(false);
    expect(v.ageText).toBe('14.05.2004 înseamnă că ai 22 ani.');
    v.ageYes();
    expect(c.state.step).toBe('zone'); expect(c.state.birthIso).toBe('2004-05-14');
    vi.useRealTimers();
  });
  it('warns minors and blocks under 16 and impossible dates', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 3));
    const c = board(); c.renderVals().goLocal();
    type(c.renderVals().onFirst, 'Ion'); type(c.renderVals().onUser, 'ion.test');
    type(c.renderVals().onBirth, '01.01.2010');
    let v = c.renderVals();
    expect(v.nameOff).toBe(false); v.nameNext(); v = c.renderVals();
    expect(v.ageMinor).toBe(true); expect(v.ageNote).toMatch(/pentru oricine/);
    v.ageNo(); expect(c.state.step).toBe('name'); expect(c.renderVals().ageAsk).toBe(false);
    type(c.renderVals().onBirth, '01.01.2012'); expect(c.renderVals().nameOff).toBe(true);
    type(c.renderVals().onBirth, '31.02.2000'); expect(c.renderVals().nameOff).toBe(true);
    expect(c.renderVals().ageNote).toMatch(/nu pare bună/);
    vi.useRealTimers();
  });
});

describe('answers feed the app', () => {
  it('counts age by the birthday, not just the year', () => {
    expect(ageOn('2008-10-04', new Date(2026, 9, 3))).toBe(17);
    expect(ageOn('2008-10-03', new Date(2026, 9, 3))).toBe(18);
  });
  it('hides clubs and hookah for minors, everywhere', () => {
    const ctx: Ctx = { prefs: { zone: 'centru', likes: [] }, origin: zoneById('centru'), now: new Date(2026, 9, 2, 21), history: [], minor: true };
    expect(search(V, 'club', ctx).results.some((r) => adultOnly(r.v))).toBe(false);
    expect(search(V, 'shisha', ctx).results.some((r) => adultOnly(r.v))).toBe(false);
    expect(search(V, 'bar cu terasa', ctx).results.some((r) => ['bar', 'pub', 'biergarten'].includes(r.v.k))).toBe(false);
    // a place marked 18+ on the map (none of the chosen ones is, so one is made up from a café)
    const cafe = V.find((v) => v.k === 'cafe')!;
    const adult = [...V, { ...cafe, id: 'x-18', name: 'Zzyzx Lounge', minAge: 18 }];
    expect(search(adult, 'zzyzx lounge', ctx).results.some((r) => r.v.minAge === 18)).toBe(false);
    expect(search(adult, 'zzyzx lounge', { ...ctx, minor: false }).results[0].v.minAge).toBe(18);
    const r = recommend(V, { who: '34', when: 'diseara', budget: Infinity, maxKm: 10, vibes: ['Party'] }, ctx, 0, 60);
    expect(r.picks.some((p) => adultOnly(p.v))).toBe(false);
    expect(search(V, 'club', { ...ctx, minor: false }).results.some((x) => adultOnly(x.v))).toBe(true);
  });
  it('starts the home filters from the sign-up answers', () => {
    APP.prefs = { ...APP.prefs, who: 'duo', when: ['we'], budget: '50', mood: 'chill', dist: '30' };
    expect(APP.homeDefaults()).toMatchObject({ who: '2', when: 'we', budget: '50', vibes: ['Chill'], dist: '30' });
    APP.prefs = { ...APP.prefs, who: 'group', when: ['eve'], budget: 'any', mood: 'mix', likes: ['party'] };
    expect(APP.homeDefaults()).toMatchObject({ who: '34', when: 'eve', budget: 'any', vibes: ['Party'] });
  });
  it('turns minutes into km by how the person moves', () => {
    expect(APP.kmFor('20', ['walk'])).toBeCloseTo(1.6);
    expect(APP.kmFor('20', ['walk', 'car'])).toBe(10);
  });
  it('understands budget ranges in filters and in search', () => {
    expect(budgetRange('50-120')).toEqual({ min: 50, max: 120 });
    expect(budgetRange('-80')).toEqual({ min: 0, max: 80 });
    expect(budgetRange('100')).toEqual({ min: 0, max: 100 });
    const p = parseQuery('restaurant intre 50 si 100 lei');
    expect([p.budgetMin, p.budget]).toEqual([50, 100]);
    expect([parseQuery('bar 40-80 lei').budgetMin, parseQuery('bar 40-80 lei').budget]).toEqual([40, 80]);
    expect(APP.priceNote('pizza sub 50 lei', 'any')).toMatch(/estimate/);
    expect(APP.priceNote('', 'any')).toBe('');
  });
});
