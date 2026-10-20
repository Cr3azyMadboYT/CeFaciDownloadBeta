// Intrarea și bonul (Cornel, 20.10): localul partener dă CeFaci 10% din bonurile fiecărei intrări.
// O intrare = o gașcă (sau un om) venită dintr-un plan CeFaci, într-o seară, la un local. Fluxul complet:
// docs/flux-intrare-bon.md. Banii îi calculează Postgres (private.visit_fees); aici sunt doar forma datelor,
// textele comune și motorul de simulare („Simulează o seară”), folosit de ambele aplicații fără server.

/** Procentul CeFaci din bon. Același pentru toate localurile. */
export const FEE_RATE = 0.1;
export const feeOf = (total: number) => Math.round(total * FEE_RATE * 100) / 100;

/** Cine a adus bonul: clientul (poză), ospătarul (biletul scanat sau intrarea aleasă din listă) sau localul (suma scrisă). */
export type ReceiptBy = "client" | "staff" | "local";
export interface EntryReceipt {
  id: string;
  total: number;
  /** Ora de pe bon, ISO. */
  at: string;
  /** Numărul bonului, când l-am putut citi. */
  number: string | null;
  by: ReceiptBy;
  /** Câți oameni din gașcă au scanat același bon. */
  scanners: number;
  disputed: boolean;
}
export type EntryState = "open" | "closed" | "no_bill";
export interface Entry {
  id: string;
  /** Numărul intrării în ziua de lucru a localului (#12). */
  no: number;
  venue_id: string;
  venue_name: string;
  /** Prenumele celui care a făcut planul. */
  name: string;
  people: number;
  table: string | null;
  arrived_at: string;
  work_day: string;
  receipts: EntryReceipt[];
  /** Câți oameni din gașcă au scanat cel puțin un bon (pentru „scanat de 3/5”). */
  scanned_by: number;
  total: number;
  /** 10% din bonurile necontestate. */
  fee: number;
  /** Lunile gratuite: localul vede „ai fi plătit”, dar nu plătește. */
  free: boolean;
  state: EntryState;
}

/** „Andrei + 4” */
export const groupName = (e: Pick<Entry, "name" | "people">) => (e.people > 1 ? `${e.name} + ${e.people - 1}` : e.name);
export const money = (n: number) => n.toFixed(2).replace(".", ",") + " lei";
const hm = (iso: string) => new Date(iso).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
export const entryTime = hm;

/** Suma și comisionul unei intrări, din bonuri (fără cele contestate). */
export function totals(receipts: EntryReceipt[]) {
  const total = Math.round(receipts.filter((r) => !r.disputed).reduce((s, r) => s + r.total, 0) * 100) / 100;
  return { total, fee: feeOf(total) };
}

/** Rezumatul unei zile pentru dashboard. */
export function daySummary(entries: Entry[]) {
  const withBill = entries.filter((e) => e.state === "closed");
  const total = Math.round(withBill.reduce((s, e) => s + e.total, 0) * 100) / 100;
  return {
    entries: entries.length,
    people: entries.reduce((s, e) => s + e.people, 0),
    total,
    fee: Math.round(withBill.reduce((s, e) => s + e.fee, 0) * 100) / 100,
    noBill: entries.filter((e) => e.state !== "closed").length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Simularea: o seară întreagă, în memorie. Aceleași reguli ca serverul (un bon numărat o dată, note separate adunate,
// 10% din total, fără bon = 0), ca omul să vadă exact cum merge, fără bani reali și fără cont.
// ---------------------------------------------------------------------------------------------------------------

export interface SimReceipt { key: string; total: number; at: string; number: string; lines: [string, number][] }
export interface SimMember { id: string; name: string }

const at = (day: string, time: string) => new Date(`${day}T${time}:00+03:00`).toISOString();

/** Bonuri de probă, ca cele de la casa de marcat. */
export function sampleReceipt(day: string, time: string, number: string, lines: [string, number][]): SimReceipt {
  const total = Math.round(lines.reduce((s, [, p]) => s + p, 0) * 100) / 100;
  return { key: "RO1234567|" + number + "|" + day, total, at: at(day, time), number, lines };
}

export class SimNight {
  venue = { id: "sim-aubergine", name: "Aubergine" };
  day: string;
  entries: Entry[] = [];
  private seen = new Map<string, { entry: string; receipt: string; scanners: Set<string> }>();
  private scannedBy = new Map<string, Set<string>>();
  private n = 11;
  constructor(day = "2026-10-23") { this.day = day; }

  /** Gașca scanează codul de pe masă: se creează intrarea (o singură dată pe plan). */
  arrive(plan: string, owner: string, people: number, time: string): Entry {
    const old = this.entries.find((e) => e.id === "sim-" + plan);
    if (old) return old;
    const e: Entry = {
      id: "sim-" + plan, no: ++this.n, venue_id: this.venue.id, venue_name: this.venue.name, name: owner, people,
      table: null, arrived_at: at(this.day, time), work_day: this.day, receipts: [], scanned_by: 0, total: 0, fee: 0,
      free: false, state: "open",
    };
    this.entries.push(e);
    return e;
  }
  setTable(entry: string, table: string | null) { const e = this.get(entry); e.table = table?.trim() || null; return e; }
  get(entry: string) { const e = this.entries.find((x) => x.id === entry); if (!e) throw new Error("Nu găsim intrarea."); return e; }

  /**
   * Un bon pe intrare. Același bon scanat de mai mulți oameni se numără o dată („scanat de 3/5”); un bon nou
   * (notă separată) se adună. Bonul trebuie să fie de după sosire și din aceeași seară.
   */
  addReceipt(entry: string, r: SimReceipt, by: ReceiptBy, member?: string): { entry: Entry; duplicate: boolean } {
    const e = this.get(entry);
    if (Date.parse(r.at) < Date.parse(e.arrived_at) - 5 * 60e3 || Date.parse(r.at) > Date.parse(e.arrived_at) + 12 * 3600e3)
      throw new Error("Bonul ăsta nu pare de la seara asta.");
    const old = this.seen.get(r.key);
    if (old && old.entry !== entry) throw new Error("Bonul ăsta e deja la altă intrare.");
    let duplicate = false;
    if (old) {
      duplicate = true;
      if (member) old.scanners.add(member);
    } else {
      const id = "r" + (this.seen.size + 1);
      this.seen.set(r.key, { entry, receipt: id, scanners: new Set(member ? [member] : []) });
      e.receipts.push({ id, total: r.total, at: r.at, number: r.number, by, scanners: 0, disputed: false });
    }
    if (member) { const s = this.scannedBy.get(entry) ?? new Set(); s.add(member); this.scannedBy.set(entry, s); }
    this.refresh(e);
    return { entry: e, duplicate };
  }
  /** Localul contestă un bon („Nu e al lor”): nu se plătește până nu verifică echipa CeFaci. */
  dispute(entry: string, receipt: string) { const e = this.get(entry); const r = e.receipts.find((x) => x.id === receipt); if (r) r.disputed = true; this.refresh(e); return e; }
  /** A doua zi la 12:00: intrările fără bon rămân „fără bon” (0 lei). */
  endOfNight() { for (const e of this.entries) if (!e.receipts.length) e.state = "no_bill"; return this.entries; }
  private refresh(e: Entry) {
    for (const r of e.receipts) r.scanners = [...this.seen.values()].find((s) => s.receipt === r.id)?.scanners.size ?? 0;
    e.scanned_by = this.scannedBy.get(e.id)?.size ?? 0;
    const t = totals(e.receipts);
    e.total = t.total; e.fee = t.fee;
    e.state = e.receipts.length ? "closed" : "open";
  }
}
