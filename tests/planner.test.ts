// "Creează plan" (decision Cornel, 04.10): three plans, each place open at its hour and for as long as the plan says,
// the budget for the whole evening, "aproape" understood, a cheaper swap that really is cheaper.
import { describe, expect, it } from 'vitest';
import { APP } from '../src/app/bridge';
import { closesAt, openAt, parseQuery } from '../src/engine/core';
import { isoDay } from '../src/engine/time';

const at = (dayAdd: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayAdd); d.setHours(h, m, 0, 0); return d; };

function checkOpen(plans: ReturnType<typeof APP.makePlans>['plans']) {
  for (const p of plans) for (const s of p.steps) {
    const v = s.place.real;
    const o = openAt(v, s.at);
    if (o.known) expect(o.open, p.title + ': ' + v.name + ' la ' + s.slot).toBe(true);
    const c = closesAt(v, s.at);
    if (c) expect(new Date(s.at).getTime() < c.getTime() && s.until.replace(':', '') !== '', v.name).toBe(true);
  }
}

describe('Creează plan', () => {
  it('toată seara din Buftea, la 20:00, 4 persoane, 30–120 lei: 3 planuri, toate deschise', () => {
    APP.savePrefs({ zone: 'buftea', dist: '20', moves: ['walk', 'car'], here: undefined } as never);
    const plans = APP.makePlans({ mode: 'seara', at: at(0, 20), people: 4, budget: [30, 120], vibes: ['Mâncare bună', 'Party'] }).plans;
    expect(plans.length).toBe(3);
    checkOpen(plans);
    for (const p of plans) {
      expect(p.price).toBe(p.steps.reduce((a, s) => a + s.place.price, 0));
      expect(p.price).toBeLessThanOrEqual(Math.round(120 * 1.35)); // at most a third over, and then it says so
      if (p.price > 120) expect(p.checks.some((c) => !c.ok && /peste buget/.test(c.text))).toBe(true);
    }
  });

  it('un pas nu trece de ora de închidere a localului', () => {
    APP.savePrefs({ zone: 'buftea' } as never);
    for (const h of [19, 20, 21, 22]) {
      const plans = APP.makePlans({ mode: 'seara', at: at(0, h), people: 4, budget: [0, 300], vibes: [] }).plans;
      for (const p of plans) for (const s of p.steps) {
        const c = closesAt(s.place.real, s.at);
        if (!c) continue;
        const [uh, um] = s.until.split(':').map(Number);
        const until = new Date(s.at); until.setHours(uh, um, 0, 0); if (until < s.at) until.setDate(until.getDate() + 1);
        expect(until.getTime(), s.place.name + ' ' + s.slot + '–' + s.until).toBeLessThanOrEqual(c.getTime());
      }
    }
  });

  it('„pentru diseară” nu dă o cafenea care se închide la 17:00 (bug Trofic)', () => {
    APP.savePrefs({ zone: 'centru' } as never);
    const plans = APP.makePlans({ mode: 'loc', at: at(0, 20), people: 4, budget: [30, 120], vibes: ['Mâncare bună', 'Party'] }).plans;
    expect(plans.length).toBe(3);
    checkOpen(plans);
  });

  it('orice zi a săptămânii: planul e chiar în ziua aleasă', () => {
    APP.savePrefs({ zone: 's2' } as never);
    const when = at(4, 19, 30);
    const plans = APP.makePlans({ mode: 'seara', at: when, people: 2, budget: [0, 300], vibes: ['Cultură'] }).plans;
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) expect(new Date(p.steps[0].at).toDateString()).toBe(when.toDateString());
    checkOpen(plans);
  });

  it('un singur loc: 3 locuri diferite, „Altceva” chiar e alt fel de ieșire', () => {
    APP.savePrefs({ zone: 's1' } as never);
    const plans = APP.makePlans({ mode: 'loc', at: at(1, 20), people: 2, budget: [0, 300], vibes: [] }).plans;
    expect(plans.map((p) => p.steps.length)).toEqual([1, 1, 1]);
    expect(new Set(plans.map((p) => p.steps[0].place.id)).size).toBe(3);
    expect(plans[1].steps[0].place.real.cat === plans[0].steps[0].place.real.cat && plans[1].title === 'Altceva').toBe(false);
  });

  it('sfatul „Cu X în loc de Y” chiar iese mai ieftin', () => {
    APP.savePrefs({ zone: 'buftea' } as never);
    const plans = APP.makePlans({ mode: 'seara', at: at(0, 20), people: 4, budget: [30, 120], vibes: ['Mâncare bună', 'Party'] }).plans;
    const i = plans.findIndex((p) => p.tip);
    if (i < 0) return;
    const before = plans[i].price;
    const after = APP.swapPlan(i, plans[i].tip!.step, plans[i].tip!.id)!;
    expect(after.price).toBeLessThan(before);
    expect(after.steps[plans[i].tip!.step].place.id).toBe(plans[i].tip!.id);
  });

  it('„Alt bar” dă alt loc de același fel, deschis', () => {
    APP.savePrefs({ zone: 'centru' } as never);
    const plans = APP.makePlans({ mode: 'seara', at: at(1, 20), people: 4, budget: [0, 300], vibes: ['Party'] }).plans;
    const p = plans.find((x) => x.steps.length > 1)!;
    const i = plans.indexOf(p);
    const old = p.steps[1].place;
    const next = APP.altPlan(i, 1)!;
    expect(next).not.toBeNull();
    expect(next.steps[1].place.id).not.toBe(old.id);
    const o = openAt(next.steps[1].place.real, next.steps[1].at);
    if (o.known) expect(o.open).toBe(true);
  });

  it('Spune-i lui Bilu: „cu terasă, după 22, mai aproape și ieftin”', () => {
    const now = at(0, 15);
    const r = APP.refine('cu terasa, dupa 22, mai aproape si ieftin', { mode: 'seara', at: at(0, 20), people: 4, budget: [30, 120], vibes: [] }, { evening: isoDay(now), hour: '20:00' }, now);
    expect(r.ask.outdoor).toBe(true);
    expect(r.ask.near).toBe(true);
    expect(r.ask.budget[1]).toBeLessThanOrEqual(50);
    expect(new Date(r.ask.at).getHours()).toBe(22);
    expect(r.slot.hour).toBe('22:00');
    expect(r.chips).toEqual(expect.arrayContaining(['Cu terasă', 'Aproape']));
  });

  it('„aproape” e citit, dar „aproape de Unirii” e un loc', () => {
    expect(parseQuery('un bar aproape').near).toBe(true);
    expect(parseQuery('pizza langa mine').near).toBe(true);
    expect(parseQuery('ceva mai aproape').near).toBe(true);
    const u = parseQuery('restaurant aproape de unirii');
    expect(u.near).toBe(false);
  });

  it('Bilu îți sugerează: idei reale, fără să întrebi nimic', () => {
    APP.savePrefs({ zone: 'buftea', likes: ['food', 'party'] } as never);
    const ideas = APP.suggestions(new Date(2026, 9, 9, 21, 0));
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((x) => x.now)).toBe(true);
    expect(new Set(ideas.map((x) => x.place.id)).size).toBe(ideas.length);
  });

  it('Bilu îți sugerează dimineața devreme: când nu e nimic deschis acum, idei pentru mai târziu', () => {
    APP.savePrefs({ zone: 'buftea', likes: ['food', 'party'] } as never);
    for (const h of [5, 6, 7]) {
      const ideas = APP.suggestions(new Date(2026, 9, 9, h, 30));
      expect(ideas.length, h + ':30').toBeGreaterThan(0);
      for (const x of ideas) if (!x.now) expect(x.at.getHours()).toBeGreaterThanOrEqual(10);
    }
  });
});
