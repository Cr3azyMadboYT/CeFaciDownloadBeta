// A friend's card: level, stamps, friends you share; call them to a plan, invite them into a crew, or remove them.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { inviteToCrew, listCrews, type Crew } from '../../lib/crews';
import { mutual, profileOf, remove, type Person, type Profile } from '../../lib/friends';
import { LEVELS, levelOf } from '../../lib/levels';
import { useApp } from '../../lib/session';
import { toast } from '../../lib/toast';
import { CrewMark } from '../../ui/CrewMark';
import { Icon } from '../../ui/Icon';
import { Big, H1, Lbl, Muted, Note, Press, Sheet, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';

export default function Prieten() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const who = useApp((s) => s.who);
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [both, setBoth] = useState<Person[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [pick, setPick] = useState(false);
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!id || !who) return;
    void profileOf(id).then(setP);
    void mutual(id).then(setBoth);
    void listCrews(who.id).then(setCrews);
  }, [id, who]);
  useFocusEffect(load);
  useEffect(() => { if (!arm) return; const k = setTimeout(() => setArm(false), 5000); return () => clearTimeout(k); }, [arm]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/prieteni'));

  if (p === undefined) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20 }}><Muted>Se încarcă…</Muted></View>;
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>Nu mai găsim profilul.</H1>
        <Big label="Înapoi" onPress={back} />
      </View>
    );
  }
  const lv = levelOf(p.xp);
  const inCrew = (c: Crew) => c.members.some((m) => m.person.id === p.id);
  const canInvite = crews.filter((c) => c.mine === 'member' && !inCrew(c));
  const shared = crews.filter(inCrew);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: ins.bottom + 32, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <View style={{ padding: 16, borderRadius: 24, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 99, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.display, fontSize: 32, color: '#0E1440' }}>{p.first_name.charAt(0).toUpperCase()}</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontFamily: F.display, fontSize: 26, lineHeight: 28, color: '#FFFFFF' }}>{p.first_name}</T>
            <T style={{ fontFamily: F.sb, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{'@' + p.username}</T>
            <T style={{ marginTop: 6, fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>{lv ? 'Nivel ' + lv + ' · ' + LEVELS[lv] : 'Abia a început'}</T>
            <T style={{ fontFamily: F.sb, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{p.xp + ' XP · ' + (p.stamps === 1 ? 'o ștampilă' : p.stamps + ' ștampile')}</T>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Big label="Faceți un plan" icon={<Icon name="ticket" color="#FFFFFF" />} onPress={() => { toast('Alege locurile, apoi „Trimite gășcii la vot” sau trimite biletul lui ' + p.first_name + '.'); router.navigate('/exploreaza'); }} />
          <Big label="Invită în gașcă" color={t.s2} ink={t.ink} disabled={!canInvite.length} onPress={() => setPick(true)} />
          {!canInvite.length ? <Muted>{crews.length ? 'E deja în toate gășcile tale.' : 'Încă n-ai nicio gașcă. Fă una din Planuri.'}</Muted> : null}
        </View>

        <Lbl style={{ marginTop: 6 }}>{both.length ? 'Prieteni comuni (' + both.length + ')' : 'Prieteni comuni'}</Lbl>
        {both.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {both.map((x) => (
              <Press key={x.id} onPress={() => router.push({ pathname: '/prieten/[id]', params: { id: x.id } })} style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.s2, justifyContent: 'center' }}>
                <T style={{ fontFamily: F.sb, fontSize: 14 }}>{x.first_name}</T>
              </Press>
            ))}
          </View>
        ) : <Muted>Niciunul încă.</Muted>}

        {shared.length ? (
          <>
            <Lbl style={{ marginTop: 6 }}>În gășcile voastre</Lbl>
            {shared.map((c) => (
              <Press key={c.id} onPress={() => router.push({ pathname: '/gasca/[id]', params: { id: c.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
                <CrewMark icon={c.icon} color={c.color === '#0E1440' && t.dark ? '#F4F4F6' : c.color} size={40} />
                <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>{c.name}</T>
                <Icon name="next" size={16} color={t.ink3} />
              </Press>
            ))}
          </>
        ) : null}

        <Big style={{ marginTop: 16 }} label={busy ? 'O clipă…' : arm ? 'Sigur? Apasă iar ca să confirmi' : 'Elimină din prieteni'} color="#D93A1C" disabled={busy}
          onPress={async () => {
            if (!arm) { setArm(true); return; }
            if (!who) return;
            setBusy(true);
            await remove(who.id, p.id);
            setBusy(false);
            toast(p.first_name + ' nu mai e în prietenii tăi.');
            back();
          }} />
      </ScrollView>

      <Sheet open={pick} onClose={() => setPick(false)}>
        <H1 style={{ fontSize: 26 }}>{'Alege gașca pentru ' + p.first_name}</H1>
        <View style={{ marginTop: 14, gap: 8 }}>
          {canInvite.map((c) => (
            <Press key={c.id} onPress={async () => {
              if (!who) return;
              const e = await inviteToCrew(c.id, who.id, [p.id]);
              setPick(false);
              toast(e ?? 'Invitația a plecat. ' + p.first_name + ' intră când acceptă.');
              load();
            }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
              <CrewMark icon={c.icon} color={c.color === '#0E1440' && t.dark ? '#F4F4F6' : c.color} size={40} />
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>{c.name}</T>
              <Icon name="plus" size={18} color={t.blueInk} />
            </Press>
          ))}
          {!canInvite.length ? <Note kind="err">Nu ai o gașcă în care să-l inviți.</Note> : null}
        </View>
      </Sheet>
      <TopShade />
    </View>
  );
}
