// Acasă: the sky card with "Ce facem în seara asta?", who comes, the filters and the big button; below, the next
// plan, "Ai chef de…" and Live Drops. Everything counts real places from the engine.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP, useApp } from '../../lib/session';
import { WHO, phaseOfHour, setFilters, summaryOf, useFilters, type Phase } from '../../lib/filters';
import { NO_PLANS, DAYKEY, createPlan, sortPlans, type Plan } from '../../lib/plans';
import { Avatar } from '../../ui/Avatar';
import { FilterSheet } from '../../ui/FilterSheet';
import { Icon, I } from '../../ui/Icon';
import { Big, H1, Muted, Press, Sheet, T } from '../../ui/kit';
import { Sky, SKY_BG } from '../../ui/Sky';
import { F, useTheme } from '../../ui/theme';

const FLIP: Record<Phase, { word: string; flip: string[] }> = {
  morning: { word: 'astăzi?', flip: ['…o cafea bună?', '…un brunch?', '…o plimbare la lac?', '…padel dimineața?', '…Mogoșoaia?'] },
  day: { word: 'astăzi?', flip: ['…Mogoșoaia?', '…un escape room?', '…un film?', '…jocuri de societate?', '…o pizza la cuptor?'] },
  dusk: { word: 'în seara asta?', flip: ['…poate un bowling?', '…sau karaoke?', '…un film bun?', '…un escape room?', '…o pizza la cuptor?', '…padel cu gașca?'] },
  night: { word: 'în seara asta?', flip: ['…un club?', '…karaoke?', '…cocktailuri pe terasă?', '…stand-up?', '…un film târziu?'] },
  late: { word: 'acum?', flip: ['…un club?', '…ceva deschis non-stop?', '…karaoke?', '…o plimbare cu gașca?'] },
};
const MOODS: [string, keyof typeof I, string, string, string][] = [
  ['Competitiv', 'target', '#2F5BFF', '#FFFFFF', '#5C80FF'],
  ['Party', 'club', '#0E1440', '#FFD43B', '#2B3575'],
  ['Chill', 'coffee', '#B7A3FF', '#0E1440', '#CFC2FF'],
  ['Mâncare bună', 'burger', '#FF6A4D', '#0E1440', '#FF8A73'],
  ['Aer liber', 'waves', '#FFD43B', '#0E1440', '#FFE58A'],
  ['Fun', 'dice', '#8EA6FF', '#0E1440', '#B7C6FF'],
  ['Cultură', 'landmark', '#FFE58A', '#0E1440', '#FFD43B'],
];

/** The yellow handwritten line under the question; a new idea every 2.5 seconds. */
function FlipWords({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(a, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        setI((x) => (x + 1) % words.length);
        Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
      });
    }, 2500);
    return () => clearInterval(id);
  }, [words, a]);
  return (
    <View style={{ height: 38, marginTop: 4 }} accessibilityLiveRegion="polite">
      <Animated.Text style={{ fontFamily: F.hand, fontSize: 30, lineHeight: 38, color: '#FFD43B', opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        {words[i % words.length]}
      </Animated.Text>
    </View>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  return now;
}

export default function Acasa() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const prefs = useApp((s) => s.prefs);
  const plans = useApp((s) => (s.board.plans as Plan[] | undefined) ?? NO_PLANS);
  const now = useClock();
  const phase = phaseOfHour(now.getHours());
  const [sheet, setSheet] = useState(false);
  const [crewOpen, setCrewOpen] = useState(false);

  const all = useMemo(() => APP.matches(f), [f, prefs]);
  const moods = useMemo(() => MOODS.map((m) => ({ m, n: APP.matches({ ...f, vibes: [m[0]] }).length })), [f, prefs]);
  const word = f.when === 'now' ? FLIP[phase].word : ({ eve: 'în seara asta?', tom: 'mâine?', we: 'în weekend?' } as Record<string, string>)[f.when];
  const next = sortPlans(plans)[0];
  const nextPlace = next ? APP.byId(next.placeId) : undefined;
  const clock = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  const surprise = () => {
    const pool = all.length ? all : APP.places;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    const pid = createPlan(pick.id, f);
    router.push({ pathname: '/bilet/[pid]', params: { pid: String(pid) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ backgroundColor: SKY_BG[phase], paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 86, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
          <Sky phase={phase} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
            <Press onPress={() => router.push('/zona')} accessibilityLabel={'Zona ta: ' + APP.zoneName() + '. Schimbă zona'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, marginLeft: -10, paddingLeft: 10, paddingRight: 12, borderRadius: 14 }}>
              <Icon name="pin" size={16} color="#FFD43B" />
              <T style={{ fontFamily: F.sb, fontSize: 16, color: '#FFFFFF' }}>{APP.zoneName()}</T>
              <View style={{ opacity: 0.7 }}><Icon name="down" size={16} color="#FFFFFF" /></View>
            </Press>
            <Press onPress={() => router.push('/profil')} accessibilityLabel="Profilul tău" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Avatar size={34} />
            </Press>
          </View>
          <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Pill icon={phase === 'morning' || phase === 'day' ? 'sun' : 'moon'} text={APP.todayText()} />
            <Pill icon="clock" text={clock} />
            <Pill dot text={APP.count.toLocaleString('ro-RO') + ' de locuri reale'} />
          </View>
          <T accessibilityRole="header" style={{ marginTop: 22, color: '#FFFFFF', fontFamily: F.display, fontSize: word.length > 10 ? 48 : 62, lineHeight: (word.length > 10 ? 48 : 62) * 0.95, letterSpacing: -1.8 }}>
            {'Ce facem\n' + word}
          </T>
          <FlipWords words={FLIP[phase].flip} />
          <T style={{ marginTop: 16, fontFamily: F.sb, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>Cine vine?</T>
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            {['1', '2', '34', '5'].map((k) => {
              const on = f.who === k;
              return (
                <Press key={k} onPress={() => setFilters({ who: k })} accessibilityState={{ selected: on }}
                  style={{ flex: 1, height: 46, borderRadius: 999, borderWidth: 1, borderColor: on ? '#FFFFFF' : 'rgba(255,255,255,0.28)', backgroundColor: on ? '#FFFFFF' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ fontFamily: F.sb, fontSize: 15, color: on ? '#0E1440' : '#FFFFFF' }}>{WHO[k].label}</T>
                </Press>
              );
            })}
          </View>
          {f.who !== '1' ? (
            <Press onPress={() => setCrewOpen(true)} style={{ marginTop: 10, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)' }}>
              <View style={{ width: 34, height: 34, borderRadius: 99, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}><Icon name="userPlus" size={16} color="#0E1440" /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <T style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>Alege cu cine ieși</T>
                <T style={{ fontFamily: F.m, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>o gașcă sau prieteni, primesc invitație</T>
              </View>
              <Icon name="next" size={16} color="#FFD43B" />
            </Press>
          ) : null}
          <Press onPress={() => setSheet(true)} style={{ marginTop: 10, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
            <T style={{ flex: 1, fontFamily: F.m, fontSize: 14, lineHeight: 18, color: 'rgba(255,255,255,0.9)' }}>{summaryOf(f)}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" size={16} color="#FFD43B" />
              <T style={{ fontFamily: F.b, fontSize: 14, color: '#FFD43B' }}>Filtre</T>
            </View>
          </Press>
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
            <Press onPress={() => { setFilters({}, {}); router.push('/rezultate'); }}
              style={{ flex: 1, height: 58, borderRadius: 18, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center', shadowColor: '#FFD43B', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}>
              <T style={{ fontFamily: F.b, fontSize: 17, color: '#0E1440' }}>{all.length ? 'Arată variante (' + all.length + ')' : 'Arată variante'}</T>
            </Press>
            <Press onPress={surprise} accessibilityLabel="Surprinde-mă" style={{ width: 58, height: 58, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="dice" size={24} color="#FFFFFF" />
            </Press>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {next && nextPlace ? (
            <Press onPress={() => router.push({ pathname: '/bilet/[pid]', params: { pid: String(next.pid) } })}
              style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, borderRadius: 16, backgroundColor: '#FFD43B' }}>
              <View style={{ height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#0E1440', justifyContent: 'center' }}>
                <T style={{ fontFamily: F.display, fontSize: 16, color: '#FFD43B' }}>{next.slot}</T>
              </View>
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15, color: '#0E1440' }}>
                {(DAYKEY[next.when] === 'azi' ? 'Azi: ' : DAYKEY[next.when] === 'mâine' ? 'Mâine: ' : 'Sâmbătă: ') + nextPlace.name + (plans.length > 1 ? ' și încă ' + (plans.length - 1) : '')}
              </T>
              <Icon name="next" size={16} color="#0E1440" />
            </Press>
          ) : null}

          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>Ai chef de…</T>
            <Muted>un tap și vezi variante</Muted>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }} snapToInterval={126} decelerationRate="fast">
            {moods.map(({ m: [label, icon, bg, fg, dot], n }) => (
              <Press key={label} onPress={() => { setFilters({ vibes: [label] }); router.push('/rezultate'); }} accessibilityLabel={label + ', ' + n + ' locuri'}
                style={{ width: 116, height: 132, padding: 12, borderRadius: 22, backgroundColor: bg, justifyContent: 'space-between', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: -18, top: -18, width: 64, height: 64, borderRadius: 99, backgroundColor: dot }} />
                <Icon name={icon} size={30} color={fg} />
                <View style={{ gap: 4 }}>
                  <T style={{ fontFamily: F.b, fontSize: 16, lineHeight: 18, color: fg }}>{label}</T>
                  <T style={{ fontFamily: F.sb, fontSize: 12, color: fg }}>{n === 1 ? '1 loc' : n + ' locuri'}</T>
                </View>
              </Press>
            ))}
          </ScrollView>

          <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: t.coral }} />
            <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 20 }}>Live Drops</T>
          </View>
          <View style={{ marginTop: 10, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line, gap: 4 }}>
            <T style={{ fontFamily: F.sb, fontSize: 15 }}>Încă nu sunt Live Drops.</T>
            <Muted>Reducerile fulger apar aici când primele localuri partenere intră în CeFaci.</Muted>
          </View>
        </View>
      </ScrollView>

      <FilterSheet open={sheet} value={f} onClose={() => setSheet(false)} onApply={(d) => { setSheet(false); setFilters(d); router.push('/rezultate'); }} />
      <Sheet open={crewOpen} onClose={() => setCrewOpen(false)}>
        <H1 style={{ fontSize: 26 }}>Cu cine ieși?</H1>
        <Muted style={{ marginTop: 8, fontSize: 15, lineHeight: 21 }}>Încă n-ai prieteni în CeFaci. Adaugă-i după @username și apoi faceți gașca și votați împreună unde mergeți.</Muted>
        <View style={{ marginTop: 16, gap: 8 }}>
          <Big label="Adaugă prieteni" onPress={() => { setCrewOpen(false); router.push('/prieteni'); }} />
          <Big label={'Mergem ' + WHO[f.who].text.toLowerCase() + ', fără invitații'} color={t.s2} ink={t.ink} onPress={() => setCrewOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function Pill({ icon, text, dot }: { icon?: 'sun' | 'moon' | 'clock'; text: string; dot?: boolean }) {
  return (
    <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: '#FF6A4D' }} /> : <Icon name={icon} size={14} color="#FFFFFF" />}
      <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>{text}</T>
    </View>
  );
}

