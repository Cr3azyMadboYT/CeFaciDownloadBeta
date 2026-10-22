// Edge Function "trimite-notificare": called by the database (pg_net) when someone starts a vote with you, calls you
// to a plan, invites you into a crew, asks to be friends / accepts (22.10), or (FreeNow) goes out / joins your outing.
// Every message also stays in public.notifications (the bell in the app). It reads the row itself (the call only says which one), sends the message
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
const MOOD_EN: Record<string, string> = { mancare: 'food', pahar: 'a drink', cafea: 'a coffee', film: 'a movie', plimbare: 'a walk', joaca: 'games', desert: 'dessert' };
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
  if (!['vote', 'plan', 'crew', 'free', 'free_join', 'free_left', 'friend', 'friend_ok'].includes(kind) || !UUID.test(ref) || !UUID.test(user)) return done();
  const name = async (id: string | null) => (id ? ((await db.from('profiles').select('first_name').eq('id', id).maybeSingle()).data?.first_name ?? 'Cineva') : 'Cineva');

  // the message, from the real row (and only if this person is really in it)
  // română și engleză: fiecare telefon primește limba aleasă în aplicație (push_tokens.lang, 15.10)
  let title = '', body = '', url = '', titleEn = '', bodyEn = '';
  if (kind === 'vote') {
    const { data: v } = await db.from('vote_sessions').select('created_by, closes_at, crew_id').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('vote_voters').select('user_id').eq('session_id', ref).eq('user_id', user).maybeSingle();
    if (!v || !me || new Date(v.closes_at).getTime() < Date.now()) return done();
    const who = await name(v.created_by);
    title = who + ' a pornit un vot: unde mergem?';
    body = 'Votează până la ' + hhmm(v.closes_at) + '. Da, Nu sau Super.';
    titleEn = who + ' started a vote: where are we going?';
    bodyEn = 'Vote by ' + hhmm(v.closes_at) + '. Yes, No or Super.';
    url = '/vot/' + ref;
  } else if (kind === 'plan') {
    const { data: p } = await db.from('plans').select('owner_id, venue_name, starts_at, status').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('plan_members').select('answer').eq('plan_id', ref).eq('user_id', user).maybeSingle();
    if (!p || !me || p.status !== 'active') return done();
    const who = await name(p.owner_id);
    title = who + ' te cheamă la ' + p.venue_name;
    body = new Date(p.starts_at).toLocaleDateString('ro-RO', { weekday: 'long', timeZone: 'Europe/Bucharest' }) + ', la ' + hhmm(p.starts_at) + '. Răspunde cu Vin sau Nu pot.';
    titleEn = who + ' invited you to ' + p.venue_name;
    bodyEn = new Date(p.starts_at).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/Bucharest' }) + ' at ' + hhmm(p.starts_at) + '. Answer I\'m in or Can\'t make it.';
    url = '/planuri';
  } else if (kind === 'free') {
    // FreeNow: cine a intrat (rândul încă pornit); vizibilitatea a fost verificată de baza de date înainte de trimitere
    const { data: f } = await db.from('free_now').select('user_id, starts_at, ends_at, moods').eq('id', ref).maybeSingle();
    if (!f || new Date(f.ends_at).getTime() < Date.now()) return done();
    const later = new Date(f.starts_at).getTime() > Date.now() + 5 * 60_000;
    const who = await name(f.user_id);
    const icon = MOOD_ICON[f.moods?.[0]] ?? '⚡';
    const some = f.moods?.length && f.moods[0] !== 'orice';
    title = who + ' e pe FreeNow ' + (later ? 'de la ' + hhmm(f.starts_at) + ' la ' : 'până la ') + hhmm(f.ends_at) + ' ' + icon;
    body = (some ? 'Chef de ' + f.moods.map((m: string) => MOOD[m] ?? m).join(' sau ') + '. ' : '') + 'Ieși și tu?';
    titleEn = who + ' is on FreeNow ' + (later ? 'from ' + hhmm(f.starts_at) + ' to ' : 'until ') + hhmm(f.ends_at) + ' ' + icon;
    bodyEn = (some ? 'In the mood for ' + f.moods.map((m: string) => MOOD_EN[m] ?? m).join(' or ') + '. ' : '') + 'Coming along?';
    url = '/freenow';
  } else if (kind === 'free_join') {
    const { data: m } = await db.from('free_outing_members').select('user_id, outing_id, left_at').eq('id', ref).maybeSingle();
    if (!m || m.left_at || m.user_id === user) return done();
    const { data: me } = await db.from('free_outing_members').select('left_at').eq('outing_id', m.outing_id).eq('user_id', user).maybeSingle();
    if (!me || me.left_at) return done();
    const who = await name(m.user_id);
    title = who + ' iese cu voi!';
    body = 'Bilu are 3 locuri pentru voi. Intră și votați.';
    titleEn = who + ' is coming with you!';
    bodyEn = 'Bilu has 3 places for you. Jump in and vote.';
    url = '/freenow';
  } else if (kind === 'free_left') {
    const { data: o } = await db.from('free_outings').select('status').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('free_outing_members').select('left_at').eq('outing_id', ref).eq('user_id', user).maybeSingle();
    if (!o || !me || me.left_at) return done();
    title = 'Ceilalți nu mai pot';
    body = 'Ieșirea s-a oprit. Vezi cine mai e pe FreeNow.';
    titleEn = 'The others can\'t make it';
    bodyEn = 'The outing is off. See who else is on FreeNow.';
    url = '/freenow';
  } else if (kind === 'friend') {
    // ref = cine cere, user = cine primește cererea (22.10)
    const { data: f } = await db.from('friendships').select('status').eq('requester', ref).eq('addressee', user).maybeSingle();
    if (!f || f.status !== 'pending') return done();
    const who = await name(ref);
    title = who + ' vrea să fiți prieteni';
    body = 'Acceptă și ieșiți împreună: planuri, gășci, FreeNow.';
    titleEn = who + ' wants to be friends';
    bodyEn = 'Accept and go out together: plans, crews, FreeNow.';
    url = '/prieteni';
  } else if (kind === 'friend_ok') {
    // ref = noul prieten, user = cine primește vestea
    const { data: f } = await db.from('friendships').select('status').or(`and(requester.eq.${ref},addressee.eq.${user}),and(requester.eq.${user},addressee.eq.${ref})`).maybeSingle();
    if (!f || f.status !== 'accepted') return done();
    const who = await name(ref);
    title = 'Tu și ' + who + ' sunteți prieteni';
    body = 'Faceți un plan împreună?';
    titleEn = 'You and ' + who + ' are now friends';
    bodyEn = 'Make a plan together?';
    url = '/prieten/' + ref;
  } else {
    const { data: c } = await db.from('crews').select('name').eq('id', ref).maybeSingle();
    const { data: me } = await db.from('crew_members').select('status, invited_by').eq('crew_id', ref).eq('user_id', user).maybeSingle();
    if (!c || !me || me.status !== 'invited') return done();
    const who = await name(me.invited_by);
    title = who + ' te-a invitat în gașca „' + c.name + '”';
    body = 'Intră în CeFaci ca să accepți.';
    titleEn = who + ' invited you to the crew “' + c.name + '”';
    bodyEn = 'Open CeFaci to accept.';
    url = '/gasca/' + ref;
  }

  // once per person and thing
  const { error: dup } = await db.from('push_log').insert({ kind, ref, user_id: user });
  if (dup) return done();
  // the bell: the list keeps everything, even when the phone has no notifications turned on (22.10)
  await db.from('notifications').insert({ user_id: user, kind, ref, title, body, title_en: titleEn || null, body_en: bodyEn || null, url });
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return done();
  const { data: tokens } = await db.from('push_tokens').select('token, lang').eq('user_id', user);
  if (!tokens?.length) return done();

  const acc = JSON.parse(raw) as Account;
  const access = await googleToken(acc);
  let sent = 0;
  for (const { token, lang } of tokens as { token: string; lang?: string | null }[]) {
    const en = lang === 'en' && titleEn;
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: en ? { title: titleEn, body: bodyEn } : { title, body }, data: { url }, android: { priority: 'high', notification: { channel_id: 'social' } } } }),
    });
    if (res.ok) { sent++; continue; }
    const err = await res.text();
    if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(err)) await db.from('push_tokens').delete().eq('token', token);
  }
  return done();
});
