/** Blank means an explicitly missing amount; invalid text must never become JSON null. */
export function amount(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value))
    throw new Error("Scrie o sumă validă, de exemplu 123,45 lei.");
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n > 1_000_000)
    throw new Error("Suma este prea mare.");
  return n;
}
