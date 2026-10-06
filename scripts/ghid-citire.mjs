// „Ce ai de citit și de hotărât” (06.10): un PDF scurt, A4, cu deciziile lui Cornel, regulile de știut și pașii lui.
// Rulare: node scripts/ghid-citire.mjs → docs/prezentare/CeFaci-ce-ai-de-citit.pdf
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ALL } from './simulare-bani.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'docs/prezentare');
const PDF = path.join(OUT, 'CeFaci-ce-ai-de-citit.pdf');
const FONTS = path.join(ROOT, 'mobile/node_modules/@expo-google-fonts');
const ttf = (dir) => { const d = path.join(FONTS, dir); return path.join(d, fs.readdirSync(d).find((x) => x.endsWith('.ttf'))); };
const realist = ALL['corect/realist'];
const cash = Math.round(realist.cashNeeded / 100) * 100;

const pages = [];
const page = (html) => pages.push(`<section class="pg">${html}<div class="foot"><span>CeFaci · Ce ai de citit și de hotărât · 6 octombrie 2026</span><span>${pages.length + 1}</span></div></section>`);
const dec = (n, q, why, rec, cls = '') => `<div class="dec ${cls}"><div class="n">${n}</div><div><b>${q}</b><p>${why}</p></div><span class="rec">${rec}</span></div>`;

page(`<div class="cover">
  <img src="img/bilu-toamna-fg.png" class="bilu">
  <div class="kicker">Pentru Cornel · 6 octombrie 2026</div>
  <h1>Ce ai de citit<br>și de hotărât</h1>
  <p class="sub">Tot ce trebuie să știi înainte să pornim Business, Admin și lansarea, pe scurt. Cam 15 minute.</p>
</div>
<h2>Cum citești</h2>
<ol class="how">
  <li><b>Pagina 2:</b> ce ai de făcut tu săptămâna asta (lucruri care nu așteaptă).</li>
  <li><b>Paginile 3–4:</b> cele 12 întrebări la care îmi răspunzi. Lângă fiecare e ce recomand eu.</li>
  <li><b>Paginile 5–6:</b> regulile pe care trebuie să le știi când vorbești cu localurile, și ce cere legea.</li>
  <li><b>Pagina 7:</b> cum îmi răspunzi (un mesaj scurt) și ce fac eu după.</li>
</ol>
<div class="box">Dacă vrei detalii: prezentarea <b>„Cum câștigăm toți trei”</b> (cifrele, graficele, planul de lansare) și documentul <b>docs/logica-business-admin.md</b> (toate regulile, pe capitole). Nu trebuie citite ca să răspunzi.</div>`);

page(`<div class="kicker">Pagina ta</div><h1 class="h">Ce faci tu săptămâna asta</h1>
<div class="todo done"><span class="ck">✓</span><div><b>Migrarea de securitate în Supabase</b><p>Făcută și verificată: nimeni nu mai poate șterge locuri cu cheia din aplicație, iar numele urâte sunt blocate și pe server.</p></div></div>
<div class="todo urgent"><span class="ck">1</span><div><b>Contul Google Play + testarea închisă cu 12 prieteni</b><p>Cel mai important lucru. Google cere 12 testeri care țin aplicația 14 zile la rând înainte să te lase s-o publici. Ceasul pornește abia când intră ei. Taxa: 25 $ o singură dată. Eu îți pregătesc textele pentru magazin și răspunsurile la „Siguranța datelor”.</p></div></div>
<div class="todo"><span class="ck">2</span><div><b>SRL-ul</b><p>Online la Registrul Comerțului: 152 lei + 500 lei capital (rămân ai firmei), 3–5 zile lucrătoare. Trebuie înainte de primul contract cu un local, nu doar înainte de primul leu.</p></div></div>
<div class="todo"><span class="ck">3</span><div><b>Un jurist și un contabil</b><p>Juristul: termenii pentru clienți, politica de confidențialitate și contractul cu localurile (~2.000 lei o dată). Eu scriu ciornele, el le verifică. Contabilul: ~250 lei pe lună.</p></div></div>
<div class="todo"><span class="ck">4</span><div><b>Zona de start și lista cu 20 de localuri</b><p>Toți primii 10 parteneri în aceeași zonă (de exemplu Centrul Vechi – Universitate), ca oamenii să ajungă des la ei. Primele 5 vizite le poți face deja cu prezentarea.</p></div></div>
<div class="todo"><span class="ck">5</span><div><b>Conturile de TikTok și Instagram</b><p>Ținta e 75 de oameni noi pe săptămână. Sub 25, nicio variantă cinstită nu ne scoate pe plus în primul an.</p></div></div>`);

page(`<div class="kicker">Întrebările 1–7</div><h1 class="h">Banii: cum plătește localul</h1>
${dec(1, 'Localul plătește doar oamenii aduși prin rezervare sau Live Drop, fără nimic fix?', 'Abonamentele ar lua 14–30% din ce le aducem când avem puțini oameni (cât Glovo). Plata pe om ia ~5–6% mereu.', 'Recomand: da')}
${dec(2, 'Prețurile: cafenea 3/4 lei, restaurant sau bar 7/9 lei, club 12/15 lei (rezervare / Live Drop)?', 'Fondatorii (primii 20) păstrează prețurile de lansare: 2/3, 5/7, 8/10 lei. E sub TheFork (~12%) și de ~4 ori sub Glovo.', 'Recomand: da')}
${dec(3, 'Același om se plătește de cel mult 3 ori pe an la același local?', 'După a treia vizită e clientul localului, nu al nostru. Așa dispare obiecția „vine la mine de 3 ani”. Pierdem foarte puțin.', 'Recomand: da')}
${dec(4, 'Luni gratuite: fondatorii 3 (+3 dacă nu vine nimeni), ceilalți 1?', 'Cu puțini oameni la început, lunile gratuite ne costă aproape nimic și sunt cel mai bun argument la vânzare.', 'Recomand: da')}
${dec(5, 'Fără pragul de 30 de lei la factură?', 'Factura prin e-Factura nu costă nimic; o sumă mică amânată lună de lună nu s-ar mai factura niciodată. Dacă contabilul zice altfel, îl ascultăm.', 'Recomand: da')}
${dec(6, 'Renunțăm la dobânda de întârziere și la cei 40 € pe factură întârziată, la început?', 'Legea ni le dă, dar la 20–50 de lei pe factură ar strica relația cu localurile. Oprirea rezervărilor la 30 de zile rămâne.', 'Recomand: da')}
${dec(7, 'Bilu auriu și carnetul auriu devin „insigna de membru Plus”, nu un beneficiu vândut?', 'Google ar putea cere ca tot Plus să treacă prin Google Play dacă vindem ceva doar digital. Îi întrebăm în scris; până atunci, așa e mai sigur.', 'Recomand: da')}`);

page(`<div class="kicker">Întrebările 8–12</div><h1 class="h">Lansarea</h1>
${dec(8, 'SRL acum, înainte de primul contract cu un local?', 'Nu e o preferință: un contract semnat ca persoană fizică nu trece la SRL fără acordul fiecărui local, iar adresa ta de acasă ar apărea în Google Play.', 'Obligatoriu', 'must')}
${dec(9, 'Care e zona de start?', 'Toți primii 10 parteneri acolo. În simulare, asta aduce ~6.000 lei în plus în primul an (la 75 de oameni noi pe săptămână).', 'Alegi tu')}
${dec(10, 'Bugetul de reclame și conținut: 200, 600 sau 1.200 lei pe lună?', '600 lei e ce am pus în scenariul de 75 de oameni noi pe săptămână. Banii merg doar pe clipurile care merg deja singure.', 'Recomand: 600')}
${dec(11, `Banii de pornire: ~${cash.toLocaleString('ro-RO').replace(/ /g, '.')} lei, puși treptat în primele luni?`, 'Atât trebuie până veniturile acoperă cheltuielile (la 75 de oameni noi pe săptămână). Cea mai mare parte e o singură dată: juristul și SRL-ul.', 'De confirmat')}
${dec(12, 'Lansarea între 28 octombrie și 3 noiembrie?', 'Merge doar dacă testarea Google Play pornește în zilele următoare (14 zile + verificarea lor). Fondatorii au 3 luni gratis, deci facturile încep în februarie.', 'Recomand: da')}
<div class="box small"><b>Cifrele mici de pornire</b> (rămân așa dacă nu zici altceva, se pot schimba oricând): răspuns la o cerere de rezervare în 15 minute, auto-confirmare până la 6 oameni, masa ținută 15 minute, „închide seara” până la 12:00 a doua zi, 3 neveniri în 60 de zile = 30 de zile fără rezervări, Live Drop cu cel puțin 4 locuri, contestații 3 zile lucrătoare, plata în 15 zile.</div>`);

page(`<div class="kicker">De știut</div><h1 class="h">Regulile pe care le spui localurilor</h1>
<div class="rules">
  <div><b>La dubiu nu facturăm și nu pedepsim.</b> Dacă nu e clar că omul a venit, localul nu plătește; dacă nu e clar că n-a venit, clientul nu primește „nevenire”.</div>
  <div><b>Vizitele din planuri sunt gratis.</b> Se plătesc doar rezervările făcute prin CeFaci și Live Drop-urile puse de local, doar pentru cine a venit, fără copii sub 12, cel mult 10 pe masă.</div>
  <div><b>„Închide seara”.</b> A doua zi până la 12:00 localul confirmă cine a venit; lista vine completată din scanări, de obicei e un singur buton. Cine nu închide pierde rezervările, nu câștigă bani.</div>
  <div><b>„Cuvântul serii”.</b> Două cuvinte noi în fiecare zi; ospătarul le vede în Business, clientul doar după o scanare adevărată. O poză sau un ecran fals nu le au.</div>
  <div><b>Un singur procent pe notă.</b> Casa de marcat nu poate da reducere „pe persoană”; ecranul arată un procent pentru toată nota. Se arată înainte de nota de plată.</div>
  <div><b>Live Drop-ul nu e pentru cine e deja acolo.</b> Nu se poate lua de la masă sau de la ușă (150 m, 10 minute până la scanare). Fără tutun; alcoolul doar pentru 18+.</div>
  <div><b>Dovezi puternice și slabe.</b> Bifa localului, bonul fiscal cu CUI-ul lui sau o scanare verificată contează; o poziție GPS sau un „da, am fost” nu fac localul să plătească.</div>
  <div><b>Lunile gratuite, o dată pe loc.</b> Un local care schimbă firma nu primește din nou luni gratuite.</div>
  <div><b>Factura.</b> Lista lunii pe 3, contestații 3 zile lucrătoare, factura prin e-Factura, plata în 15 zile. La 30 de zile de întârziere se opresc doar rezervările și drop-urile, niciodată locul în recomandări.</div>
  <div><b>Recomandările nu se cumpără.</b> Un partener nu urcă în top pentru că plătește; „Sponsorizat” stă separat și scrie clar.</div>
</div>`);

page(`<div class="kicker">De știut</div><h1 class="h">Ce cere legea (pe scurt)</h1>
<div class="law">
  <div><b>SRL înainte de contracte.</b> Contractele, politicile și contul de dezvoltator Google Play pe firmă. Construitul aplicației ca persoană fizică e în regulă.</div>
  <div><b>Cine semnează pentru local.</b> Doar administratorul firmei (din certificatul constatator) sau cineva cu împuternicire. Clauzele speciale (oprirea la neplată, ieșirea din Plus) se bifează separat.</div>
  <div><b>Politica de confidențialitate trebuie rescrisă acum.</b> Cea de acum spune că locația nu pleacă de pe telefon (pleacă, la check-in) și că aplicația merge fără cont (nu mai merge). Google Play o citește.</div>
  <div><b>TVA.</b> Nu suntem plătitori sub 395.000 lei pe an, dar cerem codul special (art. 317) imediat după SRL, pentru serviciile din străinătate (Google, Supabase). Pe facturi: „fără TVA”.</div>
  <div><b>Impozit.</b> Fără angajat nu putem fi microîntreprindere: plătim 16% pe profit (0 cât suntem pe pierdere) și 16% pe dividende.</div>
  <div><b>Regulile UE pentru platforme (P2B).</b> Termeni clari pentru localuri, motive scrise când oprim pe cineva, anunț cu 30 de zile înainte de schimbări, o pagină „Cum alegem recomandările”.</div>
  <div><b>Plus plătit.</b> Doar de la 18 ani; întrebăm Google în scris dacă trebuie prin Google Play (reducerile la localuri sunt servicii fizice).</div>
  <div><b>Biletele (mai târziu).</b> Banii nu trec prin noi: un procesator autorizat plătește direct localul.</div>
</div>
<p class="note">Nu e sfat juridic sau contabil: juristul și contabilul confirmă înainte de primul contract.</p>`);

page(`<div class="kicker">La final</div><h1 class="h">Cum îmi răspunzi</h1>
<p class="lead">Un singur mesaj e destul, de exemplu:</p>
<div class="answer">1 da · 2 da · 3 da · 4 da · 5 da · 6 da · 7 da · 8 da · 9 Centrul Vechi · 10 600 · 11 da · 12 da</div>
<p class="lead">Dacă vrei altceva la o întrebare, scrie doar acolo ce vrei (de exemplu „2: fondatorii 1 leu mai puțin”).</p>
<h2>Ce fac eu după „da”</h2>
<ol class="how">
  <li>Schimb verificarea pe Google (doar planul ales + plafon pe zi), ca să nu plătim mii de lei pe lună.</li>
  <li>Scriu politica de confidențialitate, termenii și textele pentru Google Play (pentru jurist).</li>
  <li>Pun prețurile noi în logică și în prezentarea pentru localuri.</li>
  <li>Construiesc Business (rezervări, Live Drops, Sosiri, cuvântul serii, Închide seara, codul QR) și Admin (parteneri, fondatori).</li>
  <li>În aplicație: „Rezervă prin CeFaci”, Live Drops pe Acasă, „Am ajuns” cu cuvântul serii.</li>
</ol>
<div class="end"><img src="img/bilu-vara-fg.png"><div>Mulțumesc că citești tot. Hai să-l lansăm!</div></div>`);

const font = (fam, file, w) => `@font-face{font-family:'${fam}';src:url('file://${file}') format('truetype');font-weight:${w}}`;
const CSS = `${font('Bricolage Grotesque', ttf('bricolage-grotesque/800ExtraBold'), 800)}${font('Instrument Sans', ttf('instrument-sans/400Regular'), 400)}${font('Instrument Sans', ttf('instrument-sans/600SemiBold'), 600)}${font('Instrument Sans', ttf('instrument-sans/700Bold'), 700)}
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}
body{font-family:'Instrument Sans',sans-serif;color:#0E1440;-webkit-font-smoothing:antialiased}
.pg{width:210mm;height:297mm;position:relative;overflow:hidden;break-after:page;background:#F2F3F8;padding:16mm 15mm 18mm}
.foot{position:absolute;left:15mm;right:15mm;bottom:8mm;font-size:10px;color:#8A90AE;display:flex;justify-content:space-between}
.kicker{font-weight:700;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#2F5BFF}
h1{font-family:'Bricolage Grotesque';font-weight:800;letter-spacing:-.02em;margin:6px 0 14px}
h1.h{font-size:32px;line-height:1.05}
h2{font-family:'Bricolage Grotesque';font-weight:800;font-size:22px;margin:18px 0 8px}
p{margin:4px 0 0;font-size:13.5px;line-height:1.45;color:#454E7E}
.cover{background:#1D1640;color:#fff;border-radius:22px;padding:26px 28px 30px;position:relative;margin-bottom:10px}
.cover .kicker{color:#FFD43B}.cover h1{font-size:46px;line-height:1;color:#fff}
.cover .sub{color:#D9DCF2;font-size:16px;max-width:430px}
.cover .bilu{position:absolute;right:6px;top:4px;width:210px;height:210px}
.how{padding-left:20px;margin:6px 0}.how li{font-size:14.5px;line-height:1.45;margin-bottom:7px;color:#454E7E}.how b{color:#0E1440}
.box{background:#fff;border:1px solid #E3E6EF;border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.45;color:#454E7E;margin-top:12px}.box b{color:#0E1440}
.box.small{font-size:12.5px}
.todo{display:flex;gap:12px;background:#fff;border:1px solid #E3E6EF;border-radius:14px;padding:12px 14px;margin-bottom:9px}
.todo .ck{flex:none;width:30px;height:30px;border-radius:9px;background:#FFD43B;display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque';font-weight:800;font-size:16px}
.todo b{font-size:15px}.todo.done{opacity:.85}.todo.done .ck{background:#5FD39A;color:#0E1440}
.todo.urgent{border:2px solid #FF6A4D}.todo.urgent .ck{background:#FF6A4D;color:#fff}
.dec{display:grid;grid-template-columns:30px 1fr auto;gap:10px;align-items:start;background:#fff;border:1px solid #E3E6EF;border-radius:14px;padding:11px 13px;margin-bottom:8px}
.dec .n{width:28px;height:28px;border-radius:8px;background:#0E1440;color:#FFD43B;display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque';font-weight:800;font-size:14px}
.dec b{font-size:14.5px;line-height:1.35;display:block}.dec p{font-size:12.5px}
.rec{white-space:nowrap;background:#DCE6FF;color:#2447E0;font-weight:700;font-size:11.5px;border-radius:999px;padding:4px 10px;margin-top:2px}
.dec.must .rec{background:#FFE1D9;color:#A8341C}
.rules,.law{display:grid;gap:8px}
.rules div,.law div{background:#fff;border:1px solid #E3E6EF;border-radius:13px;padding:10px 13px;font-size:13px;line-height:1.45;color:#454E7E}
.rules b,.law b{color:#0E1440}
.note{font-size:11.5px;color:#5A6390;margin-top:10px}
.lead{font-size:14.5px;margin:4px 0 8px}
.answer{background:#0E1440;color:#FFD43B;border-radius:14px;padding:14px 16px;font-weight:700;font-size:15px;line-height:1.5;margin-bottom:8px}
.end{display:flex;align-items:center;gap:6px;background:#FFF6CC;border-radius:16px;padding:6px 16px;margin-top:14px;font-family:'Bricolage Grotesque';font-weight:800;font-size:20px}
.end img{width:110px;height:110px;margin:-14px -10px -14px -16px}`;

const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>CeFaci · Ce ai de citit și de hotărât</title><style>${CSS}</style></head><body>${pages.join('\n')}</body></html>`;
const HTML = path.join(OUT, '.ghid.html');
fs.writeFileSync(HTML, html);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await pg.goto('file://' + HTML);
await pg.evaluate(() => document.fonts.ready);
const over = await pg.$$eval('.pg', (ss) => ss.map((s, i) => { const r = s.getBoundingClientRect(); return [...s.querySelectorAll('*')].some((e) => { const b = e.getBoundingClientRect(); return b.height && b.bottom > r.bottom - 34 && !e.closest('.foot'); }) ? 'pagina ' + (i + 1) : null; }).filter(Boolean));
if (over.length) console.log('IESE DIN PAGINĂ: ' + over.join(', '));
await pg.pdf({ path: PDF, preferCSSPageSize: true, printBackground: true });
if (process.argv[2]) { fs.mkdirSync(process.argv[2], { recursive: true }); const els = await pg.$$('.pg'); for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(process.argv[2], `g${i + 1}.png`) }); }
await browser.close();
fs.unlinkSync(HTML);
console.log('PDF: ' + PDF + ' (' + pages.length + ' pagini)');
