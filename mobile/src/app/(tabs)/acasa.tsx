// Acasă (decision Cornel, 04.10): the sky card with the weather, the day and the hour, "Ce facem în seara asta?" and
// one big button, "Creează plan" (five quick questions, then three plans ready to go); "Surprinde-mă" and "Ca data
// trecută" make a plan in one tap. Below: the next plan, "Bilu îți sugerează" (ideas without asking anything),
// "Ai chef de…" and Live Drops. Everything is real places from the engine.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP, useApp } from '../../lib/session';
import { phaseOfHour, type Phase } from '../../lib/filters';
import { NO_PLANS, dayWord, sortPlans, type Plan } from '../../lib/plans';
import { rateOuting, toRate } from '../../lib/rate';
import { askOf, firstDraft, moodDraft, runPlace, runPlans, surpriseDraft } from '../../lib/planAsk';
import { eveningOf } from '../../../../src/engine/time';
import { Bilu } from '../../ui/Bilu';
import { Avatar } from '../../ui/Avatar';
import { TourTarget } from '../../ui/TourTarget';
import { shouldStartTour, startTour, useTour } from '../../lib/tour';
import { tourTargetAt } from '../../ui/Tour';
import { useLightBar } from '../../ui/bar';
import { Icon, I } from '../../ui/Icon';
import { Muted, Press, T } from '../../ui/kit';
import { Sky, SKY_BG } from '../../ui/Sky';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';
import { useBackTwiceToExit } from '../../lib/backTwice';
import { useWeatherVersion } from '../../lib/weather';
import { Doodles } from '../../ui/Doodles';
import { SeasonCta, SeasonFall } from '../../ui/SeasonFall';
import { LOOKS, useLook } from '../../lib/season';
import { quickStart, refreshFreeNow, spanText, useFreeNow } from '../../lib/freeNow';
import { useCalm } from '../../lib/motion';
import { CONF } from '../../ui/Magic';
import { toast } from '../../lib/toast';
import * as Haptics from 'expo-haptics';

const FLIP: Record<Phase, { word: string; flip: string[] }> = {
  morning: { word: 'astăzi?', flip: ['…o cafea bună?', '…un brunch?', '…o plimbare la lac?', '…padel dimineața?', '…Mogoșoaia?'] },
  day: { word: 'astăzi?', flip: ['…Mogoșoaia?', '…un escape room?', '…un film?', '…jocuri de societate?', '…o pizza la cuptor?'] },
  dusk: { word: 'în seara asta?', flip: ['…poate un bowling?', '…sau karaoke?', '…un film bun?', '…un escape room?', '…o pizza la cuptor?', '…padel cu gașca?'] },
  night: { word: 'în seara asta?', flip: ['…un club?', '…karaoke?', '…un cocktail bun?', '…biliard sau darts?', '…o bere cu gașca?'] },
  late: { word: 'acum?', flip: ['…un club?', '…ceva non-stop?', '…karaoke?', '…o plimbare cu gașca?'] },
};
/** Sub 18 (seara și noaptea): fără club, cocktail, bere. */
const FLIP_MINOR: Partial<Record<Phase, string[]>> = {
  night: ['…karaoke?', '…un film bun?', '…biliard sau darts?', '…ceva dulce?', '…o plimbare cu gașca?'],
  late: ['…ceva de mâncat?', '…o plimbare cu gașca?', '…un film acasă?'],
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
    // înălțime fixă, un singur rând (Cornel, 13.10: textele lungi treceau pe 2 rânduri și ecranul se ridica și se lăsa)
    <View style={{ height: 40, marginTop: 4, justifyContent: 'center' }} accessibilityLiveRegion="polite">
      <Animated.Text maxFontSizeMultiplier={1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: F.hand, fontSize: 30, lineHeight: 38, color: '#FFD43B', opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
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
  const wear = LOOKS[useLook()];
  const [top, setTop] = useState({ w: 0, h: 0 });
  const [ctaW, setCtaW] = useState(0);
  const wxv = useWeatherVersion();
  const prefs = useApp((s) => s.prefs);
  const plans = useApp((s) => (s.board.plans as Plan[] | undefined) ?? NO_PLANS);
  const now = useClock();
  useLightBar();
  // FreeNow (Cornel, 12.10): când biletul s-a umplut, Bilu de lângă titlu zboară în sus din ecran, apoi urcă înapoi din
  // oraș la locul lui, cu confetti. Doar transformări pe firul nativ (translate/rotate/scale/opacity), nimic de layout.
  const calm = useCalm();
  const hop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const [cheer, setCheer] = useState(false);
  const flying = useRef(false);
  const celebrate = useCallback(() => {
    if (calm || flying.current) return;
    flying.current = true;
    setCheer(true);
    Animated.timing(hop, { toValue: 1, duration: 520, easing: Easing.in(Easing.back(1.6)), useNativeDriver: true }).start(() => {
      hop.setValue(2);
      Animated.spring(hop, { toValue: 3, delay: 260, useNativeDriver: true, speed: 9, bounciness: 9 }).start(() => {
        hop.setValue(0);
        flying.current = false;
        setTimeout(() => setCheer(false), 1400);
      });
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        burst.setValue(0);
        Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => burst.setValue(0));
      }, 620);
    });
  }, [calm, hop, burst]);
  // turul lui Bilu: ținta e sus pe cer, Acasă stă sus cât arată Bilu spre ea
  const scroll = useRef<ScrollView>(null);
  const tour = useTour();
  useEffect(() => {
    if (!tour.on) return;
    const id = tourTargetAt(tour.step);
    if (id === 'pills' || id === 'cta' || id === 'freenow' || !id) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [tour.on, tour.step]);
  // a new account gets Bilu's tour once, after Acasă has settled
  useEffect(() => { const id = setTimeout(() => { if (shouldStartTour()) startTour(); }, 900); return () => clearTimeout(id); }, []);
  const phase = phaseOfHour(now.getHours());
  const nowWx = useMemo(() => APP.dayWeather(new Date()), [wxv, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  const tonight = useMemo(() => (now.getHours() < 18 ? APP.weatherFor('eve') : null), [wxv, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps

  // the counts under "Ai chef de…" (places open at that moment) and Bilu's ideas come after the screen is shown
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ideas, setIdeas] = useState<ReturnType<typeof APP.suggestions>>([]);
  useEffect(() => { const h = setTimeout(() => { setIdeas(APP.suggestions()); }, 250); return () => clearTimeout(h); }, [prefs, wxv, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // (not InteractionManager: Bilu's and the sky's endless animations would keep it waiting forever)
    const h = setTimeout(() => setCounts(APP.vibeCounts(askOf({ ...firstDraft(), mode: 'loc' }))), 450);
    return () => clearTimeout(h);
  }, [prefs, wxv, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  const moods = MOODS.map((m) => ({ m, n: counts[m[0]] }));
  const word = FLIP[phase].word;
  const soon = sortPlans(plans);
  const next = soon[0];
  const nextPlace = next ? APP.byId(next.placeId) : undefined;
  const clock = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  // after an outing: one tap to say how it was (it teaches Bilu, and the crew when the plan was with them)
  const rate = useMemo(() => toRate((plans as Plan[]) ?? [], now), [plans, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  const ratePlace = rate ? APP.byId(rate.placeId) : undefined; // eslint-disable-line react-hooks/exhaustive-deps

  // one tap: Bilu makes three outings and opens one of them; "Altă surpriză" is on it
  const surprise = () => { void runPlans(surpriseDraft(), { surprise: true }); router.push({ pathname: '/plan/[i]', params: { i: 's' } }); };
  const mood = (vibe: string) => { void runPlans(moodDraft(vibe)); router.push('/planuri-gata'); };
  const openIdea = (id: string, soonish: boolean, at: Date) => {
    const hour = soonish ? 'acum' : String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
    // the idea's own evening: at 02:30 an idea for 20:00 is today's, not last night's (which would turn it into "now")
    if (runPlace(id, { ...firstDraft(), mode: 'loc', evening: eveningOf(soonish ? new Date() : at), hour })) router.push({ pathname: '/plan/[i]', params: { i: '0' } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View onLayout={(e) => setTop({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          style={{ backgroundColor: SKY_BG[phase], paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 96, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
          <Sky phase={phase} />
          <SeasonFall wear={wear} w={top.w} h={top.h} night={phase === 'dusk' || phase === 'night' || phase === 'late'} />
          <TourTarget id="pills">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
            <Press onPress={() => router.push('/zona')} accessibilityLabel={'Pleci din ' + APP.zoneName() + ', până la ' + APP.radiusKm() + ' km. Schimbă'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, marginLeft: -10, paddingLeft: 10, paddingRight: 12, borderRadius: 14 }}>
              <Icon name="pin" size={16} color="#FFD43B" />
              <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 16, color: '#FFFFFF', maxWidth: 230 }}>{APP.zoneName() + ' · ' + APP.radiusKm() + ' km'}</T>
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
              <FlipWords words={(APP.isMinor() && FLIP_MINOR[phase]) || FLIP[phase].flip} />
            </View>
            <View style={{ marginBottom: 6 }}>
              <Animated.View style={{ transform: [
                { translateY: hop.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0, -460, Math.max(360, top.h), 0] }) },
                { rotate: hop.interpolate({ inputRange: [0, 1, 2, 2.7, 3], outputRange: ['0deg', '-18deg', '14deg', '-4deg', '0deg'] }) },
                { scale: hop.interpolate({ inputRange: [0, 0.15, 1, 2, 3], outputRange: [1, 0.9, 1.1, 1.1, 1] }) },
              ] }}>
                <Bilu size={84} mood={cheer ? 'yay' : 'hi'} shadow={false} />
              </Animated.View>
              <Burst v={burst} />
            </View>
          </View>
          {/* Creează plan + zarul (Surprinde-mă) pe un rând, FreeNow ca bilet dedesubt (Cornel, 12.10: „Ca data trecută” a ieșit) */}
          <TourTarget id="cta" style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }} onLayout={(e) => setCtaW(e.nativeEvent.layout.width)}>
                <Press onPress={() => router.push('/plan-nou')} accessibilityLabel="Creează plan"
                  style={{ minHeight: 84, borderRadius: 24, backgroundColor: '#FFD43B', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, shadowColor: '#0E1440', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={26} color="#FFD43B" width={2.6} /></View>
                  <View style={{ flex: 1 }}>
                    <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.display, fontSize: 26, lineHeight: 28, color: '#0E1440' }}>Creează plan</T>
                    <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: F.sb, fontSize: 13, color: 'rgba(14,20,64,0.75)' }}>5 întrebări, sub un minut</T>
                  </View>
                </Press>
                <SeasonCta wear={wear} w={ctaW} />
              </View>
              <SurpriseBtn onPress={surprise} />
            </View>
          </TourTarget>
          <TourTarget id="freenow" style={{ marginTop: 10 }}>
            <HoldFreeNow sky={SKY_BG[phase]} onEntered={celebrate} />
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

          {rate && ratePlace ? (
            <View style={{ marginTop: 14, padding: 14, gap: 10, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Bilu size={34} mood="wink" shadow={false} still />
                <T style={{ flex: 1, fontFamily: F.b, fontSize: 15 }}>{'Cum a fost la ' + ratePlace.name + '?'}</T>
              </View>
              {rate.sid ? <Muted>Votul tău învață și gașca: data viitoare vă fac planuri mai pe gustul vostru.</Muted> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([['super', 'Super!'], ['yes', 'Mi-a plăcut'], ['no', 'Nu prea']] as const).map(([k, label]) => (
                  <Press key={k} onPress={() => { void rateOuting(rate, k); }} accessibilityLabel={label + ' la ' + ratePlace.name}
                    style={{ flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'super' ? '#FFD43B' : k === 'yes' ? t.blue : t.s2 }}>
                    <T style={{ fontFamily: F.b, fontSize: 14, color: k === 'yes' ? '#FFFFFF' : k === 'super' ? '#0E1440' : t.ink }}>{label}</T>
                  </Press>
                ))}
              </View>
            </View>
          ) : null}

          {ideas.length ? (
            <>
              <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bilu size={34} mood="wink" shadow={false} still />
                <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.display, fontSize: 21 }}>Bilu îți sugerează</T>
                <Muted>{ideas[0]?.now ? 'acum' : (ideas[0].at.getHours() >= 17 ? 'diseară' : 'azi') + ', la ' + String(ideas[0].at.getHours()).padStart(2, '0') + ':' + String(ideas[0].at.getMinutes()).padStart(2, '0')}</Muted>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                {ideas.map((x) => (
                  <Press key={x.place.id} onPress={() => openIdea(x.place.id, x.now, x.at)} accessibilityLabel={x.tag + ': ' + x.line}
                    style={{ width: 262, flexDirection: 'row', gap: 10, padding: 12, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                    <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: x.place.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.place.icon as never} size={24} color={x.place.fg} /></View>
                    <View style={{ flex: 1 }}>
                      <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12, color: t.blueInk }}>{x.tag}</T>
                      <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 15 }}>{x.line}</T>
                      <Muted numberOfLines={1}>{x.place.km.toFixed(1).replace('.', ',') + ' km · ' + (APP.openLabel(x.place.id, 'now', x.at) || x.place.title) + (x.place.price ? ' · ~' + x.place.price + ' lei' : '')}</Muted>
                    </View>
                  </Press>
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>Ai chef de…</T>
            <Muted>un tap și ai 3 planuri</Muted>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }} snapToInterval={126} decelerationRate="fast">
            {moods.map(({ m: [label, icon, bg, fg, dot], n }) => (
              <Press key={label} onPress={() => mood(label)} accessibilityLabel={label + (n === undefined ? '' : ', ' + n + ' locuri deschise')}
                style={{ width: 116, minHeight: 132, padding: 12, borderRadius: 22, backgroundColor: bg, justifyContent: 'space-between', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', right: -18, top: -18, width: 64, height: 64, borderRadius: 99, backgroundColor: dot }} />
                <Icon name={icon} size={30} color={fg} />
                <View style={{ gap: 4 }}>
                  <T style={{ fontFamily: F.b, fontSize: 16, lineHeight: 18, color: fg }}>{label}</T>
                  <T style={{ fontFamily: F.sb, fontSize: 12, color: fg }}>{n === undefined ? ' ' : n === 0 ? 'nimic deschis' : n === 1 ? '1 deschis' : n + ' deschise'}</T>
                </View>
              </Press>
            ))}
          </ScrollView>

        </View>
      </ScrollView>
      <TopShade color={SKY_BG[phase]} />
    </View>
  );
}

/** FreeNow (Cornel, 12.10): biletul galben de pe cer, sub Creează plan, deasupra orașului. Ții apăsat și se umple de verde;
 *  la capăt Bilu zboară în sus și ești pe FreeNow cu alegerile de data trecută. O apăsare scurtă deschide ecranul FreeNow. */
const HOLD_MS = 900;
function HoldFreeNow({ sky, onEntered }: { sky: string; onEntered: () => void }) {
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const st = useFreeNow();
  const fill = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const [busy, setBusy] = useState(false);
  const done = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!who || !known) return undefined;
    void refreshFreeNow();
    const id = setInterval(() => { void refreshFreeNow(); }, 60000);
    return () => clearInterval(id);
  }, [who, known]));
  const others = st.people.filter((p) => !p.outing?.mine);
  const on = !!(st.me || st.outing);
  const open = () => router.push('/freenow');
  const go = async () => {
    // biletul rămâne plin („Bilu îi anunță…”) cât răspunde serverul; Bilu zboară doar dacă a mers
    setBusy(true);
    const r = await quickStart().catch(() => ({ err: 'Nu am putut intra pe FreeNow. Mai încearcă o dată.', notified: 0 }));
    setBusy(false);
    Animated.timing(fill, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    if (r.err) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); toast(r.err); open(); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onEntered();
    toast(r.notified ? 'Ești pe FreeNow! Am anunțat ' + (r.notified === 1 ? '1 om.' : r.notified + ' oameni.') : 'Ești pe FreeNow! Cine deschide aplicația te vede.');
  };
  const pressIn = () => {
    done.current = false;
    if (on || busy || !who || !known) return;
    Haptics.selectionAsync().catch(() => {});
    Animated.timing(fill, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished && !done.current) { done.current = true; void go(); }
    });
  };
  const pressOut = () => { if (done.current || on) return; fill.stopAnimation(); Animated.spring(fill, { toValue: 0, useNativeDriver: false, speed: 20 }).start(); };
  const title = st.outing ? (st.outing.plan ? 'Mergeți la ' + st.outing.plan.venue_name : 'Ieșiți: ' + st.outing.members.length + ' oameni')
    : st.me ? 'Ești pe FreeNow ' + spanText(st.me.starts_at, st.me.ends_at) : busy ? 'Bilu îi anunță…' : 'FreeNow';
  const sub = whoIsOn(others.map((p) => p.first_name)) || (on ? 'Apasă să vezi cine vine' : 'Ai timp? Ține apăsat ca să intri');
  const faces = others.map((p) => ({ n: p.first_name, u: p.username }));
  const face = (dark: boolean) => (
    <>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 14.5, color: dark ? '#0E1440' : on ? '#5FD39A' : '#FFD43B' }}>{title + (on || busy ? '' : ' ⚡')}</T>
        <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: F.m, fontSize: 12.5, color: dark ? 'rgba(14,20,64,0.8)' : 'rgba(255,255,255,0.85)' }}>{sub}</T>
      </View>
      {faces.length ? <Faces list={faces} ring={dark ? '#FFD43B' : sky} /> : null}
      <Icon name="next" size={16} color={dark ? '#0E1440' : 'rgba(255,255,255,0.7)'} />
    </>
  );
  const fillW = fill.interpolate({ inputRange: [0, 1], outputRange: [0, w || 400] });
  const press = { onPress: () => { if (!done.current) open(); }, onPressIn: pressIn, onPressOut: pressOut, delayLongPress: HOLD_MS + 400,
    accessibilityLabel: title + '. ' + sub, accessibilityHint: on ? undefined : 'Ține apăsat ca să intri pe FreeNow; o apăsare deschide FreeNow.' };

  // bilet de sticlă (Cornel, 12.10: varianta A, discret ca zarul): cotor ⚡ și perforație galbenă; ții apăsat și se umple de galben
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Press {...press} style={{ height: 56, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: on ? '#5FD39A' : 'rgba(255,255,255,0.25)', backgroundColor: on ? 'rgba(95,211,154,0.16)' : 'rgba(255,255,255,0.10)' }}>
        <View style={{ width: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' }}>
          <Animated.View style={{ transform: [{ scale: fill.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }}><T style={{ fontSize: 20 }}>⚡</T></Animated.View>
        </View>
        <View style={{ width: 0, alignSelf: 'stretch', borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: on ? '#5FD39A' : 'rgba(255,212,59,0.7)' }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 12 }}>{face(false)}</View>
        {/* umplerea: aceeași față, galbenă cu scris închis, tăiată cât ai ținut apăsat */}
        {!on ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#FFD43B', width: fillW }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: w || 400, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E1440' }}><T style={{ fontSize: 20 }}>⚡</T></View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 13.5, paddingRight: 12 }}>{face(true)}</View>
            </View>
          </Animated.View>
        ) : null}
      </Press>
      <View pointerEvents="none" style={{ position: 'absolute', left: 44, top: -6, width: 12, height: 12, borderRadius: 99, backgroundColor: sky }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 44, bottom: -6, width: 12, height: 12, borderRadius: 99, backgroundColor: sky }} />
    </View>
  );
}

// „Surprinde-mă” (Cornel, 13.10: „fă-l mai bine”): o placă mov cu un zar adevărat, cu buline, care din când în când
// se clatină; apăsat, zarul se rostogolește și abia apoi pleci spre surpriză. Doar transformări pe native driver.
const PIPS: Record<number, [number, number][]> = {
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};
function Die({ face, size }: { face: number; size: number }) {
  // bulinele se așază în interiorul marginii (pozițiile absolute pornesc de după bordură), pe o grilă 3×3 cu margine egală
  const border = 2;
  const inner = size - border * 2;
  const dot = Math.round(size * 0.17);
  const pad = inner * 0.16;
  const step = (inner - pad * 2 - dot) / 2;
  return (
    <View style={{ width: size, height: size + 3, borderRadius: size * 0.26, backgroundColor: '#C9C2F5', borderWidth: border, borderColor: '#0E1440' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: inner, height: inner, borderRadius: size * 0.22, backgroundColor: '#FFFFFF' }}>
        {PIPS[face].map(([x, y], k) => (
          <View key={k} style={{ position: 'absolute', left: pad + x * step, top: pad + y * step, width: dot, height: dot, borderRadius: dot, backgroundColor: '#0E1440' }} />
        ))}
      </View>
    </View>
  );
}
function SurpriseBtn({ onPress }: { onPress: () => void }) {
  const calm = useCalm();
  const spin = useRef(new Animated.Value(0)).current;
  const wob = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState(5);
  const busy = useRef(false);
  useEffect(() => {
    if (calm) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(3800),
      Animated.timing(wob, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(wob, { toValue: -1, duration: 160, useNativeDriver: true }),
      Animated.timing(wob, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(wob, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [calm, wob]);
  const go = () => {
    if (busy.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (calm) { onPress(); return; }
    busy.current = true;
    const t1 = setTimeout(() => setFace(3), 120); const t2 = setTimeout(() => setFace(6), 260); const t3 = setTimeout(() => setFace(5), 400);
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      busy.current = false; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); spin.setValue(0); onPress();
    });
  };
  return (
    <Press onPress={go} accessibilityLabel="Surprinde-mă: Bilu îți face un plan dintr-un tap"
      style={{ width: 92, minHeight: 84, borderRadius: 24, backgroundColor: '#8C6CFF', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, overflow: 'hidden',
        shadowColor: '#0E1440', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -24, right: -18, width: 64, height: 64, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.14)' }} />
      <T pointerEvents="none" style={{ position: 'absolute', top: 6, left: 9, fontSize: 11, color: '#FFD43B' }}>✦</T>
      <T pointerEvents="none" style={{ position: 'absolute', top: 18, right: 10, fontSize: 8, color: '#FFFFFF' }}>✦</T>
      <Animated.View style={{ transform: [
        { translateY: spin.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -14, 0] }) },
        { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '352deg'] }) },
        { rotate: wob.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }) },
      ] }}>
        <Die face={face} size={38} />
      </Animated.View>
      <T numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.b, fontSize: 12, color: '#FFFFFF' }}>Surprinde-mă</T>
    </Press>
  );
}

/** Sub titlul „FreeNow ⚡”, doar cine are timp (fără text care rulează: încape mereu dintr-o privire):
 *  „Mihai are timp acum”, „Mihai și Andrei au timp acum”, „Mihai, Andrei și Ana au timp”, de la 4: „Mihai, Andrei și alții au timp!” */
function whoIsOn(n: string[]) {
  if (!n.length) return '';
  if (n.length === 1) return n[0] + ' are timp acum';
  if (n.length === 2) return n[0] + ' și ' + n[1] + ' au timp acum';
  if (n.length === 3) return n[0] + ', ' + n[1] + ' și ' + n[2] + ' au timp';
  return n[0] + ', ' + n[1] + ' și alții au timp!';
}
const FACE_BG = ['#8C6CFF', '#FF6A4D', '#5FD39A', '#8EA6FF', '#FFB199'];
/** Până la 3 fețe suprapuse (inițiala, culoarea după username); de la 4, a treia arată „+N”. */
function Faces({ list, ring }: { list: { n: string; u: string }[]; ring: string }) {
  const shown = list.length > 3 ? list.slice(0, 2) : list.slice(0, 3);
  const more = list.length - shown.length;
  const bg = (u: string) => FACE_BG[[...u].reduce((a, c) => a + c.charCodeAt(0), 0) % FACE_BG.length];
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((p, i) => (
        <View key={p.u} style={{ marginLeft: i ? -9 : 0, width: 28, height: 28, borderRadius: 99, borderWidth: 2, borderColor: ring, backgroundColor: bg(p.u), alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontFamily: F.b, fontSize: 12, color: '#0E1440' }}>{p.n.charAt(0).toUpperCase()}</T>
        </View>
      ))}
      {more > 0 ? (
        <View style={{ marginLeft: -9, width: 28, height: 28, borderRadius: 99, borderWidth: 2, borderColor: ring, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontFamily: F.b, fontSize: 11, color: '#0E1440' }}>{'+' + more}</T>
        </View>
      ) : null}
    </View>
  );
}

/** Confetti din jurul lui Bilu când se întoarce: 18 bucăți mereu montate, invizibile până pornește `v` (fir nativ). */
const BITS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const r = 70 + (i % 3) * 28;
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 0.8) - 20, w: 6 + (i % 3) * 2, h: 9 + (i % 4) * 2, c: CONF[i % CONF.length], round: i % 4 === 0, spin: (i % 2 ? 1 : -1) * (300 + i * 20) };
});
function Burst({ v }: { v: Animated.Value }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 42, top: 42, width: 0, height: 0 }}>
      {BITS.map((b, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: -b.w / 2, top: -b.h / 2, width: b.w, height: b.h, borderRadius: b.round ? 99 : 2, backgroundColor: b.c,
          opacity: v.interpolate({ inputRange: [0, 0.02, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx * 1.15] }) },
            { translateY: v.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, b.dy, b.dy + 70] }) },
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', b.spin + 'deg'] }) },
          ],
        }} />
      ))}
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

