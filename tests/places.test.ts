// The places from Supabase over the copy in the app (src/app/places.ts): a change from Admin wins, a hidden or gone
// place leaves, a new one comes in, a broken row does not break the app.
import { describe, expect, it } from 'vitest';
import venues from '../src/data/venues.json';
import { addRows, mergePlaces, type PlaceRow } from '../src/app/places';
import type { Venue } from '../src/engine/types';

const base = venues as Venue[];
const v0 = base[0], v1 = base[1];
const row = (p: Partial<PlaceRow> & { id: string }): PlaceRow => ({ data: {}, edit: {}, status: 'on', updated_at: '2026-10-06T10:00:00Z', ...p });

describe('locurile din Supabase', () => {
  it('o corectură din Admin trece peste copia din aplicație', () => {
    const out = mergePlaces(base, [row({ id: v0.id, data: v0, edit: { story: 'Poveste nouă.', hours: 'Mo-Su 10:00-22:00' } })]);
    const v = out.find((x) => x.id === v0.id)!;
    expect(v.story).toBe('Poveste nouă.');
    expect(v.name).toBe(v0.name);
    expect(out.length).toBe(base.length);
  });
  it('un loc ascuns sau dispărut iese, unul nou intră', () => {
    const out = mergePlaces(base, [
      row({ id: v1.id, status: 'hidden' }),
      row({ id: 'a-123', data: { name: 'Calul Bălan', k: 'promenade', lat: 44.5657, lon: 25.9261, story: 'Pe malul lacului.' } }),
    ]);
    expect(out.some((x) => x.id === v1.id)).toBe(false);
    const n = out.find((x) => x.id === 'a-123')!;
    expect(n.cat).toBe('natura');
    expect(n.cuisines).toEqual([]);
  });
  it('un rând stricat (fel necunoscut, fără poziție) lasă locul cum era', () => {
    const out = mergePlaces(base, [row({ id: v0.id, data: { ...v0 }, edit: { k: 'nu-exista' } }), row({ id: 'a-x', data: { name: 'Fără poziție', k: 'bar' } })]);
    expect(out.find((x) => x.id === v0.id)!.k).toBe(v0.k);
    expect(out.some((x) => x.id === 'a-x')).toBe(false);
  });
  it('rândurile păstrate pe telefon: cel mai nou câștigă, iar data merge înainte', () => {
    let c = addRows({ at: '2026-10-05T00:00:00Z', rows: {} }, [row({ id: 'x', updated_at: '2026-10-06T10:00:00Z', edit: { story: 'a' } })]);
    c = addRows(c, [row({ id: 'x', updated_at: '2026-10-06T09:00:00Z', edit: { story: 'vechi' } })]);
    expect(c.rows.x.edit?.story).toBe('a');
    expect(c.at).toBe('2026-10-06T10:00:00Z');
  });
});
