// The plan as a real ticket (decision Cornel, 05.10: "de parcă chiar e bilet, cu un watermark CeFaci pe el"): a
// yellow ticket with "CeFaci" printed faintly all over it, the place in big letters, the fields of a concert ticket
// (day, hour, how many get in, cost, how long), the perforation with its two notches, and the stub with a barcode,
// the ticket's number and Bilu's stamp. Everything on it is the plan's own data.
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { T } from './kit';
import { F } from './theme';

const INK = '#0E1440';
const INK2 = '#3A4270';
const PAPER = '#FFD43B';

export interface TicketData {
  pid: number | string;
  place: string;       // "Shoteria"
  kind: string;        // "Bar"
  area: string;        // "Centrul Vechi"
  day: string;         // "Azi, 5 oct."
  hour: string;        // "20:00" or "acum"
  people: number;
  cost: string;        // "~70 lei" / "Gratuit"
  last: { label: string; value: string; dot?: string }; // Durată / Rezervare
}

/** A number on the ticket, the same each time for the same plan. */
const serial = (pid: number | string) => 'CF-' + String(pid).replace(/\D/g, '').slice(-6).padStart(6, '0');

/** Bars of a barcode drawn from the ticket's number (it is not meant to be scanned). */
function bars(seed: string): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out: number[] = [];
  for (let i = 0; i < 46; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177); out.push(1 + (Math.abs(h) % 3)); }
  return out;
}

function Field({ label, value, dot, wide }: { label: string; value: string; dot?: string; wide?: boolean }) {
  return (
    <View style={{ flex: wide ? 1.4 : 1, gap: 3 }}>
      <T style={{ fontFamily: F.b, fontSize: 10.5, letterSpacing: 1.4, color: INK2 }}>{label.toUpperCase()}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {dot ? <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: dot }} /> : null}
        <T numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontFamily: F.display, fontSize: 18, lineHeight: 21, color: INK }}>{value}</T>
      </View>
    </View>
  );
}

/** "CeFaci" printed all over the paper, faint and slanted, like the watermark of a real ticket. */
function Watermark() {
  const rows = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: -80, right: -80, top: -60, bottom: -60, transform: [{ rotate: '-14deg' }], justifyContent: 'space-around' }}>
        {rows.map((i) => (
          <T key={i} numberOfLines={1} style={{ marginLeft: i % 2 ? -36 : 0, fontFamily: F.display, fontSize: 22, letterSpacing: 1, color: 'rgba(14,20,64,0.055)' }}>
            {'CeFaci   CeFaci   CeFaci   CeFaci   CeFaci   CeFaci'}
          </T>
        ))}
      </View>
    </View>
  );
}

/** The row of small bites at the paper's top or bottom edge (a ticket torn from a roll). */
function Bites({ bg, at }: { bg: string; at: 'top' | 'bottom' }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, [at]: -5, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Array.from({ length: 16 }, (_, i) => <View key={i} style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: bg }} />)}
    </View>
  );
}

/** Bilu's rubber stamp on the stub. */
function Stamp({ children }: { children: ReactNode }) {
  return (
    <View style={{ width: 78, height: 78, borderRadius: 99, borderWidth: 2.5, borderColor: 'rgba(217,58,28,0.75)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-16deg' }] }}>
      <View style={{ position: 'absolute', left: 5, right: 5, top: 5, bottom: 5, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(217,58,28,0.6)' }} />
      {children}
    </View>
  );
}

export function Ticket({ d, bg }: { d: TicketData; bg: string }) {
  const no = serial(d.pid);
  const code = useMemo(() => bars(no), [no]);
  return (
    <View style={{ marginHorizontal: 20 }} accessible accessibilityLabel={'Bilet: ' + d.place + ', ' + d.day + ', ' + d.hour + ', ' + d.people + (d.people === 1 ? ' persoană' : ' persoane')}>
      <View style={{ borderRadius: 18, backgroundColor: PAPER, overflow: 'hidden' }}>
        <Watermark />
        <View style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T style={{ fontFamily: F.display, fontSize: 19, letterSpacing: -0.4, color: INK }}>CeFaci</T>
            <View style={{ width: 4, height: 4, borderRadius: 99, backgroundColor: INK, marginHorizontal: 8 }} />
            <T style={{ flex: 1, fontFamily: F.b, fontSize: 10.5, letterSpacing: 1.6, color: INK2 }}>BILET DE IEȘIT</T>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1.5, borderColor: INK }}>
              <T style={{ fontFamily: F.b, fontSize: 11, letterSpacing: 1, color: INK }}>{'INTRARE ' + d.people}</T>
            </View>
          </View>
          <T numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 16, fontFamily: F.display, fontSize: 40, lineHeight: 41, letterSpacing: -1.4, color: INK }}>{d.place}</T>
          <T numberOfLines={1} style={{ marginTop: 4, fontFamily: F.sb, fontSize: 14, color: INK2 }}>{d.kind + ' · ' + d.area}</T>
          <View style={{ marginTop: 18, flexDirection: 'row', gap: 10 }}>
            <Field label="Ziua" value={d.day} wide />
            <Field label="Ora" value={d.hour} />
            <Field label="Intrare" value={d.people === 1 ? '1 pers.' : d.people + ' pers.'} />
          </View>
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <Field label="De persoană" value={d.cost} wide />
            <Field label={d.last.label} value={d.last.value} dot={d.last.dot} />
          </View>
        </View>
        {/* the perforation, with the two notches */}
        <View style={{ height: 22 }}>
          <View style={{ position: 'absolute', left: -11, top: 0, width: 22, height: 22, borderRadius: 99, backgroundColor: bg }} />
          <View style={{ position: 'absolute', right: -11, top: 0, width: 22, height: 22, borderRadius: 99, backgroundColor: bg }} />
          <View style={{ position: 'absolute', left: 18, right: 18, top: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: 24 }, (_, i) => <View key={i} style={{ width: 6, height: 2, borderRadius: 1, backgroundColor: 'rgba(14,20,64,0.35)' }} />)}
          </View>
        </View>
        {/* the stub: barcode, number, Bilu's stamp */}
        <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <View style={{ height: 44, flexDirection: 'row', alignItems: 'stretch', gap: 2 }}>
              {code.map((w, i) => <View key={i} style={{ width: w + (i % 7 === 0 ? 1 : 0), backgroundColor: i % 5 === 3 ? 'transparent' : INK }} />)}
            </View>
            <T style={{ marginTop: 6, fontFamily: F.b, fontSize: 11, letterSpacing: 2.2, color: INK2 }}>{no + '  ·  ' + d.hour.toUpperCase()}</T>
          </View>
          <Stamp>
            <T style={{ fontFamily: F.b, fontSize: 9, letterSpacing: 1, color: 'rgba(217,58,28,0.9)' }}>BILU</T>
            <T style={{ fontFamily: F.display, fontSize: 13, color: 'rgba(217,58,28,0.9)' }}>aprobă</T>
            <T style={{ fontFamily: F.b, fontSize: 7.5, letterSpacing: 0.4, color: 'rgba(217,58,28,0.9)' }}>✓ VERIFICAT</T>
          </Stamp>
        </View>
        <Bites bg={bg} at="bottom" />
      </View>
    </View>
  );
}
