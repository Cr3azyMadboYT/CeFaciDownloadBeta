// The three plans (decision Cornel, 04.10): not a list but plans ready to go, each with what Bilu checked (open at
// its hour, how far, the budget, the weather) and, when an evening goes over the budget, a cheaper swap. Tap one
// to open it; send all three to the crew to vote; or tell Bilu what else you want.
import { useState } from 'react';
import { Linking, ScrollView, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { setFilters, useFilters } from '../lib/filters';
import { budgetLabel, setPlan, usePlans, whenText, type Shown } from '../lib/planAsk';
import { APP } from '../lib/session';
import { Icon } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, Note, Press, Say, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';
import { VoteStart } from '../ui/VoteStart';
import { Checks, StepRow } from '../ui/PlanBits';

export default function PlanuriGata() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const { draft, plans } = usePlans();
  const [vote, setVote] = useState(false);
  const [q, setQ] = useState('');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));
  if (!draft) return <Redirect href="/acasa" />;
  const people = draft.people;
  const wx = APP.dayWeather(plans[0]?.steps[0].at ?? new Date());
  const ask = (text: string) => { if (text.trim().length > 1) router.push({ pathname: '/spune', params: { q: text.trim() } }); };
  const reserve = (s: Shown['steps'][number]) => {
    const c = s.place.contact;
    if (c?.site) void Linking.openURL(c.site.startsWith('http') ? c.site : 'https://' + c.site);
    else if (c?.phone) void Linking.openURL('tel:' + c.phone.replace(/\s/g, ''));
  };
  const chip = (label: string, step: string) => (
    <Press key={step + label} onPress={() => router.push({ pathname: '/plan-nou', params: { step, edit: '1' } })}
      style={{ height: 32, paddingHorizontal: 11, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, justifyContent: 'center' }}>
      <T style={{ fontFamily: F.sb, fontSize: 13 }}>{label}</T>
    </Press>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
          <View style={{ flex: 1 }}>
            <T accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.display, fontSize: 23 }}>{whenText(draft).replace(/ la \d\d:\d\d$/, '').replace(/,$/, '') + ', ' + (people === 1 ? 'doar tu' : 'pentru ' + people)}</T>
            <T numberOfLines={1} style={{ fontFamily: F.m, fontSize: 13, color: t.ink2 }}>{'din ' + APP.zoneName() + (wx ? ' · ' + wx.temp + '°, ' + wx.text : '')}</T>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {chip(draft.mode === 'seara' ? 'Toată seara' : 'Un loc', 'ce')}
          {chip(whenText(draft), 'cand')}
          {chip(people + (people === 1 ? ' persoană' : ' persoane'), 'cati')}
          {chip(budgetLabel(draft.budget), 'buget')}
          {chip(draft.vibes.length ? draft.vibes.join(' · ') : 'orice vibe', 'vibe')}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <Say mood={plans.length ? 'yay' : 'oops'} text={plans.length ? 'Ți-am făcut ' + (plans.length === 3 ? '3 planuri gata' : plans.length === 1 ? 'un plan' : plans.length + ' planuri') + '. Am verificat programul, vremea și bugetul. ' + (people >= 2 ? 'Alege unul sau trimiteți-le la vot.' : 'Alege unul.') : 'N-am găsit nimic deschis atunci. Schimbă ora, ziua sau bugetul.'} />
          {!plans.length ? <Big label="Schimbă răspunsurile" onPress={() => router.push({ pathname: '/plan-nou', params: { step: 'cand', edit: '1' } })} /> : null}

          {plans.map((p, i) => {
            const first = p.steps[0];
            const big = i === 0;
            return (
              <Press key={p.id + i} onPress={() => router.push({ pathname: '/plan/[i]', params: { i: String(i) } })} haptic={false}
                style={{ marginTop: 12, borderRadius: 24, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
                {big ? (
                  <View style={{ height: 100, backgroundColor: first.place.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={first.place.icon as never} size={44} color={first.place.fg} />
                    <View style={{ position: 'absolute', left: 12, top: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: '#0E1440' }}>
                      <T style={{ fontFamily: F.b, fontSize: 12, color: '#FFD43B' }}>{'1 · ' + p.title}</T>
                    </View>
                  </View>
                ) : null}
                <View style={{ padding: 14 }}>
                  {!big ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: '#FFD43B' }}>{String(i + 1)}</T></View>
                      <T style={{ flex: 1, fontFamily: F.display, fontSize: 18 }}>{p.title}</T>
                      <T style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{p.from + '–' + p.to}</T>
                    </View>
                  ) : null}
                  {big && p.steps.length === 1 ? (
                    <>
                      <T style={{ fontFamily: F.display, fontSize: 23 }}>{first.place.name}</T>
                      <T style={{ fontFamily: F.m, fontSize: 13.5, color: t.ink2 }}>{first.place.title + ' · ' + (first.place.real.street ? first.place.real.street + ', ' : '') + (first.place.real.city || first.place.zone) + ' · ' + p.from + '–' + p.to}</T>
                    </>
                  ) : (
                    <View style={{ gap: 4 }}>
                      {big ? <T style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2, marginBottom: 4 }}>{p.from + '–' + p.to + (p.drive ? ' · cu mașina între locuri' : '')}</T> : null}
                      {p.steps.map((s, k) => (
                        <View key={s.place.id}>
                          {k > 0 ? <T style={{ marginLeft: 58, marginVertical: 2, fontFamily: F.m, fontSize: 12, color: t.ink2 }}>{(p.drive ? '🚗 ' : '🚶 ') + s.travel + ' min'}</T> : null}
                          <StepRow s={s} />
                        </View>
                      ))}
                    </View>
                  )}
                  <Checks plan={p} />
                  {p.tip ? (
                    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: t.yellowSoft }}>
                      <Icon name="sparkle" size={18} color={t.yellowInk} />
                      <T style={{ flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 18 }}>{p.tip.text}</T>
                      <Press onPress={() => setPlan(i, APP.swapPlan(i, p.tip!.step, p.tip!.id))} style={{ minHeight: 36, justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: t.blueInk }}>Schimbă</T></Press>
                    </View>
                  ) : null}
                  {big ? (
                    <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
                      <Big label="Alegem asta" color="#0E1440" style={{ flex: 1, minHeight: 48 }} onPress={() => router.push({ pathname: '/plan/[i]', params: { i: '0' } })} />
                      {p.steps.length === 1 && first.place.contact ? <Big label={first.place.contact.site ? 'Rezervă' : 'Sună'} color={t.s2} ink={t.ink} style={{ minHeight: 48, paddingHorizontal: 18 }} onPress={() => reserve(first)} /> : null}
                    </View>
                  ) : null}
                </View>
              </Press>
            );
          })}

          {plans.length ? (
            <View style={{ marginTop: 18, padding: 14, borderRadius: 22, backgroundColor: '#0E1440', gap: 10 }}>
              <T style={{ fontFamily: F.b, fontSize: 16, color: '#FFFFFF' }}>Mai vrei ceva? Spune-i lui Bilu.</T>
              <TextInput value={q} onChangeText={setQ} placeholder="ex: cu terasă, după 22" placeholderTextColor="#8690C4" returnKeyType="search" onSubmitEditing={() => ask(q)}
                style={{ minHeight: 48, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontFamily: F.sb, fontSize: 16, color: '#0E1440' }} accessibilityLabel="Spune-i lui Bilu ce mai vrei" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {['mai ieftin', 'aproape', 'cu terasă', 'fără fum', 'după 22'].map((x) => (
                  <Press key={x} onPress={() => ask(x)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: '#2B3575', backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' }}>
                    <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>{x}</T>
                  </Press>
                ))}
              </View>
            </View>
          ) : null}
          <Press onPress={() => { setFilters({ who: people <= 1 ? '1' : people === 2 ? '2' : people <= 4 ? '34' : '5', vibes: draft.vibes, budget: draft.budget[1] >= 300 ? 'any' : (draft.budget[0] || '') + '-' + draft.budget[1] }); router.push('/rezultate'); }}
            style={{ marginTop: 12, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontFamily: F.b, fontSize: 15 }}>Vezi toate locurile ›</T>
          </Press>
          {plans.some((p) => p.over) ? <View style={{ marginTop: 10 }}><Note kind="err">Unde scrie „peste buget”, prețurile sunt estimate: poate ieși și mai puțin.</Note></View> : null}
        </View>
      </ScrollView>
      {people >= 2 && plans.length >= 2 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
          <Big label={'Trimite cele ' + plans.length + ' planuri la vot'} color="#FFD43B" ink="#0E1440" icon={<Icon name="users" color="#0E1440" />} onPress={() => setVote(true)} />
        </View>
      ) : null}
      <VoteStart open={vote} onClose={() => setVote(false)} places={[]} f={f}
        routes={plans.map((p) => ({ label: p.title, sub: p.steps.map((s) => s.place.name).join(' → '), price: p.price, from: p.from, steps: p.steps.map((s) => ({ place: s.place, at: s.at, slot: s.slot })) }))} />
      <TopShade />
    </View>
  );
}
