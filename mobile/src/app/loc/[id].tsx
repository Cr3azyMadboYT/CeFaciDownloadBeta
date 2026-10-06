// A place, opened from Explorează (decision Cornel, 06.10: tapping a place made a plan at once, which felt rushed).
// Everything we know about it: why it is worth it, when people are there, the hours for the week, the address, the
// map, what it has (terrace, wifi…), how to call or reach it. The plan comes only from "Fă-mi plan aici".
import { useMemo } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP } from '../../lib/session';
import { fmtDur, useFilters } from '../../lib/filters';
import { createPlan } from '../../lib/plans';
import { Icon, type IconName } from '../../ui/Icon';
import { Big, Muted, Press, T, Tag } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { PlacesMap } from '../../ui/PlacesMap';
import { openAt } from '../../../../src/engine/core';

const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // the week from Monday
const hm = (m: number) => String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

/** One line per day, from the weekly table (wk[0] = Sunday, minutes of the day; a night past midnight goes on in the
 *  next day's list, so it is joined back: "20:00–02:00"). */
function weekLines(wk: number[][][]): string[] {
  return ORDER.map((d) => {
    const today = wk[d] ?? [];
    const tomorrow = wk[(d + 1) % 7] ?? [];
    const parts = today
      .filter(([a]) => !(a === 0 && (wk[(d + 6) % 7] ?? []).some(([, b]) => b === 1440))) // the tail of last night
      .map(([a, b]) => {
        if (a === 0 && b === 1440) return 'non-stop';
        const tail = b === 1440 ? tomorrow.find(([x]) => x === 0) : undefined;
        return hm(a) + '–' + (tail ? hm(tail[1]) : hm(b));
      });
    return parts.length ? parts.join(', ') : 'închis';
  });
}

export default function Loc() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { f } = useFilters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = APP.byId(String(id));
  const now = useMemo(() => new Date(), []);
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <T style={{ fontFamily: F.display, fontSize: 26 }}>Locul ăsta nu mai e în aplicație.</T>
        <Big label="Înapoi" onPress={() => router.back()} />
      </View>
    );
  }
  const v = p.real;
  const open = openAt(v, now);
  const week = v.wk ? weekLines(v.wk) : null;
  const todayIdx = ORDER.indexOf(now.getDay());
  const back = () => (router.canGoBack() ? router.back() : router.replace('/exploreaza'));
  const plan = () => { const pid = createPlan(p.id, f); router.replace({ pathname: '/bilet/[pid]', params: { pid: String(pid) } }); };
  const nav = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.lat + ',' + v.lon);
  const site = v.website ? (v.website.startsWith('http') ? v.website : 'https://' + v.website) : null;
  const address = [v.street, v.city ?? p.zone].filter(Boolean).join(', ');
  const has: [IconName | null, string][] = [
    ...(v.outdoor ? [['tree', 'Terasă'] as [IconName, string]] : []),
    ...(v.wifi ? [[null, 'Wi-Fi'] as [null, string]] : []),
    ...(v.ac ? [[null, 'Aer condiționat'] as [null, string]] : []),
    ...(v.wheelchair ? [[null, 'Accesibil cu scaun cu rotile'] as [null, string]] : v.wheelLimited ? [[null, 'Parțial accesibil cu scaun cu rotile'] as [null, string]] : []),
    ...(v.smoke === 'no' ? [[null, 'Nefumători'] as [null, string]] : v.smoke === 'outside' ? [[null, 'Se fumează afară'] as [null, string]] : v.smoke === 'yes' ? [[null, 'Se fumează'] as [null, string]] : []),
    ...(p.age || v.minAge ? [[null, (v.minAge ?? 18) + '+ (buletinul la intrare)'] as [null, string]] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* the place's colours, like its card in the list */}
        <View style={{ backgroundColor: p.bg, paddingTop: ins.top + 8, paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -40, top: -30, width: 180, height: 180, borderRadius: 999, backgroundColor: p.dot, opacity: 0.6 }} />
          <View style={{ position: 'absolute', left: -30, bottom: -50, width: 120, height: 120, borderRadius: 999, borderWidth: 10, borderColor: p.dot, opacity: 0.6 }} />
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" color="#0E1440" />
          </Press>
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={p.icon as IconName} size={36} color={p.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.display, fontSize: 28, lineHeight: 30, color: p.fg }}>{p.name}</T>
              <T style={{ fontFamily: F.sb, fontSize: 15, color: p.fg, opacity: 0.85 }}>{p.title}</T>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {open.known ? <Tag big text={open.label} bg={open.open ? t.greenSoft : t.coralSoft} fg={open.open ? t.greenInk : t.coralInk} /> : <Tag big text="Program neconfirmat" bg={t.s2} fg={t.ink2} />}
            {v.pick ? <Tag text="Ales de noi" bg={t.yellowSoft} fg={t.yellowInk} /> : v.rated ? <Tag text="Bine cotat de oameni" bg={t.blueSoft} fg={t.blueInk} /> : null}
            {p.res === 'required' ? <Tag text="Cere rezervare" bg={t.coralSoft} fg={t.coralInk} /> : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[[p.price === 0 ? 'Gratuit' : '~' + p.price + ' lei', 'de persoană'], [fmtDur(p.dur), 'cât stai de obicei'], [p.km < 1 ? Math.round(p.km * 1000) + ' m' : p.km.toFixed(1).replace('.', ',') + ' km', p.dist + ' min cu mașina']].map(([a, b]) => (
              <View key={b} style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                <T style={{ fontFamily: F.b, fontSize: 17 }}>{a}</T>
                <Muted style={{ fontSize: 12.5 }}>{b}</Muted>
              </View>
            ))}
          </View>

          {p.story ? (
            <View style={{ gap: 6 }}>
              <T style={{ fontFamily: F.display, fontSize: 20 }}>De ce merită</T>
              <T style={{ fontFamily: F.m, fontSize: 15, lineHeight: 21 }}>{p.story}</T>
            </View>
          ) : APP.reason(p.id) ? <T style={{ fontFamily: F.m, fontSize: 15, lineHeight: 21, color: t.ink2 }}>{APP.reason(p.id)}</T> : null}
          {p.crowd ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: t.yellowSoft }}>
              <Icon name="users" size={20} color={t.yellowInk} />
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 14, color: t.yellowInk }}>{'Când e lume: ' + p.crowd}</T>
            </View>
          ) : null}

          {p.vibes.length || has.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {p.vibes.map((x: string) => <Tag key={x} text={x} bg={t.s2} fg={t.ink} />)}
              {has.map(([, x]) => <Tag key={x} text={x} bg={t.s2} fg={t.ink} />)}
            </View>
          ) : null}

          <View style={{ padding: 14, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, gap: 6 }}>
            <T style={{ fontFamily: F.display, fontSize: 18 }}>Program</T>
            {week ? week.map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ fontFamily: i === todayIdx ? F.b : F.m, fontSize: 14 }}>{DAYS[ORDER[i]] + (i === todayIdx ? ' (azi)' : '')}</T>
                <T style={{ fontFamily: i === todayIdx ? F.b : F.m, fontSize: 14, color: line === 'închis' ? t.coralInk : t.ink }}>{line}</T>
              </View>
            )) : <Muted>Programul nu e pe hartă. Înainte de plan îl verificăm pe Google, la ora ta.</Muted>}
          </View>

          <View style={{ gap: 8 }}>
            {address ? <T style={{ fontFamily: F.sb, fontSize: 14, color: t.ink2 }}>{address}</T> : null}
            <PlacesMap height={180} pins={[{ id: p.id, lat: v.lat, lon: v.lon, name: p.name, sub: p.title, bg: p.bg, fg: p.fg, n: 1, hot: true }]} origin={{ ...APP.origin(), label: APP.zoneName() }} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pill icon="map" label="Drum" onPress={() => void Linking.openURL(nav)} />
              {v.phone ? <Pill icon="phone" label="Sună" onPress={() => void Linking.openURL('tel:' + v.phone!.replace(/\s/g, ''))} /> : null}
              {site ? <Pill icon="globe" label="Site" onPress={() => { WebBrowser.openBrowserAsync(site).catch(() => void Linking.openURL(site)); }} /> : null}
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line, gap: 6 }}>
        {open.known && !open.open ? <Muted style={{ textAlign: 'center' }}>Acum e închis: uită-te la program înainte să mergi.</Muted> : null}
        <Big label="Fă-mi plan aici" color="#FFD43B" ink="#0E1440" onPress={plan} />
      </View>
    </View>
  );
}

function Pill({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={18} color={t.ink} />
      <T style={{ fontFamily: F.b, fontSize: 15 }}>{label}</T>
    </Press>
  );
}
