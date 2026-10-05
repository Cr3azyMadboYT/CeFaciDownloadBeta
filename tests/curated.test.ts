// Only good places (decision Cornel, 05.10: "degeaba avem 3000 dacă doar 200 sunt bune"): the app shows the places the
// research kept (src/data/curated.json, scripts/curate.mjs) — open now, worth going to, with their story — plus the
// places where people gather; parks only where people really go.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import venues from '../src/data/venues.json';
import { KINDS } from '../src/engine/catalog';
import { ZONES } from '../src/engine/catalog';
import { km } from '../src/engine/core';
import type { Venue } from '../src/engine/types';

const all = venues as Venue[];
const cur = (fs.existsSync('src/data/curated.json') ? JSON.parse(fs.readFileSync('src/data/curated.json', 'utf8')) : null) as null | { keep: Record<string, { story?: string }>; add: { id: string; k: string; lat: number; lon: number; story?: string }[]; drop: Record<string, string> };

describe.skipIf(!cur)('localurile alese', () => {
  it('în aplicație sunt doar locurile alese, fiecare cu felul lui cunoscut', () => {
    for (const v of all) {
      expect(v.pick, v.name).toBe(true);
      expect(KINDS[v.k], v.name + ' ' + v.k).toBeTruthy();
      expect(KINDS[v.k].cat, v.name).toBe(v.cat);
    }
  });
  it('aproape toate au povestea lor, iar parcurile sunt cele în care chiar merge lumea', () => {
    const withStory = all.filter((v) => v.story && v.story.length > 30).length;
    expect(withStory / all.length).toBeGreaterThan(0.8);
    const parks = all.filter((v) => v.cat === 'natura');
    expect(parks.length).toBeGreaterThan(10);
    for (const p of parks) expect(p.story, p.name).toBeTruthy();
  });
  it('locurile adăugate de mână sunt în București sau Ilfov, cu poziție și poveste', () => {
    for (const a of cur!.add) {
      const near = Math.min(...ZONES.map((z) => km(a, z)));
      expect(near, a.id).toBeLessThan(25);
      expect(a.story, a.id).toBeTruthy();
    }
  });
  it('locurile unde se strânge lumea sunt în aplicație (de pildă în Buftea și Piața Constituției)', () => {
    const gather = all.filter((v) => v.k === 'square' || v.k === 'promenade' || v.k === 'food_market');
    expect(gather.length).toBeGreaterThanOrEqual(5);
    for (const re of [/Piața Constituției/, /Calul Bălan/, /Centrul Vechi/, /Calea Victoriei/]) expect(all.some((v) => re.test(v.name)), String(re)).toBe(true);
    const buftea = all.filter((v) => km(v, { lat: 44.566, lon: 25.94 }) < 3);
    expect(buftea.length).toBeGreaterThanOrEqual(3);
  });
  it('felurile din import (scripts/import-osm.mjs KIND_CAT) sunt ca în motor', () => {
    const src = fs.readFileSync('scripts/import-osm.mjs', 'utf8');
    const block = src.slice(src.indexOf('export const KIND_CAT'), src.indexOf('};', src.indexOf('export const KIND_CAT')));
    for (const [, k, cat] of block.matchAll(/(\w+): \['(\w+)'/g)) {
      expect(KINDS[k], k).toBeTruthy();
      expect(KINDS[k].cat, k).toBe(cat);
    }
  });
});
