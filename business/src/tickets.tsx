// Evenimente și bilete (faza 3, 22.10): localul partener vinde bilete în CeFaci. Localul e vânzătorul; banii trec prin
// Netopia direct la el, iar CeFaci oprește 8% din prețul biletelor (cu tot cu plata cu cardul). Cumpărătorul plătește
// 2 lei taxă de serviciu pe bilet (0 cu Plus), care merge la CeFaci, nu din banii localului. ACUM DOAR TEST: fără
// bani reali până la SRL și contract (docs/evenimente.md). Scanarea la intrare e în „Scanner”.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { call } from "./backend";
import { ask, Button, Card, Empty, Field, Row, Txt } from "./ui";
import type { ScreenProps } from "./screens";

type TType = { id?: string; name: string; price: string; qty: string; max_per_order: string; sold?: number; on_sale?: boolean };
type Ev = {
  id: string; title: string; kind: string; starts_at: string; ends_at: string | null; min_age: number | null; about: string | null; about_en: string | null;
  status: string; types: { id: string; name: string; price: number; qty: number; sold: number; max_per_order: number; on_sale: boolean }[];
  sold: number; scanned: number; gross: number; commission_lei: number; test: boolean;
};
type Page = { live: boolean; commission: number; fee: number; payout: null | { status: string; legal_name: string; cui: string; iban_tail: string; note: string | null }; events: Ev[] };

const KINDS: [string, string][] = [["concert", "Concert"], ["party", "Party"], ["standup", "Stand-up"], ["teatru", "Teatru"], ["festival", "Festival"], ["altele", "Altceva"]];
const STATUS: Record<string, string> = { draft: "Ciornă (nu se vede)", published: "La vânzare", sold_out: "Sold out", postponed: "Amânat", cancelled: "Anulat (bani dați înapoi)" };
const PAYOUT: Record<string, string> = { cerut: "Cerut, așteaptă verificarea CeFaci", test: "Aprobat pentru plăți de test", activ: "Activ: plăți reale", oprit: "Oprit" };
const lei = (n: number) => (Math.round(Number(n) * 100) / 100).toLocaleString("ro-RO") + " lei";
const local = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const parse = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(s.trim()); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); return isNaN(d.getTime()) ? null : d.toISOString(); };

export function Tickets({ venue, data, act, busy }: ScreenProps) {
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Ev | "new" | null>(null);
  const req = useRef(0);
  const load = () => {
    const n = ++req.current;
    void call<Page>("biz_ticket_events", { p_venue: venue }).then((r) => { if (n === req.current) { setPage(r); setError(""); } }, (e) => { if (n === req.current) setError(e instanceof Error ? e.message : "Nu am putut încărca biletele."); });
  };
  useEffect(load, [venue]);
  if (error) return <Card title="Evenimente și bilete"><Txt>{error}</Txt><Button label="Reîncearcă" onPress={load} /></Card>;
  if (!page) return <Card title="Evenimente și bilete"><Txt muted>Se încarcă…</Txt></Card>;
  const pct = Math.round(page.commission * 100);
  const ok = page.payout && (page.payout.status === "test" || page.payout.status === "activ");
  return (
    <>
      <Card title="Evenimente și bilete">
        <Txt>Vinzi bilete la evenimentele tale direct în CeFaci. Clientul plătește cu cardul, banii ajung în contul firmei tale prin Netopia, iar biletul apare în aplicație cu un cod care se schimbă singur (o poză nu merge).</Txt>
        <Txt>CeFaci oprește <Txt style={{ fontWeight: "700" }}>{pct}% din prețul biletelor</Txt>, cu tot cu plata cu cardul. Cumpărătorul plătește separat {page.fee} lei taxă de serviciu pe bilet (0 cu CeFaci Plus); taxa nu se scade din banii tăi.</Txt>
        <Txt muted>Exemplu: 100 de bilete × 50 lei = 5.000 lei. CeFaci: {lei(5000 * page.commission)}. Tu primești {lei(5000 * (1 - page.commission))}. Dacă anulezi evenimentul, toți banii se întorc automat clienților.</Txt>
        {!page.live && <Txt style={{ color: "#C2410C" }}>Acum merg doar plăți de test: nu se ia niciun ban, iar evenimentele de test le vede doar echipa ta. Plățile reale pornesc după semnarea contractului.</Txt>}
      </Card>
      <Payout venue={venue} page={page} owner={data.role === "proprietar"} act={act} busy={busy} reload={load} />
      {ok && !edit && <Button label="Adaugă un eveniment cu bilete" onPress={() => setEdit("new")} />}
      {edit && <Editor venue={venue} ev={edit === "new" ? null : edit} act={act} busy={busy} done={() => { setEdit(null); load(); }} />}
      {!edit && page.events.map((e) => (
        <Card key={e.id} title={e.title}>
          <Txt muted>{local(e.starts_at)} · {STATUS[e.status] ?? e.status}{e.test ? " · TEST" : ""}</Txt>
          <Row>
            <Stat label="Bilete vândute" value={String(e.sold)} />
            <Stat label="Au intrat" value={String(e.scanned)} />
            <Stat label="Vânzări" value={lei(e.gross)} />
            <Stat label={`CeFaci (${pct}%)`} value={lei(e.commission_lei)} />
            <Stat label="Primești" value={lei(e.gross - e.commission_lei)} />
          </Row>
          {e.types.map((t) => <Txt key={t.id} muted>{t.name}: {lei(t.price)} · {t.sold}/{t.qty} vândute{t.on_sale ? "" : " · oprit"}</Txt>)}
          {e.status !== "cancelled" && <Button label="Schimbă" secondary onPress={() => setEdit(e)} />}
        </Card>
      ))}
      {!edit && ok && !page.events.length && <Empty text="Niciun eveniment cu bilete încă." />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={{ minWidth: 120, gap: 2 }}><Txt muted style={{ fontSize: 13 }}>{label}</Txt><Txt style={{ fontSize: 18, fontWeight: "700" }}>{value}</Txt></View>;
}

function Payout({ venue, page, owner, act, busy, reload }: { venue: string; page: Page; owner: boolean; act: ScreenProps["act"]; busy: boolean; reload: () => void }) {
  const p = page.payout;
  const [firm, F] = useState(p?.legal_name ?? ""), [cui, C] = useState(p?.cui ?? ""), [iban, I] = useState("");
  const canAsk = owner && (!p || p.status === "cerut" || p.status === "oprit");
  return (
    <Card title="Contul de încasare">
      {p ? <Txt>{PAYOUT[p.status] ?? p.status} · {p.legal_name} · CUI {p.cui} · IBAN …{p.iban_tail}</Txt> : <Txt>Ca să vinzi bilete, CeFaci îți verifică firma și contul în care primești banii (prin Netopia).</Txt>}
      {p?.note ? <Txt muted>Nota CeFaci: {p.note}</Txt> : null}
      {canAsk && (
        <>
          <Field label="Firma care vinde biletele" value={firm} onChange={F} />
          <Field label="CUI" value={cui} onChange={C} />
          <Field label="IBAN-ul în care primești banii" value={iban} onChange={I} />
          <Txt muted>Păstrăm doar ultimele 4 caractere din IBAN; contul complet îl dai direct la Netopia.</Txt>
          <Button label={p ? "Trimite din nou" : "Cere contul de încasare"} disabled={busy || firm.trim().length < 2 || !/^(RO)?\d{2,10}$/i.test(cui.trim()) || iban.replace(/\s/g, "").length < 15}
            onPress={() => void act(async () => { await call("biz_ticket_payout_request", { p_venue: venue, p: { legal_name: firm.trim(), cui: cui.trim(), iban } }); reload(); }, "Cererea a ajuns la CeFaci.")} />
        </>
      )}
      {!owner && !p && <Txt muted>Contul îl cere proprietarul localului.</Txt>}
    </Card>
  );
}

function Editor({ venue, ev, act, busy, done }: { venue: string; ev: Ev | null; act: ScreenProps["act"]; busy: boolean; done: () => void }) {
  const [title, setTitle] = useState(ev?.title ?? ""), [kind, setKind] = useState(ev?.kind ?? "party");
  const [start, setStart] = useState(local(ev?.starts_at)), [end, setEnd] = useState(local(ev?.ends_at));
  const [age, setAge] = useState(ev?.min_age != null ? String(ev.min_age) : "18");
  const [about, setAbout] = useState(ev?.about ?? ""), [aboutEn, setAboutEn] = useState(ev?.about_en ?? "");
  const [types, setTypes] = useState<TType[]>(ev?.types.some((t) => t.on_sale) ? ev.types.filter((t) => t.on_sale).map((t) => ({ id: t.id, name: t.name, price: String(t.price), qty: String(t.qty), max_per_order: String(t.max_per_order), sold: t.sold, on_sale: t.on_sale })) : [{ name: "General", price: "", qty: "", max_per_order: "6" }]);
  const [status, setStatus] = useState(ev?.status === "draft" || !ev ? "draft" : ev.status);
  const setType = (i: number, k: keyof TType, v: string) => setTypes((x) => x.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const save = async (st: string) => {
    if (st === "cancelled" && !(await ask("Anulezi evenimentul?", "Toți cei care au cumpărat bilete primesc banii înapoi automat. Nu se mai poate reveni.", "Anulează și dă banii înapoi"))) return;
    void act(async () => {
      const s = parse(start), e = end ? parse(end) : null;
      if (title.trim().length < 3) throw new Error("Scrie titlul evenimentului.");
      if (!s) throw new Error("Scrie data și ora așa: 2026-11-07 22:00.");
      if (end && !e) throw new Error("Ora de final: 2026-11-08 04:00 (sau las-o goală).");
      for (const t of types) if (t.name.trim().length < 2 || !(Number(t.price) >= 1) || !(Number(t.qty) >= 1)) throw new Error("Fiecare fel de bilet are nume, preț (lei) și câte bilete sunt.");
      await call("biz_ticket_event_save", { p_venue: venue, p_id: ev?.id ?? null, p: { title: title.trim(), kind, starts_at: s, ends_at: e ?? "", min_age: age, about, about_en: aboutEn, status: st,
        types: types.map((t) => ({ id: t.id ?? "", name: t.name.trim(), price: Number(t.price), qty: Number(t.qty), max_per_order: Number(t.max_per_order) || 6, on_sale: t.on_sale ?? true })) } });
      done();
    }, st === "cancelled" ? "Eveniment anulat; banii se întorc clienților." : "Eveniment salvat.");
  };
  return (
    <Card title={ev ? ev.title : "Un eveniment nou"}>
      <Field label="Titlul" value={title} onChange={setTitle} />
      <Row>{KINDS.map(([k, l]) => <Button key={k} label={l} secondary={kind !== k} onPress={() => setKind(k)} />)}</Row>
      <Row>
        <Field label="Începe (2026-11-07 22:00)" value={start} onChange={setStart} />
        <Field label="Se termină (opțional)" value={end} onChange={setEnd} />
      </Row>
      <Row>{[["", "Fără limită de vârstă"], ["16", "16+"], ["18", "18+"]].map(([k, l]) => <Button key={k} label={l} secondary={age !== k} onPress={() => setAge(k)} />)}</Row>
      <Field label="Despre (română)" value={about} onChange={setAbout} multiline />
      <Field label="Despre (engleză, opțional)" value={aboutEn} onChange={setAboutEn} multiline />
      <Txt big style={{ fontSize: 18 }}>Feluri de bilete</Txt>
      {types.map((t, i) => (
        <View key={t.id ?? "n" + i} style={{ gap: 8 }}>
          <Row>
            <Field label="Nume (ex. General, VIP)" value={t.name} onChange={(v) => setType(i, "name", v)} />
            <Field label="Preț (lei)" value={t.price} onChange={(v) => setType(i, "price", v)} numeric editable={!t.sold} />
            <Field label="Câte bilete" value={t.qty} onChange={(v) => setType(i, "qty", v)} numeric />
            <Field label="Max. pe comandă" value={t.max_per_order} onChange={(v) => setType(i, "max_per_order", v)} numeric />
          </Row>
          {t.sold ? <Txt muted>{t.sold} vândute: prețul nu se mai schimbă.</Txt> : null}
          {types.length > 1 && <Button label={t.sold ? "Oprește vânzarea" : "Scoate"} secondary onPress={() => setTypes((x) => x.filter((_, j) => j !== i))} />}
        </View>
      ))}
      {types.length < 8 && <Button label="Mai adaugă un fel de bilet" secondary onPress={() => setTypes((x) => [...x, { name: "", price: "", qty: "", max_per_order: "6" }])} />}
      <Txt muted>Starea: {STATUS[status]}</Txt>
      <Row>
        <Button label="Salvează ca ciornă" secondary disabled={busy} onPress={() => { setStatus("draft"); void save("draft"); }} />
        <Button label="Pune la vânzare" disabled={busy} onPress={() => { setStatus("published"); void save("published"); }} />
        {ev && <Button label="Sold out" secondary disabled={busy} onPress={() => void save("sold_out")} />}
        {ev && <Button label="Amânat" secondary disabled={busy} onPress={() => void save("postponed")} />}
        {ev && <Button label="Anulează evenimentul" secondary disabled={busy} onPress={() => void save("cancelled")} />}
        <Button label="Renunț" secondary onPress={done} />
      </Row>
    </Card>
  );
}
