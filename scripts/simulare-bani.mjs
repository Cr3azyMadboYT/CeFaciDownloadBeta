// Simularea banilor CeFaci (06.10): 24 de luni, 3 modele de plată pentru localuri × 3 scenarii de creștere.
// Rulare: node scripts/simulare-bani.mjs            → tabele în consolă
//         node scripts/simulare-bani.mjs --json F    → scrie toate rezultatele în F (pentru prezentare)
// Toate cifrele sunt presupuneri scrise mai jos, ca să poată fi schimbate și rulate din nou. Sumele sunt în lei.

import fs from 'node:fs';

const LEI_PER_USD = 4.5;
const MONTHS = 24;
const WEEKS_PER_MONTH = 52 / 12;

// ---------- oamenii ----------
/** Cât la sută dintr-o lună de conturi noi mai ies cu aplicația după k luni (luna 0 = luna în care s-au înscris). */
const RETENTION = [0.70, 0.45, 0.35, 0.30, 0.27, 0.25, 0.24, 0.23, 0.22, 0.21, 0.20];
const ret = (k) => RETENTION[Math.min(k, RETENTION.length - 1)];
const OUTINGS_PER_ACTIVE = 1.3;   // ieșiri pe lună făcute cu aplicația, de un om activ
const GROUP = 3;                  // oameni la o ieșire (el + 2 prieteni)
const CURATED = 1055;             // locurile din aplicație (445 alese + 610 bine cotate)
const PARTNER_PULL = 5;           // un partener atrage de 5 ori mai mult decât un loc oarecare (Live Drops, rezervare, zonă aleasă)
const partnerShare = (p, pull = PARTNER_PULL) => Math.min(0.4, (p / CURATED) * pull);

// ---------- localurile ----------
const TIERS = [ // treapta, cât din parteneri, cât cheltuie un om (lei)
  { id: 'mic', share: 0.30, spend: 35 },
  { id: 'mediu', share: 0.55, spend: 110 },
  { id: 'mare', share: 0.15, spend: 200 },
];
const SPEND = TIERS.reduce((s, t) => s + t.share * t.spend, 0); // ~101 lei de om
const VENUE_MARGIN = 0.55;  // cât rămâne localului dintr-un leu încasat de la un om în plus (după marfă și reducerea din drop)
const FOUNDERS = 20;
const BILLED_SHARE = 0.5;   // din ieșirile la parteneri: 30% rezervare + 20% Live Drop; restul vin direct din planuri (0 lei)
const REZ_OF_BILLED = 0.6;

// ---------- modelele ----------
const avg = (vals) => TIERS.reduce((s, t, i) => s + t.share * vals[i], 0);
const PER_HEAD = { rez: avg([2, 5, 8]), drop: avg([3, 7, 10]) }; // v2: lei de om (fondatorii cu 1 leu mai puțin)
// v3 („prețul pieței”, sub TheFork): restul partenerilor 3/4, 7/9, 12/15; fondatorii păstrează prețurile de lansare 2/3, 5/7, 8/10
const MARKET = { rez: avg([3, 7, 12]), drop: avg([4, 9, 15]), fRez: avg([2, 5, 8]), fDrop: avg([3, 7, 10]) };
const perHeadMarket = (founder) => REZ_OF_BILLED * (founder ? MARKET.fRez : MARKET.rez) + (1 - REZ_OF_BILLED) * (founder ? MARKET.fDrop : MARKET.drop);
const perHead = (founder) => REZ_OF_BILLED * (PER_HEAD.rez - (founder ? 1 : 0)) + (1 - REZ_OF_BILLED) * (PER_HEAD.drop - (founder ? 1 : 0));

/** Câte „abonamente de bază” plătește în medie un local care primește în medie `l` grupuri numărate pe lună. */
let BANDS = [5, 15]; // 1–5 grupuri → baza, 6–15 → 2× baza, mai mult → 3× baza
function bandFactor(l) {
  let p = Math.exp(-l), f = 0; // P(0)
  for (let k = 1; k <= 80; k++) { p *= l / k; f += p * (k <= BANDS[0] ? 1 : k <= BANDS[1] ? 2 : 3); }
  return f;
}
const SCANNED = 0.7; // din grupurile venite la un partener, câte scanează codul (pentru XP și ștampilă); garanția se uită la ele
const MODELS = {
  corect: {
    name: 'Pe om, la prețul pieței (fondatorii la prețul de lansare)',
    attract: 0.95,
    pro: true,
    free: (founder) => (founder ? 3 : 1),
    // plafon lunar pe local (199 / 499 / 999 lei) — la volumele din simulare nu se atinge
    fee: (founder, groups) => Math.min(avg([199, 499, 999]), groups * GROUP * BILLED_SHARE * 0.95 * perHeadMarket(founder)),
  },
  procent: {
    name: 'Procent din bon: 10% (fondatorii 8%), doar la rezervări și Live Drops',
    attract: 0.9,
    free: (founder) => (founder ? 3 : 1),
    // nota mesei (după reducerea din drop), din poza bonului sau din „Închide seara”; cel mult 100 lei pe masă;
    // 0,95: același om cel mult 3 vizite cu comision pe an la același local
    fee: (founder, groups) => groups * BILLED_SHARE * 0.95 * Math.min(100, (founder ? 0.08 : 0.10) * GROUP * SPEND * (REZ_OF_BILLED + (1 - REZ_OF_BILLED) * 0.85)),
    pro: true,
  },
  peOm: {
    name: 'Doar pe om (varianta v2)',
    attract: 1.0, // cât de ușor semnează un local (1 = cel mai ușor: nu plătește nimic fix)
    free: (founder) => (founder ? 2 : 1),
    fee: (founder, groups) => groups * GROUP * BILLED_SHARE * 0.95 * perHead(founder), // 0,95: cel mult 3 vizite plătite pe an de același om
  },
  hibrid: {
    name: 'Abonament 99 lei + pe om',
    attract: 0.75, // „plătesc și fix, și pe om”
    free: (founder) => (founder ? 2 : 1),
    fee: (founder, groups) => (founder ? 69 : 99) + groups * GROUP * BILLED_SHARE * perHead(founder),
  },
  abonament: {
    name: 'Abonament simplu pe treaptă, cu garanție',
    attract: 0.9,
    free: (founder) => (founder ? 2 : 1),
    // 49 / 99 / 199 lei, fondatorii −30%; luna fără nicio rezervare onorată și niciun drop folosit e gratuită (garanția)
    fee: (founder, groups) => avg([49, 99, 199]) * (founder ? 0.7 : 1) * (1 - Math.exp(-groups * BILLED_SHARE)),
  },
  trepte: {
    name: 'Abonament după câți clienți aducem (0 / 1–5 / 6–15 / 16+ grupuri)',
    attract: 0.95, // „dacă nu-mi aduceți nimeni, nu plătesc nimic”, și plătesc mai mult doar când aduceți mai mult
    free: (founder) => (founder ? 2 : 1),
    // se numără doar rezervările onorate și Live Drop-urile folosite (vizitele din planuri rămân gratuite), cel mult 3 pe
    // an de la același om: 0 → 0 lei, 1–5 → baza, 6–15 → 2× baza, 16+ → 3× baza; baza: 29 / 99 / 199 lei
    fee: (founder, groups) => avg([29, 99, 199]) * (founder ? 0.7 : 1) * bandFactor(groups * BILLED_SHARE * 0.95),
  },
  abonamentFix: {
    name: 'Abonament simplu pe treaptă, fără garanție',
    attract: 0.8,
    free: (founder) => (founder ? 2 : 1),
    fee: (founder) => avg([49, 99, 199]) * (founder ? 0.7 : 1),
  },
};

// ---------- scenariile ----------
const SCENARIOS = {
  prudent: { name: '25 de oameni noi pe săptămână', perWeek: 25, newPartners: 2, marketing: 200 },
  realist: { name: '75 de oameni noi pe săptămână', perWeek: 75, newPartners: 4, marketing: 600 },
  bun: { name: '150 de oameni noi pe săptămână', perWeek: 150, newPartners: 6, marketing: 1200 },
};
const FOUNDERS_SIGNED = [5, 5]; // fondatori semnați în luna 1 și luna 2

// ---------- Plus ----------
const PLUS_NET = 14.05;        // din 20 lei prin Google Play: fără TVA 21% și comisionul de 15%
const PLUS_START = 4;          // Plus plătit cel mai devreme din luna 4 …
const PLUS_MIN_PARTNERS = 15;  // … și doar cu cel puțin 15 parteneri (altfel nu merită pentru client)
const plusConversion = (p) => Math.min(0.05, 0.004 + p * 0.0006);

// ---------- alte venituri (la fel pentru toate modelele) ----------
const EVENT_RATE = 0.002;   // petreceri și grupuri de 10+ organizate prin CeFaci la parteneri: 2 la 1.000 de oameni activi, pe lună
const EVENT_FEE = 120;      // 99 lei (10–20 oameni) sau 199 (21+), fondatorii −30%: în medie ~120
const SPONSOR = { from: 6, perActives: 600, max: 6, price: 75, fill: 0.5 }; // „Sponsorizat”: sloturi pe săptămână, 75 lei, ocupate 60%
const PRO = { from: 4, price: 49, adoption: (m) => Math.min(0.2, 0.05 + (m - 4) * 0.01) }; // Business Pro opțional (rezervările proprii, statistici)
const sponsorRev = (m, actives) => (m < SPONSOR.from ? 0 : Math.min(SPONSOR.max, Math.floor(actives / SPONSOR.perActives)) * SPONSOR.price * WEEKS_PER_MONTH * SPONSOR.fill);

// ---------- cheltuielile (lei pe lună) ----------
const COSTS = {
  oneTime: { srl: 152, jurist: 2000, googlePlay: 113 },
  firma: { contabil: 250, banca: 20, facturare: 30, domeniu: 4, semnatura: 17 },
  supabase: 113,
  googleAlte: 20,         // vremea + citirea bonurilor
  drum: 150,
  tiparPePartener: 30,    // codul QR cu suport, la fiecare partener nou
  vatForeign: 0.21,       // TVA pe serviciile din străinătate (Supabase, Google)
};
const PLAN_RUNS_PER_ACTIVE = 3;
// Place Details Enterprise (programul): 1.000 gratuite pe lună, apoi 20 $ la 1.000.
// „acum”: la fiecare plan făcut se verifică toate locurile din cele 3 planuri (~10 întrebări, de ~3 ori pe lună de om);
// „la planul ales”: doar locurile din planul pe care îl alegi, și doar cele fără program sigur de pe hartă (~2 de ieșire).
const GOOGLE = { free: 1000, usdPer1000: 20 };
const googleCalls = (actives, mode) => (mode === 'acum' ? actives * PLAN_RUNS_PER_ACTIVE * 10 : actives * OUTINGS_PER_ACTIVE * 2);
const googleCost = (actives, mode) => Math.max(0, googleCalls(actives, mode) - GOOGLE.free) / 1000 * GOOGLE.usdPer1000 * LEI_PER_USD;
const PROFIT_TAX = 0.16;

function simulate(modelId, scenId, opts = {}) {
  const model = MODELS[modelId], sc = SCENARIOS[scenId];
  const googleMode = opts.google ?? 'ales';
  const signups = sc.perWeek * WEEKS_PER_MONTH;
  const venues = []; // grupuri de localuri semnate în aceeași lună: { start, founder, n }
  let signedFounders = 0, cum = 0, minCum = 0, lossCarry = 0;
  const rows = [];
  for (let m = 1; m <= MONTHS; m++) {
    // oamenii activi: toate lunile de înscriere de până acum
    let actives = 0;
    for (let c = 1; c <= m; c++) actives += signups * ret(m - c);
    // parteneri noi luna asta
    const fresh = m <= FOUNDERS_SIGNED.length ? FOUNDERS_SIGNED[m - 1] : sc.newPartners * model.attract;
    const asFounders = Math.max(0, Math.min(fresh, FOUNDERS - signedFounders));
    signedFounders += asFounders;
    if (asFounders) venues.push({ start: m, founder: true, n: asFounders });
    if (fresh - asFounders) venues.push({ start: m, founder: false, n: fresh - asFounders });
    const partners = venues.reduce((s, v) => s + v.n, 0);
    const groupsAll = actives * OUTINGS_PER_ACTIVE * partnerShare(partners, opts.pull);
    const lambda = partners ? groupsAll / partners : 0; // grupuri aduse unui partener într-o lună
    // banii de la localuri și plecările
    let venueRev = 0, paying = 0, venueFees = 0, venueValue = 0;
    for (const v of venues) {
      const age = m - v.start; // luni de la semnare (0 = luna semnării)
      const free = age < model.free(v.founder);
      const fee = free ? 0 : model.fee(v.founder, lambda, age);
      venueRev += fee * v.n;
      if (!free) { paying += v.n; venueFees += fee * v.n; }
      const value = lambda * GROUP * SPEND * VENUE_MARGIN;
      venueValue += value * v.n;
      // cine pleacă la sfârșitul lunii: puțini oameni aduși sau taxa mai mare decât folosul
      const ratio = fee > 0 ? value / fee : Infinity;
      let churn = 0.02 + (lambda < 0.5 ? 0.06 : lambda < 1.5 ? 0.03 : 0);
      if (!free) churn += ratio < 1 ? 0.12 : ratio < 2 ? 0.05 : 0;
      if (v.founder) churn *= 0.7;
      v.n *= 1 - churn;
    }
    // Plus
    const plusOn = m >= PLUS_START && partners >= PLUS_MIN_PARTNERS;
    const plusSubs = plusOn ? actives * plusConversion(partners) : 0;
    const plusRev = plusSubs * PLUS_NET;
    // cheltuieli
    const google = googleCost(actives, googleMode);
    const foreign = COSTS.supabase + COSTS.googleAlte + google;
    const fixed = Object.values(COSTS.firma).reduce((a, b) => a + b, 0);
    const costs = (m === 1 ? Object.values(COSTS.oneTime).reduce((a, b) => a + b, 0) : 0)
      + fixed + foreign * (1 + COSTS.vatForeign) + COSTS.drum + sc.marketing + fresh * COSTS.tiparPePartener;
    const eventRev = m >= 2 ? actives * EVENT_RATE * EVENT_FEE * Math.min(1, partners / 20) : 0;
    const sponRev = opts.extras === false ? 0 : sponsorRev(m, actives);
    const proRev = model.pro && m >= PRO.from ? partners * PRO.adoption(m) * PRO.price : 0;
    const revenue = venueRev + plusRev + (opts.extras === false ? 0 : eventRev) + sponRev + proRev;
    const pre = revenue - costs; // înainte de impozit
    // impozitul pe profit, pus deoparte lună de lună (16% din profitul anului de până acum, după ce scade pierderea
    // reportată din anii trecuți, care acoperă cel mult 70% din profit); la sfârșitul anului se reportează pierderea
    const yearStart = Math.floor((m - 1) / 12) * 12;
    const ytd = rows.slice(yearStart).reduce((s, r) => s + r.pre, 0) + pre;
    const taxDue = ytd > 0 ? (ytd - Math.min(lossCarry, ytd * 0.7)) * PROFIT_TAX : 0;
    const taxSoFar = rows.slice(yearStart).reduce((s, r) => s + r.tax, 0);
    const tax = taxDue - taxSoFar;
    if (m % 12 === 0) { if (ytd > 0) lossCarry -= Math.min(lossCarry, ytd * 0.7); else lossCarry += -ytd; }
    const profit = pre - tax;
    cum += profit;
    minCum = Math.min(minCum, cum);
    rows.push({
      m, actives: Math.round(actives), registered: Math.round(signups * m), partners: +partners.toFixed(1), paying: +paying.toFixed(1),
      groupsPerPartner: +lambda.toFixed(2), venueRev: Math.round(venueRev), plusSubs: Math.round(plusSubs), plusRev: Math.round(plusRev), eventRev: Math.round(opts.extras === false ? 0 : eventRev), sponRev: Math.round(sponRev), proRev: Math.round(proRev),
      take: lambda ? +(((paying ? venueFees / paying : 0)) / (lambda * BILLED_SHARE * GROUP * SPEND)).toFixed(3) : 0,
      revenue: Math.round(revenue), costs: Math.round(costs), google: Math.round(google), pre: Math.round(pre), tax, profit: Math.round(profit), cum: Math.round(cum),
      venueFeeAvg: paying ? Math.round(venueFees / paying) : 0, venueValueAvg: partners ? Math.round(venueValue / partners) : 0,
    });
  }
  const firstPlus = rows.find((r, i) => r.pre >= 0 && rows.slice(i).every((x) => x.pre >= 0))?.m ?? null;
  const payback = rows.find((r) => r.cum >= 0 && r.m > 1)?.m ?? null;
  return {
    model: modelId, scenario: scenId, rows, firstPlus, payback, cashNeeded: Math.round(-minCum),
    year1: Math.round(rows.slice(0, 12).reduce((s, r) => s + r.profit, 0)), year2: Math.round(rows.slice(12).reduce((s, r) => s + r.profit, 0)),
  };
}

export const ALL = {};
for (const s of Object.keys(SCENARIOS)) for (const mo of Object.keys(MODELS)) ALL[mo + '/' + s] = simulate(mo, s);
export const GOOGLE_NOW = Object.fromEntries(Object.keys(SCENARIOS).map((s) => [s, simulate('abonament', s, { google: 'acum' })]));

export function sensitivity() {
  const out = {};
  for (const s of Object.keys(SCENARIOS)) {
    const base = simulate('corect', s);
    const zone = simulate('corect', s, { pull: 8 });
    const noExtras = simulate('corect', s, { extras: false });
    const googleNow = simulate('corect', s, { google: 'acum' });
    out[s] = { base: [base.year1, base.year2, base.cashNeeded, base.firstPlus, base.payback], zona: [zone.year1, zone.year2, zone.cashNeeded, zone.firstPlus, zone.payback], faraExtra: [noExtras.year1, noExtras.year2], googleAcum: [googleNow.year1, googleNow.year2] };
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('simulare-bani.mjs')) {
  if (process.argv.includes('--sens')) console.log(JSON.stringify(sensitivity(), null, 1));
  const out = process.argv.indexOf('--json');
  if (out > 0) {
    fs.writeFileSync(process.argv[out + 1], JSON.stringify({ ALL, GOOGLE_NOW, SCENARIOS, MODELS: Object.fromEntries(Object.entries(MODELS).map(([k, v]) => [k, v.name])), SPEND, perHead: { non: perHead(false), founder: perHead(true) } }, null, 1));
  }
  console.log('Cheltuiala medie a unui om la un partener: ' + SPEND.toFixed(0) + ' lei; taxa pe om (pe-om): ' + perHead(false).toFixed(2) + ' / fondator ' + perHead(true).toFixed(2));
  for (const s of Object.keys(SCENARIOS)) {
    console.log('\n=== ' + SCENARIOS[s].name + ' ===');
    console.log('model'.padEnd(12) + 'pe plus din'.padStart(12) + 'recuperat în'.padStart(14) + 'bani necesari'.padStart(15) + 'anul 1'.padStart(10) + 'anul 2'.padStart(10));
    for (const mo of Object.keys(MODELS)) {
      const r = ALL[mo + '/' + s];
      console.log(mo.padEnd(12) + String(r.firstPlus ?? '—').padStart(12) + String(r.payback ?? '—').padStart(14) + String(r.cashNeeded).padStart(15) + String(r.year1).padStart(10) + String(r.year2).padStart(10));
    }
    const g = GOOGLE_NOW[s];
    console.log('abonament cu verificarea Google de acum: anul 1 ' + g.year1 + ', anul 2 ' + g.year2 + ', Google luna 12: ' + g.rows[11].google + ' lei, luna 24: ' + g.rows[23].google + ' lei');
    const r = ALL['abonament/' + s];
    console.log('luna  activi  parteneri  grupuri/partener  local(lei)  Plus  venit  cheltuieli  profit  cumulat');
    for (const x of r.rows.filter((x) => [1, 2, 3, 4, 6, 9, 12, 18, 24].includes(x.m))) {
      console.log(String(x.m).padStart(4) + String(x.actives).padStart(8) + String(x.partners).padStart(11) + String(x.groupsPerPartner).padStart(18) + String(x.venueRev).padStart(12) + String(x.plusRev).padStart(6) + String(x.revenue).padStart(7) + String(x.costs).padStart(12) + String(x.profit).padStart(8) + String(x.cum).padStart(9));
    }
  }
}
