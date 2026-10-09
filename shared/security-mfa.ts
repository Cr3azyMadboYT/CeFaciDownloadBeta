import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type SecurityFactor = { id: string; name: string };
export type SecurityEnrollment = { id: string; secret: string; qr: string };
export type SecurityMfaState = {
  busy: boolean;
  phase: 'loading' | 'setup' | 'verify' | 'enroll' | 'complete';
  factors: SecurityFactor[];
  selected: string;
  enrollment: SecurityEnrollment | null;
  error: string;
};

export function normalizeTotp(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

/** A lifecycle key only. Server-side authorization never trusts these decoded claims. */
function authSessionId(session: Session): string | null {
  try {
    const encoded = session.access_token.split('.')[1];
    if (!encoded || encoded.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0, bitCount = 0, decoded = '';
    for (const char of encoded.replace(/-/g, '+').replace(/_/g, '/')) {
      bits = bits * 64 + alphabet.indexOf(char); bitCount += 6;
      if (bitCount >= 8) { bitCount -= 8; decoded += String.fromCharCode((bits >>> bitCount) & 255); bits &= (1 << bitCount) - 1; }
    }
    const id = JSON.parse(decoded).session_id;
    return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
  } catch { return null; }
}

export function securitySessionKey(session: Session): string {
  return `${session.user.id}:${authSessionId(session) || `token:${session.access_token}`}`;
}

export function securityError(error: unknown): string {
  const e = error as { code?: string; status?: number } | null;
  if (e?.status === 429 || e?.code?.includes('rate_limit'))
    return 'Prea multe încercări. Așteaptă puțin și încearcă din nou.';
  if (['mfa_verification_failed', 'mfa_challenge_expired', 'invalid_credentials'].includes(e?.code || ''))
    return 'Codul nu este valid sau a expirat. Introdu codul nou din aplicația de autentificare.';
  if (e?.code === 'mfa_factor_name_conflict')
    return 'Configurarea nu a putut începe. Reîncearcă; contul tău păstrează metodele deja activate.';
  if (e?.code === 'mfa_totp_enroll_not_enabled')
    return 'Autentificarea în doi pași nu este încă disponibilă. Contactează echipa CeFaci.';
  return 'Nu am putut verifica securitatea contului. Încearcă din nou.';
}

/** Owns only factors created by this screen. Never deletes existing/verified factors. */
export class SecurityMfaCoordinator {
  private disposed = false;
  private generation = 0;
  private running = false;
  private owned = new Set<string>();
  private verifyingFactor = '';
  private completed = false;
  private boundSessionId: string | null = null;
  private boundToken: string | null = null;
  private state: SecurityMfaState = {
    busy: true, phase: 'loading', factors: [], selected: '', enrollment: null, error: '',
  };

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly scope: 'admin' | 'business',
    private readonly publish: (state: SecurityMfaState) => void,
    private readonly onVerified: (session: Session) => Promise<void> | void,
    private readonly forceChallenge = false,
    initialSession?: Session,
  ) {
    if (initialSession) {
      this.boundSessionId = authSessionId(initialSession);
      this.boundToken = initialSession.access_token;
    }
  }

  private emit(patch: Partial<SecurityMfaState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.publish(this.state);
  }

  private valid(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private async session(): Promise<Session> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session || data.session.user.id !== this.userId)
      throw new Error('Session changed');
    const id = authSessionId(data.session);
    if (this.boundSessionId ? id !== this.boundSessionId : this.boundToken && data.session.access_token !== this.boundToken)
      throw new Error('Session changed');
    this.boundSessionId ??= id;
    this.boundToken ??= data.session.access_token;
    return data.session;
  }

  private async execute(action: (generation: number) => Promise<void>) {
    if (this.disposed || this.running) return;
    this.running = true;
    const generation = this.generation;
    this.emit({ busy: true, error: '' });
    try { await action(generation); }
    catch (e) { if (this.valid(generation)) this.emit({ error: securityError(e) }); }
    finally { this.running = false; if (this.valid(generation)) this.emit({ busy: false }); }
  }

  async load() {
    await this.execute(async generation => {
      await this.session();
      if (!this.valid(generation)) return;
      const { data, error } = await this.client.auth.mfa.listFactors();
      if (error) throw error;
      await this.session();
      if (!this.valid(generation)) return;
      const factors = data.totp.filter(f => f.status === 'verified').map(f => ({
        id: f.id, name: f.friendly_name || 'Aplicația de autentificare',
      }));
      this.emit({ factors, selected: factors[0]?.id || '', enrollment: null, phase: factors.length ? 'verify' : 'setup' });
      // The caller checks current database roles and opens the scoped server session.
      const assurance = await this.client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      const session = await this.session();
      if (this.valid(generation) && !this.forceChallenge && factors.length && assurance.data.currentLevel === 'aal2')
        await this.finish(session, generation);
    });
  }

  select(id: string) {
    if (!this.running && this.state.factors.some(f => f.id === id))
      this.emit({ selected: id, error: '' });
  }

  async enroll() {
    await this.execute(async generation => {
      if (this.state.phase !== 'setup' || this.state.enrollment || this.state.factors.length) return;
      await this.session();
      if (!this.valid(generation)) return;
      // No reused friendly name and no cleanup of factors from other screens/devices.
      const suffix = Math.random().toString(36).slice(2, 10);
      const { data, error } = await this.client.auth.mfa.enroll({
        factorType: 'totp', friendlyName: `CeFaci ${this.scope} ${suffix}`,
      });
      if (error) throw error;
      this.owned.add(data.id);
      if (!this.valid(generation)) { await this.cleanup(data.id); return; }
      await this.session();
      if (!this.valid(generation)) { await this.cleanup(data.id); return; }
      if (!/^[A-Z2-7]{16,128}$/.test(data.totp.secret)) {
        await this.cleanup(data.id); throw new Error('Invalid secret');
      }
      this.emit({ phase: 'enroll', selected: data.id, enrollment: {
        id: data.id, secret: data.totp.secret, qr: data.totp.qr_code,
      } });
    });
  }

  async verify(code: string) {
    await this.execute(async generation => {
      if (!/^\d{6}$/.test(code) || !this.state.selected || !['verify', 'enroll'].includes(this.state.phase)) {
        this.emit({ error: 'Introdu cele 6 cifre din aplicația de autentificare.' }); return;
      }
      await this.session();
      if (!this.valid(generation)) return;
      const factorId = this.state.selected;
      const challenge = await this.client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      await this.session();
      if (!this.valid(generation)) return;
      this.verifyingFactor = factorId;
      let verification: Awaited<ReturnType<typeof this.client.auth.mfa.verify>>;
      try { verification = await this.client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code }); }
      catch (error) {
        this.verifyingFactor = '';
        if (this.disposed) void this.cleanup(factorId);
        throw error;
      }
      this.verifyingFactor = '';
      if (verification.error) {
        if (this.disposed) void this.cleanup(factorId);
        throw verification.error;
      }
      // Clear the seed immediately, including when opening the scoped session fails.
      this.owned.delete(factorId);
      this.emit({ enrollment: null, phase: 'verify' });
      if (verification.data.user.id !== this.userId || !this.valid(generation)) return;
      if (this.boundSessionId && authSessionId(verification.data as Session) !== this.boundSessionId) return;
      if (!this.boundSessionId) this.boundToken = verification.data.access_token;
      const session = await this.session();
      if (!this.valid(generation) || session.access_token !== verification.data.access_token) return;
      const assurance = await this.client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (assurance.data.currentLevel !== 'aal2') throw new Error('MFA verification required');
      if (this.valid(generation)) await this.finish(session, generation);
    });
  }

  private async finish(session: Session, generation: number) {
    if (this.completed || !this.valid(generation)) return;
    this.emit({ phase: 'complete', enrollment: null });
    try {
      await this.onVerified(session);
      if (this.valid(generation)) this.completed = true;
    } catch (e) {
      if (this.valid(generation)) this.emit({ phase: 'verify' });
      throw e;
    }
  }

  private async cleanup(id: string) {
    if (!this.owned.has(id) || this.verifyingFactor === id) return;
    try {
      await this.session();
      const { data, error } = await this.client.auth.mfa.listFactors();
      if (error) return;
      if (!data.all.some(f => f.id === id && f.factor_type === 'totp' && f.status === 'unverified')) {
        this.owned.delete(id); return;
      }
      await this.session();
      if (!this.owned.has(id) || this.verifyingFactor === id) return;
      const result = await this.client.auth.mfa.unenroll({ factorId: id });
      if (!result.error) this.owned.delete(id);
    } catch { /* Account changes must never remove factors from the next account. */ }
  }

  async cancelEnrollment() {
    await this.execute(async generation => {
      const id = this.state.enrollment?.id;
      this.emit({ enrollment: null, selected: '', phase: 'setup' });
      if (id) await this.cleanup(id);
      if (!this.valid(generation)) return;
      if (id && this.owned.has(id)) this.emit({ error: 'La închiderea configurării a apărut o problemă. Poți reîncerca fără să afectezi metodele active.' });
    });
  }

  dispose() {
    this.disposed = true;
    this.generation++;
    this.state = { ...this.state, enrollment: null };
    for (const id of this.owned) void this.cleanup(id);
  }
}
