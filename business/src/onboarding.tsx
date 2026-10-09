import { useEffect, useRef, useState } from "react";
import { View, ScrollView } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { Bilu } from "../../shared/Bilu";
import { RequestScope } from "../../shared/contracts";
import { backend, call } from "./backend";
import { Button, Card, Field, Txt } from "./ui";
import { chooseProof, requestKey, uploadProof, type ClaimVenue, type PartnerRequest, type Proof, type RequestDetails, type RequestKind } from "./onboarding-api";

const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Nu am putut încheia pasul. Reîncearcă online.";

export function BusinessEntry() {
  const [mode, setMode] = useState<"start" | "existing" | "new">("start");
  const [email, E] = useState(""), [code, C] = useState(""), [sent, S] = useState(false),
    [busy, B] = useState(false), [message, M] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const switchMode = (next: typeof mode) => { setMode(next); S(false); C(""); M(""); };
  const run = async (verify: boolean) => {
    B(true); M("");
    try {
      const { error } = verify
        ? await backend.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" })
        : await backend.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: mode === "new" } });
      if (error) throw error;
      if (!verify && mounted.current) { S(true); M("Verifică emailul și introdu codul primit."); }
    } catch (e) { if (mounted.current) M(errorMessage(e)); }
    finally { if (mounted.current) B(false); }
  };
  return <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: 20, padding: 20 }}>
    <View style={{ alignItems: "center" }}><Bilu mood="hi" size={130} still /><Txt big>CeFaci Business</Txt></View>
    {mode === "start" ? <Card title="Localul tău, în CeFaci">
      <Txt>Gestionează localul și echipa ta sau solicită să devii partener.</Txt>
      <Button label="Ai deja cont? Intră" onPress={() => switchMode("existing")} />
      <Button label="Revendică localul" secondary onPress={() => switchMode("new")} />
      <Txt muted>Nu îți găsești localul? Poți solicita adăugarea lui după ce îți confirmi adresa de email.</Txt>
    </Card> : <Card title={mode === "existing" ? "Intră cu același cont CeFaci" : "Hai să găsim localul tău"}>
      <Txt muted>{mode === "existing" ? "Folosește adresa contului CeFaci. Dacă ești în echipa unui local, intri cu rolul acordat de proprietar." : "Confirmă adresa de email. Poți folosi contul CeFaci existent sau crea unul aici. Cererea de parteneriat se verifică separat."}</Txt>
      <Field label="Email" editable={!busy} value={email} onChange={(v) => { E(v); S(false); C(""); M(""); }} />
      {sent && <Field label="Codul primit prin email" numeric editable={!busy} value={code} onChange={C} />}
      <Button label={busy ? "Așteaptă…" : sent ? "Intră" : "Trimite codul"} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || (sent && !code.trim())} onPress={() => void run(sent)} />
      {sent && <Button label="Retrimite codul" secondary disabled={busy} onPress={() => void run(false)} />}
      {!!message && <Txt>{message}</Txt>}
      <Button label={mode === "existing" ? "Nu am cont · Revendică localul" : "Ai deja cont? Intră"} secondary disabled={busy} onPress={() => switchMode(mode === "existing" ? "new" : "existing")} />
      <Button label="Înapoi" secondary disabled={busy} onPress={() => switchMode("start")} />
    </Card>}
  </View>;
}

const labels: Record<string, string> = {
  draft: "Ciornă · documentul nu a fost trimis", pending: "În verificare", under_review: "În verificare",
  needs_info: "Sunt necesare informații suplimentare", more_info: "Sunt necesare informații suplimentare",
  approved: "Verificare aprobată · contract și activare în așteptare", verified: "Verificare aprobată · contract și activare în așteptare", rejected: "Cerere respinsă", cancelled: "Cerere retrasă",
  activated: "Parteneriat activ",
};
const kinds: Record<RequestKind, string> = { claim: "Revendicare", dispute: "Dispută", new: "Adăugare local" };
const blank: RequestDetails = { requester_name: "", requester_role: "", firm: "", cui: "", phone: "", venue_name: "", address: "", city: "", category: "" };

export function BusinessOnboarding({ session, onRefreshAccess, onSignOut, onBack, onHelp, accessError }: {
  session: Session; onRefreshAccess: () => Promise<void>; onSignOut: () => Promise<void>; onBack?: () => void; onHelp?: () => void; accessError?: string;
}) {
  const [stage, Stage] = useState<"home" | "search" | "form">("home"), [query, Q] = useState(""),
    [found, Found] = useState<ClaimVenue[]>([]), [searched, Searched] = useState(false),
    [chosen, Chosen] = useState<ClaimVenue | null>(null), [kind, Kind] = useState<RequestKind>("claim"),
    [details, Details] = useState<RequestDetails>({ ...blank }), [proof, ProofState] = useState<Proof | null>(null),
    [requests, Requests] = useState<PartnerRequest[]>([]), [busy, B] = useState(false),
    [message, M] = useState(""), [listError, ListError] = useState(""),
    [identity, Identity] = useState<{ has_profile: boolean; username: string | null; first_name: string | null } | null>(null),
    [identityError, IdentityError] = useState(""), [firstName, FirstName] = useState(""),
    [username, Username] = useState(""), [birthDate, BirthDate] = useState("");
  const scope = useRef(new RequestScope()), lock = useRef(false), searchGeneration = useRef(0), listGeneration = useRef(0),
    draft = useRef<PartnerRequest | null>(null), key = useRef(requestKey());
  const load = async () => {
    const valid = scope.current.capture(), generation = ++listGeneration.current;
    try {
      const rows = await call<PartnerRequest[]>("biz_partner_requests");
      if (valid() && generation === listGeneration.current) { Requests(rows ?? []); ListError(""); }
    } catch (e) { if (valid() && generation === listGeneration.current) ListError(errorMessage(e)); }
  };
  const loadIdentity = async () => {
    const valid = scope.current.capture();
    try {
      const result = await call<{ has_profile: boolean; username: string | null; first_name: string | null }>("biz_identity_status");
      if (valid()) { Identity(result); IdentityError(""); }
    } catch (e) { if (valid()) IdentityError(errorMessage(e)); }
  };
  useEffect(() => {
    scope.current.invalidate(); void load(); void loadIdentity();
    const timer = setInterval(() => void load(), 30000);
    return () => { clearInterval(timer); scope.current.invalidate(); };
  }, [session.user.id]);
  const run = async (work: (valid: () => boolean) => Promise<void>) => {
    if (lock.current) return;
    const valid = scope.current.capture(); lock.current = true; B(true); M("");
    try { await work(valid); } catch (e) { if (valid()) M(errorMessage(e)); }
    finally { if (valid()) { lock.current = false; B(false); } }
  };
  const form = (next: RequestKind, venue: ClaimVenue | null) => {
    draft.current = null; key.current = requestKey(); ProofState(null); Details({ ...blank });
    Kind(next); Chosen(venue); M(""); Stage("form");
  };
  const field = (name: keyof RequestDetails, value: string) => Details((old) => ({ ...old, [name]: value }));
  const canSubmit = !!proof && [details.requester_name, details.requester_role, details.firm, details.cui, details.phone].every((v) => !!v.trim()) &&
    (kind !== "new" || [details.venue_name, details.address, details.city, details.category].every((v) => !!v?.trim()));
  const submit = () => run(async (valid) => {
    if (!proof) throw new Error("Alege documentul care dovedește legătura dintre local și firmă.");
    {
      const created = await call<PartnerRequest>("biz_partner_request_create", { p_key: key.current, p_kind: kind, p_venue: chosen?.id ?? null, p_details: details });
      if (!valid()) return; draft.current = created;
    }
    if (draft.current.status !== "draft" && draft.current.status !== "pending")
      throw new Error("Această cerere a fost deja încheiată. Verifică lista cererilor tale.");
    if (draft.current.status === "draft") {
      const path = await uploadProof(session.user.id, draft.current.id, proof);
      if (!valid()) return;
      await call("biz_partner_request_submit", { p_id: draft.current.id, p_path: path });
      if (!valid()) return;
    }
    draft.current = null; ProofState(null); Stage("home");
    M("Cererea și documentul au fost trimise. Urmărește decizia aici; localul rămâne neschimbat până la aprobare.");
    await load();
  });
  const cancelDraft = () => run(async (valid) => {
    if (draft.current) await call("biz_partner_request_cancel", { p_id: draft.current.id });
    if (!valid()) return;
    draft.current = null; ProofState(null); Stage("home"); await load();
  });
  const title = kind === "new" ? "Solicită adăugarea localului" : kind === "dispute" ? "Dispută pentru local" : "Revendică localul";
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 20, width: "100%", maxWidth: 760, alignSelf: "center" }}>
    <View style={{ alignItems: "center", gap: 8 }}><Bilu mood="hi" size={100} still /><Txt big>Hai să găsim localul tău</Txt><Txt muted>{session.user.email ?? "Cont CeFaci confirmat"}</Txt></View>
    {onHelp && <Card><Txt muted>CeFaci este încă în dezvoltare. Ai găsit o problemă? Spune-ne.</Txt><Button label="Ajutor · Raportează o problemă" secondary disabled={busy} onPress={onHelp} /></Card>}
    {!!accessError && <Card title="Accesul nu a putut fi verificat"><Txt>{accessError}</Txt><Txt muted>Poți reîncerca actualizarea accesului din lista cererilor.</Txt></Card>}
    {!!message && <Card><Txt>{message}</Txt></Card>}
    {!!identityError && <Card title="Verifică profilul contului"><Txt>{identityError}</Txt><Button label="Reîncearcă verificarea profilului" secondary disabled={busy} onPress={() => void run(async () => { await loadIdentity(); })} /></Card>}
    {identity && !identity.has_profile && <Card title="Completează contul CeFaci">
      <Txt>Ai confirmat emailul. Completează profilul contului pe care îl vei folosi în Client și Business. Acest pas nu acordă acces la un local.</Txt>
      <Field label="Prenume" value={firstName} editable={!busy} onChange={FirstName} />
      <Field label="Username CeFaci" value={username} editable={!busy} onChange={(v) => Username(v.toLowerCase())} />
      <Field label="Data nașterii (AAAA-LL-ZZ)" value={birthDate} editable={!busy} onChange={BirthDate} />
      <Txt muted>Contul CeFaci este disponibil de la 16 ani. Data nașterii nu apare pe profilul public.</Txt>
      <Button label="Salvează profilul contului" disabled={busy || firstName.trim().length < 2 || username.trim().length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)} onPress={() => void run(async (valid) => {
        await call("biz_identity_complete", { p_username: username.trim(), p_first_name: firstName.trim(), p_birth_date: birthDate });
        if (!valid()) return;
        await loadIdentity();
        if (valid()) M("Profilul contului CeFaci a fost completat. Cererea pentru local se verifică separat.");
      })} />
    </Card>}
    {stage === "home" && <Card title="Devino partener CeFaci">
      <Txt>Caută localul și dovedește că reprezinți firma. Dacă lipsește, solicită adăugarea lui.</Txt>
      <Button label="Revendică localul" disabled={busy} onPress={() => { M(""); Stage("search"); }} />
      <Button label="Nu găsesc localul · Solicit adăugarea" secondary disabled={busy} onPress={() => form("new", null)} />
      <Txt muted>Ești angajat? Proprietarul te adaugă în echipă folosind username-ul tău CeFaci.</Txt>
    </Card>}
    {stage === "search" && <Card title="Caută localul">
      <Field label="Numele localului sau orașul" value={query} editable={!busy} onChange={(v) => { Q(v); ++searchGeneration.current; Found([]); Searched(false); }} />
      <Button label="Caută" disabled={busy || query.trim().length < 2} onPress={() => void run(async (valid) => {
        const generation = ++searchGeneration.current;
        const rows = await call<ClaimVenue[]>("biz_venue_search", { p_query: query.trim() });
        if (valid() && generation === searchGeneration.current) { Found(rows ?? []); Searched(true); }
      })} />
      {searched && !found.length && <Txt muted>Nu am găsit un local pentru această căutare. Încearcă alt nume sau solicită adăugarea lui.</Txt>}
      {found.map((venue) => <Card key={venue.id} title={venue.name}>
        <Txt muted>{[venue.address, venue.city].filter(Boolean).join(" · ")}</Txt>
        <Txt>{venue.claimed ? "Local deja revendicat. Poți deschide o dispută cu document justificativ." : "Local disponibil pentru revendicare."}</Txt>
        <Button label={venue.claimed ? "Deschide dispută" : "Acesta este localul meu"} disabled={busy} onPress={() => form(venue.claimed ? "dispute" : "claim", venue)} />
      </Card>)}
      <Button label="Nu găsesc localul · Solicit adăugarea" secondary disabled={busy} onPress={() => form("new", null)} />
      <Button label="Înapoi" secondary disabled={busy} onPress={() => Stage("home")} />
    </Card>}
    {stage === "form" && <>
      <Card title={title}>
        {!!chosen && <Txt>{chosen.name} · {[chosen.address, chosen.city].filter(Boolean).join(" · ")}</Txt>}
        <Txt muted>{kind === "dispute" ? "Documentul este obligatoriu. Proprietarul actual are 3 zile să răspundă; accesul și pagina localului rămân neschimbate până la decizie." : "Trimite cererea cu un document justificativ. Echipa CeFaci verifică firma și dreptul tău de a reprezenta localul."}</Txt>
        <Txt muted>Verificarea se face manual, de regulă în 2–3 zile. Codul din email confirmă contul, nu proprietatea localului.</Txt>
      </Card>
      {kind === "new" && <Card title="1. Localul">
        <Field label="Numele localului" value={details.venue_name ?? ""} editable={!busy && !draft.current} onChange={(v) => field("venue_name", v)} />
        <Field label="Adresa completă" value={details.address ?? ""} editable={!busy && !draft.current} onChange={(v) => field("address", v)} />
        <Field label="Oraș" value={details.city ?? ""} editable={!busy && !draft.current} onChange={(v) => field("city", v)} />
        <Field label="Categoria localului" value={details.category ?? ""} editable={!busy && !draft.current} onChange={(v) => field("category", v)} />
      </Card>}
      <Card title={kind === "new" ? "2. Firma și tu" : "1. Firma și tu"}>
        <Field label="Numele tău complet" value={details.requester_name} editable={!busy && !draft.current} onChange={(v) => field("requester_name", v)} />
        <Field label="Rolul tău în firmă" value={details.requester_role} editable={!busy && !draft.current} onChange={(v) => field("requester_role", v)} />
        <Field label="Denumirea firmei" value={details.firm} editable={!busy && !draft.current} onChange={(v) => field("firm", v)} />
        <Field label="CUI" value={details.cui} editable={!busy && !draft.current} onChange={(v) => field("cui", v)} />
        <Field label="Telefonul tău de contact" value={details.phone} editable={!busy && !draft.current} onChange={(v) => field("phone", v)} />
      </Card>
      <Card title={kind === "new" ? "3. Documentul justificativ" : "2. Documentul justificativ"}>
        <Txt>Certificat constatator ONRC, certificat de înregistrare, contract de închiriere sau autorizație. Acoperă CNP-ul și datele personale care nu sunt necesare verificării.</Txt>
        <Txt muted>PDF, JPEG sau PNG, maximum 8 MB. Documentul este privat, accesibil pentru verificarea cererii.</Txt>
        <Button label={proof ? "Schimbă documentul" : "Încarcă documentul"} secondary disabled={busy || !!draft.current} onPress={() => void run(async (valid) => { const next = await chooseProof(); if (valid() && next) ProofState(next); })} />
        {proof && <Txt>{proof.name} · {Math.ceil(proof.bytes.byteLength / 1024)} KB</Txt>}
        {draft.current && <Txt muted>Ciorna este salvată. Reîncearcă trimiterea documentului; pentru alte date, renunță la ciornă și începe din nou.</Txt>}
        <Button label={busy ? "Se trimite…" : "Trimite cererea pentru verificare"} disabled={busy || !canSubmit} onPress={() => void submit()} />
        <Button label={draft.current ? "Renunță la ciornă" : "Înapoi"} secondary disabled={busy} onPress={() => void cancelDraft()} />
      </Card>
    </>}
    <Card title="Cererile tale">
      {!!listError && <Txt>{listError}</Txt>}
      {!requests.length && !listError && <Txt muted>Nu ai trimis încă o cerere.</Txt>}
      {requests.map((r) => <Card key={r.id} title={r.venue_name || r.details.venue_name || "Local nou"}>
        <Txt>{kinds[r.kind]} · {labels[r.status] ?? r.status}</Txt>
        <Txt muted>Referință {r.id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString("ro-RO")}</Txt>
        {!!(r.decision_note || r.review_note) && <Txt>{r.decision_note || r.review_note}</Txt>}
        {r.kind === "dispute" && r.status === "pending" && <Txt muted>{r.owner_response_deadline ? `Proprietarul actual poate răspunde până la ${new Date(r.owner_response_deadline).toLocaleString("ro-RO")}.` : "Disputa așteaptă să fie văzută de proprietarul actual în Business; apoi are 3 zile să răspundă."} Cererea nu transferă accesul la local.</Txt>}
        {r.status === "draft" && <Txt muted>Această ciornă nu este în verificare. Retrage-o și trimite o cerere completă cu documentul justificativ.</Txt>}
        {["draft", "pending", "needs_info", "more_info"].includes(r.status) && <Button label="Retrage cererea" secondary disabled={busy} onPress={() => void run(async (valid) => {
          await call("biz_partner_request_cancel", { p_id: r.id }); if (valid()) await load();
        })} />}
      </Card>)}
      <Button label="Actualizează cererile și accesul" secondary disabled={busy} onPress={() => void run(async (valid) => { await load(); if (valid()) await onRefreshAccess(); })} />
    </Card>
    {onBack && <Button label="Înapoi la panoul localului" secondary disabled={busy} onPress={onBack} />}
    <Button label="Ieși din cont" secondary disabled={busy} onPress={() => void run(async () => { await onSignOut(); })} />
  </ScrollView>;
}

type OwnershipDispute = {
  id: string; venue_id: string; venue_name: string; submitted_at: string; deadline: string;
  response: string | null; status: string;
};
export function OwnershipDisputes({ venue }: { venue: string }) {
  const [rows, Rows] = useState<OwnershipDispute[]>([]), [replies, Replies] = useState<Record<string, string>>({}),
    [error, ErrorState] = useState(""), [busy, Busy] = useState(false);
  const scope = useRef(new RequestScope()), generation = useRef(0), locked = useRef(false);
  const load = async () => {
    const valid = scope.current.capture(), n = ++generation.current;
    try {
      const result = await call<OwnershipDispute[]>("biz_ownership_disputes", { p_venue: venue });
      if (valid() && n === generation.current) { Rows(result ?? []); ErrorState(""); }
    } catch (e) { if (valid() && n === generation.current) ErrorState(errorMessage(e)); }
  };
  useEffect(() => {
    scope.current.invalidate(); Rows([]); Replies({}); void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { clearInterval(timer); scope.current.invalidate(); };
  }, [venue]);
  if (!rows.length && !error) return null;
  return <Card title="Revendicări asupra localului tău">
    {!!error && <><Txt>{error}</Txt><Button label="Reîncearcă verificarea disputelor" secondary disabled={busy} onPress={() => void load()} /></>}
    {rows.map((r) => <Card key={r.id} title="Dispută privind proprietatea localului">
      <Txt>O persoană a solicitat revendicarea localului. Pagina și accesul echipei rămân neschimbate până la decizia CeFaci.</Txt>
      <Txt muted>Referință {r.id.slice(0, 8)} · Răspunde până la {new Date(r.deadline).toLocaleString("ro-RO")}.</Txt>
      {r.response ? <><Txt big style={{ fontSize: 18 }}>Răspunsul tău a fost trimis</Txt><Txt>{r.response}</Txt></> : new Date(r.deadline).getTime() <= Date.now() ?
        <Txt muted>Termenul pentru răspuns a expirat. CeFaci verifică documentele și decide.</Txt> : <>
        <Field label="Răspuns pentru verificarea CeFaci" value={replies[r.id] ?? ""} multiline editable={!busy} onChange={(v) => Replies((old) => ({ ...old, [r.id]: v }))} />
        <Txt muted>Descrie de ce firma ta are dreptul să administreze localul. Răspunsul se păstrează și nu mai poate fi modificat după trimitere.</Txt>
        <Button label="Trimite răspunsul la dispută" disabled={busy || (replies[r.id] ?? "").trim().length < 10 || (replies[r.id] ?? "").length > 2000} onPress={() => void (async () => {
          if (locked.current) return;
          const valid = scope.current.capture(); locked.current = true; Busy(true); ErrorState("");
          try {
            await call("biz_ownership_dispute_reply", { p_id: r.id, p_reply: replies[r.id].trim() });
            if (valid()) await load();
          } catch (e) { if (valid()) ErrorState(errorMessage(e)); }
          finally { if (valid()) { locked.current = false; Busy(false); } }
        })()} />
      </>}
    </Card>)}
  </Card>;
}
