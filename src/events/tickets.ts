// Bilete, faza 3 (22.10): the money rule and the QR of a ticket bought in CeFaci, without React (tests/tickets.test.ts).
// The QR changes every 30 seconds and is made on the phone without internet: CFB1.<ticket>.<window>.<10 hex>, the hex
// from sha256(secret + "." + window). The server (biz_ticket_scan) makes the same and lets each ticket in once.

/** CeFaci's share of the ticket price (everything included: the card payment is paid by us from it). */
export const TICKET_COMMISSION = 0.08;
/** The buyer's service fee per ticket; 0 with Plus. */
export const TICKET_FEE = 2;

export const QR_WINDOW_S = 30;
export const ticketWindow = (now = Date.now()) => Math.floor(now / 1000 / QR_WINDOW_S);
export const ticketCode = (secret: string, w: number, sha256hex: (s: string) => string) => sha256hex(secret + '.' + w).slice(0, 10);
export const ticketQr = (id: string, secret: string, w: number, sha256hex: (s: string) => string) => 'CFB1.' + id + '.' + w + '.' + ticketCode(secret, w, sha256hex);

/** What the buyer pays and what the club gets, for the screens (the server decides the real numbers). */
export function ticketMoney(subtotal: number, tickets: number, plus: boolean) {
  const fee = plus ? 0 : TICKET_FEE * tickets;
  const commission = Math.round(subtotal * TICKET_COMMISSION * 100) / 100;
  return { fee, total: subtotal + fee, commission, club: Math.round((subtotal - commission) * 100) / 100 };
}

export interface MyTicket {
  id: string; status: 'valid' | 'folosit' | 'rambursat'; test: boolean; type: string; price: number; transfers: number; used_at: string | null;
  secret: string | null;
  event: { id: string; title: string; kind: string; starts_at: string; ends_at: string | null; place_name: string; address: string | null; lat: number; lon: number; status: string; min_age: number | null };
}
export interface TicketType { id: string; event_id: string; name: string; price: number; qty: number; sold: number; max_per_order: number; on_sale: boolean; sort: number }
