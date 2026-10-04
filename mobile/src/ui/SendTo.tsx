// Who to send something to: one of your crews, or friends picked one by one. Used to start a vote and to send a plan.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { listCrews, type Crew } from '../lib/crews';
import { listFriends, type Person } from '../lib/friends';
import { useApp } from '../lib/session';
import { CrewMark } from './CrewMark';
import { Icon } from './Icon';
import { Big, Chip, Lbl, Muted, Press, T } from './kit';
import { F, useTheme } from './theme';

export interface Target { crewId?: string; friendIds: string[]; label: string }

export function SendTo({ onChange, need = 1 }: { onChange: (t: Target | null) => void; need?: number }) {
  const { t } = useTheme();
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [crew, setCrew] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (!who || !known) return;
    void listCrews(who.id).then((c) => setCrews(c.filter((x) => x.mine === 'member' && x.members.some((m) => m.status === 'member'))));
    void listFriends(who.id).then((r) => setFriends(r.filter((x) => x.status === 'accepted').map((x) => x.person)));
  }, [who, known]);
  useEffect(() => {
    const c = crews?.find((x) => x.id === crew);
    if (c) onChange({ crewId: c.id, friendIds: [], label: c.name });
    else if (picked.length >= need) onChange({ friendIds: picked, label: friends?.filter((f) => picked.includes(f.id)).map((f) => f.first_name).join(', ') ?? '' });
    else onChange(null);
  }, [crew, picked, crews, friends, need, onChange]);

  if (!who || !known) {
    return (
      <View style={{ gap: 10 }}>
        <Muted style={{ fontSize: 15, lineHeight: 21 }}>Merge cu cont și cu prieteni în CeFaci. Intră din Profil → Prieteni.</Muted>
        <Big label="Mergi la Prieteni" onPress={() => router.push('/prieteni')} />
      </View>
    );
  }
  if (!crews || !friends) return <Muted>Îți caut gășcile și prietenii…</Muted>;
  if (!friends.length) {
    return (
      <View style={{ gap: 10 }}>
        <Muted style={{ fontSize: 15, lineHeight: 21 }}>Încă n-ai prieteni în CeFaci. Adaugă-i și apoi îi chemi la vot sau la plan.</Muted>
        <Big label="Adaugă prieteni" onPress={() => router.push('/prieteni')} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {crews.length ? (
        <>
          <Lbl>O gașcă</Lbl>
          {crews.map((c) => {
            const on = crew === c.id;
            return (
              <Press key={c.id} onPress={() => { setCrew(on ? null : c.id); setPicked([]); }} accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? t.blue : t.line, backgroundColor: on ? t.blueSoft : t.s1 }}>
                <CrewMark icon={c.icon} color={c.color === '#0E1440' && t.dark ? '#F4F4F6' : c.color} size={40} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: F.sb, fontSize: 16 }}>{c.name}</T>
                  <Muted>{c.members.filter((m) => m.status === 'member').length + 1 + ' oameni'}</Muted>
                </View>
                {on ? <Icon name="check" color={t.blueInk} /> : null}
              </Press>
            );
          })}
          <Lbl style={{ marginTop: 4 }}>Sau prieteni, aleși de tine</Lbl>
        </>
      ) : <Lbl>Pe cine chemi?</Lbl>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {friends.map((f) => {
          const on = picked.includes(f.id);
          return <Chip key={f.id} label={f.first_name} on={on} onPress={() => { setCrew(null); setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id])); }} />;
        })}
      </View>
    </View>
  );
}
