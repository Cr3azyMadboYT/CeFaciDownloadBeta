// Evenimente (22.10): the shape, the order for one person and the search, without React (tested in tests/events-rank.test.ts).
// Faza 1: CeFaci shows the event and sends to the official seller; no money through us (docs/evenimente.md).
import { fold } from '../engine/core';

export type EventKind = 'concert' | 'party' | 'standup' | 'teatru' | 'festival' | 'expozitie' | 'sport' | 'altele';
export type EventStatus = 'published' | 'sold_out' | 'postponed' | 'cancelled';
export interface CfEvent {
  id: string; title: string; kind: EventKind; starts_at: string; ends_at: string | null;
  venue_id: string | null; place_name: string; address: string | null; lat: number; lon: number;
  price_from: number | null; price_to: number | null; ticket_url: string | null; seller: string | null;
  min_age: number | null; about: string | null; about_en: string | null; status: EventStatus;
  /** 'link' = the official seller (faza 1); 'cefaci' = sold by the partner venue in CeFaci (faza 3, tickets.ts) */
  sale_mode?: 'link' | 'cefaci';
}

/** The official sellers (the same list as private.ticket_sellers on the server; tests/events-rank.test.ts compares them). */
export const SELLERS: Record<string, string> = {
  'iabilet.ro': 'iaBilet', 'eventbook.ro': 'Eventbook', 'entertix.ro': 'Entertix', 'livetickets.ro': 'LiveTickets',
  'myticket.ro': 'MyTicket', 'bilete.ro': 'Bilete.ro', 'ambilet.ro': 'AmBilet', 'oveit.com': 'Oveit', 'eventim.ro': 'Eventim',
  'ticketstore.ro': 'TicketStore', 'feverup.com': 'Fever',
};
/** The seller of a link, or null: only https, only a listed host (or its subdomain), no "user@host" tricks. */
export function sellerOf(url: string | null | undefined): string | null {
  const m = /^https:\/\/([^/?#@\s:]+)(?::\d+)?(\/\S*)?$/.exec(url ?? '');
  if (!m) return null;
  const host = m[1].toLowerCase();
  for (const [h, name] of Object.entries(SELLERS)) if (host === h || host.endsWith('.' + h)) return name;
  return null;
}

export const KIND_LABEL: Record<EventKind, string> = {
  concert: 'Concert', party: 'Party', standup: 'Stand-up', teatru: 'Teatru', festival: 'Festival', expozitie: 'Expoziție', sport: 'Sport', altele: 'Eveniment',
};
// the words people search with, for each kind (folded)
const KIND_WORDS: Record<EventKind, string[]> = {
  concert: ['concert', 'concerte', 'live', 'muzica', 'trupa', 'band', 'gig'],
  party: ['party', 'petrecere', 'club', 'dj', 'techno', 'house'],
  standup: ['stand up', 'standup', 'comedie', 'comedy', 'umor'],
  teatru: ['teatru', 'piesa', 'spectacol', 'theatre', 'theater'],
  festival: ['festival', 'fest'],
  expozitie: ['expozitie', 'expo', 'arta', 'exhibition'],
  sport: ['meci', 'sport', 'match'],
  altele: ['eveniment', 'event'],
};

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
const endOf = (e: CfEvent) => new Date(e.ends_at ?? new Date(Date.parse(e.starts_at) + 6 * 3600e3).toISOString());

export interface Who { origin: { lat: number; lon: number }; likes: string[]; minor: boolean; now: Date }

/** What one person may see: not over, not cancelled, not 18+ for a minor, within 30 days. */
export function visible(list: CfEvent[], w: Who): CfEvent[] {
  return list.filter((e) => e.status !== 'cancelled' && endOf(e) > w.now && Date.parse(e.starts_at) < w.now.getTime() + 30 * 86400e3
    && !(w.minor && (e.min_age ?? 0) >= 18));
}

// the likes from the account (cont.tsx) that point to a kind of event
const LIKE_KINDS: Record<string, EventKind[]> = {
  party: ['party', 'concert', 'festival'], karaoke: ['concert', 'party'], culture: ['teatru', 'expozitie', 'concert'],
  standup: ['standup'], film: ['standup', 'teatru'], sport: ['sport'], nature: ['festival'], board: ['standup'], bowl: ['festival'],
};

/** For Acasă and Explorează: the soonest, the closest and the ones that fit the person first; sold out last. */
export function forPerson(list: CfEvent[], w: Who): CfEvent[] {
  const fits = new Set(w.likes.flatMap((l) => LIKE_KINDS[l] ?? []));
  const score = (e: CfEvent) => {
    const days = Math.max(0, (Date.parse(e.starts_at) - w.now.getTime()) / 86400e3);
    return 30 - Math.min(30, days * 2) - Math.min(12, km(w.origin, e) * 0.8) + (fits.has(e.kind) ? 10 : 0) - (e.status === 'sold_out' ? 25 : 0);
  };
  return visible(list, w).map((e) => ({ e, s: score(e) })).sort((a, b) => b.s - a.s).map((x) => x.e);
}

/** Events for a search in Explorează: every word must be in the title, the place or the kind's words. */
export function searchEvents(list: CfEvent[], q: string, w: Who): CfEvent[] {
  const words = fold(q).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((x) => x.length > 1);
  if (!words.length) return [];
  const hit = (e: CfEvent) => {
    const hay = fold(e.title + ' ' + e.place_name + ' ' + KIND_WORDS[e.kind].join(' ') + ' ' + KIND_LABEL[e.kind]);
    return words.every((x) => hay.includes(x));
  };
  return forPerson(list.filter(hit), w);
}

/** „de la 80 lei”, „80–150 lei”, „Intrare liberă” (or null when the price is not known). */
export function priceText(e: CfEvent, t: (s: string, v?: Record<string, string | number>) => string): string | null {
  if (e.price_from === 0 && !e.price_to) return t('Intrare liberă');
  if (e.price_from != null && e.price_to != null && e.price_to > e.price_from) return t('{a}–{b} lei', { a: Math.round(e.price_from), b: Math.round(e.price_to) });
  if (e.price_from != null) return t('de la {a} lei', { a: Math.round(e.price_from) });
  return null;
}
