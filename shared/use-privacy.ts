import {useCallback, useEffect, useRef, useState} from 'react';
import type {PrivacyKind, PrivacyRequest, PrivacyScope, PrivacyExport} from './privacy';

export type PrivacyRpc = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
type State = {identity: string; requests: PrivacyRequest[]; loaded: boolean; hasMore: boolean; historyBusy: boolean; offset: number; historyError: string; error: string; message: string; busy: boolean};
const fresh = (identity: string): State => ({identity, requests: [], loaded: false, hasMore: false, historyBusy: false, offset: 0, historyError: '', error: '', message: '', busy: false});

/** Personal data is discarded immediately on a new Auth session, including a same-user sign-in. */
export function usePrivacy(identity: string, scope: PrivacyScope, call: PrivacyRpc) {
  const [state, set] = useState<State>(() => fresh(identity));
  const current = useRef(identity); current.current = identity;
  const generation = useRef(0), sequence = useRef(0), locked = useRef(false), historyLock = useRef(false), active = useRef(false);
  const load = useCallback(async () => {
    if (!identity) return;
    const key = identity, epoch = generation.current, n = ++sequence.current;
    const valid = () => active.current && current.current === key && generation.current === epoch && sequence.current === n;
    try {
      const requests = await call<PrivacyRequest[]>('privacy_my_requests', {p_scope: scope, p_limit: 100, p_offset: 0});
      if (valid()) {historyLock.current = false; set(s => ({...s, requests: requests ?? [], loaded: true, hasMore: requests?.length === 100, historyBusy: false, offset: 0, historyError: ''}));}
    } catch (e) {if (valid()) {historyLock.current = false; set(s => ({...s, historyBusy: false, historyError: e instanceof Error ? e.message : 'Istoricul nu poate fi încărcat. Reîncearcă online.'}));}}
  }, [identity, scope, call]);
  useEffect(() => {
    active.current = true; generation.current++; locked.current = false; historyLock.current = false; set(fresh(identity));
    void load();
    return () => {active.current = false; generation.current++; sequence.current++;};
  }, [identity, scope, load]);
  const loadMore = async () => {
    if (!identity || !state.hasMore || historyLock.current) return;
    const key = identity, epoch = generation.current, n = ++sequence.current, offset = state.offset + 100;
    const valid = () => active.current && current.current === key && generation.current === epoch && sequence.current === n;
    historyLock.current = true; set(s => ({...s, historyBusy: true, historyError: ''}));
    try {
      const rows = await call<PrivacyRequest[]>('privacy_my_requests', {p_scope: scope, p_limit: 100, p_offset: offset});
      if (valid()) set(s => ({...s, requests: [...s.requests, ...(rows ?? []).filter(r => !s.requests.some(previous => previous.id === r.id))], hasMore: rows?.length === 100, offset}));
    } catch (e) {if (valid()) set(s => ({...s, historyError: e instanceof Error ? e.message : 'Pagina nu poate fi încărcată.'}));}
    finally {if (valid()) {historyLock.current = false; set(s => ({...s, historyBusy: false}));}}
  };
  const run = async (work: (valid: () => boolean) => Promise<void>) => {
    if (!identity || locked.current) return;
    const key = identity, epoch = generation.current;
    const valid = () => active.current && current.current === key && generation.current === epoch;
    locked.current = true; set(s => ({...s, busy: true, error: '', message: ''}));
    try {await work(valid);} catch (e) {if (valid()) set(s => ({...s, error: e instanceof Error ? e.message : 'Cererea nu a fost confirmată. Reîncearcă online.'}));}
    finally {if (valid()) {locked.current = false; set(s => ({...s, busy: false}));}}
  };
  const submit = (kind: PrivacyKind, description: string, requestKey: string, done: () => void) => run(async valid => {
    const row = await call<PrivacyRequest>('privacy_request_submit', {p_scope: scope, p_kind: kind, p_description: description.trim(), p_request_key: requestKey});
    if (!valid()) return;
    if (!row?.id) throw new Error('Serverul nu a confirmat cererea. Reîncearcă.');
    done(); set(s => ({...s, message: 'Cererea a fost primită. Starea și răspunsul echipei apar mai jos.'}));
    await load();
  });
  const exportData = (save: (value: PrivacyExport, valid: () => boolean) => Promise<boolean>) => run(async valid => {
    const value = await call<PrivacyExport>('privacy_export_my_data');
    if (!valid()) return;
    if (value?.format !== 'cefaci-personal-core-v1') throw new Error('Exportul primit nu are formatul așteptat.');
    const saved = await save(value, valid);
    if (valid() && saved) set(s => ({...s, message: 'Exportul datelor de bază a fost pregătit pentru salvare.'}));
  });
  return {...(state.identity === identity ? state : fresh(identity)), load, loadMore, submit, exportData};
}
