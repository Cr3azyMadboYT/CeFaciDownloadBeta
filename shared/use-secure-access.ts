import {useCallback, useEffect, useRef, useState} from 'react';
import {subscribeSecurityFailure} from './security-events';

export type SecureScope = 'admin' | 'business';
export type AccessIdentity = {admin_role: string | null; business_access: boolean};
export type SecureStatus = {active: boolean; reason?: string; reauthentication_required?: boolean; idle_expires_at?: string | null; expires_at?: string | null};
type Call = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
type AccessState = {binding: string; identity: AccessIdentity | null; status: SecureStatus | null; error: string};

// Polling checks access; only a user interaction can extend the idle deadline.
export function useSecureAccess(userId: string, scope: SecureScope, call: Call, sessionKey = '') {
  const binding = `${scope}:${userId}:${sessionKey}`;
  const [state, setState] = useState<AccessState>({binding, identity: null, status: null, error: ''});
  const epoch = useRef(0), sequence = useRef(0), touchAt = useRef(0);
  const current = useRef(binding); current.current = binding;
  const visible = state.binding === binding ? state : {binding, identity: null, status: null, error: ''};
  const admitted = !!visible.identity && (scope === 'admin' ? !!visible.identity.admin_role : visible.identity.business_access);
  const active = admitted && !!visible.status?.active;
  const inspect = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const capturedEpoch = epoch.current, capturedBinding = binding, request = ++sequence.current;
    const valid = () => capturedEpoch === epoch.current && capturedBinding === current.current && request === sequence.current;
    try {
      const identity = await call<AccessIdentity>('secure_access_status');
      if (!valid()) return false;
      const hasRole = scope === 'admin' ? !!identity.admin_role : identity.business_access;
      const status = hasRole ? await call<SecureStatus>('secure_session_status', {p_scope: scope}) : {active: false, reason: 'no_role'};
      if (!valid()) return false;
      setState({binding: capturedBinding, identity, status, error: ''});
      return hasRole && status.active;
    } catch (e) {
      if (valid()) setState({binding: capturedBinding, identity: null, status: null, error: e instanceof Error ? e.message : 'Nu am putut verifica accesul. Reîncearcă online.'});
      return false;
    }
  }, [userId, binding, scope, call]);
  const check = useCallback(async (): Promise<void> => { await inspect(); }, [inspect]);
  useEffect(() => {
    epoch.current++; sequence.current++; touchAt.current = 0;
    setState({binding, identity: null, status: null, error: ''});
    if (!userId) return;
    void check();
    const timer = setInterval(() => void check(), 15000);
    return () => {epoch.current++; sequence.current++; clearInterval(timer);};
  }, [binding, userId, check]);
  useEffect(() => {
    if (!active || !visible.status) return;
    const deadlines = [visible.status.idle_expires_at, visible.status.expires_at].filter(Boolean).map(v => Date.parse(v!)).filter(Number.isFinite);
    if (!deadlines.length) return;
    const capturedEpoch = epoch.current, capturedBinding = binding;
    const timer = setTimeout(() => {
      if (capturedEpoch !== epoch.current || capturedBinding !== current.current) return;
      sequence.current++;
      setState(previous => previous.binding === capturedBinding && previous.status?.active ? {
        ...previous, status: {...previous.status, active: false, reason: 'expired', reauthentication_required: true},
      } : previous);
    }, Math.max(0, Math.min(...deadlines) - Date.now()));
    return () => clearTimeout(timer);
  }, [active, visible.status, binding]);
  const verified = useCallback(async () => {
    const capturedEpoch = epoch.current, capturedBinding = binding, request = ++sequence.current;
    const next = await call<SecureStatus>('secure_session_open', {p_scope: scope});
    if (capturedEpoch !== epoch.current || capturedBinding !== current.current || request !== sequence.current)
      throw new Error('Sesiunea s-a schimbat. Verifică din nou accesul.');
    if (!next.active) throw new Error('Confirmă din nou codul din aplicația de autentificare.');
    // Never expose data based only on an open response: recheck roles and status.
    if (!await inspect()) throw new Error('Accesul securizat nu a putut fi confirmat. Verifică din nou conexiunea și rolul contului.');
  }, [binding, scope, call, inspect]);
  const activity = useCallback(() => {
    if (!active || Date.now() - touchAt.current < 60000) return;
    touchAt.current = Date.now();
    const capturedEpoch = epoch.current, capturedBinding = binding, request = ++sequence.current;
    const valid = () => capturedEpoch === epoch.current && capturedBinding === current.current && request === sequence.current;
    void call<SecureStatus>('secure_session_touch', {p_scope: scope}).then(status => {
      if (!valid()) return;
      setState(previous => previous.binding === capturedBinding ? {...previous, status} : previous);
    }).catch(() => {
      if (!valid()) return;
      setState({binding: capturedBinding, identity: null, status: null, error: ''});
      void check();
    });
  }, [active, binding, call, scope, check]);
  const lock = useCallback(() => {
    epoch.current++; sequence.current++;
    setState({binding: current.current, identity: null, status: null, error: ''});
  }, []);
  useEffect(() => subscribeSecurityFailure(scope, () => {
    if (!userId || current.current !== binding) return;
    sequence.current++;
    setState(previous => previous.binding === binding ? {...previous, status: {active: false, reason: 'access_changed', reauthentication_required: true}} : previous);
    void check();
  }), [scope, userId, binding, check]);
  return {
    identity: visible.identity, active,
    forcedChallenge: !!visible.status?.reauthentication_required || ['expired', 'closed', 'proof_expired'].includes(visible.status?.reason ?? ''),
    error: visible.error, check, verified, activity, lock,
  };
}
