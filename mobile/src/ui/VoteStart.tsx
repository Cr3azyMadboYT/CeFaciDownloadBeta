// "Trimite gășcii la vot": the three places on screen go to a crew (or friends); everyone votes from their phone.
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { Filters, Place } from '../lib/filters';
import { dayFor, hhmm } from '../lib/plans';
import { DEADLINES, startVote } from '../lib/votes';
import { Big, H1, Lbl, Muted, Note, Seg, Sheet } from './kit';
import { SendTo, type Target } from './SendTo';
import { useTheme } from './theme';

function momentFor(p: Place, when: string) {
  if (when === 'now') return new Date(Date.now() + 30 * 60000);
  const d = dayFor(when);
  const [h, m] = (p.t ?? '20:00').split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}

export function VoteStart({ open, onClose, places, f }: { open: boolean; onClose: () => void; places: Place[]; f: Filters }) {
  const { t } = useTheme();
  const [to, setTo] = useState<Target | null>(null);
  const [dl, setDl] = useState('1h');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onTo = useCallback((x: Target | null) => setTo(x), []);
  const go = async () => {
    if (!to) return;
    setBusy(true); setErr('');
    const r = await startVote({
      crewId: to.crewId ?? null, friendIds: to.friendIds, minutes: DEADLINES.find((d) => d[0] === dl)![2],
      options: places.map((p) => { const at = momentFor(p, f.when); return { venueId: p.id, name: p.name, details: { title: p.title, price: p.price, dist: p.dist, starts_at: at.toISOString(), slot: hhmm(at) } }; }),
    });
    setBusy(false);
    if (r.err) { setErr(r.err); return; }
    onClose();
    router.push({ pathname: '/vot/[id]', params: { id: r.id! } });
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <H1 style={{ fontSize: 26 }}>Votul cu gașca</H1>
      <Muted style={{ marginTop: 6, fontSize: 15, lineHeight: 21 }}>{'Trimiți ' + (places.length === 1 ? 'locul ăsta' : 'cele ' + places.length + ' locuri') + '. Fiecare votează din telefonul lui: Da, Nu sau Super (o dată). Câștigă cel cu cele mai multe voturi.'}</Muted>
      <View style={{ marginTop: 14 }}>{open ? <SendTo onChange={onTo} /> : null}</View>
      <Lbl style={{ marginTop: 16, marginBottom: 8 }}>Votul se închide în</Lbl>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DEADLINES.map(([k, label]) => <Seg key={k} label={label} on={dl === k} onPress={() => setDl(k)} />)}
      </View>
      {places.length < 2 ? <View style={{ marginTop: 12 }}><Note kind="err">Votul are nevoie de cel puțin 2 locuri. Caută mai larg.</Note></View> : null}
      {err ? <View style={{ marginTop: 12 }}><Note kind="err">{err}</Note></View> : null}
      <View style={{ marginTop: 16, gap: 8 }}>
        <Big label={busy ? 'Pornesc votul…' : to ? 'Pornește votul cu ' + to.label : 'Alege pe cine chemi'} disabled={!to || busy || places.length < 2} onPress={go} />
        <Big label="Mai târziu" color={t.s2} ink={t.ink} onPress={onClose} />
      </View>
    </Sheet>
  );
}
