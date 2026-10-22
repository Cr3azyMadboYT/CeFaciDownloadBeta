// "Amestecă" (22.10): another order, the same places, the first ones still among the best for the person.
import { describe, expect, it } from 'vitest';
import { mix } from '../mobile/src/lib/shuffle';

const list = Array.from({ length: 60 }, (_, i) => ({ id: 'p' + i }));
const ids = (l: { id: string }[]) => l.map((x) => x.id);

describe('amestecă', () => {
  it('seed 0 is the ranked list', () => expect(mix(list, 0)).toBe(list));
  it('keeps every place, once', () => {
    for (const seed of [1, 7, 42, 1234]) expect(ids(mix(list, seed)).sort()).toEqual(ids(list).sort());
  });
  it('the same seed gives the same order', () => expect(ids(mix(list, 9))).toEqual(ids(mix(list, 9))));
  it('the first 8 come from the 24 that fit best', () => {
    for (let seed = 1; seed < 200; seed++) for (const x of mix(list, seed).slice(0, 8)) expect(Number(x.id.slice(1))).toBeLessThan(24);
  });
  it('a mix shows mostly new places on top', () => {
    let fresh = 0;
    for (let seed = 1; seed < 100; seed++) {
      const before = ids(mix(list, seed).slice(0, 8));
      fresh += mix(list, seed + 1, before).slice(0, 8).filter((x) => !before.includes(x.id)).length;
    }
    expect(fresh / 99).toBeGreaterThan(4.5);
  });
  it('nothing good sinks to the bottom', () => {
    for (let seed = 1; seed < 100; seed++) {
      const out = ids(mix(list, seed));
      for (let i = 0; i < 30; i++) expect(out.indexOf('p' + i)).toBeLessThan(40);
    }
  });
});
