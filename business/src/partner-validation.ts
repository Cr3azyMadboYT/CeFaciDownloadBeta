import type { RequestDetails, RequestKind } from './onboarding-api';

// Mirrors the server bounds; Postgres remains authoritative on every request.
export function partnerValidation(kind: RequestKind, details: RequestDetails, hasProof: boolean): string {
  const fields: [keyof RequestDetails, string, number, number][] = [
    ['requester_name', 'Numele tău complet', 2, 100], ['requester_role', 'Rolul tău în firmă', 2, 100],
    ['firm', 'Denumirea firmei', 2, 120],
    ...(kind === 'new' ? [
      ['venue_name', 'Numele localului', 2, 120], ['address', 'Adresa completă', 3, 200],
      ['city', 'Oraș', 2, 100], ['category', 'Categoria localului', 2, 50],
    ] as [keyof RequestDetails, string, number, number][] : []),
  ];
  for (const [key, label, min, max] of fields) {
    const value = (details[key] ?? '').trim();
    if (value.length < min || value.length > max || /[\x00-\x1f\x7f]/.test(value))
      return `${label}: completează între ${min} și ${max} de caractere.`;
  }
  if (!/^[+]?[0-9 ()-]{7,24}$/.test(details.phone.trim()))
    return 'Telefonul de contact: folosește 7–24 de cifre și caractere +, spațiu, paranteze sau cratimă. Exemplu: 0712345678.';
  const cui = details.cui.trim().toUpperCase().replace(/^RO/, '');
  if (!/^[1-9][0-9]{1,9}$/.test(cui)) return 'CUI invalid. Introdu CUI-ul firmei, cu sau fără RO.';
  const digits = cui.slice(0, -1).padStart(9, '0'), weights = '753217532';
  const control = [...digits].reduce((sum, digit, i) => sum + Number(digit) * Number(weights[i]), 0) * 10 % 11;
  if ((control === 10 ? 0 : control) !== Number(cui.at(-1)))
    return 'CUI invalid. Verifică cifrele, inclusiv cifra de control.';
  if (!hasProof) return 'Atașează documentul justificativ obligatoriu pentru a trimite cererea. PDF, JPEG sau PNG, maximum 8 MB.';
  return '';
}
