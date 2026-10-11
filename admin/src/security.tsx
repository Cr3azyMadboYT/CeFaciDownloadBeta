import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SecurityMfaCoordinator, normalizeTotp, securitySessionKey, type SecurityMfaState } from '../../shared/security-mfa';
import { supabase } from './backend';
import { Bilu, Brand, Card, Notice } from './ui';
import { safeQrGeometry, type SafeQrNode } from './security-qr';

function renderQr(node: SafeQrNode, key = 'qr'): ReturnType<typeof createElement> {
  return createElement(node.tag, { ...node.attributes, key, ...(key === 'qr' ? { role: 'img', 'aria-label': 'Cod QR pentru aplicația de autentificare' } : {}) },
    ...node.children.map((child, i) => renderQr(child, `${key}-${i}`)));
}

type GateProps = {
  session: Session;
  onVerified: (session: Session) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  forcedChallenge?: boolean;
};
export function AdminSecurityGate(props: GateProps) { return <AdminSecurityScreen key={securitySessionKey(props.session)} {...props}/>; }
function AdminSecurityScreen({ session, onVerified, onLogout, forcedChallenge = false }: GateProps) {
  const [state, setState] = useState<SecurityMfaState>({ busy: true, phase: 'loading', factors: [], selected: '', enrollment: null, error: '' });
  const [code, setCode] = useState(''), [visible, setVisible] = useState(false), [copied, setCopied] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false), [logoutError, setLogoutError] = useState('');
  const coordinator = useRef<SecurityMfaCoordinator | null>(null);
  const alive = useRef(false);
  const currentEnrollment = useRef(state.enrollment?.id); currentEnrollment.current = state.enrollment?.id;
  const verified = useRef(onVerified); verified.current = onVerified;
  useEffect(() => {
    const controller = new SecurityMfaCoordinator(supabase, session.user.id, 'admin', setState, next => verified.current(next), forcedChallenge, session);
    coordinator.current = controller; setCode(''); setVisible(false); setCopied(false);
    alive.current = true;
    void controller.load();
    return () => { alive.current = false; controller.dispose(); if (coordinator.current === controller) coordinator.current = null; };
  }, [session.user.id, forcedChallenge]);
  const qr = useMemo(() => state.enrollment ? safeQrGeometry(state.enrollment.qr) : null, [state.enrollment]);
  useEffect(() => { setCode(''); setVisible(false); setCopied(false); }, [state.enrollment?.id, state.selected]);
  async function copySecret() {
    const secret = state.enrollment?.secret;
    if (!secret) return;
    const id = state.enrollment?.id;
    try { await navigator.clipboard.writeText(secret); if (alive.current && id === currentEnrollment.current) setCopied(true); }
    catch { if (alive.current && id === currentEnrollment.current) { setCopied(false); setVisible(true); } }
  }
  async function logout() {
    if (logoutBusy) return; setLogoutBusy(true); setLogoutError('');
    try { await onLogout(); }
    catch { if (alive.current) setLogoutError('Ieșirea nu a putut fi confirmată. Verifică conexiunea și apasă din nou Ieși din cont.'); }
    finally { if (alive.current) setLogoutBusy(false); }
  }
  return <div className="auth"><Card><Brand/><Bilu/><p className="eyebrow">Acces protejat</p>
    <h1>{state.phase === 'verify' ? 'Confirmă că ești tu.' : 'Protejează contul.'}</h1>
    <p className="muted">În Admin intri în doi pași: codul de pe email și codul din aplicația de autentificare. Datele echipei se deschid după verificare.</p>
    {state.phase === 'loading' || state.phase === 'complete' ? <p role="status">Se verifică accesul securizat…</p> : <>
      {state.phase === 'setup' && <>
        <p>Folosește Google Authenticator, Microsoft Authenticator, 2FAS sau o aplicație compatibilă TOTP. Configurarea durează aproximativ un minut.</p>
        <button className="primary" disabled={state.busy} onClick={() => void coordinator.current?.enroll()}>Configurează autentificarea</button>
      </>}
      {state.phase === 'enroll' && state.enrollment && <>
        <ol><li>Adaugă un cont nou în aplicația de autentificare.</li><li>Scanează codul QR sau introdu cheia manual.</li><li>Introdu aici cele 6 cifre afișate de aplicație.</li></ol>
        {qr && <div className="attachment">{renderQr(qr)}</div>}
        {!qr && <p className="muted">Folosește cheia manuală pentru a adăuga contul.</p>}
        <div className="actions"><button disabled={state.busy} onClick={() => setVisible(v => !v)}>{visible ? 'Ascunde cheia' : 'Arată cheia manuală'}</button><button disabled={state.busy} onClick={() => void copySecret()}>Copiază cheia</button></div>
        {visible && <label>Cheia de configurare<input readOnly value={state.enrollment.secret} autoComplete="off" spellCheck={false} aria-label="Cheia de configurare"/></label>}
        {copied && <p role="status" className="muted">Cheia a fost copiată. Păstreaz-o doar în aplicația de autentificare și șterge-o din istoricul clipboardului.</p>}
        <p className="muted">Cheia și codul QR apar doar în timpul configurării. Nu le trimite nimănui, nici echipei CeFaci.</p>
      </>}
      {(state.phase === 'verify' || state.phase === 'enroll') && <form onSubmit={event => { event.preventDefault(); void coordinator.current?.verify(code); }}>
        {state.factors.length > 1 && <label>Metoda de autentificare<select aria-label="Metoda de autentificare" value={state.selected} disabled={state.busy} onChange={e => coordinator.current?.select(e.target.value)}>{state.factors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
        <label>Codul din aplicația de autentificare<input aria-label="Codul din aplicația de autentificare" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required value={code} disabled={state.busy} onChange={e => setCode(normalizeTotp(e.target.value))}/></label>
        <button className="primary" disabled={state.busy || code.length !== 6}>{state.busy ? 'Se verifică…' : state.phase === 'enroll' ? 'Activează protecția' : 'Verifică și continuă'}</button>
        {state.phase === 'enroll' && <button type="button" disabled={state.busy} onClick={() => void coordinator.current?.cancelEnrollment()}>Anulează configurarea</button>}
      </form>}
    </>}
    <Notice error={state.error}/>
    {state.error && state.phase === 'loading' && <button disabled={state.busy} onClick={() => void coordinator.current?.load()}>Verifică din nou</button>}
    {state.phase === 'verify' && <p className="muted">Ai pierdut accesul la autentificator? Contactează fondatorul echipei pentru recuperare. Verificarea nu poate fi ocolită din acest ecran.</p>}
    <Notice error={logoutError}/><button disabled={state.busy || logoutBusy} onClick={() => void logout()}>{logoutBusy ? 'Se închide sesiunea…' : 'Ieși din cont'}</button>
  </Card></div>;
}
