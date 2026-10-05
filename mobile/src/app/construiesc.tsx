// "O construiesc eu" (decision Cornel, 06.10): the evening built step by step. They choose what comes next (Mâncare,
// Un pahar, Club, Film…), Bilu shows three places of that kind open from the time it would start and for long enough,
// close to the place before; "Altele" shows three more. Each step can be taken out (with the ones after it). "Gata"
// checks the places on Google, then the evening is a plan like the others: the map, tickets, the vote.
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { APP } from '../lib/session';
import { getPlans, runBuilt, whenText, withLive, budgetLabel } from '../lib/planAsk';
import { checkOpen, needsCheck } from '../lib/liveOpen';
import { toast } from '../lib/toast';
import { Icon, type IconName } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, Chip, H1, Muted, Press, Say, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { Doodles } from '../ui/Doodles';

type Opt = ReturnType<typeof APP.buildOptions>[number];
const MAX = 4;

export default function Construiesc() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const draft = getPlans().draft;
  const [ver, setVer] = useState(0); // the steps changed (they live in APP.built)
  const [part, setPart] = useState<string | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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
      toast(APP.built.steps[shut].v.name + ' e închis la ora aia (am verificat pe Google). Alege altceva de acolo.');
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Say mood={steps.length ? 'up' : 'hi'} text={say} />
        {minor ? <Muted style={{ marginTop: -4, marginBottom: 10 }}>În gașcă e cineva sub 18 ani: îți arăt doar locuri unde puteți intra toți.</Muted> : null}

        {/* the evening so far */}
        {steps.map((s, i) => (
          <View key={s.place.id}>
            {i > 0 ? <T style={{ marginLeft: 66, marginVertical: 4, fontFamily: F.m, fontSize: 12, color: t.ink2 }}>{(s.by === 'walk' ? '🚶 ' : s.by === 'bus' ? '🚌 ' : s.by === 'bike' ? '🚲 ' : '🚗 ') + s.travel + ' min'}</T> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
              <View style={{ width: 54, alignItems: 'center' }}>
                <T style={{ fontFamily: F.b, fontSize: 15 }}>{s.slot}</T>
                <T style={{ fontFamily: F.m, fontSize: 12, color: t.ink2 }}>{s.until}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontFamily: F.sb, fontSize: 12, color: t.ink2 }}>{s.why}</T>
                <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 16 }}>{s.place.name}</T>
                <Muted numberOfLines={1}>{s.place.title + ' · ~' + s.price + ' lei'}</Muted>
              </View>
              <Press onPress={() => cut(i)} accessibilityLabel={'Scoate ' + s.place.name + (i < steps.length - 1 ? ' și ce e după' : '')} style={{ width: 40, height: 40, borderRadius: 99, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} color={t.ink2} />
              </Press>
            </View>
          </View>
        ))}

        {/* what comes next */}
        {steps.length < MAX ? (
          <View style={{ marginTop: steps.length ? 16 : 4 }}>
            <H1 style={{ fontSize: 24, lineHeight: 26 }}>{steps.length ? 'Și după?' : 'Cu ce începem?'}</H1>
            <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {parts.map((p) => (
                <View key={p.id} style={{ opacity: p.ok ? 1 : 0.4 }}>
                  <Chip label={p.label} icon={p.icon as IconName} on={part === p.id}
                    onPress={() => { if (!p.ok) { toast('Nu e nimic de felul ăsta deschis ' + (lastStep ? 'pe la ' + lastStep.until + ' aproape de ' + lastStep.place.name : 'atunci, aproape de tine') + '.'); return; } setPart(part === p.id ? null : p.id); setShown([]); }} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {part ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            {options.length ? options.map((o) => (
              <View key={o.place.id} style={{ padding: 14, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T style={{ flex: 1, fontFamily: F.b, fontSize: 17 }} numberOfLines={1}>{o.place.name}</T>
                  <T style={{ fontFamily: F.b, fontSize: 14 }}>{o.slot + '–' + o.until}</T>
                </View>
                <Muted numberOfLines={1}>{o.place.title + ' · ~' + o.price + ' lei · ' + (o.by === 'walk' ? '🚶 ' : '🚗 ') + o.travel + ' min' + (o.open && o.open !== 'Program necunoscut' ? ' · ' + o.open : '')}</Muted>
                {o.place.story || o.reason ? <T numberOfLines={3} style={{ fontFamily: F.m, fontSize: 13, lineHeight: 18, color: t.ink2 }}>{o.place.story ?? o.reason}</T> : null}
                <Big label="Aleg asta" color="#0E1440" style={{ minHeight: 44, marginTop: 4 }} onPress={() => choose(o)} />
              </View>
            )) : <Muted>Nu mai am altele de felul ăsta deschise atunci, aproape.</Muted>}
            {options.length ? <Chip label="Altele" icon={'dice' as never} onPress={() => setShown((x) => [...x, ...options.map((o) => o.place.id)])} /> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bgCont, borderTopWidth: 1, borderTopColor: t.line, gap: 8 }}>
        {steps.length ? <T style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{steps.length + (steps.length === 1 ? ' loc' : ' locuri') + ' · ~' + total + ' lei de persoană' + (draft && draft.budget[1] < 300 && total > draft.budget[1] ? ' (peste buget)' : '')}</T> : null}
        <Big label={busy ? 'Verific pe Google…' : 'Gata, vezi planul'} disabled={!steps.length || busy} color="#0E1440" onPress={() => void done()} />
      </View>
    </View>
  );
}
