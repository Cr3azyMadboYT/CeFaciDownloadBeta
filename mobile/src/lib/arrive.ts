// „Ai ajuns la X?” pe bilet și pe Acasă (docs/flux-intrare-bon.md, pasul 2). Cu locația deja permisă, întrebăm când
// telefonul e la cel mult 150 m de local (verificat la deschiderea ecranului și apoi la un minut, cât e pe ecran); cu
// locația oprită sau fără poziție, întrebăm oricum, în fereastra planului.
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ARRIVE_NEAR_M, askArrive, distTo, fixIfAllowed } from './entry';
import type { Plan } from './plans';

/** show = arătăm întrebarea; dist = cât de departe e telefonul (null = fără locație). */
export function useArrive(pl: Plan | undefined): { show: boolean; dist: number | null } {
  const [, setTick] = useState(0);
  const [dist, setDist] = useState<{ pid: number; m: number | null } | null>(null);
  const ask = !!pl && askArrive(pl);
  const pid = pl?.pid;
  useFocusEffect(useCallback(() => {
    if (pid === undefined) return;
    let live = true;
    const check = async () => {
      if (!pl || !askArrive(pl)) return;
      const fix = await fixIfAllowed();
      if (live) setDist({ pid: pl.pid, m: fix ? distTo(pl, fix) : null });
    };
    void check();
    // the window opens and closes on its own (30 minutes before, 3 hours after): a fresh look every minute
    const id = setInterval(() => { if (AppState.currentState === 'active') { setTick((x) => x + 1); void check(); } }, 60e3);
    return () => { live = false; clearInterval(id); };
  }, [pid, ask])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pl || !ask || !dist || dist.pid !== pl.pid) return { show: false, dist: null };
  return { show: dist.m === null || dist.m <= ARRIVE_NEAR_M, dist: dist.m };
}
