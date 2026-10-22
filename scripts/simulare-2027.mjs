// Simularea banilor CeFaci pe 2027 (22.10), cu modelul de la 20.10: localurile dau 10% din bonurile fiecărei intrări CeFaci,
// clienții pot lua Plus (20 lei/lună). Fără abonament pentru localuri, fără „Sponsorizat”, fără bilete (amânate).
// Rulare: node scripts/simulare-2027.mjs          → tabele în consolă
//         node scripts/simulare-2027.mjs --json F → toate lunile în F
// Toate cifrele de mai jos sunt presupuneri, ca să poată fi schimbate și rulate din nou. Sumele sunt în lei.

import fs from 'node:fs';

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const WEEKS_PER_MONTH = 52 / 12;
const LEI_PER_USD = 4.5;

// ---------- oamenii ----------
/** Cât la sută dintr-o lună de conturi noi mai ies cu aplicația după k luni (luna 0 = luna în care s-au înscris). */
const RETENTION = [0.70, 0.45, 0.35, 0.30, 0.27, 0.25, 0.24, 0.23, 0.22, 0.21, 0.20];
const ret = (k) => RETENTION[Math.min(k, RETENTION.length - 1)];
const OUTINGS_PER_ACTIVE = 1.3; // ieșiri pe lună făcute cu aplicația de un om activ
const GROUP = 3;                // oameni la o ieșire (el + 2 prieteni)
// Iarna și vara se iese altfel: decembrie (sărbători) și vara (terase) mai mult, ianuarie-februarie mai puțin.
const SEASON = [0.85, 0.85, 0.95, 1, 1.05, 1.1, 1.1, 1.0, 1.05, 1, 1, 1.2];

// ---------- localurile ----------
const CURATED = 1055;     // locurile din aplicație (445 alese + 610 bine cotate)
const PARTNER_PULL = 5;   // un partener apare mai des (Live Drops, Plus, „partener”) decât un loc oarecare
const partnerShare = (p) => Math.min(0.4, (p / CURATED) * PARTNER_PULL);
const SPEND = 101;        // cât cheltuie un om la un partener, în medie (ieftin 35 / mediu 110 / scump 200)
const DISCOUNT = 0.05;    // reducerea medie pe bon (Live Drop / Plus pe o parte din mese); 10% se ia după reducere
const BILL_FOUND = 0.8;   // din intrări, câte au bon (scanat de client, de ospătar sau scris de local); restul = 0 lei
const DISPUTED = 0.02;    // bonuri contestate și scoase
const RATE = 0.10;
const FOUNDERS = 20;      // primii 20: o lună gratis; ceilalți plătesc din prima zi (Cornel, 22.10)
const VENUE_MARGIN = 0.55;

// ---------- Plus ----------
const PLUS_NET = 14.05;          // din 20 lei prin Google Play: fără TVA 21% și comisionul de 15%
const PLUS_MIN_PARTNERS = 15;    // Plus se vinde doar când are destule localuri cu reducere
const plusConversion = (p) => Math.min(0.05, 0.004 + p * 0.0006);

// ---------- scenariile ----------
const SCENARIOS = {
  prudent: { name: 'Prudent: 25 de oameni noi pe săptămână', perWeek: 25, newPartners: 2, marketing: 200 },
  realist: { name: 'Realist: 75 de oameni noi pe săptămână', perWeek: 75, newPartners: 4, marketing: 600 },
  bun: { name: 'Bun: 150 de oameni noi pe săptămână', perWeek: 150, newPartners: 6, marketing: 1200 },
};
const FOUNDERS_SIGNED = [5, 5]; // fondatori semnați în ianuarie și februarie

// ---------- cheltuielile (lei pe lună) ----------
const ONE_TIME = { srl: 152, jurist: 2000, googlePlay: 113 };
const FIRM = { contabil: 250, banca: 20, facturare: 30, domeniu: 4, semnatura: 17 };
const SUPABASE = 113, GOOGLE_OTHER = 20, VAT_FOREIGN = 0.21, ROAD = 150, QR_PER_PARTNER = 30;
// „E deschis?” pe Google: 1.000 gratuite pe lună, apoi 20 $ la 1.000; cam 2 întrebări pe ieșire
const googleCost = (actives) => Math.max(0, actives * OUTINGS_PER_ACTIVE * 2 - 1000) / 1000 * 20 * LEI_PER_USD;
// Citirea bonurilor (Vision): 1.000 gratuite, apoi 1,5 $ la 1.000
const visionCost = (bills) => Math.max(0, bills - 1000) / 1000 * 1.5 * LEI_PER_USD;
const MICRO_TAX = 0.03;    // impozit pe venit la microîntreprindere (1% sau 3%, după activitate: de confirmat cu contabilul)
const DIVIDEND_TAX = 0.16; // când scoți banii din firmă

function simulate(id) {
  const sc = SCENARIOS[id];
  const signups = sc.perWeek * WEEKS_PER_MONTH;
  const venues = [];
  let signed = 0, cash = 0, low = 0;
  const rows = [];
  for (let m = 0; m < 12; m++) {
    let actives = 0;
    for (let c = 0; c <= m; c++) actives += signups * ret(m - c);
    const fresh = m < FOUNDERS_SIGNED.length ? FOUNDERS_SIGNED[m] : sc.newPartners;
    const asFounders = Math.max(0, Math.min(fresh, FOUNDERS - signed));
    signed += asFounders;
    if (asFounders) venues.push({ start: m, founder: true, n: asFounders });
    if (fresh - asFounders) venues.push({ start: m, founder: false, n: fresh - asFounders });
    const partners = venues.reduce((s, v) => s + v.n, 0);
    const entries = actives * OUTINGS_PER_ACTIVE * SEASON[m] * partnerShare(partners);
    const perVenue = partners ? entries / partners : 0;
    const billPerEntry = GROUP * SPEND * (1 - DISCOUNT);
    const feePerEntry = billPerEntry * RATE * BILL_FOUND * (1 - DISPUTED);
    let venueRev = 0, wouldPay = 0;
    for (const v of venues) {
      const free = v.founder && m - v.start < 1;
      const fee = perVenue * feePerEntry;
      if (free) wouldPay += fee * v.n; else venueRev += fee * v.n;
      // plecări: puțini oameni aduși sau taxa prea mare față de câștig
      const value = perVenue * GROUP * SPEND * VENUE_MARGIN;
      let churn = 0.02 + (perVenue < 0.5 ? 0.06 : perVenue < 1.5 ? 0.03 : 0);
      if (!free && fee > 0 && value / fee < 2) churn += 0.05;
      if (v.founder) churn *= 0.7;
      v.n *= 1 - churn;
    }
    const plusSubs = m >= 3 && partners >= PLUS_MIN_PARTNERS ? actives * plusConversion(partners) : 0;
    const plusRev = plusSubs * PLUS_NET;
    const revenue = venueRev + plusRev;
    const bills = entries * BILL_FOUND * 1.4; // un bon e scanat uneori de mai mulți
    const foreign = SUPABASE + GOOGLE_OTHER + googleCost(actives) + visionCost(bills);
    const costs = (m === 0 ? Object.values(ONE_TIME).reduce((a, b) => a + b, 0) : 0)
      + Object.values(FIRM).reduce((a, b) => a + b, 0) + foreign * (1 + VAT_FOREIGN) + ROAD + sc.marketing + fresh * QR_PER_PARTNER;
    const tax = revenue * MICRO_TAX;
    const profit = revenue - costs - tax;
    cash += profit; low = Math.min(low, cash);
    rows.push({
      month: MONTHS[m], actives: Math.round(actives), partners: Math.round(partners * 10) / 10, entries: Math.round(entries),
      perVenue: Math.round(perVenue * 10) / 10, venueRev: Math.round(venueRev), wouldPay: Math.round(wouldPay),
      plusSubs: Math.round(plusSubs), plusRev: Math.round(plusRev), revenue: Math.round(revenue), costs: Math.round(costs),
      tax: Math.round(tax), profit: Math.round(profit), cash: Math.round(cash),
    });
  }
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const year = { venueRev: sum('venueRev'), plusRev: sum('plusRev'), revenue: sum('revenue'), costs: sum('costs'), tax: sum('tax'), profit: sum('profit'), entries: sum('entries') };
  return { id, name: sc.name, rows, year, low: Math.round(low), feePerEntry: Math.round(GROUP * SPEND * (1 - DISCOUNT) * RATE * 10) / 10,
    takeHome: Math.max(0, Math.round(year.profit * (1 - DIVIDEND_TAX))) };
}

const all = Object.keys(SCENARIOS).map(simulate);
const out = process.argv.indexOf('--json');
if (out > 0) fs.writeFileSync(process.argv[out + 1], JSON.stringify(all, null, 2));
else for (const s of all) {
  console.log(`\n=== ${s.name} ===`);
  console.table(s.rows.map((r) => ({ luna: r.month, activi: r.actives, parteneri: r.partners, intrari: r.entries, 'intrări/local': r.perVenue,
    '10%': r.venueRev, 'ar fi plătit': r.wouldPay, Plus: r.plusSubs, 'bani Plus': r.plusRev, venit: r.revenue, cheltuieli: r.costs, profit: r.profit, cont: r.cash })));
  console.log('An:', s.year, '| cel mai jos în cont:', s.low, '| rămâne după dividende:', s.takeHome);
}
