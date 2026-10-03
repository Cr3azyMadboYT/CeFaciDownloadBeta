// Sign-up without a phone number (no SMS yet), Google through Supabase, Apple hidden, birth date with a check.
// Each entry is [where, find, replace]; applied after the patches in board-patches.mjs.
export const CONT_ACCOUNT = [
 [
  "tpl",
  "<button type=\"button\" class=\"press sso\" onClick=\"{{goPhone}}\" style=\"border: 0; background: #FFD43B; color: #0E1440\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2\"></path></svg>Continuă cu telefonul</button>\n<button type=\"button\" class=\"press sso\" onClick=\"{{goSso}}\" style=\"border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: #FFFFFF\">Continuă cu Google</button>\n<button type=\"button\" class=\"press sso\" onClick=\"{{goSso}}\" style=\"border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: #FFFFFF\">Continuă cu Apple</button>\n<p style=\"margin: 6px 0 0; text-align: center; font: 500 12px/1.4 'Instrument Sans', system-ui, sans-serif; color: #A9B1DA\">Ai deja cont? <span style=\"color: #FFD43B; font-weight: 700\">Intră</span> · Continuând, accepți Termenii și Politica de confidențialitate.</p>",
  "<button type=\"button\" class=\"press sso\" onClick=\"{{goGoogle}}\" style=\"border: 0; background: #FFD43B; color: #0E1440\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" style=\"width: 20px; height: 20px; flex: none\"><path d=\"M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.34Z\" fill=\"#4285F4\"></path><path d=\"M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.5c-.9.6-2.05.95-3.4.95-2.6 0-4.82-1.76-5.6-4.13H3.06v2.58A10 10 0 0 0 12 22Z\" fill=\"#34A853\"></path><path d=\"M6.4 13.89a6 6 0 0 1 0-3.78V7.53H3.06a10 10 0 0 0 0 8.94l3.34-2.58Z\" fill=\"#FBBC04\"></path><path d=\"M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.53L6.4 10.1C7.18 7.74 9.4 5.98 12 5.98Z\" fill=\"#EA4335\"></path></svg>Continuă cu Google</button>\n<button type=\"button\" class=\"press sso\" onClick=\"{{goEmail}}\" style=\"border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: #FFFFFF\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"></rect><path d=\"m22 7-10 6L2 7\"></path></svg>Continuă cu email</button>\n<button type=\"button\" class=\"press\" onClick=\"{{goLocal}}\" style=\"height: 44px; border: 0; background: none; color: #FFFFFF; font: 650 15px/1 'Instrument Sans', system-ui, sans-serif; text-decoration: underline; text-underline-offset: 3px\">Continuă fără cont</button>\n<sc-if value=\"{{showApple}}\" hint-placeholder-val=\"{{ false }}\"><button type=\"button\" class=\"press sso\" onClick=\"{{goSso}}\" style=\"border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.06); color: #FFFFFF\">Continuă cu Apple</button></sc-if>\n<sc-if value=\"{{authErr}}\" hint-placeholder-val=\"{{ false }}\"><p class=\"err pop\" role=\"alert\" style=\"margin: 0\">{{authErr}}</p></sc-if>\n<p style=\"margin: 6px 0 0; text-align: center; font: 500 12px/1.4 'Instrument Sans', system-ui, sans-serif; color: #A9B1DA\">Ai deja cont? Intră la fel, cu Google sau cu emailul. · Fără cont, profilul rămâne doar pe telefonul ăsta. Continuând, accepți Termenii și Politica de confidențialitate.</p>"
 ],
 [
  "tpl",
  "<div class=\"col\" style=\"gap: 8px\"><p id=\"yr\" class=\"lbl\">Anul nașterii</p><div role=\"group\" aria-labelledby=\"yr\" style=\"display: flex; gap: 8px; flex-wrap: wrap\"><sc-for list=\"{{years}}\" as=\"y\" hint-placeholder-count=\"5\"><button type=\"button\" class=\"{{y.cls}}\" aria-pressed=\"{{y.on}}\" onClick=\"{{y.pick}}\">{{y.label}}</button></sc-for></div><span class=\"muted\">{{ageNote}}</span></div>",
  "<div class=\"col\" style=\"gap: 6px\"><label for=\"bd\" class=\"lbl\">Data nașterii</label><div class=\"field\"><input id=\"bd\" type=\"text\" inputmode=\"numeric\" autocomplete=\"bday\" maxlength=\"10\" value=\"{{birth}}\" onChange=\"{{onBirth}}\" placeholder=\"ZZ.LL.AAAA, ex: 14.05.2004\"></div><span class=\"muted\">{{ageNote}}</span></div>"
 ],
 [
  "tpl",
  "<div class=\"foot\"><button type=\"button\" class=\"press big\" onClick=\"{{next}}\" disabled=\"{{nameOff}}\">Mai departe</button></div>",
  "<div class=\"foot\"><button type=\"button\" class=\"press big\" onClick=\"{{nameNext}}\" disabled=\"{{nameOff}}\">Mai departe</button></div>\n<sc-if value=\"{{ageAsk}}\" hint-placeholder-val=\"{{ false }}\">\n<div class=\"pop\" role=\"alertdialog\" aria-modal=\"true\" aria-labelledby=\"ag-t\" style=\"position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; justify-content: flex-end; background: rgba(14, 20, 64, 0.35)\">\n<div style=\"padding: 22px 20px 30px; border-radius: 28px 28px 0 0; background: var(--bg); display: flex; flex-direction: column; gap: 12px; box-shadow: 0 -12px 40px rgba(14, 20, 64, 0.25)\">\n<h2 id=\"ag-t\" class=\"h1\" style=\"font-size: 28px\">{{ageTitle}}</h2>\n<p style=\"margin: 0; font: 600 17px/1.4 'Instrument Sans', system-ui, sans-serif\">{{ageText}}</p>\n<sc-if value=\"{{ageMinor}}\" hint-placeholder-val=\"{{ false }}\"><p class=\"err\" style=\"margin: 0\">Până la 18 ani îți arătăm doar locurile pentru oricine: fără cluburi, baruri, pub-uri, narghilea și alte locuri 18+.</p></sc-if>\n<button type=\"button\" class=\"press big\" onClick=\"{{ageYes}}\" style=\"margin-top: 6px\">Da, e corectă</button>\n<button type=\"button\" class=\"press\" onClick=\"{{ageNo}}\" style=\"height: 48px; border: 0; background: none; color: var(--blue); font: 650 16px/1 'Instrument Sans', system-ui, sans-serif\">O corectez</button>\n</div>\n</div>\n</sc-if>"
 ],
 [
  "code",
  "const STEPS = ['start', 'phone', 'name', 'zone', 'likes', 'style', 'picks', 'friends', 'done'];",
  "const STEPS = ['start', 'name', 'zone', 'likes', 'style', 'picks', 'friends', 'done']; // no phone step until SMS is paid for"
 ],
 [
  "code",
  "progW: Math.round(Math.max(0, k - 1) / 7 * 100) + '%', progText: Math.max(1, k) + ' din 7',",
  "progW: Math.round(Math.max(0, k - 1) / 6 * 100) + '%', progText: Math.max(1, k) + ' din 6',"
 ],
 [
  "code",
  "goPhone: () => this.go('phone'), goSso: () => this.setState({ step: 'name', first: 'Cornel' })",
  "goGoogle: () => { this.setState({ authErr: '' }); APP.google().then((err) => { if (err) this.setState({ authErr: err }); }); },\n      goLocal: () => this.go('name'), goSso: () => this.setState({ authErr: 'Intrarea cu Apple vine în curând.' }), showApple: false, authErr: s.authErr || ''"
 ],
 [
  "code",
  "year: null,",
  "year: null, birth: '', birthIso: '', ageAsk: false, authErr: '',"
 ],
 [
  "code",
  "name: ['wink', 'Super. Acum cum să-ți zic? Prietenii te găsesc după username.'],",
  "name: s.ageAsk ? ['oops', 'Stai puțin! Verific o dată cu tine data nașterii.'] : ['wink', 'Salut! Cum să-ți zic? Prietenii te găsesc după username.'],"
 ],
 [
  "code",
  "'Ultimul pas: 5 locuri reale din zonă. Zi-mi repede dacă ai merge.'",
  "'Aproape gata: 5 locuri reale din zona ta. Zi-mi repede dacă ai merge.'"
 ],
 [
  "code",
  "APP.picksFor(s.likes, s.zoneId)",
  "APP.picksFor(s.likes, s.zoneId, { budget: s.budget, when: s.when, who: s.who, birth: s.birthIso })"
 ],
 [
  "code",
  "const vote = (x) => () => { const votes = this.state.votes.concat([x]);",
  "const vote = (x) => () => { APP.notePick(rp && rp.id, x); const votes = this.state.votes.concat([x]);"
 ],
 [
  "code",
  "    v.userSugg = [u + '.buftea', u + '_iese', u + '23'].map((label) => ({ label, pick: () => set({ user: label }) }));\n",
  ""
 ],
 [
  "code",
  "    v.years = [['2011', 2011], ['2009', 2009], ['2006', 2006], ['2001', 2001], ['1995', 1995], ['Mai demult', 1985]].map(([label, y]) => ({ label, on: s.year === y, cls: on(s.year === y), pick: () => set({ year: y }) }));\n",
  ""
 ],
 [
  "code",
  "    const age = s.year ? 2026 - s.year : null;\n",
  ""
 ],
 [
  "code",
  "    v.ageNote = age == null ? 'Ca să nu-ți arătăm locuri pentru care n-ai vârsta.' : (age < 16 ? 'CeFaci e de la 16 ani în sus. Revino peste câțiva ani, te așteptăm!' : (age < 18 ? 'Îți ascundem locurile 18+, cum sunt cluburile. În rest, tot ce e în Buftea.' : 'Perfect, vezi toate locurile, inclusiv cele 18+.'));\n",
  ""
 ],
 [
  "code",
  "    v.nameOff = first.length < 2 || !v.userOk || !s.year || age < 16;",
  "    // birth date, typed as ZZ.LL.AAAA; under 16 cannot join, 16-17 see no 18+ places\n    const bM = /^(\\d{2})\\.(\\d{2})\\.(\\d{4})$/.exec(s.birth);\n    const bIso = bM ? bM[3] + '-' + bM[2] + '-' + bM[1] : '';\n    const bDt = bM ? new Date(Number(bM[3]), Number(bM[2]) - 1, Number(bM[1])) : null;\n    const bReal = !!bDt && bDt.getDate() === Number(bM[1]) && bDt.getMonth() === Number(bM[2]) - 1 && bDt.getTime() <= Date.now();\n    const age = bReal ? APP.age(bIso) : null;\n    const bOk = age !== null && age <= 110;\n    v.userSugg = [u + '.ies', u + '_cf', u + (bM ? bM[3].slice(2) : '23')].map((label) => ({ label, pick: () => set({ user: label }) }));\n    v.birth = s.birth;\n    v.onBirth = (e) => { const dg = String(e && e.target ? e.target.value : '').replace(/\\D/g, '').slice(0, 8); set({ birth: dg.length > 4 ? dg.slice(0, 2) + '.' + dg.slice(2, 4) + '.' + dg.slice(4) : (dg.length > 2 ? dg.slice(0, 2) + '.' + dg.slice(2) : dg), ageAsk: false }); };\n    v.ageNote = !s.birth ? 'Ca să nu-ți arătăm locuri pentru care n-ai vârsta.' : (!bM ? 'Scrie data așa: 14.05.2004.' : (!bOk ? 'Data nu pare bună. Verifică ziua, luna și anul.' : (age < 16 ? 'CeFaci e de la 16 ani în sus. Revino peste câțiva ani, te așteptăm!' : (age < 18 ? 'Până la 18 ani îți arătăm doar locurile pentru oricine, fără baruri și cluburi.' : 'Perfect, vezi toate locurile, inclusiv cele 18+.'))));\n    v.nameOff = first.length < 2 || !v.userOk || !bOk || age < 16;\n    v.nameNext = () => this.setState({ ageAsk: true });\n    v.ageAsk = !!s.ageAsk && bOk;\n    v.ageMinor = bOk && age < 18;\n    v.ageTitle = 'Sigur e data corectă?';\n    v.ageText = bOk ? s.birth + ' înseamnă că ai ' + age + ' ani.' : '';\n    v.ageYes = () => { this.setState({ ageAsk: false, birthIso: bIso }); this.go('zone'); };\n    v.ageNo = () => this.setState({ ageAsk: false });"
 ]
];
