// Reads a Romanian fiscal receipt (bon fiscal) from the text Google Vision found on the photo:
// the shop's CUI (with its check digit), the date and time, and the TOTAL. Pure TypeScript, shared by the
// Edge Function and the tests.

export interface Bon { cui: string | null; cuiValid: boolean; date: string | null; time: string | null; total: number | null }

/** Romanian CUI check digit (key 753217532, ×10 mod 11, 10 → 0). */
export function cuiValid(cui: string): boolean {
  const d = cui.replace(/\D/g, '');
  if (d.length < 2 || d.length > 10) return false;
  const body = d.slice(0, -1).padStart(9, '0');
  const key = '753217532';
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(key[i]);
  const check = (sum * 10) % 11 % 10;
  return check === Number(d[d.length - 1]);
}

const amount = (s: string) => Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

export function parseBon(text: string): Bon {
  const t = (text || '').replace(/\r/g, '');
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: Bon = { cui: null, cuiValid: false, date: null, time: null, total: null };

  const cuiRe = /(?:C\s*\.?\s*[IU]\s*\.?\s*[FI]|COD\s+FISCAL|C\.?\s*FISCAL|COD\s+IDENTIFICARE\s+FISCALA)\s*\.?\s*:?\s*(?:RO)?\s*(\d[\d ]{1,11}\d)/gi;
  const found: string[] = [];
  for (const m of t.matchAll(cuiRe)) found.push(m[1].replace(/\s/g, ''));
  const good = found.find(cuiValid);
  out.cui = good ?? found[0] ?? null;
  out.cuiValid = !!good;

  const dm = t.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/) ?? null;
  const ym = dm ? null : t.match(/\b(\d{4})[./-](\d{2})[./-](\d{2})\b/);
  if (dm) out.date = `${dm[3]}-${dm[2]}-${dm[1]}`;
  else if (ym) out.date = `${ym[1]}-${ym[2]}-${ym[3]}`;
  const tm = t.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
  if (tm) out.time = `${tm[1]}:${tm[2]}`;

  const money = /(\d{1,3}(?:[ .]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/g;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase();
    if (!/\bTOTAL\b/.test(l) || /SUB\s*TOTAL|TOTAL\s*(TVA|T\.V\.A|BUC|ART|REDUCERI|DISCOUNT|PLATA)/.test(l)) continue;
    const here = [...lines[i].matchAll(money)].map((m) => amount(m[1]));
    const next = here.length ? here : [...(lines[i + 1] ?? '').matchAll(money)].map((m) => amount(m[1]));
    if (next.length) { out.total = next[next.length - 1]; break; }
  }
  return out;
}
