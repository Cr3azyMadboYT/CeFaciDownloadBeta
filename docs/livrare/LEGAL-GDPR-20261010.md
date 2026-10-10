# Site și drepturi GDPR — 10.10.2026

Implementarea este salvată în `b98721b5c576cfe8f158520f969650b5a63a764a`. [Workflow 38033998387](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38033998387) verifică sursa înainte de buildurile semnate Client și Business. La acest checkpoint, pipelineul este în curs; buildurile noi nu sunt încă declarate livrate.

## Ce este implementat

- Site public în `website/`, cu Bilu, fonturi locale licențiate, temă zi/noapte, progres Client/Business/Admin, ecrane reale, navigare accesibilă și nouă pagini juridice. Nu introduce analytics, marketing, cookies sau cereri externe înainte de apăsarea unui link. Tema se păstrează numai la alegerea utilizatorului și se poate șterge separat.
- Aceleași documente în toate cele trei aplicații, inclusiv înainte de autentificare și în ecranele MFA. Sursa comună este `shared/legal-content.ts`, versiunea `2026-10-10`; generatorul produce HTML și Markdown, cu escapare și fără script inline.
- Cereri reale pentru acces, rectificare, ștergere, restricționare, opoziție și portabilitate. Identitatea provine exclusiv din sesiunea Auth activă; solicitantul nu poate trimite un ID al altei persoane. Personalizarea nu acordă acces la dashboard. Trimiterea și reîncercarea sunt idempotente, cu istoric paginat.
- Inbox Admin numai pentru fondator și admin, cu MFA și sesiune securizată, răspunsuri versionate și jurnal imuabil. Termenul este o lună calendaristică; o prelungire motivată de maximum două luni trebuie comunicată în prima lună. Un răspuns înregistrat nu simulează ștergerea datelor.
- Export rapid al datelor proprii de bază, fără secrete Auth/MFA, identificatorul dispozitivului, fotografii private, QR-uri ori datele altor persoane. Ultimele 100 de cereri sunt incluse, cu indicator de trunchiere; exportul nu înlocuiește răspunsul GDPR complet.
- Ștergerea contului refuză sesiuni revocate și trimite spre evaluare conturile cu documente, imagini, roluri, rezervări, Drop-uri, vizite, bonuri ori cereri în curs. Un cont Client simplu rămâne șters efectiv. UI nu șterge starea locală înaintea confirmării serverului.
- Avatarul, bonul și atașamentele Client folosesc poza aleasă în selectorul sistemului; nu cer acces la întreaga galerie. Noul manifest blochează permisiunile largi de stocare/media. Camera și locația rămân permisiuni la cerere, cu scopurile explicate corect. [Documentația Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).

## Verificări locale

**484 teste trecute, un test opțional omis**, 50 fișiere trecute din 51; TypeScript Client/Business/Admin și buildul clientului web de referință trecute. Sunt incluse 17 teste SQL dedicate drepturilor și opt teste noi privind ștergerea web și minimizarea fotografiilor.

**19 scenarii concurente PostgreSQL 17**: cele 15 existente plus patru noi pentru cereri simultane, răspunsuri concurente, revocarea sesiunii și retrogradarea rolului Admin. Testele folosesc exclusiv baze localhost izolate, eliminate la încheiere.

Browserul verifică toate cele trei aplicații, documentele înainte de login/MFA, cereri cu răspuns pierdut și reîncercare, export deliberat, istoric cu peste 100 de rânduri, toate rolurile Admin/Business, retragerea datelor după schimbarea rolului și un export întârziat după închiderea ecranului. Site-ul și cele nouă pagini au trecut verificarea pe Apache, inclusiv 320 px, tastatură/dialog/focus, CSP, HSTS, MIME/cache, 301 pentru URL-urile vechi și 404 real. Headerul de proxy simulează TLS; certificatul gazduire.net nu este verificat de aceste teste.

## Backend și revenire

Migrarea nouă locală este `20261010070306_cefaci_privacy_rights.sql`, SHA-256 `ba8dc9671d4c075f6f15d92bf0aa807946b25a87d38979aa81bac46c8f79ae11`. Nu au fost editate sau reluate migrațiile instalate anterior. Snapshotul definițiilor și contoarelor preinstalare este `backend-before-privacy-20261010.json`: 1.093 localuri, două roluri staff, zero membri Business și zero raportări noi. Instalată după verificarea pachetelor finale web/Apache și CI, versiune live **20261010072621_cefaci_privacy_rights**. Snapshotul după instalare este `backend-privacy-installed-20261010.json`: RLS activ, fără citire directă anon/authenticated, RPC-urile refuză anon și au search_path gol, gardul ștergerii activează verificarea sesiunii. Contoarele și rolul fondator sunt păstrate, zero cereri ori loguri GDPR fictive. Au trecut **27 probe HTTP live read-only**, inclusiv noile API-uri și scheme private. `backend-privacy-advisors-20261010.json` păstrează verificarea advisory-urilor; tabelele private fără policies directe sunt intenționat deny-by-default, iar setările Auth existente neadministrabile sunt documentate separat.

Revenirea interfețelor folosește pachetele precedente din `release/previous-legal-20261010/`. Păstrează gardurile MFA și verificarea sesiunii live; nu restaura vechea ștergere bazată numai pe `auth.uid()`, nu elimina cererile și jurnalele și nu șterge tabele pentru a reveni vizual. Drepturile pot fi exercitate și la contact@cornacidev.ro dacă un flux este temporar indisponibil. Backupul remote `backup/cefaci-security-20261010` păstrează `fc91382`; ramurile originale rămân intacte.

## Publicare și limite reale

Pachetul pentru cefaci.app este `release/CeFaci-site-web.zip`; instrucțiunile sunt în [SITE-CEFACI-20261010.md](SITE-CEFACI-20261010.md). Hostingul nu este publicat automat: nu există credențiale gazduire.net în mediu. ZIP-urile includ numai fișierele publice, fără repository, SQL, backupuri sau chei.

Titularul a confirmat că nu are încă firmă, a confirmat contact@cornacidev.ro și a ales să nu publice încă numele/adresa. Configul public păstrează explicit identitatea incompletă. Nu se inventează SRL, CUI, sediu, DPO ori contracte; documentele nu sunt prezentate drept conformitate completă. Facturarea, plățile și integrarea ANAF rămân dezactivate.

[Dosarul operațional](../legal/operational/README.md) include registrele prelucrărilor/furnizorilor, procedurile pentru drepturi, ștergere și incidente, retenția, DPIA/LIA și pregătirea fiscală/consumatori. [Sursele oficiale](../legal/operational/SURSE.md) documentează cercetarea. Confirmarea operatorului, contractele furnizorilor, deciziile de retenție și schedulerul de ștergere fizică rămân necesare; accesul expirat la atașamente nu dovedește eliminarea binarelor. Un contabil și un consultant juridic trebuie să valideze circuitul comercial real înainte de activare. Nu s-au trimis notificări juridice, emailuri reale ori facturi și nu s-au creat fixture-uri în producție.

Clientul nou este 0.3.3/code6, Business nou 1.0.5/code6. iOS livrează proiectul generat, fără IPA semnat sau test pe telefon fizic; exportul Share nativ nu este declarat probat pe un dispozitiv fizic.
