// The app's memory: who is signed in, the sign-up answers (APP.prefs, shared with the engine) and what the main
// screens keep between launches (plans, XP, theme, the tour, the Plus week). Saved on the phone and, with an
// account, in Supabase (src/app/cloud.ts), so reinstalling loses nothing.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { APP, initBridge, type Prefs } from '../../../src/app/bridge';
import { createAccount, makeUploader, restore } from '../../../src/app/cloud';
import { km, nearestZone } from '../../../src/engine/core';
import { resetFilters, setSearch } from './filters';
import { forgetPush, registerPush } from './push';
import { loadWeather } from './weather';
import { deleteAccountEverywhere, emailStart, emailVerify, sb, signInWithGoogle, signOutEverywhere, watchAuth, type Who } from './auth';

export { APP };
export type { Prefs };

// ---------- a tiny store ----------
export interface Board {
  theme?: 'zi' | 'noapte' | 'auto';
  calm?: boolean;      // fewer animations (Setări)
  billRemind?: boolean; // false = no receipt reminders (Setări)
  plans?: unknown[];
  xp?: number;
  welcomeXp?: boolean;
  stamps?: unknown[];
  tut?: { on: boolean; step: number };
  plus?: 'locked' | 'off' | 'trial' | 'active';
  plusDay?: number;
  plusModal?: string;
  removed?: string[];
  ended?: unknown[];
  billXp?: number;
  [k: string]: unknown;
}

type Snap = { board: Board; prefs: Prefs; who: Who | null; onboarded: boolean; known: boolean };
let snap: Snap = {
  board: APP.loadBoardState() as Board,
  prefs: APP.prefs,
  who: null,
  onboarded: readOnboarded(),
  known: false,
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useApp = <S,>(pick: (s: Snap) => S): S => useSyncExternalStore(subscribe, () => pick(snap), () => pick(snap));
export const getApp = () => snap;

function readOnboarded() { try { return localStorage.getItem('cefaci.onboarded') === '1'; } catch { return false; } }

let saveT: ReturnType<typeof setTimeout> | undefined;
export function setBoard(patch: Partial<Board> | ((b: Board) => Partial<Board>)) {
  const p = typeof patch === 'function' ? patch(snap.board) : patch;
  snap = { ...snap, board: { ...snap.board, ...p } };
  emit();
  clearTimeout(saveT);
  saveT = setTimeout(() => APP.saveBoardState(snap.board as Record<string, unknown>), 300);
}
// XP lives on the server (xp_log → profiles.xp): with an account, the phone shows the server's number
async function pullXp(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb() as any).from('profiles').select('xp').eq('id', id).maybeSingle();
  if (data && typeof data.xp === 'number' && data.xp !== snap.board.xp) setBoard({ xp: data.xp });
}
export function savePrefs(p: Partial<Prefs>) {
  APP.savePrefs({ ...p, prefsAt: Date.now() } as Partial<Prefs>); // the newer copy (phone or account) wins on restore
  snap = { ...snap, prefs: { ...APP.prefs } };
  emit();
  APP.saveBoardState(snap.board as Record<string, unknown>); // sends the answers to the account too
}

// ---------- sign-up ----------
export interface SignupAnswers {
  first: string; user: string; birthIso: string; zoneId: string; dist: string; moves: string[]; likes: string[];
  budget: string; who: string; when: string[]; mood: string; votes: [string | undefined, string][];
}
const DEFAULT_PREFS: Prefs = { zone: 'centru', likes: [], dist: '20', moves: ['walk', 'car'] };
const answersOf = () => {
  const { name, user, birth, google, here, ...answers } = APP.prefs as unknown as Record<string, unknown>;
  void name; void user; void birth; void google; void here;
  return answers;
};

/** Is this username still free on the server? (Only asked when signed in; null = could not ask.) */
export async function usernameFree(u: string): Promise<boolean | null> {
  if (!snap.who) return null;
  const { data, error } = await sb().rpc('username_available', { p_username: u } as never);
  return error ? null : !!data;
}

/** End of the sign-up: keep the answers, then, if signed in with a new account, create it on the server.
 *  The app counts as set up only when that worked (or when there is no account). */
export async function finishSignup(a: SignupAnswers): Promise<string | null> {
  const liked = a.votes.filter(([id, v]) => id && v === 'yes').map(([id]) => id!);
  const disliked = a.votes.filter(([id, v]) => id && v === 'no').map(([id]) => id!);
  savePrefs({ zone: a.zoneId, likes: a.likes, dist: a.dist, moves: a.moves, name: a.first.trim(), user: a.user, birth: a.birthIso, budget: a.budget, who: a.who, when: a.when, mood: a.mood, liked, disliked });
  if (snap.who && !snap.known) {
    const err = await createAccount(sb(), { username: a.user, first: a.first.trim(), birth: a.birthIso, prefs: answersOf() });
    if (err) return err;
    snap = { ...snap, known: true };
    void registerPush();
  }
  try { localStorage.setItem('cefaci.onboarded', '1'); } catch { /* storage blocked */ }
  if (!snap.board.welcomeXp) {
    // Bilu's welcome, once: on the server with an account (it says the total), else on the phone
    setBoard((b) => ({ welcomeXp: true, xp: (b.xp ?? 0) + 150 }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (snap.known) void (sb() as any).rpc('xp_welcome').then((r: { data?: number }) => { if (typeof r.data === 'number') setBoard({ xp: r.data }); });
  }
  snap = { ...snap, onboarded: true };
  resetFilters();
  emit();
  return null;
}

/** Signs out (and deletes the account, when asked), wipes the phone and starts again from the first screen.
 *  Deleting stops with a message if the server did not confirm, so nothing is left behind by mistake. */
export async function startOver(deleteAccount: boolean): Promise<string | null> {
  if (deleteAccount) { const err = await deleteAccountEverywhere(); if (err) return err; }
  else { await Promise.race([forgetPush(), new Promise((ok) => setTimeout(ok, 3000))]); await signOutEverywhere(); }
  try { localStorage.clear(); } catch { /* storage blocked */ }
  APP.prefs = { ...DEFAULT_PREFS };
  APP.pickVotes.clear(); APP.pickMemo.clear();
  APP.rebuild();
  last = null; signedIn = '';
  snap = { board: {}, prefs: APP.prefs, who: null, onboarded: false, known: false };
  setSearch('');
  resetFilters();
  emit();
  return null;
}

// ---------- the bridge's phone-only parts ----------
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
async function useHere(): Promise<string | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return 'N-am primit locația. Poți s-o permiți din setări sau alegi zona din listă.';
    const p = await within(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 12000)
      .catch(() => Location.getLastKnownPositionAsync({ maxAge: 30 * 60e3 }));
    if (!p) return 'Telefonul nu ne dă locația acum. Încearcă afară sau alege zona din listă.';
    const here = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() };
    const z = nearestZone(here);
    if (km(here, z) > 40) return 'Ești în afara Bucureștiului și Ilfovului. Alege zona din listă.';
    savePrefs({ here, zone: z.id });
    return null;
  } catch {
    return 'Telefonul nu ne dă locația. Alege zona din listă.';
  }
}
initBridge({
  google: signInWithGoogle, emailStart, emailVerify, useHere,
  deleteAccount: () => startOver(true),
  restart: () => { void startOver(false); },
});

// ---------- signing in ----------
// After Google or the email code: an existing account comes back whole; a new one is created at the end of sign-up,
// or right away when the person already set the app up without an account (their phone data becomes the account).
let signedIn = '';
let last: { who: Who; known: boolean } | null = null;
const signInListeners = new Set<(who: Who, known: boolean) => void>();
/** The sign-up screen hears here when Google or the email code worked (and whether the account already exists).
 *  A screen that subscribes later still hears about a sign-in that already happened. */
export const onSignedIn = (f: (who: Who, known: boolean) => void) => {
  signInListeners.add(f);
  if (last) { const l = last; setTimeout(() => { if (signInListeners.has(f)) f(l.who, l.known); }, 0); }
  return () => { signInListeners.delete(f); };
};
/** The sign-in that already finished, if any (signing in again with the same account changes nothing). */
export const lastSignIn = () => last;
let netErr = '';
const netListeners = new Set<(e: string) => void>();
/** A message to show while the account can't be reached (offline right after signing in). */
export const onSyncTrouble = (f: (e: string) => void) => { netListeners.add(f); f(netErr); return () => { netListeners.delete(f); }; };
const trouble = (e: string) => { netErr = e; netListeners.forEach((f) => f(e)); };

/** When someone without an account signs in, their phone profile becomes the account (same @username if free). */
async function adoptPhoneProfile(): Promise<boolean> {
  const p = APP.prefs;
  if (!p.user || !p.name || !p.birth) return false;
  for (const u of [p.user, p.user + Math.floor(10 + Math.random() * 89), p.user + '_cf' + Math.floor(Math.random() * 9)]) {
    const err = await createAccount(sb(), { username: u.slice(0, 20), first: p.name, birth: p.birth, prefs: answersOf() });
    if (!err) { if (u !== p.user) savePrefs({ user: u.slice(0, 20) }); return true; }
    if (!/luat/.test(err)) return false;
  }
  return false;
}

let retry: ReturnType<typeof setTimeout> | undefined;
async function connect(who: Who) {
  clearTimeout(retry);
  try {
    const r = await restore(sb(), who.id);
    if (signedIn !== who.id) return;
    const upload = makeUploader(sb(), who.id);
    APP.prefs = { ...APP.prefs, ...JSON.parse(localStorage.getItem('cefaci.prefs') || '{}'), google: who.id };
    APP.rebuild();
    APP.onSaved = (state) => { if (snap.known) upload(state, APP.prefs as unknown as Record<string, unknown>); };
    let known = r.known;
    if (!known && snap.onboarded) known = await adoptPhoneProfile();
    snap = { ...snap, known, prefs: { ...APP.prefs }, board: r.known ? (APP.loadBoardState() as Board) : snap.board, onboarded: r.known || snap.onboarded };
    emit();
    if (r.known) resetFilters();
    if (known && !r.known) APP.saveBoardState(snap.board as Record<string, unknown>); // first upload of the phone's data
    trouble('');
    if (known) { void pullXp(who.id); void registerPush(); void loadWeather(true); }
    last = { who, known };
    signInListeners.forEach((f) => f(who, known));
  } catch {
    // offline right after signing in: try again in a bit and whenever the app comes back to the front
    trouble('Nu ajung la contul tău acum. Verifică internetul, reîncerc singur.');
    retry = setTimeout(() => { if (signedIn === who.id) void connect(who); }, 10000);
  }
}
AppState.addEventListener('change', (st) => { if (st === 'active' && signedIn && !last && snap.who) void connect(snap.who); });

watchAuth((who) => {
  if (!who) { signedIn = ''; last = null; APP.onSaved = () => {}; snap = { ...snap, who: null, known: false }; emit(); return; }
  if (signedIn === who.id) return;
  signedIn = who.id;
  last = null;
  snap = { ...snap, who };
  emit();
  void connect(who);
});
