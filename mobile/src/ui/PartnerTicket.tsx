// „Prin CeFaci” pe bilet: rezervarea, Drop-urile și intrarea (docs/flux-intrare-bon.md): „Ai ajuns?”, codul de pe
// masă, masa, bonurile intrării și biletul la plată. Piesele intrării sunt în ui/EntryFlow (aceleași în simulare).
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
  watchPartner,
  reportRefusal,
  saveGuestAges,
} from "../lib/partner";
import { APP } from "../../../src/app/bridge";
import { isTonight, type Plan, updPlan } from "../lib/plans";
import { getApp, useApp } from "../lib/session";
import { checkIn, sendBill } from "../lib/outing";
import { arriveLater, entryOf, saveTable } from "../lib/entry";
import { useArrive } from "../lib/arrive";
import { groupName, type Entry } from "../../../shared/entries";
import { ArrivePrompt, Arrived, BillPick, EntryCard, PayTicket, TablePick, TableScan } from "./EntryFlow";
import { Big, Muted, Sheet, T } from "./kit";
import { F, useTheme } from "./theme";
import { tr, trServer, locale } from "../lib/i18n";
/** `focus`: opened from a notification — „arrive” opens the table code, „bon” the receipt. */
export function PartnerTicket({ plan, focus }: { plan: Plan; focus?: string }) {
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
  const [entry, setEntry] = useState<Entry | null>(null);
  const [scan, setScan] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [table, setTable] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState("");
  const [scanKey, setScanKey] = useState(0);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const arrive = useArrive(plan);
  const place = APP.byId(plan.placeId);
  const focused = useRef("");
  useEffect(() => {
    // from a notification: once per opening
    if (!focus || focused.current === focus + plan.pid) return;
    if (focus === "arrive" && !plan.inAt) { focused.current = focus + plan.pid; setScan(true); }
    if (focus === "bon" && plan.inAt) { focused.current = focus + plan.pid; setBillOpen(true); }
  }, [focus, plan.pid, plan.inAt]);
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
    setEntry(null);
    setNote(null);
    const load = async () => {
      const n = ++seq;
      try {
        const result = await refreshPartner(plan);
        if (!live || n !== seq) return;
        setState(result);
        if (result.visit) {
          const e = await entryOf(result.sid).catch(() => null);
          if (live && n === seq && e) { setEntry(e); if (e.no !== plan.entryNo) updPlan(plan.pid, { entryNo: e.no }); }
        }
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
      if (!valid()) return;
      setState(next);
      if (next.visit) { const e = await entryOf(next.sid).catch(() => null); if (valid() && e) setEntry(e); }
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
  // the table code: the server checks it is this place's; the second person of the group lands in the same entry
  const arriveWith = (code: string) => void act(async () => {
    setScanErr("");
    const result = await checkIn(plan, code);
    // „Codul ăsta e de la alt local.”: the scanner stays open, ready for the right code
    if (!result.ok) { setScanErr(result.msg); setScanKey((k) => k + 1); return; }
    setScan(false);
    if (result.entry) setEntry(result.entry);
  });
  const sid = () => ((getApp().board.plans as Plan[] | undefined) ?? []).find((x) => x.pid === plan.pid)?.sid ?? plan.sid;
  const putTable = (v: string | null) => void act(async () => {
    const visit = entry?.id ?? plan.visitId;
    if (visit) await saveTable(visit, v);
    updPlan(plan.pid, { tableDone: true });
    setTableOpen(false);
  });
  const bill = (from: "camera" | "gallery") => {
    setBillOpen(false);
    void act(async () => {
      const res = await sendBill(plan, from);
      if (!res) return;
      setNote({ kind: res.ok ? "ok" : "err", text: res.msg });
      if (res.entry) setEntry(res.entry);
    });
  };
  const showTicket = () => {
    setPayOpen(true);
    const s = sid();
    if (!ticket && s) void ticketOf(s).then((q) => setTicket(q.token)).catch((e) => setMessage(trServer((e as Error).message)));
  };
  const me = useApp((s) => s.prefs.name);
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
      {ticket && !plan.inAt && (
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
      {!plan.inAt && isTonight(plan) ? (
        scan ? (
          <TableScan
            busy={busy}
            error={scanErr}
            camera={<CameraScanner key={scanKey} onScan={arriveWith} onClose={() => setScan(false)} />}
            onCode={arriveWith}
            onClose={() => setScan(false)}
          />
        ) : arrive.show && place ? (
          <ArrivePrompt name={place.name} dist={arrive.dist} onYes={() => { setMessage(""); setScan(true); }} onLater={() => arriveLater(plan)} />
        ) : (
          <Big label={tr("Scanează codul de pe masă")} color={t.s2} ink={t.ink} disabled={busy} onPress={() => { setMessage(""); setScan(true); }} />
        )
      ) : null}
      {plan.inAt && !plan.tableDone ? (
        <Arrived
          entry={entry ?? (plan.entryNo ? { no: plan.entryNo, name: me || tr("Tu"), people: plan.people, table: null } : null)}
          busy={busy}
          onSave={(v) => putTable(v)}
          onSkip={() => updPlan(plan.pid, { tableDone: true })}
        />
      ) : null}
      {plan.inAt && plan.tableDone ? (
        entry ? (
          <EntryCard
            entry={entry}
            busy={busy}
            note={note}
            highlight={focus === "bon" && !entry.receipts.length}
            onTable={() => { setTable(entry.table); setTableOpen(true); }}
            onScanBill={() => setBillOpen(true)}
            onShowTicket={showTicket}
          />
        ) : (
          <Muted>{tr("Ești la {name} din {t}. Încarc intrarea…", { name: place?.name ?? "", t: plan.inAt })}</Muted>
        )
      ) : null}
      {state?.visit && (state.visit.discount_pct ?? 0) > 0 && (
        <Muted>{tr("Reducere {pct}% pe toată nota, fără cumul.", { pct: state.visit.discount_pct ?? 0 })}</Muted>
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
      <BillPick
        open={billOpen}
        onClose={() => setBillOpen(false)}
        options={[
          { label: tr("Fă poza acum"), primary: true, onPress: () => bill("camera") },
          { label: tr("Alege din galerie"), onPress: () => bill("gallery") },
        ]}
      />
      <PayTicket open={payOpen} token={ticket || null} title={(place?.name ?? "") + (entry ? " · " + tr("Intrarea #{no} · {group}", { no: entry.no, group: groupName(entry) }) : "")} onClose={() => setPayOpen(false)} />
      <Sheet open={tableOpen} onClose={() => setTableOpen(false)}>
        <View style={{ gap: 12 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 24 }}>{tr("La ce masă stați?")}</T>
          <TablePick value={table} onChange={setTable} />
          <Big label={busy ? tr("Salvez…") : tr("Continuă")} disabled={busy || !table?.trim()} onPress={() => putTable(table)} />
          {entry?.table ? <Big label={tr("Șterge masa")} color={t.s2} ink={t.ink} disabled={busy} onPress={() => putTable(null)} /> : null}
        </View>
      </Sheet>
    </View>
  );
}
