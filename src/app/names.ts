// Nume urâte (decizie Cornel, 06.10: „să nu-și poată pune nume urâte… să-i zică Bilu: alege alt nume”).
// Prenumele, username-ul și numele gășcii trec pe aici în aplicație; aceeași regulă e și pe server
// (`private.rude` în supabase/migrations/20261006050000_cefaci_drepturi_nume.sql), testate pe aceleași exemple
// (tests/names.test.ts, tests/db.test.ts).
//
// Ca să prindă și variantele: fără diacritice, cifre/semne în loc de litere (pu1a, pul@, mu13), k/q în loc de c,
// w în loc de u, y în loc de i, litere repetate (puuuula), separatori (p.u.l.a, p u l a, pula_mea).
// Ca să nu blocheze nume bune („Ursula”, „Paula”, „Pulisic”, „Gașca pornită”), cuvintele scurte se caută doar ca
// cuvânt întreg sau la începutul/sfârșitul unui cuvânt; doar rădăcinile lungi, fără alt sens, se caută oriunde.
// Cuvinte noi: se adaugă aici ȘI în migrare (testul compară cele două liste), scrise cum le vede regula:
// fără diacritice, c în loc de k, fără litere dublate (fuck → fuc, fmm → fm).

/** Oriunde în cuvânt, și în tot numele lipit (p.u.l.a.m.e.a). */
export const RUDE_ANYWHERE = ['pizd', 'cacat', 'muist', 'futut', 'futai', 'futui', 'labagi', 'bulangi', 'poponar', 'sloboz', 'fucboi', 'fucer', 'fucing', 'fucof', 'bitch', 'hitler', 'pulamea'];
/** La începutul sau la sfârșitul unui cuvânt (pulamare, ionutpula), sau cuvânt întreg. */
export const RUDE_EDGE = ['pula', 'pule', 'muie', 'pisat', 'coaie', 'curva', 'shit', 'cunt', 'porno', 'dildo', 'penis', 'vagin'];
/** Doar cuvânt întreg (altfel ar prinde nume bune). */
export const RUDE_EXACT = ['sula', 'cur', 'curu', 'fut', 'fute', 'futu', 'puli', 'plm', 'pzd', 'pzda', 'fm', 'fuc', 'fucu', 'mue', 'muje', 'suge', 'sugi', 'coi', 'sex', 'porn', 'nazi', 'niga', 'naiba', 'dracu', 'jeg', 'jegos', 'bou', 'prost', 'idiot', 'retard', 'handicapat', 'tampit', 'morti', 'pis', 'pisu'];

/** Letters written another way, and look-alike digits and signs. */
export const LETTERS: [string, string] = ['ăâîșşțţáàäãéèëêíìïóòöôõúùüûýykqw', 'aaissttaaaaeeeeiiiooooouuuuiiccu'];
export const LEET: [string, string] = ['03457@$!', 'oeastasi'];

const tr = (s: string, [from, to]: [string, string]) => [...s].map((ch) => { const i = from.indexOf(ch); return i < 0 ? ch : to[i]; }).join('');

/** The same text read three ways: „1” and „|” as i, then as l (pu1a, mu1e), then digits as plain separators (sula03). */
function readings(text: string): string[] {
  const base = tr(text.toLowerCase(), LETTERS);
  const leet = tr(base, LEET);
  return [leet.replace(/[1|]/g, 'i'), leet.replace(/[1|]/g, 'l'), base];
}

const collapse = (w: string) => w.replace(/(.)\1+/g, '$1');

/** True when the name (or username, or crew name) is rude, in any of the usual disguises. */
export function isRudeName(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const s of readings(text)) {
    const words = s.split(/[^a-z]+/).filter(Boolean).map(collapse);
    for (const w of words) {
      if (RUDE_EXACT.includes(w) || RUDE_EDGE.some((r) => w.startsWith(r) || w.endsWith(r)) || RUDE_ANYWHERE.some((r) => w.includes(r))) return true;
    }
    // spelled out (p u l a, p.u.l.a.m.e.a): the whole name glued together, only as an exact word or a long root,
    // so that „Pe Nisip” (penisip) or „Ana Cur…” across two words are not caught
    const glued = collapse(words.join(''));
    if (words.length > 1 && (RUDE_EXACT.includes(glued) || RUDE_EDGE.includes(glued) || RUDE_ANYWHERE.some((r) => glued.includes(r)))) return true;
  }
  return false;
}

/** What Bilu says when the name is rude. */
export const RUDE_SAY = 'Te rog alege alt nume, acesta nu prea pare potrivit.';
