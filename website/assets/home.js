// CeFaci — pagina de prezentare: anotimpul ca în aplicație (src/app/season.ts), ceasul de pe Acasă, întrebările de pe
// fundal și „…un film bun?” care se schimbă. Fără cereri în rețea, fără stocare.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Anotimpul, după aceleași reguli ca aplicația: primăvară martie–mai, vară iunie–august, toamnă septembrie–noiembrie,
  // iarnă; Crăciun de la 1 decembrie la 7 ianuarie.
  const now = new Date();
  const m = now.getMonth() + 1, md = m * 100 + now.getDate();
  const look = md >= 1201 || md <= 107 ? 'craciun' : m >= 3 && m <= 5 ? 'primavara' : m >= 6 && m <= 8 ? 'vara' : m >= 9 && m <= 11 ? 'toamna' : 'iarna';
  const LOOK = {
    primavara: { name: 'primăvara asta', fall: 'petals', cta: '🌸' },
    vara: { name: 'vara asta', fall: 'sun', cta: '☀️' },
    toamna: { name: 'toamna asta', fall: 'leaves', cta: '🍂' },
    iarna: { name: 'iarna asta', fall: 'snow', cta: '❄️' },
    craciun: { name: 'de sărbători', fall: 'snow', cta: '🎄' },
  }[look];
  document.documentElement.dataset.look = look;
  if ($('season-name')) $('season-name').textContent = 'în curând, ' + LOOK.name;
  if ($('cta-season')) $('cta-season').textContent = LOOK.cta;

  // Ceasul de pe Acasă: ora din București, ziua, luna sau soarele.
  const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
  const tick = () => {
    let d = new Date();
    try { d = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })); } catch {}
    const h = d.getHours();
    if ($('clock-time')) $('clock-time').textContent = String(h).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if ($('clock-day')) $('clock-day').textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    if ($('clock-icon')) $('clock-icon').textContent = h >= 7 && h < 19 ? '☀' : '☾';
  };
  tick(); setInterval(tick, 20000);

  // „…un film bun?” — ideile lui Bilu de pe Acasă, una după alta.
  const IDEAS = ['un film bun?', 'sau karaoke?', 'o plimbare prin centru?', 'pizza cu gașca?', 'un escape room?', 'un concert?', 'ceva dulce?', 'bowling?', 'un muzeu nou?', 'o seară întreagă?'];
  const maybe = $('maybe');
  if (maybe && !calm) {
    let i = 0;
    setInterval(() => {
      maybe.classList.add('out');
      setTimeout(() => { i = (i + 1) % IDEAS.length; maybe.textContent = IDEAS[i]; maybe.classList.remove('out'); }, 360);
    }, 2600);
  }

  // Întrebările abia vizibile de pe fundal, ca în aplicație (Doodles.tsx).
  const QS = ['Ce facem?', 'Unde mergem?', 'Cu cine ies?', 'Ieșim diseară?', 'Cine mai vine?', 'Pe la ce oră?', 'Unde ne vedem?', 'Facem ceva?', 'Ce zici?', 'Băgăm un film?', 'Câți suntem?', 'Și după?', 'Mâncăm ceva?', 'Unde e lumea?', 'Hai afară?', 'La ce oră vii?', 'Bowling?', 'Karaoke?', 'Mergem pe jos?', 'Ce chef ai?', 'Vii și tu?', 'Weekendul ăsta?', 'Pizza sau shaorma?'];
  const wall = $('doodles');
  if (wall) {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 34; k++) {
      const s = document.createElement('span');
      s.textContent = QS[k % QS.length];
      s.style.left = (rnd() * 96) + '%'; s.style.top = (rnd() * 96) + '%';
      s.style.transform = 'rotate(' + ((rnd() - .5) * 30).toFixed(1) + 'deg)';
      s.style.fontSize = (22 + rnd() * 18).toFixed(0) + 'px';
      wall.appendChild(s);
    }
  }

  // Ce cade peste cerul de seară: petale, praf de soare, frunze sau zăpadă.
  const cv = $('fall'); if (!cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  let W = 0, H = 0, dpr = 1;
  const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); window.addEventListener('resize', size);
  const kind = LOOK.fall;
  const count = Math.round(Math.min(70, Math.max(26, W / 22)) * (kind === 'snow' ? 1.6 : 1));
  const LEAF = ['#F28C28', '#E8662A', '#FFB33B', '#C9502A'], PETAL = ['#FFC4DA', '#FFD9E6', '#FFFFFF', '#F7A8C8'];
  const parts = Array.from({ length: count }, () => spawn(true));
  function spawn(first) {
    const p = { x: Math.random() * W, y: first ? Math.random() * H : -30, r: 0, vr: (Math.random() - .5) * .04, a: Math.random() * Math.PI * 2, s: .6 + Math.random() * .9 };
    if (kind === 'sun') { p.y = first ? Math.random() * H : H + 20; p.vy = -(.2 + Math.random() * .45); p.size = 1.5 + Math.random() * 3; }
    else if (kind === 'snow') { p.vy = .4 + Math.random() * .9; p.size = 1.5 + Math.random() * 3.2; }
    else { p.vy = .5 + Math.random() * .8; p.size = 7 + Math.random() * 9; p.col = (kind === 'leaves' ? LEAF : PETAL)[Math.floor(Math.random() * 4)]; }
    return p;
  }
  function leaf(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.a) * .6 + .4);
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(0, -p.size);
    ctx.quadraticCurveTo(p.size * .9, -p.size * .2, 0, p.size); ctx.quadraticCurveTo(-p.size * .9, -p.size * .2, 0, -p.size); ctx.fill();
    if (kind === 'leaves') { ctx.strokeStyle = '#00000030'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -p.size * .8); ctx.lineTo(0, p.size); ctx.stroke(); }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (kind === 'snow') { ctx.globalAlpha = .75; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
      else if (kind === 'sun') { ctx.globalAlpha = .35 + .35 * Math.sin(p.a * 3); ctx.fillStyle = '#FFD43B'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.globalAlpha = .9; leaf(p); }
    }
    ctx.globalAlpha = 1;
  }
  function step() {
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      p.a += .02 * p.s; p.r += p.vr; p.y += p.vy * p.s; p.x += Math.sin(p.a) * (kind === 'snow' ? .4 : .8);
      if (p.y > H + 30 || p.y < -40 || p.x < -40 || p.x > W + 40) parts[k] = spawn(false);
    }
    draw();
  }
  if (calm) { draw(); return; }
  let on = true;
  document.addEventListener('visibilitychange', () => { on = !document.hidden; if (on) requestAnimationFrame(loop); });
  function loop() { if (!on) return; step(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
