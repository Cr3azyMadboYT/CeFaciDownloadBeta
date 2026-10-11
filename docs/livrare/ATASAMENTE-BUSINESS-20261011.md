# Business 1.0.9 — documente private și Admin

Eroarea JPEG poate apărea pentru fotografii valide cu date după markerul de final, de exemplu Motion Photo. Validatorul anterior cerea finalul JPEG chiar la ultimii doi octeți ai fișierului. Parserul nou găsește finalul în structura JPEG, acceptă imaginile progresive și expune la previzualizare numai imaginea statică. Nu am descărcat și nu am modificat fotografiile reale ale utilizatorilor; nu pot confirma că fișierul original din captură era Motion Photo.

În Business, un document este suficient. Opțional se pot atașa până la 5 PDF-uri sau imagini JPEG/PNG: maximum 8 MB per fișier și 20 MB per dosar. Pozele noi sunt decodate și regenerate ca JPEG, cu latura maximă de 2048 px. PDF-urile nu sunt rescrise. Fișierele pot fi scoase din formular înainte de trimitere. La întreruperea uploadului, dosarul rămâne ciornă și reîncercarea păstrează aceleași fișiere și aceeași cerere.

Admin afișează fiecare fișier separat, cu nume și tip. Deschiderea rămâne autentificată, cu permisiuni actuale, MFA pentru personal și acces temporar de 5 minute. Niciun URL public și nicio cheie de server nu ajung în pachetele web/native. Fișierele vechi cu o singură dovadă rămân compatibile.

Migrarea adaugă un manifest privat, verifică server-side numărul, dimensiunea și tipul declarat și confirmă existența fiecărui obiect încărcat înainte ca cererea să intre în coada Admin. RLS permite încărcarea doar pe căile declarate ale solicitantului, fără înlocuirea obiectelor. Identitatea, rolurile, MFA și dreptul de proprietate rămân verificate de backend.

Lucrătorul de retenție include și proof-2 până la proof-5. Confirmarea ștergerii se permite doar după eliminarea fizică a tuturor fișierelor. Schedulerul și secretul privat de retenție nu sunt configurate de această livrare; limita de acces la 90 de zile este aplicată în backend. Vezi ONBOARDING-BUSINESS-20261009.md pentru activarea lucrătorului.

## Instalare

Înlocuiește conținutul subdomeniilor Admin și Business cu pachetele web noi, inclusiv .htaccess. Site-ul cefaci.app și aplicația Client nu necesită înlocuire pentru această corecție. Pe Android instalează noul Business 1.0.9, cod 10, semnat cu certificatul de producție existent. Pentru iOS, buildul 10 pentru device este nesemnat; distribuția pe dispozitive necesită semnarea Apple.

## Backup și revenire

Produsele anterioare sunt păstrate în release/previous-business-files-20261011/. Definițiile backend dinaintea migrării sunt în backend-before-private-files-20261011.sql; fișierul este o referință, nu un rollback de executat automat. Revenirea UI se poate face cu pachetele precedente, păstrând migrarea aditivă. Nu elimina manifestele, obiectele Storage sau noile RPC-uri după ce există dosare cu mai multe fișiere. Restaurarea funcțiilor vechi ar ascunde atașamentele suplimentare din Admin.

## Validare

Fixture-urile JPEG/PNG/PDF din teste sunt sintetice. Au trecut parserul, selecția/normalizarea fișierelor, RLS, IDOR, expirarea accesului, retragerea rolului și reîncercările. Testele de browser interceptează toate cererile Supabase; nu trimit emailuri și nu încarcă documente reale. Testul separat pe PostgreSQL verifică cereri claim/new/dispute, dosarul cu două fișiere și raportările Business → Admin.

Migrarea este aplicată în CeFaci2.0. Verificarea live confirmă bucket privat, RLS activ, păstrarea celor 2 dosare existente și refuz HTTP 401 pentru toate cele 3 operații noi fără autentificare. Detaliile și notificările existente ale Supabase Advisor sunt în builds/Business-private-files-backend-checks.json. Notificările pentru RPC-uri SECURITY DEFINER autentificate sunt evaluate împreună cu verificările de rol și RLS; noile RPC-uri nu sunt executabile de anon.

PDF-urile sunt validate prin octeți ASCII, fără dependență de TextDecoder în mediul nativ. Codul și asseturile pachetelor web CI corespund octet cu octet fișierelor testate local; împachetarea adaugă manifestul, antetele de găzduire și metadatele versiunii. JPEG, PDF și normalizarea pozelor au trecut și cu CSP activ. Parserul verifică și cea mai mare dimensiune declarată în toate cadrele JPEG, înainte să creeze un URL Blob.

Pachetele web finale provin din sursa `78c5408ea9c2175858c9875f93eda1d1bc8b9a7f`: [CI 38147753688](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38147753688). Au trecut 528 de teste, verificările PostgreSQL concurente și toate fluxurile de browser; un test pentru fixture-uri de catalog absente este omis explicit. Digesturile GitHub, CRC-urile, version.json, CSP și lipsa JavaScriptului inline sunt verificate. Dovezi: builds/Business-private-files-web-*.

Android a fost compilat din `8336a5f242eaa7cc68d9cf065d837e5af6bb0bc4`. Sursa iOS este `4da0eac07ef8bdb37eef96e22d60ac01ed0ef7d2`; diferența față de Android corectează calea capturilor din testul Maestro. Modificarea web ulterioară privește parserul JPEG folosit de Admin și nu schimbă codul Business nativ. Testele native pe simulator acoperă ecranele pre-login și documentele publice; selecția de documente pe un telefon fizic rămâne o verificare suplimentară utilă.


## Notificări Supabase Advisor

După migrare, numărul RPC-urilor autentificate SECURITY DEFINER crește cu 3. Acestea verifică proprietarul/permisiunea curentă; execuția pentru anon este revocată, iar testele de acces neautorizat, IDOR și revocare de rol trec. RLS fără politici pe tabelele private este intenționat: accesul direct este refuzat și se folosesc RPC-urile autorizate. Referințe: [funcții SECURITY DEFINER autentificate](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS fără politici](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Advisor păstrează notificările preexistente pentru pg_net în public, 3 funcții publice anon intenționate pentru catalog/interes la lansare și protecția parolelor compromise dezactivată. Loginul CeFaci folosește cod email și MFA pentru dashboarduri. Referințe: [schema extensiei](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [execuție anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [protecția parolelor compromise](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).


## Android livrat

Business **1.0.9 / code10**, APK și AAB reale: [CI 38143849800](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38143849800), sursa 8336a5f. Artefactul a fost descărcat și verificat prin digest GitHub, CRC, checksumurile interioare, manifestul Android compilat și certificatul de producție existent. AAB a trecut și verificarea criptografică PKCS7 și a tuturor celor 1346 de intrări semnate. Dovezi în builds/Business-private-files-Android-*.
