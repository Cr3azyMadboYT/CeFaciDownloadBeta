// Edge Function "e-deschis" (decision Cornel, 06.10: "bagă la verificat dacă s-au închis, în afară de parcuri"): before
// a plan is shown, asks Google Maps whether each place in it is open at the time of its step, for the whole step.
// Google's opening hours are not kept anywhere (their terms): only the place id, which may be kept, so the next check
// is one call (public.venue_google). Up to 12 places a call, signed-in people only.
// Safety (07.10): the phone sends only the place id and the time; the name and the position come from public.venues
// (otherwise anyone could tie a real place to a closed one on Google, for everyone). Every check counts against a
// quota (api_quota: per person and for the whole app each day), so nobody can run up the Google bill.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
type Ask = { id: string; at: string; until?: string };
type Item = Ask & { name: string; lat: number; lon: number };
const okTime = (t: unknown) => typeof t === 'string' && t.length <= 40 && Math.abs(Date.parse(t) - Date.now()) < 9 * 864e5;
type Point = { day: number; hour: number; minute: number };
type Period = { open: Point; close?: Point };

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
const sameName = (a: string, b: string) => { const fa = fold(a), fb = fold(b); return fa.includes(fb) || fb.includes(fa) || fa.split(' ').some((w) => w.length > 3 && fb.split(' ').includes(w)); };

/** Minute of the week (0 = Sunday 00:00) of a moment, in the place's local time. */
const weekMin = (t: Date, offset: number) => { const l = new Date(t.getTime() + offset * 60e3); return l.getUTCDay() * 1440 + l.getUTCHours() * 60 + l.getUTCMinutes(); };
const W = 7 * 1440;
/** Open from `a` to `b` (minutes of the week)? And when the period that covers `a` closes. */
function openSpan(periods: Period[], a: number, b: number): { open: boolean; closes: number | null } {
  if (periods.length === 1 && !periods[0].close) return { open: true, closes: null }; // open all the time
  for (const p of periods) {
    const s = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    let e = p.close ? p.close.day * 1440 + p.close.hour * 60 + p.close.minute : s + 1440;
    if (e <= s) e += W;
    for (const shift of [0, W]) {
      const x = a + shift; let y = b + shift; if (y < x) y += W;
      if (x >= s && x < e) return { open: y <= e + 15, closes: e % W }; // a quarter of an hour before closing is fine
    }
  }
  return { open: false, closes: null };
}
const hhmm = (m: number) => String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await user.auth.getUser();
  if (!who?.user) return json({ error: 'Doar cu cont.' }, 401);
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: key } = await db.rpc('google_key');
  if (!key) return json({ error: 'Fără cheie Google.' }, 503);
  const body = await req.json().catch(() => ({}));
  const asks: Ask[] = (Array.isArray(body.items) ? body.items : []).slice(0, 12)
    .filter((x: Ask) => x && typeof x.id === 'string' && x.id.length <= 80 && okTime(x.at) && (x.until === undefined || okTime(x.until)));
  const items: Item[] = [];
  if (asks.length) {
    const { data } = await db.from('venues').select('id, data, edit, status').in('id', [...new Set(asks.map((x) => x.id))]);
    const real = new Map((data ?? []).filter((v) => v.status === 'on').map((v) => [v.id as string, { ...(v.data ?? {}), ...(v.edit ?? {}) } as Record<string, unknown>]));
    for (const x of asks) {
      const v = real.get(x.id);
      if (v && typeof v.name === 'string' && typeof v.lat === 'number' && typeof v.lon === 'number') items.push({ id: x.id, at: x.at, until: x.until, name: v.name, lat: v.lat, lon: v.lon });
    }
  }
  if (items.length) {
    const { data: allowed } = await db.rpc('api_quota', { p_user: who.user.id, p_kind: 'e-deschis', p_n: items.length });
    if (!allowed) return json({ checked: {}, limit: true }); // not checked: the plan stays as the app made it
  }

  const known = new Map<string, string>();
  if (items.length) {
    const { data } = await db.from('venue_google').select('venue_id, place_id').in('venue_id', items.map((x) => x.id));
    for (const r of data ?? []) known.set(r.venue_id, r.place_id);
  }
  const out: Record<string, { open: boolean | null; closes?: string; status?: string }> = {};
  await Promise.all(items.map(async (x) => {
    try {
      let pid = known.get(x.id);
      if (!pid) {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location' },
          body: JSON.stringify({ textQuery: x.name, languageCode: 'ro', regionCode: 'RO', maxResultCount: 5, locationBias: { circle: { center: { latitude: x.lat, longitude: x.lon }, radius: 300 } } }),
        });
        if (!res.ok) { out[x.id] = { open: null, status: 'google-' + res.status }; return; }
        const found = ((await res.json()).places ?? []).map((p: any) => ({ p, m: km(x, { lat: p.location.latitude, lon: p.location.longitude }) * 1000 }))
          .filter(({ p, m }: any) => m < 250 && (m < 60 || sameName(x.name, p.displayName?.text ?? ''))).sort((a: any, b: any) => a.m - b.m)[0]?.p;
        if (!found) { out[x.id] = { open: null, status: 'negasit' }; return; }
        pid = found.id as string;
        await db.from('venue_google').upsert({ venue_id: x.id, place_id: pid, checked_at: new Date().toISOString() });
      }
      const res = await fetch('https://places.googleapis.com/v1/places/' + pid, { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'businessStatus,currentOpeningHours,regularOpeningHours,utcOffsetMinutes' } });
      if (!res.ok) { out[x.id] = { open: null, status: 'google-' + res.status }; return; }
      const d = await res.json();
      if (d.businessStatus && d.businessStatus !== 'OPERATIONAL') { out[x.id] = { open: false, status: d.businessStatus === 'CLOSED_PERMANENTLY' ? 'inchis-definitiv' : 'inchis-temporar' }; return; }
      const periods: Period[] = d.currentOpeningHours?.periods ?? d.regularOpeningHours?.periods ?? [];
      if (!periods.length) { out[x.id] = { open: null, status: 'fara-program' }; return; }
      const off = typeof d.utcOffsetMinutes === 'number' ? d.utcOffsetMinutes : 180;
      const a = weekMin(new Date(x.at), off), b = x.until ? weekMin(new Date(x.until), off) : a + 45;
      const s = openSpan(periods, a, b);
      out[x.id] = { open: s.open, ...(s.closes !== null ? { closes: hhmm(s.closes) } : {}) };
    } catch { out[x.id] = { open: null }; }
  }));
  return json({ checked: out });
});
