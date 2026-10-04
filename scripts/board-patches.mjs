// Text patches applied to the design boards: [where ('code' | 'tpl'), find, replace].
import { CONT_ACCOUNT } from './board-patches-cont.mjs';
import { CONT_EMAIL } from './board-patches-email.mjs';
import { DEMO_BUDGET } from './board-patches-budget.mjs';
import { DEMO_REAL } from './board-patches-real.mjs';

// They swap the design's sample venues for real ones and add search, keeping every screen as designed.

const NAV_BTN = `<button type="button" class="press" style="height: 62px; border: 0; border-radius: 16px; background: var(--blue); color: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font: 650 13px/1 'Instrument Sans', system-ui, sans-serif"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 22 2l-9 19-2-8z"></path></svg>Navighează</button>`;
const NAV_LINK = `<a class="press" href="{{navUrl}}" target="_blank" rel="noopener noreferrer" style="height: 62px; border: 0; border-radius: 16px; background: var(--blue); color: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-decoration: none; font: 650 13px/1 'Instrument Sans', system-ui, sans-serif"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 22 2l-9 19-2-8z"></path></svg>Navighează</a>`;

const SEARCH_FIELD = `<label for="sq" style="margin-top: 12px; display: flex; align-items: center; gap: 10px; height: 50px; padding: 0 8px 0 14px; border-radius: 16px; border: 1px solid var(--line); background: var(--s1); color: var(--ink2)"><svg class="i s" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg><span class="sr">Caută un loc</span><input id="sq" type="text" autocomplete="off" enterkeyhint="search" value="{{sq}}" onChange="{{onSq}}" placeholder="Caută: un nume, „pizza sector 2”, „bar cu terasă”" style="flex: 1 1 auto; min-width: 0; height: 46px; padding: 0; border: 0; outline: none; background: transparent; color: var(--ink); font: 600 15px/1 'Instrument Sans', system-ui, sans-serif"><sc-if value="{{sqOn}}" hint-placeholder-val="{{ false }}"><button type="button" class="press iconbtn" onClick="{{sqClear}}" aria-label="Șterge căutarea"><svg class="i s" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg></button></sc-if></label>
<sc-if value="{{sqHints}}" hint-placeholder-val="{{ false }}"><div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap"><sc-for list="{{sqExamples}}" as="x" hint-placeholder-count="4"><button type="button" class="press chip" onClick="{{x.pick}}">{{x.label}}</button></sc-for></div></sc-if>
<h1 class="h1" style="margin-top: 14px; font-size: 38px">{{resTitle}}</h1>`;

const ZONE_SCREEN = `<sc-if value="{{zoneOpen}}" hint-placeholder-val="{{ false }}">
<section class="scr" aria-labelledby="zn-t" style="position: absolute; left: 0; top: 0; width: 390px; height: 844px; z-index: 30; padding: 52px 20px 34px; background: var(--bg); display: flex; flex-direction: column; gap: 14px; overflow-y: auto">
<div style="display: flex; align-items: center; gap: 6px; height: 44px"><button type="button" class="press iconbtn" onClick="{{zoneClose}}" aria-label="Înapoi" style="margin-left: -12px"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg></button></div>
<h1 id="zn-t" class="h1" style="font-size: 34px">De unde pleci?</h1>
<p class="muted" style="margin: 0">Distanțele și recomandările se socotesc de aici.</p>
<button type="button" class="{{hereCls}}" aria-pressed="{{hereOn}}" onClick="{{useHere}}" style="align-self: flex-start; display: flex; align-items: center; gap: 8px; padding: 0 16px"><svg class="i s" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2.5"></circle></svg>{{hereLabel}}</button>
<sc-for list="{{zoneGroups}}" as="g" hint-placeholder-count="2"><div style="display: flex; flex-direction: column; gap: 8px"><p class="lbl" style="margin: 6px 0 0">{{g.area}}</p><div style="display: flex; gap: 6px; flex-wrap: wrap"><sc-for list="{{g.zones}}" as="z" hint-placeholder-count="6"><button type="button" class="{{z.cls}}" aria-pressed="{{z.on}}" onClick="{{z.pick}}">{{z.name}}</button></sc-for></div></div></sc-for>
</section>
</sc-if>
`;

export const PATCHES = {
  Demo: [
    ['code', 'const ICONS = {', `const ICONS = {\n  tree: 'm17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17ZM12 22v-3',\n  ball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M5.6 5.6c3.4 3.4 3.4 9.4 0 12.8M18.4 5.6c-3.4 3.4-3.4 9.4 0 12.8',\n  castle: 'M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2ZM18 11V4H6v7M15 22v-4a3 3 0 0 0-6 0v4M22 11V9M2 11V9M6 4V2M18 4V2M10 4V2M14 4V2',\n  fork: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',\n  beer: 'M17 11h1a3 3 0 0 1 0 6h-1M9 12v6M13 12v6M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5ZM5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8',`],
    ['code', 'const PLACES = [', 'const PLACES = APP.places;\nconst PLACES_DESIGN = ['],
    ['code', 'const DROPS = [', 'const DROPS = [];\nconst DROPS_DESIGN = ['],
    ['code', 'const PLUS = { pista9:', 'const PLUS = {};\nconst PLUS_DESIGN = { pista9:'],
    ['code', 'const PLUS_SAVED = [', 'const PLUS_SAVED = [];\nconst PLUS_SAVED_DESIGN = ['],
    ['code', 'const VISITED = [', 'const VISITED = [];\nconst VISITED_DESIGN = ['],
    ['code', 'const DUR = {', 'APP.fixWhen(WHEN);\nconst DUR = {'],
    ['code', '  matches(f) {\n', '  matches(f) {\n    return APP.matches(f);\n'],
    ['code', '  place(id) { return PLACES.find((x) => x.id === id) || PLACES[0]; }', '  place(id) { return APP.byId(id) || PLACES[0]; }'],
    ['code', '  reason(p, f) {\n', '  reason(p, f) {\n    const fromEngine = APP.reason(p.id);\n    if (fromEngine) return fromEngine;\n'],
    ['code', 'prData.stamps.map((id, k) => {', 'prData.stamps.filter((id) => APP.byId(id)).map((id, k) => {'],
    ['code', '  slice() {\n    const all = this.matches(this.filtersOf());', '  slice() {\n    const q = String(this.state.sq || \'\').trim();\n    const all = q.length > 1 ? APP.search(q) : this.matches(this.filtersOf());'],
    ['code', "      resTitle: items.length ?", "      resTitle: String(s.sq || '').trim().length > 1 ? (all.length ? 'Uite ce am găsit.' : 'N-am găsit nimic.') : items.length ?"],
    ['code', "      resSub: all.length ?", "      resSub: String(s.sq || '').trim().length > 1 ? (all.length ? all.length + (all.length === 1 ? ' loc' : (all.length < 20 ? ' locuri' : ' de locuri')) + ' pentru „' + String(s.sq).trim() + '”' + (page ? ', pagina ' + (page + 1) : '') : 'Încearcă un nume, „pizza”, „sector 2” sau „bar cu terasă”.') : all.length ?"],
    ['code', "', pe numele Cornel Adrian.'", "', pe numele ' + (APP.prefs.name || 'tău') + '.'"],
    ['code', "', pe numele Cornel Adrian. Spui", "', pe numele ' + (APP.prefs.name || 'tău') + '. Spui"],
    ['code', "    return {\n      tut: this.tutVals(heroWord, summary),", `    const zq = String(s.sq || '');
    return {
      appZone: APP.zoneName(), zoneAria: 'Zona ta: ' + APP.zoneName() + '. Schimbă zona', openZone: () => this.setState({ zoneOpen: true }),
      zoneOpen: !!s.zoneOpen, zoneClose: () => this.setState({ zoneOpen: false }),
      // optional real location, asked only when the person taps it (decision 19a)
      hereOn: APP.hasHere(), hereCls: APP.hasHere() ? 'press chip on' : 'press chip', hereLabel: s.hereBusy ? 'Caut locația…' : (APP.hasHere() ? 'Folosesc locația ta' : 'Folosește locația mea'),
      useHere: () => { if (this.state.hereBusy) return; this.setState({ hereBusy: true }); APP.useHere().then((err) => { this.setState({ hereBusy: false, page: 0, zoneOpen: !!err }); this.toast(err || 'Pleci de lângă tine. Am refăcut recomandările.'); }); },
      zoneGroups: ['București', 'Ilfov'].map((area) => ({ area, zones: APP.zones().filter((z) => z.area === area).map((z) => ({ name: z.name, on: !APP.hasHere() && z.id === APP.prefs.zone, cls: !APP.hasHere() && z.id === APP.prefs.zone ? 'press chip on' : 'press chip', pick: () => { APP.savePrefs({ zone: z.id, here: undefined }); this.setState({ zoneOpen: false, page: 0 }); this.toast('Pleci din ' + z.name + '. Am refăcut recomandările.'); } })) })),
      sq: zq, sqOn: zq.length > 0, sqHints: zq.trim().length < 2,
      onSq: (e) => this.setState({ sq: e && e.target ? String(e.target.value).slice(0, 60) : '', page: 0 }),
      sqClear: () => this.setState({ sq: '', page: 0 }),
      sqExamples: ['pizza sector 2', 'bar cu terasă', 'escape room', 'cafenea deschisă acum', 'muzeu', 'club'].map((label) => ({ label, pick: () => this.setState({ sq: label, page: 0 }) })),
      tut: this.tutVals(heroWord, summary),`],
    ['code', "      tTitle: p.title, tName: p.name,", "      navUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ' ' + (p.real ? p.real.lat + ',' + p.real.lon : '')),\n      tTitle: p.title, tName: p.name,"],
    ['tpl', 'aria-label="Zona ta: Buftea" style="', 'aria-label="{{zoneAria}}" onClick="{{openZone}}" style="'],
    ['tpl', '<circle cx="12" cy="10" r="3"></circle></svg>Buftea<svg', '<circle cx="12" cy="10" r="3"></circle></svg>{{appZone}}<svg'],
    ['tpl', '>Populare în Buftea</h2>', '>Populare în {{appZone}}</h2>'],
    ['tpl', '>Reduceri Plus în Buftea</h2>', '>Reduceri Plus în {{appZone}}</h2>'],
    ['tpl', NAV_BTN, NAV_LINK],
    ['tpl', '<h1 class="h1" style="margin-top: 14px; font-size: 38px">{{resTitle}}</h1>', SEARCH_FIELD],
    ['tpl', '<sc-if value="{{isBill}}" hint-placeholder-val="{{ false }}">', ZONE_SCREEN + '<sc-if value="{{isBill}}" hint-placeholder-val="{{ false }}">'],
    ['tpl', '<path d="{{wxIcon}}"></path></svg>{{wxText}}</span>', '<path d="{{wxIcon}}"></path></svg>{{todayText}}</span>'],
    ['tpl', '<span class="skypill"><span class="live" aria-hidden="true" style="width: 7px; height: 7px; border-radius: 99px; background: #FF6A4D"></span>{{liveCount}} drops acum</span>', '<span class="skypill"><span class="live" aria-hidden="true" style="width: 7px; height: 7px; border-radius: 99px; background: #FF6A4D"></span>{{placesText}}</span>'],
    ['code', "      appZone: APP.zoneName(),", "      todayText: APP.todayText(), placesText: APP.count.toLocaleString('ro-RO') + ' de locuri reale',\n      appZone: APP.zoneName(),"],
    ['code', "billDone: false,", "billDone: true,"],
    ['tpl', '<sc-if value="{{askFeedback}}" hint-placeholder-val="{{ true }}">', '<sc-if value="{{askFeedbackReal}}" hint-placeholder-val="{{ false }}">'],
    ['code', "      appZone: APP.zoneName(),", "      askFeedbackReal: false, meName: APP.prefs.name || 'Tu', meUser: APP.prefs.user || 'tu',\n      appZone: APP.zoneName(),"],
    ['tpl', 'Cornel Adrian', '{{meName}}'],
    ['tpl', '@CornaciDev', '@{{meUser}}'],
    ...DEMO_BUDGET,
    ...DEMO_REAL,
  ],
  Cont: [
    ['tpl', '<div style="padding: 14px; border-radius: 18px; background: var(--s1); border: 1px solid var(--line); display: flex; align-items: center; gap: 12px"><span aria-hidden="true" style="width: 44px; height: 44px; flex: none; border-radius: 14px; background: #2F5BFF; color: #FFD43B; display: flex; align-items: center; justify-content: center"><svg class="i" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg></span><span class="col" style="flex: 1 1 auto; gap: 3px"><span style="font: 700 17px/1.1 \'Instrument Sans\', system-ui, sans-serif">Buftea</span><span class="muted">Găsit după locație · poți schimba oricând</span></span></div>', '<sc-for list="{{zoneGroups}}" as="g" hint-placeholder-count="2"><div class="col" style="gap: 8px"><p class="lbl">{{g.area}}</p><div style="display: flex; gap: 8px; flex-wrap: wrap"><sc-for list="{{g.zones}}" as="z" hint-placeholder-count="6"><button type="button" class="{{z.cls}}" aria-pressed="{{z.on}}" onClick="{{z.pick}}">{{z.name}}</button></sc-for></div></div></sc-for>'],
    ['tpl', '<h1 id="zn-t" class="h1">Unde ieși de obicei?</h1>', '<h1 id="zn-t" class="h1">De unde pleci de obicei?</h1>'],
    ['code', "step: 'start',", "step: 'start', zoneId: APP.prefs.zone || 'centru',"],
    ['code', "zone: ['up', 'Buftea, ce frumos! Cât de departe ești dispus să mergi pentru o seară bună?'],", "zone: ['up', 'Spune-mi de unde pleci și cât de departe ești dispus să mergi pentru o seară bună.'],"],
    ['code', "    v.zoneOff = s.moves.length === 0;", "    v.zoneOff = s.moves.length === 0;\n    v.zoneGroups = ['București', 'Ilfov'].map((area) => ({ area, zones: APP.zones().filter((z) => z.area === area).map((z) => ({ name: z.name, on: s.zoneId === z.id, cls: on(s.zoneId === z.id), pick: () => set({ zoneId: z.id }) })) }));"],
    ['code', "    const p = PICKS[Math.min(s.pick, PICKS.length - 1)];\n    v.card = { title: p[0], tag: p[1], sub: p[2], bg: p[3], fg: p[4], dot: p[5], icon: LIKES.find((l) => l[0] === p[6])[3], cls: 'pcard ' + (s.pick % 2 ? 'b' : 'a') };",
     "    const real = APP.picksFor(s.likes, s.zoneId);\n    const rp = real[Math.min(s.pick, real.length - 1)];\n    const p = rp ? [rp.name, rp.tag, rp.sub, rp.bg, rp.fg, rp.dot, rp.like] : PICKS[Math.min(s.pick, PICKS.length - 1)];\n    v.card = { title: p[0], tag: p[1], sub: p[2], bg: p[3], fg: p[4], dot: p[5], icon: (LIKES.find((l) => l[0] === p[6]) || LIKES[5])[3], cls: 'pcard ' + (s.pick % 2 ? 'b' : 'a') };"],
    ['code', "const FOUND = [", "const FOUND = []; // real friends arrive with accounts (etapa 2)\nconst FOUND_DESIGN = ["],
    ['code', "s.synced ? 'I-am găsit! Adaugă-i și votați împreună data viitoare.'", "s.synced ? 'Încă n-am găsit pe nimeni din agendă în CeFaci. Când vin prietenii tăi, îi vezi aici și votați împreună.'"],
    ...CONT_ACCOUNT,
    ...CONT_EMAIL,
  ],
};
