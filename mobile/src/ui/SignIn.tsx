// Sign in from inside the app (for people who started "fără cont"): Google or an email code.
// After it works, the phone profile becomes the account (session.ts → adoptPhoneProfile).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { APP } from '../lib/session';
import { onSyncTrouble } from '../lib/session';
import { Big, Field, Lbl, Muted, Note } from './kit';
import { useTheme } from './theme';
import { LegalLinks } from './LegalLinks';

export function SignIn() {
  const { t } = useTheme();
  const [mail, setMail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [net, setNet] = useState('');
  const [focus, setFocus] = useState('');
  useEffect(() => onSyncTrouble(setNet), []);
  const m = mail.trim().toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(m);
  const go = async () => {
    setBusy(true); setErr('');
    if (!sent) { const e = await APP.emailStart(m); setBusy(false); if (e) setErr(e); else setSent(true); return; }
    const e = await APP.emailVerify(m, code);
    setBusy(false);
    if (e) setErr(e);
  };
  return (
    <View style={{ gap: 10 }}>
      <LegalLinks />
      <Big label="Continuă cu Google" color="#FFD43B" ink="#0E1440" disabled={busy} onPress={async () => { setErr(''); setBusy(true); const e = await APP.google(); setBusy(false); if (e) setErr(e); }} />
      <Lbl style={{ marginTop: 6 }}>Sau cu emailul</Lbl>
      <Field value={mail} onChangeText={(x) => { setMail(x.slice(0, 80)); setSent(false); setCode(''); }} placeholder="nume@exemplu.ro" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
        accessibilityLabel="Adresa de email" focused={focus === 'm'} onFocus={() => setFocus('m')} onBlur={() => setFocus('')} />
      {sent ? (
        <Field big value={code} onChangeText={(x) => setCode(x.replace(/\D/g, '').slice(0, 10))} placeholder="cod" keyboardType="number-pad" autoComplete="one-time-code" maxLength={10}
          accessibilityLabel="Codul din email" focused={focus === 'c'} onFocus={() => setFocus('c')} onBlur={() => setFocus('')} />
      ) : null}
      {err || net ? <Note kind="err">{err || net}</Note> : null}
      <Big label={busy ? 'O clipă…' : sent ? 'Confirmă codul' : 'Trimite-mi codul'} disabled={busy || (sent ? code.length < 6 : !ok)} color={t.blue} onPress={go} />
      {sent ? <Muted>Codul vine pe email în câteva secunde. Uită-te și la Spam.</Muted> : null}
    </View>
  );
}
