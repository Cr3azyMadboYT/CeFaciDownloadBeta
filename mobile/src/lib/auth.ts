// Sign-in through Supabase ("CeFaci 2.0"): Google with the phone's own Google sheet, or a 6-digit code by email.
// No phone/SMS, no passwords; Apple waits for an Apple account. The publishable key is meant to live in the app.
import { Platform } from 'react-native';
import { createClient, type Session } from '@supabase/supabase-js';

const URL = 'https://vqrmwuarjjntusfbqprx.supabase.co';
const KEY = 'sb_publishable_DWl1cra4FE1Dxgc2hwtGrA_0LwP5B4O';
// The "Web client" ID from Google Cloud → Credentials (the same one set in Supabase → Auth → Google).
const GOOGLE_WEB_CLIENT_ID = '9736925899-jlhik3chso7l5176auj2u5lcce8i80iu.apps.googleusercontent.com';

// where supabase-js keeps the session on the phone (sb-<project>-auth-token)
const SESSION_KEY = 'sb-' + URL.replace(/^https?:\/\//, '').split('.')[0] + '-auth-token';
/** Whether the phone holds a session (an account it signed in with), read at once, without the network: offline
 *  the account still counts; a session the server refused is removed by supabase-js, and then this says no. */
export function hasStoredSession() { try { return !!globalThis.localStorage?.getItem(SESSION_KEY); } catch { return false; } }

let client: ReturnType<typeof createClient> | null = null;
export const sb = () => (client ??= createClient(URL, KEY, {
  auth: { storage: globalThis.localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}));

/** Google's own sign-in sheet on the phone; Google gives an ID token and Supabase turns it into a session. */
export async function signInWithGoogle(): Promise<string | null> {
  if (Platform.OS === 'web') return 'Google merge în aplicația de pe telefon. Aici intră cu emailul.';
  try {
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: ['email', 'profile'] });
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) return null; // closed the Google sheet: nothing to say
      const token = res.data.idToken;
      if (!token) return 'Google nu ne-a dat contul. Mai încearcă o dată.';
      const { error } = await sb().auth.signInWithIdToken({ provider: 'google', token });
      return error ? 'Nu am putut intra cu Google. Mai încearcă o dată. [' + error.message.slice(0, 80) + ']' : null;
    } catch (e) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Telefonul nu are Google Play. Intră cu emailul.';
      }
      const msg = String((e as { message?: string })?.message ?? e ?? '');
      if (/DEVELOPER_ERROR|10:|developer/i.test(msg)) return 'Google nu recunoaște aplicația (cheia de semnare sau clientul Android). Intră cu emailul până rezolvăm. [' + msg.slice(0, 80) + ']';
      return 'Nu am putut intra cu Google. [' + msg.slice(0, 80) + ']';
    }
  } catch {
    return 'Google nu e pornit în această versiune. Intră cu emailul.';
  }
}

/** Email sign-in with a 6-digit code. */
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

/** Calls back with the signed-in person, or null; now and on every change. */
export function watchAuth(cb: (who: Who | null) => void) {
  sb().auth.getSession().then(({ data }) => cb(whoOf(data.session))).catch(() => cb(null));
  const { data } = sb().auth.onAuthStateChange((_e, s) => cb(whoOf(s)));
  return () => data.subscription.unsubscribe();
}

/** Never wait forever on the network or on Google: after `ms`, go on. */
const within = <T,>(p: PromiseLike<T>, ms: number): Promise<T | 'timeout'> =>
  Promise.race([Promise.resolve(p), new Promise<'timeout'>((ok) => setTimeout(() => ok('timeout'), ms))]);

async function googleSignOut() {
  if (Platform.OS === 'web') return;
  try { const { GoogleSignin } = await import('@react-native-google-signin/google-signin'); await within(GoogleSignin.signOut(), 3000); } catch { /* not signed in with Google */ }
}

/** Signs out of the account and of Google (so the next sign-in asks which Google account). Always finishes,
 *  even offline: the session on the phone is dropped right away. */
export async function signOutEverywhere() {
  const r = await within(sb().auth.signOut(), 4000).catch(() => 'timeout' as const);
  if (r === 'timeout' || (r && typeof r === 'object' && 'error' in r && r.error)) await within(sb().auth.signOut({ scope: 'local' }), 2000).catch(() => null);
  await googleSignOut();
}

/** GDPR: removes the account and all it holds on the server, then signs out. Returns a message if the server
 *  did not confirm (offline, for example), so the phone is not wiped while the account still exists. */
export async function deleteAccountEverywhere(): Promise<string | null> {
  const fail = 'Nu am putut șterge contul acum. Verifică internetul și încearcă iar.';
  try {
    const { data } = await sb().auth.getSession();
    if (!data.session) return 'Intră în cont pentru a solicita ștergerea lui. Datele locale nu au fost șterse.';
    if (data.session) {
      const r = await within(sb().rpc('delete_my_account'), 15000);
      if (r === 'timeout') return fail;
      if (r.error) return r.error.message || fail;
      await within(sb().auth.signOut({ scope: 'local' }), 2000).catch(() => null);
    }
    await googleSignOut();
    return null;
  } catch {
    return fail;
  }
}
