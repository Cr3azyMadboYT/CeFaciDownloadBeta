// Gașcă nouă: name, stamp, colour, at least 2 friends. Friends get an invitation and join when they accept.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { STAMP_COLORS, STAMP_ICONS, createCrew } from '../lib/crews';
import { listFriends, type Person } from '../lib/friends';
import { useApp } from '../lib/session';
import { toast } from '../lib/toast';
import { tr } from '../lib/i18n';
import { CrewMark } from '../ui/CrewMark';
import { Icon } from '../ui/Icon';
import { Big, Field, H1, Lbl, Muted, Note, Press, Say, T } from '../ui/kit';
import { isRudeName } from '../../../src/app/names';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

export default function GascaNoua() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('star');
  const [color, setColor] = useState(STAMP_COLORS[0][0]);
  const { pre } = useLocalSearchParams<{ pre?: string }>();
  const [picked, setPicked] = useState<string[]>(() => (pre ? pre.split(',').filter(Boolean) : []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!who || !known) { setFriends([]); return; }
    void listFriends(who.id).then((r) => setFriends(r.filter((x) => x.status === 'accepted').map((x) => x.person)));
  }, [who, known]);
  // someone from a vote who is not your friend cannot be invited: keep only friends
  useEffect(() => { if (friends) setPicked((p) => p.filter((x) => friends.some((f) => f.id === x))); }, [friends]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/planuri'));
  const names = friends?.filter((f) => picked.includes(f.id)).map((f) => f.first_name) ?? [];
  const auto = names.length >= 2 ? (names.length > 2 ? tr('Tu, {a} și {b} și încă {n}', { a: names[0], b: names[1], n: names.length - 2 }) : tr('Tu, {a} și {b}', { a: names[0], b: names[1] })) : tr('ex: Gașca de vineri');
  const rude = isRudeName(name);
  const create = async () => {
    if (rude) return;
    setBusy(true); setErr('');
    const r = await createCrew((name.trim() || auto).slice(0, 40), icon, color, picked.filter((x) => friends?.some((f) => f.id === x)));
    setBusy(false);
    if (r.err) { setErr(r.err); return; }
    toast(tr('Invitațiile au plecat. Intră în gașcă doar cine acceptă.'));
    router.replace({ pathname: '/gasca/[id]', params: { id: r.id! } });
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="padding">
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <CrewMark icon={icon} color={color === '#0E1440' && t.dark ? '#F4F4F6' : color} size={60} />
          <H1 style={{ flex: 1, fontSize: 32, lineHeight: 33 }}>{tr('Gașcă nouă')}</H1>
        </View>
        {!who || !known ? (
          <Note kind="err">{tr('Gășcile merg cu cont. Intră din Profil → Prieteni.')}</Note>
        ) : friends && friends.length < 2 ? (
          <View style={{ gap: 10 }}>
            <Muted style={{ fontSize: 15, lineHeight: 21 }}>{tr('O gașcă are măcar 2 prieteni în afară de tine.')} {friends.length === 1 ? tr('Ai 1 prieten în CeFaci.') : tr('Încă n-ai prieteni în CeFaci.')}</Muted>
            <Big label={tr('Adaugă prieteni')} onPress={() => router.push('/prieteni')} />
          </View>
        ) : (
          <>
            <Lbl>{tr('Numele gășcii')}</Lbl>
            <Field value={name} onChangeText={(x) => setName(x.slice(0, 40))} placeholder={auto} accessibilityLabel={tr('Numele gășcii')} focused={focus} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
            {rude ? <Say mood="oops" text={tr('Te rog alege alt nume pentru gașcă, acesta nu prea pare potrivit.')} /> : null}
            <Lbl>{tr('Ștampila')}</Lbl>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {STAMP_ICONS.map(([key, ic, label]) => (
                <Press key={key} onPress={() => setIcon(key)} accessibilityLabel={tr(label)} accessibilityState={{ selected: icon === key }}
                  style={{ width: 52, height: 52, borderRadius: 16, borderWidth: icon === key ? 2 : 1, borderColor: icon === key ? t.blue : t.line, backgroundColor: icon === key ? t.blueSoft : t.s1, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={ic as never} color={icon === key ? t.blueInk : t.ink2} />
                </Press>
              ))}
            </View>
            <Lbl>{tr('Culoarea')}</Lbl>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {STAMP_COLORS.map(([c, label]) => (
                <Press key={c} onPress={() => setColor(c)} accessibilityLabel={tr(label)} accessibilityState={{ selected: color === c }}
                  style={{ width: 40, height: 40, borderRadius: 99, backgroundColor: c, borderWidth: 3, borderColor: color === c ? t.ink : 'transparent' }} />
              ))}
            </View>
            <Lbl>{picked.length === 1 ? tr('Prietenii (1 ales)') : picked.length ? tr('Prietenii ({n} aleși)', { n: picked.length }) : tr('Prietenii (minim 2)')}</Lbl>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(friends ?? []).map((f) => {
                const on = picked.includes(f.id);
                return (
                  <Press key={f.id} onPress={() => setPicked(on ? picked.filter((x) => x !== f.id) : picked.length >= 14 ? picked : picked.concat([f.id]))} accessibilityState={{ selected: on }}
                    style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, justifyContent: 'center' }}>
                    <T style={{ fontFamily: F.sb, fontSize: 14, color: on ? t.bg : t.ink }}>{f.first_name + ' · @' + f.username}</T>
                  </Press>
                );
              })}
            </View>
            {err ? <Note kind="err">{err}</Note> : null}
          </>
        )}
      </ScrollView>
      {who && known && friends && friends.length >= 2 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(ins.bottom, 12) + 14, borderTopWidth: 1, borderTopColor: t.line }}>
          <Big label={busy ? tr('O clipă…') : picked.length < 2 ? tr('Alege cel puțin 2 prieteni') : tr('Trimite {n} invitații', { n: picked.length })} disabled={busy || picked.length < 2 || rude} onPress={create} />
        </View>
      ) : null}
      <TopShade />
    </KeyboardAvoidingView>
  );
}
