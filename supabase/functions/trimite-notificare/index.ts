// Edge Function "trimite-notificare": called by the database (pg_net) when someone starts a vote with you, calls you
// to a plan or invites you into a crew. It reads the row itself (the call only says which one), sends the message
// once (push_log) through Firebase Cloud Messaging to every phone of that person, and forgets dead tokens.
// Needs the secret FCM_SERVICE_ACCOUNT (the Firebase service account JSON). No JWT: the database calls it.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/;

interface Account { client_email: string; private_key: string; project_id: string }
let cached: { token: string; until: number } | null = null;

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Doar POST.' }, 405);
  let kind = '', ref = '', user = '';
  try { const b = await req.json(); kind = String(b.kind ?? ''); ref = String(b.ref ?? ''); user = String(b.user ?? ''); } catch { /* bad body */ }
  if (!['vote', 'plan', 'crew'].includes(kind) || !UUID.test(ref) || !UUID.test(user)) return json({ error: 'Cerere greșită.' }, 400);
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return json({ skipped: 'Firebase nu e legat încă.' });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const name = async (id: string | null) => (id ? ((await db.from('profiles').select('first_name').eq('id', id).maybeSingle()).data?.first_name ?? 'Cineva') : 'Cineva');

  // the message, from the real row (and only if this person is really in it)
  let title = '', body = '', url = '';
  if (kind === 'vote') {
    const { data: v } = await db.from('vote_sessions').select('created_by, closes_at, crew_id').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('vote_voters').select('user_id').eq('session_id', ref).eq('user_id', user).maybeSingle();
    if (!v || !me || new Date(v.closes_at).getTime() < Date.now()) return json({ skipped: 'nu' });
    title = (await name(v.created_by)) + ' a pornit un vot: unde mergem?';
    body = 'Votează până la ' + hhmm(v.closes_at) + '. Da, Nu sau Super.';
    url = '/vot/' + ref;
  } else if (kind === 'plan') {
    const { data: p } = await db.from('plans').select('owner_id, venue_name, starts_at, status').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('plan_members').select('answer').eq('plan_id', ref).eq('user_id', user).maybeSingle();
    if (!p || !me || p.status !== 'active') return json({ skipped: 'nu' });
    title = (await name(p.owner_id)) + ' te cheamă la ' + p.venue_name;
    body = new Date(p.starts_at).toLocaleDateString('ro-RO', { weekday: 'long', timeZone: 'Europe/Bucharest' }) + ', la ' + hhmm(p.starts_at) + '. Răspunde cu Vin sau Nu pot.';
    url = '/planuri';
  } else {
    const { data: c } = await db.from('crews').select('name').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('crew_members').select('status, invited_by').eq('crew_id', ref).eq('user_id', user).maybeSingle();
    if (!c || !me || me.status !== 'invited') return json({ skipped: 'nu' });
    title = (await name(me.invited_by)) + ' te-a invitat în gașca „' + c.name + '”';
    body = 'Intră în CeFaci ca să accepți.';
    url = '/gasca/' + ref;
  }

  // once per person and thing
  const { error: dup } = await db.from('push_log').insert({ kind, ref, user_id: user });
  if (dup) return json({ skipped: 'deja trimis' });
  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', user);
  if (!tokens?.length) return json({ skipped: 'fără telefon' });

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
  return json({ sent });
});
