// Phone ↔ Supabase sync, with a fake client: an existing account comes back whole, uploads go out only on real changes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount, makeUploader, restore, type CloudClient } from '../src/app/cloud';

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear() };

function fake(rows: Record<string, any>, rpc: Record<string, any> = {}) {
  const updates: any[] = [];
  const db: CloudClient = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table] ?? null }) }) }),
      update: (v: any) => ({ eq: () => { updates.push(v); return Promise.resolve({}); } }),
    }),
    rpc: (fn: string) => Promise.resolve(rpc[fn] ?? { data: null, error: null }),
  };
  return { db, updates };
}

describe('cloud sync', () => {
  beforeEach(() => { mem.clear(); vi.useRealTimers(); });
  it('brings back an existing account after reinstalling', async () => {
    const { db } = fake({
      profiles: { username: 'ana.p', first_name: 'Ana' },
      profile_private: { birth_date: '2000-01-01', prefs: { zone: 's2', likes: ['food'] }, app_state: { xp: 250, plans: [{ pid: 1 }], savedAt: 5 }, plus_trial_started_at: '2026-10-01T10:00:00Z' },
    });
    const r = await restore(db, 'u1');
    expect(r).toEqual({ known: true, first: 'Ana' });
    expect(JSON.parse(mem.get('cefaci.prefs')!)).toMatchObject({ zone: 's2', user: 'ana.p', name: 'Ana', birth: '2000-01-01' });
    expect(JSON.parse(mem.get('cefaci.state')!)).toMatchObject({ xp: 250, plans: [{ pid: 1 }], plusStart: Date.parse('2026-10-01T10:00:00Z') });
    expect(mem.get('cefaci.onboarded')).toBe('1');
  });
  it('keeps the phone state when it is newer', async () => {
    mem.set('cefaci.state', JSON.stringify({ xp: 400, savedAt: 9 }));
    const { db } = fake({ profiles: { username: 'a', first_name: 'A' }, profile_private: { birth_date: '2000-01-01', prefs: {}, app_state: { xp: 100, savedAt: 5 } } });
    await restore(db, 'u1');
    expect(JSON.parse(mem.get('cefaci.state')!).xp).toBe(400);
  });
  it('keeps the newer answers: a zone changed on the phone survives, an older phone copy gives way', async () => {
    mem.set('cefaci.prefs', JSON.stringify({ zone: 's3', prefsAt: 9 }));
    const rows = { profiles: { username: 'a', first_name: 'A' }, profile_private: { birth_date: '2000-01-01', prefs: { zone: 's1', prefsAt: 5 }, app_state: {} } };
    await restore(fake(rows).db, 'u1');
    expect(JSON.parse(mem.get('cefaci.prefs')!).zone).toBe('s3');
    mem.set('cefaci.prefs', JSON.stringify({ zone: 's3', prefsAt: 2 }));
    await restore(fake(rows).db, 'u1');
    expect(JSON.parse(mem.get('cefaci.prefs')!).zone).toBe('s1');
  });
  it('says when the account is new', async () => {
    expect((await restore(fake({}).db, 'u1')).known).toBe(false);
  });
  it('uploads only real changes, at most every few seconds, without location or birth date', () => {
    vi.useFakeTimers();
    const { db, updates } = fake({});
    const up = makeUploader(db, 'u1', 3000);
    up({ xp: 1, savedAt: 1 }, { zone: 's1', here: { lat: 1 }, birth: '2000-01-01' });
    up({ xp: 1, savedAt: 2 }, { zone: 's1' });
    up({ xp: 2, savedAt: 3 }, { zone: 's1' });
    vi.advanceTimersByTime(3000);
    expect(updates).toHaveLength(1);
    expect(updates[0].app_state.xp).toBe(2); expect(updates[0].prefs).toEqual({ zone: 's1' });
    up({ xp: 2, savedAt: 4 }, { zone: 's1' }); // the clock ticked, nothing changed
    vi.advanceTimersByTime(3000);
    expect(updates).toHaveLength(1);
  });
  it('starts the free Plus week with the phone code, and hears when the phone already had it', async () => {
    const sent: any[] = [];
    const told: string[] = [];
    const answer = { data: null, error: { message: 'Săptămâna gratuită de Plus s-a folosit deja pe telefonul ăsta.' } };
    const db = { ...fake({}).db, rpc: (fn: string, args?: any) => { sent.push([fn, args]); return Promise.resolve(answer); } } as CloudClient;
    const up = makeUploader(db, 'u1', 3000, { device: async () => 'f'.repeat(64), refused: (m) => told.push(m) });
    up({ plus: 'trial' }, {});
    up({ plus: 'trial', xp: 1 }, {});
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toEqual([['start_plus_trial', { p_device: 'f'.repeat(64) }]]);
    expect(told[0]).toMatch(/folosit deja/);
  });
  it('explains a taken username', async () => {
    const { db } = fake({}, { complete_signup: { data: null, error: { message: 'duplicate key value violates unique constraint' } } });
    expect(await createAccount(db, { username: 'x', first: 'X', birth: '2000-01-01', prefs: {} })).toMatch(/luat/);
  });
});
