// "Creează plan" (decision Cornel, 04.10): one question per screen, Bilu says what each one is for — un loc sau toată
// seara, când (any day of the week, with its weather), câți sunteți, bugetul (a bar with two dots), ce vibe. A tap
// on a single-choice answer goes on by itself; "Arată-mi acum" skips the rest. Under each question: the places
// that fit so far.
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { listCrews, type Crew } from '../lib/crews';
import { BUDGET_TOP, askOf, budgetLabel, dayCard, eveningsFrom, firstDraft, getPlans, hourFor, hoursFor, runPlans, wholeLabel, whenText, type Draft } from '../lib/planAsk';
import { addDays, momentOf } from '../../../src/engine/time';
import { APP, useApp } from '../lib/session';
import { useWeatherVersion } from '../lib/weather';
import { Icon, type IconName } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, Chip, H1, Lbl, Muted, Press, Say, Sheet, T, tap } from '../ui/kit';
import { RangeSlider } from '../ui/RangeSlider';
import { F, useTheme } from '../ui/theme';
import type { Mood } from '../ui/Bilu';

const STEPS = ['ce', 'cand', 'cati', 'buget', 'vibe'] as const;
type Step = (typeof STEPS)[number];
const VIBE_TILES: [string, IconName, string][] = [
  ['Mâncare bună', 'burger', '#FF6A4D'], ['Party', 'club', '#FFD43B'], ['Chill', 'coffee', '#B7A3FF'], ['Fun', 'dice', '#8EA6FF'],
  ['Competitiv', 'target', '#5FD39A'], ['Cultură', 'landmark', '#F5B3C8'], ['Aer liber', 'tree', '#BFE3A0'],
];
const QUICK: [string, [number, number]][] = [['Gratis', [0, 0]], ['Ieftin, până în 50', [0, 50]], ['Normal', [30, 120]], ['Oricât', [0, BUDGET_TOP]]];

export default function PlanNou() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const wxv = useWeatherVersion();
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const params = useLocalSearchParams<{ step?: string; edit?: string }>();
  // from the plans' chips ("✎"): the answers on screen, to change one; else last time's, for today
  const [d, setD] = useState<Draft>(() => (params.edit && getPlans().draft ? getPlans().draft! : firstDraft()));
  const [k, setK] = useState(() => Math.max(0, STEPS.indexOf((params.step as Step) ?? 'ce')));
  const step = STEPS[k];
  const [more, setMore] = useState(false);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  useEffect(() => { if (who && known) void listCrews(who.id).then((c) => setCrews(c.filter((x) => x.mine === 'member'))); }, [who, known]);
  // the places that fit so far, worked out just after each answer so the tap stays instant
  useEffect(() => { const id = setTimeout(() => setNames(APP.preview(askOf(d))), 60); return () => clearTimeout(id); }, [d, wxv]);

  // changing one answer from the plans screen: back to it; else on to it
  const finish = (x = d) => { void runPlans(x); if (params.edit && router.canGoBack()) router.back(); else router.replace('/planuri-gata'); };
  const next = (x = d) => { if (k >= STEPS.length - 1) finish(x); else setK(k + 1); };
  const auto = (p: Partial<Draft>) => { const x = { ...d, ...p }; setD(x); setTimeout(() => next(x), 220); };
  const back = () => (k > 0 ? setK(k - 1) : router.canGoBack() ? router.back() : router.replace('/acasa'));
  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => h.remove(); });

  // the weather on each day at the chosen hour, and the warmest nice day of the week
  const now = new Date();
  const evenings = useMemo(() => eveningsFrom(now), [now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = useMemo(() => evenings.map((e) => ({ e, wx: APP.dayWeather(momentOf(e, hourFor(e, d.hour, now) === 'acum' ? '20:00' : hourFor(e, d.hour, now))) })), [evenings, d.hour, wxv]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = days.filter((x, i) => i > 0 && x.wx?.nice).sort((a, b) => b.wx!.temp - a.wx!.temp)[0]?.e;
  const nowWx = APP.dayWeather(now);
  const rows = d.hour === 'acum' ? [] : hoursFor(d.evening, now);
  const pickDay = (e: string) => set({ evening: e, hour: hourFor(e, d.hour, now) });

  const say: Record<Step, [Mood, string]> = {
    ce: ['hi', 'Hai să-ți fac planul! Întâi: vrei un singur loc sau toată seara, pas cu pas?'],
    cand: ['up', 'Acum sau altă zi? Lângă fiecare zi îți pun vremea' + (best ? ': cea mai frumoasă e ' + dayCard(best, now).word.toLowerCase() + '.' : '.')],
    cati: ['wink', 'Câți sunteți, cu tot cu tine? Sau alege gașca și știu singur.'],
    buget: ['up', 'Cât vrea să dea fiecare' + (d.mode === 'seara' ? ', pe toată seara' : '') + '? Trage de bulinele de pe bară.'],
    vibe: ['hi', 'Ultima: ce chef aveți? Alege câte vrei.'],
  };

  const wxIcon = (i: string) => (i === 'sun' || i === 'moon' || i === 'cloud' || i === 'rain' || i === 'snow' || i === 'storm' ? (i as IconName) : 'cloud');
  const DayCard = ({ label, sub, on, wx, badge, onPress }: { label: string; sub: string; on: boolean; wx: ReturnType<typeof APP.dayWeather>; badge?: string; onPress: () => void }) => (
    <Press onPress={onPress} accessibilityState={{ selected: on }} accessibilityLabel={label + ', ' + sub + (wx ? ', ' + wx.temp + ' grade, ' + wx.text : '')}
      style={{ width: '23.5%', minHeight: 104, paddingVertical: 8, borderRadius: 18, borderWidth: 2, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {badge ? <View style={{ position: 'absolute', top: -10, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, backgroundColor: '#FFD43B' }}><T style={{ fontFamily: F.b, fontSize: 10, color: '#0E1440' }}>{badge}</T></View> : null}
      <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ paddingHorizontal: 4, fontFamily: F.b, fontSize: 14, color: on ? t.bg : t.ink }}>{label}</T>
      <T style={{ fontFamily: F.m, fontSize: 11, color: on ? t.bg : t.ink2 }}>{sub}</T>
      {wx ? <><Icon name={wxIcon(wx.icon)} size={22} color={on ? '#FFD43B' : wx.wet ? t.blue : '#E0A800'} /><T style={{ fontFamily: F.display, fontSize: 16, color: on ? t.bg : t.ink }}>{wx.temp + '°'}</T></> : <T style={{ fontFamily: F.m, fontSize: 11, color: on ? t.bg : t.ink3 }}>fără prognoză</T>}
    </Press>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bgCont }}>
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, height: ins.top + 60, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Press onPress={back} accessibilityLabel={k ? 'Înapoi' : 'Închide'} style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={k ? 'back' : 'close'} color={t.ink} />
        </Press>
        <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
          {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: i <= k ? t.blue : t.s3 }} />)}
        </View>
        <Press onPress={() => finish()} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 4 }}><T style={{ fontFamily: F.b, fontSize: 14, color: t.blueInk }}>Arată-mi acum</T></Press>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Say mood={say[step][0]} text={say[step][1]} />

        {step === 'ce' ? (
          <View style={{ gap: 12 }}>
            <H1 style={{ fontSize: 32, lineHeight: 33 }}>Ce plan vrei?</H1>
            {([['loc', 'Un singur loc', 'Un restaurant, un bar, un film… unul și gata.', 'pin', '#FFD43B'], ['seara', wholeLabel(d), 'Mai multe locuri pe rând, cu ore și drum.', 'sparkle', '#2F5BFF']] as const).map(([key, title, sub, icon, bg]) => {
              const on = d.mode === key;
              return (
                <Press key={key} onPress={() => auto({ mode: key })} accessibilityState={{ selected: on }}
                  style={{ padding: 16, borderRadius: 24, borderWidth: 2, borderColor: on ? t.ink : t.line, backgroundColor: on ? '#0E1440' : t.s1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={28} color={key === 'loc' ? '#0E1440' : '#FFD43B'} /></View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={{ fontFamily: F.display, fontSize: 22, color: on ? '#FFFFFF' : t.ink }}>{title}</T>
                    <T style={{ fontFamily: F.m, fontSize: 14, lineHeight: 19, color: on ? '#C9CEE6' : t.ink2 }}>{sub}</T>
                  </View>
                  {on ? <View style={{ width: 28, height: 28, borderRadius: 99, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={16} color="#0E1440" width={3} /></View> : null}
                </Press>
              );
            })}
          </View>
        ) : null}

        {step === 'cand' ? (
          <View>
            <H1 style={{ fontSize: 32, lineHeight: 33 }}>Când ieșiți?</H1>
            <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 14 }}>
              <DayCard label="Acum" sub={String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')} on={d.hour === 'acum'} wx={nowWx} onPress={() => auto({ evening: evenings[0], hour: 'acum' })} />
              {days.map(({ e, wx }) => {
                const c = dayCard(e, now, d.hour === 'acum' ? undefined : d.hour);
                return <DayCard key={e} label={c.word} sub={c.date.replace(/ \S+$/, '')} on={d.hour !== 'acum' && d.evening === e} wx={wx} badge={best === e ? 'cea mai caldă' : undefined} onPress={() => pickDay(e)} />;
              })}
            </View>
            <Press onPress={() => setMore(true)} style={{ marginTop: 10, minHeight: 46, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <Icon name="calendar" size={18} color={t.blueInk} /><T style={{ fontFamily: F.b, fontSize: 14, color: t.blueInk }}>{d.hour !== 'acum' && !evenings.includes(d.evening) ? whenText(d) : 'Altă dată, din calendar'}</T>
            </Press>
            {rows.map(([part, hs]) => (
              <View key={part}>
                <Lbl style={{ marginTop: 16, marginBottom: 8 }}>{part}</Lbl>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {hs.map((h) => <Chip key={h} label={h} on={d.hour === h} onPress={() => auto({ hour: h })} />)}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {step === 'cati' ? (
          <View>
            <H1 style={{ fontSize: 32, lineHeight: 33 }}>Câți sunteți?</H1>
            <View style={{ marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const on = n === 6 ? d.people >= 6 : d.people === n && !d.crewId;
                return (
                  <View key={n} style={{ alignItems: 'center', gap: 6 }}>
                    <Press onPress={() => (n === 6 ? set({ people: Math.max(6, d.people), crewId: undefined, crewName: undefined }) : auto({ people: n, crewId: undefined, crewName: undefined }))} accessibilityLabel={n === 6 ? '6 sau mai mulți' : n + (n === 1 ? ', singur' : ' persoane')} accessibilityState={{ selected: on }}
                      style={{ width: 52, height: 52, borderRadius: 99, borderWidth: 2, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, alignItems: 'center', justifyContent: 'center' }}>
                      <T style={{ fontFamily: F.display, fontSize: n === 6 ? 18 : 22, color: on ? t.bg : t.ink }}>{n === 6 ? '6+' : String(n)}</T>
                    </Press>
                    <T style={{ fontFamily: F.sb, fontSize: 11, color: t.ink2 }}>{n === 1 ? 'Singur' : n === 2 ? 'În doi' : n === 6 ? 'Mulți' : ' '}</T>
                  </View>
                );
              })}
            </View>
            {d.people >= 6 ? (
              <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                <T style={{ flex: 1, fontFamily: F.m, fontSize: 14, color: t.ink2 }}>Câți sunteți, cu tot cu tine?</T>
                <Press onPress={() => set({ people: Math.max(6, d.people - 1) })} accessibilityLabel="Mai puțini" style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 22 }}>−</T></Press>
                <T style={{ width: 36, textAlign: 'center', fontFamily: F.display, fontSize: 22 }}>{String(d.people)}</T>
                <Press onPress={() => set({ people: Math.min(40, d.people + 1) })} accessibilityLabel="Mai mulți" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 22, color: '#FFFFFF' }}>+</T></Press>
              </View>
            ) : null}
            {crews.length ? (
              <>
                <Lbl style={{ marginTop: 22, marginBottom: 8 }}>Sau alege gașca</Lbl>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {crews.map((c) => {
                    const n = Math.max(2, c.members.filter((m) => m.status === 'member').length);
                    return <Chip key={c.id} label={c.name + ' · ' + n} on={d.crewId === c.id} onPress={() => auto({ people: n, crewId: c.id, crewName: c.name })} />;
                  })}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {step === 'buget' ? (
          <View>
            <H1 style={{ fontSize: 32, lineHeight: 33 }}>Buget de persoană</H1>
            <T style={{ marginTop: 18, textAlign: 'center', fontFamily: F.display, fontSize: 44, lineHeight: 48 }}>
              {d.budget[1] >= BUDGET_TOP ? (d.budget[0] ? 'de la ' + d.budget[0] : 'Oricât') : d.budget[1] === 0 ? 'Gratis' : d.budget[0] + ' – ' + d.budget[1]}
              {d.budget[1] > 0 && !(d.budget[1] >= BUDGET_TOP && !d.budget[0]) ? <T style={{ fontFamily: F.b, fontSize: 20 }}> lei</T> : null}
            </T>
            <View style={{ marginTop: 16 }}>
              <RangeSlider min={0} max={BUDGET_TOP} step={10} value={d.budget} onChange={(b) => set({ budget: b })} label={(v) => (v >= BUDGET_TOP ? 'oricât' : v + ' lei')} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                {['Gratis', '50', '100', '150', '200', '250', '300+'].map((x) => <T key={x} style={{ fontFamily: F.sb, fontSize: 12, color: t.ink2 }}>{x}</T>)}
              </View>
            </View>
            <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {QUICK.map(([label, b]) => <Chip key={label} label={label} on={d.budget[0] === b[0] && d.budget[1] === b[1]} onPress={() => { tap(); set({ budget: b }); }} />)}
            </View>
            <Muted style={{ marginTop: 14 }}>{(d.mode === 'seara' ? 'E pentru toată seara, cu toate locurile. ' : '') + 'Prețurile sunt estimate, după tipul localului. Cu bonurile voastre devin prețuri reale.'}</Muted>
          </View>
        ) : null}

        {step === 'vibe' ? (
          <View>
            <H1 style={{ fontSize: 32, lineHeight: 33 }}>Ce chef aveți?</H1>
            <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {VIBE_TILES.map(([v, icon, bg]) => {
                const on = d.vibes.includes(v);
                return (
                  <Press key={v} onPress={() => set({ vibes: on ? d.vibes.filter((x) => x !== v) : [...d.vibes, v] })} accessibilityState={{ selected: on }} accessibilityLabel={v}
                    style={{ width: '48.4%', height: 88, padding: 12, borderRadius: 22, backgroundColor: bg, borderWidth: 3, borderColor: on ? '#0E1440' : 'transparent', justifyContent: 'space-between' }}>
                    <Icon name={icon} size={26} color="#0E1440" />
                    <T style={{ fontFamily: F.b, fontSize: 16, color: '#0E1440' }}>{v}</T>
                    {on ? <View style={{ position: 'absolute', right: 10, top: 10, width: 24, height: 24, borderRadius: 99, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={14} color="#FFD43B" width={3} /></View> : null}
                  </Press>
                );
              })}
              <Press onPress={() => set({ vibes: [] })} accessibilityState={{ selected: !d.vibes.length }}
                style={{ width: '48.4%', height: 88, padding: 12, borderRadius: 22, backgroundColor: t.s1, borderWidth: d.vibes.length ? 1.5 : 3, borderStyle: d.vibes.length ? 'dashed' : 'solid', borderColor: d.vibes.length ? t.line : t.ink, justifyContent: 'space-between' }}>
                <Icon name="dice" size={26} color={t.ink} />
                <T style={{ fontFamily: F.b, fontSize: 15 }}>Orice, surprinde-mă</T>
              </Press>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bgCont, borderTopWidth: 1, borderTopColor: t.line, gap: 10 }}>
        <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>
          {(step === 'cand' ? whenText(d) + ' · ' : step === 'buget' ? budgetLabel(d.budget) + ' · ' : '') + (names.length ? 'Se potrivesc: ' : 'Caut…')}
          <T style={{ fontFamily: F.b, fontSize: 13 }}>{names.join(' · ')}</T>
        </T>
        <Big label={k === STEPS.length - 1 ? 'Gata, fă-mi planul' : 'Mai departe'} color={k === STEPS.length - 1 ? '#0E1440' : undefined} onPress={() => next()} />
      </View>

      <Sheet open={more} onClose={() => setMore(false)}>
        <H1 style={{ fontSize: 26 }}>Altă zi</H1>
        <Muted style={{ marginTop: 6 }}>Pentru zilele de după o săptămână nu am încă vremea.</Muted>
        <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: 24 }, (_, i) => addDays(evenings[0], i + 7)).map((e) => { const c = dayCard(e, now); return <Chip key={e} small label={c.date} on={d.evening === e && d.hour !== 'acum'} onPress={() => { set({ evening: e, hour: hourFor(e, d.hour === 'acum' ? '20:00' : d.hour, now) }); setMore(false); }} />; })}
        </View>
      </Sheet>
    </View>
  );
}
