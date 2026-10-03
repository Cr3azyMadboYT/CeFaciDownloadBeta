// Sign-in with Google or with an email code, through Supabase (project "CeFaci 2.0"). Phone sign-in is off until SMS is paid for; Apple waits for an Apple account.
// The publishable key is meant to live in the app; override both with VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
import { createClient, type Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://vqrmwuarjjntusfbqprx.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_DWl1cra4FE1Dxgc2hwtGrA_0LwP5B4O';
// The "Web client" ID from Google Cloud → Credentials (the same one set in Supabase → Auth → Google). Needed by the app.
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '';
const native = () => Capacitor.isNativePlatform();

let client: ReturnType<typeof createClient> | null = null;
const sb = () => (client ??= createClient(URL, KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }));
export const cloudClient = () => sb();

/** In the app: Google's own sign-in sheet. On the web: Google's page. A plain local file can do neither. */
export const googleAvailable = () => native() || (typeof location !== 'undefined' && /^https?:$/.test(location.protocol));

const sha256 = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Native Google sign-in (Android app): Google gives an ID token, Supabase turns it into a session. */
async function signInNative(): Promise<string | null> {
  if (!GOOGLE_WEB_CLIENT_ID) return 'Google nu e configurat încă în aplicație. Intră cu emailul.';
  try {
    await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
    const raw = crypto.randomUUID();                       // Supabase checks the nonce Google signed
    const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'], nonce: await sha256(raw) } });
    const token = (res.result as { idToken?: string | null }).idToken;
    if (!token) return 'Google nu ne-a dat contul. Mai încearcă o dată.';
    const { error } = await sb().auth.signInWithIdToken({ provider: 'google', token, nonce: raw });
    return error ? 'Nu am putut intra cu Google. Mai încearcă o dată.' : null;
  } catch {
    return null; // closed the Google sheet: nothing to say
  }
}

export async function signInWithGoogle(): Promise<string | null> {
  if (native()) return signInNative();
  if (!googleAvailable()) return 'Google merge doar în aplicație sau pe site. Intră cu emailul sau continuă fără cont.';
  const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  return error ? 'Nu am putut porni Google. Mai încearcă o dată.' : null;
}

/** Email sign-in with a 6-digit code (works inside the app too: no web redirect). */
export async function emailStart(email: string): Promise<string | null> {
  const { error } = await sb().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (!error) return null;
  return /rate|limit|seconds/i.test(error.message) ? 'Ai cerut deja un cod. Așteaptă un minut și încearcă iar.' : 'Nu am putut trimite codul. Verifică adresa și încearcă iar.';
}
export async function emailVerify(email: string, code: string): Promise<string | null> {
  const { error } = await sb().auth.verifyOtp({ email, token: code, type: 'email' });
  return error ? 'Codul nu e bun sau a expirat.' : null;
}

export interface Who { id: string; email?: string; first: string }
const whoOf = (s: Session | null): Who | null => {
  if (!s) return null;
  const m = (s.user.user_metadata ?? {}) as Record<string, string>;
  const first = (m.given_name || (m.full_name || m.name || '').split(' ')[0] || '').trim();
  return { id: s.user.id, email: s.user.email, first };
};

/** Calls back with the signed-in person (also right after the Google redirect), or null. */
export function watchAuth(cb: (who: Who | null) => void) {
  sb().auth.getSession().then(({ data }) => cb(whoOf(data.session))).catch(() => cb(null));
  sb().auth.onAuthStateChange((_e, s) => cb(whoOf(s)));
}
