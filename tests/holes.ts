// Resolves every {{hole}} of a board template against renderVals(), like the canvas would.
export function checker(tpl: string) {
  const re = /<(\/?)(sc-for|sc-if)\b([^>]*)>|\{\{\s*([^}]*?)\s*\}\}/g;
  type Ev = { t: 'open'; tag: string; list?: string; as?: string; val?: string } | { t: 'close' } | { t: 'hole'; p: string };
  const events: Ev[] = []; let m: RegExpExecArray | null;
  while ((m = re.exec(tpl))) {
    if (m[2]) {
      if (m[1]) events.push({ t: 'close' });
      else { const a = m[3]; events.push({ t: 'open', tag: m[2], list: (a.match(/list="\{\{\s*([^}]*?)\s*\}\}"/) || [])[1], as: (a.match(/as="(\w+)"/) || [])[1], val: (a.match(/value="\{\{\s*([^}]*?)\s*\}\}"/) || [])[1] }); }
    } else events.push({ t: 'hole', p: m[4] });
  }
  const resolve = (vals: any, scope: any, p: string) => { if (p === 'true' || p === 'false' || /^-?\d/.test(p)) return true; const parts = p.split('.'); let cur = parts[0] in scope ? scope[parts[0]] : vals[parts[0]]; if (cur === undefined) return undefined; for (const k of parts.slice(1)) { if (cur == null) return undefined; cur = cur[k]; } return cur; };
  return (label: string, vals: any, problems: Map<string, string>) => {
    const stack: any[] = [{}]; const skip: boolean[] = []; let empty = 0;
    for (const e of events) {
      const scope = stack[stack.length - 1];
      if (e.t === 'open') {
        if (e.tag === 'sc-for') { const lst = empty ? [] : resolve(vals, scope, e.list!); if (!empty && !Array.isArray(lst)) problems.set('list ' + e.list, label); const ns = { ...scope }; if (Array.isArray(lst) && lst.length) { ns[e.as!] = lst[0]; skip.push(false); } else { ns[e.as!] = null; empty++; skip.push(true); } stack.push(ns); }
        else { if (!empty && resolve(vals, scope, e.val!) === undefined) problems.set('if ' + e.val, label); skip.push(false); stack.push(scope); }
      } else if (e.t === 'close') { stack.pop(); if (skip.pop()) empty--; }
      else if (!empty && resolve(vals, scope, e.p) === undefined) problems.set('hole ' + e.p, label);
    }
  };
}
