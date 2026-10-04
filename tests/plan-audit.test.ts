// The audit of "Creează plan" (decision Cornel, 04.10: "după ora 8 logica nu e bună… vreau perfecțiune"): every zone,
// every hour from noon to 04:00, one place or the whole evening, leaving now or at an hour, alone or a crew, with or
// without a budget and a vibe, and for under 18. No plan may send people somewhere closed, dark or at a silly hour,
// and there is never an empty screen without a reason. FULL=1 runs every hour and more combinations.
import { describe, expect, it } from 'vitest';
import { APP, type PlanAsk } from '../src/app/bridge';
import { ZONES } from '../src/engine/catalog';
import { adultOnly, closesAt, km, openAt, openChance, LIKELY, DAYLIGHT_KINDS } from '../src/engine/core';
import { isDark, nightHour } from '../src/engine/time';

type Set = ReturnType<typeof APP.makePlans>;
const FULL = !!process.env.FULL;
const HOURS = FULL ? [10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4] : [12, 18, 20, 22, 0, 2, 4];
const ASKS: Omit<PlanAsk, 'at' | 'mode'>[] = [
  { people: 4, budget: [0, 150], vibes: [] },
  { people: 2, budget: [0, Infinity], vibes: ['Party'] },
  { people: 1, budget: [0, 50], vibes: ['Chill'] },
  ...(FULL ? [{ people: 2, budget: [30, 120], vibes: ['Cultură'] }, { people: 9, budget: [0, 200], vibes: ['Mâncare bună'] }, { people: 3, budget: [0, 0], vibes: [] }, { people: 6, budget: [0, Infinity], vibes: ['Fun', 'Competitiv'] }] as Omit<PlanAsk, 'at' | 'mode'>[] : []),
];
const FRIDAY = new Date(2026, 9, 9, 12, 0);
const hm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const parse = (base: Date, s: string, after: Date) => { const [h, m] = s.split(':').map(Number); const d = new Date(base); d.setHours(h, m, 0, 0); while (d.getTime() < after.getTime() - 60e3) d.setDate(d.getDate() + 1); return d; };

/** Everything wrong with one set of plans. */
function problems(set: Set, a: PlanAsk, minor: boolean): string[] {
  const out: string[] = [];
  const req = APP.lastReq!;
  if (!set.plans.length && !set.empty) out.push('gol fără explicație');
  if (set.plans.length > 3) out.push('mai mult de 3 planuri');
  const ids = set.plans.flatMap((p) => p.steps.map((s) => s.place.id));
  if (new Set(ids).size !== ids.length) out.push('același loc în două planuri');
  for (const p of set.plans) {
    const tag = p.title + ': ';
    let prevUntil: Date | null = null;
    p.steps.forEach((s, i) => {
      const v = s.place.real;
      const at = new Date(s.at);
      const until = parse(at, s.until, at);
      const name = tag + v.name + ' (' + v.k + ') ' + hm(at) + '–' + s.until;
      const o = openAt(v, at);
      if (o.known && !o.open) out.push('închis când ajungi · ' + name);
      if (!o.known && openChance(v, at) < LIKELY) out.push('probabil închis · ' + name);
      const c = o.known && o.open ? closesAt(v, at) : null;
      if (c && until.getTime() > c.getTime() + 60e3) out.push('rămâi după închidere · ' + name);
      const stay = (until.getTime() - at.getTime()) / 60e3;
      if (stay < (s.why === 'Ceva de mâncat' ? 30 : 44)) out.push('prea puțin timp acolo (' + Math.round(stay) + ' min) · ' + name);
      if ((v.k === 'cinema' || v.k === 'theatre') && stay < 119) out.push('filmul sau piesa tăiate la jumătate · ' + name);
      if (DAYLIGHT_KINDS.has(v.k) && isDark(new Date(until.getTime() - 60e3))) out.push('loc de zi, pe întuneric · ' + name);
      const h = nightHour(at);
      if ((v.k === 'cafe' || v.k === 'ice_cream') && h >= 21.75 && !s.sure) out.push('cafenea târziu, fără program · ' + name);
      if (v.k === 'theatre' && h > 20.5 && !s.sure) out.push('teatru după 20:30 · ' + name);
      if (v.k === 'nightclub' && h < 21.5 && !s.sure) out.push('club devreme, fără program · ' + name);
      if (s.why === 'Cina' && h > 22.5) out.push('cină după 22:30 · ' + name);
      if (s.why === 'Prânzul' && /Cină/.test(p.title)) out.push('titlu cu cină la prânz · ' + name);
      if (minor && adultOnly(v)) out.push('loc de 18+ pentru minor · ' + name);
      if (i === 0) {
        if (!a.now && Math.abs(at.getTime() - a.at.getTime()) > 60e3) out.push('primul loc nu e la ora aleasă · ' + name);
        if (a.now && (at.getTime() < a.at.getTime() || at.getTime() > a.at.getTime() + 90 * 60e3)) out.push('„acum” ajungi prea târziu sau înainte să pleci · ' + name);
        if (km(APP.origin(), v) > req.maxKm + 0.01) out.push('mai departe decât raza · ' + name);
      }
      if (prevUntil && at.getTime() < prevUntil.getTime()) out.push('pasul începe înainte să se termine cel dinainte · ' + name);
      prevUntil = until;
    });
    if (req.budgetMax !== Infinity) {
      const cap = p.steps.length > 1 ? Math.round(req.budgetMax * 1.35) : req.budgetMax;
      if (p.price > cap) out.push('peste buget: ' + p.price + ' > ' + cap + ' · ' + p.title);
    }
    if (p.over && !p.checks.some((c) => /peste buget/.test(c.text))) out.push('peste buget fără să spună · ' + p.title);
  }
  return out;
}

describe('auditul planurilor', () => {
  it('niciun plan greșit, la nicio oră, în nicio zonă', () => {
    const issues = new Map<string, string[]>();
    let n = 0, empty = 0;
    const t0 = Date.now();
    for (const z of ZONES) {
      APP.savePrefs({ zone: z.id, dist: '20', moves: ['walk', 'car'], here: undefined, likes: [], birth: undefined } as never);
      for (const h of HOURS) for (const mode of ['loc', 'seara'] as const) ASKS.forEach((base, k) => {
        const at = new Date(FRIDAY); at.setHours(h, 0, 0, 0); if (h < 5) at.setDate(at.getDate() + 1);
        const a: PlanAsk = { ...base, mode, at, now: (h + k) % 2 === 1 };
        const set = APP.makePlans(a);
        n++; if (!set.plans.length) empty++;
        for (const p of problems(set, a, false)) {
          const key = p.split(' · ')[0];
          const list = issues.get(key) ?? [];
          if (list.length < 5) list.push(z.id + ' ' + hm(at) + ' ' + mode + (a.now ? ' acum' : '') + ' ' + base.people + 'p ' + (base.vibes.join('+') || '-') + ' → ' + p);
          issues.set(key, list);
        }
      });
    }
    const report = [...issues].map(([k, l]) => k + '\n    ' + l.join('\n    ')).join('\n');
    console.log('scenarii', n, 'goale', empty, 'ms', Date.now() - t0);
    expect(report, report).toBe('');
  }, 900000);

  it('sub 18 ani: nimic de 18+, și noaptea un răspuns, nu un ecran gol', () => {
    const birth = new Date(FRIDAY.getFullYear() - 16, 0, 1).toISOString().slice(0, 10);
    for (const z of ['centru', 's3', 'buftea', 'snagov']) {
      APP.savePrefs({ zone: z, dist: '20', moves: ['walk', 'car'], here: undefined, likes: [], birth } as never);
      for (const h of [14, 19, 22, 1]) for (const mode of ['loc', 'seara'] as const) {
        const at = new Date(FRIDAY); at.setHours(h, 0, 0, 0); if (h < 5) at.setDate(at.getDate() + 1);
        const a: PlanAsk = { mode, at, people: 3, budget: [0, 100], vibes: ['Party'] };
        const set = APP.makePlans(a);
        expect(problems(set, a, true), z + ' ' + h).toEqual([]);
      }
    }
    APP.savePrefs({ birth: undefined } as never);
  });
});
