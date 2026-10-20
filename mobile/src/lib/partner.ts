import { AppState } from "react-native";
import * as Location from "expo-location";
import { APP } from "../../../src/app/bridge";
import {
  rpc,
  claimKey,
  type PlanState,
  type Partner,
  type Drop,
  type Visit,
  type RpcClient,
} from "../../../shared/contracts";
import { sb } from "./auth";
import { captureAccount, getApp } from "./session";
import { startsAt, updPlan, type Plan } from "./plans";
import { tr } from "../../../src/i18n";
import { entryOf } from "./entry";
import type { Entry } from "../../../shared/entries";
const client = () => sb() as unknown as RpcClient;
const assertAccount = (valid: () => boolean) => { if (!valid()) throw new Error(tr("Contul s-a schimbat. Reia operațiunea din contul curent.")); };
const serial = new Map<string, Promise<unknown>>();
function lane<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (serial.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(work);
  serial.set(key, next);
  void next
    .finally(() => {
      if (serial.get(key) === next) serial.delete(key);
    })
    .catch(() => {});
  return next;
}
export async function ensurePlan(
  pl: Plan,
  to: { crewId?: string | null; friendIds?: string[]; guests?: number } = {},
): Promise<string> {
  const valid = captureAccount();
  const user = getApp().who?.id;
  if (!user) throw new Error(tr("Intră în cont."));
  return lane(user + ":" + pl.createdAt + ":" + pl.pid, async () => {
    assertAccount(valid);
    const current =
      ((getApp().board.plans as Plan[] | undefined) ?? []).find(
        (p) => p.pid === pl.pid && p.createdAt === pl.createdAt,
      ) ?? pl;
    if (current.sid && !to.crewId && !to.friendIds?.length) return current.sid;
    const ids = to.friendIds ?? [];
    const id = await rpc<string>(client(), "plan_share_v2", {
      p_key: "native:" + current.createdAt + ":" + current.pid,
      p_venue: pl.placeId,
      p_at: startsAt(current).toISOString(),
      p_people: current.people,
      p_friends: ids,
      p_crew: to.crewId ?? null,
      p_guests: to.guests ?? 0,
      p_existing: current.sid ?? null,
    });
    assertAccount(valid);
    updPlan(pl.pid, { sid: id, owner: true });
    return id;
  });
}
export const stateOf = (sid: string) =>
  rpc<PlanState>(client(), "plan_state_v2", { p_plan: sid });
export async function refreshPartner(pl: Plan) {
  const valid = captureAccount();
  const user = getApp().who?.id;
  const sid = await ensurePlan(pl);
  assertAccount(valid);
  const state = await stateOf(sid);
  assertAccount(valid);
  if (state.attendance) updPlan(pl.pid, { people: state.attendance.people });
  if (state.visit)
    updPlan(pl.pid, {
      later: undefined,
      visitId: state.visit.id,
      inAt:
        pl.inAt ??
        new Date(state.visit.scanned_at ?? Date.now()).toLocaleTimeString(
          "ro-RO",
          { hour: "2-digit", minute: "2-digit" },
        ),
    });
  return Object.assign(state, { sid });
}
export async function requestReservation(pl: Plan, kids = 0) {
  const valid = captureAccount();
  const sid = await ensurePlan(pl);
  assertAccount(valid);
  await rpc(client(), "reservation_request_v2", {
    p_plan: sid,
    p_key: "reserve:" + sid + ":" + (pl.reservationAttempt ?? 0),
    p_kids: kids,
  });
  assertAccount(valid);
  return refreshPartner(pl);
}
export const proposalAnswer = (id: string, accept: boolean) =>
  rpc(client(), "reservation_proposal_answer", { p_id: id, p_accept: accept });
export const ticketOf = (sid: string) =>
  rpc<{ token: string; people: number; expires_at: string }>(
    client(),
    "plan_ticket_v2",
    { p_plan: sid },
  );
export const dropsOf = (sid: string) =>
  rpc<Drop[]>(client(), "drop_feed_v2", { p_plan: sid });
export const countAnswer = (visit: string, version: number, confirm: boolean) =>
  rpc(client(), "visit_count_answer_v2", {
    p_visit: visit,
    p_version: version,
    p_confirm: confirm,
  });
export const saveGuestAges = (sid: string, ages: number[]) =>
  rpc(client(), "plan_guest_ages_v2", { p_plan: sid, p_ages: ages });
export async function position() {
  const p = await Location.requestForegroundPermissionsAsync();
  if (!p.granted) throw new Error(tr("Permite locația pentru această operațiune."));
  const fix = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: fix.coords.latitude, lon: fix.coords.longitude };
}
export async function claimDrop(
  pl: Plan,
  drop: string,
  seats: number,
  previousClaim?: string,
) {
  const valid = captureAccount();
  const sid = await ensurePlan(pl);
  assertAccount(valid);
  const fix = await position();
  assertAccount(valid);
  await rpc(client(), "drop_claim_v2", {
    p_drop: drop,
    p_plan: sid,
    p_seats: seats,
    p_lat: fix.lat,
    p_lon: fix.lon,
    p_key: claimKey(sid, drop, previousClaim),
  });
  assertAccount(valid);
  return refreshPartner(pl);
}
/** Codul de pe masă scanat: sosirea gășcii (o singură intrare pe plan; al doilea om care scanează ajunge în aceeași).
 *  Locația e opțională (20.10): codul ajunge; poziția se trimite doar când o avem și e lângă local. */
export async function arrivePartner(
  pl: Plan,
  token: string,
  fix: { lat: number; lon: number } | null,
): Promise<{ visit: Visit; entry: Entry | null }> {
  const valid = captureAccount();
  const sid = await ensurePlan(pl);
  assertAccount(valid);
  const v = await rpc<Visit>(client(), "visit_client_arrive_v2", {
    p_plan: sid,
    p_token: token,
    p_lat: fix?.lat ?? null,
    p_lon: fix?.lon ?? null,
  });
  assertAccount(valid);
  const entry = await entryOf(sid).catch(() => null);
  assertAccount(valid);
  updPlan(pl.pid, {
    visitId: v.id,
    later: undefined,
    ...(entry ? { entryNo: entry.no } : {}),
    inAt: new Date().toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  return { visit: v, entry };
}
export async function syncPartners() {
  const catalog = await rpc<Partner[]>(client(), "partner_catalog");
  APP.setPartnerCatalog(catalog);
}
export function watchPartner(sid: string | undefined, cb: () => void) {
  const ch = sb()
    .channel("outing-" + (sid ?? "catalog") + "-" + Math.random())
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "outing_events" },
      () => cb(),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") cb();
    });
  const timer = setInterval(cb, 15000);
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") cb();
  });
  return () => {
    clearInterval(timer);
    sub.remove();
    void sb().removeChannel(ch);
  };
}

export const reportRefusal = (visit: string, reason: string) =>
  rpc(client(), "visit_benefit_report_v2", {
    p_visit: visit,
    p_reason: reason,
  });
