import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { ReportSubmission, supportCall, supportStatus, type SupportClient, type SupportReport } from '../../../shared/support';
import type { SupportPhoto } from '../../../shared/support-photo';
import { sb } from '../lib/auth';
import { captureAccount, useApp } from '../lib/session';
import { chooseSupportPhoto } from '../lib/support-photo';
import { useSafeAreaInsets } from '../ui/insets';
import { Big, Field, H1, Lbl, Muted, Note, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { Bilu } from '../ui/Bilu';

export default function ReportProblem() {
  const {t} = useTheme(), ins = useSafeAreaInsets(), who = useApp(s => s.who);
  const [title, Title] = useState(''), [description, Description] = useState(''), [photo, Photo] = useState<SupportPhoto | null>(null),
    [busy, Busy] = useState(false), [frozen, Frozen] = useState(false), [message, Message] = useState(''),
    [error, ErrorMessage] = useState(''), [historyError, HistoryError] = useState(''), [reports, Reports] = useState<SupportReport[]>([]), [historyLoaded, HistoryLoaded] = useState(false);
  const attempt = useRef(new ReportSubmission()), key = useRef(randomUUID()), generation = useRef(0), lock = useRef(false), mounted = useRef(true);
  const client = sb() as unknown as SupportClient;
  const load = useCallback(async () => {
    if (!who) return;
    const valid = captureAccount(), n = ++generation.current;
    try { const rows = await supportCall<SupportReport[]>(client, 'support_reports'); if (mounted.current && valid() && n === generation.current) {Reports(rows ?? []); HistoryError(''); HistoryLoaded(true);} }
    catch (e) {if (mounted.current && valid() && n === generation.current) HistoryError(e instanceof Error ? e.message : 'Nu am putut încărca istoricul.');}
  }, [who?.id]);
  useEffect(() => {
    mounted.current = true; ++generation.current; attempt.current.reset(); key.current = randomUUID();
    Title(''); Description(''); Photo(null); Reports([]); HistoryLoaded(false); Frozen(false); Busy(false); Message(''); ErrorMessage(''); HistoryError(''); lock.current = false;
    void load(); const timer = setInterval(() => void load(), 30000), listener = AppState.addEventListener('change', state => {if (state === 'active') void load();});
    return () => {mounted.current = false; ++generation.current; clearInterval(timer); listener.remove();};
  }, [who?.id, load]);
  const run = async (work: (valid: () => boolean) => Promise<void>) => {
    if (lock.current) return;
    const account = captureAccount(), valid = () => mounted.current && account(); lock.current = true; Busy(true); ErrorMessage(''); Message('');
    try {await work(valid);} catch(e) {if (valid()) ErrorMessage(e instanceof Error ? e.message : 'Nu am putut trimite. Reîncearcă online.');}
    finally {if(valid()) {lock.current = false; Busy(false); Frozen(attempt.current.frozen);}}
  };
  const reset = () => {attempt.current.reset(); key.current = randomUUID(); Title(''); Description(''); Photo(null); Frozen(false);};
  return <View style={{flex: 1, backgroundColor: t.bg}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingTop: ins.top + 12, paddingBottom: ins.bottom + 28, paddingHorizontal: 20, gap: 16}}>
    <Big label="Înapoi la Profil" color={t.s1} ink={t.ink} onPress={() => router.back()} />
    <View style={{flexDirection: 'row', gap: 12, alignItems: 'center'}}><Bilu size={60} mood="hi" still /><H1 style={{flex: 1, fontSize: 27}}>Raportează o problemă</H1></View>
    <Muted>CeFaci este încă în dezvoltare. Ai găsit o problemă? Spune-ne.</Muted>
    {!who ? <Note kind="err">Intră în cont pentru a trimite o problemă și a primi răspunsul nostru.</Note> : <>
      <Lbl>Titlul problemei</Lbl><Field accessibilityLabel="Titlul problemei" value={title} editable={!busy && !frozen} maxLength={120} onChangeText={Title} placeholder="Ce nu funcționează?" />
      <Lbl>Descrie problema</Lbl><Field accessibilityLabel="Descrie problema" value={description} editable={!busy && !frozen} maxLength={4000} onChangeText={Description} multiline placeholder="Ce făceai, ce s-a întâmplat și ce te așteptai să se întâmple?" style={{minHeight: 130, textAlignVertical: 'top'}} />
      <Muted>Nu trimite parole, coduri de autentificare sau date bancare. Poza este opțională și ajunge doar la echipa autorizată.</Muted>
      <Big label={photo ? 'Schimbă poza' : 'Atașează o poză'} color={t.s1} ink={t.ink} disabled={busy || frozen} onPress={() => void run(async valid => {const next = await chooseSupportPhoto(); if (valid() && next) Photo(next);})} />
      {photo && <><Image source={{uri: photo.uri}} accessibilityLabel="Poza atașată problemei" style={{height: 180, borderRadius: 16}} resizeMode="contain" /><Big label="Scoate poza" color={t.s1} ink={t.ink} disabled={busy || frozen} onPress={() => Photo(null)} /></>}
      {!!error && <Note kind="err">{error}</Note>}{!!message && <Note kind="ok">{message}</Note>}
      {frozen && <Muted>Conținutul este păstrat pentru reîncercare, ca să nu trimitem cererea de două ori.</Muted>}
      <Big label={busy ? 'Trimit…' : frozen ? 'Reîncearcă trimiterea' : 'Trimite problema'} disabled={busy || title.trim().length < 3 || description.trim().length < 10} onPress={() => void run(async valid => {
        await attempt.current.submit(client, {key: key.current, kind: 'issue', source: 'client', title, description, photo}, valid);
        if (!valid()) return; reset(); Message('Problema a fost trimisă echipei CeFaci. Răspunsul va apărea mai jos.'); await load();
      })} />
      {frozen && <Big label="Renunță la ciornă" color={t.s1} ink={t.ink} disabled={busy} onPress={() => void run(async valid => {
        if (!valid()) return;
        if (attempt.current.draft) await supportCall(client, 'support_report_cancel', {p_id: attempt.current.draft.id});
        if(valid()) {reset(); await load();}
      })} />}
      <T accessibilityRole="header" style={{fontFamily: F.display, fontSize: 23, marginTop: 8}}>Cererile și problemele tale</T>
      <Big label="Actualizează cererile" color={t.s1} ink={t.ink} disabled={busy} onPress={() => void load()} />
      {!!historyError && <Note kind="err">{historyError}</Note>}
      {!historyError && !historyLoaded && <Muted>Se încarcă cererile tale…</Muted>}
      {!historyError && historyLoaded && !reports.length && <Muted>Nu ai trimis încă nicio cerere.</Muted>}
      {reports.map(report => <View key={(report.origin ?? 'support') + report.id} style={{padding: 16, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1}}>
        <T style={{fontFamily: F.sb}}>{report.title}</T><Muted>{report.kind === 'missing_place' ? 'Local lipsă' : report.kind === 'venue_report' ? 'Semnalare local' : 'Problemă'} · {supportStatus[report.status] ?? report.status} · {new Date(report.created_at).toLocaleDateString('ro-RO')}</Muted>
        <T>{report.description}</T>{report.photo_available && <Muted>Poză atașată · privată</Muted>}
        {!!report.answer && <Note kind="ok">{'Răspuns CeFaci: ' + report.answer}</Note>}
        {report.origin !== 'legacy' && report.status === 'draft' && <Big label="Retrage ciorna" color={t.s1} ink={t.ink} disabled={busy} onPress={() => void run(async valid => {
          if (!valid()) return;
          await supportCall(client, 'support_report_cancel', {p_id: report.id});
          if (!valid()) return;
          if (attempt.current.draft?.id === report.id || (attempt.current.frozen && !attempt.current.draft)) reset();
          Message('Ciorna a fost retrasă.'); await load();
        })} />}
      </View>)}
    </>}
  </ScrollView></View>;
}
