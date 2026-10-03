import { DCLogic, mount, parseTemplate, type Board } from './dc/runtime';
import * as ContView from './boards/Cont.view.js';
import * as DemoView from './boards/Demo.view.js';
import { make as makeCont } from './boards/Cont.logic.js';
import { make as makeDemo } from './boards/Demo.logic.js';
import { APP, initBridge } from './app/bridge';
import { cloudClient, emailStart, emailVerify, signInWithGoogle, watchAuth } from './app/auth';
import { createAccount, makeUploader, restore } from './app/cloud';
import './app/fonts.css';
import './app/shell.css';

const W = 390, H = 844;
const boards: Record<string, { view: { TPL: string; CSS: string; FONTS: string }; make: (D: typeof DCLogic) => new (p: Record<string, unknown>) => DCLogic }> = {
  Cont: { view: ContView, make: makeCont as never },
  Demo: { view: DemoView, make: makeDemo as never },
};
const compiled: Record<string, Board> = {};
function board(name: string): Board {
  if (!compiled[name]) {
    const b = boards[name];
    const Comp = b.make(DCLogic);
    compiled[name] = { name, css: b.view.CSS, tpl: parseTemplate(b.view.TPL), make: (p) => new Comp(p) };
  }
  return compiled[name];
}

// fonts ship inside the app (src/app/fonts.css): no Google Fonts request, same look offline
const style = document.createElement('style');
document.head.appendChild(style);
const stage = document.getElementById('root')!;
stage.className = 'stage';
const host = document.createElement('div');
host.className = 'phone';
stage.appendChild(host);

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H, 1.25);
  host.style.transform = `scale(${s})`;
  host.style.left = Math.max(0, (window.innerWidth - W * s) / 2) + 'px';
  host.style.top = Math.max(0, (window.innerHeight - H * s) / 2) + 'px';
}
window.addEventListener('resize', fit);
fit();

let current: { unmount: () => void; comp: DCLogic } | null = null;
let currentName = '';
const onboarded = () => { try { return localStorage.getItem('cefaci.onboarded') === '1'; } catch { return false; } };
function show(name: string) {
  if (currentName === 'Cont' && name === 'Demo' && current) {
    const st = current.comp.state as Record<string, any>;
    const votes = [...APP.pickVotes];
    APP.savePrefs({
      zone: st.zoneId || 'centru', likes: st.likes || [], dist: st.dist || '20', name: String(st.first || '').trim(), user: String(st.user || '').trim(),
      birth: st.birthIso || undefined, budget: st.budget, who: st.who, when: st.when, mood: st.mood, moves: st.moves,
      liked: votes.filter(([, v]) => v === 'yes').map(([id]) => id), disliked: votes.filter(([, v]) => v === 'no').map(([id]) => id),
    });
    // signed in and new: the account is created now, with everything answered during sign-up
    if (signedIn && !accountKnown && st.birthIso) {
      const { name: _n, user: _u, birth: _b, google: _g, here: _h, ...answers } = APP.prefs;
      createAccount(cloudClient(), { username: String(st.user || ''), first: String(st.first || '').trim(), birth: st.birthIso, prefs: answers })
        .then((err) => { accountKnown = !err; if (err) (current?.comp as unknown as { toast?: (t: string) => void })?.toast?.(err); });
    }
  }
  current?.unmount();
  currentName = name;
  if (name === 'Demo') { try { localStorage.setItem('cefaci.onboarded', '1'); } catch { /* storage blocked */ } }
  const b = board(name);
  style.textContent = b.css;
  current = mount(b, host, { theme: 'zi' }, { navigate: show });
  if (name === 'Demo') {
    // bring back what was saved, then save after every change (a little later, so a burst of changes writes once)
    const comp = current.comp as DCLogic & { pid?: number };
    const saved = APP.loadBoardState();
    if (Object.keys(saved).length) {
      comp.setState(saved);
      comp.pid = Math.max(0, ...((saved.plans as { pid?: number }[] | undefined) ?? []).map((p) => p.pid ?? 0));
    }
    const set = comp.setState.bind(comp);
    let t: ReturnType<typeof setTimeout> | undefined;
    comp.setState = (p: unknown) => { set(p); clearTimeout(t); t = setTimeout(() => APP.saveBoardState(comp.state as Record<string, unknown>), 300); };
  }
}
initBridge({ restart: () => { try { localStorage.clear(); } catch { /* */ } show('Cont'); }, google: signInWithGoogle, emailStart, emailVerify });
show(onboarded() ? 'Demo' : 'Cont');
// After signing in (Google or email): an existing account comes back whole (reinstalling loses nothing);
// a new one continues the sign-up with the first name filled in. From then on changes go to Supabase.
let signedIn = false;
let accountKnown = false;
watchAuth((who) => {
  if (!who) { signedIn = false; APP.onSaved = () => {}; return; }
  if (signedIn) return;
  signedIn = true;
  const upload = makeUploader(cloudClient(), who.id);
  restore(cloudClient(), who.id).then((r) => {
    accountKnown = r.known;
    APP.prefs = { ...APP.prefs, ...JSON.parse(localStorage.getItem('cefaci.prefs') || '{}'), google: who.id };
    APP.rebuild();
    APP.onSaved = (state) => { if (accountKnown) upload(state, APP.prefs as unknown as Record<string, unknown>); };
    if (r.known) { if (currentName === 'Cont') show('Demo'); return; }
    if (currentName === 'Cont' && current) {
      const st = current.comp.state as Record<string, any>;
      if (st.step === 'start' || st.step === 'phone') current.comp.setState({ step: 'name', first: st.first || who.first });
    }
  }).catch(() => { /* offline: keep going on the phone */ });
});
