// The first-time tour with Bilu (from the design's Demo): it points at the parts of Acasă and the tabs,
// asks you to tap Profil and Plus yourself, and ends with Bilu's gift (the free Plus week).
// Screens mark what can be pointed at with <TourTarget id=…>; their place on screen is kept here.
import { useSyncExternalStore } from 'react';
import { getApp, setBoard } from './session';

export interface Rect { x: number; y: number; w: number; h: number }
type S = { on: boolean; step: number; replay: boolean; oops: number; rects: Record<string, Rect> };
let s: S = { on: false, step: 0, replay: false, oops: 0, rects: {} };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useTour = () => useSyncExternalStore(subscribe, () => s, () => s);

export function setRect(id: string, r: Rect) {
  const o = s.rects[id];
  if (o && o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h) return;
  s = { ...s, rects: { ...s.rects, [id]: r } };
  if (s.on) emit();
}
/** Starts the tour once for a new account (or again, from Profil). */
export function startTour(replay = false) { s = { ...s, on: true, step: 0, replay, oops: 0 }; emit(); }
export const shouldStartTour = () => { const t = getApp().board.tut as { done?: boolean } | undefined; return getApp().onboarded && !t?.done && !s.on; };
export function tourNext() { s = { ...s, step: s.step + 1, oops: 0 }; emit(); }
export function tourOops() { s = { ...s, oops: s.oops + 1 }; emit(); }
export function endTour() {
  s = { ...s, on: false, step: 0, oops: 0 };
  setBoard({ tut: { on: false, step: 0, done: true } as never });
  emit();
}
