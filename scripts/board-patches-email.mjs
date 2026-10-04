// Sign-in with an email code (Supabase OTP), on the design's phone screen: same look, email instead of SMS.
// Each entry is [where, find, replace]; applied after the account patches.
export const CONT_EMAIL = [
 [
  "tpl",
  "<h1 id=\"ph-t\" class=\"h1\">Numărul tău</h1>",
  "<h1 id=\"ph-t\" class=\"h1\">Emailul tău</h1>"
 ],
 [
  "tpl",
  "<span style=\"font: 650 17px/1 'Instrument Sans', system-ui, sans-serif; color: var(--ink2)\">+40</span><label for=\"ph\" style=\"position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)\">Numărul de telefon</label><input id=\"ph\" type=\"tel\" autocomplete=\"tel-national\" value=\"{{phone}}\" onChange=\"{{onPhone}}\" placeholder=\"7xx xxx xxx\">",
  "<label for=\"ph\" style=\"position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)\">Adresa de email</label><input id=\"ph\" type=\"email\" inputmode=\"email\" autocomplete=\"email\" autocapitalize=\"off\" spellcheck=\"false\" value=\"{{phone}}\" onChange=\"{{onPhone}}\" placeholder=\"nume@exemplu.ro\">"
 ],
 [
  "tpl",
  "<label for=\"cd\" class=\"lbl\">Codul din SMS</label>",
  "<label for=\"cd\" class=\"lbl\">Codul din email</label>"
 ],
 [
  "tpl",
  "<div class=\"demo\"><p class=\"lbl\">Demo · în SMS a venit codul 318642</p><button type=\"button\" class=\"press dchip\" onClick=\"{{codeDemo}}\" style=\"margin-top: 8px\">Scrie codul</button></div>",
  "<p class=\"muted\" style=\"margin: 0\">Nu l-ai primit? Uită-te și la Spam. <button type=\"button\" class=\"press\" onClick=\"{{resend}}\" style=\"padding: 0; border: 0; background: none; color: var(--blue); font: inherit; font-weight: 700\">Trimite din nou</button></p>"
 ],
 [
  "tpl",
  "<sc-if value=\"{{codeOpen}}\" hint-placeholder-val=\"{{ false }}\">\n<div class=\"col pop\" style=\"gap: 8px\"><label for=\"cd\"",
  "<sc-if value=\"{{authErr}}\" hint-placeholder-val=\"{{ false }}\"><p class=\"err pop\" role=\"alert\" style=\"margin: 0\">{{authErr}}</p></sc-if>\n<sc-if value=\"{{codeOpen}}\" hint-placeholder-val=\"{{ false }}\">\n<div class=\"col pop\" style=\"gap: 8px\"><label for=\"cd\""
 ],
 [
  "code",
  "phone: ['hi', 'Salut! Întâi numărul tău. Îți trimit un cod, ca să știu că ești tu.'],",
  "phone: ['hi', s.sent ? 'Ți-am trimis un cod pe email. Scrie-l aici.' : 'Scrie-mi emailul. Îți trimit un cod, ca să știu că ești tu.'],"
 ],
 [
  "code",
  "    const digits = s.phone.replace(/\\D/g, '');",
  "    const mail = s.phone.trim().toLowerCase();\n    const mailOk = /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/.test(mail);"
 ],
 [
  "code",
  "    v.phone = s.phone; v.onPhone = (e) => set({ phone: e && e.target ? String(e.target.value).slice(0, 13) : '', sent: false, code: '' });",
  "    v.phone = s.phone; v.onPhone = (e) => set({ phone: e && e.target ? String(e.target.value).slice(0, 80) : '', sent: false, code: '', authErr: '' });"
 ],
 [
  "code",
  "    v.codeDemo = () => set({ code: '318642', codeBad: false });",
  "    v.resend = () => { set({ authErr: '', code: '' }); APP.emailStart(mail).then((err) => set({ authErr: err || '' })); };"
 ],
 [
  "code",
  "    v.phoneOff = s.sent ? s.code.length !== 6 : digits.length < 9;",
  "    v.phoneOff = !!s.busy || (s.sent ? s.code.length < 6 : !mailOk);"
 ],
 [
  "code",
  "    v.phoneBtn = s.sent ? 'Confirmă codul' : 'Trimite-mi codul';",
  "    v.phoneBtn = s.busy ? 'O clipă…' : (s.sent ? 'Confirmă codul' : 'Trimite-mi codul');"
 ],
 [
  "code",
  "    v.phoneNext = () => { if (!this.state.sent) { set({ sent: true }); return; } if (this.state.code === '318642') this.go('name'); else set({ codeBad: true }); };",
  "    v.phoneNext = () => {\n      set({ busy: true, authErr: '' });\n      if (!this.state.sent) { APP.emailStart(mail).then((err) => set(err ? { busy: false, authErr: err } : { busy: false, sent: true })); return; }\n      APP.emailVerify(mail, this.state.code).then((err) => { if (err) set({ busy: false, codeBad: true }); else { set({ busy: false }); this.go('name'); } });\n    };"
 ],
 [
  "code",
  "      goLocal: () => this.go('name'),",
  "      goEmail: () => this.setState({ step: 'phone', sent: false, code: '', authErr: '' }), goLocal: () => this.go('name'),"
 ],
 [
  "code",
  "    v.onCode = (e) => set({ code: e && e.target ? String(e.target.value).replace(/\\D/g, '').slice(0, 6) : '', codeBad: false });",
  "    v.onCode = (e) => set({ code: e && e.target ? String(e.target.value).replace(/\\D/g, '').slice(0, 10) : '', codeBad: false }); // Supabase sends 6 to 10 digits"
 ],
 [
  "tpl",
  "autocomplete=\"one-time-code\" maxlength=\"6\"",
  "autocomplete=\"one-time-code\" maxlength=\"10\""
 ]
];
