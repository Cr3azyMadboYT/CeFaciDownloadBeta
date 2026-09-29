import { DCLogic, mount, parseTemplate, type Board } from './dc/runtime';
import * as ContView from './boards/Cont.view.js';
import * as DemoView from './boards/Demo.view.js';
import { make as makeCont } from './boards/Cont.logic.js';
import { make as makeDemo } from './boards/Demo.logic.js';
import { APP, initBridge } from './app/bridge';
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

const fonts = document.createElement('link');
fonts.rel = 'stylesheet'; fonts.href = DemoView.FONTS;
document.head.appendChild(fonts);
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
    APP.savePrefs({ zone: st.zoneId || 'centru', likes: st.likes || [], dist: st.dist || '20', name: String(st.first || '').trim(), user: String(st.user || '').trim() });
  }
  current?.unmount();
  currentName = name;
  if (name === 'Demo') { try { localStorage.setItem('cefaci.onboarded', '1'); } catch { /* storage blocked */ } }
  const b = board(name);
  style.textContent = b.css;
  current = mount(b, host, { theme: 'zi' }, { navigate: show });
}
initBridge({ restart: () => { try { localStorage.clear(); } catch { /* */ } show('Cont'); } });
show(onboarded() ? 'Demo' : 'Cont');
