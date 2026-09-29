import { useEffect, useState } from 'react';
import type { Prefs, When, Who } from '../engine/types';

export interface Plan { id: string; venueId: string; when: When; who: Who; at: number; }
export interface Saved { prefs: Prefs | null; plans: Plan[]; history: string[]; }

const KEY = 'cefaci.v1';
const empty: Saved = { prefs: null, plans: [], history: [] };

function load(): Saved {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...empty, ...JSON.parse(raw) }; } catch { /* storage blocked: start fresh */ }
  return empty;
}

/** App state that should survive a reload. Storage may be unavailable; the app works without it. */
export function useSaved() {
  const [s, set] = useState<Saved>(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);
  return [s, set] as const;
}
