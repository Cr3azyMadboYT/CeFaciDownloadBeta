// "Seara completă": a whole evening, step by step — dinner, then a bar a short walk away, then a club — with times,
// the walk between places and what it costs. Pick a kind of evening, ask for another variant, make it a plan (a
// ticket for every step) or send it to the crew to vote.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { APP } from '../lib/session';
import { WHEN, WHO, setFilters, useFilters } from '../lib/filters';
import { createPlanAt } from '../lib/plans';
import { toast } from '../lib/toast';
import { useWeatherVersion } from '../lib/weather';
import { Icon } from '../ui/Icon';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, H1, Muted, Note, Press, Seg, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';
import { VoteStart } from '../ui/VoteStart';

type Evening = ReturnType<typeof APP.evenings>[number];
const WALK = 'M13 4a2 2 0 1 0 0-.01M10 22l2-7 3 3v6M8 12l2-4 4 1 3 4M7 22l3-9';
const CAR = 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-5l2-5h14l2 5v5M3 12h18';

export default function Seara() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const wxv = useWeatherVersion();
  const [skip, setSkip] = useState<Record<string, number>>({});
  const [list, setList] = useState<Evening[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [vote, setVote] = useState(false);
  // the routes are worked out just after the screen shows, so it opens at once
  useEffect(() => {
    setList(null);
    const k = setTimeout(() => setList(APP.evenings(f, skip)), 30);
    return () => clearTimeout(k);
  }, [f, skip, wxv]);
  const r = useMemo(() => (list ? list.find((x) => x.id === sel) ?? list[0] : undefined), [list, sel]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));

  const make = () => {
    if (!r) return;
    const route = 'r' + Date.now();
    const n = WHO[f.who]?.n ?? 2;
    r.steps.forEach((s) => createPlanAt(s.place.id, s.at, n, { route }));
    toast('Gata! Seara e în Planuri, cu un bilet pentru fiecare loc.');
    router.push('/planuri');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <H1 style={{ fontSize: 36, lineHeight: 37 }}>Seara completă</H1>
        <Muted style={{ marginTop: 4, fontSize: 14 }}>{WHO[f.who].text + ' · din ' + APP.zoneName() + ' · locuri deschise la ora fiecăruia'}</Muted>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 6 }}>
          {Object.entries(WHEN).map(([k, w]) => <Seg key={k} label={w.label} on={f.when === k} onPress={() => setFilters({ when: k })} />)}
        </View>

        {list === null ? <Muted style={{ marginTop: 20 }}>Îți potrivesc seara…</Muted> : !list.length || !r ? (
          <View style={{ marginTop: 20, gap: 10 }}>
            <Note kind="err">{f.when === 'now' ? 'E cam târziu pentru o seară întreagă. Încearcă „Mâine” sau „Weekend”.' : 'N-am găsit o seară întreagă cu filtrele tale. Mărește distanța sau bugetul din Filtre.'}</Note>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {list.map((x) => {
                const on = x.id === r.id;
                return (
                  <Press key={x.id} onPress={() => setSel(x.id)} accessibilityState={{ selected: on }}
                    style={{ width: 168, padding: 12, gap: 4, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? t.blue : t.line, backgroundColor: on ? t.blueSoft : t.s1 }}>
                    <T style={{ fontFamily: F.b, fontSize: 15 }}>{x.label}</T>
                    <Muted numberOfLines={2}>{x.sub}</Muted>
                    <T style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{x.from + '–' + x.to + ' · ~' + x.price + ' lei'}</T>
                  </Press>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 18 }}>
              {r.steps.map((s, i) => (
                <View key={s.place.id}>
                  {i > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingLeft: 22 }}>
                      <View style={{ width: 2, height: 40, backgroundColor: t.line }} />
                      <Icon d={r.drive ? CAR : WALK} size={16} color={t.ink2} />
                      <Muted>{s.walk + ' min ' + (r.drive ? 'cu mașina' : 'pe jos')}</Muted>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 48, alignItems: 'center', paddingTop: 12 }}>
                      <T style={{ fontFamily: F.display, fontSize: 18 }}>{s.slot}</T>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 12, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
                      <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: s.place.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={s.place.icon as never} size={26} color={s.place.fg} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <T style={{ fontFamily: F.sb, fontSize: 12, color: t.ink3 }}>{s.why.toUpperCase() + ' · până la ' + s.until}</T>
                        <T style={{ fontFamily: F.b, fontSize: 16, lineHeight: 19 }}>{s.place.name}</T>
                        <Muted>{s.place.title + (s.place.price ? ' · ~' + s.place.price + ' lei' : ' · gratuit')}</Muted>
                        {s.reason ? <Muted numberOfLines={2} style={{ color: t.ink3 }}>{s.reason}</Muted> : null}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            {r.note ? <View style={{ marginTop: 12 }}><Note kind="ok">{r.note}</Note></View> : null}
            <Muted style={{ marginTop: 12, fontSize: 14 }}>{'Cam ' + r.price + ' lei de persoană pentru toată seara, ' + r.from + '–' + r.to + '. Prețurile sunt estimate.'}</Muted>
            <Press onPress={() => setSkip((k) => ({ ...k, [r.id]: (k[r.id] ?? 0) + 1 }))} style={{ marginTop: 10, alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.line, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="dice" size={16} color={t.ink} />
              <T style={{ fontFamily: F.sb, fontSize: 14 }}>Altă variantă</T>
            </Press>
          </>
        )}
      </ScrollView>
      {r ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(ins.bottom, 12) + 14, gap: 8, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
          <Big label="Facem așa" onPress={make} />
          <Big label="Trimite gășcii la vot" color={t.s2} ink={t.ink} icon={<Icon name="users" color={t.ink} />} onPress={() => setVote(true)} />
        </View>
      ) : null}
      <VoteStart open={vote} onClose={() => setVote(false)} places={[]} f={f} routes={(list ?? []).slice(0, 3)} />
      <TopShade />
    </View>
  );
}
