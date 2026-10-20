// Intrarea la un local partener, ca piese de ecran (docs/flux-intrare-bon.md): „Ai ajuns?”, codul de pe masă, „Ați
// ajuns! · La ce masă stați?”, cardul intrării cu bonurile și biletul la plată. Primesc doar date și funcții, așa că
// biletul adevărat (PartnerTicket) și „Simulează o seară” (app/simulare.tsx) arată exact aceleași lucruri.
import { useState, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { entryTime, groupName, type Entry } from '../../../shared/entries';
import { lei, meters } from '../lib/entry';
import { Bilu } from './Bilu';
import { Icon } from './Icon';
import { useModalInsets } from './insets';
import { Big, Field, Muted, Note, Press, Quiet, Sheet, T, H1 } from './kit';
import { F, useTheme } from './theme';
import { tr } from '../lib/i18n';

const SCAN = 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10';
const BON = 'M5 2v20l2-1.5L9 22l2-1.5L13 22l2-1.5L17 22l2-1.5V2l-2 1.5L15 2l-2 1.5L11 2 9 3.5 7 2 5 3.5ZM9 8h6M9 12h6M9 16h4';

/** Pasul 2: „Ai ajuns la Aubergine?” · Da, scanez codul / Încă nu. `dist` null = fără locație (la ora planului). */
export function ArrivePrompt({ name, dist, onYes, onLater }: { name: string; dist: number | null; onYes: () => void; onLater: () => void }) {
  const { t } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ padding: 14, gap: 12, borderRadius: 20, backgroundColor: t.yellowSoft, borderWidth: 1, borderColor: 'rgba(255,212,59,0.6)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Bilu size={40} mood="hi" shadow={false} still />
        <View style={{ flex: 1, gap: 2 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 17, lineHeight: 21 }}>{tr('Ai ajuns la {name}?', { name })}</T>
          <Muted>{dist !== null ? tr('Ești la {d} de {name}.', { d: meters(dist), name }) + ' ' + tr('Scanează codul CeFaci de pe masă sau de la bar.') : tr('Scanează codul CeFaci de pe masă sau de la bar.')}</Muted>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Big style={{ flex: 1.6 }} label={tr('Da, scanez codul')} icon={<Icon d={SCAN} color="#FFFFFF" />} onPress={onYes} />
        <Big style={{ flex: 1 }} label={tr('Încă nu')} color={t.s1} ink={t.ink} onPress={onLater} />
      </View>
    </View>
  );
}

/** Pasul 3: camera (sau, în simulare, ce o înlocuiește) + „Scrie codul de sub QR”. */
export function TableScan({ camera, onCode, onClose, busy, error }: { camera: ReactNode; onCode: (code: string) => void; onClose: () => void; busy?: boolean; error?: string }) {
  const [code, setCode] = useState('');
  const [focus, setFocus] = useState(false);
  const ok = code.trim().length >= 6;
  return (
    <View style={{ gap: 10 }}>
      <T accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 17 }}>{tr('Scanează codul de pe masă')}</T>
      <Muted>{tr('Codul CeFaci al localului e lipit pe masă sau la bar.')}</Muted>
      {camera}
      <T style={{ marginTop: 4, fontFamily: F.sb, fontSize: 14 }}>{tr('Nu merge camera? Scrie codul de sub QR')}</T>
      <Field accessibilityLabel={tr('Codul de sub QR')} value={code} onChangeText={(v) => setCode(v.replace(/\s/g, '').toUpperCase())} autoCapitalize="characters" autoCorrect={false}
        placeholder="ABC123" focused={focus} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onSubmitEditing={() => { if (ok && !busy) onCode(code.trim()); }} />
      {error ? <Note kind="err">{error}</Note> : null}
      <Big label={busy ? tr('Verific…') : tr('Confirmă codul')} disabled={!ok || busy} onPress={() => onCode(code.trim())} />
      <Quiet label={tr('Închide')} onPress={onClose} />
    </View>
  );
}

/** Masa, 1–40 sau „Scriu eu”. `value` e numărul ales (sau textul scris). */
export function TablePick({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useTheme();
  const [w, setW] = useState(0);
  const nums = Array.from({ length: 40 }, (_, i) => String(i + 1));
  const own = value !== null && !nums.includes(value);
  const [typing, setTyping] = useState(own);
  const cols = 8, gap = 6;
  const cell = w ? Math.floor((w - gap * (cols - 1)) / cols) : 36;
  return (
    <View style={{ gap: 8 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {nums.map((n) => {
          const on = value === n && !typing;
          return (
            <Press key={n} onPress={() => { setTyping(false); onChange(on ? null : n); }} accessibilityLabel={tr('Masa {n}', { n })} accessibilityState={{ selected: on }}
              style={{ width: cell, height: 38, borderRadius: 10, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontFamily: F.b, fontSize: 14, color: on ? t.bg : t.ink }}>{n}</T>
            </Press>
          );
        })}
      </View>
      <Press onPress={() => { setTyping(true); if (!own) onChange(null); }} accessibilityState={{ selected: typing }}
        style={{ alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: typing ? t.ink : t.line, backgroundColor: typing ? t.ink : t.s1, justifyContent: 'center' }}>
        <T style={{ fontFamily: F.sb, fontSize: 14, color: typing ? t.bg : t.ink }}>{tr('Scriu eu')}</T>
      </Press>
      {typing ? <Field autoFocus accessibilityLabel={tr('Masa')} placeholder={tr('de exemplu: terasă 3')} value={own ? value ?? '' : ''} maxLength={20} onChangeText={(v) => onChange(v.trim() ? v : null)} /> : null}
    </View>
  );
}

/** Pasul 3–4: „Ați ajuns! Intrarea #12 · Andrei + 4”, apoi masa (opțional) cu Continuă / Sari peste. */
export function Arrived({ entry, onSave, onSkip, busy }: { entry: Pick<Entry, 'no' | 'name' | 'people' | 'table'> | null; onSave: (table: string) => void; onSkip: () => void; busy?: boolean }) {
  const { t } = useTheme();
  const [table, setTable] = useState<string | null>(entry?.table ?? null);
  return (
    <View style={{ gap: 12 }}>
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: t.greenSoft }}>
        <Bilu size={44} mood="yay" shadow={false} still />
        <View style={{ flex: 1 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22, color: t.greenInk }}>{tr('Ați ajuns!')}</T>
          {entry ? <T style={{ fontFamily: F.b, fontSize: 15, color: t.greenInk }}>{tr('Intrarea #{no} · {group}', { no: entry.no, group: groupName(entry) })}</T> : null}
        </View>
      </View>
      <Muted style={{ fontSize: 14 }}>{tr('Păstrează bonul la final, îți aduce 25 XP.')}</Muted>
      <View style={{ gap: 2 }}>
        <T style={{ fontFamily: F.b, fontSize: 16 }}>{tr('La ce masă stați?')}</T>
        <Muted>{tr('Opțional: doar ajută ospătarul să vă găsească intrarea.')}</Muted>
      </View>
      <TablePick value={table} onChange={setTable} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Big style={{ flex: 1 }} label={tr('Sari peste')} color={t.s2} ink={t.ink} disabled={busy} onPress={onSkip} />
        <Big style={{ flex: 1 }} label={busy ? tr('Salvez…') : tr('Continuă')} disabled={!table?.trim() || busy} onPress={() => { if (table?.trim()) onSave(table.trim()); }} />
      </View>
    </View>
  );
}

/** „Bon scanat de 3/5 · 420,00 lei”, „Așteaptă bonul”, „Fără bon”. */
export function entryState(e: Entry) {
  if (e.state === 'no_bill') return tr('Fără bon · nu se plătește nimic');
  if (!e.receipts.length) return tr('Așteaptă bonul');
  return tr('Bon scanat de {x}/{y}', { x: e.scanned_by, y: e.people }) + ' · ' + lei(e.total);
}
const BY: Record<string, string> = { client: 'poză de la client', staff: 'de la ospătar', local: 'scris de local' };

/** Cardul intrării pe bilet: numărul, masa (se schimbă), starea, bonurile, Scanează bonul / Arată biletul la plată. */
export function EntryCard({ entry, onTable, onScanBill, onShowTicket, note, busy, highlight }: {
  entry: Entry; onTable?: () => void; onScanBill?: () => void; onShowTicket?: () => void;
  note?: { kind: 'ok' | 'err'; text: string } | null; busy?: boolean; highlight?: boolean;
}) {
  const { t } = useTheme();
  const done = entry.state === 'no_bill';
  return (
    <View style={{ padding: 14, gap: 12, borderRadius: 20, backgroundColor: t.s1, borderWidth: highlight ? 2 : 1, borderColor: highlight ? t.blue : t.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ minWidth: 58, height: 52, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontFamily: F.display, fontSize: 22, color: '#FFD43B' }}>{'#' + entry.no}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.b, fontSize: 16 }}>{tr('Intrarea #{no} · {group}', { no: entry.no, group: groupName(entry) })}</T>
          <Muted>{tr('{venue} · sosiți la {t}', { venue: entry.venue_name, t: entryTime(entry.arrived_at) })}</Muted>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingLeft: 12, paddingRight: 4, borderRadius: 14, backgroundColor: t.s2 }}>
        <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>{entry.table ? tr('Masa {n}', { n: entry.table }) : tr('Masa: nespusă')}</T>
        {onTable && !done ? <Quiet label={entry.table ? tr('Schimbă') : tr('Spune masa')} onPress={onTable} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: done ? t.ink3 : entry.receipts.length ? '#1EA05A' : '#FFB020' }} />
        <T accessibilityLiveRegion="polite" style={{ flex: 1, fontFamily: F.b, fontSize: 15 }}>{entryState(entry)}</T>
      </View>
      {entry.receipts.length ? (
        <View style={{ gap: 6 }}>
          {entry.receipts.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: t.line }}>
              <Icon d={BON} size={18} color={t.ink2} />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.sb, fontSize: 14, textDecorationLine: r.disputed ? 'line-through' : 'none' }}>{entryTime(r.at) + ' · ' + lei(r.total)}</T>
                <Muted style={{ fontSize: 12 }}>{tr(BY[r.by] ?? BY.client) + (r.scanners > 1 ? tr(' · scanat de {n} din gașcă', { n: r.scanners }) : '') + (r.disputed ? tr(' · contestat, în verificare') : '')}</Muted>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {note ? <Note kind={note.kind}>{note.text}</Note> : null}
      {!done ? (
        <View style={{ gap: 8 }}>
          {onScanBill ? <Big label={busy ? tr('Citesc…') : entry.receipts.length ? tr('Scanează încă un bon') : tr('Scanează bonul')} disabled={busy} icon={<Icon d={BON} color={busy ? t.ink2 : '#FFFFFF'} />} onPress={onScanBill} /> : null}
          {onShowTicket ? <Big label={tr('Arată biletul la plată')} color={t.s2} ink={t.ink} icon={<Icon name="ticket" color={t.ink} />} onPress={onShowTicket} /> : null}
          {entry.receipts.length ? <Muted>{tr('Note separate? Fiecare bon se adună la aceeași intrare.')}</Muted> : null}
        </View>
      ) : null}
    </View>
  );
}

/** „Poza bonului”: în aplicație camera / galeria, în simulare butonul care le înlocuiește. */
export function BillPick({ open, onClose, options }: { open: boolean; onClose: () => void; options: { label: string; onPress: () => void; primary?: boolean }[] }) {
  const { t } = useTheme();
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 10 }}>
        <H1 style={{ fontSize: 26 }}>{tr('Poza bonului')}</H1>
        <Muted style={{ fontSize: 15, lineHeight: 21 }}>{tr('Citim firma, data, ora, numărul bonului și totalul. Același bon se numără o singură dată, oricâți din gașcă l-ar scana.')}</Muted>
        {options.map((o) => <Big key={o.label} label={o.label} color={o.primary ? t.blue : t.s2} ink={o.primary ? '#FFFFFF' : t.ink} onPress={o.onPress} />)}
      </View>
    </Sheet>
  );
}

/** Pasul 8: biletul gășcii mare, pe tot ecranul, pentru ospătar. */
export function PayTicket({ open, token, title, onClose }: { open: boolean; token: string | null; title: string; onClose: () => void }) {
  const { t } = useTheme();
  const ins = useModalInsets();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#FFD43B' }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 8, paddingBottom: Math.max(ins.bottom, 12) + 20, paddingHorizontal: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
            <Press onPress={onClose} accessibilityLabel={tr('Închide')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color="#0E1440" /></Press>
          </View>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, color: '#0E1440' }}>{tr('Biletul la plată')}</T>
          <T style={{ fontFamily: F.sb, fontSize: 16, color: '#0E1440' }}>{title}</T>
          <View style={{ alignSelf: 'center', marginTop: 8, padding: 18, borderRadius: 24, backgroundColor: '#FFFFFF' }}>
            {token ? <QRCode value={token} size={250} /> : <View style={{ width: 250, height: 250, alignItems: 'center', justifyContent: 'center' }}><Muted>{tr('Se încarcă biletul…')}</Muted></View>}
          </View>
          <T style={{ textAlign: 'center', fontFamily: F.b, fontSize: 17, lineHeight: 23, color: '#0E1440' }}>{tr('Ospătarul scanează codul și face poză notei.')}</T>
          <T style={{ textAlign: 'center', fontFamily: F.m, fontSize: 14, lineHeight: 20, color: '#3A4270' }}>{tr('Bonul ajunge la aceeași intrare, chiar dacă l-a scanat deja cineva din gașcă.')}</T>
          <View style={{ flex: 1 }} />
          <Big label={tr('Gata')} color="#0E1440" ink="#FFD43B" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
