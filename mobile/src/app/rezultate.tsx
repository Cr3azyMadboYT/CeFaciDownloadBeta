// Rezultate: a feed of every place that fits (Cornel, 22.10: „ca un feed, nu câte 3 și Altele la infinit”), the first three
// with a role (a safe bet first), the search box and the filters on top; up to 3 places can be ticked for the crew vote.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { APP, useApp } from '../lib/session';
import { DIST, WHEN, WHO, fmtDur, listFor, matchesOf, setFilters, setSearch, summaryOf, useFilters, type Place } from '../lib/filters';
import { FilterSheet } from '../ui/FilterSheet';
import { Icon } from '../ui/Icon';
import { Big, Chip, H1, Lbl, Muted, Press, T, Tag } from '../ui/kit';
import { F, useTheme, type Theme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';
import { VoteStart } from '../ui/VoteStart';
import { tweaksFor } from '../lib/tweaks';
import { firstDraft, runPlans } from '../lib/planAsk';
import { PlacesMap } from '../ui/PlacesMap';
import { useWeatherVersion } from '../lib/weather';
import { Doodles } from '../ui/Doodles';
import { MissingPlace } from '../ui/MissingPlace';
import { openAt, PUBLIC_SPACE } from '../../../src/engine/core';
import { tr, pick as byLang } from '../lib/i18n';
import { mix, MIX_WAIT_MS } from '../lib/shuffle';
import { useCalm } from '../lib/motion';

const EXAMPLES = ['pizza sector 2', 'bar cu terasă', 'escape room', 'cafenea deschisă acum', 'muzeu', 'club'];
const EXAMPLES_MINOR = ['pizza sector 2', 'escape room', 'cafenea deschisă acum', 'muzeu', 'bowling', 'cinema'];
// English examples: only searches the engine understands in English too
const EXAMPLES_EN = ['pizza sector 2', 'bar with terrace', 'escape room', 'coffee open now', 'museum', 'club'];
const EXAMPLES_MINOR_EN = ['pizza sector 2', 'escape room', 'coffee open now', 'museum', 'bowling', 'cinema'];
const ADULT_WORDS = /\b(club|bar|pub|cocktail|bere|beer|narghilea|shisha|hookah|vin|wine|party)/i;
const SHUFFLE = 'M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4';
const CAR = 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M9 17h6M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0';
const WALLET = 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4';

const STEP = 12;   // places added each time the feed reaches the bottom
const VOTE_MAX = 3;

function role(t: Theme, i: number, p: Place, nearest: Place | null, used: { near: boolean; fresh: boolean }, tried: Set<string>): [string, string, string] {
  if (i === 0) return [tr('Pariu sigur'), t.blueSoft, t.blueInk];
  if (p === nearest && !used.near) { used.near = true; return [tr('Cel mai la îndemână'), t.yellowSoft, t.yellowInk]; }
  if (tried.size && !tried.has(p.real.cat) && !used.fresh) { used.fresh = true; return [tr('Ceva nou pentru voi'), t.greenSoft, t.greenInk]; }
  return [tr('Tot pe gustul vostru'), t.s2, t.ink];
}

export default function Rezultate() { return <Results />; }

/** The list; inside the Explorează tab (`inTab`) the bottom bar stays and there is no back arrow. */
export function Results({ inTab = false }: { inTab?: boolean }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f, sq } = useFilters();
  const prefs = useApp((s) => s.prefs);
  const [sheet, setSheet] = useState(false);
  const [vote, setVote] = useState(false);
  const [onMap, setOnMap] = useState(false);
  const [missing, setMissing] = useState(false);
  const typed = useDeferredValue(sq); // the list follows the typing without slowing the keyboard
  const stamps = useApp((s) => s.board.stamps as { id: string }[] | undefined);
  const tried = useMemo(() => new Set((stamps ?? []).flatMap((x) => { const v = APP.byId(x.id); return v ? [v.real.cat as string] : []; })), [stamps]);
  const wxv = useWeatherVersion();
  const all = useMemo(() => listFor(f, typed), [f, typed, prefs, wxv]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shown, setShown] = useState(STEP);
  const [picked, setPicked] = useState<string[]>([]);
  // "Amestecă": another order, the first places still the ones that fit the person best (lib/shuffle.ts)
  const [seed, setSeed] = useState(0);
  const [mixedAt, setMixedAt] = useState(0);
  const before = useRef<string[]>([]);
  useEffect(() => { setShown(STEP); setPicked([]); setSeed(0); before.current = []; }, [f, typed]);
  const searching = sq.trim().length > 1;
  const order = useMemo(() => (searching ? all : mix(all, seed, before.current)), [all, seed, searching]);
  const items = order.slice(0, shown);
  const top = order.slice(0, 3);
  const nearest = top.length ? top.reduce((a, b) => (b.dist < a.dist ? b : a)) : null;
  const used = { near: false, fresh: false };
  const roles = top.map((p, i) => role(t, i, p, nearest, used, tried));
  const forVote = all.filter((p) => picked.includes(p.id));
  const togglePick = (id: string) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= VOTE_MAX ? x : [...x, id]));
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
  const title = all.length ? (searching ? tr('Uite ce am găsit.') : tr('Pentru voi, acum.')) : tr('N-am găsit nimic.');
  const q = sq.trim();
  const sub = (searching
    ? (all.length ? (all.length === 1 ? tr('1 loc pentru „{q}”', { q }) : all.length < 20 ? tr('{n} locuri pentru „{q}”', { n: all.length, q }) : tr('{n} de locuri pentru „{q}”', { n: all.length, q })) : tr('Încearcă un nume, „pizza”, „sector 2” sau „bar cu terasă”.'))
    : all.length ? (all.length === 1 ? tr('1 loc se potrivește cu filtrele tale') : tr('{n} locuri se potrivesc cu filtrele tale', { n: all.length })) : tr('Niciun loc nu bifează tot ce ai ales.')) + priceNote;

  const first = useRef({ f, sq });
  const tweaks = useMemo(() => tweaksFor(f, sq, top), [f, sq, top, wxv]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = JSON.stringify(first.current) !== JSON.stringify({ f, sq });
  // a place opens its details first; the plan comes from there (decision Cornel, 06.10: a plan at the first tap was stressful)
  const pick = (id: string) => router.push({ pathname: '/loc/[id]', params: { id } });

  const listRef = useRef<FlatList<Place>>(null);
  const calm = useCalm();
  // nothing (or one) ticked: the button shakes and turns red for a moment, instead of sending places nobody chose
  const shake = useRef(new Animated.Value(0)).current;
  const [warn, setWarn] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (warnTimer.current) clearTimeout(warnTimer.current); }, []);
  const askVote = () => {
    if (forVote.length >= 2) { setVote(true); return; }
    setWarn(true);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarn(false), 1600);
    if (!calm) {
      shake.setValue(0);
      Animated.sequence([10, -10, 8, -8, 4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, easing: Easing.linear, useNativeDriver: true }))).start();
    }
  };
  // at most once every 2.5 s, so it cannot be hammered (Cornel, 22.10)
  const [now, setNow] = useState(0);
  const cooling = mixedAt > 0 && now - mixedAt < MIX_WAIT_MS;
  useEffect(() => { if (!mixedAt) return; const id = setTimeout(() => setNow(Date.now()), MIX_WAIT_MS + 30); return () => clearTimeout(id); }, [mixedAt]);
  const reshuffle = () => {
    const at = Date.now();
    if (at - mixedAt < MIX_WAIT_MS) return;
    before.current = order.slice(0, 8).map((p) => p.id);
    setSeed(Math.floor(Math.random() * 2 ** 31) + 1); setMixedAt(at); setNow(at); setShown(STEP);
    listRef.current?.scrollToOffset({ offset: 0, animated: !calm });
  };
  const renderItem = ({ item: p, index: i }: { item: Place; index: number }) => {
    const r = i < 3 ? roles[i] : null;
    const on = picked.includes(p.id);
    // closed right now, or no hours on the map at night: said on the card, not found out at the door
    const now = new Date(); const o = openAt(p.real, now); const h = now.getHours();
    const hours = o.known && !o.open ? <Tag text={tr('Închis acum')} bg={t.coralSoft} fg={t.coralInk} />
      : !o.known && (h >= 22 || h < 7) && p.real.cat !== 'natura' && !PUBLIC_SPACE.has(p.real.k) ? <Tag text={tr('Program neconfirmat')} bg={t.s2} fg={t.ink2} /> : null;
    return (
      <View style={{ paddingHorizontal: 20, marginTop: i ? 10 : 14 }}>
        {i === 3 ? <Lbl style={{ marginBottom: 10, marginTop: 6 }}>{tr('Toate locurile ({n})', { n: all.length })}</Lbl> : null}
        <Press onPress={() => pick(p.id)} haptic={false} accessibilityLabel={tr('{name}, {title}. Vezi detalii', { name: p.name, title: p.title })} style={{ padding: 12, flexDirection: 'row', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: on ? t.blue : t.line, backgroundColor: t.s1 }}>
          <View style={{ width: 74, borderRadius: 14, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -16, top: -16, width: 46, height: 46, borderRadius: 99, backgroundColor: p.dot }} />
            <View style={{ position: 'absolute', left: -10, bottom: -12, width: 30, height: 30, borderRadius: 99, borderWidth: 3, borderColor: p.dot }} />
            <Icon name={p.icon as never} size={34} color={p.fg} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {r || p.res === 'required' || p.age || hours ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: 34 }}>
                {r ? <Tag big text={r[0]} bg={r[1]} fg={r[2]} /> : null}
                {p.res === 'required' ? <Tag text={tr('Cere rezervare')} bg={t.coralSoft} fg={t.coralInk} /> : null}
                {p.age ? <Tag text="18+" bg={t.s2} fg={t.ink} /> : null}
                {hours}
              </View>
            ) : null}
            <T style={{ fontFamily: F.b, fontSize: 17, lineHeight: 20, paddingRight: r ? 0 : 34 }}>{p.title}</T>
            <T style={{ fontFamily: F.sb, fontSize: 14, color: t.ink2 }}>{p.name}</T>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Fact d={WALLET} text={p.price === 0 ? tr('Gratuit') : '~' + p.price + ' lei'} />
              <Fact name="clock" text={fmtDur(p.dur)} />
              <Fact d={CAR} text={p.dist + ' min'} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T numberOfLines={3} style={{ flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 17, color: p.story ? t.ink2 : t.ink3 }}>{p.story ?? APP.reason(p.id) ?? ''}</T>
              <Press onPress={() => pick(p.id)} accessibilityLabel={tr('Detalii despre {name}', { name: p.name })} style={{ height: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.blue, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T style={{ fontFamily: F.b, fontSize: 15, color: '#FFFFFF' }}>{tr('Detalii')}</T>
                <Icon name="next" size={16} color="#FFFFFF" />
              </Press>
            </View>
          </View>
          <Press onPress={() => togglePick(p.id)} haptic={false} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
            accessibilityLabel={on ? tr('Scoate {name} de la vot', { name: p.name }) : tr('Pune {name} la vot', { name: p.name })}
            style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 28, height: 28, borderRadius: 99, borderWidth: 2, borderColor: on ? t.blue : t.line, backgroundColor: on ? t.blue : t.bg, alignItems: 'center', justifyContent: 'center', opacity: !on && picked.length >= VOTE_MAX ? 0.4 : 1 }}>
              <Icon name={on ? 'check' : 'users'} size={on ? 16 : 14} color={on ? '#FFFFFF' : t.ink2} />
            </View>
          </Press>
        </Press>
      </View>
    );
  };
  const header = (
    <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44 }}>
        {!inTab ? (
          <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/acasa'))} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
            <Icon name="back" color={t.ink} />
          </Press>
        ) : null}
        <Press onPress={() => setSheet(true)} accessibilityLabel={tr('Filtre')} style={{ flex: 1, height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T numberOfLines={1} style={{ flex: 1, fontFamily: F.sb, fontSize: 13, color: t.ink2 }}>{tr(WHO[f.who].label) + ', ' + tr(WHEN[f.when].label).toLowerCase() + ', ' + summaryOf(f)}</T>
          <Icon d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" size={16} color={t.blueInk} />
        </Press>
        <Press onPress={() => setOnMap((m) => !m)} accessibilityLabel={onMap ? tr('Ascunde harta') : tr('Pe hartă')} accessibilityState={{ selected: onMap }}
          style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: onMap ? t.blue : t.line, backgroundColor: onMap ? t.blueSoft : t.s1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="map" size={16} color={onMap ? t.blueInk : t.ink} />
          <T style={{ fontFamily: F.sb, fontSize: 13, color: onMap ? t.blueInk : t.ink }}>{tr('Hartă')}</T>
        </Press>
      </View>
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingLeft: 14, paddingRight: 4, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
        <Icon name="search" size={16} color={t.ink2} />
        <TextInput maxFontSizeMultiplier={1.15} value={sq} onChangeText={(x) => setSearch(x.slice(0, 60))} placeholder={tr('Caută: un nume, „pizza sector 2”, „bar cu terasă”')} placeholderTextColor={t.ink3}
          accessibilityLabel={tr('Caută un loc')} returnKeyType="search" autoCorrect={false}
          style={{ flex: 1, height: 46, padding: 0, color: t.ink, fontFamily: F.sb, fontSize: 15 }} />
        {sq ? <Press onPress={() => setSearch('')} accessibilityLabel={tr('Șterge căutarea')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={16} color={t.ink2} /></Press> : null}
      </View>
      {sq.trim().length < 2 ? (
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(APP.isMinor() ? byLang(EXAMPLES_MINOR, EXAMPLES_MINOR_EN) : byLang(EXAMPLES, EXAMPLES_EN)).map((x) => <Chip key={x} label={x} onPress={() => setSearch(x)} />)}
        </View>
      ) : null}
      <H1 style={{ marginTop: 14, fontSize: 38, lineHeight: 38 }}>{title}</H1>
      <Muted style={{ marginTop: 6 }}>{sub}</Muted>
      {all.length > 1 ? <Muted style={{ marginTop: 4, fontSize: 13 }}>{tr('Bifează cercul de pe 2–3 locuri ca să le trimiți gășcii la vot.')}</Muted> : null}
      {further && !noFurther ? (
        <View style={{ marginTop: 10, padding: 14, gap: 10, borderRadius: 18, backgroundColor: t.yellowSoft }}>
          <T style={{ fontFamily: F.sb, fontSize: 14, lineHeight: 20 }}>{all.length === 1
              ? tr('Până la {max} km am găsit doar un loc. Până la {km} km mai sunt {more}. Caut și acolo?', { max: DIST[f.dist]?.max ?? '', km: further.km, more: further.n - all.length })
              : tr('Până la {max} km am găsit doar {n} locuri. Până la {km} km mai sunt {more}. Caut și acolo?', { max: DIST[f.dist]?.max ?? '', n: all.length, km: further.km, more: further.n - all.length })}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Big label={tr('Da, caută')} color="#0E1440" style={{ flex: 1, minHeight: 44 }} onPress={() => setFilters({ dist: String(further.km) })} />
            <Big label={tr('Nu, e ok')} color={t.s1} ink={t.ink} style={{ flex: 1, minHeight: 44 }} onPress={() => setNoFurther(true)} />
          </View>
        </View>
      ) : null}
      {tweaks.length || changed ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {!searching ? <Chip small label={tr('Fă-mi un plan pe toată seara')} icon={'sparkle' as never} onPress={() => { void runPlans({ ...firstDraft(), mode: 'seara', vibes: f.vibes }); router.push('/planuri-gata'); }} /> : null}
          {tweaks.map((x) => (
            <Chip key={x.id} small label={x.label} icon={x.icon as never} onPress={() => { if (x.apply.q !== undefined) setSearch(x.apply.q); if (x.apply.f) setFilters(x.apply.f); }} />
          ))}
          {changed ? <Chip small label={tr('Ca la început')} icon={'back' as never} onPress={() => { setSearch(first.current.sq); setFilters({ ...first.current.f, where: first.current.f.where }); }} /> : null}
        </ScrollView>
      ) : null}

      {onMap && all.length ? (
        <View style={{ marginTop: 14 }}>
          <PlacesMap
            pins={all.slice(0, 10).map((p, i) => ({ id: p.id, lat: p.real.lat, lon: p.real.lon, name: p.name, sub: p.title + (p.price ? ' · ~' + p.price + ' lei' : ''), bg: p.bg, fg: p.fg, n: i + 1, hot: i < 3 }))}
            origin={{ ...APP.origin(), label: APP.zoneName() }}
            onPick={pick}
          />
          <Muted style={{ marginTop: 6 }}>{tr('Primele 10 variante; cele mari sunt cele de mai jos. Hartă © OpenFreeMap, OpenStreetMap.')}</Muted>
        </View>
      ) : null}
    </View>
  );
  const empty = (
    <View style={{ paddingHorizontal: 20 }}>
        <View style={{ marginTop: 18, padding: 18, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
          <T style={{ fontFamily: F.sb, fontSize: 16 }}>{searching ? tr('Nu găsim locul ăsta.') : tr('Filtrele sunt prea strânse pentru seara asta.')}</T>
          <Muted>{searching ? (APP.isMinor() && ADULT_WORDS.test(sq) ? tr('Cluburile, barurile și locurile 18+ nu apar sub 18 ani. Încearcă un escape room, bowling sau un film.') : tr('Verifică scrierea sau încearcă altfel.')) : tr('Relaxează unul și îți arătăm ce iese.')}</Muted>
          {!searching ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <Chip label={tr('Orice vibe')} onPress={() => setFilters({ vibes: [] })} />
              <Chip label={tr('Orice buget')} onPress={() => setFilters({ budget: 'any' })} />
              {f.dist !== '40' ? <Chip label={tr('Până la 40 km')} onPress={() => setFilters({ dist: '40' })} /> : null}
            </View>
          ) : null}
        </View>
    </View>
  );
  const footer = (
    <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
      {all.length > shown ? <Muted style={{ marginTop: 14, textAlign: 'center' }}>{tr('Mai vin…')}</Muted> : all.length > 3 ? <Muted style={{ marginTop: 14, textAlign: 'center' }}>{tr('Asta e tot ce se potrivește. Schimbă filtrele ca să vezi altceva.')}</Muted> : null}
      <Press onPress={() => setMissing(true)} accessibilityLabel={tr('Lipsește un loc? Spune-ne')} style={{ marginTop: 14, minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="pin" size={16} color={t.blueInk} />
        <T style={{ fontFamily: F.b, fontSize: 14, color: t.blueInk }}>{searching && !all.length ? tr('Nu-l avem? Spune-ne de el') : tr('Lipsește un loc? Spune-ne')}</T>
      </Press>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => { if (shown < all.length) setShown((n) => n + STEP); }}
        onEndReachedThreshold={0.6}
        initialNumToRender={6}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: inTab ? 12 : Math.max(ins.bottom, 12) + 14, flexDirection: 'row', gap: 8, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: shake }] }}>
          <Big style={{ minHeight: 50, borderRadius: 16 }} color={warn ? t.coral : undefined}
            label={warn ? (picked.length ? tr('Mai bifează un loc') : tr('Bifează 2–3 locuri')) : picked.length ? tr('Trimite la vot ({n})', { n: picked.length }) : tr('Trimite la vot')}
            icon={<Icon name="users" size={18} color="#FFFFFF" />} onPress={askVote} />
        </Animated.View>
        {!searching && all.length > 3 ? (
          <Press onPress={reshuffle} disabled={cooling} accessibilityLabel={tr('Amestecă lista')} accessibilityState={{ disabled: cooling }}
            style={{ minHeight: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: cooling ? 0.45 : 1 }}>
            <Icon d={SHUFFLE} size={18} color={t.ink} />
            <T style={{ fontFamily: F.sb, fontSize: 15 }}>{tr('Amestecă')}</T>
          </Press>
        ) : null}
      </View>
      <FilterSheet open={sheet} value={f} onClose={() => setSheet(false)} onApply={(d) => { setSheet(false); setFilters(d); }} />
      <VoteStart open={vote} onClose={() => setVote(false)} places={forVote} f={f} />
      <MissingPlace open={missing} onClose={() => setMissing(false)} where={searching && !all.length ? undefined : APP.zoneName() === 'Lângă tine' ? undefined : APP.zoneName()} />
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
