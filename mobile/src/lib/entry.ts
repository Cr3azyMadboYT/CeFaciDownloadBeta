// Intrarea la un local partener (Cornel, 20.10; docs/flux-intrare-bon.md): „Ai ajuns?” în fereastra planului (cu
// locația doar dacă e deja permisă, fără să o cerem), codul de pe masă, masa și bonurile intrării. Banii (10% din bon)
// îi calculează serverul; aici doar întrebăm și arătăm ce a numărat el (visit_entry_v3).
import * as Location from 'expo-location';
import { APP } from '../../../src/app/bridge';
import { km } from '../../../src/engine/core';
import { rpc, type RpcClient } from '../../../shared/contracts';
import { money, type Entry } from '../../../shared/entries';
import { sb } from './auth';
import { startsAt, updPlan, type Plan } from './plans';
import { pick } from '../../../src/i18n';

const client = () => sb() as unknown as RpcClient;
export const ARRIVE_BEFORE = 30 * 60e3;  // „Ai ajuns?” de la 30 de minute înainte de ora planului…
export const ARRIVE_AFTER = 3 * 3600e3;  // …până la 3 ore după
export const ARRIVE_NEAR_M = 150;        // cu locația: când telefonul e la cel mult 150 m de local
export const LATER_MS = 15 * 60e3;       // „Încă nu”: întrebăm din nou peste 15 minute

/** „420,00 lei” (în engleză „420.00 lei”). */
export const lei = (n: number) => pick(money(n), n.toFixed(2) + ' lei');
/** „40 m”, „1,2 km”. */
export const meters = (m: number) => (m < 1000 ? Math.max(10, Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1).replace('.', pick(',', '.')) + ' km');

/** Planul e la un local partener (biletul „Prin CeFaci”, intrarea cu codul de pe masă). */
export function isPartnerPlan(pl: Plan) {
  const p = APP.byId(pl.placeId);
  return !!p && (!!p.partner || !!APP.partnerInfo(p.id));
}
/** În fereastra planului: de la 30 de minute înainte până la 3 ore după (planurile „acum” încep când au fost făcute). */
export function arriveWindow(pl: Plan, now = Date.now()) {
  const s = startsAt(pl).getTime();
  return now >= s - ARRIVE_BEFORE && now <= s + ARRIVE_AFTER;
}
/** Întrebăm „Ai ajuns?”: partener, încă nesosiți, în fereastră și fără „Încă nu” de curând. */
export const askArrive = (pl: Plan, now = Date.now()) => isPartnerPlan(pl) && !pl.inAt && arriveWindow(pl, now) && !(pl.later && pl.later > now);
export const arriveLater = (pl: Plan) => updPlan(pl.pid, { later: Date.now() + LATER_MS });

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
/** Poziția telefonului doar dacă locația e deja permisă (nu cerem voie de aici); altfel null. */
export async function fixIfAllowed(): Promise<{ lat: number; lon: number; acc: number } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000)
      .catch(() => Location.getLastKnownPositionAsync({ maxAge: 2 * 60e3 }));
    return pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy ?? 0 } : null;
  } catch {
    return null;
  }
}
/** Cât de departe e telefonul de localul planului, în metri. */
export function distTo(pl: Plan, fix: { lat: number; lon: number }) {
  const p = APP.byId(pl.placeId);
  return p ? km(fix, p.real) * 1000 : Infinity;
}

/** Intrarea planului, cum o vede serverul (numărul, masa, bonurile, „scanat de 3/5”); null înainte de sosire. */
export const entryOf = (sid: string) => rpc<Entry | null>(client(), 'visit_entry_v3', { p_plan: sid });
/** Masa (oricine din gașcă a zis „Vin”); null o șterge. */
export const saveTable = (visit: string, table: string | null) => rpc(client(), 'visit_table_v3', { p_visit: visit, p_table: table?.trim() || null });
