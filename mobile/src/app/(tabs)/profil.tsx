// Profil: the passport card (name, level, XP), friends, theme, stamps from real outings, and deleting the account.
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickAvatar, removeAvatar } from '../../lib/avatar';
import { listFriends } from '../../lib/friends';
import { startTour } from '../../lib/tour';
import { Bilu } from '../../ui/Bilu';
import { NO_STAMPS, type Stamp } from '../../lib/outing';
import { startOver, useApp, setBoard } from '../../lib/session';
import { Portrait } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import { Big, H1, Muted, Note, Press, Seg, Sheet, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';
import { LEVELS, LEVEL_XP, levelOf } from '../../lib/levels';

const INKS = ['#2F5BFF', '#FF6A4D', '#E0A800', '#8C6CFF'];
const ROTS = ['-6deg', '5deg', '-3deg', '7deg'];
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function Profil() {
  const { t, set } = useTheme();
  const mode = useApp((s) => s.board.theme ?? 'zi');
  const ins = useSafeAreaInsets();
  const prefs = useApp((s) => s.prefs);
  const who = useApp((s) => s.who);
  const xp = useApp((s) => (s.board.xp as number | undefined) ?? 0);
  const known = useApp((s) => s.known);
  const stamps = useApp((s) => (s.board.stamps as Stamp[] | undefined) ?? NO_STAMPS);
  const [arm, setArm] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const hasPhoto = useApp((s) => !!s.board.avatar);
  const [busy, setBusy] = useState<'' | 'out' | 'del'>('');
  const [err, setErr] = useState('');
  const [friends, setFriends] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    if (!who || !known) { setFriends(null); return; }
    void listFriends(who.id).then((r) => setFriends(r.filter((x) => x.status === 'accepted').length));
  }, [who, known]));
  useEffect(() => { if (!arm) return; const id = setTimeout(() => setArm(false), 5000); return () => clearTimeout(id); }, [arm]);
  const lv = levelOf(xp);
  const top = lv >= LEVEL_XP.length - 1;
  const cap = top ? LEVEL_XP[LEVEL_XP.length - 1] : LEVEL_XP[lv + 1];
  const pct = Math.min(100, (xp / cap) * 100);
  const founder = String(prefs.user || '').toLowerCase() === 'cornacidev';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center' }}>
        <H1 style={{ flex: 1, fontSize: 28 }}>{'@' + (prefs.user || 'tu')}</H1>
        <Press onPress={() => router.push('/setari')} accessibilityLabel="Setări" style={{ width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
          <Icon name="gear" color={t.ink} />
        </Press>
      </View>
      <View style={{ marginTop: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, backgroundColor: '#2F5BFF' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
          <Press onPress={() => setPhotoOpen(true)} accessibilityLabel="Schimbă poza de profil"
            style={{ width: 88, height: 108, padding: 4, borderRadius: 14, backgroundColor: '#FFFFFF', transform: [{ rotate: '-3deg' }], shadowColor: '#0E1440', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 8 }, elevation: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Portrait />
            <View style={{ position: 'absolute', right: -8, bottom: -8, width: 30, height: 30, borderRadius: 99, backgroundColor: '#FFD43B', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6" size={15} color="#0E1440" />
            </View>
          </Press>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.b, fontSize: 17, color: '#FFFFFF' }}>{prefs.name || 'Tu'}</T>
            {founder ? (
              <View style={{ marginTop: 6, alignSelf: 'flex-start', height: 24, paddingLeft: 6, paddingRight: 9, borderRadius: 999, backgroundColor: '#0E1440', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="star" size={14} color="#FFD43B" />
                <T style={{ fontFamily: F.b, fontSize: 12, color: '#FFD43B' }}>Founder</T>
              </View>
            ) : null}
            <T style={{ marginTop: 10, fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>{'Nivel ' + lv}</T>
            <T style={{ marginTop: 6, fontFamily: F.display, fontSize: 32, lineHeight: 33, letterSpacing: -1, color: '#FFFFFF' }}>{lv ? LEVELS[lv] : 'Abia ai început'}</T>
          </View>
        </View>
        <View style={{ marginTop: 16, height: 10, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityLabel="Progres spre nivelul următor" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
          <View style={{ height: 10, width: `${pct}%`, borderRadius: 99, backgroundColor: '#FFD43B' }} />
        </View>
        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <T style={{ fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>{fmt(xp) + ' / ' + fmt(cap) + ' XP'}</T>
          <T style={{ flexShrink: 1, textAlign: 'right', fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>{top ? 'Ai ajuns la cel mai înalt nivel.' : 'Încă ' + fmt(Math.max(0, cap - xp)) + ' până la ' + LEVELS[lv + 1]}</T>
        </View>
      </View>

      <View style={{ marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, overflow: 'hidden' }}>
        <Press onPress={() => router.push('/prieteni')} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
          <Icon name="users" color={t.blueInk} />
          <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>Prieteni</T>
          <Muted>{friends === null ? (known ? '' : 'intră în cont') : friends === 1 ? '1 prieten' : friends + ' prieteni'}</Muted>
        </Press>
        <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1, borderTopColor: t.line }}>
          <T style={{ marginBottom: 10, fontFamily: F.sb, fontSize: 15 }}>Temă</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Seg label="Zi" on={mode === 'zi'} onPress={() => set('zi')} />
            <Seg label="Noapte" on={mode === 'noapte'} onPress={() => set('noapte')} />
            <Seg label="Ca telefonul" on={mode === 'auto'} onPress={() => setBoard({ theme: 'auto' })} />
          </View>
        </View>
        <Press onPress={() => router.push('/preferinte')} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: t.line }}>
          <Icon name="heart" color={t.blueInk} />
          <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>Ce-ți place</T>
          <Icon name="next" size={16} color={t.ink3} />
        </Press>
        <Press onPress={() => router.push('/zona')} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: t.line }}>
          <Icon name="pin" color={t.blueInk} />
          <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>De unde pleci</T>
          <Icon name="next" size={16} color={t.ink3} />
        </Press>
      </View>

      <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>Ștampile</T>
        <Muted>{stamps.length === 1 ? '1 loc încercat' : stamps.length + ' locuri încercate'}</Muted>
      </View>
      <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
        {stamps.map((st, k) => (
          <View key={st.id} style={{ width: '20%', alignItems: 'center', gap: 5 }} accessibilityLabel={'Ștampilă: ' + st.name}>
            <View style={{ width: 52, height: 52, borderRadius: 999, borderWidth: 2.5, borderColor: INKS[k % INKS.length], alignItems: 'center', justifyContent: 'center', transform: [{ rotate: ROTS[k % ROTS.length] }] }}>
              <Icon name={st.icon as never} color={INKS[k % INKS.length]} />
            </View>
            <T numberOfLines={1} style={{ width: '100%', textAlign: 'center', fontFamily: F.sb, fontSize: 11, color: t.ink2 }}>{st.name}</T>
          </View>
        ))}
        <View style={{ width: '20%', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 52, height: 52, borderRadius: 999, borderWidth: 2.5, borderStyle: 'dashed', borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" color={t.line} />
          </View>
          <T style={{ fontFamily: F.sb, fontSize: 11, color: t.ink3 }}>Loc nou</T>
        </View>
      </View>
      {stamps.length === 0 ? <Muted style={{ marginTop: 10 }}>Când ajungi la un local din planuri, apasă „Sunt aici” pe bilet: primești ștampila și XP, iar poza bonului îți mai aduce 25 XP.</Muted> : null}

      <Press onPress={() => { router.navigate('/acasa'); setTimeout(() => startTour(true), 600); }}
        style={{ marginTop: 16, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
        <Bilu size={44} mood="wink" still shadow={false} />
        <View style={{ flex: 1, gap: 3 }}>
          <T style={{ fontFamily: F.sb, fontSize: 15 }}>Revezi turul cu Bilu</T>
          <Muted>Jumătate de minut, cu tot cu glume.</Muted>
        </View>
        <Icon name="next" size={16} color={t.ink3} />
      </Press>
      {err ? <View style={{ marginTop: 14 }}><Note kind="err">{err}</Note></View> : null}
      <View style={{ marginTop: 20, gap: 10 }}>
        {who ? (
          <Big label={busy === 'out' ? 'Ies din cont…' : 'Ieși din cont'} color={t.s1} ink={t.ink} disabled={!!busy}
            style={{ borderWidth: 1, borderColor: t.line }}
            onPress={async () => { setBusy('out'); setErr(''); await startOver(false); setBusy(''); router.replace('/cont'); }} />
        ) : null}
        <Big label={busy === 'del' ? 'Șterg contul…' : arm ? 'Apasă din nou: șterg tot, definitiv' : 'Șterge-mi contul'} color="#D93A1C" disabled={!!busy}
          onPress={async () => {
            if (!arm) { setArm(true); setErr(''); return; }
            setBusy('del');
            const e = await startOver(true);
            setBusy(''); setArm(false);
            if (e) { setErr(e); return; }
            router.replace('/cont');
          }} />
        {who ? <Muted style={{ textAlign: 'center' }}>{'Contul: ' + (who.email ?? 'Google')}</Muted> : null}
      </View>
      <Muted style={{ marginTop: 14, textAlign: 'center' }}>
        {'Datele localurilor: © contribuitorii '}
        <T style={{ fontFamily: F.m, fontSize: 13, color: t.ink2, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>OpenStreetMap</T>
        {', licența ODbL.'}
      </Muted>
      <Sheet open={photoOpen} onClose={() => setPhotoOpen(false)}>
        <View style={{ gap: 10 }}>
          <H1 style={{ fontSize: 26 }}>Poza de profil</H1>
          <Muted style={{ fontSize: 15, lineHeight: 21 }}>O vezi în Profil, pe Acasă și pe bilete. O pătrățică, micșorată, ca să încapă oriunde.</Muted>
          {(['camera', 'gallery'] as const).map((from) => (
            <Big key={from} label={from === 'camera' ? 'Fă o poză' : 'Alege din galerie'} color={from === 'camera' ? t.blue : t.s2} ink={from === 'camera' ? '#FFFFFF' : t.ink}
              onPress={async () => { setPhotoOpen(false); const e = await pickAvatar(from); if (e) setErr(e); }} />
          ))}
          {hasPhoto ? <Big label="Scoate poza" color={t.s1} ink={t.coralInk} style={{ borderWidth: 1, borderColor: t.line }} onPress={() => { removeAvatar(); setPhotoOpen(false); }} /> : null}
        </View>
      </Sheet>
    </ScrollView>
    <TopShade />
    </View>
  );
}
