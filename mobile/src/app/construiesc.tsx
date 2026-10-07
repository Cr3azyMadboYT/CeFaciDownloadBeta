// "O construiesc eu" (decision Cornel, 06.10): the evening built step by step. They choose what comes next (Mâncare,
// Un pahar, Club, Film…), Bilu shows three places of that kind open from the time it would start and for long enough,
// close to the place before; "Altele" shows three more. Each step can be taken out (with the ones after it). "Gata"
// checks the places on Google, then the evening is a plan like the others: the map, tickets, the vote.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { APP } from '../lib/session';
import { getPlans, runBuilt, whenText, withLive, budgetLabel } from '../lib/planAsk';
import { checkOpen, closedWhy, needsCheck } from '../lib/liveOpen';
import { toast } from '../lib/toast';
import { Icon, type IconName } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, H1, Muted, Press, Say, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { Doodles } from '../ui/Doodles';
import { PARTS } from '../../../src/engine/planner';

type Opt = ReturnType<typeof APP.buildOptions>[number];
const MAX = 4;
const INK = '#0E1440';
// each part of the evening has its colour (the same family as the vibe tiles in Creează plan) and its icon
const COLOR: Record<string, string> = {
  masa: '#FF6A4D', pahar: '#FFD43B', club: '#B7A3FF', film: '#8EA6FF', spectacol: '#F5B3C8',
  desert: '#FFE58A', joaca: '#5FD39A', promenada: '#BFE3A0', cultura: '#FFC48A', gustare: '#FF9F80',
};
const colorOf = (id: string) => COLOR[id] ?? '#FFD43B';
const iconOf = (id: string) => (PARTS.find((p) => p.id === id)?.icon ?? 'star') as IconName;

export default function Construiesc() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const draft = getPlans().draft;
  const [ver, setVer] = useState(0); // the steps changed (they live in APP.built)
  const [part, setPart] = useState<string | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const steps = useMemo(() => APP.buildSteps(), [ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo(() => (steps.length >= MAX ? [] : APP.buildParts()), [ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const options: Opt[] = useMemo(() => (part ? APP.buildOptions(part, shown) : []), [part, shown, ver]);
  const total = steps.reduce((a, x) => a + x.price, 0);
  const minor = APP.built.minor && !APP.isMinor();

  useEffect(() => { if (!APP.built.req) router.replace('/plan-nou'); }, []);
  const back = () => { if (part) { setPart(null); setShown([]); return true; } router.canGoBack() ? router.back() : router.replace('/acasa'); return true; };
  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', back); return () => h.remove(); });

  const choose = (o: Opt) => {
    if (!part || !APP.buildAdd(part, o.place.id)) { toast('Locul nu mai merge la ora asta. Alege altul.'); return; }
    setPart(null); setShown([]); setVer((v) => v + 1);
  };
  const cut = (i: number) => { APP.buildCut(i); setPart(null); setShown([]); setVer((v) => v + 1); };
  const done = async () => {
    if (!steps.length || busy) return;
    setBusy(true);
    // asked on Google before the tickets: a place closed at that hour goes out, with the steps after it
    const ask = APP.built.steps.filter((x) => needsCheck(x.v.k, x.v.cat)).map((x) => ({ id: x.v.id, name: x.v.name, lat: x.v.lat, lon: x.v.lon, at: x.at, until: x.until }));
    const live = await checkOpen(ask);
    setBusy(false);
    const shut = APP.built.steps.findIndex((x) => live[x.v.id]?.open === false);
    if (shut >= 0) {
      const st = APP.built.steps[shut];
      toast(closedWhy(st.v.name, live[st.v.id]) + '. Alege altceva în locul lui.');
      cut(shut);
      return;
    }
    const plan = APP.buildPlan();
    if (!plan) return;
    runBuilt(withLive([plan], live)[0]);
    router.replace({ pathname: '/plan/[i]', params: { i: '0' } });
  };

  const lastStep = steps[steps.length - 1];
  const say = !steps.length
    ? 'Cu ce începem? Îți arăt doar ce e deschis ' + (draft ? whenText(draft).toLowerCase() : 'atunci') + ', aproape de tine.'
    : steps.length >= MAX ? 'Gata, e o seară plină! Apasă „Vezi planul”.' : 'Și după? Îți arăt ce e deschis pe la ' + lastStep.until + ', aproape de ' + lastStep.place.name + '.';
  const pick = (p: (typeof parts)[number]) => {
    if (!p.ok) { toast('Nu e nimic de felul ăsta deschis ' + (lastStep ? 'pe la ' + lastStep.until + ' aproape de ' + lastStep.place.name : 'atunci, aproape de tine') + '.'); return; }
    setPart(part === p.id ? null : p.id); setShown([]);
  };
  const now = parts.find((p) => p.id === part);
  const over = !!draft && draft.budget[1] < 300 && total > draft.budget[1];

  return (
    <View style={{ flex: 1, backgroundColor: t.bgCont }}>
      <Doodles />
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, height: ins.top + 60, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color={t.ink} />
        </Press>
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: F.display, fontSize: 20 }}>Seara ta</T>
          {draft ? <Muted numberOfLines={1}>{whenText(draft) + ' · ' + (draft.people === 1 ? 'doar tu' : draft.people + ' persoane') + ' · ' + budgetLabel(draft.budget)}</Muted> : null}
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Say mood={steps.length ? 'up' : 'hi'} text={say} />
        {minor ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: -4, marginBottom: 12, padding: 10, borderRadius: 14, backgroundColor: t.yellowSoft }}>
            <Icon name="users" size={18} color={t.yellowInk} />
            <T style={{ flex: 1, fontFamily: F.sb, fontSize: 13, color: t.yellowInk }}>În gașcă e cineva sub 18 ani: îți arăt doar locuri unde puteți intra toți.</T>
          </View>
        ) : null}

        {/* the evening so far: a coloured line, one stop for each place */}
        {steps.length ? (
          <View style={{ marginBottom: 6 }}>
            {steps.map((s, i) => {
              const c = colorOf(s.part), last = i === steps.length - 1;
              return (
                <View key={s.place.id}>
                  {i > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 30 }}>
                      <View style={{ width: 48, alignItems: 'center', height: '100%' }}><View style={{ width: 4, flex: 1, borderRadius: 2, backgroundColor: t.line }} /></View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                        <T style={{ fontFamily: F.sb, fontSize: 12, color: t.ink2 }}>{(s.by === 'walk' ? '🚶 ' : s.by === 'bus' ? '🚌 ' : s.by === 'bike' ? '🚲 ' : '🚗 ') + s.travel + ' min până acolo'}</T>
                      </View>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
                    <View style={{ width: 48, alignItems: 'center' }}>
                      <View style={{ width: 48, height: 48, borderRadius: 99, backgroundColor: c, borderWidth: 3, borderColor: t.bgCont, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={iconOf(s.part)} size={22} color={INK} width={2} />
                      </View>
                    </View>
                    <View style={{ flex: 1, borderRadius: 20, backgroundColor: c, padding: 12, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: INK }}>
                            <T style={{ fontFamily: F.b, fontSize: 12, color: '#FFD43B' }}>{s.slot + '–' + s.until}</T>
                          </View>
                          <T numberOfLines={1} style={{ flex: 1, fontFamily: F.sb, fontSize: 12, color: INK, opacity: 0.75 }}>{s.why}</T>
                        </View>
                        <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 17, color: INK }}>{s.place.name}</T>
                        <T numberOfLines={1} style={{ fontFamily: F.m, fontSize: 13, color: INK, opacity: 0.75 }}>{s.place.title + ' · ~' + s.price + ' lei'}</T>
                      </View>
                      <Press onPress={() => cut(i)} accessibilityLabel={'Scoate ' + s.place.name + (!last ? ' și ce e după' : '')} style={{ width: 36, height: 36, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="close" size={16} color={INK} width={2.2} />
                      </Press>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
            <View style={{ flexDirection: 'row' }}>
              {['masa', 'pahar', 'club'].map((id, i) => (
                <View key={id} style={{ width: 34, height: 34, marginLeft: i ? -8 : 0, borderRadius: 99, backgroundColor: colorOf(id), borderWidth: 2, borderColor: t.bgCont, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={iconOf(id)} size={16} color={INK} width={2} />
                </View>
              ))}
            </View>
            <Muted style={{ flex: 1 }}>Seara ta apare aici, loc cu loc. Până la {MAX} opriri.</Muted>
          </View>
        )}

        {/* what comes next: coloured tiles; once one is chosen, a strip of them to switch */}
        {steps.length < MAX ? (
          <View style={{ marginTop: 14 }}>
            <H1 style={{ fontSize: 24, lineHeight: 26 }}>{steps.length ? 'Și după?' : 'Cu ce începem?'}</H1>
            {!part ? (
              <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
                {parts.map((p) => (
                  <Press key={p.id} onPress={() => pick(p)} accessibilityLabel={p.label + (p.ok ? '' : ', nimic deschis atunci')}
                    style={{ width: '48.4%', height: 84, padding: 12, borderRadius: 22, backgroundColor: colorOf(p.id), opacity: p.ok ? 1 : 0.35, justifyContent: 'space-between' }}>
                    <Icon name={p.icon as IconName} size={24} color={INK} width={2} />
                    <T numberOfLines={2} style={{ fontFamily: F.b, fontSize: 15, lineHeight: 18, color: INK }}>{p.label}</T>
                  </Press>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {parts.map((p) => {
                  const on = p.id === part;
                  return (
                    <Press key={p.id} onPress={() => pick(p)} accessibilityState={{ selected: on }} accessibilityLabel={p.label}
                      style={{ minHeight: 42, paddingHorizontal: 14, borderRadius: 99, backgroundColor: colorOf(p.id), opacity: p.ok ? 1 : 0.35, borderWidth: 3, borderColor: on ? INK : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name={p.icon as IconName} size={16} color={INK} width={2} />
                      <T style={{ fontFamily: F.b, fontSize: 14, color: INK }}>{p.label}</T>
                    </Press>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}

        {part ? (
          <View style={{ marginTop: 14, gap: 12 }} onLayout={(e) => { const y = e.nativeEvent.layout.y; setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 120), animated: true }), 30); }}>
            {options.length ? options.map((o, n) => (
              <View key={o.place.id} style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colorOf(part) }}>
                  <Icon name={iconOf(part)} size={18} color={INK} width={2} />
                  <T style={{ flex: 1, fontFamily: F.b, fontSize: 13, color: INK }}>{(n === 0 && !shown.length ? 'Bilu ar alege · ' : '') + (now?.label ?? '')}</T>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: INK }}>
                    <T style={{ fontFamily: F.b, fontSize: 13, color: '#FFD43B' }}>{o.slot + '–' + o.until}</T>
                  </View>
                </View>
                <View style={{ padding: 14, paddingTop: 12, gap: 6 }}>
                  <T style={{ fontFamily: F.b, fontSize: 18 }} numberOfLines={1}>{o.place.name}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[o.place.title, '~' + o.price + ' lei', (o.by === 'walk' ? '🚶 ' : o.by === 'bus' ? '🚌 ' : o.by === 'bike' ? '🚲 ' : '🚗 ') + o.travel + ' min', ...(o.open && o.open !== 'Program necunoscut' ? [o.open] : [])].map((x, j) => (
                      <View key={j} style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: t.s2 }}>
                        <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12, color: t.ink2 }}>{x}</T>
                      </View>
                    ))}
                  </View>
                  {o.place.story || o.reason ? <T numberOfLines={3} style={{ fontFamily: F.m, fontSize: 13, lineHeight: 18, color: t.ink2 }}>{o.place.story ?? o.reason}</T> : null}
                  <Big label="Aleg asta" color="#FFD43B" ink={INK} icon={<Icon name="plus" size={18} color={INK} width={2.4} />} style={{ minHeight: 48, marginTop: 4 }} onPress={() => choose(o)} />
                </View>
              </View>
            )) : (
              <View style={{ padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
                <Muted>Nu mai am altele de felul ăsta deschise atunci, aproape. Încearcă altceva de mai sus.</Muted>
              </View>
            )}
            {options.length ? (
              <Press onPress={() => setShown((x) => [...x, ...options.map((o) => o.place.id)])} accessibilityLabel="Arată-mi altele"
                style={{ minHeight: 46, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colorOf(part), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="dice" size={18} color={t.ink} />
                <T style={{ fontFamily: F.b, fontSize: 15 }}>Arată-mi altele</T>
              </Press>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bgCont, borderTopWidth: 1, borderTopColor: t.line, gap: 8 }}>
        {steps.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row' }}>
              {steps.map((s, i) => <View key={s.place.id} style={{ width: 14, height: 14, marginLeft: i ? -4 : 0, borderRadius: 99, backgroundColor: colorOf(s.part), borderWidth: 2, borderColor: t.bgCont }} />)}
            </View>
            <T style={{ flex: 1, fontFamily: F.sb, fontSize: 13, color: over ? t.coralInk : t.ink2 }}>{steps.length + (steps.length === 1 ? ' loc' : ' locuri') + ' · ~' + total + ' lei de persoană' + (over ? ' (peste buget)' : '')}</T>
          </View>
        ) : null}
        <Big label={busy ? 'Verific pe Google…' : 'Gata, vezi planul'} disabled={!steps.length || busy} color="#FFD43B" ink={INK} onPress={() => void done()} />
      </View>
    </View>
  );
}
