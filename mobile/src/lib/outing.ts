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
const accountChanged = () => ({ ok: false, msg: 'Contul s-a schimbat. Reia operațiunea din contul curent.' });
const NEAR_M = 250;    // how close counts as "at the place"

const CAT_WORD: Record<string, string> = { mancare: 'restaurant', cafea: 'cafenea', desert: 'desert', bar: 'bar', club: 'club', film: 'film', teatru: 'teatru', cultura: 'muzeu', activitate: 'o activitate', natura: 'aer liber', sport: 'sport' };
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const hhmm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** "Sunt aici": checks the phone is at the place, then stamps the passport. With an account the server checks it
 *  again and writes the XP (xp_check_in); the phone only shows what the server counted. Returns a message. */
export async function checkIn(pl: Plan, venueToken?:string): Promise<{ ok: boolean; msg: string }> {
  const valid = captureAccount();
  const p = APP.byId(pl.placeId);
  if (!p) return { ok: false, msg: 'Nu mai găsim localul ăsta.' };
  if (!isTonight(pl)) return { ok: false, msg: 'Check-in-ul merge în ziua ieșirii, când ajungi la ' + p.name + '.' };
  let here: { lat: number; lon: number; acc: number };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!valid()) return accountChanged();
    if (perm.status !== 'granted') return { ok: false, msg: 'Pentru check-in avem nevoie de locație. O poți permite din setările telefonului.' };
    const pos = await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000)
      .catch(() => Location.getLastKnownPositionAsync({ maxAge: 5 * 60e3 }));
    if (!pos) return { ok: false, msg: 'Telefonul nu ne dă locația acum. Mai încearcă puțin afară sau lângă geam.' };
    here = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy ?? 0 };
  } catch {
    return { ok: false, msg: 'Nu am putut afla locația. Mai încearcă o dată.' };
  }
  if (!valid()) return accountChanged();
  const far = (m: number) => ({ ok: false, msg: 'Ești la ' + (m < 2000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km') + ' de ' + p.name + '. Check-in-ul merge când ajungi acolo.' });
  const dist = km(here, p.real) * 1000;
  if (dist > NEAR_M + Math.min(150, here.acc)) return far(dist);

  const partnerOuting=!!p.partner || !!APP.partnerInfo(p.id);
  if(partnerOuting){
    if(!venueToken)return {ok:false,msg:'Scanează codul localului din bilet pentru a salva sosirea.'};
    try{await arrivePartner(pl,venueToken,here);}catch(e){return {ok:false,msg:(e as Error).message};}
  }
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
      if(partnerOuting)return {ok:true,msg:'Sosirea este salvată. XP-ul nu a fost acordat: '+error.message};
      const m = /departe:(\d+)/.exec(error.message ?? '');
      if (m) return far(Number(m[1]));
      return { ok: false, msg: /fetch|network/i.test(error.message ?? '') ? 'Nu ajung la server. Verifică internetul și mai încearcă.' : String(error.message) };
    }
    const r = data as { gain: number; total: number; new_kind?: boolean; again?: boolean };
    if (r.again) { updPlan(pl.pid, { inAt: pl.inAt ?? hhmm(now) }); return { ok: true, msg: 'Check-in-ul de azi la ' + p.name + ' e deja făcut.' }; }
    gain = r.gain; newKind = !!r.new_kind; total = r.total;
  } else {
    newKind = !stamps.some((s) => APP.byId(s.id)?.real.cat === p.real.cat);
    gain = XP_OUTING + (isNew ? XP_NEW : 0) + (newKind ? XP_KIND : 0);
  }
  updPlan(pl.pid, { inAt: hhmm(now) });
  if (getApp().board.billRemind !== false) void remindBill(p.name, now, pl.pid).then((ids) => { if (!valid()) { void cancelReminders(ids); return; } if (ids.length) updPlan(pl.pid, { remind: ids }); });
  const nextStamps = isNew ? [...stamps, { id: p.id, name: p.name, icon: p.icon, bg: p.bg, at: now.getTime() }] : stamps;
  if (total !== null) setXp(total, { stamps: nextStamps }); else gainXp(gain, { stamps: nextStamps });
  const kindWord = CAT_WORD[p.real.cat];
  return { ok: true, msg: '+' + gain + ' XP' + (isNew ? '. Ștampila de la ' + p.name + ' e în carnet.' : '. Ieșire bifată.') + (newKind && kindWord ? ' Prima ta ieșire la ' + kindWord + ': +75 XP.' : '') + ' Păstrează bonul la final, îți mai aduce 25 XP.' };
}

/** The receipt photo: camera (or gallery), read on the server, checked against the place's day, +25 XP. */
export async function sendBill(pl: Plan, from: 'camera' | 'gallery'): Promise<{ ok: boolean; msg: string } | null> {
  const valid = captureAccount();
  if (!getApp().known) return { ok: false, msg: 'Bonul se citește doar cu cont. Intră din Profil → Prieteni.' };
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : null;
  if (!valid()) return accountChanged();
  if (perm && !perm.granted) return { ok: false, msg: 'Pentru poza bonului avem nevoie de cameră.' };
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
    if (/Bonul (vizitei|de la locul).*deja pus/i.test(early)) { updPlan(pl.pid, { bonDone: true, remind: [] }); void cancelReminders(pl.remind); return { ok: true, msg: early }; }
    return { ok: false, msg: early };
  }
  if (error || !data?.bon) {
    let msg = 'Nu am putut citi bonul acum. Mai încearcă puțin mai târziu.';
    try { const body = await (error as { context?: Response })?.context?.json(); if (body?.error) msg = body.error; } catch { /* keep the general message */ }
    return { ok: false, msg };
  }
  const bon = data.bon as { date: string | null; time: string | null; total: number | null };
  const xp = data.xp as { gain: number; total?: number; error?: string } | undefined;
  const iso = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
  const next = new Date(day.getTime() + 864e5);
  const isoNext = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
  if (!bon.total) return { ok: false, msg: 'Nu văd totalul pe bon. Fă poza mai de aproape, cu tot bonul în cadru.' };
  if (bon.date && bon.date !== iso && bon.date !== isoNext) return { ok: false, msg: 'Bonul e din altă zi (' + bon.date.split('-').reverse().join('.') + '). Pune bonul de la ieșirea asta.' };
  // the server writes the +25 only after a check-in there; the receipt still counts for the real prices
  if(data.receipt?.ok && (!xp?.gain || xp?.error)){updPlan(pl.pid,{bonDone:true,remind:[]});void cancelReminders(pl.remind);return {ok:true,msg:'Bonul este confirmat în Business. '+(xp?.error??'XP-ul rămâne separat de încasarea localului.')};}
  if (xp?.error && !xp.gain) {
    if (/Bonul (vizitei|de la locul).*deja pus/i.test(xp.error)) { updPlan(pl.pid, { bonDone: true, remind: [] }); void cancelReminders(pl.remind); return { ok: true, msg: xp.error }; }
    return { ok: false, msg: xp.error }; // not confirmed (no check-in, CUI or date not seen, the server busy): no +25 here
  }
  updPlan(pl.pid, { bonDone: true, remind: [] });
  void cancelReminders(pl.remind);
  const b = getApp().board;
  const extra = {
    billXp: ((b.billXp as number | undefined) ?? 0) + XP_BILL,
    bills: [...((b.bills as Bill[] | undefined) ?? []), { placeId: pl.placeId, total: bon.total!, people: pl.people, at: Date.now() }],
  };
  if (xp?.total !== undefined) setXp(xp.total, extra); else if(xp?.gain)gainXp(xp.gain, extra);
  return { ok: true, msg: '+25 XP. Bonul de ' + bon.total.toFixed(2).replace('.', ',') + ' lei e confirmat. Mersi că ne ajuți cu prețurile reale!' };
}
