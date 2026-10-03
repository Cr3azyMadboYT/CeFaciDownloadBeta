// Generated from design/Cont.dc.html by scripts/extract-boards.mjs. Do not edit; change the patches.
/* eslint-disable */
import { APP } from '../app/bridge';
export function make(DCLogic) {

const BL_ARMS = {
  rest: ['M24 88Q12 94 13 106', 13, 107, 'M96 88Q108 94 107 106', 107, 107],
  hi: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q112 76 112 58', 112, 56],
  up: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q110 72 108 50', 108, 48],
  down: ['M24 88Q12 94 13 106', 13, 107, 'M96 90Q110 98 116 112', 117, 114],
  left: ['M24 86Q8 80 2 66', 1, 64, 'M96 88Q108 94 107 106', 107, 107],
  wink: ['M24 88Q12 94 13 106', 13, 107, 'M96 88Q112 84 110 68', 110, 66],
  yay: ['M24 86Q8 74 10 54', 10, 52, 'M96 86Q112 74 110 54', 110, 52],
  oops: ['M24 90Q10 76 30 60', 31, 58, 'M96 90Q110 76 90 60', 89, 58],
  magic: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q110 72 108 50', 108, 48]
};
const BL_LOOK = { c: [0, 0], up: [0, -3.5], down: [0, 3.5], left: [-3.5, 0], right: [3.5, 0], ul: [-2.6, -2.6], ur: [2.6, -2.6], dl: [-2.6, 2.6], dr: [2.6, 2.6] };
function biluPose(mood, look) {
  const a = BL_ARMS[mood] || BL_ARMS.rest;
  const l = BL_LOOK[look || 'c'] || BL_LOOK.c;
  const open = 'M48 52Q60 70 72 52Z';
  const smile = 'M50 54Q60 64 70 54Q60 59 50 54Z';
  const p = {
    armL: a[0], hLx: a[1], hLy: a[2], armR: a[3], hRx: a[4], hRy: a[5],
    pLx: 46 + l[0], pLy: 41 + l[1], pRx: 74 + l[0], pRy: 41 + l[1],
    gLx: 47.6 + l[0], gLy: 38.6 + l[1], gRx: 75.6 + l[0], gRy: 38.6 + l[1],
    eL: 1, eR: 1, arcs: '', brow: 0, wand: 0, mouth: smile, tongue: '', cls: 'bilu m-' + mood
  };
  if (mood === 'hi') { p.mouth = open; p.tongue = 'M53 60Q60 67 67 60Q60 57 53 60Z'; }
  if (mood === 'wink') { p.eL = 0; p.arcs = 'M39 42Q46 35 53 42'; p.mouth = 'M49 53Q60 67 71 53Z'; p.tongue = 'M54 60Q60 64 66 60Q60 58 54 60Z'; }
  if (mood === 'yay') { p.eL = 0; p.eR = 0; p.arcs = 'M39 43Q46 32 53 43M67 43Q74 32 81 43'; p.mouth = 'M46 50Q60 76 74 50Z'; p.tongue = 'M52 62Q60 71 68 62Q60 58 52 62Z'; }
  if (mood === 'magic') { p.wand = 1; p.eL = 0; p.arcs = 'M39 42Q46 35 53 42'; p.mouth = 'M49 53Q60 67 71 53Z'; p.tongue = 'M54 60Q60 64 66 60Q60 58 54 60Z'; }
  if (mood === 'oops') { p.brow = 1; p.mouth = 'M55 58A5 6 0 1 0 65 58A5 6 0 1 0 55 58Z'; p.tongue = ''; }
  return p;
}
const SUN = 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41';
const MOON = 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z';
const LIKES = [
  ['bowl', 'Bowling și jocuri', '#8EA6FF', 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M9 8h.01M13 7h.01M11 11h.01'],
  ['escape', 'Escape room', '#B7A3FF', 'M15 7a5 5 0 1 0-4.9 6H8v3H6v3h5v-4.1A5 5 0 0 0 15 7zM15 7h.01'],
  ['film', 'Film', '#FFE58A', 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16'],
  ['party', 'Club și party', '#FF8A73', 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  ['karaoke', 'Karaoke', '#FFD43B', 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M19 10v2a7 7 0 0 1-14 0v-2M12 19v3'],
  ['food', 'Mâncare bună', '#FF8A73', 'M3 11h18M5 11a7 7 0 0 0 14 0M12 4v3M8 5l1 2M16 5l-1 2'],
  ['cafe', 'Cafenele și deserturi', '#FFE58A', 'M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2'],
  ['sport', 'Sport: padel, fotbal', '#5FD39A', 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M12 2v20M2 12h20'],
  ['nature', 'Natură și plimbări', '#5FD39A', 'M12 22V12M5 12l7-10 7 10zM8 17l4-5 4 5'],
  ['culture', 'Muzee și teatru', '#B7A3FF', 'M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-7 10 7z'],
  ['board', 'Board games', '#8EA6FF', 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01'],
  ['standup', 'Stand-up', '#FFD43B', 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M8 22h8M12 16v6']
];
const PICKS = [
  ['Pista 9', 'Bowling · 8 min', 'Seara de vineri, cu gașca și nachos', '#2F5BFF', '#FFFFFF', '#8EA6FF', 'bowl'],
  ['Laboratorul', 'Escape room · 12 min', '60 de minute să ieșiți din laborator', '#8C6CFF', '#0E1440', '#FFD43B', 'escape'],
  ['Lacul Buftea', 'Plimbare · 5 min', 'Apus pe malul lacului, gratis', '#1E7A4C', '#FFFFFF', '#5FD39A', 'nature'],
  ['Club Neon 21', 'Club · 14 min', 'DJ până la 4, intrare 40 de lei', '#0E1440', '#FFD43B', '#8C6CFF', 'party'],
  ['Cofetăria Mia', 'Desert · 4 min', 'Cea mai bună prăjitură cu vișine din zonă', '#FF8A73', '#0E1440', '#FFE58A', 'cafe']
];
const FOUND = []; // real friends arrive with accounts (etapa 2)
const FOUND_DESIGN = [['I', 'Ioana Munteanu', 'ioana.m', '#8C6CFF'], ['M', 'Mihai Stan', 'mihai.s', '#FF6A4D'], ['S', 'Sara Pop', 'sara.p', '#FFD43B'], ['R', 'Radu Ene', 'radu.e', '#5FD39A']];
const TAKEN = ['cornel', 'andrei', 'maria', 'ana', 'radu', 'ioana'];
const STEPS = ['start', 'name', 'zone', 'likes', 'style', 'picks', 'friends', 'done']; // no phone step until SMS is paid for
const clean = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 20);

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.timers = [];
    this.state = this.fresh();
  }
  fresh() {
    return { step: 'start', zoneId: APP.prefs.zone || 'centru', theme: this.state ? this.state.theme : null, phone: '', sent: false, code: '', codeBad: false, first: '', user: '', year: null, birth: '', birthIso: '', ageAsk: false, authErr: '', dist: '20', moves: ['walk', 'car'], likes: [], budget: '100', who: 'group', when: ['eve', 'we'], mood: 'mix', pick: 0, votes: [], synced: false, added: [] };
  }
  componentWillUnmount() { this.timers.forEach((t) => clearTimeout(t)); }
  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  go(step) { this.setState({ step }); }
  renderVals() {
    const s = this.state;
    const theme = s.theme || this.props.theme || 'zi';
    const k = STEPS.indexOf(s.step);
    const set = (patch) => this.setState(patch);
    const first = s.first.trim();
    const likesN = s.likes.length;
    const yes = s.votes.filter((v) => v === 'yes').length;
    const on = (x) => (x ? 'press chip on' : 'press chip');
    const seg = (x) => (x ? 'press seg on' : 'press seg');
    const SAY = {
      phone: ['hi', 'Salut! Întâi numărul tău. Îți trimit un cod, ca să știu că ești tu.'],
      name: s.ageAsk ? ['oops', 'Stai puțin! Verific o dată cu tine data nașterii.'] : ['wink', 'Salut! Cum să-ți zic? Prietenii te găsesc după username.'],
      zone: ['up', 'Spune-mi de unde pleci și cât de departe ești dispus să mergi pentru o seară bună.'],
      likes: ['hi', likesN >= 3 ? 'Bun gust! Mai alege dacă vrei, sau mergi mai departe.' : 'Alege măcar 3 lucruri care îți plac. Așa știu de unde să încep.'],
      style: ['wink', 'Încă puțin: cât cheltui de obicei și când ieși. Nu te judec, promit.'],
      picks: ['up', s.pick === 0 ? 'Aproape gata: 5 locuri reale din zona ta. Zi-mi repede dacă ai merge.' : (s.votes[s.votes.length - 1] === 'yes' ? 'Notat! Îmi place cum gândești.' : (s.votes[s.votes.length - 1] === 'no' ? 'Ok, pe ăsta nu ți-l mai arăt des.' : 'Hmm, bine. Îl las pe „poate”.'))],
      friends: ['hi', s.synced ? 'Încă n-am găsit pe nimeni din agendă în CeFaci. Când vin prietenii tăi, îi vezi aici și votați împreună.' : 'Cu prietenii e mai distractiv. Vrei să văd care sunt deja pe CeFaci?']
    };
    const say = SAY[s.step] || ['hi', ''];
    const v = {
      themeClass: theme === 'noapte' ? 'graphite' : 'light',
      themeLabel: theme === 'noapte' ? 'Treci pe tema de zi' : 'Treci pe tema de noapte', themeIcon: theme === 'noapte' ? SUN : MOON,
      toggleTheme: () => set({ theme: theme === 'noapte' ? 'zi' : 'noapte' }),
      isStart: s.step === 'start', isPhone: s.step === 'phone', isName: s.step === 'name', isZone: s.step === 'zone', isLikes: s.step === 'likes', isStyle: s.step === 'style', isPicks: s.step === 'picks', isFriends: s.step === 'friends', isDone: s.step === 'done',
      progW: Math.round(Math.max(0, k - 1) / 6 * 100) + '%', progText: Math.max(1, k) + ' din 6',
      back: () => this.go(STEPS[Math.max(0, k - 1)]),
      next: () => this.go(STEPS[Math.min(STEPS.length - 1, k + 1)]),
      restart: () => this.setState(this.fresh()),
      bl: biluPose(say[0], say[0] === 'up' ? 'ul' : 'c'), say: say[1],
      startBl: biluPose('hi', 'c'), doneBl: biluPose('yay', 'c'),
      goGoogle: () => { this.setState({ authErr: '' }); APP.google().then((err) => { if (err) this.setState({ authErr: err }); }); },
      goLocal: () => this.go('name'), goSso: () => this.setState({ authErr: 'Intrarea cu Apple vine în curând.' }), showApple: false, authErr: s.authErr || ''
    };
    // phone
    const digits = s.phone.replace(/\D/g, '');
    v.phone = s.phone; v.onPhone = (e) => set({ phone: e && e.target ? String(e.target.value).slice(0, 13) : '', sent: false, code: '' });
    v.codeOpen = s.sent; v.code = s.code; v.codeBad = s.codeBad;
    v.onCode = (e) => set({ code: e && e.target ? String(e.target.value).replace(/\D/g, '').slice(0, 6) : '', codeBad: false });
    v.codeDemo = () => set({ code: '318642', codeBad: false });
    v.phoneOff = s.sent ? s.code.length !== 6 : digits.length < 9;
    v.phoneBtn = s.sent ? 'Confirmă codul' : 'Trimite-mi codul';
    v.phoneNext = () => { if (!this.state.sent) { set({ sent: true }); return; } if (this.state.code === '318642') this.go('name'); else set({ codeBad: true }); };
    // name
    const u = clean(s.user);
    v.first = s.first; v.onFirst = (e) => set({ first: e && e.target ? String(e.target.value).slice(0, 24) : '' });
    v.user = u; v.onUser = (e) => set({ user: e && e.target ? clean(e.target.value) : '' });
    v.userTaken = u.length >= 3 && TAKEN.indexOf(u) !== -1;
    v.userOk = u.length >= 3 && !v.userTaken;
    // birth date, typed as ZZ.LL.AAAA; under 16 cannot join, 16-17 see no 18+ places
    const bM = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.birth);
    const bIso = bM ? bM[3] + '-' + bM[2] + '-' + bM[1] : '';
    const bDt = bM ? new Date(Number(bM[3]), Number(bM[2]) - 1, Number(bM[1])) : null;
    const bReal = !!bDt && bDt.getDate() === Number(bM[1]) && bDt.getMonth() === Number(bM[2]) - 1 && bDt.getTime() <= Date.now();
    const age = bReal ? APP.age(bIso) : null;
    const bOk = age !== null && age <= 110;
    v.userSugg = [u + '.ies', u + '_cf', u + (bM ? bM[3].slice(2) : '23')].map((label) => ({ label, pick: () => set({ user: label }) }));
    v.birth = s.birth;
    v.onBirth = (e) => { const dg = String(e && e.target ? e.target.value : '').replace(/\D/g, '').slice(0, 8); set({ birth: dg.length > 4 ? dg.slice(0, 2) + '.' + dg.slice(2, 4) + '.' + dg.slice(4) : (dg.length > 2 ? dg.slice(0, 2) + '.' + dg.slice(2) : dg), ageAsk: false }); };
    v.ageNote = !s.birth ? 'Ca să nu-ți arătăm locuri pentru care n-ai vârsta.' : (!bM ? 'Scrie data așa: 14.05.2004.' : (!bOk ? 'Data nu pare bună. Verifică ziua, luna și anul.' : (age < 16 ? 'CeFaci e de la 16 ani în sus. Revino peste câțiva ani, te așteptăm!' : (age < 18 ? 'Până la 18 ani îți arătăm doar locurile pentru oricine, fără baruri și cluburi.' : 'Perfect, vezi toate locurile, inclusiv cele 18+.'))));
    v.nameOff = first.length < 2 || !v.userOk || !bOk || age < 16;
    v.nameNext = () => this.setState({ ageAsk: true });
    v.ageAsk = !!s.ageAsk && bOk;
    v.ageMinor = bOk && age < 18;
    v.ageTitle = 'Sigur e data corectă?';
    v.ageText = bOk ? s.birth + ' înseamnă că ai ' + age + ' ani.' : '';
    v.ageYes = () => { this.setState({ ageAsk: false, birthIso: bIso }); this.go('zone'); };
    v.ageNo = () => this.setState({ ageAsk: false });
    // zone
    v.dists = [['10', '10 min'], ['20', '20 min'], ['30', '30 min']].map(([key, label]) => ({ label, on: s.dist === key, cls: seg(s.dist === key), pick: () => set({ dist: key }) }));
    v.moves = [['walk', 'Pe jos'], ['car', 'Cu mașina'], ['bus', 'Cu autobuzul'], ['bike', 'Pe bicicletă']].map(([key, label]) => { const o = s.moves.indexOf(key) !== -1; return { label, on: o, cls: on(o), pick: () => set({ moves: o ? s.moves.filter((x) => x !== key) : s.moves.concat([key]) }) }; });
    v.zoneOff = s.moves.length === 0;
    v.zoneGroups = ['București', 'Ilfov'].map((area) => ({ area, zones: APP.zones().filter((z) => z.area === area).map((z) => ({ name: z.name, on: s.zoneId === z.id, cls: on(s.zoneId === z.id), pick: () => set({ zoneId: z.id }) })) }));
    // likes
    v.likes = LIKES.map(([key, label, bg, icon]) => { const o = s.likes.indexOf(key) !== -1; return { label, bg, icon, on: o, cls: o ? 'press tile on' : 'press tile', pick: () => set({ likes: o ? s.likes.filter((x) => x !== key) : s.likes.concat([key]) }) }; });
    v.likesLead = likesN === 0 ? 'Alege măcar 3. Poți schimba oricând.' : (likesN < 3 ? 'Mai alege ' + (3 - likesN) + '.' : likesN + ' alese. Bun început!');
    v.likesOff = likesN < 3; v.likesBtn = likesN < 3 ? 'Alege încă ' + (3 - likesN) : 'Mai departe';
    // style
    const row = (id, label, key, opts, multi) => ({ id, label, opts: opts.map(([val, text]) => { const o = multi ? s[key].indexOf(val) !== -1 : s[key] === val; return { label: text, on: o, cls: seg(o), pick: () => set({ [key]: multi ? (o ? s[key].filter((x) => x !== val) : s[key].concat([val])) : val }) }; }) });
    v.styleRows = [
      row('st-b', 'Cât cheltui de obicei, de persoană', 'budget', [['0', 'Gratis'], ['50', '≤ 50 lei'], ['100', '≤ 100'], ['any', 'Oricât']], false),
      row('st-w', 'Cu cine ieși cel mai des', 'who', [['solo', 'Singur'], ['duo', 'În doi'], ['group', 'Cu gașca']], false),
      row('st-t', 'Când ieși', 'when', [['day', 'Ziua'], ['eve', 'Seara'], ['late', 'Noaptea'], ['we', 'Weekend']], true),
      row('st-m', 'Mai degrabă', 'mood', [['chill', 'Chill'], ['mix', 'Și-și'], ['party', 'Party']], false)
    ];
    v.styleOff = s.when.length === 0;
    // picks
    const real = APP.picksFor(s.likes, s.zoneId, { budget: s.budget, when: s.when, who: s.who, birth: s.birthIso });
    const rp = real[Math.min(s.pick, real.length - 1)];
    const p = rp ? [rp.name, rp.tag, rp.sub, rp.bg, rp.fg, rp.dot, rp.like] : PICKS[Math.min(s.pick, PICKS.length - 1)];
    v.card = { title: p[0], tag: p[1], sub: p[2], bg: p[3], fg: p[4], dot: p[5], icon: (LIKES.find((l) => l[0] === p[6]) || LIKES[5])[3], cls: 'pcard ' + (s.pick % 2 ? 'b' : 'a') };
    v.pickCount = (Math.min(s.pick, 4) + 1) + ' din 5 · ' + yes + ' „da” până acum';
    const vote = (x) => () => { APP.notePick(rp && rp.id, x); const votes = this.state.votes.concat([x]); if (votes.length >= PICKS.length) { this.setState({ votes, pick: PICKS.length }); this.later(() => this.go('friends'), 450); return; } this.setState({ votes, pick: votes.length }); };
    v.voteYes = vote('yes'); v.voteNo = vote('no'); v.voteMaybe = vote('maybe');
    // friends
    v.friendsAsk = !s.synced; v.friendsFound = s.synced;
    v.syncContacts = () => set({ synced: true });
    v.found = FOUND.map(([ini, name, user, bg], i) => { const a = s.added.indexOf(user) !== -1; return { ini, name, user, bg, d: (i * 90) + 'ms', label: a ? 'Cerere trimisă' : 'Adaugă', cls: a ? 'press chip on' : 'press chip', add: () => set({ added: a ? s.added.filter((x) => x !== user) : s.added.concat([user]) }) }; });
    // done
    v.doneTitle = 'Gata' + (first ? ', ' + first : '') + '! Acum te cunosc puțin.';
    const likeNames = s.likes.slice(0, 3).map((key) => LIKES.find((l) => l[0] === key)[1]);
    v.summary = likeNames.map((t) => ({ t })).concat([{ t: 'până la ' + s.dist + ' min' }, { t: ({ '0': 'gratis', '50': '≤ 50 lei', '100': '≤ 100 lei', any: 'orice buget' })[s.budget] }, { t: yes + ' din 5 locuri pe listă' }]);
    return v;
  }
}

return Component;
}
