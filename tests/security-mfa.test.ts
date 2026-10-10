import { describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { normalizeTotp, securityError, securitySessionKey, SecurityMfaCoordinator, type SecurityMfaState } from '../shared/security-mfa';

const account = '00000000-0000-4000-8000-000000000123';
const factorId = '00000000-0000-4000-8000-000000000456';
const seed = 'ABCDEFGHIJKLMNOP234567';
function fixture(verified = false, aal2 = false, forceChallenge = false) {
  let session = { user: { id: account }, access_token: 'initial-token', refresh_token: 'fake-refresh' } as Session;
  let aal = aal2 ? 'aal2' : 'aal1';
  const factors: Array<{ id: string; status: 'verified' | 'unverified'; factor_type: 'totp'; friendly_name: string }> = verified
    ? [{ id: factorId, status: 'verified', factor_type: 'totp', friendly_name: 'Autentificator' }] : [];
  let state: SecurityMfaState | undefined;
  const onVerified = vi.fn(async (_next: Session) => {});
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    mfa: {
      listFactors: vi.fn(async () => ({ data: { all: factors, totp: factors.filter(f => f.status === 'verified') }, error: null })),
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: aal, nextLevel: factors.some(f => f.status === 'verified') ? 'aal2' : 'aal1' }, error: null })),
      enroll: vi.fn(async (_params: unknown) => {
        factors.push({ id: factorId, status: 'unverified', factor_type: 'totp', friendly_name: 'Setup' });
        return { data: { id: factorId, type: 'totp', totp: { secret: seed, qr_code: '<svg/>' } }, error: null };
      }),
      challenge: vi.fn(async (_params: unknown) => ({ data: { id: 'challenge' }, error: null })),
      verify: vi.fn(async (_params: unknown) => {
        const factor = factors.find(f => f.id === factorId); if (factor) factor.status = 'verified';
        session = { ...session, access_token: 'verified-token' }; aal = 'aal2';
        return { data: session, error: null };
      }),
      unenroll: vi.fn(async ({ factorId: id }: { factorId: string }) => { const i = factors.findIndex(f => f.id === id); if (i >= 0) factors.splice(i, 1); return { data: { id }, error: null }; }),
    },
  };
  const coordinator = new SecurityMfaCoordinator({ auth } as unknown as SupabaseClient, account, 'admin', next => { state = next; }, onVerified, forceChallenge);
  return { auth, factors, onVerified, coordinator, state: () => state!, changeAccount: () => { session = { ...session, user: { ...session.user, id: 'another-user' } }; } };
}

describe('mandatory dashboard MFA coordination', () => {
  it('does not enroll or reveal a seed before the user asks for setup', async () => {
    const f = fixture(); await f.coordinator.load();
    expect(f.state().phase).toBe('setup'); expect(f.state().enrollment).toBeNull();
    expect(f.auth.mfa.enroll).not.toHaveBeenCalled(); expect(f.onVerified).not.toHaveBeenCalled();
  });
  it('challenges verified factors without deleting previously unfinished enrollments', async () => {
    const f = fixture(true); f.factors.push({ id: 'another-factor', status: 'unverified', factor_type: 'totp', friendly_name: 'Other screen' });
    await f.coordinator.load(); expect(f.state().factors.map(x => x.id)).toEqual([factorId]);
    expect(f.state().phase).toBe('verify'); expect(f.onVerified).not.toHaveBeenCalled(); expect(f.auth.mfa.unenroll).not.toHaveBeenCalled();
  });
  it('continues already elevated sessions only when a verified TOTP remains', async () => {
    const f = fixture(true, true); await f.coordinator.load(); expect(f.onVerified).toHaveBeenCalledOnce();
    const withoutFactor = fixture(false, true); await withoutFactor.coordinator.load(); expect(withoutFactor.onVerified).not.toHaveBeenCalled();
  });
  it('does not complete access if opening the server-side scoped session fails', async () => {
    const f = fixture(true, true); f.onVerified.mockRejectedValueOnce(new Error('Denied'));
    await f.coordinator.load(); expect(f.state().phase).toBe('verify'); expect(f.state().error).not.toBe('');
  });
  it('requires a fresh challenge for expired scoped sessions even when the JWT remains AAL2', async () => {
    const f = fixture(true, true, true); await f.coordinator.load();
    expect(f.state().phase).toBe('verify'); expect(f.onVerified).not.toHaveBeenCalled();
    await f.coordinator.verify('123456'); expect(f.onVerified).toHaveBeenCalledOnce();
  });
  it('bounds concurrent enrollment to a single factor and validates six-digit codes', async () => {
    const f = fixture(); await f.coordinator.load(); await Promise.all([f.coordinator.enroll(), f.coordinator.enroll()]);
    expect(f.auth.mfa.enroll).toHaveBeenCalledOnce(); expect(f.state().enrollment?.secret).toBe(seed);
    await f.coordinator.verify('123'); expect(f.auth.mfa.challenge).not.toHaveBeenCalled();
    expect(f.state().error).toContain('6 cifre');
  });
  it('clears the setup secret and returns the current elevated session', async () => {
    const f = fixture(); await f.coordinator.load(); await f.coordinator.enroll(); await f.coordinator.verify('123456');
    expect(f.state().enrollment).toBeNull(); expect(f.onVerified.mock.calls[0][0].access_token).toBe('verified-token');
    expect(f.auth.mfa.verify).toHaveBeenCalledWith({ factorId, challengeId: 'challenge', code: '123456' });
    f.coordinator.dispose(); await Promise.resolve(); expect(f.auth.mfa.unenroll).not.toHaveBeenCalled();
  });
  it('rejects expired codes without granting access', async () => {
    const f = fixture(true); await f.coordinator.load();
    f.auth.mfa.verify.mockResolvedValueOnce({ data: null as unknown as Session, error: { code: 'mfa_verification_failed' } } as never);
    await f.coordinator.verify('123456'); expect(f.onVerified).not.toHaveBeenCalled(); expect(f.state().error).toContain('Codul nu este valid');
  });
  it('cancels only the unverified factor created by this coordinator', async () => {
    const f = fixture(); f.factors.push({ id: 'previous', status: 'unverified', factor_type: 'totp', friendly_name: 'Other screen' });
    await f.coordinator.load(); await f.coordinator.enroll(); await f.coordinator.cancelEnrollment();
    expect(f.auth.mfa.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId });
    expect(f.factors.map(x => x.id)).toEqual(['previous']); expect(f.state().enrollment).toBeNull();
  });
  it('never cancels a factor that became verified elsewhere', async () => {
    const f = fixture(); await f.coordinator.load(); await f.coordinator.enroll(); f.factors[0].status = 'verified';
    await f.coordinator.cancelEnrollment(); expect(f.auth.mfa.unenroll).not.toHaveBeenCalled();
  });
  it('blocks account changes before challenging a factor', async () => {
    const f = fixture(true); await f.coordinator.load(); f.changeAccount(); await f.coordinator.verify('123456');
    expect(f.auth.mfa.challenge).not.toHaveBeenCalled(); expect(f.onVerified).not.toHaveBeenCalled();
  });
  it('blocks account changes between challenge and verification', async () => {
    const f = fixture(true); await f.coordinator.load();
    f.auth.mfa.challenge.mockImplementationOnce(async () => { f.changeAccount(); return { data: { id: 'challenge' }, error: null }; });
    await f.coordinator.verify('123456'); expect(f.auth.mfa.verify).not.toHaveBeenCalled(); expect(f.onVerified).not.toHaveBeenCalled();
  });
  it('does not publish a late enrollment after unmount and safely removes its own draft', async () => {
    const f = fixture(); await f.coordinator.load();
    let release!: () => void; const delay = new Promise<void>(resolve => { release = resolve; });
    const original = f.auth.mfa.enroll.getMockImplementation()!;
    f.auth.mfa.enroll.mockImplementationOnce(async params => { await delay; return original(params); });
    const enrolling = f.coordinator.enroll(); await Promise.resolve(); await Promise.resolve();
    f.coordinator.dispose(); release(); await enrolling;
    expect(f.state().enrollment).toBeNull(); expect(f.onVerified).not.toHaveBeenCalled();
    expect(f.auth.mfa.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId });
  });
  it('never removes factors from a replacement account during unmount', async () => {
    const f = fixture(); await f.coordinator.load(); await f.coordinator.enroll(); f.changeAccount(); f.coordinator.dispose();
    await Promise.resolve(); await Promise.resolve(); expect(f.auth.mfa.unenroll).not.toHaveBeenCalled();
  });
  it('normalizes codes and avoids leaking raw provider errors into screens', () => {
    expect(normalizeTotp('12 34-56 789')).toBe('123456');
    expect(securityError({ code: 'rate_limit_exceeded', status: 429 })).toContain('Prea multe încercări');
    expect(securityError(new Error('private token details'))).not.toContain('private token');
  });
  it('keeps the lifecycle key stable across refresh and distinguishes same-user sessions', () => {
    const jwt = (session_id: string, exp: number) => `header.${Buffer.from(JSON.stringify({session_id, exp})).toString('base64url')}.signature`;
    const first = {user: {id: account}, access_token: jwt(account, 123)} as Session;
    const refreshed = {...first, access_token: jwt(account, 456)};
    const another = {...first, access_token: jwt(factorId, 456)};
    expect(securitySessionKey(first)).toBe(securitySessionKey(refreshed));
    expect(securitySessionKey(first)).not.toBe(securitySessionKey(another));
    expect(securitySessionKey({...first, access_token: 'malformed'})).not.toBe(securitySessionKey(first));
  });
  it('blocks a replacement Auth session for the same account before challenging', async () => {
    const f = fixture(true), jwt = (id: string) => `header.${Buffer.from(JSON.stringify({session_id: id})).toString('base64url')}.signature`;
    const initial = {user: {id: account}, access_token: jwt(account)} as Session;
    f.auth.getSession.mockResolvedValueOnce({data: {session: initial}, error: null});
    f.auth.getSession.mockResolvedValueOnce({data: {session: initial}, error: null});
    f.auth.getSession.mockResolvedValueOnce({data: {session: initial}, error: null});
    await f.coordinator.load();
    f.auth.getSession.mockResolvedValueOnce({data: {session: {...initial, access_token: jwt(factorId)}}, error: null});
    await f.coordinator.verify('123456'); expect(f.auth.mfa.challenge).not.toHaveBeenCalled(); expect(f.onVerified).not.toHaveBeenCalled();
  });
  it('does not remove an owned factor while its verification is in flight during unmount', async () => {
    const f = fixture(); await f.coordinator.load(); await f.coordinator.enroll();
    let release!: () => void; const delayed = new Promise<void>(resolve => {release = resolve;});
    const original = f.auth.mfa.verify.getMockImplementation()!;
    f.auth.mfa.verify.mockImplementationOnce(async params => {await delayed; return original(params);});
    const verifying = f.coordinator.verify('123456');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(f.auth.mfa.verify).toHaveBeenCalled(); f.coordinator.dispose();
    expect(f.auth.mfa.unenroll).not.toHaveBeenCalled(); release(); await verifying;
    expect(f.auth.mfa.unenroll).not.toHaveBeenCalled(); expect(f.onVerified).not.toHaveBeenCalled();
  });
});
