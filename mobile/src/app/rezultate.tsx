// Rezultate: three places at a time (a safe bet first), the search box, and the filters on top.
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { APP, useApp } from '../lib/session';
import { DIST, WHEN, WHO, fmtDur, listFor, matchesOf, setFilters, setPage, setSearch, summaryOf, useFilters, type Place } from '../lib/filters';
import { createPlan } from '../lib/plans';
import { FilterSheet } from '../ui/FilterSheet';
import { Icon } from '../ui/Icon';
import { Big, Chip, H1, Muted, Press, T, Tag } from '../ui/kit';
import { F, useTheme, type Theme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';
import { VoteStart } from '../ui/VoteStart';
import { tweaksFor } from '../lib/tweaks';
import { firstDraft, runPlans } from '../lib/planAsk';
import { PlacesMap } from '../ui/PlacesMap';
import { useWeatherVersion } from '../lib/weather';

const WORDS = ['nimic', 'una', 'două', 'trei'];
const EXAMPLES = ['pizza sector 2', 'bar cu terasă', 'escape room', 'cafenea deschisă acum', 'muzeu', 'club'];
const CAR = 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0';
const WALLET = 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4';

function role(t: Theme, i: number, page: number, p: Place, nearest: Place | null, used: { near: boolean; fresh: boolean }, tried: Set<string>): [string, string, string] {
  if (i === 0 && page === 0) return ['Pariu sigur', t.blueSoft, t.blueInk];
  if (p === nearest && !used.near) { used.near = true; return ['Cel mai la îndemână', t.yellowSoft, t.yellowInk]; }
  if (tried.size && !tried.has(p.real.cat) && !used.fresh) { used.fresh = true; return ['Ceva nou pentru voi', t.greenSoft, t.greenInk]; }
  return ['Tot pe gustul vostru', t.s2, t.ink];
}

export default function Rezultate() { return <Results />; }

/** The list; inside the Explorează tab (`inTab`) the bottom bar stays and there is no back arrow. */
export function Results({ inTab = false }: { inTab?: boolean }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f, sq, page: page0 } = useFilters();
  const prefs = useApp((s) => s.prefs);
  const [sheet, setSheet] = useState(false);
  const [vote, setVote] = useState(false);
  const [onMap, setOnMap] = useState(false);
  const typed = useDeferredValue(sq); // the list follows the typing without slowing the keyboard
  const wxv = useWeatherVersion();
  const all = useMemo(() => listFor(f, typed), [f, typed, prefs, wxv]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = page0 * 3 >= all.length ? 0 : page0;
  const items = all.slice(page * 3, page * 3 + 3);
  const nearest = items.length ? items.reduce((a, b) => (b.dist < a.dist ? b : a)) : null;
  const used = { near: false, fresh: false };
  const stamps = useApp((s) => s.board.stamps as { id: string }[] | undefined);
  const tried = useMemo(() => new Set((stamps ?? []).flatMap((x) => { const v = APP.byId(x.id); return v ? [v.real.cat as string] : []; })), [stamps]);
  const searching = sq.trim().length > 1;
  // few places within the radius: offer to look further (decision Cornel, 04.10: „caut pe o rază mai extinsă? da/nu”)
  const [noFurther, setNoFurther] = useState(false);
  const further = useMemo(() => {
    if (searching || all.length >= 6) return null;
    const km = [10, 20, 30, 40].find((k) => k > (DIST[f.dist]?.max ?? 40));
    if (!km) return null;
    const n = matchesOf({ ...f, dist: String(km) }).length;
    return n > all.length ? { km, n } : null;
  }, [searching, all, f]);
  const priceNote = useMemo(() => APP.priceNote(sq, f.budget), [sq, f.budget]);
  const remaining = all.length - (page * 3 + items.length);
  const title = searching ? (all.length ? 'Uite ce am găsit.' : 'N-am găsit nimic.') : items.length ? 'Am găsit ' + WORDS[Math.min(3, items.length)] + '.' : 'N-am găsit nimic.';
  const sub = (searching
    ? (all.length ? all.length + (all.length === 1 ? ' loc' : all.length < 20 ? ' locuri' : ' de locuri') + ' pentru „' + sq.trim() + '”' + (page ? ', pagina ' + (page + 1) : '') : 'Încearcă un nume, „pizza”, „sector 2” sau „bar cu terasă”.')
    : all.length ? all.length + ' locuri se potrivesc cu filtrele tale' + (page ? ', pagina ' + (page + 1) : '') : 'Niciun loc nu bifează tot ce ai ales.') + priceNote;

  const first = useRef({ f, sq });
  const tweaks = useMemo(() => tweaksFor(f, sq, items), [f, sq, items, wxv]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = JSON.stringify(first.current) !== JSON.stringify({ f, sq });
  const pick = (id: string) => {
    const pid = createPlan(id, f);
    router.push({ pathname: '/bilet/[pid]', params: { pid: String(pid) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44 }}>
          {!inTab ? (
            <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/acasa'))} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
              <Icon name="back" color={t.ink} />
            </Press>
          ) : null}
          <Press onPress={() => setSheet(true)} accessibilityLabel="Filtre" style={{ flex: 1, height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T numberOfLines={1} style={{ flex: 1, fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{WHO[f.who].label + ', ' + WHEN[f.when].label.toLowerCase() + ', ' + summaryOf(f)}</T>
            <Icon d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" size={16} color={t.blueInk} />
          </Press>
          <Press onPress={() => setOnMap((m) => !m)} accessibilityLabel={onMap ? 'Ascunde harta' : 'Pe hartă'} accessibilityState={{ selected: onMap }}
            style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: onMap ? t.blue : t.line, backgroundColor: onMap ? t.blueSoft : t.s1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="map" size={16} color={onMap ? t.blueInk : t.ink} />
            <T style={{ fontFamily: F.sb, fontSize: 13, color: onMap ? t.blueInk : t.ink }}>Hartă</T>
          </Press>
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingLeft: 14, paddingRight: 4, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
          <Icon name="search" size={16} color={t.ink2} />
          <TextInput maxFontSizeMultiplier={1.15} value={sq} onChangeText={(x) => setSearch(x.slice(0, 60))} placeholder="Caută: un nume, „pizza sector 2”, „bar cu terasă”" placeholderTextColor={t.ink3}
            accessibilityLabel="Caută un loc" returnKeyType="search" autoCorrect={false}
            style={{ flex: 1, height: 46, padding: 0, color: t.ink, fontFamily: F.sb, fontSize: 15 }} />
          {sq ? <Press onPress={() => setSearch('')} accessibilityLabel="Șterge căutarea" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={16} color={t.ink2} /></Press> : null}
        </View>
        {sq.trim().length < 2 ? (
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map((x) => <Chip key={x} label={x} onPress={() => setSearch(x)} />)}
          </View>
        ) : null}
        <H1 style={{ marginTop: 14, fontSize: 38, lineHeight: 38 }}>{title}</H1>
        <Muted style={{ marginTop: 6 }}>{sub}</Muted>
        {further && !noFurther ? (
          <View style={{ marginTop: 10, padding: 14, gap: 10, borderRadius: 18, backgroundColor: t.yellowSoft }}>
            <T style={{ fontFamily: F.sb, fontSize: 14, lineHeight: 20 }}>{'Până la ' + (DIST[f.dist]?.max ?? '') + ' km am găsit ' + (all.length === 1 ? 'doar un loc' : 'doar ' + all.length + ' locuri') + '. Până la ' + further.km + ' km mai sunt ' + (further.n - all.length) + '. Caut și acolo?'}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Big label="Da, caută" color="#0E1440" style={{ flex: 1, minHeight: 44 }} onPress={() => setFilters({ dist: String(further.km) })} />
              <Big label="Nu, e ok" color={t.s1} ink={t.ink} style={{ flex: 1, minHeight: 44 }} onPress={() => setNoFurther(true)} />
            </View>
          </View>
        ) : null}
        {tweaks.length || changed ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
            {!searching ? <Chip small label="Fă-mi un plan pe toată seara" icon={'sparkle' as never} onPress={() => { void runPlans({ ...firstDraft(), mode: 'seara', vibes: f.vibes }); router.push('/planuri-gata'); }} /> : null}
            {tweaks.map((x) => (
              <Chip key={x.id} small label={x.label} icon={x.icon as never} onPress={() => { if (x.apply.q !== undefined) setSearch(x.apply.q); if (x.apply.f) setFilters(x.apply.f); }} />
            ))}
            {changed ? <Chip small label="Ca la început" icon={'back' as never} onPress={() => { setSearch(first.current.sq); setFilters({ ...first.current.f, where: first.current.f.where }); }} /> : null}
          </ScrollView>
        ) : null}

        {onMap && all.length ? (
          <View style={{ marginTop: 14 }}>
            <PlacesMap
              pins={all.slice(0, 10).map((p, i) => ({ id: p.id, lat: p.real.lat, lon: p.real.lon, name: p.name, sub: p.title + (p.price ? ' · ~' + p.price + ' lei' : ''), bg: p.bg, fg: p.fg, n: i + 1, hot: items.includes(p) }))}
              origin={{ ...APP.origin(), label: APP.zoneName() }}
              onPick={pick}
            />
            <Muted style={{ marginTop: 6 }}>Primele 10 variante; cele mari sunt cele de mai jos. Hartă © OpenFreeMap, OpenStreetMap.</Muted>
          </View>
        ) : null}
        {items.length ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            {items.map((p, i) => {
              const r = role(t, i, page, p, nearest, used, tried);
              return (
                <View key={p.id} style={{ padding: 12, flexDirection: 'row', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
                  <View style={{ width: 74, borderRadius: 14, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <View style={{ position: 'absolute', right: -16, top: -16, width: 46, height: 46, borderRadius: 99, backgroundColor: p.dot }} />
                    <View style={{ position: 'absolute', left: -10, bottom: -12, width: 30, height: 30, borderRadius: 99, borderWidth: 3, borderColor: p.dot }} />
                    <Icon name={p.icon as never} size={34} color={p.fg} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <Tag big text={r[0]} bg={r[1]} fg={r[2]} />
                      {p.res === 'required' ? <Tag text="Cere rezervare" bg={t.coralSoft} fg={t.coralInk} /> : null}
                      {p.age ? <Tag text="18+" bg={t.s2} fg={t.ink} /> : null}
                    </View>
                    <T style={{ fontFamily: F.b, fontSize: 17, lineHeight: 20 }}>{p.title}</T>
                    <T style={{ fontFamily: F.sb, fontSize: 14, color: t.ink2 }}>{p.name}</T>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Fact d={WALLET} text={p.price === 0 ? 'Gratuit' : '~' + p.price + ' lei'} />
                      <Fact name="clock" text={fmtDur(p.dur)} />
                      <Fact d={CAR} text={p.dist + ' min'} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <T style={{ flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 17, color: t.ink3 }}>{APP.reason(p.id) ?? ''}</T>
                      <Press onPress={() => pick(p.id)} accessibilityLabel={'Alege ' + p.name} style={{ height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: t.blue, justifyContent: 'center' }}>
                        <T style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>Asta!</T>
                      </Press>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ marginTop: 18, padding: 18, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
            <T style={{ fontFamily: F.sb, fontSize: 16 }}>{searching ? 'Nu găsim locul ăsta.' : 'Filtrele sunt prea strânse pentru seara asta.'}</T>
            <Muted>{searching ? 'Verifică scrierea sau încearcă altfel.' : 'Relaxează unul și îți arătăm ce iese.'}</Muted>
            {!searching ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <Chip label="Orice vibe" onPress={() => setFilters({ vibes: [] })} />
                <Chip label="Orice buget" onPress={() => setFilters({ budget: 'any' })} />
                {f.dist !== '40' ? <Chip label="Până la 40 km" onPress={() => setFilters({ dist: '40' })} /> : null}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(ins.bottom, 12) + 14, flexDirection: 'row', gap: 8, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
        <Big style={{ flex: 1 }} label="Trimite gășcii la vot" disabled={!items.length} icon={<Icon name="users" color={items.length ? '#FFFFFF' : t.ink2} />} onPress={() => setVote(true)} />
        <Press onPress={() => setPage(page + 1)} disabled={all.length <= 3}
          style={{ height: 56, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, justifyContent: 'center', opacity: all.length <= 3 ? 0.5 : 1 }}>
          <T style={{ fontFamily: F.sb, fontSize: 15 }}>{all.length <= 3 ? 'Doar atât' : remaining > 0 ? 'Altele (' + remaining + ')' : 'De la început'}</T>
        </Press>
      </View>
      <FilterSheet open={sheet} value={f} onClose={() => setSheet(false)} onApply={(d) => { setSheet(false); setFilters(d); }} />
      <VoteStart open={vote} onClose={() => setVote(false)} places={items} f={f} />
      <TopShade />
    </View>
  );
}

function Fact({ d, name, text }: { d?: string; name?: 'clock'; text: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon d={d} name={name} size={16} color={t.ink2} />
      <T style={{ fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{text}</T>
    </View>
  );
}
