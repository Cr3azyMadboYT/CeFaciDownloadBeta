// Real accounts start from zero (decision Cornel, 03.10): no invented friends, crews, XP or "popular" counts; Founder only for @cornacidev;
// Plus keeps the free week but never pretends to charge. Each entry is [where, find, replace], applied after board-patches.mjs.
export const DEMO_REAL = [
 [
  "tpl",
  "<div class=\"card\" style=\"margin-top: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px\">\n<div style=\"display: flex; align-items: center; gap: 12px\">\n<span style=\"display: flex; flex: none\" aria-hidden=\"true\">\n<span class=\"av\" style=\"width: 38px; height: 38px; background: #8C6CFF; color: #0E1440; border: 2px solid var(--s1)\">I</span>\n<span class=\"av\" style=\"width: 38px; height: 38px; margin-left: -10px; background: #FF6A4D; color: #0E1440; border: 2px solid var(--s1)\">M</span>\n<span class=\"av\" style=\"width: 38px; height: 38px; margin-left: -10px; background: #FFD43B; color: #0E1440; border: 2px solid var(--s1)\">S</span>\n</span>\n<span style=\"flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px\"><span style=\"font: 700 15px/1.25 'Instrument Sans', system-ui, sans-serif\">Ioana, Mihai și Sara sunt liberi {{whenPlain}}</span><span class=\"muted\">Din Gașca de vineri. Radu n-a zis încă.</span></span>\n</div>\n<button type=\"button\" class=\"press btnp\" onClick=\"{{voteFromHome}}\" style=\"height: 48px; font-size: 16px\"><svg class=\"i s\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"></path></svg>Pornește un vot cu ei</button>\n</div>",
  "<sc-if value=\"{{hasFreeFriends}}\" hint-placeholder-val=\"{{ false }}\">\n<div class=\"card\" style=\"margin-top: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px\">\n<div style=\"display: flex; align-items: center; gap: 12px\">\n<span style=\"display: flex; flex: none\" aria-hidden=\"true\">\n<span class=\"av\" style=\"width: 38px; height: 38px; background: #8C6CFF; color: #0E1440; border: 2px solid var(--s1)\">I</span>\n<span class=\"av\" style=\"width: 38px; height: 38px; margin-left: -10px; background: #FF6A4D; color: #0E1440; border: 2px solid var(--s1)\">M</span>\n<span class=\"av\" style=\"width: 38px; height: 38px; margin-left: -10px; background: #FFD43B; color: #0E1440; border: 2px solid var(--s1)\">S</span>\n</span>\n<span style=\"flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px\"><span style=\"font: 700 15px/1.25 'Instrument Sans', system-ui, sans-serif\">Ioana, Mihai și Sara sunt liberi {{whenPlain}}</span><span class=\"muted\">Din Gașca de vineri. Radu n-a zis încă.</span></span>\n</div>\n<button type=\"button\" class=\"press btnp\" onClick=\"{{voteFromHome}}\" style=\"height: 48px; font-size: 16px\"><svg class=\"i s\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"></path></svg>Pornește un vot cu ei</button>\n</div>\n</sc-if>"
 ],
 [
  "tpl",
  "<div style=\"margin-top: 24px; display: flex; align-items: baseline; justify-content: space-between\">\n<h2 style=\"margin: 0; font-family: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif; font-size: 22px; line-height: 1; font-weight: 740\">Populare în {{appZone}}</h2>\n<span class=\"muted\">săptămâna asta</span>\n</div>\n<ol style=\"list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px\">\n<sc-for list=\"{{trending}}\" as=\"t\" hint-placeholder-count=\"3\">\n<li><button type=\"button\" class=\"press card\" onClick=\"{{t.pick}}\" style=\"width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; color: var(--ink); text-align: left\">\n<span aria-hidden=\"true\" style=\"width: 30px; flex: none; font-family: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif; font-size: 30px; line-height: 1; font-weight: 800; color: var(--ink3)\">{{t.rank}}</span>\n<span aria-hidden=\"true\" style=\"width: 44px; height: 44px; flex: none; border-radius: 12px; background: {{t.bg}}; color: {{t.fg}}; display: flex; align-items: center; justify-content: center\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"{{t.icon}}\"></path></svg></span>\n<span style=\"flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px\"><span style=\"font: 650 15px/1.2 'Instrument Sans', system-ui, sans-serif\">{{t.title}}</span><span class=\"muted\">{{t.sub}}</span></span>\n<svg class=\"i s\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"color: var(--ink3)\"><path d=\"m9 18 6-6-6-6\"></path></svg>\n</button></li>\n</sc-for>\n</ol>",
  "<sc-if value=\"{{hasTrending}}\" hint-placeholder-val=\"{{ false }}\">\n<div style=\"margin-top: 24px; display: flex; align-items: baseline; justify-content: space-between\">\n<h2 style=\"margin: 0; font-family: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif; font-size: 22px; line-height: 1; font-weight: 740\">Populare în {{appZone}}</h2>\n<span class=\"muted\">săptămâna asta</span>\n</div>\n<ol style=\"list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px\">\n<sc-for list=\"{{trending}}\" as=\"t\" hint-placeholder-count=\"3\">\n<li><button type=\"button\" class=\"press card\" onClick=\"{{t.pick}}\" style=\"width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; color: var(--ink); text-align: left\">\n<span aria-hidden=\"true\" style=\"width: 30px; flex: none; font-family: 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif; font-size: 30px; line-height: 1; font-weight: 800; color: var(--ink3)\">{{t.rank}}</span>\n<span aria-hidden=\"true\" style=\"width: 44px; height: 44px; flex: none; border-radius: 12px; background: {{t.bg}}; color: {{t.fg}}; display: flex; align-items: center; justify-content: center\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"{{t.icon}}\"></path></svg></span>\n<span style=\"flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px\"><span style=\"font: 650 15px/1.2 'Instrument Sans', system-ui, sans-serif\">{{t.title}}</span><span class=\"muted\">{{t.sub}}</span></span>\n<svg class=\"i s\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"color: var(--ink3)\"><path d=\"m9 18 6-6-6-6\"></path></svg>\n</button></li>\n</sc-for>\n</ol>\n</sc-if>"
 ],
 [
  "tpl",
  "<span style=\"margin-top: 6px; align-self: flex-start; height: 24px; padding: 0 9px 0 6px; border-radius: 999px; background: #0E1440; color: #FFD43B; display: flex; align-items: center; gap: 5px; font: 800 12px/1 'Instrument Sans', system-ui, sans-serif; letter-spacing: 0.02em\"><svg class=\"i s\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"width: 14px; height: 14px\"><path d=\"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294zM5 21h14\"></path></svg>Founder</span>",
  "<sc-if value=\"{{isFounder}}\" hint-placeholder-val=\"{{ false }}\"><span style=\"margin-top: 6px; align-self: flex-start; height: 24px; padding: 0 9px 0 6px; border-radius: 999px; background: #0E1440; color: #FFD43B; display: flex; align-items: center; gap: 5px; font: 800 12px/1 'Instrument Sans', system-ui, sans-serif; letter-spacing: 0.02em\"><svg class=\"i s\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"width: 14px; height: 14px\"><path d=\"M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294zM5 21h14\"></path></svg>Founder</span></sc-if>"
 ],
 [
  "code",
  "const FRIEND_BASE = [",
  "const FRIEND_BASE = []; // real friends come from Supabase (etapa 2)\nconst FRIEND_BASE_DESIGN = ["
 ],
 [
  "code",
  "const CREWS = [",
  "const CREWS = []; // real crews come from Supabase (etapa 2)\nconst CREWS_DESIGN = ["
 ],
 [
  "code",
  "q: '', settled: false, sent: false, req: 'pending',",
  "q: '', settled: false, sent: false, req: 'none',"
 ],
 [
  "code",
  "lvPhase: 'ask', lvXp: 1420,",
  "lvPhase: 'ask', lvXp: 0, xp: 0, welcomeXp: false, stamps: [],"
 ],
 [
  "code",
  "    const cap = inFb ? (leveled ? 2500 : 1500) : (s.levelDone ? 2500 : 1500);\n    const xpNow = inFb ? s.lvXp : (s.levelDone ? 1570 : 1420) + (s.billXp || 0);",
  "    const xpNow = inFb ? s.lvXp : (s.xp || 0);\n    const lvNow = LEVEL_XP.reduce((acc, need, i) => (i && xpNow >= need ? i : acc), 0);\n    const lvTop = lvNow >= LEVEL_XP.length - 1;\n    const cap = lvTop ? LEVEL_XP[LEVEL_XP.length - 1] : LEVEL_XP[lvNow + 1];"
 ],
 [
  "code",
  "      askFeedback: !s.levelDone,",
  "      askFeedback: false, // the outing check-in comes with real outings (bon + XP, etapa 3)\n      hasFreeFriends: false, hasTrending: false, isFounder: String(APP.prefs.user || '').toLowerCase() === 'cornacidev',"
 ],
 [
  "code",
  "      lvlName: inFb ? (leveled ? LEVELS[4] : LEVELS[3]) : (s.levelDone ? LEVELS[4] : LEVELS[3]),\n      lvlText: leveled ? 'Nivel 4' : 'Nivel 3',\n      lvlShort: s.levelDone ? 'Nivel 4' : 'Nivel 3',",
  "      lvlName: lvNow ? LEVELS[lvNow] : 'Abia ai început',\n      lvlText: 'Nivel ' + lvNow,\n      lvlShort: 'Nivel ' + lvNow,"
 ],
 [
  "code",
  "      nextLvl: 'Încă ' + this.fmtNum(Math.max(0, cap - xpNow)) + ' până la ' + (s.levelDone ? LEVELS[5] : LEVELS[4]),",
  "      nextLvl: lvTop ? 'Ai ajuns la cel mai înalt nivel.' : 'Încă ' + this.fmtNum(Math.max(0, cap - xpNow)) + ' până la ' + LEVELS[lvNow + 1],"
 ],
 [
  "code",
  "this.setState({ bill: null, billXp: this.state.billXp + 25 });",
  "this.setState({ bill: null, billXp: this.state.billXp + 25, xp: (this.state.xp || 0) + 25 });"
 ],
 [
  "code",
  "this.setState({ bill: null, billDone: true, billXp: this.state.billXp + 25, screen: 'profile' });",
  "this.setState({ bill: null, billDone: true, billXp: this.state.billXp + 25, xp: (this.state.xp || 0) + 25, screen: 'profile' });"
 ],
 [
  "code",
  "    const patch = { tut: Object.assign({}, t, { on: false }) };",
  "    const patch = { tut: Object.assign({}, t, { on: false }) };\n    if (first && !this.state.welcomeXp) { patch.welcomeXp = true; patch.xp = (this.state.xp || 0) + 150; }"
 ],
 [
  "code",
  "if (m === 'pay') { this.setState({ plusBusy: true }); this.later(() => close({ plus: 'active' }, 'Gata! Plus e activ. Bilu e mândru de tine.'), 1100); return; }",
  "if (m === 'pay') { close({}, 'Plata pentru Plus vine curând, prin Google Play. Până atunci nu-ți luăm niciun ban.'); return; }"
 ]
];
