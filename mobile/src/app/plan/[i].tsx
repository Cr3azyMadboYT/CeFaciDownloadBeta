// One plan, opened: the map with the way between the places, each step with Rezervă / Drum / "Alt bar", what it costs
// per person and for everyone, the weather. "Facem așa" makes a ticket for every step; "La vot" sends the plans to
// the crew, this one first.
import { useCallback, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useFilters } from '../../lib/filters';
import { nextSurprise, refreshIfStale, setPlan, usePlans } from '../../lib/planAsk';
import { Checking, makeTickets } from '../planuri-gata';
import { APP } from '../../lib/session';
import { toast } from '../../lib/toast';
import { Icon } from '../../ui/Icon';
import { useSafeAreaInsets } from '../../ui/insets';
import { Big, Muted, Press, T } from '../../ui/kit';
import { PlacesMap } from '../../ui/PlacesMap';
import { F, useTheme } from '../../ui/theme';
import { VoteStart } from '../../ui/VoteStart';
import { Checks, StepRow } from '../../ui/PlanBits';

const OTHER: Record<string, string> = { mancare: 'Alt restaurant', cafea: 'Altă cafenea', desert: 'Alt desert', bar: 'Alt bar', club: 'Alt club', film: 'Alt cinema', teatru: 'Alt spectacol', cultura: 'Altceva', activitate: 'Altă joacă', natura: 'Alt parc', sport: 'Alt teren' };

export default function PlanDeschis() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const { i } = useLocalSearchParams<{ i: string }>();
  const st = usePlans();
  const surprise = i === 's';
  const idx = surprise ? st.pick : Number(i) || 0;
  const { draft, plans } = st;
  const [vote, setVote] = useState(false);
  useFocusEffect(useCallback(() => { refreshIfStale(); }, []));
  const p = plans[idx];
  if (draft && st.loading) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 20, paddingHorizontal: 20 }}><Checking draft={draft} /></View>;
  if (!draft || !p) return <Redirect href={draft && surprise ? '/planuri-gata' : '/acasa'} />;
  const people = draft.people;
  const wx = APP.dayWeather(p.steps[0].at);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));

  const make = () => makeTickets(p, people, draft.crewId ? { id: draft.crewId, name: draft.crewName ?? 'voastră' } : undefined);
  const open = (url: string) => { WebBrowser.openBrowserAsync(url).catch(() => void Linking.openURL(url)); };
  const alt = (k: number) => { if (!setPlan(idx, APP.altPlan(idx, k))) toast('Nu mai am altă variantă bună în apropiere.'); };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 250 }}>
          <PlacesMap height={250} line={p.steps.length > 1}
            pins={p.steps.map((s, k) => ({ id: s.place.id, lat: s.place.real.lat, lon: s.place.real.lon, name: s.slot + ' · ' + s.place.name, sub: s.why, bg: s.place.bg, fg: s.place.fg, n: k + 1 }))}
            origin={{ ...APP.origin(), label: APP.zoneName() }} />
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ position: 'absolute', left: 20, top: ins.top + 8, width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <View style={{ marginTop: -22, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: t.bg, paddingHorizontal: 20, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 13, color: '#FFD43B' }}>{String(idx + 1)}</T></View>
            <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.display, fontSize: 24 }}>{p.steps.length === 1 ? p.steps[0].place.name : p.title}</T>
          </View>
          <Muted style={{ marginTop: 2, fontSize: 14 }}>{(p.steps.length === 1 ? p.steps[0].place.title + ' · ' : '') + p.from + '–' + p.to + ' · ' + (people === 1 ? 'doar tu' : people + ' persoane')}</Muted>
          <Checks plan={p} />
          {surprise && st.note ? (
            // what Bilu had to change to find it (further than the radius, over the budget…): said here too, the
            // surprise skips the list where it is written
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: t.yellowSoft }}>
              <Icon name="sparkle" size={18} color={t.yellowInk} />
              <T style={{ flex: 1, fontFamily: F.m, fontSize: 13, lineHeight: 18 }}>{st.note}</T>
            </View>
          ) : null}

          <View style={{ marginTop: 14, padding: 14, borderRadius: 22, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
            {p.steps.map((s, k) => {
              const c = s.place.contact;
              const nav = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.place.real.lat + ',' + s.place.real.lon);
              return (
                <View key={s.place.id}>
                  {k > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 34 }}>
                      <View style={{ width: 2, height: 34, backgroundColor: t.line, marginLeft: 79 }} />
                      <T style={{ fontFamily: F.m, fontSize: 12.5, color: t.ink2 }}>{(s.by === 'car' ? '🚗 ' : '🚶 ') + s.travel + ' min până aici'}</T>
                    </View>
                  ) : null}
                  <StepRow s={s} />
                  {s.reason ? <Muted numberOfLines={2} style={{ marginLeft: 58, marginTop: 4 }}>{s.reason}</Muted> : null}
                  <View style={{ marginLeft: 58, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {c ? <Pill icon={c.site ? 'globe' : 'phone'} label={c.site ? 'Rezervă' : 'Sună'} onPress={() => (c.site ? open(c.site.startsWith('http') ? c.site : 'https://' + c.site) : void Linking.openURL('tel:' + c.phone.replace(/\s/g, '')))} /> : null}
                    <Pill icon="map" label="Drum" onPress={() => void Linking.openURL(nav)} />
                    <Pill icon="dice" label={OTHER[s.place.real.cat] ?? 'Altceva'} onPress={() => alt(k)} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 10, flexDirection: 'row', padding: 14, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, justifyContent: 'space-between' }}>
            <View><Muted>De persoană</Muted><T style={{ fontFamily: F.b, fontSize: 18 }}>{'~' + p.price + ' lei'}</T></View>
            {people > 1 ? <View><Muted>{'Pentru ' + people}</Muted><T style={{ fontFamily: F.b, fontSize: 18 }}>{'~' + p.price * people + ' lei'}</T></View> : null}
            {wx ? <View><Muted>Vremea</Muted><T style={{ fontFamily: F.b, fontSize: 18 }}>{wx.temp + '°, ' + wx.text}</T></View> : null}
          </View>
          <Muted style={{ marginTop: 6 }}>Prețurile sunt estimate.</Muted>
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
        {surprise ? <Big label="Altă surpriză" color={t.s2} ink={t.ink} icon={<Icon name="dice" color={t.ink} />} style={{ paddingHorizontal: 16 }} onPress={() => { void nextSurprise(); }} /> : null}
        <Big label="Facem așa" color="#FFD43B" ink="#0E1440" style={{ flex: 1 }} onPress={make} />
        {people >= 2 ? <Big label="La vot" color="#0E1440" icon={<Icon name="users" color="#FFFFFF" />} style={{ paddingHorizontal: 18 }} onPress={() => setVote(true)} /> : null}
      </View>
      <VoteStart open={vote} onClose={() => setVote(false)} places={[]} f={f}
        routes={[p, ...plans.filter((x) => x !== p)].map((x) => ({ label: x.title, sub: x.steps.map((s) => s.place.name).join(' → '), price: x.price, from: x.from, steps: x.steps.map((s) => ({ place: s.place, at: s.at, slot: s.slot })) }))} />
    </View>
  );
}

function Pill({ icon, label, onPress }: { icon: 'globe' | 'phone' | 'map' | 'dice'; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={15} color={t.ink} />
      <T style={{ fontFamily: F.sb, fontSize: 13 }}>{label}</T>
    </Press>
  );
}
