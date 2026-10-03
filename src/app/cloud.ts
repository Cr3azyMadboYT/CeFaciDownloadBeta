// Keeps the phone and Supabase in step, once someone signs in (Google or email):
// - after sign-in, an existing account brings back its profile, answers and saved state (reinstalling loses nothing);
// - a new account is created at the end of sign-up (username, first name, birth date, answers);
// - every later change to the answers or the saved state is sent back, a few seconds after it happens.
// Without an account, everything stays on the phone only.

export interface CloudClient {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: unknown }>;
}

const PKEY = 'cefaci.prefs';
const SKEY = 'cefaci.state';
const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

export interface Restored { known: boolean; first?: string }

/** After sign-in: if the account already exists, copy it onto the phone (the newer saved state wins). */
export async function restore(db: CloudClient, userId: string): Promise<Restored> {
  const { data: prof } = await db.from('profiles').select('username, first_name').eq('id', userId).maybeSingle();
  if (!prof) return { known: false };
  const { data: priv } = await db.from('profile_private').select('birth_date, prefs, app_state, plus_trial_started_at').eq('id', userId).maybeSingle();
  const prefs = { ...read(PKEY), ...(priv?.prefs ?? {}), name: prof.first_name, user: prof.username, birth: priv?.birth_date ?? undefined, google: userId };
  write(PKEY, prefs);
  const local = read(SKEY);
  const remote = priv?.app_state ?? {};
  const state = (remote.savedAt ?? 0) > (local.savedAt ?? 0) ? { ...local, ...remote } : local;
  if (priv?.plus_trial_started_at) state.plusStart = Date.parse(priv.plus_trial_started_at);
  write(SKEY, state);
  try { localStorage.setItem('cefaci.onboarded', '1'); } catch { /* storage blocked */ }
  return { known: true, first: prof.first_name };
}

/** End of sign-up with an account: create the profile. Returns an error to show, or null. */
export async function createAccount(db: CloudClient, p: { username: string; first: string; birth: string; prefs: Record<string, unknown> }): Promise<string | null> {
  const { error } = await db.rpc('complete_signup', { p_username: p.username, p_first_name: p.first, p_birth_date: p.birth, p_prefs: p.prefs });
  if (!error) return null;
  const msg = String((error as { message?: string }).message ?? '');
  if (/duplicate|unique/i.test(msg)) return 'Username-ul a fost luat între timp. Alege altul.';
  return msg || 'Nu am putut salva contul. Încearcă din nou.';
}

/** Sends the answers and the saved state, at most every few seconds. */
export function makeUploader(db: CloudClient, userId: string, wait = 3000) {
  let t: ReturnType<typeof setTimeout> | undefined;
  let trialAsked = false;
  let lastSent = '';
  let pending: { app_state: unknown; prefs: unknown; body: string } | undefined;
  return (state: Record<string, unknown>, prefs: Record<string, unknown>) => {
    if (state.plus === 'trial' && !trialAsked) {
      trialAsked = true; // the server keeps the first start date; the phone takes it from there
      db.rpc('start_plus_trial').then(({ data }) => {
        if (!data) return;
        const s = read(SKEY); s.plusStart = Date.parse(data); write(SKEY, s);
      });
    }
    const { name, user, birth, google, here, ...answers } = prefs; // these live elsewhere or stay on the phone
    void name; void user; void birth; void google; void here;
    const { savedAt, ...rest } = state;
    void savedAt;
    const body = JSON.stringify([rest, answers]);
    if (body === lastSent) return; // the clock ticks every second; only real changes go out
    pending = { app_state: state, prefs: answers, body };
    if (t) return; // at most one upload every few seconds
    t = setTimeout(() => {
      t = undefined;
      const p = pending!; pending = undefined; lastSent = p.body;
      db.from('profile_private').update({ app_state: p.app_state, prefs: p.prefs }).eq('id', userId).then(() => {}, () => { lastSent = ''; });
    }, wait);
  };
}
