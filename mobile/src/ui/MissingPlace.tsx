// "Lipsește un loc?" (decision Cornel, 05.10): the people who live in a town know its good places better than any
// article. Their suggestion reaches the private Admin inbox; their status and answer are visible in Profil.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { ReportSubmission, supportCall, type SupportClient } from '../../../shared/support';
import { sb } from '../lib/auth';
import { captureAccount, useApp } from '../lib/session';
import { toast } from '../lib/toast';
import { Big, Field, H1, Lbl, Muted, Sheet } from './kit';

export function MissingPlace({ open, onClose, where }: { open: boolean; onClose: () => void; where?: string }) {
  const me = useApp((s) => s.who);
  const [name, setName] = useState('');
  const [place, setPlace] = useState(where ?? '');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState('');
  const [frozen, setFrozen] = useState(false);
  const attempt = useRef(new ReportSubmission()), key = useRef(randomUUID()), lock = useRef(false), mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {attempt.current.reset(); key.current = randomUUID(); setFrozen(false); setBusy(false); lock.current = false; setName(''); setPlace(where ?? ''); setWhy('');}, [me?.id]);
  const ok = name.trim().length >= 2 && place.trim().length >= 2;
  const send = async () => {
    if (!me) { toast('Ca să ne trimiți un loc, intră în cont din Profil.'); return; }
    if(lock.current) return;
    const account = captureAccount(), valid = () => mounted.current && account();
    lock.current = true; setBusy(true);
    try {
      await attempt.current.submit(sb() as unknown as SupportClient, {key: key.current, kind: 'missing_place', source: 'client',
        title: 'Local lipsă: ' + name.trim(), description: 'Unde: ' + place.trim() + (why.trim() ? '\nDe ce merită: ' + why.trim() : '')}, valid);
      if(!valid()) return;
      toast('Mersi! Cererea a ajuns la CeFaci. Urmărești răspunsul din Profil → Raportează o problemă.');
      attempt.current.reset(); key.current = randomUUID(); setFrozen(false); setName(''); setWhy(''); onClose();
    } catch(e) {if(valid()) toast(e instanceof Error ? e.message : 'Nu am putut trimite acum. Reîncearcă online.');}
    finally {if(valid()) {setBusy(false); lock.current = false; setFrozen(attempt.current.frozen);}}
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <H1 style={{ fontSize: 26 }}>Lipsește un loc?</H1>
      <Muted style={{ marginTop: 6, fontSize: 15, lineHeight: 21 }}>Știi un loc bun pe care nu-l avem? Spune-ne. Îl verificăm și, dacă e bun, îl adăugăm cu povestea lui.</Muted>
      <View style={{ marginTop: 14, gap: 8 }}>
        <Lbl>Cum se numește</Lbl>
        <Field value={name} editable={!busy && !frozen} onChangeText={(x) => setName(x.slice(0, 80))} placeholder="ex: Calul Bălan" accessibilityLabel="Numele locului" focused={focus === 'n'} onFocus={() => setFocus('n')} onBlur={() => setFocus('')} />
        <Lbl style={{ marginTop: 6 }}>Unde e</Lbl>
        <Field value={place} editable={!busy && !frozen} onChangeText={(x) => setPlace(x.slice(0, 80))} placeholder="orașul, cartierul sau strada" accessibilityLabel="Unde e locul" focused={focus === 'w'} onFocus={() => setFocus('w')} onBlur={() => setFocus('')} />
        <Lbl style={{ marginTop: 6 }}>De ce merită (dacă vrei)</Lbl>
        <Field value={why} editable={!busy && !frozen} onChangeText={(x) => setWhy(x.slice(0, 120))} placeholder="ex: cea mai bună pizza din oraș, terasă la lac" accessibilityLabel="De ce merită" focused={focus === 'y'} onFocus={() => setFocus('y')} onBlur={() => setFocus('')} />
        {frozen && <Muted>Conținutul este păstrat pentru reîncercare, ca să nu dublăm cererea.</Muted>}
        <Big style={{ marginTop: 8 }} label={busy ? 'Trimit…' : frozen ? 'Reîncearcă trimiterea' : 'Trimite'} disabled={!ok || busy} onPress={send} />
        {frozen && <Big label="Renunță la ciornă" disabled={busy} onPress={async () => {
          if(lock.current) return;
          const account = captureAccount(), valid = () => mounted.current && account();
          if(!valid()) return;
          lock.current = true; setBusy(true);
          try {
            if(attempt.current.draft) await supportCall(sb() as unknown as SupportClient, 'support_report_cancel', {p_id: attempt.current.draft.id});
            if(!valid()) return;
            attempt.current.reset(); key.current = randomUUID(); setFrozen(false); setName(''); setWhy(''); onClose();
          } catch(e) {if(valid()) toast(e instanceof Error ? e.message : 'Nu am putut retrage ciorna.');}
          finally {if(valid()) {lock.current = false; setBusy(false);}}
        }} />}
      </View>
    </Sheet>
  );
}
