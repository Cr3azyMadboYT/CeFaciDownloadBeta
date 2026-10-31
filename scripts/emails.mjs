// Writes the account emails CeFaci can send (Supabase Auth, through Resend) in one look, from one layout:
// supabase/email/*.html. Each file is pasted in Supabase → Authentication → Emails (Templates, or Security notifications),
// with the subject written in its header comment. Tables and inline styles only, so Gmail, Outlook and Apple Mail show
// them the same. Usage: node scripts/emails.mjs
import fs from 'node:fs';

const C = { bg: '#E8EBF2', sky: '#262066', skyInk: '#C9CEF2', ink: '#0E1440', ink2: '#2C3363', ink3: '#5B6386', yellow: '#FFD43B', blue: '#2F5BFF', link: '#2447E0', soft: '#F1F3F9' };
const font = 'font-family:Arial,Helvetica,sans-serif;';
const p = (html, extra = '') => `<div style="${font}font-size:15px;line-height:22px;color:${C.ink2};${extra}">${html}</div>`;
const h = (text) => `<div style="${font}font-size:18px;font-weight:800;color:${C.ink};padding:28px 0 12px 0;">${text}</div>`;
const box = (html) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:${C.soft};border-radius:18px;"><tr><td style="padding:16px 18px;${font}font-size:14px;line-height:21px;color:${C.ink2};">${html}</td></tr></table>`;
const strong = (t) => `<strong style="color:${C.ink};">${t}</strong>`;
const steps = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map((t, i) => `
        <tr>
          <td width="40" valign="top" style="padding:0 0 14px 0;"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${C.blue};color:#FFFFFF;text-align:center;${font}font-size:15px;font-weight:700;">${i + 1}</div></td>
          <td valign="top" style="padding:4px 0 14px 0;${font}font-size:15px;line-height:22px;color:${C.ink2};">${t}</td>
        </tr>`).join('')}
      </table>`;
/** The yellow ticket with the code, like the one in the app. */
const ticket = (label) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.yellow};border-radius:22px;">
        <tr><td align="center" style="padding:22px 18px 6px 18px;"><div style="${font}font-size:12px;font-weight:700;letter-spacing:2.5px;color:${C.ink2};">${label}</div></td></tr>
        <tr><td align="center" style="padding:6px 18px 4px 18px;"><div style="font-family:'Courier New',Courier,monospace;font-size:36px;line-height:46px;font-weight:700;letter-spacing:6px;color:${C.ink};">{{ .Token }}</div></td></tr>
        <tr><td style="padding:10px 0 0 0;"><div style="border-top:2px dashed rgba(14,20,64,0.35);margin:0 18px;font-size:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td align="center" style="padding:12px 18px 18px 18px;"><div style="${font}font-size:14px;line-height:20px;color:${C.ink2};">Valabil ${strong('o oră')} · îl folosești ${strong('o singură dată')}</div></td></tr>
      </table>`;
const help = p(`Ai nevoie de ajutor? Scrie-ne la <a href="mailto:contact@cornacidev.ro" style="color:${C.link};text-decoration:underline;">contact@cornacidev.ro</a>.`, `font-size:13px;line-height:20px;color:${C.ink3};padding-top:20px;`);

function page({ note, subject, title, preheader, hello, intro, body, why }) {
  return `<!doctype html>
<!--
  ${note}
  Subiectul: ${subject}
  Generat de scripts/emails.mjs (nu-l edita de mână). Poza lui Bilu vine de pe cefaci.app (assets/bilu-email.png).
-->
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td style="background:${C.sky};border-radius:28px 28px 0 0;padding:26px 28px 0 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="bottom" style="padding-bottom:22px;">
            <div style="${font}font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">CeFaci<span style="color:${C.yellow};">.</span></div>
            <div style="${font}font-size:30px;line-height:34px;font-weight:800;color:#FFFFFF;padding-top:18px;letter-spacing:-0.8px;">${hello}</div>
            <div style="${font}font-size:16px;line-height:23px;color:${C.skyInk};padding-top:8px;">${intro}</div>
          </td>
          <td width="96" valign="bottom" align="right"><img src="https://cefaci.app/assets/bilu-email.png" width="84" height="110" alt="Bilu" style="display:block;border:0;outline:none;"></td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="background:#FFFFFF;border-radius:0 0 28px 28px;padding:28px;">
      ${body}
      ${help}
    </td></tr>
    <tr><td align="center" style="padding:22px 20px 6px 20px;${font}font-size:12px;line-height:19px;color:${C.ink3};">
      ${strong('CeFaci')} · Din „ce facem?” în „hai că mergem”. · București &amp; Ilfov<br>
      ${why}<br>
      <a href="https://cefaci.app/" style="color:${C.link};text-decoration:none;">cefaci.app</a> ·
      <a href="https://cefaci.app/confidentialitate/" style="color:${C.link};text-decoration:none;">Confidențialitate</a> ·
      <a href="https://cefaci.app/termeni/" style="color:${C.link};text-decoration:none;">Termeni</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

const notYou = (what) => box(`${strong('N-ai fost tu?')} ${what} Scrie-ne imediat la <a href="mailto:contact@cornacidev.ro" style="color:${C.link};">contact@cornacidev.ro</a> și intră în cont ca să verifici.`);
const resendHint = p('Codul a expirat sau nu merge? În aplicație apasă „Trimite din nou” și îți vine altul.', `font-size:13px;line-height:20px;color:${C.ink3};padding-top:20px;`);
const safety = box(`${strong('Nu da codul nimănui.')} Echipa CeFaci nu ți-l cere niciodată: nici pe telefon, nici pe mesaj, nici pe email.<br><br>${strong('N-ai cerut tu codul?')} Ignoră emailul. Fără cod nu intră nimeni în contul tău, iar codul expiră singur.`);

const EMAILS = {
  'magic-link': {
    note: 'Emailul cu codul de intrare, pentru un cont care există deja. Supabase → Authentication → Emails → Templates → „Magic Link”.',
    subject: '{{ .Token }} e codul tău CeFaci', title: 'Codul tău CeFaci',
    preheader: 'Codul tău de intrare în CeFaci e {{ .Token }}. E valabil o oră. Nu-l da nimănui.',
    hello: 'Hei! Bilu aici.', intro: 'Ai cerut să intri în CeFaci. Mai e un singur pas.',
    body: ticket('CODUL TĂU DE INTRARE') + h('Ce faci acum') + steps([
      `Întoarce-te în ${strong('CeFaci')}, pe ecranul unde ți-am cerut codul (aplicația, Business sau Admin).`,
      'Scrie codul de mai sus. Poți să-l și copiezi: ține apăsat pe cifre.',
      'Gata, ești înăuntru. Hai să găsim unde ieșiți în seara asta.',
    ]) + safety + resendHint,
    why: 'Ai primit emailul pentru că s-a cerut un cod de intrare pentru adresa ta.',
  },
  'confirm-signup': {
    note: 'Primul email, la un cont nou făcut cu emailul. Supabase → Authentication → Emails → Templates → „Confirm signup”.',
    subject: '{{ .Token }} e codul tău CeFaci · Bun venit!', title: 'Bun venit în CeFaci',
    preheader: 'Bun venit în CeFaci! Codul tău e {{ .Token }}. E valabil o oră.',
    hello: 'Bun venit în CeFaci!', intro: 'Eu sunt Bilu. De azi te ajut să nu mai stați ore în șir pe „ce facem?”.',
    body: ticket('CODUL TĂU DE ÎNCEPUT') + h('Ce urmează') + steps([
      `Scrie codul în ${strong('CeFaci')}, pe ecranul unde ți l-am cerut.`,
      'Îți pun câteva întrebări scurte: de unde pleci, ce buget ai, cu cine ieși. Durează un minut.',
      `Apasă ${strong('Creează plan')} și îți fac 3 planuri gata, cu locuri deschise la ora voastră.`,
    ]) + safety + resendHint,
    why: 'Ai primit emailul pentru că cineva a început un cont CeFaci cu adresa ta.',
  },
  'mfa-factor-enrolled': {
    note: 'Notificare: s-a pornit verificarea în doi pași (Admin/Business). Supabase → Authentication → Emails → Security notifications → „MFA factor enrolled” (de pornit acolo).',
    subject: 'Ai pornit verificarea în doi pași în CeFaci', title: 'Verificarea în doi pași e pornită',
    preheader: 'Contul tău CeFaci cere acum și codul din aplicația de autentificare.',
    hello: 'Cont mai sigur.', intro: 'Ai pornit verificarea în doi pași pentru contul tău CeFaci.',
    body: p(`De acum, la intrare îți cerem și codul din aplicația de autentificare (de exemplu Google Authenticator), pe lângă codul de pe email. Contul ${strong('{{ .Email }}')} e mai greu de spart.`) + notYou('Cineva poate avea acces la contul tău.'),
    why: 'Ai primit emailul pentru că s-a schimbat securitatea contului tău CeFaci.',
  },
  'mfa-factor-unenrolled': {
    note: 'Notificare: s-a oprit verificarea în doi pași. Supabase → Authentication → Emails → Security notifications → „MFA factor unenrolled” (de pornit acolo).',
    subject: 'Ai oprit verificarea în doi pași în CeFaci', title: 'Verificarea în doi pași e oprită',
    preheader: 'Contul tău CeFaci nu mai cere codul din aplicația de autentificare.',
    hello: 'Atenție la cont.', intro: 'Verificarea în doi pași a fost oprită pentru contul tău CeFaci.',
    body: p(`Contul ${strong('{{ .Email }}')} nu mai cere codul din aplicația de autentificare la intrare. Pentru Admin și Business, verificarea în doi pași trebuie pornită din nou înainte de lucru.`) + notYou('Oprirea poate însemna că altcineva a intrat în contul tău.'),
    why: 'Ai primit emailul pentru că s-a schimbat securitatea contului tău CeFaci.',
  },
  'identity-linked': {
    note: 'Notificare: la cont s-a legat o altă metodă de intrare (de exemplu Google). Supabase → Authentication → Emails → Security notifications → „Identity linked” (de pornit acolo).',
    subject: 'Ai o metodă nouă de intrare în CeFaci', title: 'Metodă nouă de intrare',
    preheader: 'La contul tău CeFaci s-a adăugat o metodă nouă de intrare.',
    hello: 'Metodă nouă de intrare.', intro: 'La contul tău CeFaci s-a adăugat o nouă metodă de intrare.',
    body: p(`Acum poți intra în contul ${strong('{{ .Email }}')} și cu ${strong('{{ .Provider }}')}. Planurile, prietenii și găștile tale rămân aceleași, indiferent cum intri.`) + notYou('Cineva poate fi intrat în contul tău.'),
    why: 'Ai primit emailul pentru că s-a schimbat felul în care intri în contul tău CeFaci.',
  },
  'identity-unlinked': {
    note: 'Notificare: de la cont s-a scos o metodă de intrare. Supabase → Authentication → Emails → Security notifications → „Identity unlinked” (de pornit acolo).',
    subject: 'O metodă de intrare a fost scoasă din CeFaci', title: 'Metodă de intrare scoasă',
    preheader: 'De la contul tău CeFaci s-a scos o metodă de intrare.',
    hello: 'Metodă de intrare scoasă.', intro: 'De la contul tău CeFaci s-a scos o metodă de intrare.',
    body: p(`Contul ${strong('{{ .Email }}')} nu mai poate fi deschis cu ${strong('{{ .Provider }}')}. Poți intra în continuare cu codul primit pe email.`) + notYou('Cineva poate fi intrat în contul tău.'),
    why: 'Ai primit emailul pentru că s-a schimbat felul în care intri în contul tău CeFaci.',
  },
};

fs.mkdirSync('supabase/email', { recursive: true });
for (const [name, e] of Object.entries(EMAILS)) fs.writeFileSync(`supabase/email/${name}.html`, page(e));
console.log('Scrise: ' + Object.keys(EMAILS).map((n) => n + '.html').join(', '));
