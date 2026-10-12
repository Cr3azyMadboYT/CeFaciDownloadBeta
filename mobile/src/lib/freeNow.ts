// FreeNow (Cornel, 12.10): „Intră pe FreeNow ⚡” = ai timp de ieșit acum (sau de la o oră, azi) și le dai de veste
// prietenilor și prietenilor lor (2 pași: eu–Mihai–Andrei, nu și Gabi). Cine vrea apasă „Vin și eu” și intră în
// ieșirea ta (2–10 oameni); Bilu propune 3 locuri, votați 15 minute, planul ajunge pe biletul fiecăruia.
// Toate regulile (cine vede pe cine, minorii, limitele, notificările) sunt pe server: migrarea 20261012030000.
import { useSyncExternalStore } from 'react';
import { sb } from './auth';
import { APP } from './session';
import { askOf, firstDraft } from './planAsk';
import { hhmm } from './plans';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;

export type Mood = 'orice' | 'mancare' | 'pahar' | 'cafea' | 'film' | 'plimbare' | 'joaca' | 'desert';
export const MOODS: { id: Mood; label: string; emoji: string; part: string[] }[] = [
  { id: 'orice', label: 'Orice', emoji: '⚡', part: [] },
  { id: 'mancare', label: 'Mâncare', emoji: '🍕', part: ['masa'] },
  { id: 'pahar', label: 'Un pahar', emoji: '🍻', part: ['pahar'] },
  { id: 'cafea', label: 'Cafea', emoji: '☕', part: ['desert'] },
  { id: 'film', label: 'Film', emoji: '🎬', part: ['film'] },
  { id: 'plimbare', label: 'Plimbare', emoji: '🚶', part: ['promenada'] },
  { id: 'joaca', label: 'Joacă', emoji: '🎳', part: ['joaca'] },
  { id: 'desert', label: 'Desert', emoji: '🍰', part: ['desert'] },
];
export const moodOf = (id: string) => MOODS.find((m) => m.id === id);
/** „chef de un pahar sau film” (fără „orice”) */
export const moodWords = (ms: string[]) => {
  const w = ms.filter((m) => m !== 'orice').map((m) => (moodOf(m)?.label ?? m).toLowerCase());
  return w.length ? 'chef de ' + w.join(' sau ') : '';
};

export type Audience = 'fof' | 'friends' | 'crew' | 'pick';
export const AUDIENCES: { id: Audience; label: string; sub: string }[] = [
  { id: 'fof', label: 'Prietenii și prietenii lor', sub: 'Cei pe care îi știi și cei pe care îi știu ei' },
  { id: 'friends', label: 'Doar prietenii mei', sub: 'Doar cei din lista ta' },
  { id: 'crew', label: 'O gașcă', sub: 'Doar cei din gașca aleasă' },
  { id: 'pick', label: 'Aleg eu pe cine', sub: 'Doar prietenii pe care îi bifezi' },
];

export interface Mine { id: string; starts_at: string; ends_at: string; moods: string[]; audience: Audience; crew_id: string | null; picked: string[]; zone: string | null }
export interface Member { id: string; first_name: string; username: string; friend: boolean }
export interface Outing {
  id: string; host: string; open: boolean; ends_at: string; vote_id: string | null; vote_closes_at: string | null;
  plan: { id: string; venue_id: string; venue_name: string; starts_at: string } | null; has_minor: boolean; members: Member[];
}
export interface Free {
  id: string; first_name: string; username: string; starts_at: string; ends_at: string; moods: string[]; zone: string | null;
  friend: boolean; via: string | null; muted: boolean;
  outing: { id: string; open: boolean; count: number; mine: boolean; plan: { venue_name: string; starts_at: string } | null } | null;
}
export interface State { me: Mine | null; outing: Outing | null; people: Free[]; quiet: boolean; loaded: boolean; at: number }

let s: State = { me: null, outing: null, people: [], quiet: false, loaded: false, at: 0 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const useFreeNow = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => s, () => s);
export const getFreeNow = () => s;

/** Mesajele serverului sunt deja pentru oameni; o eroare tehnică devine una simplă. */
const said = (e: { message?: string } | null | undefined) => {
  const m = e?.message ?? '';
  return /[ăâîșțĂÂÎȘȚ]|^(Nu |Ai |Alege|Poți|Ieșirea|Așteaptă|Doar|Unul|Votul|Pe FreeNow|E prea|Intră)/.test(m) ? m : 'Nu a mers. Încearcă din nou.';
};

let loading: Promise<void> | null = null;
export function refreshFreeNow(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data, error } = await db().rpc('free_now_list');
      if (!error && data) s = { me: data.me ?? null, outing: data.outing ?? null, people: data.people ?? [], quiet: !!data.quiet, loaded: true, at: Date.now() };
      else s = { ...s, loaded: true };
    } catch { s = { ...s, loaded: true }; }
    emit();
  })().finally(() => { loading = null; });
  return loading;
}

/** Ieșirea mea, ascultată în timp real (cine intră, votul, planul). */
let watching: { id: string; off: () => void } | null = null;
export function watchOuting(id: string | null) {
  if (watching?.id === id) return;
  watching?.off(); watching = null;
  if (!id) return;
  try {
    const ch = db().channel('free:' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'free_outings', filter: 'id=eq.' + id }, () => { void refreshFreeNow(); }).subscribe();
    watching = { id, off: () => { void db().removeChannel(ch); } };
  } catch { /* fără timp real: ecranul se reîmprospătează singur */ }
}

export interface StartReq { endsAt: Date; startsAt?: Date | null; moods: Mood[]; audience: Audience; crewId?: string | null; picked?: string[]; zone?: string | null }
export async function startFreeNow(r: StartReq): Promise<{ err?: string; notified?: number; others?: number }> {
  const { data, error } = await db().rpc('free_now_set', {
    p_ends_at: r.endsAt.toISOString(), p_starts_at: r.startsAt ? r.startsAt.toISOString() : null, p_moods: r.moods,
    p_audience: r.audience, p_crew: r.audience === 'crew' ? r.crewId ?? null : null, p_picked: r.audience === 'pick' ? r.picked ?? [] : [], p_zone: r.zone ?? null,
  });
  if (error) return { err: said(error) };
  saveLastStart(r);
  await refreshFreeNow();
  return { notified: data?.notified ?? 0, others: data?.others ?? 0 };
}
/** +1 oră (sau alt chef): același anunț, fără notificări noi. */
export async function extendFreeNow(hours = 1) {
  const m = s.me; if (!m) return 'Nu ești pe FreeNow.';
  const { error } = await db().rpc('free_now_set', {
    p_ends_at: new Date(new Date(m.ends_at).getTime() + hours * 3600e3).toISOString(), p_starts_at: m.starts_at, p_moods: m.moods,
    p_audience: m.audience, p_crew: m.crew_id, p_picked: m.picked, p_zone: m.zone,
  });
  await refreshFreeNow();
  return error ? said(error) : null;
}
export async function stopFreeNow() { const { error } = await db().rpc('free_now_stop'); await refreshFreeNow(); return error ? said(error) : null; }
/** „Vin și eu”. `switchOuting`: ieși din ieșirea în care erai. */
export async function joinFree(userId: string, switchOuting = false): Promise<{ err?: string; ask?: boolean }> {
  const { error } = await db().rpc('free_join', { p_user: userId, p_switch: switchOuting });
  await refreshFreeNow();
  if (error) return error.hint === 'switch' || /O schimbi\?/.test(error.message ?? '') ? { ask: true, err: said(error) } : { err: said(error) };
  return {};
}
export async function leaveOuting() { const { error } = await db().rpc('free_leave'); await refreshFreeNow(); return error ? said(error) : null; }
export async function setOutingOpen(open: boolean) { const { error } = await db().rpc('free_outing_open', { p_open: open }); await refreshFreeNow(); return error ? said(error) : null; }
export async function endVoteNow() { const { error } = await db().rpc('free_vote_end'); await refreshFreeNow(); return error ? said(error) : null; }
export async function muteFree(userId: string, on: boolean) { const { error } = await db().rpc('free_mute', { p_user: userId, p_on: on }); await refreshFreeNow(); return error ? said(error) : null; }

/** Bilu alege 3 locuri pentru ieșire: deschise de la ora ieșirii cât ține, după chef-ul celor din ea, pentru câți sunteți. */
export function outingOptions(o: Outing, moods: string[], now = new Date()) {
  const start = o.plan ? new Date(o.plan.starts_at) : new Date(Math.max(now.getTime() + 20 * 60e3, ...s.people.filter((p) => o.members.some((m) => m.id === p.id)).map((p) => new Date(p.starts_at).getTime())));
  const ev = firstDraft(now);
  const hour = start.getTime() - now.getTime() < 25 * 60e3 ? 'acum' : hhmm(start);
  APP.buildStart(askOf({ ...ev, mode: 'loc', hour, people: Math.max(2, o.members.length), vibes: [] }, now), o.has_minor);
  const asked = [...new Set(moods.flatMap((m) => moodOf(m)?.part ?? []))];
  const h = start.getHours();
  const parts = asked.length ? asked : h >= 5 && h < 12 ? ['desert', 'masa', 'promenada'] : h < 17 ? ['masa', 'desert', 'joaca'] : h < 22 ? ['masa', 'pahar', 'joaca'] : ['pahar', 'club', 'gustare'];
  const picked: ReturnType<typeof APP.buildOptions> = [];
  const seen: string[] = [];
  // pe rând din fiecare fel ales, până la 3
  for (let round = 0; round < 3 && picked.length < 3; round++) {
    for (const p of parts) {
      if (picked.length >= 3) break;
      const x = APP.buildOptions(p, seen)[0];
      if (x) { picked.push(x); seen.push(x.place.id); }
    }
  }
  return picked;
}
export async function startOutingVote(o: Outing, moods: string[]): Promise<{ id?: string; err?: string }> {
  const opts = outingOptions(o, moods);
  if (opts.length < 2) return { err: 'Bilu n-a găsit destule locuri deschise acum. Încearcă alt chef.' };
  const today = new Date();
  const at = (slot: string) => { const [hh, mm] = slot.split(':').map(Number); const d = new Date(today); d.setHours(hh, mm, 0, 0); if (d.getTime() < today.getTime() - 6 * 3600e3) d.setDate(d.getDate() + 1); return d; };
  const { data, error } = await db().rpc('free_vote', {
    p_options: opts.map((x) => ({ venue_id: x.place.id, venue_name: x.place.name, details: { title: x.place.title, price: x.price, dist: x.km, slot: x.slot, starts_at: at(x.slot).toISOString() } })),
  });
  await refreshFreeNow();
  if (error) return { err: said(error) };
  return { id: data as string };
}

// ultima alegere (cine te vede, cât timp, chef) rămâne bifată data viitoare
const LAST = 'cefaci.freenow';
export interface LastStart { audience: Audience; crewId?: string | null; picked?: string[]; hours: number; moods: Mood[]; zone: boolean }
export function loadLastStart(): LastStart {
  try { const x = JSON.parse(localStorage.getItem(LAST) ?? 'null'); if (x && x.audience) return x; } catch { /* nimic */ }
  return { audience: 'fof', hours: 2, moods: ['orice'], zone: true };
}
function saveLastStart(r: StartReq) {
  const start = r.startsAt ?? new Date();
  const hours = Math.max(1, Math.round((r.endsAt.getTime() - start.getTime()) / 3600e3));
  try { localStorage.setItem(LAST, JSON.stringify({ audience: r.audience, crewId: r.crewId ?? null, picked: r.picked ?? [], hours: Math.min(hours, 9), moods: r.moods, zone: !!r.zone })); } catch { /* stocare blocată */ }
}

/** „până la 22:00” / „de la 19:00 la 22:00” */
export function spanText(starts: string, ends: string, now = new Date()) {
  const a = new Date(starts), b = new Date(ends);
  return a.getTime() > now.getTime() + 5 * 60e3 ? 'de la ' + hhmm(a) + ' la ' + hhmm(b) : 'până la ' + hhmm(b);
}
/** Zona din cont, fără poziție: „prin Sector 2”. */
export const myZone = () => { const z = APP.zoneName(); return z && !/locația mea|aproape/i.test(z) ? z : null; };

/** „Toată seara” (hours = 0) = până la 02:00 (serverul taie la 05:00 și, sub 18, la 23:00). */
export function endFor(start: Date, hours: number) {
  if (hours) return new Date(start.getTime() + hours * 3600e3);
  const e = new Date(start); e.setHours(2, 0, 0, 0);
  if (e.getTime() <= start.getTime() + 3600e3) e.setDate(e.getDate() + 1);
  if (e.getTime() - start.getTime() > 12 * 3600e3) return new Date(start.getTime() + 4 * 3600e3);
  return e;
}
/** Ții apăsat pe FreeNow (Acasă): intri acum, cu alegerile de data trecută (prima dată: 2 ore, orice, prietenii și prietenii lor). */
export function quickStart() {
  const l = loadLastStart();
  const now = new Date();
  return startFreeNow({ startsAt: null, endsAt: endFor(now, l.hours > 3 ? 0 : l.hours || 2), moods: l.moods?.length ? l.moods : ['orice'], audience: l.audience,
    crewId: l.crewId ?? null, picked: l.picked ?? [], zone: l.zone ? myZone() : null });
}
