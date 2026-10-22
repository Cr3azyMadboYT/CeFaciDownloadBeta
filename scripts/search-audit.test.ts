// Search audit (22.10, Cornel: „search-ul pe Explorează e foarte important să fie fix ce trebuie”): hundreds of searches
// typed the way people type them, printed with the top 5, to read by eye. AUDIT=1 Q=1 npx vitest run scripts/search-audit.test.ts
import { it } from 'vitest';
import fs from 'node:fs';
import venues from '../src/data/venues.json';
import { search, zoneById } from '../src/engine/core';
import type { Ctx, Venue } from '../src/engine/types';
it.skipIf(!process.env.AUDIT)('audit', () => {
  const file = process.env.QFILE ?? 'scripts/search-audit-queries.txt';
  const qs = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const ctx: Ctx = { prefs: { zone: 'centru', likes: [] }, origin: zoneById('centru'), now: new Date(2026, 9, 23, 20, 30), history: [] };
  const out: string[] = [];
  for (const q of qs) {
    const r = search(venues as Venue[], q, ctx, 30);
    out.push(`## ${q}  [${r.results.length}]${r.parsed.note ? ' note: ' + r.parsed.note : ''}`);
    for (const x of r.results.slice(0, 5)) out.push(`   ${x.v.name} | ${x.v.k}${x.v.cuisines.length ? ' ' + x.v.cuisines.join('/') : ''} | ${x.km.toFixed(1)}km ${x.v.zone} | ${x.open.known ? x.open.label : '?'}${x.v.price ? ' | ' + x.v.price + 'lei' : ''}`);
  }
  fs.writeFileSync(process.env.OUT ?? '/tmp/search-audit.txt', out.join('\n'));
});
