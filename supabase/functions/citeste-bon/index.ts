// Edge Function "citeste-bon": the app sends the photo of a fiscal receipt, Google Vision reads the text,
// and the function answers with the CUI, date, time and total. The photo is not stored.
// Needs the secret VISION_API_KEY (Supabase → Edge Functions → Secrets). Only signed-in people can call it.
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

  let image = '';
  try { image = String((await req.json()).image ?? ''); } catch { /* bad body */ }
  image = image.replace(/^data:image\/\w+;base64,/, '');
  if (!image || image.length > 8_000_000) return json({ error: 'Poza lipsește sau e prea mare.' }, 400);

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['ro'] } }] }),
  });
  if (!res.ok) return json({ error: 'Nu am putut citi poza acum. Mai încearcă puțin mai târziu.' }, 502);
  const data = await res.json();
  const text: string = data?.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!text) return json({ error: 'Nu se vede niciun text. Fă poza mai de aproape, cu lumină.' }, 422);

  return json({ bon: parseBon(text) });
});
