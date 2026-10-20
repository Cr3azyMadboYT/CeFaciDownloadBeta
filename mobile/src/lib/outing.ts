// A real outing: check-in by location at the place (non-partners; partners will also have the QR at the bar),
// then, optionally, the photo of the fiscal receipt (read on the server by "citeste-bon") for +25 XP.
// Each place checked in gives a stamp in the passport (Profil) and XP. Saved with the board (and the account).
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { APP } from '../../../src/app/bridge';
import { km } from '../../../src/engine/core';
import { sb } from './auth';
import { captureAccount, getApp, setBoard } from './session';
import { isTonight, planDay, updPlan, type Plan } from './plans';
import { cancelReminders, remindBill } from './remind';
import { levelOf } from './levels';
import { arrivePartner } from './partner';
import { tr, trServer, pick } from '../../../src/i18n';
import { fixIfAllowed, lei } from './entry';
import { groupName, type Entry } from '../../../shared/entries';

export interface Stamp { id: string; name: string; icon: string; bg: string; at: number }
export interface Bill { placeId: string; total: number; people: number; at: number }
export const NO_STAMPS: Stamp[] = [];

const XP_OUTING = 100; // „Ieșire bifată”
const XP_NEW = 50;     // „Loc nou pentru tine”
const XP_BILL = 25;    // poza bonului
const XP_KIND = 75;    // „Categorie nouă”: the first park, the first museum, the first club…

/** Sets XP to what the server counted; crossing into a new level shows the "Nivel nou" card. */
export function setXp(total: number, extra: Record<string, unknown> = {}) {
  const before = (getApp().board.xp as number | undefined) ?? 0;
  setBoard({ xp: total, ...extra, ...(levelOf(total) > levelOf(before) ? { levelUp: levelOf(total) } : {}) });
}
/** Adds XP (phone only, without an account); crossing into a new level shows the "Nivel nou" card. */
export function gainXp(n: number, extra: Record<string, unknown> = {}) {
  const before = (getApp().board.xp as number | undefined) ?? 0;
  const after = before + n;
  setBoard({ xp: after, ...extra, ...(levelOf(after) > levelOf(before) ? { levelUp: levelOf(after) } : {}) });
}
const accountChanged = () => ({ ok: false, msg: tr('Contul s-a schimbat. Reia operațiunea din contul curent.') });
const NEAR_M = 250;    // how close counts as "at the place"

const CAT_WORD: Record<string, string> = { mancare: 'restaurant', cafea: 'cafenea', desert: 'desert', bar: 'bar', club: 'club', film: 'film', teatru: 'teatru', cultura: 'muzeu', activitate: 'o activitate', natura: 'aer liber', sport: 'sport' };
const CAT_WORD_EN: Record<string, string> = { mancare: 'a restaurant', cafea: 'a café', desert: 'a dessert place', bar: 'a bar', club: 'a club', film: 'the movies', teatru: 'the theatre', cultura: 'a museum', activitate: 'an activity', natura: 'the great outdoors', sport: 'sport' };
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** "Sunt aici": checks the phone is at the place, then stamps the passport. With an account the server checks it
 *  again and writes the XP (xp_check_in); the phone only shows what the server counted. Returns a message. */
export async function checkIn(pl: Plan, venueToken?:string): Promise<{ ok: boolean; msg: string; entry?: Entry | null }> {
  const valid = captureAccount();
  const p = APP.byId(pl.placeId);
  if (!p) return { ok: false, msg: tr('Nu mai găsim localul ăsta.') };
  if (!isTonight(pl)) return { ok: false, msg: tr('Check-in-ul merge în ziua ieșirii, când ajungi la {name}.', { name: p.name }) };
  if (!!p.partner || !!APP.partnerInfo(p.id)) return arrive(pl, venueToken, valid);
  let here: { lat: number; lon: number; acc: number };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!valid()) return accountChanged();
    if (perm.status !== 'granted') return { ok: false, msg: tr('Pentru check-in avem nevoie de locație. O poți permite din setările telefonului.') };
    const pos = await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000)
      .catch(() => Location.getLastKnownPositionAsync({ maxAge: 5 * 60e3 }));
    if (!pos) return { ok: false, msg: tr('Telefonul nu ne dă locația acum. Mai încearcă puțin afară sau lângă geam.') };
    here = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy ?? 0 };
  } catch {
    return { ok: false, msg: tr('Nu am putut afla locația. Mai încearcă o dată.') };
  }
  if (!valid()) return accountChanged();
  const far = (m: number) => ({ ok: false, msg: tr('Ești la {d} de {name}. Check-in-ul merge când ajungi acolo.', { d: m < 2000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', pick(',', '.')) + ' km', name: p.name }) });
  const dist = km(here, p.real) * 1000;
  if (dist > NEAR_M + Math.min(150, here.acc)) return far(dist);

  if (!valid()) return accountChanged();
  const now = new Date();
  const stamps = (getApp().board.stamps as Stamp[] | undefined) ?? [];
  const isNew = !stamps.some((s) => s.id === p.id);
  let gain: number, newKind: boolean, total: number | null = null;
  if (getApp().known) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb() as any).rpc('xp_check_in', { p_venue: p.id, p_lat: here.lat, p_lon: here.lon, p_acc: here.acc, p_cat: p.real.cat, p_vlat: p.real.lat, p_vlon: p.real.lon });
    if (!valid()) return accountChanged();
    if (error) {
      const m = /departe:(\d+)/.exec(error.message ?? '');
      if (m) return far(Number(m[1]));
      return { ok: false, msg: /fetch|network/i.test(error.message ?? '') ? tr('Nu ajung la server. Verifică internetul și mai încearcă.') : trServer(String(error.message)) };
    }
    const r = data as { gain: number; total: number; new_kind?: boolean; again?: boolean };
    if (r.again) { updPlan(pl.pid, { inAt: pl.inAt ?? hhmm(now) }); return { ok: true, msg: tr('Check-in-ul de azi la {name} e deja făcut.', { name: p.name }) }; }
    gain = r.gain; newKind = !!r.new_kind; total = r.total;
  } else {
    newKind = !stamps.some((s) => APP.byId(s.id)?.real.cat === p.real.cat);
    gain = XP_OUTING + (isNew ? XP_NEW : 0) + (newKind ? XP_KIND : 0);
  }
  updPlan(pl.pid, { inAt: hhmm(now) });
  if (getApp().board.billRemind !== false) void remindBill(p.name, now, pl.pid).then((ids) => { if (!valid()) { void cancelReminders(ids); return; } if (ids.length) updPlan(pl.pid, { remind: ids }); });
  const nextStamps = isNew ? [...stamps, { id: p.id, name: p.name, icon: p.icon, bg: p.bg, at: now.getTime() }] : stamps;
  if (total !== null) setXp(total, { stamps: nextStamps }); else gainXp(gain, { stamps: nextStamps });
  const kindWord = pick(CAT_WORD, CAT_WORD_EN)[p.real.cat];
  return { ok: true, msg: '+' + gain + ' XP' + (isNew ? tr('. Ștampila de la {name} e în carnet.', { name: p.name }) : tr('. Ieșire bifată.')) + (newKind && kindWord ? tr(' Prima ta ieșire la {kind}: +75 XP.', { kind: kindWord }) : '') + tr(' Păstrează bonul la final, îți mai aduce 25 XP.') };
}

/** A partner venue (docs/flux-intrare-bon.md, pasul 3): the CeFaci code on the table is enough. The location is
 *  optional: asked for nowhere here, sent only when it is already allowed and the phone is next to the place. Returns
 *  the entry (#12 · Andrei + 4); a second person of the same group lands in the same one. */
async function arrive(pl: Plan, token: string | undefined, valid: () => boolean): Promise<{ ok: boolean; msg: string; entry?: Entry | null }> {
  const p = APP.byId(pl.placeId)!;
  const code = token?.trim();
  if (!code) return { ok: false, msg: tr('Scanează codul CeFaci de pe masă sau de la bar.') };
  const fix = await fixIfAllowed();
  if (!valid()) return accountChanged();
  const near = fix && km(fix, p.real) * 1000 <= NEAR_M + Math.min(150, fix.acc) ? fix : null;
  let entry: Entry | null;
  try { entry = (await arrivePartner(pl, code, near)).entry; } catch (e) { return { ok: false, msg: trServer((e as Error).message) }; }
  if (!valid()) return accountChanged();
  const now = new Date();
  const stamps = (getApp().board.stamps as Stamp[] | undefined) ?? [];
  const nextStamps = stamps.some((s) => s.id === p.id) ? stamps : [...stamps, { id: p.id, name: p.name, icon: p.icon, bg: p.bg, at: now.getTime() }];
  // the check-in XP needs the position (the server checks it again); without it the receipt still brings +25 XP
  let total: number | null = null;
  if (near && getApp().known) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb() as any).rpc('xp_check_in', { p_venue: p.id, p_lat: near.lat, p_lon: near.lon, p_acc: near.acc, p_cat: p.real.cat, p_vlat: p.real.lat, p_vlon: p.real.lon });
    if (!valid()) return accountChanged();
    if (!error && typeof (data as { total?: number })?.total === 'number') total = (data as { total: number }).total;
  }
  if (getApp().board.billRemind !== false && !pl.remind?.length) void remindBill(p.name, now, pl.pid).then((ids) => { if (!valid()) { void cancelReminders(ids); return; } if (ids.length) updPlan(pl.pid, { remind: ids }); });
  if (total !== null) setXp(total, { stamps: nextStamps }); else setBoard({ stamps: nextStamps });
  return { ok: true, msg: entry ? tr('Ați ajuns! Intrarea #{no} · {group}', { no: entry.no, group: groupName(entry) }) : tr('Ați ajuns! Sosirea e salvată.'), entry };
}

/** The receipt photo: camera (or gallery), read on the server, checked against the place's day, +25 XP. */
export async function sendBill(pl: Plan, from: 'camera' | 'gallery'): Promise<{ ok: boolean; msg: string; entry?: Entry | null; duplicate?: boolean; total?: number } | null> {
  const valid = captureAccount();
  if (!getApp().known) return { ok: false, msg: tr('Bonul se citește doar cu cont. Intră din Profil → Prieteni.') };
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : null;
  if (!valid()) return accountChanged();
  if (perm && !perm.granted) return { ok: false, msg: tr('Pentru poza bonului avem nevoie de cameră.') };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6, allowsEditing: false, exif: false };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (!valid()) return accountChanged();
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  const day = planDay(pl);
  const dayIso = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
  const { data, error } = await sb().functions.invoke('citeste-bon', { body: { image: res.assets[0].base64, venue: pl.placeId, day: dayIso, visit: pl.visitId ?? ((getApp().board.plans as Plan[]|undefined)??[]).find(p=>p.pid===pl.pid)?.visitId } });
  if (!valid()) return accountChanged();
  // the server said no before reading the photo (no check-in, already put, too late, enough photos today): say why
  const early = !error ? (data?.xp as { error?: string } | undefined)?.error : undefined;
  if (early && !data?.bon) {
    if (/Bonul (vizitei|de la locul).*deja pus/i.test(early)) { updPlan(pl.pid, { bonDone: true, remind: [] }); void cancelReminders(pl.remind); return { ok: true, msg: trServer(early) }; }
    return { ok: false, msg: trServer(early) };
  }
  if (error || !data?.bon) {
    let msg = tr('Nu am putut citi bonul acum. Mai încearcă puțin mai târziu.');
    try { const body = await (error as { context?: Response })?.context?.json(); if (body?.error) msg = trServer(body.error); } catch { /* keep the general message */ }
    return { ok: false, msg };
  }
  const bon = data.bon as { date: string | null; time: string | null; total: number | null };
  const xp = data.xp as { gain: number; total?: number; error?: string } | undefined;
  const iso = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
  const next = new Date(day.getTime() + 864e5);
  const isoNext = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
  // a partner venue's entry (20.10): the receipt is on the entry; the same receipt scanned again by someone of the
  // group counts once (duplicate), and each person gets the +25 XP once per entry
  const receipt = data.receipt as { ok: boolean; visit?: string; duplicate?: boolean } | undefined;
  if (receipt?.ok) {
    updPlan(pl.pid, { bonDone: true, remind: [] });
    void cancelReminders(pl.remind);
    const b = getApp().board;
    const extra = xp?.gain ? { billXp: ((b.billXp as number | undefined) ?? 0) + xp.gain, bills: [...((b.bills as Bill[] | undefined) ?? []), { placeId: pl.placeId, total: bon.total ?? 0, people: pl.people, at: Date.now() }] } : {};
    if (xp?.total !== undefined) setXp(xp.total, extra); else if (xp?.gain) gainXp(xp.gain, extra);
    const msg = (bon.total ? tr('Bon citit: {total}', { total: lei(bon.total) }) : tr('Bonul e la intrare.'))
      + (receipt.duplicate ? ' ' + tr('Bonul ăsta e deja scanat de cineva din gașcă — e numărat o dată.') : '')
      + (xp?.gain ? ' +' + xp.gain + ' XP.' : '');
    return { ok: true, msg, entry: (data.entry as Entry | undefined) ?? null, duplicate: !!receipt.duplicate, total: bon.total ?? undefined };
  }
  if (!bon.total) return { ok: false, msg: tr('Nu văd totalul pe bon. Fă poza mai de aproape, cu tot bonul în cadru.') };
  if (bon.date && bon.date !== iso && bon.date !== isoNext) return { ok: false, msg: tr('Bonul e din altă zi ({d}). Pune bonul de la ieșirea asta.', { d: bon.date.split('-').reverse().join('.') }) };
  // the server writes the +25 only after a check-in there; the receipt still counts for the real prices
  if (xp?.error && !xp.gain) {
    if (/Bonul (vizitei|de la locul).*deja pus/i.test(xp.error)) { updPlan(pl.pid, { bonDone: true, remind: [] }); void cancelReminders(pl.remind); return { ok: true, msg: trServer(xp.error) }; }
    return { ok: false, msg: trServer(xp.error) }; // not confirmed (no check-in, CUI or date not seen, the server busy): no +25 here
  }
  updPlan(pl.pid, { bonDone: true, remind: [] });
  void cancelReminders(pl.remind);
  const b = getApp().board;
  const extra = {
    billXp: ((b.billXp as number | undefined) ?? 0) + XP_BILL,
    bills: [...((b.bills as Bill[] | undefined) ?? []), { placeId: pl.placeId, total: bon.total!, people: pl.people, at: Date.now() }],
  };
  if (xp?.total !== undefined) setXp(xp.total, extra); else if(xp?.gain)gainXp(xp.gain, extra);
  return { ok: true, msg: tr('+25 XP. Bonul de {total} lei e confirmat. Mersi că ne ajuți cu prețurile reale!', { total: bon.total.toFixed(2).replace('.', pick(',', '.')) }) };
}
