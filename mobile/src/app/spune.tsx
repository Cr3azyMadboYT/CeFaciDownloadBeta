// "Spune-i lui Bilu" (decision Cornel, 04.10): write what else you want, as on WhatsApp — "cu terasă, după 22",
// "mai ieftin", "fără fum", "aproape". Bilu shows what he understood (chips), the places that fit right now, and
// makes the three plans again with it, keeping the other answers.
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { BUDGET_TOP, askOf, runPlans, usePlans, type Draft } from '../lib/planAsk';
import { APP } from '../lib/session';
import { Icon } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, Muted, Press, Say, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';

export default function Spune() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const { draft } = usePlans();
  const [q, setQ] = useState(params.q ?? '');
  const [text, setText] = useState(params.q ?? '');
  const r = useMemo(() => (draft && text.trim().length > 1 ? APP.refine(text, askOf(draft), { evening: new Date().toISOString().slice(0, 10), hour: draft.hour }) : null), [text, draft]);
  const found = useMemo(() => (text.trim().length > 1 ? APP.search(text).slice(0, 4) : []), [text]);
  if (!draft) return <Redirect href="/acasa" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/planuri-gata'));

  const redo = () => {
    if (!r) return;
    const a = r.ask;
    const timed = r.chips.some((c) => /^(La|De la) \d/.test(c));
    let { day, hour } = draft;
    if (timed) {
      const at = new Date(a.at.getTime());
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - today.getTime()) / 864e5);
      day = diff - (at.getHours() < 5 ? 1 : 0); // atOf puts hours before 5 on the next day (-1: the early hours of today)
      hour = String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
    }
    const next: Draft = { ...draft, day, hour, people: a.people, vibes: a.vibes, budget: [a.budget[0], a.budget[1] === Infinity ? BUDGET_TOP : Math.min(BUDGET_TOP, a.budget[1])], extra: { outdoor: a.outdoor, needs: a.needs, near: a.near } };
    runPlans(next, r.chips);
    if (router.canGoBack()) router.back(); else router.replace('/planuri-gata');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 24 }}>Spune-i lui Bilu</T>
        </View>
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => setText(q)} onBlur={() => setText(q)} autoFocus={!params.q} returnKeyType="search" placeholder="ex: cu terasă, după 22" placeholderTextColor={t.ink3}
          style={{ marginTop: 14, minHeight: 54, borderRadius: 16, borderWidth: 2, borderColor: t.blue, backgroundColor: t.s1, paddingHorizontal: 14, fontFamily: F.sb, fontSize: 17, color: t.ink }} accessibilityLabel="Ce mai vrei" />
        <View style={{ marginTop: 14 }}>
          <Say mood={r && r.chips.length ? 'wink' : 'hi'} text={!text.trim() ? 'Scrie-mi ce mai vrei: ora, banii, terasa, fără fum, aproape…' : r && r.chips.length ? 'Am înțeles. Păstrez ce ai ales înainte și adaug:' : 'Nu schimb planurile cu asta, dar uite locurile care se potrivesc.'} />
        </View>
        {r && r.chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {r.chips.map((c) => <View key={c} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 99, backgroundColor: t.ink, justifyContent: 'center' }}><T style={{ fontFamily: F.sb, fontSize: 14, color: t.bg }}>{c}</T></View>)}
          </View>
        ) : null}
        {found.length ? (
          <>
            <T style={{ marginTop: 20, marginBottom: 8, fontFamily: F.display, fontSize: 20 }}>Se potrivesc acum</T>
            {found.map((p) => (
              <View key={p.id} style={{ marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon as never} size={26} color={p.fg} /></View>
                <View style={{ flex: 1 }}>
                  <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 16 }}>{p.name}</T>
                  <Muted numberOfLines={1}>{p.title + ' · ' + (p.real.city || p.zone) + ' · ' + p.km.toFixed(1).replace('.', ',') + ' km · ~' + p.price + ' lei'}</Muted>
                  {APP.reason(p.id) ? <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12.5, color: t.greenInk }}>{'✓ ' + APP.reason(p.id)}</T> : null}
                </View>
              </View>
            ))}
          </>
        ) : null}
        <Muted style={{ marginTop: 10 }}>Bilu înțelege ore („după 22”, „la 8”), bani („mai ieftin”, „sub 50”), nevoi („fără fum”, „wifi”, „cu terasă”, „scaun cu rotile”), „aproape” și tipuri de locuri („club”, „bowling”, „sushi”).</Muted>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.bg }}>
        <Big label="Refă cele 3 planuri cu asta" color="#0E1440" disabled={!r || !r.chips.length} onPress={redo} />
      </View>
    </View>
  );
}
