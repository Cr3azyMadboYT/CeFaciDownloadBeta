// "Lipsește un loc?" (decision Cornel, 05.10): the people who live in a town know its good places better than any
// article. They tell us the name, where it is and why it is good; it reaches us as a report (reports, kind
// "altceva", the place "nou"), we check it, and it comes into the app with its story at the next update.
import { useState } from 'react';
import { View } from 'react-native';
import { sb } from '../lib/auth';
import { useApp } from '../lib/session';
import { toast } from '../lib/toast';
import { Big, Field, H1, Lbl, Muted, Sheet } from './kit';

export function MissingPlace({ open, onClose, where }: { open: boolean; onClose: () => void; where?: string }) {
  const me = useApp((s) => s.who);
  const [name, setName] = useState('');
  const [place, setPlace] = useState(where ?? '');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState('');
  const ok = name.trim().length >= 2 && place.trim().length >= 2;
  const send = async () => {
    if (!me) { toast('Ca să ne trimiți un loc, intră în cont din Profil.'); return; }
    setBusy(true);
    const note = ('LOC NOU: ' + name.trim() + ' · ' + place.trim() + (why.trim() ? ' · ' + why.trim() : '')).slice(0, 300);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb() as any).from('reports').insert({ venue_id: 'nou', kind: 'altceva', note });
    setBusy(false);
    if (error) { toast('Nu am putut trimite acum. Încearcă mai târziu.'); return; }
    toast('Mersi! Îl verificăm și, dacă e bun, apare în aplicație.');
    setName(''); setWhy(''); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <H1 style={{ fontSize: 26 }}>Lipsește un loc?</H1>
      <Muted style={{ marginTop: 6, fontSize: 15, lineHeight: 21 }}>Știi un loc bun pe care nu-l avem? Spune-ne. Îl verificăm și, dacă e bun, îl adăugăm cu povestea lui.</Muted>
      <View style={{ marginTop: 14, gap: 8 }}>
        <Lbl>Cum se numește</Lbl>
        <Field value={name} onChangeText={(x) => setName(x.slice(0, 80))} placeholder="ex: Calul Bălan" accessibilityLabel="Numele locului" focused={focus === 'n'} onFocus={() => setFocus('n')} onBlur={() => setFocus('')} />
        <Lbl style={{ marginTop: 6 }}>Unde e</Lbl>
        <Field value={place} onChangeText={(x) => setPlace(x.slice(0, 80))} placeholder="orașul, cartierul sau strada" accessibilityLabel="Unde e locul" focused={focus === 'w'} onFocus={() => setFocus('w')} onBlur={() => setFocus('')} />
        <Lbl style={{ marginTop: 6 }}>De ce merită (dacă vrei)</Lbl>
        <Field value={why} onChangeText={(x) => setWhy(x.slice(0, 120))} placeholder="ex: cea mai bună pizza din oraș, terasă la lac" accessibilityLabel="De ce merită" focused={focus === 'y'} onFocus={() => setFocus('y')} onBlur={() => setFocus('')} />
        <Big style={{ marginTop: 8 }} label={busy ? 'Trimit…' : 'Trimite'} disabled={!ok || busy} onPress={send} />
      </View>
    </Sheet>
  );
}
