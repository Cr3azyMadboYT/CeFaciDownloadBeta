// Bilete, faza 3 (22.10): tickets sold by a partner venue in CeFaci. For now only test payments (no money): the
// server says `test` on every order until the SRL and the contract (docs/evenimente.md). The QR is made here, without
// internet, and changes every 30 seconds (src/events/tickets.ts); the door checks it on the server.
import { useEffect, useState, useSyncExternalStore } from 'react';
import * as Crypto from 'expo-crypto';
import { sb } from '../../lib/auth';
import { getApp } from '../../lib/session';
import { ticketWindow, type MyTicket, type TicketType } from '../../../../src/events/tickets';
import { EVENTS_ON } from './flag';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => sb() as any;
const KEY = 'cefaci.tickets';

export interface Order { order: string; tickets: number; subtotal: number; fee: number; total: number; plus: boolean; test: boolean; expires_at: string }

export async function ticketTypes(event: string): Promise<TicketType[]> {
  const { data } = await db().from('ticket_types').select('id,event_id,name,price,qty,sold,max_per_order,on_sale,sort').eq('event_id', event).order('sort');
  return ((data ?? []) as TicketType[]).map((t) => ({ ...t, price: Number(t.price) }));
}

const fail = (e: { message?: string } | null) => (e ? e.message || 'Nu a mers. Încearcă din nou.' : null);

export async function startOrder(event: string, items: { type: string; qty: number }[]): Promise<Order | string> {
  const { data, error } = await db().rpc('ticket_order_start', { p_event: event, p_items: items });
  return fail(error) ?? (data as Order);
}
export async function cancelOrder(order: string) { await db().rpc('ticket_order_cancel', { p_order: order }); }
export async function testPay(order: string): Promise<string | null> {
  const { error } = await db().rpc('ticket_order_test_pay', { p_order: order });
  if (!error) void refreshTickets();
  return fail(error);
}
export async function giveTicket(ticket: string, friend: string): Promise<string | null> {
  const { error } = await db().rpc('ticket_transfer', { p_ticket: ticket, p_friend: friend });
  if (!error) void refreshTickets();
  return fail(error);
}

// „Biletele mele”, kept on the phone so the QR opens at the door without internet
// (saved with the account's id: another account on the same phone never sees them)
let mem: { who: string; list: MyTicket[] } | null = null;
const subs = new Set<() => void>();
const EMPTY: MyTicket[] = [];
function load(): MyTicket[] {
  const who = getApp().who?.id ?? '';
  if (!mem || mem.who !== who) {
    try { const v = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null'); mem = v && v.who === who && Array.isArray(v.list) ? v : { who, list: [] }; }
    catch { mem = { who, list: [] }; }
  }
  return who ? mem!.list : EMPTY;
}
export async function refreshTickets(): Promise<void> {
  if (!EVENTS_ON) return;
  const { data, error } = await db().rpc('my_tickets');
  if (error || !Array.isArray(data)) return; // offline: the saved tickets stay
  mem = { who: getApp().who?.id ?? '', list: data as MyTicket[] };
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked */ }
  subs.forEach((f) => f());
}
export function useMyTickets(): MyTicket[] {
  useEffect(() => { void refreshTickets(); }, []);
  const snap = () => (EVENTS_ON ? load() : EMPTY);
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, snap, snap);
}

/** The QR text for now; a new one every 30 seconds. */
export function useTicketQr(id: string, secret: string | null): string | null {
  const [w, setW] = useState(ticketWindow());
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setW(ticketWindow()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!secret) { setQr(null); return; }
    let live = true;
    void Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secret + '.' + w).then((h) => {
      if (live) setQr('CFB1.' + id + '.' + w + '.' + h.slice(0, 10));
    });
    return () => { live = false; };
  }, [id, secret, w]);
  return qr;
}
