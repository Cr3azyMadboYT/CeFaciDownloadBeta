// Acasă (decision Cornel, 04.10): the sky card with the weather, the day and the hour, "Ce facem în seara asta?" and
// one big button, "Creează plan" (five quick questions, then three plans ready to go); "Surprinde-mă" and "Ca data
// trecută" make a plan in one tap. Below: the next plan, "Bilu îți sugerează" (ideas without asking anything),
// "Ai chef de…" and Live Drops. Everything is real places from the engine.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP, useApp } from '../../lib/session';
import { phaseOfHour, setFilters, useFilters, type Phase } from '../../lib/filters';
import { NO_PLANS, dayWord, sortPlans, type Plan } from '../../lib/plans';
import { firstDraft, loadLast, runPlace, runPlans } from '../../lib/planAsk';
import { Bilu } from '../../ui/Bilu';
import { Avatar } from '../../ui/Avatar';
import { TourTarget } from '../../ui/TourTarget';
import { shouldStartTour, startTour } from '../../lib/tour';
import { useLightBar } from '../../ui/bar';
import { Icon, I } from '../../ui/Icon';
import { Muted, Press, T } from '../../ui/kit';
import { Sky, SKY_BG } from '../../ui/Sky';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';
import { useBackTwiceToExit } from '../../lib/backTwice';
import { useWeatherVersion } from '../../lib/weather';

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
    <View style={{ minHeight: 38, marginTop: 4 }} accessibilityLiveRegion="polite">
      <Animated.Text maxFontSizeMultiplier={1} style={{ fontFamily: F.hand, fontSize: 30, lineHeight: 38, color: '#FFD43B', opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
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
  useBackTwiceToExit();
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const wxv = useWeatherVersion();
  const prefs = useApp((s) => s.prefs);
  const plans = useApp((s) => (s.board.plans as Plan[] | undefined) ?? NO_PLANS);
  const now = useClock();
  useLightBar();
  // a new account gets Bilu's tour once, after Acasă has settled
  useEffect(() => { const id = setTimeout(() => { if (shouldStartTour()) startTour(); }, 900); return () => clearTimeout(id); }, []);
  const phase = phaseOfHour(now.getHours());
  const nowWx = useMemo(() => APP.dayWeather(new Date()), [wxv, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  const tonight = useMemo(() => (now.getHours() < 18 ? APP.weatherFor('eve') : null), [wxv, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps

  // the counts under "Ai chef de…" and Bilu's ideas are worked out after the screen is shown, so Acasă opens at once
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ideas, setIdeas] = useState<ReturnType<typeof APP.suggestions>>([]);
  useEffect(() => { const h = setTimeout(() => setIdeas(APP.suggestions()), 250); return () => clearTimeout(h); }, [prefs, wxv]);
  useEffect(() => {
    let i = 0;
    let stop = false;
    setCounts({});
    const step = () => {
      if (stop || i >= MOODS.length) return;
      const label = MOODS[i++][0];
      const n = APP.matches({ ...f, vibes: [label] }).length;
      setCounts((c) => ({ ...c, [label]: n }));
      setTimeout(step, 0);
    };
    // (not InteractionManager: Bilu's and the sky's endless animations would keep it waiting forever)
    const h = setTimeout(step, 450);
    return () => { stop = true; clearTimeout(h); };
  }, [f, prefs]);
  const moods = MOODS.map((m) => ({ m, n: counts[m[0]] }));
  const word = FLIP[phase].word;
  const soon = sortPlans(plans);
  const next = soon[0];
  const nextPlace = next ? APP.byId(next.placeId) : undefined;
  const clock = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const last = useMemo(() => loadLast(), [plans]); // eslint-disable-line react-hooks/exhaustive-deps

  // one tap: three plans from today's usual answers, one of them opened at random
  const surprise = () => {
    const made = runPlans(firstDraft());
    if (!made.length) { router.push('/plan-nou'); return; }
    router.push({ pathname: '/plan/[i]', params: { i: String(Math.floor(Math.random() * made.length)) } });
  };
  const again = () => { if (!last) { router.push('/plan-nou'); return; } runPlans(firstDraft()); router.push('/planuri-gata'); };
  const openIdea = (id: string, at: Date) => {
    // the plan is for the hour Bilu checked the idea for (now, or tonight at 20:00)
    const soonish = at.getTime() - Date.now() < 30 * 60e3;
    const hour = soonish ? 'acum' : String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
    if (runPlace(id, { ...firstDraft(), mode: 'loc', day: 0, hour })) router.push({ pathname: '/plan/[i]', params: { i: '0' } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ backgroundColor: SKY_BG[phase], paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 96, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
          <Sky phase={phase} />
          <TourTarget id="pills">
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
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
            <Icon name={(nowWx?.icon as never) ?? (phase === 'morning' || phase === 'day' ? 'sun' : 'moon')} size={40} color="#FFD43B" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                {nowWx ? <T style={{ fontFamily: F.display, fontSize: 32, lineHeight: 36, color: '#FFFFFF' }}>{nowWx.temp + '°'}</T> : null}
                <T style={{ fontFamily: F.sb, fontSize: nowWx ? 15 : 22, color: '#FFFFFF' }}>{nowWx ? nowWx.text.charAt(0).toUpperCase() + nowWx.text.slice(1) : clock}</T>
              </View>
              <T style={{ fontFamily: F.m, fontSize: 13.5, color: 'rgba(255,255,255,0.9)' }}>{APP.todayText() + (nowWx ? ' · ' + clock : '')}</T>
            </View>
            {tonight ? (
              <View style={{ alignItems: 'flex-end', maxWidth: 130 }}>
                <T style={{ fontFamily: F.sb, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Diseară</T>
                <T style={{ fontFamily: F.b, fontSize: 14, color: '#FFFFFF', textAlign: 'right' }}>{tonight.line.replace(/^Diseară /, '')}</T>
              </View>
            ) : null}
          </View>
          </TourTarget>
          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <T accessibilityRole="header" style={{ color: '#FFFFFF', fontFamily: F.display, fontSize: word.length > 10 ? 44 : 56, lineHeight: (word.length > 10 ? 44 : 56) * 0.95, letterSpacing: -1.6 }}>
                {'Ce facem\n' + word}
              </T>
              <FlipWords words={FLIP[phase].flip} />
            </View>
            <View style={{ marginBottom: 6 }}><Bilu size={84} mood="hi" shadow={false} /></View>
          </View>
          <TourTarget id="cta" style={{ marginTop: 16 }}>
            <Press onPress={() => router.push('/plan-nou')} accessibilityLabel="Creează plan"
              style={{ minHeight: 84, borderRadius: 24, backgroundColor: '#FFD43B', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, shadowColor: '#0E1440', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
              <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={26} color="#FFD43B" width={2.6} /></View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.display, fontSize: 26, lineHeight: 28, color: '#0E1440' }}>Creează plan</T>
                <T style={{ fontFamily: F.sb, fontSize: 13.5, color: 'rgba(14,20,64,0.75)' }}>5 întrebări, sub un minut</T>
              </View>
              <Icon name="next" size={22} color="#0E1440" />
            </Press>
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
              <Press onPress={surprise} accessibilityLabel="Surprinde-mă" style={{ flex: 1, height: 50, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="dice" size={18} color="#FFFFFF" /><T style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>Surprinde-mă</T>
              </Press>
              <Press onPress={again} accessibilityLabel={last ? 'Ca data trecută' : 'Creează plan'} style={{ flex: 1, height: 50, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" size={18} color="#FFFFFF" /><T style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>{last ? 'Ca data trecută' : 'Pas cu pas'}</T>
              </Press>
            </View>
          </TourTarget>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {next && nextPlace ? (
            <Press onPress={() => router.push({ pathname: '/bilet/[pid]', params: { pid: String(next.pid) } })}
              style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, borderRadius: 16, backgroundColor: '#FFD43B' }}>
              <View style={{ height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#0E1440', justifyContent: 'center' }}>
                <T style={{ fontFamily: F.display, fontSize: 16, color: '#FFD43B' }}>{next.slot}</T>
              </View>
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15, color: '#0E1440' }}>
                {dayWord(next).charAt(0).toUpperCase() + dayWord(next).slice(1) + ': ' + nextPlace.name + (soon.length > 1 ? ' și încă ' + (soon.length - 1) : '')}
              </T>
              <Icon name="next" size={16} color="#0E1440" />
            </Press>
          ) : null}

          {ideas.length ? (
            <>
              <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bilu size={34} mood="wink" shadow={false} still />
                <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.display, fontSize: 21 }}>Bilu îți sugerează</T>
                <Muted>{now.getHours() >= 17 || now.getHours() < 5 ? 'diseară' : 'azi'}</Muted>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                {ideas.map((x) => (
                  <Press key={x.place.id} onPress={() => openIdea(x.place.id, x.at)} accessibilityLabel={x.tag + ': ' + x.line}
                    style={{ width: 262, flexDirection: 'row', gap: 10, padding: 12, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                    <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: x.place.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.place.icon as never} size={24} color={x.place.fg} /></View>
                    <View style={{ flex: 1 }}>
                      <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12, color: t.blueInk }}>{x.tag}</T>
                      <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 15 }}>{x.line}</T>
                      <Muted numberOfLines={1}>{x.place.km.toFixed(1).replace('.', ',') + ' km · ' + (APP.openLabel(x.place.id, 'eve', x.at) || x.place.title) + (x.place.price ? ' · ~' + x.place.price + ' lei' : '')}</Muted>
                    </View>
                  </Press>
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>Ai chef de…</T>
            <Muted>un tap și vezi variante</Muted>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }} snapToInterval={126} decelerationRate="fast">
            {moods.map(({ m: [label, icon, bg, fg, dot], n }) => (
              <Press key={label} onPress={() => { setFilters({ vibes: [label] }); router.push('/rezultate'); }} accessibilityLabel={label + (n === undefined ? '' : ', ' + n + ' locuri')}
                style={{ width: 116, minHeight: 132, padding: 12, borderRadius: 22, backgroundColor: bg, justifyContent: 'space-between', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: -18, top: -18, width: 64, height: 64, borderRadius: 99, backgroundColor: dot }} />
                <Icon name={icon} size={30} color={fg} />
                <View style={{ gap: 4 }}>
                  <T style={{ fontFamily: F.b, fontSize: 16, lineHeight: 18, color: fg }}>{label}</T>
                  <T style={{ fontFamily: F.sb, fontSize: 12, color: fg }}>{n === undefined ? ' ' : n === 1 ? '1 loc' : n + ' locuri'}</T>
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
      <TopShade color={SKY_BG[phase]} />
    </View>
  );
}

function Pill({ icon, text, dot }: { icon?: 'sun' | 'moon' | 'clock' | 'cloud' | 'rain' | 'snow' | 'storm'; text: string; dot?: boolean }) {
  return (
    <View style={{ minHeight: 28, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: '#FF6A4D' }} /> : <Icon name={icon} size={14} color="#FFFFFF" />}
      <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>{text}</T>
    </View>
  );
}

