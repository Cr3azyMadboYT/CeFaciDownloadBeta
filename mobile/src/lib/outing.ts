// A real outing: check-in by location at the place (non-partners; partners will also have the QR at the bar),
// then, optionally, the photo of the fiscal receipt (read on the server by "citeste-bon") for +25 XP.
// Each place checked in gives a stamp in the passport (Profil) and XP. Saved with the board (and the account).
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { APP } from '../../../src/app/bridge';
import { km } from '../../../src/engine/core';
import { sb } from './auth';
import { getApp, setBoard } from './session';
import { planDay, updPlan, type Plan } from './plans';
import { cancelReminders, remindBill } from './remind';
import { levelOf } from './levels';

export interface Stamp { id: string; name: string; icon: string; bg: string; at: number }
export interface Bill { placeId: string; total: number; people: number; at: number }
export const NO_STAMPS: Stamp[] = [];

const XP_OUTING = 100; // „Ieșire bifată”
const XP_NEW = 50;     // „Loc nou pentru tine”
const XP_BILL = 25;    // poza bonului
const XP_KIND = 75;    // „Categorie nouă”: the first park, the first museum, the first club…

/** Adds XP; crossing into a new level shows the "Nivel nou" card (LevelUp, in the root layout). */
export function gainXp(n: number, extra: Record<string, unknown> = {}) {
  const before = (getApp().board.xp as number | undefined) ?? 0;
  const after = before + n;
  setBoard({ xp: after, ...extra, ...(levelOf(after) > levelOf(before) ? { levelUp: levelOf(after) } : {}) });
}
const NEAR_M = 250;    // how close counts as "at the place"

const CAT_WORD: Record<string, string> = { mancare: 'restaurant', cafea: 'cafenea', desert: 'desert', bar: 'bar', club: 'club', film: 'film', teatru: 'teatru', cultura: 'muzeu', activitate: 'o activitate', natura: 'aer liber', sport: 'sport' };
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Sunt aici": checks the phone is at the place, then stamps the passport. Returns a message for the toast. */
export async function checkIn(pl: Plan): Promise<{ ok: boolean; msg: string }> {
  const p = APP.byId(pl.placeId);
  if (!p) return { ok: false, msg: 'Nu mai găsim localul ăsta.' };
  if (!sameDay(planDay(pl), new Date())) return { ok: false, msg: 'Check-in-ul merge în ziua ieșirii, când ajungi la ' + p.name + '.' };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, msg: 'Pentru check-in avem nevoie de locație. O poți permite din setările telefonului.' };
    const pos = await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000)
      .catch(() => Location.getLastKnownPositionAsync({ maxAge: 5 * 60e3 }));
    if (!pos) return { ok: false, msg: 'Telefonul nu ne dă locația acum. Mai încearcă puțin afară sau lângă geam.' };
    const dist = km({ lat: pos.coords.latitude, lon: pos.coords.longitude }, p.real) * 1000;
    if (dist > NEAR_M + Math.min(150, pos.coords.accuracy ?? 0)) {
      return { ok: false, msg: 'Ești la ' + (dist < 2000 ? Math.round(dist / 10) * 10 + ' m' : (dist / 1000).toFixed(1).replace('.', ',') + ' km') + ' de ' + p.name + '. Check-in-ul merge când ajungi acolo.' };
    }
  } catch {
    return { ok: false, msg: 'Nu am putut afla locația. Mai încearcă o dată.' };
  }
  const now = new Date();
  const stamps = (getApp().board.stamps as Stamp[] | undefined) ?? [];
  const isNew = !stamps.some((s) => s.id === p.id);
  const newKind = !stamps.some((s) => APP.byId(s.id)?.real.cat === p.real.cat);
  const gain = XP_OUTING + (isNew ? XP_NEW : 0) + (newKind ? XP_KIND : 0);
  updPlan(pl.pid, { inAt: hhmm(now) });
  if (getApp().board.billRemind !== false) void remindBill(p.name, now).then((ids) => { if (ids.length) updPlan(pl.pid, { remind: ids }); });
  gainXp(gain, { stamps: isNew ? [...stamps, { id: p.id, name: p.name, icon: p.icon, bg: p.bg, at: now.getTime() }] : stamps });
  const kindWord = CAT_WORD[p.real.cat];
  return { ok: true, msg: '+' + gain + ' XP' + (isNew ? '. Ștampila de la ' + p.name + ' e în carnet.' : '. Ieșire bifată.') + (newKind && kindWord ? ' Prima ta ieșire la ' + kindWord + ': +75 XP.' : '') + ' Păstrează bonul la final, îți mai aduce 25 XP.' };
}

/** The receipt photo: camera (or gallery), read on the server, checked against the place's day, +25 XP. */
export async function sendBill(pl: Plan, from: 'camera' | 'gallery'): Promise<{ ok: boolean; msg: string } | null> {
  if (!getApp().known) return { ok: false, msg: 'Bonul se citește doar cu cont. Intră din Profil → Prieteni.' };
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, msg: from === 'camera' ? 'Pentru poza bonului avem nevoie de cameră.' : 'Pentru poza bonului avem nevoie de acces la poze.' };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6, allowsEditing: false };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  const { data, error } = await sb().functions.invoke('citeste-bon', { body: { image: res.assets[0].base64 } });
  if (error || !data?.bon) {
    let msg = 'Nu am putut citi bonul acum. Mai încearcă puțin mai târziu.';
    try { const body = await (error as { context?: Response })?.context?.json(); if (body?.error) msg = body.error; } catch { /* keep the general message */ }
    return { ok: false, msg };
  }
  const bon = data.bon as { date: string | null; time: string | null; total: number | null };
  const day = planDay(pl);
  const iso = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
  const next = new Date(day.getTime() + 864e5);
  const isoNext = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
  if (!bon.total) return { ok: false, msg: 'Nu văd totalul pe bon. Fă poza mai de aproape, cu tot bonul în cadru.' };
  if (bon.date && bon.date !== iso && bon.date !== isoNext) return { ok: false, msg: 'Bonul e din altă zi (' + bon.date.split('-').reverse().join('.') + '). Pune bonul de la ieșirea asta.' };
  updPlan(pl.pid, { bonDone: true, remind: [] });
  void cancelReminders(pl.remind);
  const b = getApp().board;
  gainXp(XP_BILL, {
    billXp: ((b.billXp as number | undefined) ?? 0) + XP_BILL,
    bills: [...((b.bills as Bill[] | undefined) ?? []), { placeId: pl.placeId, total: bon.total!, people: pl.people, at: Date.now() }],
  });
  return { ok: true, msg: '+25 XP. Bonul de ' + bon.total.toFixed(2).replace('.', ',') + ' lei e confirmat. Mersi că ne ajuți cu prețurile reale!' };
}
