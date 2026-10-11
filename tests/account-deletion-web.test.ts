import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn(), signOut: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc, auth: { getSession: mocks.getSession, signOut: mocks.signOut } }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: {} }));
import { deleteAccountEverywhere } from '../src/app/auth';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'own-account' } } }, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

it('preserves the local account when the server requires erasure review', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Contul are documente. Trimite o cerere de ștergere.' } });
  expect(await deleteAccountEverywhere()).toContain('cerere de ștergere');
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it('does not announce deletion or sign out after a network failure', async () => {
  mocks.rpc.mockRejectedValue(new Error('offline'));
  expect(await deleteAccountEverywhere()).toContain('nu a confirmat');
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it('does not call deletion when the session check fails', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'expired' } });
  expect(await deleteAccountEverywhere()).toContain('nu a fost șters');
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it('signs out locally only after the server confirmed deletion', async () => {
  expect(await deleteAccountEverywhere()).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledWith('delete_my_account');
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('requires sign-in instead of treating an absent session as confirmed deletion', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  expect(await deleteAccountEverywhere()).toContain('Intră din nou');
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
});
