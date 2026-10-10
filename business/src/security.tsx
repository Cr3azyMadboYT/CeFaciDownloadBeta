import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, TextInput, Text, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { SecurityMfaCoordinator, normalizeTotp, securitySessionKey, type SecurityMfaState } from '../../shared/security-mfa';
import { Bilu } from '../../shared/Bilu';
import { F, useTheme } from '../../shared/theme';
import { backend } from './backend';
import { Button, Card, Row, Txt } from './ui';

type GateProps = {
  session: Session;
  onVerified: (session: Session) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  forcedChallenge?: boolean;
};
export function BusinessSecurityGate(props: GateProps) { return <BusinessSecurityScreen key={securitySessionKey(props.session)} {...props}/>; }
function BusinessSecurityScreen({ session, onVerified, onLogout, forcedChallenge = false }: GateProps) {
  const { t } = useTheme();
  const [state, setState] = useState<SecurityMfaState>({ busy: true, phase: 'loading', factors: [], selected: '', enrollment: null, error: '' });
  const [code, setCode] = useState(''), [visible, setVisible] = useState(false), [copied, setCopied] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false), [logoutError, setLogoutError] = useState('');
  const coordinator = useRef<SecurityMfaCoordinator | null>(null);
  const alive = useRef(false);
  const currentEnrollment = useRef(state.enrollment?.id); currentEnrollment.current = state.enrollment?.id;
  const verified = useRef(onVerified); verified.current = onVerified;
  useEffect(() => {
    const controller = new SecurityMfaCoordinator(backend, session.user.id, 'business', setState, next => verified.current(next), forcedChallenge, session);
    coordinator.current = controller; setCode(''); setVisible(false); setCopied(false);
    alive.current = true;
    void controller.load();
    return () => { alive.current = false; controller.dispose(); if (coordinator.current === controller) coordinator.current = null; };
  }, [session.user.id, forcedChallenge]);
  useEffect(() => { setCode(''); setVisible(false); setCopied(false); }, [state.enrollment?.id, state.selected]);
  async function copySecret() {
    if (!state.enrollment) return;
    const id = state.enrollment.id;
    const browser = globalThis as unknown as { navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } } };
    if (Platform.OS === 'web' && browser.navigator?.clipboard) {
      try { await browser.navigator.clipboard.writeText(state.enrollment.secret); if (alive.current && id === currentEnrollment.current) setCopied(true); return; } catch { /* Manual selection remains available. */ }
    }
    if (alive.current && id === currentEnrollment.current) setVisible(true);
  }
  async function logout() {
    if (logoutBusy) return; setLogoutBusy(true); setLogoutError('');
    try { await onLogout(); }
    catch { if (alive.current) setLogoutError('Ieșirea nu a putut fi confirmată. Verifică conexiunea și apasă din nou Ieși din cont.'); }
    finally { if (alive.current) setLogoutBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
    <View style={{ width: '100%', maxWidth: 500, gap: 16 }}><Card><Row><Bilu mood="hi" size={78}/><View style={{ flex: 1 }}><Txt big>CeFaci Business</Txt><Txt muted>Acces protejat pentru echipa localului</Txt></View></Row>
      <Txt big>{state.phase === 'verify' ? 'Confirmă că ești tu.' : 'Protejează contul.'}</Txt>
      <Txt muted>Datele localului se deschid după verificarea în doi pași: email și aplicația de autentificare.</Txt>
      {state.phase === 'loading' || state.phase === 'complete' ? <Txt muted>Se verifică accesul securizat…</Txt> : <>
        {state.phase === 'setup' && <><Txt>Folosește Google Authenticator, Microsoft Authenticator, 2FAS sau o aplicație compatibilă TOTP. Configurarea durează aproximativ un minut.</Txt><Button label="Configurează autentificarea" disabled={state.busy} onPress={() => void coordinator.current?.enroll()}/></>}
        {state.phase === 'enroll' && state.enrollment && <>
          <Txt>1. În aplicația de autentificare, adaugă un cont cu cheie de configurare.</Txt>
          <Txt>2. Numește-l CeFaci Business. Alege tipul bazat pe timp și introdu cheia de mai jos.</Txt>
          <Row><Button secondary label={visible ? 'Ascunde cheia' : 'Arată cheia manuală'} disabled={state.busy} onPress={() => setVisible(v => !v)}/><Button secondary label={Platform.OS === 'web' ? 'Copiază cheia' : 'Selectează cheia pentru copiere'} disabled={state.busy} onPress={() => void copySecret()}/></Row>
          {visible && <Text selectable accessibilityLabel="Cheia de configurare" style={{ fontFamily: F.sb, fontSize: 17, color: t.ink, backgroundColor: t.s2, borderRadius: 12, padding: 14 }}>{state.enrollment.secret}</Text>}
          {visible && Platform.OS !== 'web' && <Txt muted>Ține apăsat pe cheie și alege Copiază. Revino aici după ce ai adăugat contul în autentificator.</Txt>}
          {copied && <Txt muted>Cheia a fost copiată. Șterge-o din istoricul clipboardului după configurare.</Txt>}
          <Txt>3. Introdu aici cele 6 cifre afișate de aplicație.</Txt>
          <Txt muted>Cheia apare doar în timpul configurării. Nu o trimite nimănui, nici echipei CeFaci.</Txt>
        </>}
        {(state.phase === 'verify' || state.phase === 'enroll') && <>
          {state.factors.length > 1 && <><Txt muted>Alege metoda de autentificare</Txt>{state.factors.map(f => <Button key={f.id} label={`${state.selected === f.id ? '✓ ' : ''}${f.name}`} secondary={state.selected !== f.id} disabled={state.busy} onPress={() => coordinator.current?.select(f.id)}/>)}</>}
          <Txt muted>Codul din aplicația de autentificare</Txt>
          <TextInput accessibilityLabel="Codul din aplicația de autentificare" value={code} onChangeText={value => setCode(normalizeTotp(value))} editable={!state.busy} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoCapitalize="none" autoCorrect={false} maxLength={6} onSubmitEditing={() => void coordinator.current?.verify(code)} style={{ fontFamily: F.sb, backgroundColor: t.bgCont, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 22, color: t.ink, letterSpacing: 5 }}/>
          <Button label={state.busy ? 'Se verifică…' : state.phase === 'enroll' ? 'Activează protecția' : 'Verifică și continuă'} disabled={state.busy || code.length !== 6} onPress={() => void coordinator.current?.verify(code)}/>
          {state.phase === 'enroll' && <Button secondary label="Anulează configurarea" disabled={state.busy} onPress={() => void coordinator.current?.cancelEnrollment()}/>}
        </>}
      </>}
      {!!state.error && <Text accessibilityRole="alert" style={{ fontFamily: F.r, color: t.ink, backgroundColor: '#FF6A4D25', padding: 14, borderRadius: 12 }}>{state.error}</Text>}
      {!!state.error && state.phase === 'loading' && <Button secondary label="Verifică din nou" disabled={state.busy} onPress={() => void coordinator.current?.load()}/>}
      {state.phase === 'verify' && <Txt muted>Ai pierdut accesul la autentificator? Contactează proprietarul localului și echipa CeFaci pentru recuperare verificată. Verificarea nu poate fi ocolită din acest ecran.</Txt>}
      {!!logoutError && <Text accessibilityRole="alert" style={{ fontFamily: F.r, color: t.ink }}>{logoutError}</Text>}
      <Button secondary label={logoutBusy ? 'Se închide sesiunea…' : 'Ieși din cont'} disabled={state.busy || logoutBusy} onPress={() => void logout()}/>
    </Card></View>
  </ScrollView>;
}
