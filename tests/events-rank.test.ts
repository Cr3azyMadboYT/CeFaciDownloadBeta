// Evenimente (22.10): what a person sees and in which order; the seller list is the same in the app and on the server.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { forPerson, priceText, searchEvents, sellerOf, SELLERS, visible, type CfEvent } from '../src/events/events';

const now = new Date('2026-10-23T18:00:00+03:00');
const at = (days: number, h = 21) => new Date(now.getTime() + days * 86400e3 + (h - 18) * 3600e3).toISOString();
const E = (id: string, over: Partial<CfEvent> = {}): CfEvent => ({ id, title: id, kind: 'concert', starts_at: at(1), ends_at: null, venue_id: null, place_name: 'Arenele Romane', address: null, lat: 44.41, lon: 26.1, price_from: 80, price_to: null, ticket_url: 'https://www.iabilet.ro/x', seller: 'iaBilet', min_age: null, about: null, about_en: null, status: 'published', ...over });
const who = { origin: { lat: 44.43, lon: 26.1 }, likes: [] as string[], minor: false, now };

describe('evenimente', () => {
  it('hides what is over, cancelled, too far ahead, or 18+ for a minor', () => {
    const list = [E('ok'), E('over', { starts_at: at(-1) }), E('cancelled', { status: 'cancelled' }), E('later', { starts_at: at(45) }), E('adults', { min_age: 18 })];
    expect(visible(list, who).map((e) => e.id)).toEqual(['ok', 'adults']);
    expect(visible(list, { ...who, minor: true }).map((e) => e.id)).toEqual(['ok']);
    expect(visible([E('tonight', { starts_at: at(0, 17) })], who).map((e) => e.id)).toEqual(['tonight']); // started an hour ago
  });
  it('soon and close first, the person\'s likes up, sold out last', () => {
    const list = [E('far', { starts_at: at(12) }), E('soon'), E('sold', { status: 'sold_out' }), E('show', { kind: 'standup', starts_at: at(4) })];
    expect(forPerson(list, who)[0].id).toBe('soon');
    expect(forPerson(list, who).at(-1)!.id).toBe('sold');
    expect(forPerson(list, { ...who, likes: ['standup'] })[0].id).toBe('show');
  });
  it('search: kind words, title and place', () => {
    const list = [E('Subcarpați live'), E('Stand-up cu Micutzu', { kind: 'standup', place_name: 'Club Control' })];
    expect(searchEvents(list, 'concert', who).map((e) => e.id)).toEqual(['Subcarpați live']);
    expect(searchEvents(list, 'comedie control', who).map((e) => e.id)).toEqual(['Stand-up cu Micutzu']);
    expect(searchEvents(list, 'subcarpati', who)).toHaveLength(1);
    expect(searchEvents(list, 'sushi', who)).toEqual([]);
  });
  it('only https links of official sellers', () => {
    expect(sellerOf('https://www.iabilet.ro/bilete-x')).toBe('iaBilet');
    expect(sellerOf('https://bilete.eventbook.ro/x')).toBe('Eventbook');
    for (const bad of ['http://www.iabilet.ro/x', 'https://iabilet.ro.evil.com/x', 'https://iabilet.ro@evil.com/x', 'https://fake-iabilet.ro', 'javascript:alert(1)', '', null])
      expect(sellerOf(bad as string), String(bad)).toBeNull();
  });
  it('the app knows the same sellers as the server', () => {
    const sql = fs.readFileSync('supabase/migrations/20261022020000_cefaci_evenimente.sql', 'utf8');
    const server = Object.fromEntries([...sql.matchAll(/\('([a-z0-9.-]+\.[a-z]+)','([^']+)'\)/g)].map((m) => [m[1], m[2]]));
    expect(server).toEqual(SELLERS);
  });
  it('the price says what is known', () => {
    const t = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k]));
    expect(priceText(E('a'), t)).toBe('de la 80 lei');
    expect(priceText(E('b', { price_to: 150 }), t)).toBe('80–150 lei');
    expect(priceText(E('c', { price_from: 0 }), t)).toBe('Intrare liberă');
    expect(priceText(E('d', { price_from: null }), t)).toBeNull();
  });
});
