import { useMemo, useRef, useState } from 'react';
import { CAT_LABEL, CUISINES, VIBES, ZONES } from '../engine/catalog';
import { cuisineLabels, km, openAt, priceOf, recommend, search, zoneById } from '../engine/core';
import type { Ask, Cat, Ctx, Scored, Venue, Vibe, When, Who } from '../engine/types';
import venuesJson from '../data/venues.json';
import { useSaved, type Plan } from './store';

const VENUES = venuesJson as Venue[];
const BY_ID = new Map(VENUES.map((v) => [v.id, v]));

// ---------- small pieces ----------
const ICON: Record<Cat, string> = {
  mancare: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  cafea: 'M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2',
  desert: 'm7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11M17 7A5 5 0 0 0 7 7M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4',
  bar: 'M8 22h8M12 11v11M19 3l-7 8-7-8Z',
  club: 'M9 18V5l12-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  film: 'M2 8h20M2 16h20M7 3v18M17 3v18M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  teatru: 'M2 10s3-3 3-8M22 10s-3-3-3-8M10 2c0 4.4-3.6 8-8 8M14 2c0 4.4 3.6 8 8 8M2 10s2 2 2 5M22 10s-2 2-2 5M8 15h8M2 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M14 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1',
  cultura: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4Z',
  activitate: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10M12 2a15 15 0 0 0-4 10 15 15 0 0 0 4 10M2 12h20',
};
const TINT: Record<Cat, string> = { mancare: 'coral', cafea: 'yellow', desert: 'coral', bar: 'violet', club: 'navy', film: 'blue', teatru: 'violet', cultura: 'blue', activitate: 'yellow' };
const I = ({ d, s = 20 }: { d: string; s?: number }) => <svg className="i" width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const IC = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  plans: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  back: 'm15 18-6-6 6-6', pin: 'M12 22s-8-6.5-8-13a8 8 0 0 1 16 0c0 6.5-8 13-8 13ZM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  x: 'M18 6 6 18M6 6l12 12', ext: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', check: 'm5 12 5 5L20 7',
};
const WHEN: [When, string][] = [['acum', 'Acum'], ['diseara', 'Diseară'], ['maine', 'Mâine'], ['weekend', 'În weekend']];
const WHO: [Who, string][] = [['1', 'Doar eu'], ['2', 'În doi'], ['34', '3–4'], ['5', '5+']];
const BUDGET: [number, string][] = [[50, 'Până în 50'], [100, 'Până în 100'], [200, 'Până în 200'], [Infinity, 'Oricât']];
const DIST: [number, string][] = [[5, '5 km'], [10, '10 km'], [20, '20 km'], [40, '40 km']];
const LIKE_CUISINES = ['pizza', 'burger', 'sushi', 'romanian', 'italian', 'asian', 'greek', 'kebab', 'vegan'];
const whenLabel = (w: When) => WHEN.find(([k]) => k === w)?.[1] ?? '';
const kmLabel = (d: number) => (d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1).replace('.', ',') + ' km');
const mapsUrl = (v: Venue) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.name + ' ' + v.lat + ',' + v.lon);
const osmUrl = (v: Venue) => 'https://www.openstreetmap.org/' + ({ n: 'node', w: 'way', r: 'relation' } as Record<string, string>)[v.id[0]] + '/' + v.id.slice(1);

function Pills<T extends string | number>({ label, opts, value, onPick, id }: { label: string; opts: [T, string][]; value: T; onPick: (v: T) => void; id: string }) {
  return (
    <div className="grp" role="group" aria-labelledby={id}>
      <p id={id} className="lbl">{label}</p>
      <div className="pills">{opts.map(([k, l]) => <button key={String(k)} type="button" className={'pill' + (k === value ? ' on' : '')} aria-pressed={k === value} onClick={() => onPick(k)}>{l}</button>)}</div>
    </div>
  );
}
function Badge({ v }: { v: Venue }) { return <span className={'badge t-' + TINT[v.cat]}><I d={ICON[v.cat]} s={22} /></span>; }
function sub(v: Venue) { const c = cuisineLabels(v); return [v.kind, ...c.slice(0, 2)].filter((x, i, a) => a.indexOf(x) === i).join(' · '); }

// ---------- screens ----------
type Screen = { name: 'home' } | { name: 'results' } | { name: 'search' } | { name: 'venue'; id: string; from: Screen } | { name: 'plans' } | { name: 'profile' };

export default function App() {
  const [saved, setSaved] = useSaved();
  const [screen, go] = useState<Screen>({ name: 'home' });
  const [ask, setAsk] = useState<Ask>({ who: '34', when: 'diseara', budget: 100, maxKm: 10, vibes: [] });
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState('');
  const toastT = useRef<number>();
  const say = (t: string) => { setToast(t); clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(''), 2600); };

  if (!saved.prefs) return <Onboarding onDone={(prefs) => setSaved((s) => ({ ...s, prefs }))} />;
  const prefs = saved.prefs;
  const ctx: Ctx = { prefs, origin: zoneById(prefs.zone), now: new Date(), history: saved.history };
  const addPlan = (v: Venue, when: When, who: Who) => {
    const p: Plan = { id: String(Date.now()), venueId: v.id, when, who, at: Date.now() };
    setSaved((s) => ({ ...s, plans: [p, ...s.plans], history: s.history.includes(v.id) ? s.history : [...s.history, v.id] }));
    say('Gata, ' + v.name + ' e în Planuri.');
  };
  const open = (id: string) => go({ name: 'venue', id, from: screen });
  const tab = screen.name === 'venue' ? screen.from.name : screen.name;

  return (
    <div className="app">
      <main className="scr" key={screen.name + (screen.name === 'venue' ? screen.id : '')}>
        {screen.name === 'home' && <Home ask={ask} setAsk={(a) => { setAsk(a); setPage(0); }} zone={prefs.zone} onGo={() => { setPage(0); go({ name: 'results' }); }} onZone={() => go({ name: 'profile' })} />}
        {screen.name === 'results' && <Results ask={ask} ctx={ctx} page={page} more={() => setPage((p) => p + 1)} back={() => go({ name: 'home' })} open={open} plan={(v) => addPlan(v, ask.when, ask.who)} />}
        {screen.name === 'search' && <Search ctx={ctx} open={open} />}
        {screen.name === 'venue' && BY_ID.get(screen.id) && <VenuePage v={BY_ID.get(screen.id)!} ctx={ctx} back={() => go(screen.from)} plan={addPlan} defaults={ask} />}
        {screen.name === 'plans' && <Plans plans={saved.plans} open={open} remove={(id) => setSaved((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== id) }))} goHome={() => go({ name: 'home' })} />}
        {screen.name === 'profile' && <Profile prefs={prefs} set={(p) => { setSaved((s) => ({ ...s, prefs: p })); say('Am salvat.'); }} reset={() => { setSaved({ prefs: null, plans: [], history: [] }); go({ name: 'home' }); }} />}
      </main>
      <nav className="tabs" aria-label="Meniu">
        {([['home', 'Acasă', IC.home], ['search', 'Caută', IC.search], ['plans', 'Planuri', IC.plans], ['profile', 'Profil', IC.user]] as const).map(([k, l, d]) => (
          <button key={k} type="button" className={'tab' + (tab === k || (k === 'home' && tab === 'results') ? ' on' : '')} aria-current={tab === k ? 'page' : undefined} onClick={() => go({ name: k } as Screen)}>
            <I d={d} /><span>{l}{k === 'plans' && saved.plans.length ? <em className="dot">{saved.plans.length}</em> : null}</span>
          </button>
        ))}
      </nav>
      <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

function Onboarding({ onDone }: { onDone: (p: { zone: string; likes: string[] }) => void }) {
  const [step, setStep] = useState(0);
  const [zone, setZone] = useState('centru');
  const [likes, setLikes] = useState<string[]>([]);
  const toggle = (k: string) => setLikes((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  return (
    <div className="app"><main className="scr onb">
      <p className="kicker">CeFaci · {step + 1} din 2</p>
      {step === 0 ? <>
        <h1 className="h1">De unde pleci de obicei?</h1>
        <p className="muted">Măsurăm distanțele de aici. Îl schimbi oricând din Profil.</p>
        {(['București', 'Ilfov'] as const).map((area) => (
          <div className="grp" key={area} role="radiogroup" aria-label={area}>
            <p className="lbl">{area}</p>
            <div className="pills">{ZONES.filter((z) => z.area === area).map((z) => <button key={z.id} type="button" role="radio" aria-checked={zone === z.id} className={'pill' + (zone === z.id ? ' on' : '')} onClick={() => setZone(z.id)}>{z.name}</button>)}</div>
          </div>
        ))}
        <button type="button" className="cta" onClick={() => setStep(1)}>Mai departe</button>
      </> : <>
        <h1 className="h1">Ce-ți place?</h1>
        <p className="muted">Alege cel puțin 3. Din ele pornesc recomandările.</p>
        <div className="grp"><p className="lbl">Genul de ieșire</p><div className="pills">{VIBES.map((v) => <button key={v} type="button" aria-pressed={likes.includes(v)} className={'pill' + (likes.includes(v) ? ' on' : '')} onClick={() => toggle(v)}>{v}</button>)}</div></div>
        <div className="grp"><p className="lbl">Mâncare</p><div className="pills">{LIKE_CUISINES.map((c) => <button key={c} type="button" aria-pressed={likes.includes(c)} className={'pill' + (likes.includes(c) ? ' on' : '')} onClick={() => toggle(c)}>{CUISINES[c]}</button>)}</div></div>
        <div className="row2"><button type="button" className="ghost" onClick={() => setStep(0)}>Înapoi</button><button type="button" className="cta" disabled={likes.length < 3} onClick={() => onDone({ zone, likes })}>{likes.length < 3 ? 'Mai alege ' + (3 - likes.length) : 'Hai să vedem'}</button></div>
      </>}
    </main></div>
  );
}

function Home({ ask, setAsk, zone, onGo, onZone }: { ask: Ask; setAsk: (a: Ask) => void; zone: string; onGo: () => void; onZone: () => void }) {
  const set = <K extends keyof Ask>(k: K, v: Ask[K]) => setAsk({ ...ask, [k]: v });
  const tvibe = (v: Vibe) => set('vibes', ask.vibes.includes(v) ? ask.vibes.filter((x) => x !== v) : [...ask.vibes, v]);
  return (
    <>
      <header className="hero">
        <button type="button" className="zone" onClick={onZone}><I d={IC.pin} s={16} />Pleci din {zoneById(zone).name}</button>
        <h1 className="display">Ce facem {ask.when === 'acum' ? 'acum' : ask.when === 'diseara' ? 'diseară' : ask.when === 'maine' ? 'mâine' : 'în weekend'}?</h1>
        <p className="muted">{VENUES.length.toLocaleString('ro-RO')} de locuri reale din București și Ilfov.</p>
      </header>
      <Pills id="l-who" label="Cine vine?" opts={WHO} value={ask.who} onPick={(v) => set('who', v)} />
      <Pills id="l-when" label="Când?" opts={WHEN} value={ask.when} onPick={(v) => set('when', v)} />
      <Pills id="l-bud" label="Buget de persoană, în lei" opts={BUDGET} value={ask.budget} onPick={(v) => set('budget', v)} />
      <Pills id="l-dist" label="Cât de departe?" opts={DIST} value={ask.maxKm} onPick={(v) => set('maxKm', v)} />
      <div className="grp" role="group" aria-labelledby="l-vibe"><p id="l-vibe" className="lbl">Ce chef ai? <span className="faint">(opțional)</span></p>
        <div className="pills">{VIBES.map((v) => <button key={v} type="button" aria-pressed={ask.vibes.includes(v)} className={'pill' + (ask.vibes.includes(v) ? ' on' : '')} onClick={() => tvibe(v)}>{v}</button>)}</div>
      </div>
      <button type="button" className="cta big" onClick={onGo}>Arată-mi 3 variante</button>
    </>
  );
}

function Card({ s, big, open, plan }: { s: Scored; big?: boolean; open: () => void; plan?: () => void }) {
  const v = s.v;
  return (
    <article className={'card' + (big ? ' big' : '')}>
      <button type="button" className="cardhit" onClick={open} aria-label={'Detalii ' + v.name} />
      <div className="cardtop"><Badge v={v} /><div className="cardtitle"><h2>{v.name}</h2><p>{sub(v)}</p></div></div>
      <ul className="why">{s.reasons.map((r) => <li key={r}><I d={IC.check} s={15} />{r}</li>)}</ul>
      <div className="facts"><span>{zoneById(v.zone).name}</span><span>~{priceOf(v)} lei de persoană</span></div>
      {plan && <div className="row2"><button type="button" className="ghost" onClick={open}>Detalii</button><button type="button" className="cta sm" onClick={plan}>Facem asta</button></div>}
    </article>
  );
}

function Results({ ask, ctx, page, more, back, open, plan }: { ask: Ask; ctx: Ctx; page: number; more: () => void; back: () => void; open: (id: string) => void; plan: (v: Venue) => void }) {
  const { picks, total } = useMemo(() => recommend(VENUES, ask, ctx, page), [ask, page, ctx.prefs, ctx.history]);
  return (
    <>
      <div className="bar"><button type="button" className="icon" onClick={back} aria-label="Înapoi"><I d={IC.back} /></button><span className="muted">{whenLabel(ask.when)} · {WHO.find(([k]) => k === ask.who)?.[1]} · până în {ask.maxKm} km</span></div>
      {picks.length ? <>
        <h1 className="h1">{page === 0 ? 'Uite trei idei.' : 'Alte trei.'}</h1>
        <p className="muted">Din {total.toLocaleString('ro-RO')} de locuri care se potrivesc, deschise la ora aleasă.</p>
        <div className="stack">{picks.map((s, i) => <Card key={s.v.id} s={s} big={i === 0} open={() => open(s.v.id)} plan={() => plan(s.v)} />)}</div>
        {total > 3 && <button type="button" className="ghost wide" onClick={more}>Alte 3 variante</button>}
      </> : <div className="empty"><h1 className="h1">Nimic deschis cu filtrele astea.</h1><p className="muted">Încearcă o distanță mai mare, alt buget sau altă oră.</p><button type="button" className="cta" onClick={back}>Schimbă filtrele</button></div>}
    </>
  );
}

const EXAMPLES = ['pizza în sector 2', 'bar cu terasă', 'bowling', 'escape room', 'cafenea deschisă acum', 'muzeu', 'club', 'sushi Pipera'];
function Search({ ctx, open }: { ctx: Ctx; open: (id: string) => void }) {
  const [q, setQ] = useState('');
  const { results, parsed } = useMemo(() => (q.trim().length >= 2 ? search(VENUES, q, ctx) : { results: [], parsed: null }), [q, ctx.prefs]);
  const bits = parsed && parsed.words.length ? ['„' + parsed.raw.join(' ') + '”', parsed.zone ? 'în ' + zoneById(parsed.zone).name : '', parsed.openNow ? 'deschis acum' : ''].filter(Boolean) : parsed ? [...parsed.cuisines.map((c) => CUISINES[c]).filter(Boolean).slice(0, 2), ...parsed.kinds.slice(0, 1).map((k) => VENUES.find((v) => v.k === k)?.kind ?? ''), ...parsed.cats.map((c) => CAT_LABEL[c]), parsed.zone ? 'în ' + zoneById(parsed.zone).name : '', parsed.outdoor ? 'cu terasă' : '', parsed.openNow ? 'deschis acum' : '', parsed.cheap ? 'ieftin' : '', parsed.words.length ? '„' + parsed.words.join(' ') + '”' : ''].filter(Boolean) : [];
  return (
    <>
      <h1 className="h1">Caută</h1>
      <div className="field"><I d={IC.search} /><label htmlFor="q" className="sr">Caută un local</label><input id="q" type="text" inputMode="search" enterKeyHint="search" autoComplete="off" placeholder="Nume, fel de mâncare, zonă…" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button type="button" className="icon" aria-label="Șterge" onClick={() => setQ('')}><I d={IC.x} s={18} /></button>}</div>
      {!q && <div className="grp"><p className="lbl">Încearcă</p><div className="pills">{EXAMPLES.map((e) => <button type="button" key={e} className="pill" onClick={() => setQ(e)}>{e}</button>)}</div></div>}
      {parsed && <p className="muted" aria-live="polite">{bits.length ? 'Caut: ' + bits.join(' · ') + '. ' : ''}{results.length ? results.length + (results.length === 40 ? '+' : '') + ' rezultate' : 'Niciun rezultat. Încearcă alt cuvânt.'}</p>}
      <ul className="list">{results.map((s) => (
        <li key={s.v.id}><button type="button" className="rowbtn" onClick={() => open(s.v.id)}>
          <Badge v={s.v} /><span className="rowtxt"><strong>{s.v.name}</strong><span>{sub(s.v)}</span><span className="faint">{zoneById(s.v.zone).name} · {kmLabel(s.km)}{s.open.known ? ' · ' + s.open.label : ''}</span></span>
        </button></li>
      ))}</ul>
    </>
  );
}

function VenuePage({ v, ctx, back, plan, defaults }: { v: Venue; ctx: Ctx; back: () => void; plan: (v: Venue, w: When, who: Who) => void; defaults: Ask }) {
  const [when, setWhen] = useState<When>(defaults.when);
  const [who, setWho] = useState<Who>(defaults.who);
  const [copied, setCopied] = useState(false);
  const o = openAt(v, ctx.now);
  const d = Math.round(km(ctx.origin, v) * 10) / 10;
  const addr = [v.street, v.city].filter(Boolean).join(', ');
  const copy = async () => { try { await navigator.clipboard.writeText(v.phone!); setCopied(true); } catch { setCopied(false); } };
  return (
    <>
      <div className="bar"><button type="button" className="icon" onClick={back} aria-label="Înapoi"><I d={IC.back} /></button></div>
      <header className={'vhead t-' + TINT[v.cat]}><Badge v={v} /><h1 className="display sm">{v.name}</h1><p>{sub(v)}</p></header>
      <dl className="facts2">
        <div><dt>Acum</dt><dd className={o.known ? (o.open ? 'ok' : 'no') : ''}>{o.label}</dd></div>
        <div><dt>Distanță</dt><dd>~{d.toString().replace('.', ',')} km din {zoneById(ctx.prefs.zone).name}</dd></div>
        <div><dt>Cost estimat</dt><dd>~{priceOf(v)} lei de persoană</dd></div>
        <div><dt>Zona</dt><dd>{zoneById(v.zone).name}</dd></div>
        {addr && <div className="full"><dt>Adresa</dt><dd>{addr}</dd></div>}
        {v.hours && <div className="full"><dt>Program (din hartă)</dt><dd className="mono">{v.hours}</dd></div>}
        {v.phone && <div className="full"><dt>Telefon</dt><dd><span className="sel">{v.phone}</span> <button type="button" className="link" onClick={copy}>{copied ? 'Copiat' : 'Copiază'}</button></dd></div>}
      </dl>
      <div className="links">
        <a className="ghost" href={mapsUrl(v)} target="_blank" rel="noopener noreferrer"><I d={IC.pin} s={18} />Deschide în Google Maps</a>
        {v.website && <a className="ghost" href={v.website} target="_blank" rel="noopener noreferrer"><I d={IC.ext} s={18} />Site-ul lor</a>}
      </div>
      <section className="planbox" aria-labelledby="pl-t">
        <h2 id="pl-t" className="h2">Facem asta</h2>
        <Pills id="v-when" label="Când?" opts={WHEN} value={when} onPick={setWhen} />
        <Pills id="v-who" label="Cine vine?" opts={WHO} value={who} onPick={setWho} />
        <button type="button" className="cta" onClick={() => plan(v, when, who)}>Pune în Planuri</button>
      </section>
      <p className="credit">Date din <a href={osmUrl(v)} target="_blank" rel="noopener noreferrer">OpenStreetMap</a>, © contribuitorii OpenStreetMap (ODbL). Programul și prețul pot fi vechi; costul e o estimare CeFaci.</p>
    </>
  );
}

function Plans({ plans, open, remove, goHome }: { plans: Plan[]; open: (id: string) => void; remove: (id: string) => void; goHome: () => void }) {
  const order: When[] = ['acum', 'diseara', 'maine', 'weekend'];
  const list = plans.filter((p) => BY_ID.has(p.venueId)).sort((a, b) => order.indexOf(a.when) - order.indexOf(b.when));
  return (
    <>
      <h1 className="h1">Planuri</h1>
      {list.length ? <ul className="list">{list.map((p) => { const v = BY_ID.get(p.venueId)!; return (
        <li key={p.id} className="planrow"><button type="button" className="rowbtn" onClick={() => open(v.id)}><Badge v={v} /><span className="rowtxt"><strong>{v.name}</strong><span>{whenLabel(p.when)} · {WHO.find(([k]) => k === p.who)?.[1]}</span><span className="faint">{sub(v)}</span></span></button>
          <button type="button" className="icon" aria-label={'Scoate ' + v.name} onClick={() => remove(p.id)}><I d={IC.x} s={18} /></button></li>); })}</ul>
        : <div className="empty"><p className="h2">Niciun plan încă.</p><p className="muted">Alege ceva din recomandări sau din căutare și apasă „Facem asta”.</p><button type="button" className="cta" onClick={goHome}>Hai să căutăm</button></div>}
    </>
  );
}

function Profile({ prefs, set, reset }: { prefs: { zone: string; likes: string[] }; set: (p: { zone: string; likes: string[] }) => void; reset: () => void }) {
  const [arm, setArm] = useState(false);
  const toggle = (k: string) => set({ ...prefs, likes: prefs.likes.includes(k) ? prefs.likes.filter((x) => x !== k) : [...prefs.likes, k] });
  const counts = useMemo(() => VENUES.reduce<Record<string, number>>((m, v) => ((m[v.cat] = (m[v.cat] || 0) + 1), m), {}), []);
  return (
    <>
      <h1 className="h1">Profil</h1>
      <div className="grp"><label htmlFor="zone" className="lbl">Pleci de obicei din</label>
        <select id="zone" className="select" value={prefs.zone} onChange={(e) => set({ ...prefs, zone: e.target.value })}>
          {(['București', 'Ilfov'] as const).map((a) => <optgroup key={a} label={a}>{ZONES.filter((z) => z.area === a).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>)}
        </select></div>
      <div className="grp"><p className="lbl">Ce-ți place</p><div className="pills">{[...VIBES, ...LIKE_CUISINES].map((k) => <button key={k} type="button" aria-pressed={prefs.likes.includes(k)} className={'pill' + (prefs.likes.includes(k) ? ' on' : '')} onClick={() => toggle(k)}>{CUISINES[k] ?? k}</button>)}</div></div>
      <section className="about"><h2 className="h2">Locurile din aplicație</h2>
        <ul className="counts">{(Object.keys(CAT_LABEL) as Cat[]).filter((c) => counts[c]).map((c) => <li key={c}><span>{CAT_LABEL[c]}</span><strong>{counts[c].toLocaleString('ro-RO')}</strong></li>)}</ul>
        <p className="credit">Toate vin din OpenStreetMap, harta publică făcută de oameni, © contribuitorii OpenStreetMap (ODbL).</p></section>
      {arm ? <div className="row2"><button type="button" className="ghost" onClick={() => setArm(false)}>Nu</button><button type="button" className="cta danger" onClick={reset}>Da, șterge tot</button></div>
        : <button type="button" className="ghost wide" onClick={() => setArm(true)}>Șterge preferințele și planurile</button>}
    </>
  );
}
