// The app's memory: who is signed in, the sign-up answers (APP.prefs, shared with the engine) and what the main
// screens keep between launches (plans, XP, theme, the tour, the Plus week). Saved on the phone and, with an
// account, in Supabase (src/app/cloud.ts), so reinstalling loses nothing.
import { useSyncExternalStore } from 'react';
import * as Location from 'expo-location';
import { APP, initBridge, type Prefs } from '../../../src/app/bridge';
import { createAccount, makeUploader, restore } from '../../../src/app/cloud';
import { km, nearestZone } from '../../../src/engine/core';
import { deleteAccountEverywhere, emailStart, emailVerify, sb, signInWithGoogle, watchAuth, type Who } from './auth';

export { APP };
export type { Prefs };

// ---------- a tiny store ----------
export interface Board {
  theme?: 'zi' | 'noapte';
  plans?: Plan[];
  xp?: number;
  welcomeXp?: boolean;
  stamps?: unknown[];
  tut?: { on: boolean; step: number };
  plus?: 'off' | 'trial' | 'on';
  plusDay?: number;
  plusModal?: string;
  removed?: string[];
  ended?: unknown[];
  billXp?: number;
  [k: string]: unknown;
}
export interface Plan { pid: number; id: string; name: string; when: string; who: string; at: number; status?: 'active' | 'done' | 'cancelled'; res?: string }

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
export function savePrefs(p: Partial<Prefs>) {
  APP.savePrefs(p);
  snap = { ...snap, prefs: { ...APP.prefs } };
  emit();
}

// ---------- sign-up ----------
export interface SignupAnswers {
  first: string; user: string; birthIso: string; zoneId: string; dist: string; moves: string[]; likes: string[];
  budget: string; who: string; when: string[]; mood: string; votes: [string | undefined, string][];
}
/** End of the sign-up: keep the answers, then, if signed in with a new account, create it on the server. */
export async function finishSignup(a: SignupAnswers): Promise<string | null> {
  const liked = a.votes.filter(([id, v]) => id && v === 'yes').map(([id]) => id!);
  const disliked = a.votes.filter(([id, v]) => id && v === 'no').map(([id]) => id!);
  savePrefs({ zone: a.zoneId, likes: a.likes, dist: a.dist, moves: a.moves, name: a.first.trim(), user: a.user, birth: a.birthIso, budget: a.budget, who: a.who, when: a.when, mood: a.mood, liked, disliked });
  try { localStorage.setItem('cefaci.onboarded', '1'); } catch { /* storage blocked */ }
  let err: string | null = null;
  if (snap.who && !snap.known) {
    const { name, user, birth, google, here, ...answers } = APP.prefs as unknown as Record<string, unknown>;
    void name; void user; void birth; void google; void here;
    err = await createAccount(sb(), { username: a.user, first: a.first.trim(), birth: a.birthIso, prefs: answers });
    if (!err) snap = { ...snap, known: true };
  }
  if (!snap.board.welcomeXp) setBoard((b) => ({ welcomeXp: true, xp: (b.xp ?? 0) + 150 })); // Bilu's welcome, once
  snap = { ...snap, onboarded: true };
  emit();
  return err;
}

/** Wipes the phone (and the account, when asked) and starts again from the first screen. */
export async function startOver(deleteAccount: boolean) {
  if (deleteAccount) await deleteAccountEverywhere(); else await sb().auth.signOut().catch(() => null);
  try { localStorage.clear(); } catch { /* storage blocked */ }
  APP.prefs = { zone: 'centru', likes: [], dist: '20' };
  APP.rebuild();
  snap = { board: {}, prefs: APP.prefs, who: null, onboarded: false, known: false };
  emit();
}

// ---------- the bridge's phone-only parts ----------
async function useHere(): Promise<string | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return 'N-am primit locația. Poți s-o permiți din setări sau alegi zona din listă.';
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
let signedIn = false;
const signInListeners = new Set<(who: Who, known: boolean) => void>();
/** The sign-up screen hears here when Google or the email code worked (and whether the account already exists). */
export const onSignedIn = (f: (who: Who, known: boolean) => void) => { signInListeners.add(f); return () => { signInListeners.delete(f); }; };

watchAuth((who) => {
  if (!who) { signedIn = false; APP.onSaved = () => {}; snap = { ...snap, who: null, known: false }; emit(); return; }
  if (signedIn) return;
  signedIn = true;
  snap = { ...snap, who };
  emit();
  const upload = makeUploader(sb(), who.id);
  restore(sb(), who.id).then((r) => {
    APP.prefs = { ...APP.prefs, ...JSON.parse(localStorage.getItem('cefaci.prefs') || '{}'), google: who.id };
    APP.rebuild();
    APP.onSaved = (state) => { if (snap.known) upload(state, APP.prefs as unknown as Record<string, unknown>); };
    snap = { ...snap, known: r.known, prefs: { ...APP.prefs }, board: r.known ? (APP.loadBoardState() as Board) : snap.board, onboarded: r.known || snap.onboarded };
    emit();
    signInListeners.forEach((f) => f(who, r.known));
  }).catch(() => { signInListeners.forEach((f) => f(who, false)); });
});
