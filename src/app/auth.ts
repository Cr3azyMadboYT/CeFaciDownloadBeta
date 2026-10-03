// Sign-in with Google or with an email code, through Supabase (project "CeFaci 2.0"). Phone sign-in is off until SMS is paid for; Apple waits for an Apple account.
// The publishable key is meant to live in the app; override both with VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
import { createClient, type Session } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://vqrmwuarjjntusfbqprx.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_DWl1cra4FE1Dxgc2hwtGrA_0LwP5B4O';

let client: ReturnType<typeof createClient> | null = null;
const sb = () => (client ??= createClient(URL, KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }));
export const cloudClient = () => sb();

/** Google refuses to sign in from a file opened locally (the APK's WebView); it works from the web address. */
export const googleAvailable = () => typeof location !== 'undefined' && /^https?:$/.test(location.protocol);

export async function signInWithGoogle(): Promise<string | null> {
  if (!googleAvailable()) return 'Google merge deocamdată doar din versiunea web. Continuă fără cont, îl legi mai târziu.';
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
