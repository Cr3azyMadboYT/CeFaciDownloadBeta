// Evenimente on Acasă and in Explorează: a row of event tickets, the ones that fit the person first. Nothing shows
// when there is no event (or EVENTS_ON is false). Tap → the event's screen (app/eveniment/[id].tsx).
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { APP, useApp } from '../../lib/session';
import { tr, pick } from '../../lib/i18n';
import { Icon, type IconName } from '../../ui/Icon';
import { Muted, Press, T } from '../../ui/kit';
import { F, useTheme, type Theme } from '../../ui/theme';
import { forPerson, KIND_LABEL, priceText, searchEvents, type CfEvent, type EventKind } from '../../../../src/events/events';
import { useEvents } from './data';
import { EVENTS_ON } from './flag';

export const KIND_LOOK: Record<EventKind, { icon: IconName; bg: (t: Theme) => string; fg: string }> = {
  concert: { icon: 'mic', bg: (t) => t.coral, fg: '#FFFFFF' },
  party: { icon: 'club', bg: (t) => t.violet, fg: '#FFFFFF' },
  standup: { icon: 'smile', bg: (t) => t.yellow, fg: '#0E1440' },
  teatru: { icon: 'landmark', bg: (t) => t.blue, fg: '#FFFFFF' },
  festival: { icon: 'sparkle', bg: (t) => t.coral, fg: '#FFFFFF' },
  expozitie: { icon: 'landmark', bg: (t) => t.violet, fg: '#FFFFFF' },
  sport: { icon: 'ball', bg: (t) => t.blue, fg: '#FFFFFF' },
  altele: { icon: 'ticket', bg: (t) => t.navy, fg: '#FFFFFF' },
};

/** „Vin., 24 oct.” and „21:00”, in the phone's time (Bucharest). */
export function whenOf(iso: string) {
  const d = new Date(iso);
  const day = pick(['Dum.', 'Lun.', 'Mar.', 'Mie.', 'Joi', 'Vin.', 'Sâm.'], ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[d.getDay()];
  const mon = pick(['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])[d.getMonth()];
  const today = new Date(); const tomorrow = new Date(Date.now() + 86400e3);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return {
    day: same(d, today) ? tr('Azi') : same(d, tomorrow) ? tr('Mâine') : day + ' ' + d.getDate() + ' ' + mon,
    num: String(d.getDate()), mon, wd: day,
    time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
  };
}

export function useWho() {
  const prefs = useApp((s) => s.prefs);
  return { origin: APP.origin(), likes: (prefs.likes as string[] | undefined) ?? [], minor: APP.isMinor(), now: new Date() };
}

export function EventsRail({ q, style }: { q?: string; style?: object }) {
  const { t } = useTheme();
  const all = useEvents();
  const who = useWho();
  if (!EVENTS_ON) return null;
  const list = (q && q.trim().length > 1 ? searchEvents(all, q, who) : forPerson(all, who)).slice(0, 10);
  if (!list.length) return null;
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.display, fontSize: 21 }}>{q ? tr('Evenimente pentru „{q}”', { q: q.trim() }) : tr('Concerte și evenimente')}</T>
        {!q ? <Muted>{tr('în următoarele zile')}</Muted> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {list.map((e) => <EventCard key={e.id} e={e} t={t} />)}
      </ScrollView>
    </View>
  );
}

function EventCard({ e, t }: { e: CfEvent; t: Theme }) {
  const look = KIND_LOOK[e.kind];
  const w = whenOf(e.starts_at);
  const price = priceText(e, tr);
  const flag = e.status === 'sold_out' ? tr('Sold out') : e.status === 'postponed' ? tr('Amânat') : null;
  return (
    <Press onPress={() => router.push({ pathname: '/eveniment/[id]', params: { id: e.id } })}
      accessibilityLabel={tr('{title}, {kind}, {day} la {time}, {place}', { title: e.title, kind: tr(KIND_LABEL[e.kind]), day: w.day, time: w.time, place: e.place_name })}
      style={{ width: 268, minHeight: 112, flexDirection: 'row', borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
      {/* the ticket stub: the date, in the kind's colour */}
      <View style={{ width: 70, backgroundColor: look.bg(t), alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 2 }}>
        <Icon name={look.icon} size={18} color={look.fg} />
        <T style={{ fontFamily: F.display, fontSize: 26, lineHeight: 28, color: look.fg }}>{w.num}</T>
        <T style={{ fontFamily: F.sb, fontSize: 12, color: look.fg }}>{w.mon}</T>
        <T style={{ fontFamily: F.b, fontSize: 12, color: look.fg }}>{w.time}</T>
      </View>
      <View style={{ width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: t.bg }} />
      <View style={{ flex: 1, padding: 12, gap: 3 }}>
        <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12, color: t.blueInk }}>{tr(KIND_LABEL[e.kind]) + ' · ' + w.day}{(e.min_age ?? 0) >= 18 ? ' · 18+' : ''}</T>
        <T numberOfLines={2} style={{ fontFamily: F.b, fontSize: 15, lineHeight: 19 }}>{e.title}</T>
        <Muted numberOfLines={1}>{e.place_name}</Muted>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
          {flag ? <T style={{ fontFamily: F.b, fontSize: 12, color: t.coralInk }}>{flag}</T> : price ? <T style={{ fontFamily: F.b, fontSize: 13 }}>{price}</T> : null}
        </View>
      </View>
    </Press>
  );
}
