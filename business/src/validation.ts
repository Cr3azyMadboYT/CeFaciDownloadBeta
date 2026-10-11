/** Validate before JSON serialization: Number("") and NaN must not become counts. */
export function whole(input: string, label: string, min: number, max: number): number {
  const text = input.trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label}: scrie un număr întreg între ${min} și ${max}.`);
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label}: scrie un număr întreg între ${min} și ${max}.`);
  return value;
}

export function financePeriod(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to)
    throw new Error("Alege o perioadă validă: AAAA-LL-ZZ, cu începutul înaintea sfârșitului.");
  return { from, to };
}
