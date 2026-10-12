export const normalizeUsername = (value: string) => value.trim().toLowerCase();
export const validUsername = (value: string) => /^[a-z0-9._-]{3,20}$/.test(value);

/** No guessed dates; the database validates again when saving. */
export function validateBirthDate(day: string, month: string, year: string, today = new Date()) {
  const invalid = {iso: '', error: 'Completează o dată de naștere validă.'};
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return invalid;
  const d = Number(day), m = Number(month), y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return invalid;
  const parts = new Intl.DateTimeFormat('en', {timeZone: 'Europe/Bucharest', year: 'numeric', month: 'numeric', day: 'numeric'}).formatToParts(today);
  const part = (key: string) => Number(parts.find(p => p.type === key)?.value);
  const age = part('year') - y - (part('month') < m || (part('month') === m && part('day') < d) ? 1 : 0);
  if (age < 16) return {iso: '', error: 'Contul CeFaci este disponibil de la 16 ani.'};
  if (age > 110 || (age === 110 && (part('month') > m || (part('month') === m && part('day') > d)))) return invalid;
  return {iso: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, error: ''};
}
