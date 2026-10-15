import { useEffect, useState, useRef } from "react";
import { View, TextInput } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraScanner } from "../../../shared/CameraScanner";
import {
  RequestScope,
  type PlanState,
  type Drop,
} from "../../../shared/contracts";
import {
  refreshPartner,
  requestReservation,
  proposalAnswer,
  ticketOf,
  dropsOf,
  claimDrop,
  countAnswer,
  watchPartner,
  reportRefusal,
  saveGuestAges,
} from "../lib/partner";
import { APP } from "../../../src/app/bridge";
import { type Plan, updPlan } from "../lib/plans";
import { useApp } from "../lib/session";
import { checkIn } from "../lib/outing";
import { Big, Muted, T } from "./kit";
import { F, useTheme } from "./theme";
import { tr, trServer, locale } from "../lib/i18n";
export function PartnerTicket({ plan }: { plan: Plan }) {
  const scope = useRef(new RequestScope()),
    running = useRef(false);
  const partner = APP.partnerInfo(plan.placeId);
  const { t } = useTheme();
  const user = useApp((s) => s.who?.id);
  const [state, setState] = useState<PlanState | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [ticket, setTicket] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [token, setToken] = useState("");
  const [kids, setKids] = useState("0");
  const [seats, setSeats] = useState("1");
  const [reason, setReason] = useState("");
  const [guestAges, setGuestAges] = useState("");
  useEffect(() => {
    scope.current.invalidate();
    running.current = false;
    setBusy(false);
    setCamera(false);
    setMessage("");
    let live = true;
    let seq = 0;
    setState(null);
    setTicket("");
    setDrops([]);
    const load = async () => {
      const n = ++seq;
      try {
        const result = await refreshPartner(plan);
        if (!live || n !== seq) return;
        setState(result);
        if (result.attendance?.ready) {
          const [q, d] = await Promise.all([
            ticketOf(result.attendance.plan),
            dropsOf(result.attendance.plan),
          ]);
          if (live && n === seq) {
            setTicket(q.token);
            setDrops(d);
          }
        }
      } catch (e) {
        if (live && n === seq) setMessage(trServer((e as Error).message));
      }
    };
    void load();
    const stop = watchPartner(plan.sid, () => void load());
    return () => {
      scope.current.invalidate();
      live = false;
      seq++;
      stop();
    };
  }, [plan.pid, plan.sid, user]);
  const act = async (work: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    const valid = scope.current.capture();
    setBusy(true);
    setMessage("");
    try {
      await work();
      if (!valid()) return;
      const next = await refreshPartner(plan);
      if (valid()) setState(next);
    } catch (e) {
      if (valid()) setMessage(trServer((e as Error).message));
    } finally {
      if (valid()) {
        running.current = false;
        setBusy(false);
      }
    }
  };
  const r = state?.reservation;
  const c = state?.count;
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 14,
        padding: 16,
        gap: 12,
        borderRadius: 20,
        backgroundColor: t.s1,
        borderColor: t.line,
        borderWidth: 1,
      }}
    >
      <T style={{ fontFamily: F.display, fontSize: 20 }}>{tr("Prin CeFaci")}</T>
      <Muted>
        {state?.attendance?.ready
          ? tr("{n} persoane în grupul final", { n: state.attendance.people })
          : tr("Așteptăm răspunsurile. Termen: {t}.", { t: state?.attendance?.deadline ? new Date(state.attendance.deadline).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) : tr("30 de minute de la trimitere") })}
      </Muted>
      {!!state?.attendance?.guests &&
        plan.owner !== false &&
        !state.visit &&
        !state.claim && (
          <>
            <Muted>{tr("{n} invitați fără cont. Pentru oferte 18+, completează vârstele separate prin virgulă (de exemplu: 25, 32).", { n: state.attendance.guests })}</Muted>
            <TextInput
              accessibilityLabel={tr("Vârste invitați fără cont")}
              value={guestAges}
              onChangeText={setGuestAges}
              keyboardType="numbers-and-punctuation"
              style={{
                color: t.ink,
                padding: 12,
                borderColor: t.line,
                borderWidth: 1,
                borderRadius: 12,
              }}
            />
            <Big
              label={tr("Salvează vârstele")}
              disabled={busy}
              onPress={() =>
                void act(() =>
                  saveGuestAges(
                    state.attendance!.plan,
                    guestAges
                      .split(",")
                      .map((s) => (s.trim() === "" ? NaN : Number(s.trim()))),
                  ),
                )
              }
            />
          </>
        )}
      {partner?.mode === "recommended" && !partner.reservations_on && (
        <Muted>{tr("Poți merge direct. Momentan nu acceptă rezervări.")}</Muted>
      )}
      {r && (
        <T>{tr("Rezervare {status} · {at}", { status: tr(r.status), at: new Date(r.at).toLocaleString(locale()) })}</T>
      )}
      {partner?.mode !== "none" &&
        partner?.reservations_on &&
        (!r || ["expirată", "anulată", "refuzată"].includes(r.status)) &&
        plan.owner !== false && (
          <>
            <Muted>{tr("Copii sub 12 ani, incluși în grup:")}</Muted>
            <TextInput
              accessibilityLabel={tr("Copii sub 12 ani")}
              keyboardType="number-pad"
              value={kids}
              onChangeText={setKids}
              style={{
                color: t.ink,
                padding: 12,
                borderColor: t.line,
                borderWidth: 1,
                borderRadius: 12,
              }}
            />
            <Big
              label={busy ? tr("Trimit…") : tr("Rezervă pentru noi")}
              disabled={busy || !state?.attendance?.ready}
              onPress={() =>
                void act(async () => {
                  if (r)
                    updPlan(plan.pid, {
                      reservationAttempt: (plan.reservationAttempt ?? 0) + 1,
                    });
                  await requestReservation(
                    {
                      ...plan,
                      reservationAttempt: r
                        ? (plan.reservationAttempt ?? 0) + 1
                        : plan.reservationAttempt,
                    },
                    Number(kids),
                  );
                })
              }
            />
          </>
        )}
      {r?.status === "propusă" && plan.owner !== false && (
        <>
          <Muted>{tr("Acceptă înainte de {t}", { t: new Date(r.proposal_expires_at!).toLocaleTimeString(locale()) })}</Muted>
          <Big
            label={tr("Accept ora")}
            disabled={busy}
            onPress={() => void act(() => proposalAnswer(r.id, true))}
          />
          <Big
            label={tr("Refuz propunerea")}
            color={t.s2}
            ink={t.ink}
            disabled={busy}
            onPress={() => void act(() => proposalAnswer(r.id, false))}
          />
        </>
      )}
      {ticket && (
        <View style={{ alignItems: "center", gap: 8 }}>
          <QRCode value={ticket} size={160} />
          <Muted>{tr("Biletul grupului pentru scannerul localului")}</Muted>
          <T selectable>{ticket}</T>
        </View>
      )}
      {drops.length > 0 &&
        plan.owner !== false &&
        (!state?.claim ||
          state.claim.status === "anulat" ||
          new Date(state.claim.expires_at).getTime() <= Date.now()) && (
          <>
            <Muted>
              {tr("Locuri Drop (maximum șase, distinct de mărimea grupului):")}
            </Muted>
            <TextInput
              accessibilityLabel={tr("Locuri Drop")}
              value={seats}
              onChangeText={setSeats}
              keyboardType="number-pad"
              style={{
                color: t.ink,
                padding: 12,
                borderColor: t.line,
                borderWidth: 1,
                borderRadius: 12,
              }}
            />
            {drops.map((d) => (
              <Big
                key={d.id}
                label={tr("{title} · −{pct}% · {seats} locuri", { title: d.title, pct: d.pct, seats: d.seats })}
                disabled={busy}
                onPress={() =>
                  void act(() =>
                    claimDrop(plan, d.id, Number(seats), state?.claim?.id),
                  )
                }
              />
            ))}
          </>
        )}
      {state?.claim && (
        <Muted>{tr("Drop {status} · {seats} locuri · valabil până la {t}", { status: tr(state.claim.status), seats: state.claim.seats, t: new Date(state.claim.expires_at).toLocaleTimeString(locale()) })}</Muted>
      )}
      {!plan.inAt && (
        <>
          <Big
            label={tr("Scanează codul localului")}
            disabled={busy}
            onPress={() => setCamera(true)}
          />
          {camera && (
            <CameraScanner
              onScan={(code) => {
                setCamera(false);
                void act(async () => {
                  const result = await checkIn(plan, code);
                  setMessage(result.msg);
                  if (!result.ok) throw new Error(result.msg);
                });
              }}
              onClose={() => setCamera(false)}
            />
          )}
          <TextInput
            accessibilityLabel={tr("Codul localului")}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            style={{
              color: t.ink,
              padding: 12,
              borderColor: t.line,
              borderWidth: 1,
              borderRadius: 12,
            }}
          />
          <Big
            label={tr("Confirmă sosirea cu codul")}
            disabled={busy || !token.trim()}
            color={t.s2}
            ink={t.ink}
            onPress={() =>
              void act(async () => {
                const result = await checkIn(plan, token.trim());
                setMessage(result.msg);
                if (!result.ok) throw new Error(result.msg);
              })
            }
          />
        </>
      )}
      {state?.visit && (
        <Muted>{tr("Reducere {pct}% · {scope}.", { pct: state.visit.discount_pct ?? 0, scope: state.visit.discount_scope === "eligible_consumption" ? tr("numai consumul celor {n} persoane Drop, produse sau bon separat", { n: state.visit.discount_people }) : tr("întreaga notă eligibilă, fără cumul") })}</Muted>
      )}
      {c?.state === "awaiting" && (
        <>
          <T>{tr("Localul declară {people} persoane, {adults} de minimum 12 ani și {drop} eligibile Drop. Este corect?", { people: c.people, adults: c.adults, drop: c.drop_adults })}</T>
          <Big
            label={tr("Da, confirm numărul")}
            disabled={busy}
            onPress={() =>
              void act(() => countAnswer(c.visit_id, c.version, true))
            }
          />
          <Big
            label={tr("Nu, contest numărul")}
            disabled={busy}
            color={t.s2}
            ink={t.ink}
            onPress={() =>
              void act(() => countAnswer(c.visit_id, c.version, false))
            }
          />
        </>
      )}
      {state?.benefit && (
        <Muted>{tr("Sesizare reducere: {state}.", { state: state.benefit.state === "pending" ? tr("în verificare") : state.benefit.state === "upheld" ? tr("confirmată de CeFaci") : tr("închisă") }) + " " + trServer(state.benefit.reply ?? "")}</Muted>
      )}
      {state?.visit &&
        (state.visit.discount_pct ?? 0) > 0 &&
        !state.benefit && (
          <>
            <Muted>
              {tr("Dacă reducerea a fost refuzată, spune-ne în maximum 24 de ore. Eligibilitatea rămâne distinctă.")}
            </Muted>
            <TextInput
              accessibilityLabel={tr("Reducerea refuzată")}
              value={reason}
              onChangeText={setReason}
              multiline
              style={{
                color: t.ink,
                padding: 12,
                borderColor: t.line,
                borderWidth: 1,
                borderRadius: 12,
              }}
            />
            <Big
              label={tr("Raportează reducerea refuzată")}
              disabled={busy || reason.trim().length < 5}
              color={t.s2}
              ink={t.ink}
              onPress={() =>
                void act(() => reportRefusal(state.visit!.id, reason))
              }
            />
          </>
        )}
      {!!message && (
        <T accessibilityRole="alert" style={{ color: t.coralInk }}>
          {message}
        </T>
      )}
    </View>
  );
}
