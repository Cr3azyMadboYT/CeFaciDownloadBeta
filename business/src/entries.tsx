// Intrările CeFaci și bonurile lor (docs/flux-intrare-bon.md): localul dă CeFaci 10% din bonurile fiecărei intrări.
// Piesele de aici sunt doar afișare + callback-uri: ecranul real („Intrări”) le leagă de server, iar
// „Simulează o seară” (simulation.tsx) le leagă de SimNight, ca omul să vadă exact același ecran.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { CameraScanner } from "../../shared/CameraScanner";
import { useTheme, F } from "../../shared/theme";
import { canFinance, canOperate, type Dashboard, type Role } from "../../shared/contracts";
import {
  daySummary, entryTime, feeOf, groupName, money, type Entry, type EntryReceipt, type ReceiptBy,
} from "../../shared/entries";
import { Card, Txt, Button, Field, Row, Empty, ask } from "./ui";
import { amount } from "./amount";
import { call } from "./backend";
import { readReceipt, takeReceiptPhoto } from "./receipt-photo";
import type { ScreenProps } from "./screens";

export type EntriesMode = "now" | "ieri" | "zi";
export type EntriesScreen = "list" | "scan" | "detail";

const BY: Record<ReceiptBy, string> = { client: "client", staff: "ospătar", local: "scris de local" };
const BY_TAG: Record<ReceiptBy, string> = { client: "scanat de client", staff: "scanat de ospătar", local: "total scris de local" };
const byText = (e: Entry) => [...new Set(e.receipts.filter((r) => !r.disputed).map((r) => BY_TAG[r.by]))].join(" · ");
const dayName = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const previousDay = (day: string) => new Date(Date.parse(day + "T12:00:00Z") - 86400e3).toISOString().slice(0, 10);
/** Cât datorează sau, în lunile gratuite, cât ar fi plătit. */
const feeText = (fee: number, free: boolean) => (free ? `ai fi plătit ${money(fee)}` : `CeFaci ${money(fee)}`);
export const receiptResult = (total: number | null, duplicate: boolean, free = false) =>
  duplicate
    ? "Bonul era deja scanat de client — numărat o dată."
    : total === null
      ? "Bonul a fost primit. Totalul apare pe intrare."
      : `Bon citit: ${money(total)} · ${feeText(feeOf(total), free)}`;

export function StateTag({ e }: { e: Entry }) {
  const { t } = useTheme();
  const [label, bg, ink] =
    e.state === "closed"
      ? [`închisă · bon ${money(e.total)} · ${feeText(e.fee, e.free)}${byText(e) ? " · " + byText(e) : ""}`, t.greenSoft, t.greenInk]
      : e.state === "no_bill"
        ? ["fără bon · nu se plătește nimic", t.s2, t.ink2]
        : ["așteaptă bonul", t.yellow, "#0E1440"];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, maxWidth: "100%" }}>
      <Text style={{ fontFamily: F.sb, fontSize: 13, lineHeight: 18, color: ink }}>{label}</Text>
    </View>
  );
}

const title = (e: Entry) =>
  `#${e.no} · ${groupName(e)}${e.table ? ` · masa ${e.table}` : ""} · ${entryTime(e.arrived_at)}`;

function ReceiptLine({ r, people }: { r: EntryReceipt; people: number }) {
  return (
    <Txt muted style={{ fontSize: 14, textDecorationLine: r.disputed ? "line-through" : "none" }}>
      Bon {money(r.total)} · {entryTime(r.at)}{r.number && r.by !== "local" ? ` · nr. ${r.number}` : ""} · {BY[r.by]}
      {r.scanners > 0 ? ` · scanat de ${r.scanners}/${people}` : ""}
      {r.disputed ? " · contestat" : ""}
    </Txt>
  );
}

export function EntryRow({ e, onPress, receipts = false, highlight = false }: { e: Entry; onPress: () => void; receipts?: boolean; highlight?: boolean }) {
  const { t } = useTheme();
  const state = e.state === "closed" ? "închisă" : e.state === "no_bill" ? "fără bon" : "așteaptă bonul";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Intrarea ${title(e)}, ${state}. Deschide intrarea`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: t.bgCont, borderWidth: highlight ? 2 : 1, borderColor: highlight ? "#FFD43B" : t.line,
        borderRadius: 14, padding: highlight ? 11 : 12, gap: 6,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt style={{ fontFamily: F.sb, fontSize: 16 }}>{title(e)}</Txt>
      <StateTag e={e} />
      {e.receipts.length > 0 && e.scanned_by > 0 && <Txt muted style={{ fontSize: 14 }}>bon scanat de {e.scanned_by}/{e.people}</Txt>}
      {receipts && e.receipts.map((r) => <ReceiptLine key={r.id} r={r} people={e.people} />)}
    </Pressable>
  );
}

/** Butonul mare de la ospătar. */
export function BigButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64, borderRadius: 18, backgroundColor: "#FFD43B", alignItems: "center", justifyContent: "center",
        paddingHorizontal: 16, opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: F.b, fontSize: 18, color: "#0E1440", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function ModeSwitch({ mode, onMode, pick }: { mode: EntriesMode; onMode: (m: EntriesMode) => void; pick: boolean }) {
  const { t } = useTheme();
  const modes: [EntriesMode, string][] = [["now", "Acum"], ["ieri", "Ieri"], ...(pick ? [["zi", "Altă zi"] as [EntriesMode, string]] : [])];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: t.s2, borderRadius: 14, padding: 4, gap: 4 }}>
      {modes.map(([m, label]) => (
        <Pressable
          key={m}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: mode === m }}
          onPress={() => onMode(m)}
          style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: mode === m ? t.s1 : "transparent" }}
        >
          <Text style={{ fontFamily: F.sb, fontSize: 15, color: mode === m ? t.ink : t.ink2 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DaySummaryCard({ day, entries, label }: { day: string; entries: Entry[]; label: string }) {
  const s = daySummary(entries);
  const free = entries.some((e) => e.free);
  const Stat = ({ n, text }: { n: string; text: string }) => (
    <View style={{ flexBasis: 130, flexGrow: 1, gap: 2 }}>
      <Txt big style={{ fontSize: 24, lineHeight: 30, color: "#0E1440" }}>{n}</Txt>
      <Txt style={{ color: "#0E1440", fontSize: 14 }}>{text}</Txt>
    </View>
  );
  return (
    <Card title={`${label} · ${dayName(day)}`} tint="#FFD43B">
      <Row>
        <Stat n={String(s.entries)} text={s.entries === 1 ? "intrare" : "intrări"} />
        <Stat n={String(s.people)} text="oameni" />
        <Stat n={money(s.total)} text="total bonuri" />
        <Stat n={money(s.fee)} text={free ? "CeFaci 10% (ai fi plătit)" : "CeFaci 10%"} />
        <Stat n={String(s.noBill)} text="fără bon" />
      </Row>
      <Txt style={{ color: "#0E1440", fontSize: 14 }}>
        Intrările fără bon până azi la 12:00 nu se plătesc. Bonurile contestate nu intră în total.
      </Txt>
    </Card>
  );
}

function DisputeReceipt({ r, busy, onDispute }: { r: EntryReceipt; busy: boolean; onDispute: (reason: string) => void }) {
  const [open, O] = useState(false), [reason, R] = useState("");
  if (r.disputed)
    return <Txt muted style={{ fontSize: 14 }}>Contestat: scos din total până verifică echipa CeFaci.</Txt>;
  if (!open) return <Button label={`Nu e al lor · bonul de ${money(r.total)}`} secondary disabled={busy} onPress={() => O(true)} />;
  return (
    <View style={{ gap: 8 }}>
      <Field label={`De ce nu e al lor bonul de ${money(r.total)}?`} value={reason} onChange={R} />
      <Row>
        <Button
          label="Trimite contestația"
          disabled={busy || reason.trim().length < 5}
          onPress={() =>
            void ask("Contești bonul?", `Bonul de ${money(r.total)} iese din total până îl verifică echipa CeFaci.`, "Contest").then(
              (ok) => { if (ok) { onDispute(reason.trim()); O(false); R(""); } },
            )
          }
        />
        <Button label="Renunț" secondary onPress={() => O(false)} />
      </Row>
      {reason.trim().length > 0 && reason.trim().length < 5 && <Txt muted style={{ fontSize: 13 }}>Scrie motivul în cel puțin 5 caractere.</Txt>}
    </View>
  );
}

function WriteTotal({ busy, onSave }: { busy: boolean; onSave: (total: number, reason: string) => void }) {
  const [open, O] = useState(false), [total, T] = useState(""), [reason, R] = useState(""), [error, E] = useState("");
  if (!open) return <Button label="Scrie totalul" secondary disabled={busy} onPress={() => O(true)} />;
  return (
    <View style={{ gap: 8 }}>
      <Txt muted style={{ fontSize: 14 }}>Când poza nu se citește: scrie totalul de pe notă. Merge până mâine la 12:00.</Txt>
      <Field label="Totalul de pe notă (lei)" numeric value={total} onChange={T} />
      <Field label="Motiv (de ce nu merge poza)" value={reason} onChange={R} />
      {!!error && <Txt style={{ fontSize: 14 }}>{error}</Txt>}
      <Row>
        <Button
          label="Salvează totalul"
          disabled={busy || !total.trim() || reason.trim().length < 5}
          onPress={() => {
            try {
              const n = amount(total);
              if (!n || n <= 0) throw new Error("Scrie totalul de pe notă, mai mare de 0.");
              E(""); onSave(n, reason.trim()); O(false); T(""); R("");
            } catch (e) { E(e instanceof Error ? e.message : "Scrie o sumă validă."); }
          }}
        />
        <Button label="Renunț" secondary onPress={() => O(false)} />
      </Row>
    </View>
  );
}

export interface EntryActions {
  busy: boolean;
  role: Role;
  /** Mesajul după ultima acțiune (bon citit, eroare…). */
  result: string;
  onPhoto: (e: Entry) => void;
  /** Sub butonul de poză: în simulare, „Simulează poza notei”. */
  photoSlot?: ReactNode;
  onWriteTotal: (e: Entry, total: number, reason: string) => void;
  onDispute: (e: Entry, receipt: EntryReceipt, reason: string) => void;
}

export function EntryDetail({ entry: e, onBack, ...a }: EntryActions & { entry: Entry; onBack: () => void }) {
  return (
    <>
      <Button label="Înapoi la intrări" secondary onPress={onBack} />
      <Card title={`#${e.no} · ${groupName(e)}`}>
        <Txt>{e.people} {e.people === 1 ? "persoană" : "persoane"} în plan{e.table ? ` · masa ${e.table}` : ""} · a ajuns la {entryTime(e.arrived_at)}</Txt>
        <StateTag e={e} />
        {e.receipts.length > 0 && e.scanned_by > 0 && <Txt muted>bon scanat de {e.scanned_by}/{e.people}</Txt>}
        {!!a.result && (
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: "#FFD43B", borderRadius: 14, padding: 12 }}>
            <Txt style={{ color: "#0E1440", fontFamily: F.sb }}>{a.result}</Txt>
          </View>
        )}
        <BigButton label="Fă poză notei" disabled={a.busy} onPress={() => a.onPhoto(e)} />
        {a.photoSlot}
        <Txt muted style={{ fontSize: 14 }}>
          Note separate? Fă poză fiecăreia: se adună la aceeași intrare. Același bon scanat de mai mulți se numără o dată.
        </Txt>
      </Card>
      <Card title="Bonurile intrării">
        {!e.receipts.length && <Empty text="Încă nu e niciun bon. Fără bon până mâine la 12:00, intrarea nu se plătește." />}
        {e.receipts.map((r) => (
          <View key={r.id} style={{ gap: 8 }}>
            <ReceiptLine r={r} people={e.people} />
            {canFinance(a.role) && <DisputeReceipt r={r} busy={a.busy} onDispute={(reason) => a.onDispute(e, r, reason)} />}
          </View>
        ))}
        {e.receipts.length > 0 && (
          <Txt style={{ fontFamily: F.sb }}>
            Total {money(e.total)} → {e.free ? `ai fi plătit ${money(e.fee)} (lună gratuită)` : `CeFaci 10% = ${money(e.fee)}`}
          </Txt>
        )}
        {canOperate(a.role) && <WriteTotal busy={a.busy} onSave={(total, reason) => a.onWriteTotal(e, total, reason)} />}
      </Card>
    </>
  );
}

export function TicketScan({ busy, camera, onCode, onBack }: { busy: boolean; camera: ReactNode; onCode: (code: string, table: string) => void; onBack: () => void }) {
  const [code, C] = useState(""), [table, T] = useState("");
  return (
    <>
      <Button label="Înapoi la intrări" secondary onPress={onBack} />
      <Card title="Scanează biletul clientului">
        <Txt muted>Clientul arată biletul din aplicație. După scanare se deschide intrarea lui și faci poză notei.</Txt>
        {camera}
        <Field label="Sau scrie codul biletului" value={code} onChange={C} />
        <Field label="Masa (opțional)" value={table} onChange={T} />
        <Button label="Verifică biletul" secondary disabled={busy || !code.trim()} onPress={() => onCode(code.trim(), table.trim())} />
      </Card>
    </>
  );
}

export interface EntriesViewProps extends EntryActions {
  mode: EntriesMode;
  onMode: (m: EntriesMode) => void;
  /** „Altă zi”: doar în aplicația reală. */
  pick?: { value: string; onChange: (v: string) => void; onLoad: () => void };
  day: string;
  entries: Entry[];
  error?: string;
  loading?: boolean;
  screen: EntriesScreen;
  selected: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
  onStartScan: () => void;
  camera: ReactNode;
  onTicketCode: (code: string, table: string) => void;
  /** Intrarea care tocmai s-a schimbat (simularea o arată cu galben). */
  highlight?: string | null;
}

export function EntriesView(p: EntriesViewProps) {
  const entry = p.selected ? p.entries.find((e) => e.id === p.selected) : undefined;
  if (p.screen === "scan")
    return <TicketScan busy={p.busy} camera={p.camera} onCode={p.onTicketCode} onBack={p.onBack} />;
  if (p.screen === "detail" && entry) return <EntryDetail {...p} entry={entry} onBack={p.onBack} />;
  const open = p.entries.filter((e) => e.state === "open"), done = p.entries.filter((e) => e.state !== "open");
  const sorted = [...p.entries].sort((a, b) => a.no - b.no);
  return (
    <>
      <ModeSwitch mode={p.mode} onMode={p.onMode} pick={!!p.pick} />
      {!!p.error && <Card><Txt>{p.error}</Txt></Card>}
      {p.mode === "now" ? (
        <>
          <Card title="Intrări deschise acum">
            <Txt muted style={{ fontSize: 14 }}>
              {p.loading ? "Se actualizează…" : "Se actualizează singur. Gașca apare când scanează codul de pe masă."}
            </Txt>
            <BigButton label="Scanează biletul clientului" disabled={p.busy} onPress={p.onStartScan} />
            {!open.length && <Empty text="Nicio intrare deschisă." />}
            {open.map((e) => <EntryRow key={e.id} e={e} highlight={e.id === p.highlight} onPress={() => p.onOpen(e.id)} />)}
          </Card>
          {done.length > 0 && (
            <Card title="Închise în seara asta">
              {done.map((e) => <EntryRow key={e.id} e={e} highlight={e.id === p.highlight} onPress={() => p.onOpen(e.id)} />)}
            </Card>
          )}
        </>
      ) : (
        <>
          {p.mode === "zi" && p.pick && (
            <Card>
              <Field label="Ziua (AAAA-LL-ZZ)" value={p.pick.value} onChange={p.pick.onChange} />
              <Button label="Vezi ziua" disabled={p.busy || !/^\d{4}-\d\d-\d\d$/.test(p.pick.value.trim())} onPress={p.pick.onLoad} />
            </Card>
          )}
          {!!p.day && <DaySummaryCard day={p.day} entries={p.entries} label={p.mode === "ieri" ? "Ieri" : "Ziua"} />}
          <Card title="Intrările zilei">
            {p.loading && <Txt muted>Se încarcă…</Txt>}
            {!p.loading && !sorted.length && <Empty text="Nicio intrare CeFaci în ziua asta." />}
            {sorted.map((e) => <EntryRow key={e.id} e={e} receipts highlight={e.id === p.highlight} onPress={() => p.onOpen(e.id)} />)}
          </Card>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Ecranul real: aceleași piese, legate de server.
// ---------------------------------------------------------------------------------------------------------------
type DayEntries = { day: string; entries: Entry[] };

export function Entries({ venue, data, act, busy }: ScreenProps & { data: Dashboard }) {
  const [mode, setMode] = useState<EntriesMode>("now"),
    [pick, setPick] = useState(previousDay(data.day)),
    [chosen, setChosen] = useState(previousDay(data.day)),
    [list, setList] = useState<DayEntries | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [screen, setScreen] = useState<EntriesScreen>("list"),
    [selected, setSelected] = useState<string | null>(null),
    [camera, setCamera] = useState(false),
    [result, setResult] = useState("");
  const request = useRef(0);
  const dayArg = mode === "now" ? null : mode === "ieri" ? previousDay(data.day) : chosen;
  const load = async (day: string | null) => {
    const n = ++request.current;
    try {
      const next = await call<DayEntries>("biz_entries_v3", { p_venue: venue, p_day: day });
      if (n === request.current) { setList(next); setError(""); }
      return next;
    } catch (e) {
      if (n === request.current) setError(e instanceof Error ? e.message : "Intrările nu s-au actualizat. Reîncearcă online.");
      return null;
    } finally {
      if (n === request.current) setLoading(false);
    }
  };
  // Panoul se reîmprospătează odată cu localul (live(): sosiri în timp real + la 15 secunde, în App.tsx).
  useEffect(() => {
    void load(dayArg);
    return () => { request.current++; };
  }, [venue, data, mode, chosen]);
  const replace = (e: Entry) => setList((l) => (l && l.entries.some((x) => x.id === e.id) ? { ...l, entries: l.entries.map((x) => (x.id === e.id ? e : x)) } : l));
  const back = () => { setScreen("list"); setSelected(null); setResult(""); setCamera(false); };
  const scan = (code: string, table = "") => {
    setCamera(false);
    void act(async () => {
      const r = await call<{ visit?: string }>("biz_scan_v2", { p_venue: venue, p_ticket: code, p_table: table || null });
      setMode("now");
      setLoading(true);
      await load(null);
      if (r?.visit) { setSelected(r.visit); setScreen("detail"); setResult(""); }
    }, "Biletul e bun. Fă poză notei.");
  };
  const actions: EntryActions = {
    busy, role: data.role, result,
    onPhoto: (e) => {
      setResult("");
      void takeReceiptPhoto().then(
        (image) => {
          if (!image) return;
          void act(async () => {
            try {
              const r = await readReceipt({ image, venue, day: e.work_day, visit: e.id });
              replace(r.entry);
              setResult(receiptResult(r.bon?.total ?? null, !!r.receipt?.duplicate, r.entry?.free));
            } catch (err) {
              setResult(err instanceof Error ? err.message : "Nu am putut citi bonul.");
              throw err;
            }
          }, "Bonul e pe intrare.");
        },
        (err) => setResult(err instanceof Error ? err.message : "Nu am putut deschide camera."),
      );
    },
    onWriteTotal: (e, total, reason) =>
      void act(async () => {
        const next = await call<Entry>("biz_entry_total_v3", { p_visit: e.id, p_total: total, p_reason: reason });
        if (next?.id) replace(next);
        setResult(`Total scris: ${money(total)} · ${feeText(feeOf(total), e.free)}`);
      }, "Totalul e salvat pe intrare."),
    onDispute: (_e, r, reason) =>
      void act(
        () => call("biz_receipt_dispute_v3", { p_receipt: r.id, p_reason: reason }),
        "Bonul e contestat. Echipa CeFaci verifică; până atunci nu intră la plată.",
      ),
  };
  return (
    <EntriesView
      {...actions}
      mode={mode}
      onMode={(m) => { if (m !== mode) { setLoading(true); setList(null); } setMode(m); back(); }}
      pick={{ value: pick, onChange: setPick, onLoad: () => { setLoading(true); setChosen(pick.trim()); } }}
      day={list?.day ?? ""}
      entries={list?.entries ?? []}
      error={error}
      loading={loading}
      screen={screen}
      selected={selected}
      onOpen={(id) => { setSelected(id); setScreen("detail"); setResult(""); }}
      onBack={back}
      onStartScan={() => { setScreen("scan"); setCamera(false); }}
      camera={camera ? <CameraScanner onScan={(c) => scan(c.trim())} onClose={() => setCamera(false)} /> : <Button label="Deschide camera" disabled={busy} onPress={() => setCamera(true)} />}
      onTicketCode={scan}
    />
  );
}
