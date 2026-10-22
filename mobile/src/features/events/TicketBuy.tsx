// Bilete, faza 3 (22.10): buying a ticket sold by the partner venue, on the event's screen. The person sees, before
// paying, the tickets, the 2 lei service fee per ticket (0 with Plus) and who sells (the venue). For now every order
// is a test: „Plată de test”, no card, no money (docs/evenimente.md). The tickets are held 15 minutes.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../lib/session';
import { tr, trServer } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { Big, Muted, Note, Press, Quiet, Sheet, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { ticketMoney, TICKET_FEE, type TicketType } from '../../../../src/events/tickets';
import type { CfEvent } from '../../../../src/events/events';
import { cancelOrder, startOrder, testPay, ticketTypes, type Order } from './tickets';

const lei = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',') + ' lei';

export function TicketBuy({ e, blocked }: { e: CfEvent; blocked: boolean }) {
  const { t } = useTheme();
  const plus = useApp((s) => s.board.plus === 'trial' || s.board.plus === 'active');
  const [types, setTypes] = useState<TicketType[] | null>(null);
  const [n, setN] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [done, setDone] = useState(false);
  const paid = useRef(false);
  const load = () => { void ticketTypes(e.id).then(setTypes); };
  useEffect(load, [e.id]);

  const count = Object.values(n).reduce((a, b) => a + b, 0);
  const sub = (types ?? []).reduce((a, ty) => a + (n[ty.id] ?? 0) * ty.price, 0);
  const money = ticketMoney(sub, count, plus);
  const add = (ty: TicketType, d: number) => {
    setErr('');
    const left = ty.qty - ty.sold;
    setN((x) => ({ ...x, [ty.id]: Math.max(0, Math.min((x[ty.id] ?? 0) + d, ty.max_per_order, left, 10 - count + (x[ty.id] ?? 0))) }));
  };
  const buy = async () => {
    setBusy(true); setErr('');
    const r = await startOrder(e.id, Object.entries(n).filter(([, q]) => q > 0).map(([type, qty]) => ({ type, qty })));
    setBusy(false);
    if (typeof r === 'string') { setErr(trServer(r)); load(); return; }
    paid.current = false; setOrder(r);
  };
  const pay = async () => {
    if (!order) return;
    setBusy(true); setErr('');
    const m = await testPay(order.order);
    setBusy(false);
    if (m) { setErr(trServer(m)); return; }
    paid.current = true; setOrder(null); setN({}); setDone(true); load();
  };
  const close = () => {
    if (order && !paid.current) void cancelOrder(order.order).then(load);
    setOrder(null);
  };

  if (!types) return null;
  const onSale = types.filter((ty) => ty.on_sale);
  if (!onSale.length) return <View style={{ marginTop: 20 }}><Note kind="err">{tr('Biletele nu sunt de vânzare acum.')}</Note></View>;
  return (
    <View style={{ marginTop: 20, gap: 10 }}>
      <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>{tr('Bilete')}</T>
      {onSale.map((ty) => {
        const left = ty.qty - ty.sold;
        const q = n[ty.id] ?? 0;
        return (
          <View key={ty.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: q ? t.blue : t.line }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontFamily: F.b, fontSize: 16 }}>{ty.name}</T>
              <Muted>{left <= 0 ? tr('Sold out') : lei(ty.price) + (left <= 20 ? ' · ' + tr('mai sunt {n}', { n: left }) : '')}</Muted>
            </View>
            {left > 0 && !blocked ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Step label="−" a11y={tr('Mai puțin')} off={!q} onPress={() => add(ty, -1)} />
                <T style={{ fontFamily: F.b, fontSize: 17, minWidth: 22, textAlign: 'center' }}>{q}</T>
                <Step label="+" a11y={tr('Mai mult')} off={q >= Math.min(ty.max_per_order, left) || count >= 10} onPress={() => add(ty, 1)} />
              </View>
            ) : null}
          </View>
        );
      })}
      {blocked ? <Note kind="err">{tr('Evenimentul e de la 18 ani.')}</Note> : null}
      {count ? (
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, gap: 6 }}>
          <Line l={tr('Bilete ({n})', { n: count })} r={lei(sub)} />
          <Line l={tr('Taxa de serviciu CeFaci')} r={plus ? tr('0 lei cu Plus') : lei(money.fee)} />
          {!plus ? <Muted>{tr('{fee} lei pe bilet. Cu Plus nu plătești taxa.', { fee: TICKET_FEE })}</Muted> : null}
          <View style={{ height: 1, backgroundColor: t.line, marginVertical: 2 }} />
          <Line l={tr('Total')} r={lei(money.total)} bold />
        </View>
      ) : null}
      <View style={{ padding: 14, borderRadius: 16, backgroundColor: t.s2, gap: 4 }}>
        <T style={{ fontFamily: F.b, fontSize: 14 }}>{tr('Cum plătești')}</T>
        <Muted>{tr('Biletele le vinde {place}, prin CeFaci. Plătești cu cardul prin Netopia; CeFaci nu vede datele cardului. Dacă evenimentul se anulează, banii se întorc singuri pe card.', { place: e.place_name })}</Muted>
      </View>
      {err ? <Note kind="err">{err}</Note> : null}
      {done ? <Note kind="ok">{tr('Gata! Biletele sunt în „Biletele mele”.')}</Note> : null}
      {done ? <Big label={tr('Biletele mele')} icon={<Icon name="ticket" color="#FFFFFF" />} onPress={() => router.push('/bilete')} /> : null}
      {!blocked && count ? <Big label={busy ? tr('Rezerv…') : tr('Cumpără · {total}', { total: lei(money.total) })} disabled={busy} icon={<Icon name="ticket" color="#FFFFFF" />} onPress={() => void buy()} /> : null}

      <Sheet open={!!order} onClose={close}>
        {order ? (
          <View style={{ gap: 12 }}>
            <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 24 }}>{tr('Plătește biletele')}</T>
            <Muted>{tr('Le țin pentru tine 15 minute.')}</Muted>
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: t.s1, gap: 6 }}>
              <Line l={tr('Bilete ({n})', { n: order.tickets })} r={lei(order.subtotal)} />
              <Line l={tr('Taxa de serviciu CeFaci')} r={order.plus ? tr('0 lei cu Plus') : lei(order.fee)} />
              <Line l={tr('Total')} r={lei(order.total)} bold />
            </View>
            {order.test ? <Note kind="err">{tr('Plăți de test: nu se ia niciun ban de pe card. Biletele de test sunt doar pentru încercări.')}</Note> : null}
            {err ? <Note kind="err">{err}</Note> : null}
            {order.test
              ? <Big label={busy ? tr('Plătesc…') : tr('Plată de test · {total}', { total: lei(order.total) })} disabled={busy} onPress={() => void pay()} />
              : <Note kind="err">{tr('Plata cu cardul pornește în curând.')}</Note>}
            <Quiet label={tr('Renunț')} onPress={close} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Step({ label, a11y, off, onPress }: { label: string; a11y: string; off?: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} disabled={off} accessibilityLabel={a11y}
      style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: off ? t.s2 : t.blue, opacity: off ? 0.5 : 1 }}>
      <T style={{ fontFamily: F.b, fontSize: 20, color: off ? t.ink3 : '#FFFFFF' }}>{label}</T>
    </Press>
  );
}
function Line({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <T style={{ fontFamily: bold ? F.b : F.m, fontSize: bold ? 16 : 14 }}>{l}</T>
      <T style={{ fontFamily: F.b, fontSize: bold ? 16 : 14 }}>{r}</T>
    </View>
  );
}
