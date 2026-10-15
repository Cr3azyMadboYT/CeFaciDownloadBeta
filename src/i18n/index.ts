// Limba aplicației: română (implicit) sau engleză (Cornel, 15.10: „versiunea în engleză, RO/EN în Setări și Profil”).
//
// Cum se folosește: textul rămâne scris în română în cod, înfășurat în tr():
//   tr('Creează plan')                          → „Create plan” în engleză
//   tr('Ești pe FreeNow până la {t}', { t })    → variabilele între acolade, aceleași în ambele limbi
// Cheia e textul românesc exact; traducerea stă în src/i18n/en/<grup>.ts. Un text fără traducere rămâne în română
// (tests/i18n.test.ts verifică să nu lipsească niciunul). Motorul, aplicația de telefon și mesajele de la server
// (tr(error.message)) folosesc același dicționar.
import core from './en/core';
import onboarding from './en/onboarding';
import home from './en/home';
import plan from './en/plan';
import explore from './en/explore';
import ticket from './en/ticket';
import social from './en/social';
import profile from './en/profile';
import engine from './en/engine';
import server from './en/server';

export type Lang = 'ro' | 'en';
export const EN: Record<string, string> = { ...server, ...engine, ...core, ...onboarding, ...home, ...plan, ...explore, ...ticket, ...social, ...profile };

let cur: Lang = 'ro';
export const lang = (): Lang => cur;
export const setLang = (l: Lang) => { cur = l; };
/** „ro-RO” / „en-GB”, pentru toLocaleDateString și numere. */
export const locale = () => (cur === 'en' ? 'en-GB' : 'ro-RO');

/** Limba telefonului: româna dacă telefonul e pe română, altfel engleza (turiștii). */
export function deviceLang(): Lang {
  try {
    const l = Intl.DateTimeFormat().resolvedOptions().locale || '';
    return /^ro\b|^ro-|^mo\b/i.test(l) ? 'ro' : 'en';
  } catch { return 'ro'; }
}

const fill = (s: string, v?: Record<string, string | number>) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s);

/** Textul în limba aleasă. `ro` = textul românesc exact (și cheia din dicționar). */
export function tr(ro: string, vars?: Record<string, string | number>): string {
  return fill(cur === 'en' ? EN[ro] ?? ro : ro, vars);
}

/** Mesajele venite de la server (RPC-urile scriu în română): traduse când le știm, altfel lăsate așa. */
export function trServer(msg: string | null | undefined): string {
  if (!msg) return '';
  if (cur !== 'en') return msg;
  if (EN[msg]) return EN[msg];
  // „Nu găsesc @ana. Omul …”: mesajele cu un nume în ele au în dicționar forma cu {x}
  for (const k of SERVER_PATTERNS) { const m = k.re.exec(msg); if (m) return fill(EN[k.key], { x: m[1] }); }
  return msg;
}
const SERVER_PATTERNS = Object.keys(server).filter((k) => k.includes('{x}')).map((key) => ({
  key, re: new RegExp('^' + key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{x}', '(.+?)') + '$'),
}));

/** Alege între două forme după limbă, pentru bucăți care nu sunt text simplu (ordinea cuvintelor, plurale). */
export const pick = <T,>(ro: T, en: T): T => (cur === 'en' ? en : ro);
