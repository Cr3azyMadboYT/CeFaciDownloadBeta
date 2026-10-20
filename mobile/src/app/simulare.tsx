// „Simulează o seară” (docs/flux-intrare-bon.md → Simularea): tot fluxul intrării la un local partener, pe date de
// probă, fără server, fără cont și fără bani reali — plan → „Ai ajuns?” (cu sau fără locație) → codul de pe masă →
// masa → +40 de minute → bonul → plata → acasă. Folosește aceleași piese ca biletul adevărat (ui/EntryFlow) și
// motorul SimNight (shared/entries.ts), cu butoane care țin locul camerei și al locației.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { SimNight, groupName, sampleReceipt, type Entry } from '../../../shared/entries';
import { lei } from '../lib/entry';
import { ArrivePrompt, Arrived, BillPick, EntryCard, PayTicket, TablePick, TableScan } from '../ui/EntryFlow';
import { Ticket } from '../ui/Ticket';
import { Bilu } from '../ui/Bilu';
import { Icon } from '../ui/Icon';
import { Big, H1, Muted, Note, Press, Quiet, Seg, Sheet, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';
import { Doodles } from '../ui/Doodles';
import { tr, pick } from '../lib/i18n';

type Step = 'plan' | 'where' | 'scan' | 'table' | 'wait' | 'remind' | 'bill' | 'pay' | 'done' | 'nobill';
const ORDER: Step[] = ['plan', 'where', 'scan', 'table', 'wait', 'remind', 'bill', 'pay', 'done'];
const PEOPLE = ['Andrei', 'Mihai', 'Ioana', 'Radu', 'Ana'];
const CODE = 'AUB123';
const PLAN = 'p1';
const QR = 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2';
// the receipt from the till: 420 lei, then a separate note of 86 lei
const LINES: [string, number][] = [['Burger Aubergine', 58], ['Paste cu trufe', 64], ['Salată Caesar', 46], ['Risotto cu ciuperci', 59], ['Pizza Margherita', 52], ['Limonadă x3', 54], ['Vin la pahar x2', 52], ['Tiramisu', 35]];

const copy = (e: Entry): Entry => ({ ...e, receipts: e.receipts.map((r) => ({ ...r })) });

export default function Simulare() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const sim = useRef(new SimNight());
  const [step, setStep] = useState<Step>('plan');
  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const [loc, setLoc] = useState(true);
  const [later, setLater] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [hint, setHint] = useState('');
  const [xp, setXp] = useState(0);
  const [billOpen, setBillOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [table, setTable] = useState<string | null>(null);
  const [run, setRun] = useState(0); // a new run: the pieces with their own state start clean
  const scroll = useRef<ScrollView>(null);
  const day = sim.current.day;
  const r1 = useMemo(() => sampleReceipt(day, '21:52', '0187', LINES), [day]);
  const r2 = useMemo(() => sampleReceipt(day, '22:31', '0203', [['Cocktail x2', 86]]), [day]);
  const raw = sim.current.entries[0];
  const entry = raw ? copy(raw) : null;
  const venue = sim.current.venue.name;

  const go = (s: Step) => { setStep(s); setHint(''); setScanErr(''); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const restart = () => {
    sim.current = new SimNight();
    setLoc(true); setLater(false); setNote(null); setXp(0); setTable(null); setBillOpen(false); setPayOpen(false); setTableOpen(false);
    setRun((x) => x + 1); go('plan');
  };
  const scanCode = (c: string) => {
    if (c.trim().toUpperCase() !== CODE) { setScanErr(tr('Codul ăsta e de la alt local.')); return; }
    sim.current.arrive(PLAN, PEOPLE[0], PEOPLE.length, '20:14');
    bump(); go('table');
  };
  const photo = () => {
    setBillOpen(false);
    if (!entry) return;
    try {
      const first = !xp;
      sim.current.addReceipt(entry.id, r1, 'client', 'andrei');
      if (first) setXp(25);
      setNote({ kind: 'ok', text: tr('Bon citit: {total}', { total: lei(r1.total) }) + (first ? ' +25 XP.' : '') });
    } catch (e) { setNote({ kind: 'err', text: tr((e as Error).message) }); }
    bump();
    if (step === 'wait' || step === 'remind') go('bill');
  };
  const sameBill = () => {
    if (!entry) return;
    const res = sim.current.addReceipt(entry.id, r1, 'client', 'mihai');
    setNote({ kind: 'ok', text: tr('{who} a scanat același bon.', { who: 'Mihai' }) + ' ' + (res.duplicate ? tr('Bonul ăsta e deja scanat de cineva din gașcă — e numărat o dată.') : '') });
    bump();
  };
  const separate = () => {
    if (!entry) return;
    sim.current.addReceipt(entry.id, r2, 'client', 'ioana');
    setNote({ kind: 'ok', text: tr('Notă separată de la {who}: {total}. Se adună la aceeași intrare.', { who: 'Ioana', total: lei(r2.total) }) });
    bump();
  };
  const noBill = () => { sim.current.endOfNight(); bump(); go('nobill'); };

  const i = ORDER.indexOf(step);
  const fee = entry ? lei(entry.fee) : '';
  const staffLine = entry ? '#' + entry.no + ' · ' + groupName(entry) + (entry.table ? ' · ' + tr('masa {n}', { n: entry.table }) : '') + ' · 20:14 · ' + tr('așteaptă bonul') : '';
  const card = entry ? (
    <EntryCard entry={entry} note={step === 'bill' || step === 'pay' ? note : null} highlight={step === 'remind'}
      onTable={() => { setTable(entry.table); setTableOpen(true); }} onScanBill={() => setBillOpen(true)} onShowTicket={() => setPayOpen(true)} />
  ) : null;

  const STEPS: Record<Step, { title: string; caption: string; body: ReactNode; next: { label: string; onPress: () => void } }> = {
    plan: {
      title: tr('Planul'),
      caption: tr('Andrei face planul „Cină cu gașca” la Aubergine, vineri la 20:00, și apasă „Facem așa”. Mihai, Ioana, Radu și Ana zic „Vin”: toți cinci sunt în aceeași intrare.'),
      body: (
        <View style={{ gap: 12 }}>
          <View style={{ marginHorizontal: -20 }}>
            <Ticket bg={t.bg} d={{ pid: 'SIM-12', place: venue, kind: tr('Cină cu gașca'), area: 'București', day: pick('Vineri, 23 oct.', 'Friday, 23 Oct'), hour: '20:00', people: 5, cost: '~90 lei', last: { label: tr('Grup'), value: tr('Prin CeFaci'), dot: '#2F5BFF' } }} />
          </View>
          <View style={{ padding: 14, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
            <T style={{ fontFamily: F.b, fontSize: 15 }}>{tr('Cine vine ({n} din {all})', { n: 5, all: 5 })}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PEOPLE.map((p, k) => (
                <View key={p} style={{ height: 30, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', backgroundColor: t.blueSoft }}>
                  <T style={{ fontFamily: F.sb, fontSize: 13, color: t.blueInk }}>{(k === 0 ? tr('{name} (tu)', { name: p }) : p) + tr(' · vine')}</T>
                </View>
              ))}
            </View>
          </View>
          <Note kind="ok">{tr('„Facem așa” — gata. Biletul e la toți cinci.')}</Note>
        </View>
      ),
      next: { label: tr('Mai departe'), onPress: () => go('where') },
    },
    where: {
      title: tr('„Ai ajuns?”'),
      caption: loc
        ? tr('Vineri, 20:12. Locația e pornită: când telefonul e la cel mult 150 m de local, în fereastra planului, Bilu întreabă (și pe Acasă, cu notificare dacă aplicația e închisă).')
        : tr('Vineri, 20:00. Locația e oprită: aceeași întrebare apare pe bilet și pe Acasă la ora planului, fără locație.'),
      body: (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Seg label={tr('Locația pornită')} on={loc} onPress={() => { setLoc(true); setLater(false); }} />
            <Seg label={tr('Locația oprită')} on={!loc} onPress={() => { setLoc(false); setLater(false); }} />
          </View>
          <ArrivePrompt name={venue} dist={loc ? 40 : null} onYes={() => go('scan')} onLater={() => setLater(true)} />
          {later ? <Note kind="ok">{tr('Bine. Bilu te întreabă din nou peste 15 minute.')}</Note> : null}
        </View>
      ),
      next: { label: tr('Mai departe'), onPress: () => go('scan') },
    },
    scan: {
      title: tr('Codul de pe masă'),
      caption: tr('Se deschide camera. Codul CeFaci al localului e lipit pe masă; trebuie să fie al localului din plan. Dacă nu merge camera, scrii cele 6 caractere de sub QR (aici: {code}).', { code: CODE }),
      body: (
        <TableScan key={run} error={scanErr} onCode={scanCode} onClose={() => go('where')} camera={
          <View style={{ minHeight: 230, padding: 16, gap: 14, borderRadius: 18, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 112, height: 112, borderRadius: 16, borderWidth: 3, borderStyle: 'dashed', borderColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={QR} size={56} color="#FFFFFF" width={1.6} />
            </View>
            <Big style={{ alignSelf: 'stretch' }} label={tr('Simulează scanarea codului de pe masă')} color="#FFD43B" ink="#0E1440" onPress={() => scanCode(CODE)} />
          </View>
        } />
      ),
      next: { label: tr('Mai departe'), onPress: () => scanCode(CODE) },
    },
    table: {
      title: tr('Ați ajuns!'),
      caption: tr('Toată gașca vede același lucru. Dacă scanează și Mihai codul, intră în aceeași intrare, nu se face alta. Masa e opțională: doar ajută ospătarul.'),
      body: (
        <View style={{ gap: 12 }}>
          <View style={{ padding: 14, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
            <Arrived key={run} entry={entry} onSave={(v) => { if (entry) sim.current.setTable(entry.id, v); bump(); go('wait'); }} onSkip={() => go('wait')} />
          </View>
          <Big label={tr('Simulează: Mihai scanează și el codul')} color={t.s2} ink={t.ink}
            onPress={() => { const e = sim.current.arrive(PLAN, PEOPLE[0], PEOPLE.length, '20:16'); setHint(tr('Mihai a scanat și el codul: a ajuns în aceeași intrare, #{no}.', { no: e.no })); }} />
          {hint ? <Note kind="ok">{hint}</Note> : null}
        </View>
      ),
      next: { label: tr('Mai departe'), onPress: () => go('wait') },
    },
    wait: {
      title: tr('Ospătarul vede intrarea'),
      caption: tr('În CeFaci Business, la „Intrări deschise acum”: „{line}”.', { line: staffLine }),
      body: (
        <View style={{ gap: 10 }}>
          {card}
          <Quiet label={tr('Ce se întâmplă fără bon?')} onPress={noBill} />
        </View>
      ),
      next: { label: tr('+40 de minute'), onPress: () => go('remind') },
    },
    remind: {
      title: tr('După 40 de minute'),
      caption: tr('Bilu trimite notificarea (a doua: a doua zi la prânz). Apăsată, deschide biletul la pasul cu bonul.'),
      body: (
        <View style={{ gap: 12 }}>
          <Press onPress={() => go('bill')} accessibilityLabel={tr('Nu uita de bon, ne ajută și pe noi și pe tine :)')}
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 22, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, shadowColor: '#0E1440', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Bilu size={34} mood="wink" shadow={false} still /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Muted style={{ fontSize: 12 }}>{tr('CeFaci · acum')}</Muted>
              <T style={{ fontFamily: F.b, fontSize: 15 }}>{tr('Bilu de la CeFaci')}</T>
              <T style={{ fontFamily: F.m, fontSize: 14, lineHeight: 19 }}>{tr('Nu uita de bon, ne ajută și pe noi și pe tine :)')}</T>
            </View>
          </Press>
          {card}
          <Quiet label={tr('Ce se întâmplă fără bon?')} onPress={noBill} />
        </View>
      ),
      next: { label: tr('Mai departe'), onPress: () => go('bill') },
    },
    bill: {
      title: tr('Bonul'),
      caption: tr('„Scanează bonul”: serverul citește firma, data, ora, numărul bonului și totalul. Același bon se numără o singură dată, oricâți l-ar scana; notele separate se adună.'),
      body: (
        <View style={{ gap: 10 }}>
          {card}
          {entry?.receipts.length ? (
            <>
              <Big label={tr('Simulează: Mihai scanează același bon')} color={t.s2} ink={t.ink} onPress={sameBill} />
              {entry.receipts.length < 2 ? <Big label={tr('Simulează: notă separată ({total})', { total: lei(r2.total) })} color={t.s2} ink={t.ink} onPress={separate} /> : null}
            </>
          ) : null}
        </View>
      ),
      next: { label: tr('Mai departe'), onPress: () => { if (!entry?.receipts.length) photo(); else go('pay'); } },
    },
    pay: {
      title: tr('Plata la masă'),
      caption: tr('Clientul apasă „Arată biletul la plată”. Ospătarul scanează codul și face poza notei: ajunge la aceeași intrare.'),
      body: card,
      next: { label: tr('Mai departe'), onPress: () => go('done') },
    },
    done: {
      title: tr('Gata, ați plecat acasă'),
      caption: tr('A doua zi, localul vede intrarea în dashboard, cu poza bonului, și o poate contesta cu „Nu e al lor”.'),
      body: entry ? (
        <View style={{ padding: 16, gap: 10, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Bilu size={48} mood="yay" shadow={false} still />
            <T style={{ flex: 1, fontFamily: F.display, fontSize: 22 }}>{tr('Gata, ați plecat acasă')}</T>
          </View>
          <T style={{ fontFamily: F.b, fontSize: 15 }}>{tr('Intrarea #{no} · {group}', { no: entry.no, group: groupName(entry) }) + (entry.table ? ' · ' + tr('masa {n}', { n: entry.table }) : '')}</T>
          <Muted style={{ fontSize: 14 }}>{(entry.receipts.length === 1 ? tr('1 bon') : tr('{n} bonuri', { n: entry.receipts.length })) + ' · ' + tr('scanat de {x}/{y}', { x: entry.scanned_by, y: entry.people })}</Muted>
          <T style={{ fontFamily: F.display, fontSize: 26 }}>{lei(entry.total)}</T>
          <Note kind="ok">{tr('+{n} XP pentru tine (o dată pe intrare)', { n: xp || 25 })}</Note>
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: t.blueSoft }}>
            <T style={{ fontFamily: F.sb, fontSize: 14, lineHeight: 20, color: t.blueInk }}>{tr('Localul vede intrarea în CeFaci Business și plătește 10% din bon: {fee}.', { fee })}</T>
          </View>
        </View>
      ) : null,
      next: { label: tr('Începe din nou'), onPress: restart },
    },
    nobill: {
      title: tr('Fără bon'),
      caption: tr('Nimeni n-a scanat bonul până a doua zi la 12:00. La dubiu nu facturăm: localul o poate închide scriind totalul și făcând poză notei.'),
      body: (
        <View style={{ gap: 12 }}>
          {card}
          <View style={{ padding: 14, borderRadius: 18, backgroundColor: t.s2 }}>
            <T style={{ fontFamily: F.sb, fontSize: 14, lineHeight: 20 }}>{tr('Intrarea #{no} · fără bon · nu se plătește nimic.', { no: entry?.no ?? 12 })}</T>
          </View>
        </View>
      ),
      next: { label: tr('Începe din nou'), onPress: restart },
    },
  };
  const cur = STEPS[step];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profil'));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, height: ins.top + 52 }}>
        <Press onPress={back} accessibilityLabel={tr('Închide')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={t.ink} /></Press>
        <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15, color: t.ink2 }}>{tr('Simulează o seară')}</T>
        {step !== 'plan' ? <Quiet label={tr('De la capăt')} color={t.ink2} onPress={restart} /> : null}
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(ins.bottom, 12) + 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={i >= 0 ? tr('Pasul {n} din {all}', { n: i + 1, all: ORDER.length }) : undefined}>
            {ORDER.map((s, k) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i >= 0 ? (k <= i ? t.blue : t.s3) : t.s3 }} />)}
          </View>
          <T style={{ fontFamily: F.b, fontSize: 12, letterSpacing: 1.2, color: t.ink3 }}>{i >= 0 ? tr('PASUL {n} DIN {all}', { n: i + 1, all: ORDER.length }) : tr('ALTĂ CALE')}</T>
          <H1 style={{ fontSize: 28, lineHeight: 30 }}>{cur.title}</H1>
          <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: t.yellowSoft }}>
            <Icon name="info" size={18} color={t.yellowInk} />
            <T style={{ flex: 1, fontFamily: F.m, fontSize: 14, lineHeight: 20 }}>{cur.caption}</T>
          </View>
        </View>
        {cur.body}
        <Big label={cur.next.label} onPress={cur.next.onPress} />
        <Muted style={{ textAlign: 'center' }}>{tr('Date de probă: fără server, fără cont și fără bani reali.')}</Muted>
      </ScrollView>
      <BillPick open={billOpen} onClose={() => setBillOpen(false)} options={[{ label: tr('Simulează poza bonului'), primary: true, onPress: photo }]} />
      <PayTicket open={payOpen} token={'CEFACI-SIM-' + (entry?.no ?? 12) + '-AUB'} title={venue + (entry ? ' · ' + tr('Intrarea #{no} · {group}', { no: entry.no, group: groupName(entry) }) : '')} onClose={() => setPayOpen(false)} />
      <Sheet open={tableOpen} onClose={() => setTableOpen(false)}>
        <View style={{ gap: 12 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 24 }}>{tr('La ce masă stați?')}</T>
          <TablePick value={table} onChange={setTable} />
          <Big label={tr('Continuă')} disabled={!table?.trim()} onPress={() => { if (entry) sim.current.setTable(entry.id, table); setTableOpen(false); bump(); }} />
        </View>
      </Sheet>
      <TopShade />
    </View>
  );
}
