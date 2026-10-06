// Edge Function "citeste-bon": the app sends the photo of a fiscal receipt, Google Vision reads the text,
// and the function answers with the CUI, date, time and total. The photo is not stored.
// Needs the secret VISION_API_KEY (Supabase → Edge Functions → Secrets). Only signed-in people can call it.
// With `venue` and `day` (the outing's day, yyyy-mm-dd) it also writes the +25 XP on the server (xp_bill), only for a
// receipt from that day or the next, after a check-in at that place.
// Safety (07.10): before Google reads anything, the server checks the check-in, that the XP is not already given and
// the daily quota (api_quota), so nobody can run up the Vision bill; the receipt must show a valid CUI, a date and a
// total, and the same receipt (CUI + date + time + total) counts once, for anyone.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseBon } from './bon.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Doar POST.' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'Intră în cont ca să trimiți bonul.' }, 401);

  const key = Deno.env.get('VISION_API_KEY');
  if (!key) return json({ error: 'Citirea bonurilor nu e pornită încă.' }, 503);

  let image = '', venue = '', day = '';
  try { const b = await req.json(); image = String(b.image ?? ''); venue = String(b.venue ?? '').slice(0, 80); day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day ?? '')) ? String(b.day) : ''; } catch { /* bad body */ }
  image = image.replace(/^data:image\/\w+;base64,/, '');
  if (!image || image.length > 6_000_000) return json({ error: 'Poza lipsește sau e prea mare.' }, 400);
  if (!venue || !day) return json({ error: 'Actualizează aplicația ca să pui bonul.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ready } = await admin.rpc('xp_bill_ready', { p_user: user.id, p_venue: venue, p_day: day });
  if (!ready?.ok) return json({ xp: { gain: 0, error: ready?.error ?? 'Nu pot verifica bonul acum.' } });

  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['ro'] } }] }),
  });
  if (!res.ok) return json({ error: 'Nu am putut citi poza acum. Mai încearcă puțin mai târziu.' }, 502);
  const data = await res.json();
  const text: string = data?.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!text) return json({ error: 'Nu se vede niciun text. Fă poza mai de aproape, cu lumină.' }, 422);

  const bon = parseBon(text);
  if (!bon.total || !bon.cuiValid || !bon.date) return json({ bon, xp: { gain: 0, error: 'Nu se vede tot bonul (CUI-ul, data și totalul). Fă poza mai de aproape, cu tot bonul în ea.' } });
  const next = new Date(Date.parse(day + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
  if (bon.date !== day && bon.date !== next) return json({ bon, xp: { gain: 0, error: 'Bonul e din altă zi.' } });
  const fp = [bon.cui, bon.date, bon.time ?? '', bon.total.toFixed(2)].join('|');
  const { data: xp, error } = await admin.rpc('xp_bill', { p_user: user.id, p_venue: venue, p_day: day, p_receipt: fp });
  return json({ bon, xp: error ? { gain: 0, error: 'Nu am putut scrie XP-ul acum.' } : xp });
});
