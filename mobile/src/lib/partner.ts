import { AppState } from "react-native";
import * as Location from "expo-location";
import { APP } from "../../../src/app/bridge";
import {
  rpc,
  type PlanState,
  type Partner,
  type Drop,
  type Visit,
  type RpcClient,
} from "../../../shared/contracts";
import { sb } from "./auth";
import { getApp } from "./session";
import { startsAt, updPlan, type Plan } from "./plans";
const client = () => sb() as unknown as RpcClient;
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
  const user = getApp().who?.id;
  if (!user) throw new Error("Intră în cont.");
  return lane(user + ":" + pl.createdAt + ":" + pl.pid, async () => {
    const current =
      ((getApp().board.plans as Plan[] | undefined) ?? []).find(
        (p) => p.pid === pl.pid,
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
    if (getApp().who?.id !== user) throw new Error("Contul s-a schimbat.");
    updPlan(pl.pid, { sid: id, owner: true });
    return id;
  });
}
export const stateOf = (sid: string) =>
  rpc<PlanState>(client(), "plan_state_v2", { p_plan: sid });
export async function refreshPartner(pl: Plan) {
  const user = getApp().who?.id;
  const sid = await ensurePlan(pl);
  const state = await stateOf(sid);
  if (user !== getApp().who?.id) throw new Error("Contul s-a schimbat.");
  if (state.attendance) updPlan(pl.pid, { people: state.attendance.people });
  if (state.visit)
    updPlan(pl.pid, {
      visitId: state.visit.id,
      inAt:
        pl.inAt ??
        new Date(state.visit.scanned_at ?? Date.now()).toLocaleTimeString(
          "ro-RO",
          { hour: "2-digit", minute: "2-digit" },
        ),
    });
  return state;
}
export async function requestReservation(pl: Plan, kids = 0) {
  const sid = await ensurePlan(pl);
  await rpc(client(), "reservation_request_v2", {
    p_plan: sid,
    p_key: "reserve:" + sid + ":" + (pl.reservationAttempt ?? 0),
    p_kids: kids,
  });
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
  if (!p.granted) throw new Error("Permite locația pentru această operațiune.");
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
  const sid = await ensurePlan(pl);
  const fix = await position();
  await rpc(client(), "drop_claim_v2", {
    p_drop: drop,
    p_plan: sid,
    p_seats: seats,
    p_lat: fix.lat,
    p_lon: fix.lon,
    p_key: "claim:" + sid + ":" + drop + ":" + (previousClaim ?? "first"),
  });
  return refreshPartner(pl);
}
export async function arrivePartner(
  pl: Plan,
  token: string,
  fix: { lat: number; lon: number },
) {
  const sid = await ensurePlan(pl);
  const user = getApp().who?.id;
  const v = await rpc<Visit>(client(), "visit_client_arrive_v2", {
    p_plan: sid,
    p_token: token,
    p_lat: fix.lat,
    p_lon: fix.lon,
  });
  if (user !== getApp().who?.id) throw new Error("Contul s-a schimbat.");
  updPlan(pl.pid, {
    visitId: v.id,
    inAt: new Date().toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  return v;
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
