// Links that come from the places' data (OpenStreetMap, research, Admin): only web pages and phone numbers leave the
// app, never another app's link (intent:, market:, a deep link) or a script (07.10).

/** A web address as https/http, or null if it is not one. */
export function webLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch { return null; }
}

/** A phone link with only digits and a leading +, or null. */
export function telLink(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return d.replace(/\D/g, '').length >= 6 ? 'tel:' + d : null;
}

/** Hosts a map may open (the map makers' credits). */
const MAP_HOSTS = /^(www\.)?(openstreetmap\.org|openfreemap\.org|maplibre\.org|openmaptiles\.org|esri\.com|arcgis\.com)$/;
export function mapLink(raw: string): string | null {
  const w = webLink(raw);
  if (!w) return null;
  try { return MAP_HOSTS.test(new URL(w).hostname) ? w : null; } catch { return null; }
}
