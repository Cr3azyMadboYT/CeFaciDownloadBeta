import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  revision: 0,
  app: { who: { id: 'a' } as { id: string } | null, known: true, board: {} as Record<string, any> },
  rpc: vi.fn(), invoke: vi.fn(), permission: vi.fn(), gps: vi.fn(), picker: vi.fn(),
}));
vi.mock('../mobile/src/lib/session', () => ({
  getApp: () => mock.app,
  captureAccount: () => { const revision = mock.revision; return () => revision === mock.revision; },
  setBoard: (patch: any) => { mock.app.board = { ...mock.app.board, ...(typeof patch === 'function' ? patch(mock.app.board) : patch) }; },
}));
vi.mock('../mobile/src/lib/auth', () => ({ sb: () => ({ rpc: mock.rpc, functions: { invoke: mock.invoke } }) }));
vi.mock('../src/app/bridge', () => ({ APP: {
  byId: () => ({ id: 'venue', name: 'Local sintetic', real: { cat: 'cafea', lat: 44.4, lon: 26.1 }, icon: '', bg: '' }),
  canPlan: () => true, partnerInfo: () => undefined,
} }));
vi.mock('../src/engine/core', () => ({ km: () => 0 }));
vi.mock('../mobile/src/lib/filters', () => ({ WHO: {} }));
vi.mock('../mobile/src/lib/remind', () => ({ remindBill: vi.fn(async () => []), cancelReminders: vi.fn(async () => {}) }));
vi.mock('../mobile/node_modules/react-native', () => ({ AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('../mobile/node_modules/expo-location', () => ({ requestForegroundPermissionsAsync: mock.permission, getCurrentPositionAsync: mock.gps, Accuracy: { High: 6 } }));
vi.mock('../mobile/node_modules/expo-image-picker', () => ({ requestCameraPermissionsAsync: mock.permission, requestMediaLibraryPermissionsAsync: mock.permission, launchCameraAsync: mock.picker, launchImageLibraryAsync: mock.picker }));

import { startsAt, type Plan } from '../mobile/src/lib/plans';
import { claimDrop, ensurePlan } from '../mobile/src/lib/partner';
import { checkIn, sendBill } from '../mobile/src/lib/outing';
import { answer } from '../mobile/src/lib/together';

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const plan = (patch: Partial<Plan> = {}): Plan => ({ pid: 1, placeId: 'venue', when: 'now', slot: 'acum', people: 2, res: 'none', createdAt: Date.now(), ...patch });
const switchAccount = () => { mock.revision++; mock.app.who = { id: 'b' }; mock.app.board = { plans: [plan({ createdAt: Date.now() + 1 })], xp: 7 }; };
beforeEach(() => { vi.clearAllMocks(); mock.revision++; mock.app = { who: { id: 'a' }, known: true, board: { plans: [plan()] } }; mock.permission.mockResolvedValue({ granted: true, status: 'granted' }); mock.gps.mockResolvedValue({ coords: { latitude: 44.4, longitude: 26.1, accuracy: 5 } }); mock.picker.mockResolvedValue({ canceled: false, assets: [{ base64: 'synthetic-image' }] }); });

describe('Client audit: real service boundaries', () => {
  it('keeps midnight reservation hours instead of moving them to 20:xx', () => {
    const p = plan({ date: '2026-10-09', slot: '00:30' });
    expect(startsAt(p).getHours()).toBe(0);
    expect(startsAt(p).getMinutes()).toBe(30);
  });

  it('does not run queued plan creation using the next signed-in account', async () => {
    const response = deferred<any>();
    mock.rpc.mockReturnValueOnce(response.promise).mockResolvedValue({ data: 'wrong-account-plan', error: null });
    const p = mock.app.board.plans[0];
    const first = ensurePlan(p).catch((e: Error) => e.message);
    const queued = ensurePlan(p, { friendIds: ['friend-a'] }).catch((e: Error) => e.message);
    await vi.waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
    switchAccount(); response.resolve({ data: 'old-plan', error: null });
    await Promise.all([first, queued]);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.app.board.plans[0].sid).toBeUndefined();
  });

  it('does not claim a Drop when the account changes while GPS is loading', async () => {
    const position = deferred<any>(); mock.gps.mockReturnValue(position.promise);
    const p = plan({ sid: 'old-plan' }); mock.app.board.plans = [p];
    const result = claimDrop(p, 'drop', 1).catch((e: Error) => e.message);
    await vi.waitFor(() => expect(mock.gps).toHaveBeenCalledTimes(1));
    switchAccount(); position.resolve({ coords: { latitude: 44.4, longitude: 26.1 } });
    await result;
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('does not check in the next account after a delayed location result', async () => {
    const position = deferred<any>(); mock.gps.mockReturnValue(position.promise);
    mock.rpc.mockResolvedValue({ data: { gain: 100, total: 900 }, error: null });
    const result = checkIn(mock.app.board.plans[0]);
    await vi.waitFor(() => expect(mock.gps).toHaveBeenCalledTimes(1));
    switchAccount(); position.resolve({ coords: { latitude: 44.4, longitude: 26.1, accuracy: 5 } });
    expect((await result).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.app.board.xp).toBe(7);
  });

  it('does not upload a previous account receipt after the camera returns', async () => {
    const photo = deferred<any>(); mock.picker.mockReturnValue(photo.promise);
    mock.invoke.mockResolvedValue({ data: { bon: { total: 45 }, xp: { gain: 25, total: 225 } }, error: null });
    const result = sendBill(mock.app.board.plans[0], 'camera');
    await vi.waitFor(() => expect(mock.picker).toHaveBeenCalledTimes(1));
    switchAccount(); photo.resolve({ canceled: false, assets: [{ base64: 'synthetic-image' }] });
    expect((await result)?.ok).toBe(false);
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(mock.app.board.xp).toBe(7);
  });

  it('does not apply the previous account receipt/XP after switching', async () => {
    const response = deferred<any>(); mock.invoke.mockReturnValue(response.promise);
    const result = sendBill(mock.app.board.plans[0], 'gallery');
    await vi.waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
    switchAccount(); response.resolve({ data: { bon: { total: 45 }, xp: { gain: 25, total: 925 } }, error: null });
    expect((await result)?.ok).toBe(false);
    expect(mock.app.board.xp).toBe(7);
    expect(mock.app.board.plans[0].bonDone).toBeUndefined();
  });

  it('removes the local participant ticket only after Nu pot succeeds', async () => {
    mock.app.board.plans = [plan({ sid: 'shared', owner: false })];
    const invite = { planId: 'shared', venueId: 'venue', venueName: 'Local sintetic', startsAt: new Date().toISOString(), owner: { id: 'owner', username: 'owner', first_name: 'Owner' }, answer: 'vin' as const, crewId: null };
    mock.rpc.mockResolvedValueOnce({ error: { message: 'Offline' } });
    expect(await answer(invite, 'a', 'nu_pot')).toBe('Offline');
    expect(mock.app.board.plans).toHaveLength(1);
    mock.rpc.mockResolvedValueOnce({ data: 1, error: null });
    expect(await answer(invite, 'a', 'nu_pot')).toBeNull();
    expect(mock.app.board.plans).toHaveLength(0);
  });
});
