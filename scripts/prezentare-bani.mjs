// Prezentarea „Cum câștigăm toți trei” (06.10): PDF din simularea banilor (scripts/simulare-bani.mjs).
// Rulare: node scripts/prezentare-bani.mjs   → docs/prezentare/CeFaci-cum-castigam-toti-trei.pdf (+ PNG-uri de control, dacă dai un folder)
// Cifrele din grafice și tabele vin direct din simulare; textele de mai jos le folosesc prin funcții, nu scrise de mână.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ALL, GOOGLE_NOW, sensitivity } from './simulare-bani.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, 'docs/prezentare');
const PDF = path.join(OUT_DIR, 'CeFaci-cum-castigam-toti-trei.pdf');
const SHOTS = process.argv[2]; // opțional: folder pentru pozele fiecărei pagini (verificare)
const FONTS = path.join(ROOT, 'mobile/node_modules/@expo-google-fonts');

// ---------- cifrele ----------
const fix = (t) => t.replace(/\u00a0/g, '.').replace(/^-/, '−');
const lei = (n) => fix(Math.round(n).toLocaleString('ro-RO')) + ' lei';
const r100 = (n) => Math.round(n / 100) * 100;
const num = (n) => fix(Math.round(n).toLocaleString('ro-RO'));
const k = (n) => (Math.abs(n) >= 10000 ? fix((Math.round(n / 100) / 10).toLocaleString('ro-RO')) + ' mii' : num(r100(n))) + ' lei';
const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString('ro-RO') + '%';
const R = (model, sc) => ALL[model + '/' + sc];
const rec = { prudent: R('corect', 'prudent'), realist: R('corect', 'realist'), bun: R('corect', 'bun') };
const SENS = sensitivity();
const takeAvg = (r, from, to) => { const xs = r.rows.slice(from - 1, to).filter((x) => x.take > 0); return xs.reduce((s, x) => s + x.take, 0) / xs.length; };
const MODEL_ROWS = [
  { id: 'peOm', name: 'Pe om, cum era (v2)', fixed: false, fights: 'puține' },
  { id: 'corect', name: 'Pe om, la prețul pieței', fixed: false, fights: 'puține', best: true },
  { id: 'abonamentFix', name: 'Abonament fix (49 / 99 / 199 lei)', fixed: true, fights: 'deloc' },
  { id: 'trepte', name: 'Abonament după câte mese aducem', fixed: false, fights: 'la praguri' },
  { id: 'hibrid', name: 'Abonament 99 lei + pe om', fixed: true, fights: 'multe' },
].map((m) => ({ ...m, y1: R(m.id, 'realist').year1, y2: R(m.id, 'realist').year2, y1p: R(m.id, 'prudent').year1, takeLow: takeAvg(R(m.id, 'prudent'), 4, 12), takeMid: takeAvg(R(m.id, 'realist'), 4, 12) }));
const realist = rec.realist, rows = realist.rows;
const m = (r, i) => r.rows[i - 1];

// ---------- culori (paleta validată pe fundal alb: albastru, portocaliu, verde-apă, galben) ----------
const C = { ink: '#0E1440', ink2: '#454E7E', ink3: '#5A6390', mute: '#8A90AE', line: '#E3E6EF', grid: '#ECEEF4', base: '#C3C7D6', s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', gray: '#C9CDDA', neg: '#e34948', yellow: '#FFD43B', coral: '#FF6A4D', blue: '#2F5BFF', violet: '#8C6CFF', green: '#1E7A4C', bg: '#F2F3F8' };

// ---------- grafice (SVG, fără hover: totul are etichete sau tabel alături) ----------
function hbars({ items, max, w = 560, row = 44, label = 230, fmt = (v) => v, ref = [] }) {
  const plot = w - label - 70, h = items.length * row + (ref.length ? 26 : 6);
  const x = (v) => label + (v / max) * plot;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans">`;
  for (const r of ref) s += `<line x1="${x(r.v)}" x2="${x(r.v)}" y1="0" y2="${items.length * row}" stroke="${C.base}" stroke-width="1"/><text x="${x(r.v)}" y="${items.length * row + 18}" text-anchor="middle" font-size="13" fill="${C.ink3}">${r.label}</text>`;
  items.forEach((it, i) => {
    const y = i * row + (row - 22) / 2, bw = Math.max(4, x(it.v) - label);
    s += `<text x="${label - 14}" y="${y + 16}" text-anchor="end" font-size="16" font-weight="${it.hi ? 700 : 500}" fill="${C.ink}">${it.name}</text>`;
    s += `<path d="M${label} ${y} h${bw - 4} q4 0 4 4 v14 q0 4 -4 4 h-${bw - 4} z" fill="${it.color ?? (it.hi ? C.s1 : C.gray)}"/>`;
    s += `<text x="${label + bw + 10}" y="${y + 16}" font-size="16" font-weight="700" fill="${C.ink}">${fmt(it.v)}</text>`;
  });
  return s + '</svg>';
}

function lines({ series, w = 760, h = 330, months = 24, yFmt = k, zero = true, endLabels = true }) {
  const pad = { l: 78, r: 150, t: 16, b: 34 };
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const step = niceStep((hi - lo) / 5);
  const y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  const X = (i) => pad.l + (i / (months - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans">`;
  for (let v = y0; v <= y1 + 1e-6; v += step) {
    s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 && zero ? C.base : C.grid}" stroke-width="1"/>`;
    s += `<text x="${pad.l - 10}" y="${Y(v) + 5}" text-anchor="end" font-size="13" fill="${C.ink3}" style="font-variant-numeric:tabular-nums">${yFmt(v)}</text>`;
  }
  for (const i of [0, 5, 11, 17, 23]) s += `<text x="${X(i)}" y="${h - 10}" text-anchor="middle" font-size="13" fill="${C.ink3}">luna ${i + 1}</text>`;
  const ends = [];
  for (const sr of series) {
    s += `<polyline fill="none" stroke="${sr.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${sr.values.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`;
    const last = sr.values[sr.values.length - 1];
    s += `<circle cx="${X(sr.values.length - 1)}" cy="${Y(last)}" r="5" fill="${sr.color}" stroke="#fff" stroke-width="2"/>`;
    ends.push({ y: Y(last), sr, last });
    for (const mk of sr.marks ?? []) s += `<circle cx="${X(mk.i)}" cy="${Y(sr.values[mk.i])}" r="5" fill="${sr.color}" stroke="#fff" stroke-width="2"/><text x="${X(mk.i)}" y="${Y(sr.values[mk.i]) + (mk.below ? 24 : -12)}" text-anchor="middle" font-size="13" font-weight="600" fill="${C.ink}">${mk.text}</text>`;
  }
  if (endLabels) {
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 36) ends[i].ly = (ends[i - 1].ly ?? ends[i - 1].y) + 36;
    for (const e of ends) {
      const ly = e.ly ?? e.y;
      if (e.ly) s += `<line x1="${w - pad.r + 6}" x2="${w - pad.r + 14}" y1="${e.y}" y2="${ly - 4}" stroke="${C.base}"/>`;
      s += `<text x="${w - pad.r + 16}" y="${ly - 6}" font-size="13" fill="${C.ink2}">${e.sr.name}</text><text x="${w - pad.r + 16}" y="${ly + 11}" font-size="15" font-weight="700" fill="${C.ink}">${yFmt(e.last)}</text>`;
    }
  }
  return s + '</svg>';
}
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

function stacks({ bars, segs, w = 640, row = 66, label = 90 }) {
  const max = Math.max(...bars.map((b) => segs.reduce((s, sg) => s + b.v[sg.key], 0)));
  const plot = w - label - 110, h = bars.length * row + 4;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Instrument Sans">`;
  bars.forEach((b, i) => {
    const y = i * row + 12; let x = label; let total = 0;
    s += `<text x="${label - 14}" y="${y + 24}" text-anchor="end" font-size="16" font-weight="600" fill="${C.ink}">${b.name}</text>`;
    segs.forEach((sg, j) => {
      const v = b.v[sg.key]; total += v; const sw = (v / max) * plot; if (sw <= 0.5) return;
      const last = j === segs.length - 1 || segs.slice(j + 1).every((n) => b.v[n.key] <= 0);
      const ww = Math.max(0, sw - (last ? 0 : 2));
      s += last ? `<path d="M${x} ${y} h${Math.max(0, ww - 4)} q4 0 4 4 v28 q0 4 -4 4 h-${Math.max(0, ww - 4)} z" fill="${sg.color}"/>` : `<rect x="${x}" y="${y}" width="${ww}" height="36" fill="${sg.color}"/>`;
      const txt = num(v);
      if (ww > txt.length * 9 + 14) s += `<text x="${x + ww / 2}" y="${y + 23}" text-anchor="middle" font-size="14" font-weight="700" fill="${sg.dark ? '#fff' : C.ink}">${txt}</text>`;
      x += sw;
    });
    s += `<text x="${x + 10}" y="${y + 24}" font-size="16" font-weight="700" fill="${C.ink}">${lei(total)}</text>`;
  });
  return s + '</svg>';
}

// ---------- paginile ----------
const pages = [];
const page = (html, cls = '') => pages.push(`<section class="slide ${cls}">${html}<div class="foot"><span>CeFaci · Cum câștigăm toți trei · 6 octombrie 2026</span><span>${pages.length + 1}</span></div></section>`);
const phone = (img, h = 520, crop = 0) => `<div class="phone" style="height:${h}px;width:${Math.round((h + crop * h / 915) * 412 / 915)}px"><img src="img/${img}" style="width:100%;margin-top:-${Math.round(crop * h / 915)}px"></div>`;
const bilu = (img, size, style = '') => `<div class="bilu" style="width:${size}px;height:${size}px;${style}"><img src="img/${img}" style="width:${Math.round(size * 1.75)}px;height:${Math.round(size * 1.75)}px;margin:-${Math.round(size * 0.36)}px 0 0 -${Math.round(size * 0.375)}px"></div>`;

// 1. Coperta
page(`<div class="cover-l">
  <div class="kicker light">Planul CeFaci · 6 octombrie 2026</div>
  <h1 class="cover-title">Cum câștigăm<br>toți trei</h1>
  <p class="cover-sub">Clientul, localul și CeFaci: cine ce primește, cine ce plătește, când ieșim pe plus și cum lansăm în 3 săptămâni.</p>
  <div class="chips"><span>5 variante de bani comparate</span><span>3 scenarii de creștere</span><span>24 de luni simulate</span></div>
</div><img class="cover-img" src="img/bilu-toamna.png">`, 'cover');

// 2. Pe scurt
page(`<div class="kicker">Pe scurt</div><h1>Varianta aleasă, în trei fraze</h1>
<div class="three">
  <div class="card c-client"><div class="tag">Clientul</div><h3>Aplicația e gratuită</h3><p>Primește planuri în sub un minut, reduceri adevărate la Live Drops și, dacă vrea, Plus: 20 lei pe lună pentru reduceri la parteneri.</p><div class="big">0 lei<small>ca să folosească aplicația</small></div></div>
  <div class="card c-local"><div class="tag">Localul</div><h3>Nimic fix de plătit</h3><p>Plătește doar oamenii aduși prin rezervare sau Live Drop: <b>7 lei de om</b> la un restaurant sau bar. Mai ieftin decât TheFork, de vreo 4 ori sub Glovo.</p><div class="big">~6%<small>din ce lasă oamenii aduși de noi</small></div></div>
  <div class="card c-noi"><div class="tag">CeFaci</div><h3>Pe plus din luna ${realist.firstPlus}</h3><p>La 75 de oameni noi pe săptămână: banii puși înapoi în luna ${realist.payback} și ~${k(realist.year2)} profit în anul 2.</p><div class="big">${k(realist.year2)}<small>profit în anul 2</small></div></div>
</div>
<div class="banner">${bilu('bilu-toamna-fg.png', 84, 'margin:-10px 8px -10px -8px')}<div><b>Ideea de bază:</b> banii mari nu vin din a lua mai mult de la localuri, ci din mai mulți oameni în aplicație. De aceea planul pune creșterea pe primul loc.</div></div>`);

// 3. Cum merge
page(`<div class="kicker">Cum merge</div><h1>Drumul banilor, într-o imagine</h1>
<div class="flow">
  <div class="step"><div class="thumb"><img src="img/app-acasa.png"></div><div><div class="ico" style="background:${C.yellow}">1</div><h4>Omul deschide CeFaci</h4><p>„Ce facem în seara asta?” Răspunde la 5 întrebări.</p></div></div>
  <div class="arrow">→</div>
  <div class="step"><div class="thumb"><img src="img/app-surpriza.png" style="margin-top:-118px"></div><div><div class="ico" style="background:${C.blue};color:#fff">2</div><h4>Bilu face 3 planuri</h4><p>Deschise la ora lor, în buget, aproape. Partenerii nu urcă în top.</p></div></div>
  <div class="arrow">→</div>
  <div class="step"><div class="thumb"><img src="img/app-loc.png"></div><div><div class="ico" style="background:${C.coral};color:#fff">3</div><h4>Merg la local</h4><p>Scanează codul CeFaci de la bar: ștampilă, XP și oferta pe ecran.</p></div></div>
</div>
<div class="money">
  <div class="m-box"><div class="m-who">Local obișnuit, sau vizită fără rezervare și fără ofertă</div><div class="m-val">0 lei</div><div class="m-note">reclama care îl convinge să devină partener</div></div>
  <div class="m-box hi"><div class="m-who">Local partener: rezervare prin CeFaci sau Live Drop</div><div class="m-val">7 lei de om</div><div class="m-note">la un restaurant sau bar; doar cine a venit</div></div>
  <div class="m-box"><div class="m-who">Clientul care vrea mai mult</div><div class="m-val">Plus · 20 lei/lună</div><div class="m-note">reduceri 10–20% la parteneri, pentru el și 3 prieteni</div></div>
</div>`);

// 4. Clientul
page(`<div class="split"><div class="col-text">
<div class="kicker">Pentru client</div><h1>Gratis, cu reduceri adevărate</h1>
<ul class="list">
  <li><b>Gratis, pentru totdeauna:</b> planuri în sub un minut, votul cu gașca, biletul serii, carnetul cu ștampile.</li>
  <li><b>Live Drops:</b> −10–15% la parteneri, pe orele lor mai goale. Gratis.</li>
  <li><b>Plus (opțional), 20 lei pe lună:</b> −10–20% la parteneri pentru el și încă 3 prieteni de la masă, drop-urile cu 10 minute mai devreme, Bilu auriu. Pornește când avem cel puțin 15 parteneri; doar de la 18 ani.</li>
  <li><b>Încredere:</b> recomandările nu se cumpără. Un partener nu urcă în top pentru că plătește.</li>
</ul>
<div class="example"><b>Exemplu.</b> Maria iese de 2 ori pe lună la parteneri, cu 3 prieteni, cam 100 lei de om. Cu Plus (−15%) economisesc împreună ~120 lei pe lună; ea plătește 20.</div>
</div><div class="col-img">${phone('app-acasa.png', 540)}${phone('app-plus.png', 540)}</div></div>`);

// 5. Localul: prețurile
page(`<div class="kicker">Pentru local</div><h1>Plătește doar oamenii pe care i-am adus</h1>
<div class="split2"><div>
<table class="price">
  <tr><th>Localul (cât cheltuie un om)</th><th>Rezervare</th><th>Live Drop</th><th class="f">Fondatori (primii 20)</th></tr>
  <tr><td>Sub 50 lei · cafenea, desert, bistro</td><td>3 lei</td><td>4 lei</td><td class="f">2 / 3 lei</td></tr>
  <tr class="hi"><td>50–150 lei · restaurant, bar, pub</td><td>7 lei</td><td>9 lei</td><td class="f">5 / 7 lei</td></tr>
  <tr><td>Peste 150 lei · club, restaurant scump</td><td>12 lei</td><td>15 lei</td><td class="f">8 / 10 lei</td></tr>
</table>
<div class="rules">
  <span>Gratis: vizitele din planuri, fără rezervare și fără ofertă</span><span>Copiii sub 12 nu se plătesc</span><span>Cel mult 10 oameni pe masă</span><span>Același om: cel mult 3 vizite plătite pe an</span><span>Plafon lunar: 199 / 499 / 999 lei</span><span>Fondatori: 3 luni gratis (+3 dacă nu vine nimeni)</span>
</div>
<div class="extras"><div><b>Petreceri (11+ oameni):</b> o taxă fixă pe eveniment, de la 49 la 399 lei, după local și mărime.</div><div><b>Business Pro (opțional, din luna 4):</b> 49 lei pe lună. Rezervările clienților lui, prin linkul lui (Instagram, Google), fără taxă pe om.</div></div>
</div>
<div class="mock">
  <div class="mock-top"><span>CeFaci Business</span><b>Azi · vineri</b></div>
  <div class="word"><div>Cuvântul serii</div><b>Lămâie albastră</b><small>îl vede și clientul, doar după o scanare adevărată</small></div>
  <div class="row"><b>20:07</b> Andrei · 4 pers. <span class="pill">Rezervare</span></div>
  <div class="row"><b>21:15</b> Ioana · 3 pers. <span class="pill c">Live Drop −15%</span></div>
  <div class="row"><b>21:40</b> Mihai · 2 pers. <span class="pill p">Plus −20%</span></div>
  <div class="close">Închide seara · <b>Totul e corect</b></div>
</div></div>`);

// 6. De ce merită pentru local
const ex = { rez: 16, drop: 6, spend: 110 };
const exRev = ex.rez * ex.spend + ex.drop * ex.spend * 0.85, exFeeF = ex.rez * 5 + ex.drop * 7, exFee = ex.rez * 7 + ex.drop * 9, exKeep = exRev * 0.55;
page(`<div class="kicker">Pentru local, în cifre</div><h1>La fiecare leu dat nouă, îi rămân ~${Math.round(exKeep / exFeeF)}</h1>
<p class="lead">Un bar din Centrul Vechi, într-o lună bună: <b>4 rezervări (${ex.rez} oameni) și 2 Live Drop-uri (${ex.drop} oameni)</b>, cam ${ex.spend} lei de om.</p>
<div class="tiles"><div class="tile"><small>Încasări aduse de CeFaci</small><b>~${lei(Math.round(exRev / 10) * 10)}</b></div><div class="tile"><small>Plătește CeFaci (fondator)</small><b>${lei(exFeeF)}</b><em>${lei(exFee)} după prețul de piață</em></div><div class="tile ok"><small>Îi rămân după marfă</small><b>~${lei(Math.round(exKeep / 10) * 10)}</b></div></div>
<div class="chart-card"><div class="ct">Cât ia fiecare din banii aduși (aceeași lună, aceiași ${ex.rez + ex.drop} oameni)</div>
${hbars({ items: [{ name: 'Glovo (livrare)', v: 0.30 }, { name: 'TheFork (~2,5 € de om)', v: (ex.rez + ex.drop) * 12.5 / exRev }, { name: 'CeFaci, preț de piață', v: exFee / exRev, hi: true }, { name: 'CeFaci, fondator', v: exFeeF / exRev, hi: true }], max: 0.32, w: 1060, row: 46, label: 280, fmt: pct })}</div>`);

// 7. Povestea unui local
page(`<div class="kicker">Povestea unui local</div><h1>Andrei, de la prima vizită la a 4-a</h1>
<div class="timeline">
  <div class="t"><div class="d">Ziua 0</div><div class="e">Mergi la bar și îi arăți aplicația. Primește prezentarea pentru localuri.</div><div class="v">—</div></div>
  <div class="t"><div class="d">Zilele 1–3</div><div class="e">Cont în Business; CUI verificat la ANAF; semnează administratorul firmei, cu SRL-ul CeFaci.</div><div class="v">—</div></div>
  <div class="t"><div class="d">Luni, 2 nov</div><div class="e">Codul QR la bar și o scanare de probă: e activ. <b>3 luni gratis</b>, până pe 1 februarie.</div><div class="v">—</div></div>
  <div class="t"><div class="d">Vineri, 13 nov</div><div class="e">Maria rezervă pentru 4. Andrei vede „ai fi plătit 20 lei”.</div><div class="v">0 lei</div></div>
  <div class="t"><div class="d">Sâmbătă, 20 feb</div><div class="e">Rezervare pentru 6, vin 5. Închide seara cu un buton.</div><div class="v">5 × 5 = 25 lei</div></div>
  <div class="t small"><div class="d">3–24 martie</div><div class="e">Lista lunii pe 3, contestații 3 zile lucrătoare, factura prin e-Factura, plata în 15 zile.</div><div class="v">factura: 25 lei</div></div>
  <div class="t"><div class="d">Marți, 13 apr</div><div class="e">Live Drop −15% luat pentru 4; unul bea doar apă, deci reducerea e pentru 3.</div><div class="v">3 × 7 = 21 lei</div></div>
  <div class="t"><div class="d">Vineri, 4 iun</div><div class="e">Rezervare pentru 4: a treia vizită plătită a Mariei. De acum, tot anul, e clienta lui.</div><div class="v">4 × 5 = 20 lei</div></div>
</div>
<div class="sum">Total: <b>66 lei</b> pentru 17 oameni care au lăsat ~1.820 lei la bar <span>(3,6%)</span></div>
<div class="why"><div><b>De ce „cel mult 3 vizite plătite pe an”?</b> După a treia, omul e clientul localului, nu al nostru. Așa nu-i cerem bani pentru clienții lui obișnuiți: obiecția „vine la mine de 3 ani” dispare.</div><div><b>Și dacă nu vine nimeni?</b> Nu plătește nimic. Fără abonament, fără minim lunar; poate opri rezervările și Live Drops oricând.</div></div>`);

// 8. Am comparat 5 variante
const best = MODEL_ROWS.find((x) => x.best);
page(`<div class="kicker">Cum am ales</div><h1>Am comparat 5 variante, pe aceleași cifre</h1>
<table class="cmp">
  <tr><th>Varianta</th><th>Anul 2 pentru noi<br><small>75 de oameni noi/săpt.</small></th><th>Cât ia din banii aduși, anul 1<br><small>la 25 · la 75 de oameni/săpt.</small></th><th>Dacă nu aducem pe nimeni</th><th>Certuri pe factură</th></tr>
  ${MODEL_ROWS.map((r) => `<tr class="${r.best ? 'hi' : ''}"><td>${r.best ? '<span class="star">Aleasă</span>' : ''}${r.name}</td><td><div class="minibar"><i style="width:${Math.max(4, r.y2 / 800)}px;background:${r.best ? C.s1 : C.gray}"></i><b>${k(r.y2)}</b></div></td><td>${pct(r.takeLow)} · ${pct(r.takeMid)}</td><td>${r.fixed ? '<span class="bad">plătește oricum</span>' : '<span class="good">0 lei</span>'}</td><td>${r.fights}</td></tr>`).join('')}
</table>
<div class="notes"><div class="note2"><b>De ce nu hibridul, deși aduce cel mai mult?</b> Cu puțini oameni ar lua ${pct(MODEL_ROWS.find((x) => x.id === 'hibrid').takeLow)} din ce le aducem localurilor (cât Glovo) și ar plăti chiar dacă nu vine nimeni. Ar pleca, iar fără parteneri nu mai avem Live Drops pentru clienți.</div><div class="note2"><b>Și abonamentul după câte mese aducem?</b> Pentru o singură masă adusă într-o lună, un bar ar plăti 99 lei la ~330 lei încasări (30%), iar la fiecare prag ne-am certa pe o masă. Varianta aleasă ia ~${pct(best.takeMid)} mereu și ajunge aproape de celelalte când avem oameni.</div></div>`);

// 9. Cât ia fiecare variantă la început
page(`<div class="kicker">Corect pentru local</div><h1>La început, abonamentele ar lua cât Glovo</h1>
<p class="lead">Cât din banii lăsați de oamenii aduși de noi ar ajunge la CeFaci, în primul an, dacă venim cu 25 de oameni noi pe săptămână:</p>
<div class="chart-card">${hbars({ items: MODEL_ROWS.map((r) => ({ name: r.name, v: r.takeLow, hi: r.best })).sort((a, b) => a.v - b.v), max: 0.36, w: 1080, row: 50, label: 330, fmt: pct, ref: [{ v: 0.12, label: 'TheFork ~12%' }, { v: 0.30, label: 'Glovo ~30%' }] })}</div>
<p class="small-note">Cu mulți oameni procentul abonamentelor scade, dar primele luni decid dacă localurile rămân. Varianta aleasă e la fel de corectă și cu 25, și cu 150 de oameni pe săptămână.</p>`);

// 10. De unde vin banii noștri
const segs = [{ key: 'venueRev', name: 'Localuri (pe om)', color: C.s1, dark: true }, { key: 'plusRev', name: 'Plus', color: C.s2 }, { key: 'extra', name: 'Petreceri + Sponsorizat', color: C.s3 }, { key: 'proRev', name: 'Business Pro', color: C.s4 }];
const barOf = (i) => { const x = m(realist, i); return { name: 'Luna ' + i, v: { venueRev: x.venueRev, plusRev: x.plusRev, extra: x.eventRev + x.sponRev, proRev: x.proRev } }; };
page(`<div class="kicker">Pentru noi</div><h1>De unde vin banii (75 de oameni noi pe săptămână)</h1>
<div class="legend">${segs.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
<div class="chart-card">${stacks({ bars: [barOf(6), barOf(12), barOf(18), barOf(24)], segs, w: 1080 })}</div>
<div class="three small3">
  <div><b>Localurile</b> aduc cei mai mulți bani și cresc cu numărul de parteneri și de oameni.</div>
  <div><b>Plus</b> pornește când avem 15 parteneri (luna ${rows.find((x) => x.plusRev > 0)?.m ?? '—'}) și crește cu reducerile disponibile.</div>
  <div><b>Petrecerile, „Sponsorizat” și Business Pro</b> sunt plusuri mici, dar fără ele anul 1 ar ieși ${k(SENS.realist.faraExtra[0])} în loc de ${k(realist.year1)}.</div>
</div>`);

// 11. Simularea: 3 scenarii
const scen = [{ id: 'prudent', name: '25 de oameni/săpt.', color: C.s1 }, { id: 'realist', name: '75 de oameni/săpt.', color: C.s2 }, { id: 'bun', name: '150 de oameni/săpt.', color: C.s3 }];
page(`<div class="kicker">Simularea</div><h1>Banii puși și banii scoși, lună de lună</h1>
<div class="split3"><div class="chart-card">
<div class="ct">Câți bani avem în total de la pornire (după toate cheltuielile și impozitul)</div>
${lines({ series: scen.map((s) => ({ name: s.name, color: s.color, values: rec[s.id].rows.map((x) => x.cum) })), w: 720, h: 380 })}
</div>
<table class="scen">
  <tr><th></th>${scen.map((s) => `<th><i style="background:${s.color}"></i>${s.name}</th>`).join('')}</tr>
  <tr><td>Pe plus în fiecare lună din</td>${scen.map((s) => `<td>luna ${rec[s.id].firstPlus ?? '—'}</td>`).join('')}</tr>
  <tr><td>Banii puși înapoi în</td>${scen.map((s) => `<td>${rec[s.id].payback ? 'luna ' + rec[s.id].payback : 'după luna 24'}</td>`).join('')}</tr>
  <tr><td>Bani necesari la început</td>${scen.map((s) => `<td>${k(rec[s.id].cashNeeded)}</td>`).join('')}</tr>
  <tr><td>Anul 1</td>${scen.map((s) => `<td class="${rec[s.id].year1 < 0 ? 'neg' : 'pos'}">${k(rec[s.id].year1)}</td>`).join('')}</tr>
  <tr><td>Anul 2</td>${scen.map((s) => `<td class="pos">${k(rec[s.id].year2)}</td>`).join('')}</tr>
  <tr><td>Oameni activi, luna 12</td>${scen.map((s) => `<td>${num(m(rec[s.id], 12).actives)}</td>`).join('')}</tr>
  <tr><td>Parteneri, luna 12</td>${scen.map((s) => `<td>${Math.round(m(rec[s.id], 12).partners)}</td>`).join('')}</tr>
</table></div>
<p class="small-note">Toate cifrele sunt după varianta aleasă, cu verificarea Google făcută doar la planul ales (pagina 13). Ce am presupus: ultima pagină.</p>`);

// 12. Cheltuielile
const avgCost = (r, a, b) => Math.round(r.rows.slice(a - 1, b).reduce((s, x) => s + x.costs, 0) / (b - a + 1) / 10) * 10;
page(`<div class="kicker">Cheltuielile</div><h1>Cât costă să ținem CeFaci pornit</h1>
<div class="split2b"><div>
<table class="costs">
  <tr><th colspan="2">O singură dată (luna 1)</th></tr>
  <tr><td>SRL la Registrul Comerțului (plus 500 lei capital, care rămân ai firmei)</td><td>152 lei</td></tr>
  <tr><td>Jurist: termeni, confidențialitate, contractul cu localurile</td><td>~2.000 lei</td></tr>
  <tr><td>Contul Google Play</td><td>~113 lei</td></tr>
  <tr><th colspan="2">În fiecare lună</th></tr>
  <tr><td>Contabil, bancă, facturare e-Factura, semnătură, domeniu</td><td>~321 lei</td></tr>
  <tr><td>Supabase (baza de date) + Google (vremea, bonuri), cu TVA</td><td>~160 lei</td></tr>
  <tr><td>Drum la localuri + suportul cu codul QR la fiecare partener nou</td><td>~150 lei + 30/partener</td></tr>
  <tr><td>Verificarea „e deschis?” pe Google (după schimbare)</td><td>0–370 lei</td></tr>
  <tr><td>Reclame și conținut (după scenariu)</td><td>200 / 600 / 1.200 lei</td></tr>
</table></div>
<div class="tiles col">
  <div class="tile"><small>25 de oameni/săpt., pe lună</small><b>~${lei(avgCost(rec.prudent, 2, 12))}</b></div>
  <div class="tile"><small>75 de oameni/săpt., pe lună</small><b>~${lei(avgCost(rec.realist, 2, 12))}</b></div>
  <div class="tile"><small>150 de oameni/săpt., pe lună</small><b>~${lei(avgCost(rec.bun, 2, 12))}</b></div>
  <p class="small-note">Media lunilor 2–12. Fără salariu: profitul e al tău, după impozitul pe profit de 16% (pe dividende încă 16%).</p>
</div></div>`);

// 13. Capcana Google
const g12 = GOOGLE_NOW.realist.rows[11].google, g24 = GOOGLE_NOW.realist.rows[23].google, s12 = m(realist, 12).google, s24 = m(realist, 24).google;
page(`<div class="kicker">Am găsit o capcană</div><h1>Verificarea pe Google ne-ar mânca profitul</h1>
<p class="lead">Acum, la fiecare plan, aplicația întreabă Google dacă toate locurile din cele 3 planuri sunt deschise. Programul unui loc e cea mai scumpă întrebare: 1.000 gratuite pe lună, apoi ~20 $ la 1.000.</p>
<div class="tiles">
  <div class="tile bad"><small>Cum e acum · luna 12 (75/săpt.)</small><b>${lei(g12)}</b><em>pe lună; ${lei(g24)} în luna 24</em></div>
  <div class="tile ok"><small>După schimbare · luna 12</small><b>${lei(s12)}</b><em>pe lună; ${lei(s24)} în luna 24</em></div>
  <div class="tile"><small>Diferența în anul 1</small><b>~${k(realist.year1 - SENS.realist.googleAcum[0])}</b><em>economisiți</em></div>
</div>
<div class="split4"><div class="chart-card"><div class="ct">Cât ne-ar costa pe lună verificarea pe Google (75 de oameni noi/săpt.)</div>
${lines({ series: [{ name: 'Cum e acum', color: C.s2, values: GOOGLE_NOW.realist.rows.map((x) => x.google) }, { name: 'După schimbare', color: C.s1, values: realist.rows.map((x) => x.google) }], w: 620, h: 250, yFmt: (v) => num(v) + ' lei' })}</div>
<div class="fix">${bilu('bilu-vara-fg.png', 96, 'margin:0 0 0 -8px')}<div><b>Ce schimb înainte de lansare:</b> verific pe Google doar locurile din planul pe care îl alegi („Facem așa”) și doar pe cele fără program sigur pe hartă; restul vin din programul de pe hartă, pe care îl avem deja. Plus un plafon pe zi în Google Cloud, ca să nu putem avea surprize.</div></div></div>`);

// 14. Ce ne face să câștigăm mai repede
const z = SENS.realist.zona;
page(`<div class="kicker">Ce mișcă banii</div><h1>Cinci lucruri care contează mai mult decât prețul</h1>
<div class="levers">
  <div class="lever"><div class="n">1</div><div><h4>Mai mulți oameni noi pe săptămână</h4><p>De la 25 la 75 pe săptămână, anul 1 trece de la ${k(rec.prudent.year1)} la ${k(realist.year1)}, iar anul 2 de la ${k(rec.prudent.year2)} la ${k(realist.year2)}.</p></div></div>
  <div class="lever"><div class="n">2</div><div><h4>Primii parteneri într-o singură zonă</h4><p>Oamenii ajung mai des la aceiași parteneri, iar localurile văd rezultate. Anul 1: ${k(z[0])} în loc de ${k(realist.year1)}; banii înapoi în luna ${z[4]}.</p></div></div>
  <div class="lever"><div class="n">3</div><div><h4>Google verificat doar la planul ales</h4><p>~${k(realist.year1 - SENS.realist.googleAcum[0])} economisiți în primul an (pagina 13).</p></div></div>
  <div class="lever"><div class="n">4</div><div><h4>Plus, petreceri, „Sponsorizat”, Business Pro</h4><p>Venituri mici luate separat; împreună aduc ~${k(realist.year1 - SENS.realist.faraExtra[0])} în plus în anul 1 și ~${k(realist.year2 - SENS.realist.faraExtra[1])} în anul 2.</p></div></div>
  <div class="lever"><div class="n">5</div><div><h4>Cheltuieli mici până merge</h4><p>Fără salarii și birou; reclame doar pe ce aduce oameni; Supabase gratuit până pornește Business.</p></div></div>
</div>`);

// 15. Cum ajungem la 75 pe săptămână
page(`<div class="split"><div class="col-text">
<div class="kicker">Creșterea</div><h1>Cum ajungem la 75 de oameni noi pe săptămână</h1>
<ol class="steps">
  <li><b>TikTok și Reels cu Bilu</b>, 4–5 pe săptămână: „Unde ieșim vineri în Centrul Vechi cu 100 de lei?”.</li>
  <li><b>Codul QR pe mesele partenerilor:</b> „Ia oferta în CeFaci”. Fiecare local devine un loc de unde vin oameni noi.</li>
  <li><b>Gașca aduce gașca:</b> votul și biletul serii se trimit prietenilor, care își fac cont ca să voteze.</li>
  <li><b>Ambasadori în facultăți</b> (ASE, Poli, Universitate): Plus gratuit și un bonus pentru fiecare om activ adus.</li>
  <li><b>Petrecere de lansare</b> la unul dintre fondatori, cu Live Drop doar pentru cei cu aplicația.</li>
  <li><b>Reclame mici</b> (200–600 lei pe lună), doar pe clipurile care merg deja singure.</li>
</ol>
<div class="example">Ținta: <b>25 → 75 de oameni noi pe săptămână până în luna 3</b>. Sub 25, niciun model de preț cinstit nu ne scoate pe plus în primul an.</div>
</div><div class="col-img">${phone('app-plan-nou.png', 540)}${phone('app-loc.png', 540)}</div></div>`);

// 16. Lansarea în 3 săptămâni
page(`<div class="kicker">Lansarea</div><h1>3 săptămâni până la lansare</h1>
<table class="plan">
  <tr><th></th><th>Tu</th><th>Eu (Claude)</th></tr>
  <tr><td class="w"><b>Săpt. 1</b><small>7–13 oct</small></td><td><ul><li><b>Contul Google Play și testarea închisă cu 12+ prieteni.</b> Google cere 14 zile de test înainte de lansare: azi sau mâine, altfel se mută data.</li><li>Dosarul de SRL (3–5 zile lucrătoare) și un jurist.</li><li>Migrarea de securitate în Supabase (5 minute).</li><li>Zona de start și lista cu 20 de localuri; primele 5 vizite.</li></ul></td><td><ul><li>Politica de confidențialitate și termenii, adevărate față de aplicație; textele pentru Google Play.</li><li>Verificarea Google doar la planul ales + plafon pe zi.</li><li>Încep Business și Admin.</li><li>Prezentarea pentru localuri cu prețurile noi.</li></ul></td></tr>
  <tr><td class="w"><b>Săpt. 2</b><small>14–20 oct</small></td><td><ul><li>Contul bancar al firmei, contabilul, semnătura electronică.</li><li>Vizite: ținta, 10 fondatori care zic „da”.</li><li>Contul TikTok/Instagram și primele 10 clipuri; numărul D-U-N-S pentru Google Play pe firmă.</li></ul></td><td><ul><li>Business: rezervări, Live Drops, Sosiri cu cuvântul serii, Închide seara, codul QR.</li><li>Admin: parteneri, fondatori, trepte.</li><li>În aplicație: „Rezervă prin CeFaci”, Live Drops, „Am ajuns”.</li></ul></td></tr>
  <tr><td class="w"><b>Săpt. 3</b><small>21–27 oct</small></td><td><ul><li>Contractele cu fondatorii, pe SRL; codul QR la fiecare bar.</li><li>O seară de probă la 2–3 localuri.</li><li>~22 oct: ceri lansarea pe Google Play (după cele 14 zile).</li></ul></td><td><ul><li>Repar tot ce iese la probă.</li><li>Primele Live Drops ale fondatorilor.</li><li>Verificare completă pe telefon.</li></ul></td></tr>
</table>
<div class="launch"><b>Lansarea: 28 octombrie – 3 noiembrie</b>, cât durează verificarea Google Play (de la câteva ore la 7 zile). Fondatorii au 3 luni gratis, deci facturile încep abia în februarie: până atunci facem și partea de facturare.</div>`);

// 17. Ce poate merge prost
page(`<div class="kicker">Riscuri</div><h1>Ce poate merge prost și ce facem</h1>
<table class="risk">
  <tr><th>Riscul</th><th>Ce facem</th></tr>
  <tr><td>Vin puțini oameni (25 pe săptămână sau mai puțin)</td><td>Partenerii într-o singură zonă, clipuri, ambasadori; măsurăm săptămânal și mutăm banii de reclame pe ce merge.</td></tr>
  <tr><td>Google Play întârzie lansarea</td><td>Testarea închisă pornește acum; între timp prietenii folosesc APK-ul de pe GitHub.</td></tr>
  <tr><td>Localurile nu văd rezultate și pleacă</td><td>3 luni gratis, plătesc doar oamenii aduși, „ai fi plătit X” în fiecare lună, Live Drops pe orele lor goale.</td></tr>
  <tr><td>Costurile Google cresc cu oamenii</td><td>Verificare doar la planul ales + plafon pe zi în Google Cloud.</td></tr>
  <tr><td>Firma și contractele nu sunt gata</td><td>SRL în săptămâna 1, juristul în săptămânile 1–2; până atunci, doar „da” verbal de la localuri.</td></tr>
  <tr><td>Plus prin Google Play ar putea fi refuzat</td><td>Îi întrebăm în scris; până răspund, Plus rămâne proba gratuită de 7 zile.</td></tr>
  <tr><td>Ești singur pe tot</td><td>Primele 3 luni nu există facturi (fondatorii sunt gratis); închiderea serii și listele lunii se fac singure.</td></tr>
</table>`);

// 18. Ce hotărăști
page(`<div class="kicker">Ce hotărăști tu</div><h1>Șase da-uri ca să pornim</h1>
<div class="decide">
  <div class="dq"><b>1.</b> Varianta aleasă: plata pe om, la prețul pieței, fără nimic fix?<span>Recomand: da</span></div>
  <div class="dq"><b>2.</b> Prețurile: 3/4, 7/9, 12/15 lei; fondatorii 2/3, 5/7, 8/10 lei?<span>Recomand: da</span></div>
  <div class="dq"><b>3.</b> Zona de start, cu primii 10 parteneri în ea (de ex. Centrul Vechi – Universitate)?<span>Alegi tu</span></div>
  <div class="dq"><b>4.</b> Bugetul de reclame: 200, 600 sau 1.200 lei pe lună?<span>Recomand: 600</span></div>
  <div class="dq"><b>5.</b> Banii de pornire: ~${lei(r100(realist.cashNeeded))}, puși treptat în primele ${realist.rows.findIndex((x) => x.cum === Math.min(...realist.rows.map((y) => y.cum))) + 1} luni (la 75/săpt.)?<span>De confirmat</span></div>
  <div class="dq"><b>6.</b> Lansarea între 28 octombrie și 3 noiembrie, cu testarea Google pornită acum?<span>Recomand: da</span></div>
</div>
<div class="banner tight">${bilu('bilu-toamna-fg.png', 64, 'margin:-6px 4px -6px -6px')}<div>Cu un „da” la toate, mă apuc azi de Business, Admin și de schimbarea verificării Google, iar tu de contul Google Play și de SRL.</div></div>`);

// 19. Anexa
page(`<div class="kicker">Anexă</div><h1>Ce am presupus (și de unde)</h1>
<div class="assume">
<table>
  <tr><td>Oameni activi</td><td>70% în luna în care se înscriu, apoi 45%, 35%, 30%… până la 20%</td></tr>
  <tr><td>Ieșiri cu aplicația</td><td>1,3 pe lună de om activ, câte 3 oameni la o ieșire</td></tr>
  <tr><td>Cât cheltuie un om</td><td>35 / 110 / 200 lei (cafenea / restaurant, bar / club); localului îi rămân ~55%</td></tr>
  <tr><td>Partenerii</td><td>10 fondatori în primele 2 luni, apoi 2 / 4 / 6 pe lună; un partener atrage de 5 ori mai multe ieșiri decât un loc obișnuit</td></tr>
  <tr><td>Plătite</td><td>jumătate din ieșirile la parteneri (rezervări + Live Drops)</td></tr>
  <tr><td>Plecări</td><td>2–14% pe lună, mai multe când localul primește puțin față de cât plătește</td></tr>
  <tr><td>Plus</td><td>de la 15 parteneri; 1,6–5% din oamenii activi; ~14 lei net din 20 (prin Google Play)</td></tr>
  <tr><td>Altele</td><td>petreceri: 2 la 1.000 de oameni activi pe lună; „Sponsorizat” din luna 6; Business Pro 5–20% din parteneri</td></tr>
  <tr><td>Impozit</td><td>16% pe profit (fără angajat nu putem fi microîntreprindere), pierderea se reportează</td></tr>
</table>
<div class="src"><b>Surse verificate (6 oct 2026):</b>
<p>Google Play: conturile personale noi au nevoie de 12 testeri timp de 14 zile (support.google.com/googleplay/android-developer/answer/14151465); contul de firmă cere D-U-N-S, până la 30 de zile.</p>
<p>Google Places: programul unui loc e „Place Details Enterprise”, 1.000 gratuite pe lună, apoi 20 $ la 1.000.</p>
<p>SRL 2026: 152 lei la ONRC + 500 lei capital minim (Legea 239/2025), 3–5 zile lucrătoare. Micro 2026: 1%, dar cere un angajat.</p>
<p>TVA: plafonul de scutire e 395.000 lei (din 1 septembrie 2025).</p>
<p>TheFork: ~2–4 € de om adus, plus abonament. Glovo: 25–35% din comandă.</p>
<p>Simularea: scripts/simulare-bani.mjs (se poate rula din nou cu alte cifre).</p></div>
</div>`);

// ---------- stilul ----------
const font = (fam, file, w) => `@font-face{font-family:'${fam}';src:url('file://${FONTS}/${file}') format('truetype');font-weight:${w};font-style:normal}`;
const fontFile = (dir, name) => { const d = path.join(FONTS, dir); const f = fs.readdirSync(d).find((x) => x.endsWith('.ttf')); return path.relative(FONTS, path.join(d, f)) || name; };
const CSS = `
${font('Bricolage Grotesque', fontFile('bricolage-grotesque/800ExtraBold'), 800)}
${font('Bricolage Grotesque', fontFile('bricolage-grotesque/700Bold'), 700)}
${font('Instrument Sans', fontFile('instrument-sans/400Regular'), 400)}
${font('Instrument Sans', fontFile('instrument-sans/500Medium'), 500)}
${font('Instrument Sans', fontFile('instrument-sans/600SemiBold'), 600)}
${font('Instrument Sans', fontFile('instrument-sans/700Bold'), 700)}
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:'Instrument Sans',sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased}
.slide{width:1280px;height:720px;position:relative;overflow:hidden;break-after:page;page-break-after:always;background:${C.bg};padding:46px 64px 56px}
.kicker{font-weight:700;font-size:14px;letter-spacing:.09em;text-transform:uppercase;color:${C.blue}}
.kicker.light{color:${C.yellow}}
h1{font-family:'Bricolage Grotesque';font-weight:800;font-size:44px;line-height:1.04;letter-spacing:-.02em;margin:6px 0 22px;max-width:1100px}
h3{font-family:'Bricolage Grotesque';font-weight:800;font-size:28px;margin:8px 0 10px;line-height:1.05}
h4{font-family:'Bricolage Grotesque';font-weight:700;font-size:21px;margin:0 0 6px}
p{margin:0;font-size:18px;line-height:1.4}
b{font-weight:700}
.foot{position:absolute;left:64px;right:64px;bottom:18px;font-size:12px;color:${C.mute};display:flex;justify-content:space-between}
.cover{background:radial-gradient(circle at 78% 40%,#4a2a55 0,#2a1c45 45%,#171236 100%);color:#fff;display:flex;align-items:center;padding:0 0 0 80px}
.cover .foot{color:rgba(255,255,255,.5)}
.cover-l{flex:1;z-index:2}
.cover-title{font-size:96px;line-height:.95;margin:16px 0 24px;color:#fff}
.cover-sub{font-size:22px;line-height:1.4;color:#D9DCF2;max-width:560px}
.chips{display:flex;gap:10px;margin-top:34px;flex-wrap:wrap;max-width:600px}
.chips span{border:1.5px solid rgba(255,212,59,.6);color:${C.yellow};border-radius:999px;padding:8px 16px;font-weight:600;font-size:15px}
.cover-img{width:640px;height:640px;margin-right:20px;border-radius:44px;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.card{background:#fff;border-radius:26px;padding:26px 26px 28px;border:1px solid ${C.line};min-height:300px}
.card{display:flex;flex-direction:column}.card p{font-size:18px;color:${C.ink2}}
.big{margin-top:auto;padding-top:14px;font-family:'Bricolage Grotesque';font-weight:800;font-size:46px;line-height:1}.big small{display:block;font-family:'Instrument Sans';font-weight:600;font-size:14px;color:${C.ink3};margin-top:6px}
.card .tag{display:inline-block;align-self:flex-start;font-weight:700;font-size:14px;border-radius:999px;padding:6px 14px}
.c-client .tag{background:#FFF1B8;color:#7A5E00}.c-local .tag{background:#FFE1D9;color:#A8341C}.c-noi .tag{background:#DCE6FF;color:#2447E0}
.banner{display:flex;align-items:center;gap:8px;background:${C.ink};color:#fff;border-radius:22px;padding:16px 26px;margin-top:24px;font-size:19px;line-height:1.4}
.banner b{color:${C.yellow}}.banner.tight{margin-top:14px;padding:10px 22px;font-size:17px}
.flow{display:flex;align-items:stretch;gap:14px}
.step{flex:1;background:#fff;border:1px solid ${C.line};border-radius:22px;padding:16px;display:flex;gap:14px}
.thumb{flex:none;width:118px;height:236px;border-radius:16px;overflow:hidden;border:4px solid ${C.ink}}.thumb img{width:100%;display:block}
.step p{font-size:17px;color:${C.ink2}}
.ico{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque';font-weight:800;font-size:24px;margin-bottom:12px;color:${C.ink}}
.arrow{display:flex;align-items:center;font-size:34px;color:${C.mute}}
.money{display:grid;grid-template-columns:1fr 1.1fr 1fr;gap:16px;margin-top:18px}
.m-box{background:#fff;border:1px solid ${C.line};border-radius:22px;padding:20px 22px}
.m-box.hi{background:${C.ink};color:#fff;border-color:${C.ink}}
.m-who{font-size:15px;font-weight:600;color:${C.ink3};min-height:40px}
.m-box.hi .m-who{color:#B9C0E8}
.m-val{font-family:'Bricolage Grotesque';font-weight:800;font-size:38px;margin:6px 0}
.m-box.hi .m-val{color:${C.yellow}}
.m-note{font-size:15px;color:${C.ink2}}.m-box.hi .m-note{color:#D9DCF2}
.split{display:flex;gap:36px;height:100%}
.col-text{flex:1}.col-img{display:flex;gap:20px;align-items:flex-start}
.phone{border-radius:30px;overflow:hidden;border:7px solid ${C.ink};background:#fff;box-shadow:0 18px 40px rgba(14,20,64,.18);flex:none}
.phone img{display:block}
.list{margin:0;padding:0 0 0 20px}.list li{font-size:18px;line-height:1.38;margin-bottom:12px;color:${C.ink2}}.list b{color:${C.ink}}
.example{background:#FFF6CC;border-radius:18px;padding:16px 20px;font-size:17px;line-height:1.4;margin-top:8px}
.split2{display:grid;grid-template-columns:1fr 330px;gap:30px}
.price{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border-radius:20px;overflow:hidden;border:1px solid ${C.line}}
.price th{font-size:14px;text-align:left;color:${C.ink3};padding:14px 16px;border-bottom:1px solid ${C.line};font-weight:600}
.price td{font-size:19px;padding:15px 16px;border-bottom:1px solid ${C.line};font-weight:600}
.price tr:last-child td{border-bottom:0}
.price td:first-child{font-size:16px;font-weight:500;color:${C.ink2}}
.price .f{background:#FFF6CC}.price tr.hi td{background:#EEF3FF}.price tr.hi td.f{background:#FFEFA6}
.rules{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.rules span{background:#fff;border:1px solid ${C.line};border-radius:999px;padding:6px 12px;font-size:14px;color:${C.ink2}}
.extras{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.extras div{background:#fff;border:1px solid ${C.line};border-radius:16px;padding:12px 14px;font-size:15px;line-height:1.4;color:${C.ink2}}
.extras b{color:${C.ink}}
.mock{background:${C.ink};border-radius:30px;padding:18px;color:#fff;height:460px}
.mock-top{display:flex;justify-content:space-between;font-size:14px;color:#A9B1DA;margin-bottom:12px}.mock-top b{color:#fff}
.word{background:${C.yellow};color:${C.ink};border-radius:18px;padding:14px 16px;margin-bottom:12px}
.word div{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.word b{display:block;font-family:'Bricolage Grotesque';font-size:28px;margin:4px 0}
.word small{font-size:12px;color:#5c4a00}
.row{background:rgba(255,255,255,.08);border-radius:14px;padding:11px 12px;margin-bottom:8px;font-size:14px;display:flex;align-items:center;gap:8px}
.row b{color:${C.yellow}}
.pill{margin-left:auto;background:#DCE6FF;color:#2447E0;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700}
.pill.c{background:#FFE1D9;color:#A8341C}.pill.p{background:#FFF1B8;color:#7A5E00}
.close{margin-top:12px;background:#fff;color:${C.ink};border-radius:14px;padding:12px;text-align:center;font-size:15px}
.lead{font-size:20px;color:${C.ink2};margin:-6px 0 18px;max-width:1100px}
.tiles{display:flex;gap:16px;margin-bottom:18px}
.tiles.col{flex-direction:column}
.tile{flex:1;background:#fff;border:1px solid ${C.line};border-radius:20px;padding:16px 20px}
.tile small{display:block;font-size:14px;color:${C.ink3};font-weight:600}
.tile b{display:block;font-size:40px;font-weight:700;margin-top:4px;letter-spacing:-.01em}
.tile em{display:block;font-style:normal;font-size:14px;color:${C.ink3};margin-top:2px}
.tile.ok{border-color:#9ED9B8;background:#F1FBF5}.tile.bad{border-color:#F3B3A6;background:#FFF5F2}
.chart-card{background:#fff;border:1px solid ${C.line};border-radius:20px;padding:18px 20px}
.ct{font-size:15px;font-weight:600;color:${C.ink3};margin-bottom:10px}
.timeline{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 18px}
.t{display:grid;grid-template-columns:120px 1fr 108px;gap:10px;background:#fff;border:1px solid ${C.line};border-radius:16px;padding:11px 14px;align-items:center}
.t .d{font-weight:700;font-size:15px}.t .e{font-size:15px;line-height:1.35;color:${C.ink2}}.t .v{font-weight:700;font-size:15px;text-align:right}
.t.small{background:#F7F8FC}
.why{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.why div{background:#fff;border:1px solid ${C.line};border-radius:16px;padding:12px 16px;font-size:15.5px;line-height:1.4;color:${C.ink2}}.why b{color:${C.ink}}
.sum{margin-top:14px;background:${C.ink};color:#fff;border-radius:18px;padding:16px 22px;font-size:20px}.sum b{color:${C.yellow}}.sum span{color:#A9B1DA}
.cmp{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border-radius:20px;overflow:hidden;border:1px solid ${C.line}}
.cmp th{font-size:14px;text-align:left;color:${C.ink3};padding:12px 16px;border-bottom:1px solid ${C.line};font-weight:600;line-height:1.25}
.cmp th small{font-weight:500;color:${C.mute}}
.cmp td{font-size:16px;padding:13px 16px;border-bottom:1px solid ${C.line}}
.cmp tr:last-child td{border-bottom:0}
.cmp tr.hi td{background:#EEF3FF;font-weight:600}
.star{display:inline-block;background:${C.yellow};color:${C.ink};font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;margin-right:8px}
.minibar{display:flex;align-items:center;gap:10px}.minibar i{display:block;height:16px;border-radius:0 4px 4px 0}
.good{color:${C.green};font-weight:700}.bad{color:#B2341F;font-weight:700}
.notes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.note2{background:#fff;border-left:5px solid ${C.blue};border-radius:12px;padding:14px 18px;font-size:16px;line-height:1.45;color:${C.ink2}}
.note2 b{color:${C.ink}}
.small-note{font-size:14px;color:${C.ink3};margin-top:12px}
.legend{display:flex;gap:18px;margin:-8px 0 12px;font-size:15px;color:${C.ink2}}
.legend i{display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:7px;vertical-align:-2px}
.small3{margin-top:16px}.small3 div{background:#fff;border:1px solid ${C.line};border-radius:16px;padding:14px 16px;font-size:15px;line-height:1.4;color:${C.ink2}}
.split3{display:grid;grid-template-columns:760px 1fr;gap:20px}
.scen{border-collapse:separate;border-spacing:0;background:#fff;border-radius:20px;overflow:hidden;border:1px solid ${C.line};width:100%}
.scen th{font-size:13px;color:${C.ink3};padding:10px 8px;text-align:left;font-weight:600;border-bottom:1px solid ${C.line};line-height:1.2}
.scen th i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
.scen td{font-size:14px;padding:9px 8px;border-bottom:1px solid ${C.line};font-weight:600}
.scen td:first-child{font-weight:500;color:${C.ink2};font-size:13px}
.scen tr:last-child td{border-bottom:0}
.neg{color:#B2341F}.pos{color:${C.green}}
.split2b{display:grid;grid-template-columns:1fr 330px;gap:24px}
.costs{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border-radius:20px;overflow:hidden;border:1px solid ${C.line}}
.costs th{text-align:left;font-size:14px;color:${C.blue};text-transform:uppercase;letter-spacing:.06em;padding:12px 16px 6px}
.costs td{font-size:15.5px;padding:8px 16px;border-bottom:1px solid ${C.grid};color:${C.ink2}}
.costs td:last-child{text-align:right;font-weight:700;color:${C.ink};white-space:nowrap}
.split4{display:grid;grid-template-columns:660px 1fr;gap:18px}
.fix{display:flex;flex-direction:column;align-items:flex-start;gap:10px;background:${C.ink};color:#fff;border-radius:22px;padding:16px 24px;font-size:18px;line-height:1.45}.fix b{color:${C.yellow}}
.levers{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lever{display:flex;gap:14px;background:#fff;border:1px solid ${C.line};border-radius:20px;padding:16px 18px}
.lever .n{flex:none;width:40px;height:40px;border-radius:12px;background:${C.yellow};display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque';font-weight:800;font-size:21px}
.lever{padding:22px 22px}.lever p{font-size:18px;color:${C.ink2}}.lever h4{font-size:23px}
.lever:last-child{grid-column:span 2}
.steps{margin:0;padding-left:24px}.steps li{font-size:17px;line-height:1.35;margin-bottom:9px;color:${C.ink2}}.steps b{color:${C.ink}}
.plan{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border-radius:20px;overflow:hidden;border:1px solid ${C.line}}
.plan th{font-size:14px;text-align:left;color:${C.ink3};padding:10px 14px;border-bottom:1px solid ${C.line}}
.plan td{vertical-align:top;padding:8px 14px;border-bottom:1px solid ${C.line};font-size:13.5px;line-height:1.35;color:${C.ink2}}
.plan tr:last-child td{border-bottom:0}
.plan td.w{width:110px}.plan td.w b{display:block;font-size:17px;color:${C.ink}}.plan td.w small{color:${C.ink3};font-size:13px}
.plan ul{margin:0;padding-left:16px}.plan li{margin-bottom:3px}.plan li b{color:${C.ink}}
.launch{margin-top:12px;background:${C.yellow};border-radius:16px;padding:12px 18px;font-size:16px;line-height:1.4}
.risk{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border-radius:20px;overflow:hidden;border:1px solid ${C.line}}
.risk th{font-size:14px;text-align:left;color:${C.ink3};padding:12px 18px;border-bottom:1px solid ${C.line}}
.risk td{font-size:17px;padding:14px 18px;border-bottom:1px solid ${C.line};line-height:1.35;color:${C.ink2}}
.risk td:first-child{font-weight:700;color:${C.ink};width:38%}
.risk tr:last-child td{border-bottom:0}
.decide{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dq{background:#fff;border:1px solid ${C.line};border-radius:18px;padding:12px 18px;font-size:17px;line-height:1.35;display:flex;flex-direction:column;gap:6px}
.dq span{align-self:flex-start;background:#DCE6FF;color:#2447E0;font-weight:700;font-size:13px;border-radius:999px;padding:4px 11px}
.assume{display:grid;grid-template-columns:1fr 430px;gap:20px}
.assume table{border-collapse:separate;border-spacing:0;background:#fff;border-radius:18px;overflow:hidden;border:1px solid ${C.line}}
.assume td{font-size:14px;padding:8px 12px;border-bottom:1px solid ${C.grid};line-height:1.35;color:${C.ink2};vertical-align:top}
.assume td:first-child{font-weight:700;color:${C.ink};width:140px}
.src{background:#fff;border:1px solid ${C.line};border-radius:18px;padding:14px 16px;font-size:13px;color:${C.ink2}}
.src p{font-size:13px;line-height:1.4;margin-top:7px}
.bilu{flex:none;overflow:hidden}.bilu img{display:block}
`;

const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>CeFaci · Cum câștigăm toți trei</title><style>${CSS}</style></head><body>${pages.join('\n')}</body></html>`;
fs.mkdirSync(OUT_DIR, { recursive: true });
const HTML = path.join(OUT_DIR, '.prezentare.html');
fs.writeFileSync(HTML, html);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await pg.goto('file://' + HTML, { waitUntil: 'load' });
await pg.evaluate(() => document.fonts.ready);
// nimic nu are voie să iasă din pagină
const over = await pg.$$eval('.slide', (ss) => ss.map((s, i) => { const r = s.getBoundingClientRect(); const bad = [...s.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.bottom > r.bottom - 34 || b.right > r.right + 1) && !e.closest('.foot') && !e.classList.contains('cover-img'); }).map((e) => e.className || e.tagName); return bad.length ? 'pagina ' + (i + 1) + ': ' + [...new Set(bad)].slice(0, 6).join(', ') : null; }).filter(Boolean));
if (over.length) console.log('IESE DIN PAGINĂ:\n' + over.join('\n'));
await pg.pdf({ path: PDF, width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const n = await pg.$$eval('.slide', (ss) => ss.length);
  for (let i = 0; i < n; i++) { const el = (await pg.$$('.slide'))[i]; await el.screenshot({ path: path.join(SHOTS, `p${String(i + 1).padStart(2, '0')}.png`) }); }
}
await browser.close();
fs.unlinkSync(HTML);
console.log('PDF: ' + PDF + ' (' + pages.length + ' pagini, ' + Math.round(fs.statSync(PDF).size / 1024) + ' KB)');
