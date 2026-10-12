// Edge Function "trimite-notificare": called by the database (pg_net) when someone starts a vote with you, calls you
// to a plan, invites you into a crew, or (FreeNow) goes out / joins your outing. It reads the row itself (the call only says which one), sends the message
// once (push_log) through Firebase Cloud Messaging to every phone of that person, and forgets dead tokens.
// Needs the secret FCM_SERVICE_ACCOUNT (the Firebase service account JSON). No JWT: the database calls it, with the
// hook secret from Vault (push_hook_secret, made by the migration 20261007030000) in the x-cefaci-hook header; any
// other caller gets the same answer as everyone and nothing happens (07.10).
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/;

interface Account { client_email: string; private_key: string; project_id: string }
let cached: { token: string; until: number } | null = null;
let hook = '';

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ''; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function googleToken(acc: Account) {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const pem = acc.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: acc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + claim + '.' + sig,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Google token: ' + JSON.stringify(data).slice(0, 200));
  cached = { token: data.access_token, until: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' });

const MOOD: Record<string, string> = { mancare: 'mâncare', pahar: 'un pahar', cafea: 'o cafea', film: 'un film', plimbare: 'o plimbare', joaca: 'joacă', desert: 'desert' };
const MOOD_ICON: Record<string, string> = { orice: '⚡', mancare: '🍕', pahar: '🍻', cafea: '☕', film: '🎬', plimbare: '🚶', joaca: '🎳', desert: '🍰' };

const done = () => json({ ok: true }); // the same answer whatever happened: nothing to learn from calling it

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Doar POST.' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (!hook) hook = String((await db.rpc('push_hook_secret')).data ?? '');
  const given = req.headers.get('x-cefaci-hook') ?? '';
  if (!hook || given.length !== hook.length || given !== hook) return done();
  let kind = '', ref = '', user = '';
  try { const b = await req.json(); kind = String(b.kind ?? ''); ref = String(b.ref ?? ''); user = String(b.user ?? ''); } catch { /* bad body */ }
  if (!['vote', 'plan', 'crew', 'free', 'free_join', 'free_left'].includes(kind) || !UUID.test(ref) || !UUID.test(user)) return done();
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return done();
  const name = async (id: string | null) => (id ? ((await db.from('profiles').select('first_name').eq('id', id).maybeSingle()).data?.first_name ?? 'Cineva') : 'Cineva');

  // the message, from the real row (and only if this person is really in it)
  let title = '', body = '', url = '';
  if (kind === 'vote') {
    const { data: v } = await db.from('vote_sessions').select('created_by, closes_at, crew_id').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('vote_voters').select('user_id').eq('session_id', ref).eq('user_id', user).maybeSingle();
    if (!v || !me || new Date(v.closes_at).getTime() < Date.now()) return done();
    title = (await name(v.created_by)) + ' a pornit un vot: unde mergem?';
    body = 'Votează până la ' + hhmm(v.closes_at) + '. Da, Nu sau Super.';
    url = '/vot/' + ref;
  } else if (kind === 'plan') {
    const { data: p } = await db.from('plans').select('owner_id, venue_name, starts_at, status').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('plan_members').select('answer').eq('plan_id', ref).eq('user_id', user).maybeSingle();
    if (!p || !me || p.status !== 'active') return done();
    title = (await name(p.owner_id)) + ' te cheamă la ' + p.venue_name;
    body = new Date(p.starts_at).toLocaleDateString('ro-RO', { weekday: 'long', timeZone: 'Europe/Bucharest' }) + ', la ' + hhmm(p.starts_at) + '. Răspunde cu Vin sau Nu pot.';
    url = '/planuri';
  } else if (kind === 'free') {
    // FreeNow: cine a intrat (rândul încă pornit); vizibilitatea a fost verificată de baza de date înainte de trimitere
    const { data: f } = await db.from('free_now').select('user_id, starts_at, ends_at, moods').eq('id', ref).maybeSingle();
    if (!f || new Date(f.ends_at).getTime() < Date.now()) return done();
    const later = new Date(f.starts_at).getTime() > Date.now() + 5 * 60_000;
    title = (await name(f.user_id)) + ' e pe FreeNow ' + (later ? 'de la ' + hhmm(f.starts_at) + ' la ' : 'până la ') + hhmm(f.ends_at) + ' ' + (MOOD_ICON[f.moods?.[0]] ?? '⚡');
    body = (f.moods?.length && f.moods[0] !== 'orice' ? 'Chef de ' + f.moods.map((m: string) => MOOD[m] ?? m).join(' sau ') + '. ' : '') + 'Ieși și tu?';
    url = '/freenow';
  } else if (kind === 'free_join') {
    const { data: m } = await db.from('free_outing_members').select('user_id, outing_id, left_at').eq('id', ref).maybeSingle();
    if (!m || m.left_at || m.user_id === user) return done();
    const { data: me } = await db.from('free_outing_members').select('left_at').eq('outing_id', m.outing_id).eq('user_id', user).maybeSingle();
    if (!me || me.left_at) return done();
    title = (await name(m.user_id)) + ' iese cu voi!';
    body = 'Bilu are 3 locuri pentru voi. Intră și votați.';
    url = '/freenow';
  } else if (kind === 'free_left') {
    const { data: o } = await db.from('free_outings').select('status').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('free_outing_members').select('left_at').eq('outing_id', ref).eq('user_id', user).maybeSingle();
    if (!o || !me || me.left_at) return done();
    title = 'Ceilalți nu mai pot';
    body = 'Ieșirea s-a oprit. Vezi cine mai e pe FreeNow.';
    url = '/freenow';
  } else {
    const { data: c } = await db.from('crews').select('name').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('crew_members').select('status, invited_by').eq('crew_id', ref).eq('user_id', user).maybeSingle();
    if (!c || !me || me.status !== 'invited') return done();
    title = (await name(me.invited_by)) + ' te-a invitat în gașca „' + c.name + '”';
    body = 'Intră în CeFaci ca să accepți.';
    url = '/gasca/' + ref;
  }

  // once per person and thing
  const { error: dup } = await db.from('push_log').insert({ kind, ref, user_id: user });
  if (dup) return done();
  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', user);
  if (!tokens?.length) return done();

  const acc = JSON.parse(raw) as Account;
  const access = await googleToken(acc);
  let sent = 0;
  for (const { token } of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: { title, body }, data: { url }, android: { priority: 'high', notification: { channel_id: 'social' } } } }),
    });
    if (res.ok) { sent++; continue; }
    const err = await res.text();
    if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(err)) await db.from('push_tokens').delete().eq('token', token);
  }
  return done();
});
