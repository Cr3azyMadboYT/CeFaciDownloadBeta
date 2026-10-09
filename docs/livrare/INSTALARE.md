# Livrare CeFaci Client + Business + Admin

## Admin pe gazduire.net

Creează `admin.cefaci.app` cu document-root separat, de exemplu `public_html/admin`, activează TLS și extrage `CeFaci-Admin-web.zip` direct acolo, inclusiv `.htaccess`. Directoare 755, fișiere 644; nu este necesar Node/PHP. Verifică `version.json`, navigarea directă pe o cale adâncă, fonturile, CSP/HSTS și lipsa cache-ului pe HTML. La update urcă întâi asseturile cu hash, apoi indexul/versiunea; salvează release-ul vechi privat. Admin este construit cu asseturi absolute la rădăcina subdomeniului.

Intrarea folosește un cont CeFaci existent și un rol activ în `public.staff`; conturile obișnuite sunt refuzate. Cele două roluri staff sunt păstrate; `contact@cornacidev.ro` are rolul fondator. Nu se creează un cont administrator demo și nu se publică o cheie service-role. Folosește Echipa pentru acordarea rolurilor în limitele contului autorizat. Configurează/verifică OTP email ca la Business. Noul release cere apoi autentificator TOTP pentru toate rolurile Admin și Business operaționale; la prima intrare configurează personal factorul, apoi folosește codul lui la fiecare verificare cerută. Interfețele și funcțiile rămase neconfigurate sunt consemnate în [ADMIN-20261009.md](ADMIN-20261009.md).

Reconstrucție Admin: `npm ci` la rădăcină, `npm run admin:typecheck`, `npm run admin:build`, `npm run admin:package`. Pachetul este `release/CeFaci-Admin-web.zip`. Nu au fost furnizate credențiale pentru publicarea acestui update.

Codul Clientului rămâne React Native/Expo în `mobile/`. Business în `business/` folosește componente React Native, cameră nativă și același Bilu/fonturi/palete. Exportul web reutilizează aceste componente; aplicația Business nu este un WebView. Canvasurile originale și ramurile de backup sunt păstrate.

## Web pe gazduire.net

1. În panoul hostingului, creează subdomeniul **business.cefaci.app**. Document-root trebuie să fie un director separat al acestui subdomeniu, de exemplu `public_html/business`. Folosește directorul indicat efectiv de panou, nu directorul principal al site-ului și nu `admin.cefaci.app`.
2. Configurează în DNS adresa indicată de gazduire.net și activează certificatul TLS al subdomeniului. Așteaptă emiterea certificatului înainte de testarea camerei.
3. Dezarhivează `CeFaci-Business-web.zip` direct în document-root. `index.html`, `.htaccess`, `manifest.webmanifest`, `version.json`, `_expo/` și `assets/` trebuie să fie la rădăcină. Activează afișarea fișierelor ascunse pentru a verifica `.htaccess`. Nu este necesar Node/PHP pe shared hosting.
   Pachetul setează directoarele la 755 și fișierele publice la 644. Dacă panoul păstrează alte permisiuni după extragere, aplică aceste valori numai acestui document-root; fișierele trebuie să poată fi citite de procesul web. Nu folosi 777.
4. La o actualizare, urcă întâi noile asseturi cu hash, apoi `index.html` și `version.json`. Păstrează temporar asseturile vechi pentru sesiunile deschise. Salvează copia completă a release-ului anterior într-un director privat; nu o lăsa descoperibilă pe web.
5. Pe Apache/LiteSpeed, `.htaccess` forțează HTTPS, dezactivează listingul și permite fallback-ul aplicației. Indexul și versiunea nu sunt cache-uite; asseturile cu hash pot fi cache-uite un an. Dezactivează cache-ul HTML impus suplimentar din panou/CDN. Dacă hostul refuză `Options -Indexes`, elimină numai această directivă și dezactivează listingul din panou.
6. Deschide `https://business.cefaci.app/version.json`, verifică SHA-ul release-ului, apoi aplicația pe telefon și desktop. Verifică navigarea/reîncărcarea, zi/noapte, fonturile și lipsa erorilor JS.
7. Ecranul de intrare Business separă **„Ai deja cont? Intră”** de **„Revendică localul”** și **„Nu găsesc localul / Solicit adăugarea”**. Intrarea pe contul existent folosește OTP pe email cu `shouldCreateUser=false`; crearea unui cont pentru o cerere este o alegere explicită, fără acordarea automată a unui rol. Serverul returnează separat localurile cu rol activ și cererile proprii de revendicare/adăugare. Verifică trimiterea/primirea reală a codului cu propriul cont; testele automate nu trimit emailuri oamenilor reali. Verificarea firmei și a dreptului solicitantului este manuală până la configurarea furnizorilor ANAF/ONRC, SMS/apel; un CUI cu formă validă nu este afișat ca firmă verificată. Vezi [ONBOARDING-BUSINESS-20261009.md](ONBOARDING-BUSINESS-20261009.md) pentru dispute, documente, aprobare și activare. Pentru un circuit viitor OAuth/magic-link, adaugă domeniul în URL Configuration/redirect allowlist Supabase și configurează separat providerul. OTP-ul introdus în aplicație nu depinde de un callback OAuth.
8. Permite camera în browser. Camera web cere HTTPS și o permisiune acordată explicit. Dacă aceasta este refuzată sau dispozitivul nu o oferă, introducerea manuală a codului rămâne disponibilă. Verifică bilet valabil, bilet expirat, local greșit și scanare repetată pe date de test într-un mediu separat.

Pentru coduri email, șabloanele Auth trebuie să includă `{{ .Token }}`: verifică **Magic Link** pentru intrare și **Confirm signup** pentru cont nou, în Dashboard Supabase → Authentication → Email Templates. Un email care conține numai `{{ .ConfirmationURL }}` oferă un link și nu afișează codul cerut de ecranul nativ. Verifică și SMTP-ul, domeniul expeditorului și limitele de livrare înainte de deschiderea către parteneri; configurația șabloanelor/SMTP nu a fost disponibilă prin instrumentele acestui mediu. API-ul public confirmă email activ și signup permis, dar aceasta nu dovedește livrarea unui cod real. [Ghidul Supabase pentru OTP email](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Nu au fost furnizate credențiale gazduire.net/DNS pentru upload. La 09.10.2026, o verificare HTTP read-only confirmă că `https://business.cefaci.app` este deja online și servește versiunea `4d10d80cea11457d7c14d28d6b12ce5cc7b60ede`, încărcată separat. Noul ZIP cu onboarding și corecțiile de securitate trebuie urcat. Existența site-ului anterior nu înseamnă că acest update este publicat.

## Android și iOS

GitHub Actions `.github/workflows/android.yml` instalează lockfile-urile, rulează testele și construiește separat `CeFaci-Client.apk` și `CeFaci-Business.apk` cu Gradle `assembleRelease`. Dacă secretul existent de semnare este disponibil, construiește și AAB-uri semnate. Fișierul `*-build.txt` include commitul, tipul semnării, verificarea criptografică `apksigner` și identitatea pachetului. Nu deduce semnarea de producție doar din numele `release`.

Instalarea APK-ului pe un telefon existent trebuie să respecte certificatul anterior. Dacă Android raportează semnături incompatibile, păstrează datele înaintea oricărei dezinstalări; nu înlocui cheia originală. Buildurile automate nu echivalează cu o testare pe dispozitiv fizic.

Arhivele `*-ios-project.zip` conțin proiectele generate. Pentru iOS: checkout la commitul din `*-build.txt`, `npm ci` la rădăcină și în aplicația respectivă, `npx expo prebuild --platform ios --no-install`, apoi CocoaPods/Xcode pe macOS, selectarea Apple Team/provisioning și Archive/Export. Nu există IPA construit: acest mediu nu are infrastructură Apple/semnare iOS configurată.

## Configurare operațională

Proprietarul/managerul setează capacitatea reală, programul de rezervări, durata ocupării, modul obligatoriu/recomandat/nenecesar și pragul de auto-confirmare. Capacitatea implicită zero nu inventează locuri disponibile. Grupurile de minimum opt cer confirmare manuală. Intervalele pot trece de miezul nopții; timpul și calendarul sunt Europe/Bucharest.

Proprietarul folosește echipa existentă; rolul `scos` revocă accesul pe server chiar dacă sesiunea Auth rămâne validă. Managerul nu poate modifica/acorda proprietari. Recepția și scanarea nu primesc financiarul. Codul localului este afișat proprietarului/managerului și poate fi tipărit. Nu publica accesul proprietarului pentru a demonstra scannerul.

Participanții fără cont sunt numărați explicit. Pentru oferte 18+, organizatorul declară separat vârstele acestora; lipsa vârstelor sau prezența minorilor blochează revendicarea. „Clienți noi” nu poate fi verificat pentru anonimi, deci aceste grupuri nu primesc oferta rezervată clienților noi. GPS-ul este un control declarat de proximitate, nu o dovadă imposibil de falsificat.

Reducerile sunt afișate fără să modifice scorul de potrivire al motorului de recomandări. Nu s-a păstrat un bonus de clasare care să împingă un local nepotrivit în față. Drepturile, procentele și tarifele vizitei sunt calculate și păstrate pe server.

## Stări neconfigurate

- `billing_ready=false`: calculele operaționale sunt disponibile; emiterea fiscală, facturarea, colectarea și providerul de plăți nu sunt configurate.
- Evenimentele cu bilete/plăți nu simulează o achiziție și nu sunt prezentate ca infrastructură livrată.
- Push Business în fundal nu este configurat. Realtime, evenimentele persistente, recuperarea la reconectare și pollingul în foreground sincronizează interfețele; push-ul nu este sursa stării.
- Abonamentul Plus plătit și sincronizarea cu un provider de abonamente nu sunt configurate. Eligibilitatea folosește dreptul existent din backend. Compensațiile pentru refuz sunt separate, limitate și auditate.
- Testarea OCR reală depinde de secretul Vision și de un bon real valid; nu au fost introduse bonuri sau scenarii de fraudă în datele oamenilor reali.

## Reconstrucție

Instalează întâi toate cele trei lockfile-uri: `npm ci` la rădăcină, în `mobile/` și în `business/`. Apoi `npx vitest run` la rădăcină și `npm run typecheck` în fiecare aplicație. Testele funcțiilor Business au nevoie și de configurația TypeScript Expo din dependențele Business. Export web: `CI=1 EXPO_NO_TELEMETRY=1 npm run web` în `business/`, apoi `node scripts/package-business-web.mjs` la rădăcină. Buildurile native se produc prin workflow, nu prin redenumirea unui bundle JS în APK. La declanșare manuală, opțiunea `app` permite reconstruirea numai a Clientului sau Business; pe push se construiesc ambele.

Concurență reală: PostgreSQL 17 local, `CEFACI_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres node scripts/test-business-concurrency.mjs`. Scriptul acceptă numai localhost, creează o bază efemeră și o șterge la final. Browser: instalează Playwright, servește `business/dist` pe localhost:4173 și execută `scripts/test-business-ui.mjs`; acesta interceptează backendul cu date sintetice, inclusiv WebSocket. Fixture-urile nu sunt incluse în bundle.


## Actualizare MFA și tururi pe rol

Backendul MFA `20261009215832` este instalat. Folosește ZIP-urile web finale la sursa `a2e6d5b` și Business Android **1.0.4/code5** la sursa `12ce83b`, nu release-ul anterior care nu are ecranul MFA. Rolul fondator pentru `contact@cornacidev.ro` este păstrat. La prima intrare configurează Google Authenticator/2FAS/Microsoft Authenticator prin ecranul aplicației; nu există cod precreat sau secret în repository. Webul cere relogare și păstrează autentificarea numai în sesiunea browserului. Pe dispozitivul nativ, update-ul șterge vechea sesiune în clar și folosește SecureStore.

Tururile Bilu pornesc după accesul verificat, sunt adaptate la rol și local și se reiau din **Tur cu Bilu**. Vezi [SECURITATE-ADMIN-BUSINESS-20261009.md](SECURITATE-ADMIN-BUSINESS-20261009.md). Publicarea efectivă a noului web nu este realizată fără credențiale gazduire.net.
