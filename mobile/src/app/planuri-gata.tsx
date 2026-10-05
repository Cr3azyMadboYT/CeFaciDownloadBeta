// The three plans (decision Cornel, 04.10): plans ready to go, each with what Bilu checked (open at its hour, how
// far, the budget, the weather). Rethought to be quick (04.10 seara): Bilu checks on screen while they are made;
// "Facem așa" is on each card (the card itself opens the map and the steps); "Mai vrei ceva?" changes the plans right
// here, without another screen; when there is nothing, Bilu says why and offers the change in one tap.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { setFilters, useFilters } from '../lib/filters';
import { BUDGET_TOP, askOf, budgetLabel, refreshIfStale, runPlans, setPlan, usePlans, wholeLabel, whenText, type Draft, type Shown } from '../lib/planAsk';
import { createPlanAt, type Plan } from '../lib/plans';
import { sharePlan } from '../lib/together';
import { getApp } from '../lib/session';
import { APP } from '../lib/session';
import { toast } from '../lib/toast';
import { addDays, eveningOf } from '../../../src/engine/time';
import { Icon } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, Note, Press, Say, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';
import { VoteStart } from '../ui/VoteStart';
import { Checks, StepRow } from '../ui/PlanBits';
import { Doodles } from '../ui/Doodles';

/** Makes the tickets for a plan (every step) and opens the first one. With a crew chosen at "Câți sunteți?", the plan
 *  goes to the crew too (Vin / Nu pot), so that after the outing everyone's vote teaches the crew. */
export function makeTickets(p: Shown, people: number, crew?: { id: string; name: string }) {
  const route = p.steps.length > 1 ? 'r' + Date.now() : undefined;
  const pids = p.steps.map((s) => createPlanAt(s.place.id, s.at, people, route ? { route } : {}));
  const me = getApp().who?.id;
  if (crew && me) {
    void (async () => {
      for (const pid of pids) {
        const pl = ((getApp().board.plans as Plan[] | undefined) ?? []).find((x) => x.pid === pid);
        if (pl) { const err = await sharePlan(pl, me, { crewId: crew.id }); if (err) { toast(err); return; } }
      }
      toast('Am trimis planul gășcii ' + crew.name + ': fiecare răspunde Vin sau Nu pot.');
    })();
  }
  toast(p.steps.length > 1 ? 'Gata! Seara e în Planuri, cu un bilet pentru fiecare loc.' : 'Gata! Planul e în Planuri.');
  router.replace({ pathname: '/bilet/[pid]', params: { pid: String(pids[0]) } });
}

export function Checking({ draft }: { draft: Draft }) {
  const { t } = useTheme();
  const when = askOf(draft).now ? 'acum' : whenText(draft).toLowerCase();
  return (
    <View style={{ marginTop: 18, padding: 16, borderRadius: 22, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={t.blue} />
        <T style={{ fontFamily: F.b, fontSize: 16 }}>Bilu verifică…</T>
      </View>
      {['Ce e deschis ' + when, 'Drumul și cât stați în fiecare loc', 'Bugetul și vremea'].map((x) => (
        <T key={x} style={{ fontFamily: F.m, fontSize: 14, color: t.ink2 }}>{'· ' + x}</T>
      ))}
    </View>
  );
}

export default function PlanuriGata() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const st = usePlans();
  const { draft, plans, loading } = st;
  const [vote, setVote] = useState(false);
  const [q, setQ] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { refreshIfStale(); }, []));
  useEffect(() => { const id = setInterval(() => refreshIfStale(), 60e3); return () => clearInterval(id); }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));
  if (!draft) return <Redirect href="/acasa" />;
  const people = draft.people;
  const wx = APP.dayWeather(plans[0]?.steps[0].at ?? askOf(draft).at);
  const redo = (p: Partial<Draft>, chips: string[] = st.chips) => { setSaid(null); void runPlans({ ...draft, ...p }, { chips, save: true }); };

  // "Mai vrei ceva?": the words change the plans right here
  const tell = (text: string) => {
    if (text.trim().length < 2) return;
    const r = APP.refine(text, askOf(draft), { evening: draft.evening, hour: askOf(draft).now ? 'acum' : draft.hour });
    if (!r.chips.length) { setSaid('Nu m-am prins. Încearcă „mai ieftin”, „aproape”, „cu terasă”, „fără fum” sau o oră („la 22”).'); return; }
    const a = r.ask;
    setQ('');
    redo({ evening: r.slot.evening, hour: r.slot.hour, people: a.people, ...(a.people !== draft.people ? { crewId: undefined, crewName: undefined } : {}), vibes: a.vibes, budget: [a.budget[0], a.budget[1] === Infinity ? BUDGET_TOP : Math.min(BUDGET_TOP, a.budget[1])], extra: { outdoor: a.outdoor, needs: a.needs, near: a.near } }, [...st.chips, ...r.chips]);
  };
  const footer = !loading && people >= 2 && plans.length >= 2; // „Trimite la vot” at the bottom
  const late = askOf(draft).at.getHours();
  const quick = [draft.budget[1] > 30 ? 'mai ieftin' : null, 'mai aproape', 'cu terasă', 'fără fum', late < 21 && late >= 10 ? 'după 22' : null].filter(Boolean) as string[];
  const chip = (label: string, step: string) => (
    <Press key={step + label} onPress={() => router.push({ pathname: '/plan-nou', params: { step, edit: '1' } })}
      style={{ height: 32, paddingHorizontal: 11, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, justifyContent: 'center' }}>
      <T style={{ fontFamily: F.sb, fontSize: 13 }}>{label}</T>
    </Press>
  );
  const e0 = eveningOf(new Date());
  const bilu = loading ? '' : plans.length
    ? (plans.length === 1 ? 'Ți-am făcut un plan.' : 'Ți-am făcut ' + plans.length + ' planuri gata.') + ' ' + (st.note ?? 'Le-am verificat: deschis, drum, buget, vreme.') + (people >= 2 && plans.length > 1 ? ' Alegeți unul sau votați.' : '')
    : st.empty ?? 'N-am găsit nimic deschis atunci.';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingBottom: footer ? 24 : ins.bottom + 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
          <View style={{ flex: 1 }}>
            <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.display, fontSize: 23 }}>{(askOf(draft).now ? 'Acum' : whenText(draft)) + ', ' + (people === 1 ? 'doar tu' : 'pentru ' + people)}</T>
            <T numberOfLines={1} style={{ fontFamily: F.m, fontSize: 13, color: t.ink2 }}>{'din ' + APP.zoneName() + (wx ? ' · ' + wx.temp + '°, ' + wx.text : '')}</T>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {chip(draft.mode === 'seara' ? wholeLabel(draft) : 'Un loc', 'ce')}
          {chip(askOf(draft).now ? 'Acum' : whenText(draft), 'cand')}
          {chip((draft.crewId ? 'Gașca ' + (draft.crewName ?? 'voastră') + ' · ' : '') + people + (people === 1 ? ' persoană' : ' persoane'), 'cati')}
          {chip(budgetLabel(draft.budget), 'buget')}
          {chip(draft.vibes.length ? draft.vibes.join(' · ') : 'orice vibe', 'vibe')}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          {loading ? <Checking draft={draft} /> : <Say mood={plans.length ? 'yay' : 'oops'} text={bilu} />}
          {!loading && st.notice ? (
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: t.yellowSoft }}>
              <T style={{ flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 18 }}>{st.notice.text}</T>
              {st.notice.label && st.notice.patch ? <Press onPress={() => redo(st.notice!.patch!)} style={{ minHeight: 36, justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: t.blueInk }}>{st.notice.label}</T></Press> : null}
            </View>
          ) : null}
          {!loading && st.wider && !draft.strict ? (
            <Press onPress={() => redo({ strict: true })} style={{ marginTop: 6, minHeight: 40, justifyContent: 'center' }}>
              <T style={{ fontFamily: F.b, fontSize: 13, color: t.blueInk }}>{'Nu, vreau doar până la ' + APP.radiusKm() + ' km'}</T>
            </Press>
          ) : null}
          {!loading && !plans.length ? (
            <View style={{ marginTop: 6, gap: 8 }}>
              {(() => { const h = new Date().getHours(); const tom = h >= 19 || h < 5; return <Big label={(tom ? 'Mâine' : 'Diseară') + ' la 20:00'} color="#0E1440" onPress={() => redo({ evening: tom ? addDays(eveningOf(new Date()), h < 5 ? 0 : 1) : e0, hour: '20:00' })} />; })()}
              <Big label="Altă zi sau oră" color={t.s2} ink={t.ink} onPress={() => router.push({ pathname: '/plan-nou', params: { step: 'cand', edit: '1' } })} />
            </View>
          ) : null}

          {!loading && plans.map((p, i) => (
            <Press key={p.id + i} onPress={() => router.push({ pathname: '/plan/[i]', params: { i: String(i) } })} haptic={false} accessibilityLabel={'Planul ' + (i + 1) + ': ' + p.title}
              style={{ marginTop: 12, borderRadius: 24, backgroundColor: t.s1, borderWidth: i === 0 ? 2 : 1, borderColor: i === 0 ? t.ink : t.line, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: '#FFD43B' }}>{String(i + 1)}</T></View>
                <T style={{ flex: 1, fontFamily: F.display, fontSize: 18 }}>{p.title}</T>
                <T style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{p.from + '–' + p.to}</T>
              </View>
              <View style={{ gap: 4 }}>
                {p.steps.map((s, k) => (
                  <View key={s.place.id}>
                    {k > 0 ? <T style={{ marginLeft: 58, marginVertical: 2, fontFamily: F.m, fontSize: 12, color: t.ink2 }}>{(s.by === 'car' ? '🚗 ' : s.by === 'bus' ? '🚌 ' : s.by === 'bike' ? '🚲 ' : '🚶 ') + s.travel + ' min'}</T> : null}
                    <StepRow s={s} />
                    {p.steps.length === 1 && s.place.story ? <T numberOfLines={2} style={{ marginLeft: 58, marginTop: 4, fontFamily: F.m, fontSize: 13, lineHeight: 18, color: t.ink2 }}>{s.place.story}</T> : null}
                  </View>
                ))}
              </View>
              <Checks plan={p} />
              {p.tip ? (
                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: t.yellowSoft }}>
                  <Icon name="sparkle" size={18} color={t.yellowInk} />
                  <T style={{ flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 18 }}>{p.tip.text}</T>
                  <Press onPress={() => setPlan(i, APP.swapPlan(i, p.tip!.step, p.tip!.id))} style={{ minHeight: 36, justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: t.blueInk }}>Schimbă</T></Press>
                </View>
              ) : null}
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                <Big label="Facem așa" color={i === 0 ? '#FFD43B' : t.s2} ink="#0E1440" style={{ flex: 1, minHeight: 46 }} onPress={() => makeTickets(p, people, draft.crewId ? { id: draft.crewId, name: draft.crewName ?? 'voastră' } : undefined)} />
                <Big label="Vezi pe hartă" color={t.bg} ink={t.ink} style={{ minHeight: 46, paddingHorizontal: 14 }} onPress={() => router.push({ pathname: '/plan/[i]', params: { i: String(i) } })} />
              </View>
            </Press>
          ))}

          {!loading ? (
            <View style={{ marginTop: 18, padding: 14, borderRadius: 22, backgroundColor: '#0E1440', gap: 10 }}>
              <T style={{ fontFamily: F.b, fontSize: 16, color: '#FFFFFF' }}>Mai vrei ceva? Spune-i lui Bilu.</T>
              <TextInput value={q} onChangeText={setQ} placeholder="ex: cu terasă, mai ieftin, la 22" placeholderTextColor="#8690C4" returnKeyType="done" onSubmitEditing={() => tell(q)}
                style={{ minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontFamily: F.sb, fontSize: 16, color: '#0E1440' }} accessibilityLabel="Spune-i lui Bilu ce mai vrei" />
              {said ? <T style={{ fontFamily: F.m, fontSize: 13, color: '#FFD43B' }}>{said}</T> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {quick.map((x) => (
                  <Press key={x} onPress={() => tell(x)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: '#2B3575', backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' }}>
                    <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>{x}</T>
                  </Press>
                ))}
              </View>
              {st.chips.length ? <T style={{ fontFamily: F.m, fontSize: 12, color: '#C9CEE6' }}>{'Am ținut cont de: ' + st.chips.join(', ')}</T> : null}
            </View>
          ) : null}
          {!loading ? (
            <Press onPress={() => { setFilters({ who: people <= 1 ? '1' : people === 2 ? '2' : people <= 4 ? '34' : '5', vibes: draft.vibes, budget: draft.budget[1] >= BUDGET_TOP ? 'any' : (draft.budget[0] || '') + '-' + draft.budget[1] }); router.push('/exploreaza'); }}
              style={{ marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontFamily: F.sb, fontSize: 14, color: t.blueInk }}>Vreau să caut singur printre toate locurile ›</T>
            </Press>
          ) : null}
          {!loading && plans.some((p) => p.over) ? <View style={{ marginTop: 6 }}><Note kind="err">Unde scrie „peste buget”, prețurile sunt estimate: poate ieși și mai puțin.</Note></View> : null}
        </View>
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
          <Big label={'Trimite cele ' + plans.length + ' planuri la vot'} color="#0E1440" icon={<Icon name="users" color="#FFFFFF" />} onPress={() => setVote(true)} />
        </View>
      ) : null}
      <VoteStart open={vote} onClose={() => setVote(false)} places={[]} f={f}
        routes={plans.map((p) => ({ label: p.title, sub: p.steps.map((s) => s.place.name).join(' → '), price: p.price, from: p.from, steps: p.steps.map((s) => ({ place: s.place, at: s.at, slot: s.slot })) }))} />
      <TopShade />
    </View>
  );
}
