# Tur interactiv CeFaci + voturi de lansare — 10.10.2026

## Ce primește vizitatorul

- Rută nouă `/descopera/`, accesibilă din CTA-ul principal și banda cu Bilu de pe homepage.
- Patru opriri: atmosferă, companie, prezentarea funcțiilor cu capturi reale, întrebarea „Ai folosi CeFaci la lansare?”.
- Răspunsuri Da/Poate/Nu cu aceeași vizibilitate; revenire între pași, imagini mărite în dialog, tastatură, mod luminos/întunecat și animații reduse.
- La final: nume sau alias, acord pentru participare 16+, email opțional și acord separat nebifat pentru un email de lansare. Fără cont, cookies, pixeli, tracking ori stocarea formularului în browser.
- Alegerile inițiale rămân numai în memoria paginii. Numai trimiterea finală comunică cu serverul.
- Retrimiterea după pierderea răspunsului folosește aceeași cheie. Link privat de retragere fără cont, cu confirmare explicită; simpla deschidere a linkului nu șterge date.

## Admin și date

Pagina **Lansare CeFaci**: numere Da/Poate/Nu, acorduri email, listă cu nume/email/data/acord, căutare literală, filtrare și paginare de 50, ștergere cu confirmare. Disponibilă fondatorului și administratorilor; dreptul este verificat pe server prin sesiune Auth activă, rol curent și MFA. Contabilul, suportul, editorul și moderatorul nu primesc aceste date. Tutorialul de rol include pagina.

Acestea sunt răspunsuri, nu persoane unice: aliasurile și adresele sunt declarate, neverificate. Limitele și dovada de calcul reduc trimiterile automate; nu sunt CAPTCHA, verificare de identitate ori protecție completă împotriva spamului/disponibilității. Există limite globale atomice: 100 trimiteri/minut, 5.000/24 h. Dovada SHA-256 are 12 biți; scopul este fricțiunea la spam, nu autentificarea. Reîncercările nu consumă din nou cotă, retragerile nu resetează cota.

Tabelele sunt în schema privată, RLS activ fără politici publice și fără granturi de citire pentru anon/authenticated. Cele două RPC publice permit strict trimitere/retragere, fără citirea numelor/emailurilor. RPC Admin cere fondator/admin + MFA. Cheia privată are 122 biți aleatori (UUID v4), serverul păstrează doar SHA-256. După retragere se reține numai amprenta, 180 zile, pentru a împiedica reactivarea acordului prin cereri întârziate.

Migrare locală: `20261010142524_cefaci_launch_quiz.sql`; aplicată în CeFaci2.0 (`vqrmwuarjjntusfbqprx`) ca **20261010143619**. Job activ `cefaci-launch-retention`, zilnic `25 3 * * *`, șterge răspunsurile expirate după 180 zile, amprentele expirate și cotele mai vechi de două zile. Nu au fost introduse voturi sau adrese de test în producție.

Politica de confidențialitate generată din `shared/legal-content.ts` descrie scopul, acordurile, accesul, retenția și retragerea. Identitatea publică a operatorului rămâne incompletă, conform opțiunii anterioare a titularului; acest lucru trebuie rezolvat înaintea colectării publice/lansării, nu este acoperit de un simplu checkbox.

## Emailuri

Se colectează cererea și acordul pentru un singur anunț al lansării. **Nu există trimitere automată configurată și nu s-au trimis emailuri.** Înainte de campanie: furnizor configurat, domeniu SPF/DKIM/DMARC, identitate/adresă operator, verificarea adreselor/double opt-in, suprimarea retragerilor, deduplicarea adreselor confirmate, dezabonare și procesare bounce/complaint. Nu folosi lista pentru alte campanii. Admin arată explicit că adresele sunt neverificate.

## Securitate verificată

- Teste SQL: validare server, acorduri independente, anti-enumerare, lipsă acces direct la tabele, toate cele șase roluri, MFA, sesiune revocată, paginare și filtre, expirare, idempotentă și retragere definitivă.
- PostgreSQL real, conexiuni separate: 8 trimiteri concurente produc un vot; retragerea prevalează în cursa cu reîncercările; cota este atomică; retrogradarea rolului blochează accesul imediat.
- Browser: 320/390/768/1440 px, variante de răspuns, back/tastatură, capturi reale, consimțământ, email opțional, reîncercare după răspuns pierdut, retragere cu eroare de rețea, fără cookies/localStorage/sessionStorage introduse de quiz.
- Apache real: CSP strict; numai pagina quiz are permisiunea de conectare la exact cele două RPC publice. Homepage și documentele păstrează `connect-src 'none'`. HTTPS redirect, MIME/cache, fără cod inline.
- Advisor Supabase: noile constatări `SECURITY DEFINER` pentru RPC sunt expuneri intenționate cu validare explicită, nu permisiuni de citire la tabele; RLS fără politici este deny-by-default în schema privată. Explicații oficiale: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable și https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Avertismentele anterioare pentru `pg_net` și protecția parolelor compromise nu sunt modificări ale acestui tur.

## Pachete și publicare

`release/CeFaci-site-web.zip` → rădăcina domeniului **cefaci.app**, incluzând fișierele `.htaccess` și `descopera/.htaccess`.
`release/CeFaci-Admin-web.zip` → rădăcina domeniului Admin existent.
`marketing/launch-quiz/CeFaci-Instagram-Story.png` și instrucțiunile din README → Story cu sticker Link către `https://cefaci.app/descopera/`.

Backendul este aplicat; **site-ul și Adminul trebuie publicate pe găzduire**. Verificarea publică a `/descopera/` a returnat 404 înainte de livrare. Nu avem credențiale gazduire.net în mediul curent. Păstrează configurația HTTPS și `.htaccess`; nu publica sursele repo, SQL, rapoarte sau backupuri în webroot. Backupul celor două ZIP-uri anterioare și al checksumurilor este `release/previous-site-quiz-20261010/`.

Buildurile native Client/Business existente nu sunt înlocuite: această livrare schimbă site-ul public și Adminul. Documentul comun actualizat va intra în următoarele builduri native.
