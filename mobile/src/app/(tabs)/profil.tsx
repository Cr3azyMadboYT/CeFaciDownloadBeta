// Profil: the passport card (name, level, XP), friends, theme, stamps from real outings, and deleting the account.
import { useEffect, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOver, useApp } from '../../lib/session';
import { Portrait } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import { H1, Muted, Press, Quiet, Seg, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';

const LEVELS = ['', 'Boboc', 'Scânteie', 'Radar', 'Busolă', 'Motorul găștii', 'Legenda orașului'];
const LEVEL_XP = [0, 100, 400, 900, 1500, 2500, 4000];
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function Profil() {
  const { t, name: theme, set } = useTheme();
  const ins = useSafeAreaInsets();
  const prefs = useApp((s) => s.prefs);
  const who = useApp((s) => s.who);
  const xp = useApp((s) => (s.board.xp as number | undefined) ?? 0);
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const id = setTimeout(() => setArm(false), 5000); return () => clearTimeout(id); }, [arm]);
  const lv = LEVEL_XP.reduce((acc, need, i) => (i && xp >= need ? i : acc), 0);
  const top = lv >= LEVEL_XP.length - 1;
  const cap = top ? LEVEL_XP[LEVEL_XP.length - 1] : LEVEL_XP[lv + 1];
  const pct = Math.min(100, (xp / cap) * 100);
  const founder = String(prefs.user || '').toLowerCase() === 'cornacidev';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }}>
      <View style={{ height: 44, justifyContent: 'center' }}><H1 style={{ fontSize: 28 }}>{'@' + (prefs.user || 'tu')}</H1></View>
      <View style={{ marginTop: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, backgroundColor: '#2F5BFF' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
          <View style={{ width: 88, height: 108, padding: 4, borderRadius: 14, backgroundColor: '#FFFFFF', transform: [{ rotate: '-3deg' }], shadowColor: '#0E1440', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 8 }, elevation: 6, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Portrait />
          </View>
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
          <Muted>0 prieteni</Muted>
        </Press>
        <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1, borderTopColor: t.line }}>
          <T style={{ marginBottom: 10, fontFamily: F.sb, fontSize: 15 }}>Temă</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Seg label="Zi" on={theme === 'zi'} onPress={() => set('zi')} />
            <Seg label="Noapte" on={theme === 'noapte'} onPress={() => set('noapte')} />
          </View>
        </View>
        <Press onPress={() => router.push('/zona')} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: t.line }}>
          <Icon name="pin" color={t.blueInk} />
          <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>De unde pleci</T>
          <Icon name="next" size={16} color={t.ink3} />
        </Press>
      </View>

      <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>Ștampile</T>
        <Muted>0 locuri încercate</Muted>
      </View>
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 999, borderWidth: 2.5, borderStyle: 'dashed', borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" color={t.line} />
        </View>
        <Muted style={{ flex: 1 }}>Primești o ștampilă la fiecare ieșire reală, iar poza bonului îți mai aduce 25 XP.</Muted>
      </View>

      {who ? <View style={{ marginTop: 18, alignItems: 'center' }}><Quiet label={'Ieși din cont (' + (who.email ?? 'Google') + ')'} color={t.ink2} onPress={() => { void startOver(false); router.replace('/cont'); }} /></View> : null}
      <Press onPress={() => { if (!arm) { setArm(true); return; } void startOver(true).then(() => router.replace('/cont')); }}
        style={{ marginTop: who ? 4 : 18, alignSelf: 'center', height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: arm ? t.coralSoft : 'transparent', justifyContent: 'center' }}>
        <T style={{ fontFamily: F.sb, fontSize: 14, color: arm ? t.coralInk : t.ink2 }}>{arm ? 'Apasă din nou: șterg tot, definitiv' : 'Șterge-mi contul'}</T>
      </Press>
      <Muted style={{ marginTop: 14, textAlign: 'center' }}>
        {'Datele localurilor: © contribuitorii '}
        <T style={{ fontFamily: F.m, fontSize: 13, color: t.ink2, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>OpenStreetMap</T>
        {', licența ODbL.'}
      </Muted>
    </ScrollView>
  );
}
