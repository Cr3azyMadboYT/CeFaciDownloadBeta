// A small runtime for the CeFaci design boards (.dc.html): {{holes}}, <sc-if>, <sc-for>, on* events,
// and a DCLogic base class. It lets the app run the exact screens from the design canvas.
import { Fragment, h, render, type VNode } from 'preact';

type Scope = Record<string, unknown>;
type TNode =
  | { t: 'text'; parts: (string | { hole: string })[] }
  | { t: 'el'; tag: string; attrs: [string, (string | { hole: string })[]][]; kids: TNode[]; svg: boolean }
  | { t: 'if'; val: string; kids: TNode[] }
  | { t: 'for'; list: string; as: string; kids: TNode[] };

const HOLE = /\{\{\s*([^}]*?)\s*\}\}/g;
function split(s: string): (string | { hole: string })[] {
  const out: (string | { hole: string })[] = [];
  let last = 0; let m: RegExpExecArray | null;
  HOLE.lastIndex = 0;
  while ((m = HOLE.exec(s))) { if (m.index > last) out.push(s.slice(last, m.index)); out.push({ hole: m[1] }); last = m.index + m[0].length; }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
const holeOf = (s: string | null) => (s ? (s.match(/\{\{\s*([^}]*?)\s*\}\}/) || [])[1] ?? s : '');

function compile(n: Node): TNode | null {
  if (n.nodeType === 3) { const s = n.nodeValue ?? ''; return /\S/.test(s) ? { t: 'text', parts: split(s) } : { t: 'text', parts: [' '] }; }
  if (n.nodeType !== 1) return null;
  const el = n as Element;
  const tag = el.localName;
  const kids = Array.from(el.childNodes).map(compile).filter((x): x is TNode => !!x);
  if (tag === 'sc-if') return { t: 'if', val: holeOf(el.getAttribute('value')), kids };
  if (tag === 'sc-for') return { t: 'for', list: holeOf(el.getAttribute('list')), as: el.getAttribute('as') ?? 'item', kids };
  const attrs = Array.from(el.attributes).filter((a) => !a.name.startsWith('hint-placeholder')).map((a) => [a.name, split(a.value)] as [string, (string | { hole: string })[]]);
  return { t: 'el', tag, attrs, kids, svg: el.namespaceURI === 'http://www.w3.org/2000/svg' };
}

export function parseTemplate(html: string): TNode[] {
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + html + '</body>', 'text/html');
  return Array.from(doc.body.childNodes).map(compile).filter((x): x is TNode => !!x);
}

function look(vals: Scope, scope: Scope, path: string): unknown {
  if (path === 'true') return true; if (path === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  const [head, ...rest] = path.split('.');
  let cur: unknown = head in scope ? scope[head] : vals[head];
  for (const k of rest) { if (cur == null) return undefined; cur = (cur as Record<string, unknown>)[k]; }
  return cur;
}
const BOOL = new Set(['disabled', 'checked', 'hidden', 'readonly', 'selected', 'required', 'open', 'autofocus', 'multiple']);
const EVENTS: Record<string, string> = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', onkeydown: 'onKeyDown', onsubmit: 'onSubmit' };

export interface Env { navigate: (board: string) => void; }

function build(nodes: TNode[], vals: Scope, scope: Scope, env: Env, out: (VNode | string)[]) {
  for (const n of nodes) {
    if (n.t === 'text') { out.push(n.parts.map((p) => (typeof p === 'string' ? p : String(look(vals, scope, p.hole) ?? ''))).join('')); continue; }
    if (n.t === 'if') { if (look(vals, scope, n.val)) build(n.kids, vals, scope, env, out); continue; }
    if (n.t === 'for') {
      const list = look(vals, scope, n.list);
      if (Array.isArray(list)) list.forEach((item, i) => { const kids: (VNode | string)[] = []; build(n.kids, vals, { ...scope, [n.as]: item }, env, kids); out.push(h(Fragment, { key: i }, kids)); });
      continue;
    }
    const props: Record<string, unknown> = {};
    for (const [name, parts] of n.attrs) {
      const low = name.toLowerCase();
      const whole = parts.length === 1 && typeof parts[0] !== 'string' ? look(vals, scope, (parts[0] as { hole: string }).hole) : undefined;
      const str = () => parts.map((p) => (typeof p === 'string' ? p : String(look(vals, scope, p.hole) ?? ''))).join('');
      if (EVENTS[low]) {
        if (typeof whole !== 'function') continue;
        const isText = n.tag === 'input' || n.tag === 'textarea';
        props[low === 'onchange' && isText ? 'onInput' : EVENTS[low]] = whole;
        continue;
      }
      if (BOOL.has(low)) { const v = parts.length === 1 && typeof parts[0] !== 'string' ? whole : str(); if (v && v !== 'false') props[low] = true; continue; }
      if (low === 'value' && (n.tag === 'input' || n.tag === 'textarea')) { props.value = whole !== undefined ? String(whole ?? '') : str(); continue; }
      if (low === 'href' && /\.dc\.html$/.test(str())) { const board = str(); props.href = '#'; props.onClick = (e: Event) => { e.preventDefault(); env.navigate(board.replace(/\.dc\.html$/, '')); }; continue; }
      props[low === 'class' ? 'class' : name] = whole !== undefined && typeof whole !== 'object' ? String(whole) : str();
    }
    const kids: (VNode | string)[] = [];
    build(n.kids, vals, scope, env, kids);
    out.push(h(n.tag, props as never, kids) as VNode);
  }
}

/** Base class the boards extend: props, state, setState, lifecycle hooks. */
export class DCLogic {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  _rerender: () => void = () => {};
  constructor(props: Record<string, unknown>) { this.props = props || {}; }
  setState(p: unknown) {
    const next = typeof p === 'function' ? (p as (s: unknown) => Record<string, unknown>)(this.state) : p;
    if (next) this.state = Object.assign({}, this.state, next);
    this._rerender();
  }
  renderVals(): Scope { return {}; }
  componentDidMount?(): void;
  componentWillUnmount?(): void;
}

export interface Board { name: string; css: string; tpl: TNode[]; make: (props: Record<string, unknown>) => DCLogic; }

/** Mounts a board, re-rendering at most once per frame after any setState. */
export function mount(board: Board, host: HTMLElement, props: Record<string, unknown>, env: Env) {
  const c = board.make(props);
  let queued = false;
  const draw = () => {
    queued = false;
    let vals: Scope;
    try { vals = c.renderVals(); } catch (err) { console.error(err); return; }
    const out: (VNode | string)[] = [];
    build(board.tpl, vals, {}, env, out);
    render(h('div', { class: 'dc-root' }, out), host);
  };
  c._rerender = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  draw();
  c.componentDidMount?.();
  return { comp: c, unmount: () => { c.componentWillUnmount?.(); render(null, host); } };
}
