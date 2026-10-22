// „Simulează o seară” (docs/flux-intrare-bon.md → Simularea): toată seara unui local partener, în memorie,
// fără server și fără bani reali. Folosește exact piesele ecranului „Intrări” (entries.tsx), legate de SimNight.
import { useRef, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Bilu } from "../../shared/Bilu";
import { useTheme, F } from "../../shared/theme";
import { SimNight, sampleReceipt, groupName, money, feeOf, type Entry, type SimReceipt } from "../../shared/entries";
import { Button, Card, Txt } from "./ui";
import { EntriesView, previousDay, receiptResult, type EntriesMode, type EntriesScreen } from "./entries";

const DAY = "2026-10-23"; // vineri
const R = {
  andrei: sampleReceipt(DAY, "21:52", "0042", [["Pizza x3", 186], ["Paste", 54], ["Bere x5", 90], ["Limonadă x3", 60], ["Desert", 30]]),
  ioana: sampleReceipt(DAY, "22:10", "0051", [["Burger x2", 104], ["Vin la pahar x2", 56], ["Apă", 26]]),
  radu: sampleReceipt(DAY, "22:30", "0057", [["Grătar", 128], ["Salată", 40], ["Bere x4", 100]]),
  raduDesert: sampleReceipt(DAY, "22:32", "0058", [["Papanași", 34], ["Cafea x2", 20]]),
};

interface UI { mode: EntriesMode; screen: EntriesScreen; selected: string | null; result: string; photo: boolean; scanCamera: boolean }
const LIST: UI = { mode: "now", screen: "list", selected: null, result: "", photo: false, scanCamera: false };
type Ctx = { sim: SimNight; ui: UI; set: (u: Partial<UI>) => void; id: (plan: string) => string };
interface Step {
  time: string;
  caption: string;
  /** Ce se întâmplă singur la intrarea în pas (clientul face ceva în aplicația lui). */
  enter?: (c: Ctx) => void;
  /** Pașii în care apeși tu: „Mai departe” îi face singur dacă i-ai sărit. */
  finish?: (c: Ctx) => void;
  morning?: boolean;
  /** Intrarea despre care e pasul (galben în listă). */
  focus?: string;
}

/** Poza notei în simulare: ce bon ar ieși la fiecare intrare. */
function photoOf(entry: Entry): SimReceipt {
  if (entry.id === "sim-p12") return R.andrei;
  if (entry.id === "sim-p13") return R.ioana;
  if (entry.id === "sim-p14") return entry.receipts.length ? R.raduDesert : R.radu;
  throw new Error("Nu am putut citi poza (nota e mototolită). Apasă „Scrie totalul” și scrie suma de pe notă.");
}
function snap(c: Ctx, entry: string) {
  const bon = photoOf(c.sim.get(entry));
  const r = c.sim.addReceipt(entry, bon, "staff");
  c.set({ screen: "detail", selected: entry, photo: false, result: receiptResult(bon.total, r.duplicate) });
}

const STEPS: Step[] = [
  { time: "Vineri · 20:00", caption: "E vineri seara la Aubergine. Ospătarul are CeFaci Business deschis la „Intrări”. Încă n-a venit nimeni din CeFaci." },
  { time: "Vineri · 20:14", focus: "p12", caption: "Andrei și încă 4 prieteni au ajuns. Unul dintre ei a scanat codul CeFaci de pe masă: intrarea #12 apare singură, imediat.",
    enter: ({ sim }) => void sim.arrive("p12", "Andrei", 5, "20:14") },
  { time: "Vineri · 20:15", focus: "p12", caption: "În aplicație, clientul a răspuns la „La ce masă stați?” cu 7. Masa doar te ajută să găsești gașca.",
    enter: ({ sim, id }) => void sim.setTable(id("p12"), "7") },
  { time: "Vineri · 20:40", focus: "p13", caption: "Ioana și un prieten au venit tot din CeFaci: intrarea #13.",
    enter: ({ sim }) => void sim.arrive("p13", "Ioana", 2, "20:40") },
  { time: "Vineri · 21:05", focus: "p14", caption: "Radu cu încă doi, la masa 3: intrarea #14.",
    enter: ({ sim, id }) => { sim.arrive("p14", "Radu", 3, "21:05"); sim.setTable(id("p14"), "3"); } },
  { time: "Vineri · 21:30", focus: "p15", caption: "Ana a venit singură: intrarea #15.",
    enter: ({ sim }) => void sim.arrive("p15", "Ana", 1, "21:30") },
  { time: "Vineri · 21:52", focus: "p12", caption: "Andrei a plătit și a făcut poză bonului din aplicația lui. Intrarea #12 s-a închis singură și a trecut jos, la „Închise în seara asta”: bon 420 lei, CeFaci 10% = 42 lei, „scanat de client”, 1/5.",
    enter: ({ sim, id }) => void sim.addReceipt(id("p12"), R.andrei, "client", "andrei") },
  { time: "Vineri · 21:54", focus: "p12", caption: "Și Maria, din aceeași gașcă, a scanat același bon. Se numără o singură dată: tot 420 lei, dar acum „bon scanat de 2/5”.",
    enter: ({ sim, id }) => void sim.addReceipt(id("p12"), R.andrei, "client", "maria") },
  { time: "Vineri · 22:10", caption: "Ioana vrea să plătească și îți arată biletul. Apasă „Scanează biletul clientului”, apoi „Simulează scanarea biletului”, „Fă poză notei” și „Simulează poza notei”.",
    finish: (c) => { if (!c.sim.get(c.id("p13")).receipts.length) snap(c, c.id("p13")); } },
  { time: "Vineri · 22:30", caption: "Radu n-are telefonul la el. Alege #14 din listă (după masă, nume, oră) și fă poză notei.",
    enter: ({ set }) => set(LIST),
    finish: (c) => { if (!c.sim.get(c.id("p14")).receipts.length) snap(c, c.id("p14")); } },
  { time: "Vineri · 22:32", caption: "Unul dintre ei a plătit separat desertul: 54 lei. Fă încă o poză pe aceeași intrare: notele separate se adună (268 + 54 = 322 lei, CeFaci 32,20 lei).",
    enter: ({ set, id }) => set({ ...LIST, screen: "detail", selected: id("p14") }),
    finish: (c) => { if (c.sim.get(c.id("p14")).receipts.length < 2) snap(c, c.id("p14")); } },
  { time: "Vineri · 23:30", focus: "p15", caption: "Ana a plecat și nimeni n-a scanat bonul. #15 așteaptă bonul până mâine la 12:00; dacă nu vine, rămâne „fără bon” și nu plătești nimic.",
    enter: ({ set }) => set(LIST) },
  { time: "Sâmbătă · 10:00", morning: true, caption: "A doua zi dimineață, proprietarul deschide „Intrări” → „Ieri”: câte intrări, câți oameni, suma bonurilor, cei 10% și câte au rămas fără bon.",
    enter: ({ set }) => set({ ...LIST, mode: "ieri" }) },
  { time: "Sâmbătă · 10:05", morning: true, caption: "Desertul de 54 lei de la #14 era de fapt al altei mese. Apasă „Nu e al lor” pe bonul de 54 lei, scrie motivul și confirmă: bonul iese din total până îl verifică echipa CeFaci.",
    enter: ({ set, id }) => set({ ...LIST, mode: "ieri", screen: "detail", selected: id("p14") }),
    finish: (c) => { const e = c.sim.get(c.id("p14")); const r = e.receipts.find((x) => x.total === R.raduDesert.total); if (r && !r.disputed) c.sim.dispute(e.id, r.id); } },
  { time: "Sâmbătă · 10:20", morning: true, caption: "Ana a plătit 95 lei, dar poza notei nu se citește. Înainte de 12:00, apasă „Scrie totalul”: 95 lei și motivul. #15 se închide cu „total scris de local”.",
    enter: ({ set, id }) => set({ ...LIST, mode: "ieri", screen: "detail", selected: id("p15") }),
    finish: (c) => { if (!c.sim.get(c.id("p15")).receipts.length) writeTotal(c, c.id("p15"), 95); } },
  { time: "Sâmbătă · 10:25", morning: true, caption: "", enter: ({ set }) => set({ ...LIST, mode: "ieri" }) },
];
let written = 0;
function writeTotal(c: Ctx, entry: string, total: number) {
  const r = sampleReceipt(DAY, "23:10", "scris-" + ++written, [["Total scris de local", total]]);
  c.sim.addReceipt(entry, r, "local");
  c.set({ result: `Total scris: ${money(total)} · CeFaci ${money(feeOf(total))}` });
}

export function BusinessSimulation({ onClose }: { onClose: () => void }) {
  const { t } = useTheme();
  const wide = useWindowDimensions().width >= 920;
  const sim = useRef(new SimNight(DAY));
  const [step, setStep] = useState(0), [ui, setUi] = useState<UI>(LIST), [, tick] = useState(0);
  const [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const ctx = (): Ctx => ({
    sim: sim.current, ui,
    set: (u) => setUi((old) => ({ ...old, ...u })),
    id: (plan) => "sim-" + plan,
  });
  const rerender = () => tick((n) => n + 1);
  const go = (n: number) => {
    try { STEPS[step].finish?.(ctx()); } catch { /* pasul sărit nu blochează simularea */ }
    const next = STEPS[n];
    setUi((old) => ({ ...old, result: "", photo: false, scanCamera: false }));
    next.enter?.(ctx());
    setError("");
    setStep(n);
    rerender();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const restart = () => {
    sim.current = new SimNight(DAY);
    written = 0;
    setUi(LIST); setStep(0); setError(""); rerender();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const s = STEPS[step], last = step === STEPS.length - 1;
  // Dimineața, „Acum” e ziua nouă: nicio intrare încă.
  const all = sim.current.entries.map((e) => ({ ...e, receipts: e.receipts.map((r) => ({ ...r })) }));
  // Înainte de dimineață, „Ieri” e joi: nicio intrare.
  const entries = (s.morning ? ui.mode === "now" : ui.mode !== "now") ? [] : all;
  const shownDay = !s.morning && ui.mode !== "now" ? previousDay(DAY) : DAY;
  const guard = (work: () => void) => { try { setError(""); work(); } catch (e) { setUi((u) => ({ ...u, result: e instanceof Error ? e.message : "Nu a mers." })); } rerender(); };
  const c = ctx();
  const ticketTarget = all.find((e) => e.id === "sim-p13" && e.state === "open") ?? all.find((e) => e.state === "open");
  const scanTicket = () => {
    if (ticketTarget) setUi((u) => ({ ...u, screen: "detail", selected: ticketTarget.id, result: `Biletul e bun: #${ticketTarget.no} · ${groupName(ticketTarget)}. Fă poză notei.` }));
  };
  const caption = last ? null : (
    <Card>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View accessible={false}><Bilu size={56} mood={s.morning ? "yay" : "up"} still /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: F.b, fontSize: 12, color: "#0E1440", alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 10, backgroundColor: "#FFD43B", borderRadius: 99 }}>
            Simulare · pasul {step + 1}/{STEPS.length - 1}
          </Text>
          <Txt big style={{ fontSize: 22, lineHeight: 28 }}>{s.time}</Txt>
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.r, fontSize: 16, lineHeight: 23, color: t.ink }}>{s.caption}</Text>
      {!!error && <Txt>{error}</Txt>}
      <View style={{ height: 5, borderRadius: 99, backgroundColor: t.s2, overflow: "hidden" }}>
        <View style={{ height: 5, width: `${((step + 1) / (STEPS.length - 1)) * 100}%`, backgroundColor: "#FFD43B" }} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        <Button label="Închide simularea" secondary onPress={onClose} />
        <Button label="Mai departe" onPress={() => go(step + 1)} />
      </View>
    </Card>
  );
  const final = last && (
    <Card title="Și la final de lună?" tint="#FFD43B">
      <View accessible={false} style={{ alignItems: "center" }}><Bilu size={84} mood="yay" still /></View>
      <Txt style={{ color: "#0E1440" }}>
        Fiecare seară arată ca aceasta: plătești 10% doar din bonurile intrărilor CeFaci. Fără bon, nu plătești nimic.
      </Txt>
      <Txt style={{ color: "#0E1440", fontFamily: F.sb }}>
        Pe 3 ale lunii primești lista, 5 zile lucrătoare să contești, apoi factura prin e-Factura.
      </Txt>
      <Txt style={{ color: "#0E1440", fontSize: 14 }}>
        În luna gratuită (doar fondatorii) vezi „ai fi plătit X”, dar nu plătești. Ceilalți parteneri plătesc din prima zi. Simularea n-a trimis nimic și nu a folosit bani reali.
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label="Începe din nou" onPress={restart} />
        <Button label="Închide simularea" secondary onPress={onClose} />
      </View>
    </Card>
  );
  const view = (
    <EntriesView
      busy={false}
      role="proprietar"
      result={ui.result}
      mode={ui.mode}
      onMode={(m) => setUi((u) => ({ ...u, mode: m, screen: "list", selected: null, result: "" }))}
      day={shownDay}
      highlight={s.focus && !s.morning ? "sim-" + s.focus : null}
      entries={entries}
      screen={ui.screen}
      selected={ui.selected}
      onOpen={(id) => setUi((u) => ({ ...u, screen: "detail", selected: id, result: "", photo: false }))}
      onBack={() => setUi((u) => ({ ...u, screen: "list", selected: null, result: "", photo: false, scanCamera: false }))}
      onStartScan={() => setUi((u) => ({ ...u, screen: "scan", scanCamera: false }))}
      camera={
        <View style={{ borderWidth: 2, borderStyle: "dashed", borderColor: t.line, borderRadius: 16, padding: 16, gap: 10, alignItems: "stretch" }}>
          <Txt muted style={{ textAlign: "center" }}>Aici e camera. În simulare, biletul se scanează din buton.</Txt>
          <Button
            label="Simulează scanarea biletului"
            disabled={!ticketTarget}
            onPress={scanTicket}
          />
        </View>
      }
      onTicketCode={scanTicket}
      onPhoto={() => setUi((u) => ({ ...u, photo: true, result: "" }))}
      photoSlot={ui.photo ? (
        <View style={{ borderWidth: 2, borderStyle: "dashed", borderColor: t.line, borderRadius: 16, padding: 16, gap: 10 }}>
          <Txt muted style={{ textAlign: "center" }}>Aici se deschide camera telefonului.</Txt>
          <Button label="Simulează poza notei" onPress={() => guard(() => snap(c, ui.selected!))} />
        </View>
      ) : null}
      onWriteTotal={(e, total) => guard(() => writeTotal(c, e.id, total))}
      onDispute={(e, r) => guard(() => { sim.current.dispute(e.id, r.id); setUi((u) => ({ ...u, result: `Bonul de ${money(r.total)} e contestat: iese din total până îl verifică echipa CeFaci.` })); })}
    />
  );
  return (
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: wide ? 32 : 16, gap: 20, width: "100%", maxWidth: wide ? 1180 : 760, alignSelf: "center" }}>
      <View style={{ gap: 2 }}>
        <Txt muted>Aubergine · simulare fără server și fără bani reali</Txt>
        <Txt big>Simulează o seară</Txt>
      </View>
      {wide ? (
        <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
          <View style={{ width: 380, gap: 20 }}>{caption}{final}</View>
          <View style={{ flex: 1, gap: 20, minWidth: 0 }}>{view}</View>
        </View>
      ) : (
        <>{caption}{final}{view}</>
      )}
    </ScrollView>
  );
}
