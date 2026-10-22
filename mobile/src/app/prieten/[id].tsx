// A friend's card: level, stamps, friends you share; call them to a plan, invite them into a crew, or remove them.
// Redone 22.10 like the passport on Profil.
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { inviteToCrew, listCrews, type Crew } from '../../lib/crews';
import { mutual, profileOf, remove, type Person, type Profile } from '../../lib/friends';
import { LEVELS, LEVEL_XP, levelOf } from '../../lib/levels';
import { useApp } from '../../lib/session';
import { toast } from '../../lib/toast';
import { tr } from '../../lib/i18n';
import { CrewMark } from '../../ui/CrewMark';
import { Icon } from '../../ui/Icon';
import { Big, H1, Lbl, Muted, Note, Press, Quiet, Sheet, T } from '../../ui/kit';
import { Doodles } from '../../ui/Doodles';
import type { IconName } from '../../ui/Icon';
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
  const back = () => (router.canGoBack() ? router.back() : router.replace('/prieteni'));

  if (p === undefined) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20 }}><Muted>{tr('Se încarcă…')}</Muted></View>;
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>{tr('Nu mai găsim profilul.')}</H1>
        <Big label={tr('Înapoi')} onPress={back} />
      </View>
    );
  }
  const lv = levelOf(p.xp);
  const inCrew = (c: Crew) => c.members.some((m) => m.person.id === p.id);
  const canInvite = crews.filter((c) => c.mine === 'member' && !inCrew(c));
  const shared = crews.filter(inCrew);

  const top = lv >= LEVEL_XP.length - 1;
  const cap = top ? LEVEL_XP[LEVEL_XP.length - 1] : LEVEL_XP[lv + 1];
  const pct = Math.min(100, (p.xp / cap) * 100);
  const drop = async () => {
    if (!who) return;
    setBusy(true);
    await remove(who.id, p.id);
    setBusy(false);
    setArm(false);
    toast(tr('{name} nu mai e în prietenii tăi.', { name: p.first_name }));
    back();
  };

  // the same passport as on Profil (22.10, Cornel: „arată urât”): the photo tile, name, level and the XP bar; then
  // what you can do together, as tiles; removing is a quiet link at the bottom, with a question first
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: ins.bottom + 32, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
          <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flex: 1, fontFamily: F.display, fontSize: 24 }}>{'@' + p.username}</T>
        </View>

        <View style={{ paddingVertical: 16, paddingHorizontal: 16, borderRadius: 24, backgroundColor: '#2F5BFF', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 96, height: 110, borderRadius: 18, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -14, top: -14, width: 54, height: 54, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.35)' }} />
              <T style={{ fontFamily: F.display, fontSize: 52, lineHeight: 58, color: '#0E1440' }}>{p.first_name.charAt(0).toUpperCase()}</T>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, color: '#FFFFFF' }}>{p.first_name}</T>
              <T style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>{lv ? tr('Nivel {n}', { n: lv }) : tr('Abia a început')}</T>
              {lv ? <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, color: '#FFFFFF' }}>{tr(LEVELS[lv])}</T> : null}
            </View>
          </View>
          <View style={{ height: 12, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', borderRadius: 99, backgroundColor: '#FFD43B' }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[String(p.xp), 'XP'], [String(p.stamps), p.stamps === 1 ? tr('ștampilă') : tr('ștampile')], [String(both.length), both.length === 1 ? tr('prieten comun') : tr('prieteni comuni')]].map(([n, l]) => (
              <View key={l} style={{ flex: 1, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center' }}>
                <T style={{ fontFamily: F.display, fontSize: 22, lineHeight: 24, color: '#FFFFFF' }}>{n}</T>
                <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.sb, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{l}</T>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile icon="ticket" bg="#FFD43B" label={tr('Faceți un plan')} sub={tr('Alegeți locul împreună')}
            onPress={() => { toast(tr('Alege locurile, apoi „Trimite gășcii la vot” sau trimite biletul lui {name}.', { name: p.first_name })); router.navigate('/exploreaza'); }} />
          {canInvite.length
            ? <Tile icon="users" bg="#5FD39A" label={tr('Invită în gașcă')} sub={canInvite.length === 1 ? canInvite[0].name : tr('{n} gășci', { n: canInvite.length })} onPress={() => setPick(true)} />
            : <Tile icon="userPlus" bg="#B7A3FF" label={tr('Gașcă nouă')} sub={crews.length ? tr('E deja în gășcile tale') : tr('Cu {name}', { name: p.first_name })} onPress={() => router.push({ pathname: '/gasca-noua', params: { pre: p.id } })} />}
        </View>

        {both.length ? (
          <View style={{ gap: 8 }}>
            <Lbl>{tr('Prieteni comuni ({n})', { n: both.length })}</Lbl>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {both.map((x) => (
                <Press key={x.id} onPress={() => router.push({ pathname: '/prieten/[id]', params: { id: x.id } })} style={{ height: 36, paddingLeft: 4, paddingRight: 12, borderRadius: 999, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 99, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: '#0E1440' }}>{x.first_name.charAt(0).toUpperCase()}</T></View>
                  <T style={{ fontFamily: F.sb, fontSize: 14 }}>{x.first_name}</T>
                </Press>
              ))}
            </View>
          </View>
        ) : null}

        {shared.length ? (
          <View style={{ gap: 8 }}>
            <Lbl>{tr('În gășcile voastre')}</Lbl>
            {shared.map((c) => (
              <Press key={c.id} onPress={() => router.push({ pathname: '/gasca/[id]', params: { id: c.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
                <CrewMark icon={c.icon} color={c.color === '#0E1440' && t.dark ? '#F4F4F6' : c.color} size={40} />
                <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>{c.name}</T>
                <Icon name="next" size={16} color={t.ink3} />
              </Press>
            ))}
          </View>
        ) : null}

        <Press onPress={() => setArm(true)} accessibilityLabel={tr('Elimină din prieteni')} style={{ marginTop: 18, alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
          <T style={{ fontFamily: F.sb, fontSize: 14, color: t.coralInk }}>{tr('Elimină din prieteni')}</T>
        </Press>
      </ScrollView>

      <Sheet open={arm} onClose={() => setArm(false)}>
        <View style={{ gap: 12 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 24 }}>{tr('Ștergi prietenia cu {name}?', { name: p.first_name })}</T>
          <Muted>{tr('Nu mai vedeți unul altuia FreeNow și nu vă mai puteți chema la planuri. Gășcile rămân cum sunt.')}</Muted>
          <Big label={busy ? tr('O clipă…') : tr('Da, elimină')} color="#D93A1C" disabled={busy} onPress={() => void drop()} />
          <Quiet label={tr('Renunț')} onPress={() => setArm(false)} />
        </View>
      </Sheet>
      <Sheet open={pick} onClose={() => setPick(false)}>
        <H1 style={{ fontSize: 26 }}>{tr('Alege gașca pentru {name}', { name: p.first_name })}</H1>
        <View style={{ marginTop: 14, gap: 8 }}>
          {canInvite.map((c) => (
            <Press key={c.id} onPress={async () => {
              if (!who) return;
              const e = await inviteToCrew(c.id, who.id, [p.id]);
              setPick(false);
              toast(e ?? tr('Invitația a plecat. {name} intră când acceptă.', { name: p.first_name }));
              load();
            }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
              <CrewMark icon={c.icon} color={c.color === '#0E1440' && t.dark ? '#F4F4F6' : c.color} size={40} />
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>{c.name}</T>
              <Icon name="plus" size={18} color={t.blueInk} />
            </Press>
          ))}
          {!canInvite.length ? <Note kind="err">{tr('Nu ai o gașcă în care să-l inviți.')}</Note> : null}
        </View>
      </Sheet>
      <TopShade />
    </View>
  );
}

function Tile({ icon, bg, label, sub, onPress }: { icon: IconName; bg: string; label: string; sub: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityLabel={label + ', ' + sub} style={{ flex: 1, minHeight: 112, padding: 14, borderRadius: 22, backgroundColor: bg, justifyContent: 'space-between' }}>
      <View style={{ width: 38, height: 38, borderRadius: 99, backgroundColor: 'rgba(14,20,64,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color="#0E1440" /></View>
      <View>
        <T style={{ fontFamily: F.b, fontSize: 16, color: '#0E1440' }}>{label}</T>
        <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12.5, color: 'rgba(14,20,64,0.75)' }}>{sub}</T>
      </View>
    </Press>
  );
}
