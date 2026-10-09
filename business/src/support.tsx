import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { ReportSubmission, supportCall, supportStatus, type SupportClient, type SupportReport } from "../../shared/support";
import type { SupportPhoto } from "../../shared/support-photo";
import { RequestScope } from "../../shared/contracts";
import { backend } from "./backend";
import { Button, Card, Field, Txt } from "./ui";
import { chooseSupportPhoto } from "./support-photo";

export function BusinessHelp({userId, venue}: {userId: string; venue?: string}) {
  const [title, Title] = useState(""), [description, Description] = useState(""), [photo, Photo] = useState<SupportPhoto | null>(null),
    [reports, Reports] = useState<SupportReport[]>([]), [busy, Busy] = useState(false), [frozen, Frozen] = useState(false),
    [message, Message] = useState(""), [error, ErrorMessage] = useState(""), [historyError, HistoryError] = useState(""), [historyLoaded, HistoryLoaded] = useState(false);
  const scope = useRef(new RequestScope()), attempt = useRef(new ReportSubmission()), key = useRef(randomUUID()),
    lock = useRef(false), generation = useRef(0);
  const client = backend as unknown as SupportClient;
  const load = useCallback(async () => {
    const valid = scope.current.capture(), n = ++generation.current;
    try { const rows = await supportCall<SupportReport[]>(client, "support_reports"); if(valid() && n === generation.current) {Reports(rows ?? []); HistoryError(""); HistoryLoaded(true);} }
    catch(e) {if(valid() && n === generation.current) HistoryError(e instanceof Error ? e.message : "Nu am putut încărca istoricul.");}
  }, []);
  useEffect(() => {
    scope.current.invalidate(); attempt.current.reset(); key.current = randomUUID(); lock.current = false;
    Title(""); Description(""); Photo(null); Reports([]); HistoryLoaded(false); Busy(false); Frozen(false); Message(""); ErrorMessage(""); HistoryError("");
    void load(); const timer = setInterval(() => void load(), 30000);
    const listener = AppState.addEventListener("change", state => {if(state === "active") void load();});
    const {data} = backend.auth.onAuthStateChange((event, session) => {
      if(session?.user.id !== userId || event === "SIGNED_OUT") {scope.current.invalidate(); Reports([]); Photo(null); attempt.current.reset();}
    });
    return () => {scope.current.invalidate(); clearInterval(timer); listener.remove(); data.subscription.unsubscribe();};
  }, [userId, venue, load]);
  const run = async (work: (valid: () => boolean) => Promise<void>) => {
    if(lock.current) return;
    const valid = scope.current.capture(); lock.current = true; Busy(true); Message(""); ErrorMessage("");
    try {await work(valid);} catch(e) {if(valid()) ErrorMessage(e instanceof Error ? e.message : "Nu am putut trimite. Reîncearcă online.");}
    finally {if(valid()) {lock.current = false; Busy(false); Frozen(attempt.current.frozen);}}
  };
  const reset = () => {attempt.current.reset(); key.current = randomUUID(); Title(""); Description(""); Photo(null); Frozen(false);};
  return <View style={{gap: 20}}>
    <Card title="Ajutor și feedback">
      <Txt>CeFaci este încă în dezvoltare. Ai găsit o problemă? Spune-ne.</Txt>
      <Txt muted>Raportul ajunge la echipa CeFaci. Poți urmări starea și răspunsul în această pagină.</Txt>
    </Card>
    <Card title="Raportează o problemă">
      <Field label="Titlul problemei" value={title} editable={!busy && !frozen} onChange={v => Title(v.slice(0, 120))} />
      <Field label="Descrie problema" value={description} editable={!busy && !frozen} multiline onChange={v => Description(v.slice(0, 4000))} />
      <Txt muted>Nu trimite parole, coduri de autentificare sau date bancare. Poza este opțională și ajunge doar la echipa autorizată.</Txt>
      <Button label={photo ? "Schimbă poza" : "Atașează o poză"} secondary disabled={busy || frozen} onPress={() => void run(async valid => {const next = await chooseSupportPhoto(); if(valid() && next) Photo(next);})} />
      {photo && <><Image source={{uri: photo.uri}} accessibilityLabel="Poza atașată problemei" style={{height: 180, borderRadius: 12}} resizeMode="contain" /><Txt muted>{Math.ceil(photo.bytes.byteLength / 1024)} KB · JPEG · privat</Txt><Button label="Scoate poza" secondary disabled={busy || frozen} onPress={() => Photo(null)} /></>}
      {!!error && <Txt>{error}</Txt>}{!!message && <Txt>{message}</Txt>}
      {frozen && <Txt muted>Conținutul este păstrat pentru reîncercare, ca să nu trimitem cererea de două ori.</Txt>}
      <Button label={busy ? "Trimit…" : frozen ? "Reîncearcă trimiterea" : "Trimite problema"} disabled={busy || title.trim().length < 3 || description.trim().length < 10} onPress={() => void run(async valid => {
        await attempt.current.submit(client, {key: key.current, kind: "issue", source: "business", title, description, venue, photo}, valid);
        if(!valid()) return; reset(); Message("Problema a fost trimisă echipei CeFaci. Răspunsul va apărea mai jos."); await load();
      })} />
      {frozen && <Button label="Renunță la ciornă" secondary disabled={busy} onPress={() => void run(async valid => {
        if(!valid()) return;
        if(attempt.current.draft) await supportCall(client, "support_report_cancel", {p_id: attempt.current.draft.id});
        if(valid()) {reset(); await load();}
      })} />}
    </Card>
    <Card title="Cererile și problemele tale">
      <Button label="Actualizează cererile" secondary disabled={busy} onPress={() => void load()} />
      {!!historyError && <Txt>{historyError}</Txt>}
      {!historyError && !historyLoaded && <Txt muted>Se încarcă cererile tale…</Txt>}
      {!historyError && historyLoaded && !reports.length && <Txt muted>Nu ai trimis încă nicio cerere.</Txt>}
      {reports.map(report => <View key={(report.origin ?? "support") + report.id} style={{gap: 8, paddingVertical: 12}}>
        <Txt style={{fontWeight: "600"}}>{report.title}</Txt><Txt muted>{report.kind === "missing_place" ? "Local lipsă" : report.kind === "venue_report" ? "Semnalare local" : "Problemă"} · {supportStatus[report.status] ?? report.status} · {new Date(report.created_at).toLocaleDateString("ro-RO")}</Txt>
        <Txt>{report.description}</Txt>{report.photo_available && <Txt muted>Poză atașată · privată</Txt>}
        {!!report.answer && <Txt>{"Răspuns CeFaci: " + report.answer}</Txt>}
        {report.origin !== "legacy" && report.status === "draft" && <Button label="Retrage ciorna" secondary disabled={busy} onPress={() => void run(async valid => {
          if(!valid()) return;
          await supportCall(client,"support_report_cancel",{p_id: report.id});
          if(!valid()) return;
          if(attempt.current.draft?.id === report.id || (attempt.current.frozen && !attempt.current.draft)) reset();
          Message("Ciorna a fost retrasă."); await load();
        })} />}
      </View>)}
    </Card>
  </View>;
}
