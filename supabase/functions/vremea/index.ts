// Edge Function "vremea": keeps the weather for București + Ilfov fresh in public.weather (one row), from Google's
// Weather API: the next 48 hours and 7 days, for the city centre (the whole area has the same weather). It asks
// Google at most once every 50 minutes, whoever calls; the app reads the row and calls this only when it is stale.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const AT = 'location.latitude=44.4312&location.longitude=26.101';
const r1 = (n: number | undefined) => (typeof n === 'number' ? Math.round(n * 10) / 10 : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: row } = await db.from('weather').select('updated_at').eq('id', 1).maybeSingle();
  if (row && Date.now() - new Date(row.updated_at).getTime() < 50 * 60e3) return json({ fresh: true });
  const { data: key } = await db.rpc('google_key');
  if (!key) return json({ error: 'Fără cheie Google.' }, 503);

  const hours: unknown[] = [];
  let token = '';
  for (let page = 0; page < 2; page++) {
    const res = await fetch(`https://weather.googleapis.com/v1/forecast/hours:lookup?key=${key}&${AT}&hours=48&pageSize=24${token ? '&pageToken=' + token : ''}`);
    if (!res.ok) return json({ error: 'Google: ' + res.status }, 502);
    const d = await res.json();
    for (const h of d.forecastHours ?? []) {
      hours.push({
        t: h.interval?.startTime, c: h.weatherCondition?.type ?? 'CLEAR', temp: r1(h.temperature?.degrees), feel: r1(h.feelsLikeTemperature?.degrees),
        rain: h.precipitation?.probability?.percent ?? 0, mm: r1(h.precipitation?.qpf?.quantity) ?? 0, wind: r1(h.wind?.speed?.value) ?? 0,
        storm: h.thunderstormProbability ?? 0, day: !!h.isDaytime,
      });
    }
    token = d.nextPageToken ?? '';
    if (!token) break;
  }
  const dres = await fetch(`https://weather.googleapis.com/v1/forecast/days:lookup?key=${key}&${AT}&days=7&pageSize=7`);
  if (!dres.ok) return json({ error: 'Google: ' + dres.status }, 502);
  const days = ((await dres.json()).forecastDays ?? []).filter((d: Record<string, any>) => d?.displayDate).map((d: Record<string, any>) => ({
    d: `${d.displayDate.year}-${String(d.displayDate.month).padStart(2, '0')}-${String(d.displayDate.day).padStart(2, '0')}`,
    max: r1(d.maxTemperature?.degrees), min: r1(d.minTemperature?.degrees),
    cd: d.daytimeForecast?.weatherCondition?.type ?? 'CLEAR', cn: d.nighttimeForecast?.weatherCondition?.type ?? 'CLEAR',
    rd: d.daytimeForecast?.precipitation?.probability?.percent ?? 0, rn: d.nighttimeForecast?.precipitation?.probability?.percent ?? 0,
  }));
  const data = { at: new Date().toISOString(), hours, days };
  const { error } = await db.from('weather').upsert({ id: 1, updated_at: data.at, data });
  if (error) return json({ error: 'Nu am putut salva vremea.' }, 500);
  return json({ fresh: false, hours: hours.length, days: days.length });
});
