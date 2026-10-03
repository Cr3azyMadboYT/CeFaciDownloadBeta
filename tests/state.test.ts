// What the app keeps between launches: plans, XP, the tour seen, and the Plus free week counted in real days.
import { beforeEach, describe, expect, it } from 'vitest';

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear() };
const { APP } = await import('../src/app/bridge');
const DAY = 864e5;

describe('saved state', () => {
  beforeEach(() => mem.clear());
  it('keeps plans, XP and the finished tour, not the screen you were on', () => {
    APP.saveBoardState({ plans: [{ pid: 3, placeId: 'n1' }], xp: 150, tut: { on: false, step: 9 }, screen: 'ticket', theme: 'noapte' });
    const back = APP.loadBoardState();
    expect(back).toMatchObject({ plans: [{ pid: 3 }], xp: 150, tut: { on: false }, theme: 'noapte' });
    expect(back.screen).toBeUndefined();
  });
  it('starts a tour again if it was left halfway', () => {
    APP.saveBoardState({ tut: { on: true, step: 4 } });
    expect(APP.loadBoardState().tut).toBeUndefined();
  });
  it('counts the free Plus week in real days and ends it after 7', () => {
    const t0 = Date.UTC(2026, 9, 3, 12);
    APP.saveBoardState({ plus: 'trial' }, t0);
    expect(APP.loadBoardState(t0 + 2 * DAY)).toMatchObject({ plus: 'trial', plusDay: 3 });
    expect(APP.loadBoardState(t0 + 4.5 * DAY)).toMatchObject({ plusDay: 5, plusModal: 'day5' });
    expect(APP.loadBoardState(t0 + 4.6 * DAY).plusModal).toBeUndefined(); // the day-5 note shows once
    APP.saveBoardState({ plus: 'trial' }, t0 + 5 * DAY);                   // saving again does not restart the week
    expect(APP.loadBoardState(t0 + 7.5 * DAY)).toMatchObject({ plus: 'off', plusModal: 'expired' });
  });
});
