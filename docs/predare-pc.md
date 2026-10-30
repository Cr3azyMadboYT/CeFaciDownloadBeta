# Predare: din cloud pe PC (30.10)

Pentru Claude Code de pe PC-ul lui Cornel. Citește întâi `CLAUDE.md` (deciziile, unde e totul, regulile), apoi lista de mai jos.
Lucrul e pe ramura `main` (ramura principală din 30.10). `claude/new-session-hzbjtf` rămâne ca backup, cu tot istoricul din cloud.

## Ce a rămas de făcut de Cornel (în afara codului)
- [ ] Supabase → SQL Editor: rulează `supabase/de-rulat/20261023_curatenie_zilnica.sql` (curățenia zilnică din politica de confidențialitate; unealta Supabase din cloud nu aplică SQL cu `delete`).
- [ ] Supabase → Authentication → Emails → Templates → Magic Link (și Confirm signup): conținutul din `supabase/email/cod-intrare.html`, subiectul `{{ .Token }} e codul tău CeFaci`.
- [ ] Urcă pe gazduire.net, din ultimul build GitHub (Actions → Artifacts): `CeFaci-site-web` (site + texte legale 23.10 + poza lui Bilu pentru email) și `CeFaci-Admin-web` (QR-ul de la 2FA reparat).
- [ ] De confirmat pe telefon: crash-ul la prima intrare cu Google după instalare (reparat 23.10, încă neverificat pe Samsung).

## Următorii pași propuși (de ales de Cornel)
1. ~~Aducerea pe `main`~~ — gata (30.10): `main` făcut din ramura de lucru și pus ramură principală.
2. Google Play: cont de dezvoltator (decizie: pe SRL, `CLAUDE.md` → Bani), AAB-ul din `CeFaci-Client-native` la Testare internă, apoi amprenta SHA-1 din Play Console → App integrity adăugată la clientul OAuth Android (`docs/android.md`), formularul „Siguranța datelor” după `docs/legal/operational/PLAY-SIGURANTA-DATELOR.md`, clasificare 16+, cont de test cu email, poze pentru magazin. La fiecare urcare crește `version`/`versionCode` în `mobile/app.json` (acum 0.3.5 / 8). Buildul se face pe PC: `powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1` → `release/CeFaci-Client.aab`.
3. Partea legală înainte de lansare: identitatea operatorului (SRL), contractele cu Netopia și cu localurile (`docs/legal/operational/FISCAL-CONSUM.md`).
4. Întrebare deschisă pentru Cornel: la „Surprinde-mă → La vot”, se trimite gășcii doar surpriza, nu toate cele 3 planuri?

## În ziua lansării pe Google Play
- [ ] Supabase → SQL Editor: rulează `supabase/de-rulat/20261031_cote_la_lansare.sql` (ridică cota de bonuri de la 30 la 300 pe zi; „e deschis?” rămâne la 30 pe zi până trecem pe „doar planul ales”).
- [ ] Google Cloud: bugetul de 10 $ cu alertă să fie pus (Billing → Budgets).

## Cum se lucrează (pe scurt)
- APK/AAB semnate cu cheia reală le face GitHub la fiecare push (`.github/workflows/android.yml`); cheia e doar în secretele GitHub, nu în git. Fără `[skip ci]` doar când vrei build.
- Verificări înainte de push: `npx vitest run`, `cd mobile && npx tsc --noEmit`, `npm run admin:typecheck`, `cd business && npx tsc --noEmit`.
- Migrări noi: fișier în `supabase/migrations/`, test PGlite în `tests/`, `grant execute … to authenticated`, apoi aplicat pe Supabase („CeFaci 2.0”).
- Text nou în aplicație: `tr('…')` + traducerea în `src/i18n/en/`. Text legal nou: `shared/legal-content.ts` → `node scripts/generate-legal-pages.mjs`.
