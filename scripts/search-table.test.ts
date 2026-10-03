// Prints the search table (query → top 3): TABLE=1 npx vitest run scripts/search-table.test.ts
import { it } from 'vitest';
import venues from '../src/data/venues.json';
import { search, zoneById } from '../src/engine/core';
import type { Ctx, Venue } from '../src/engine/types';
import { QUERIES } from '../src/engine/queries';
it.skipIf(!process.env.TABLE)('table', () => {
  const ctx: Ctx = { prefs: { zone: 'centru', likes: [] }, origin: zoneById('centru'), now: new Date(2026, 9, 2, 18, 30), history: [] };
  const rows: string[] = [];
  for (const c of QUERIES) {
    const t = performance.now();
    const r = search(venues as Venue[], c.q, ctx);
    const ms = Math.round(performance.now() - t);
    rows.push('| ' + c.q + ' | ' + r.results.slice(0, 3).map((x) => x.v.name + ' (' + x.v.kind + ', ' + x.km.toFixed(1) + ' km' + (x.open.known ? ', ' + x.open.label : '') + ')').join(' · ') + ' | ' + ms + 'ms ' + (r.parsed.note ? '— ' + r.parsed.note : '') + ' |');
  }
  console.log(rows.join('\n'));
});
