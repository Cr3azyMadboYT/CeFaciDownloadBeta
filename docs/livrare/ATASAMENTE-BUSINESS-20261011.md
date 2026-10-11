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

PDF-urile sunt validate prin octeți ASCII, fără dependență de TextDecoder în mediul nativ. Pachetele web CI corespund fișierelor testate local, cu excepția orei de împachetare; JPEG, PDF și normalizarea pozelor au trecut și cu CSP activ. Sursa aplicațiilor pentru buildurile finale este 8336a5f242eaa7cc68d9cf065d837e5af6bb0bc4. Dovezile native sunt completate la încheierea CI. Testele native pe simulator acoperă ecranele pre-login și documentele publice; selecția de documente pe un telefon fizic rămâne o verificare suplimentară utilă.


## Notificări Supabase Advisor

După migrare, numărul RPC-urilor autentificate SECURITY DEFINER crește cu 3. Acestea verifică proprietarul/permisiunea curentă; execuția pentru anon este revocată, iar testele de acces neautorizat, IDOR și revocare de rol trec. RLS fără politici pe tabelele private este intenționat: accesul direct este refuzat și se folosesc RPC-urile autorizate. Referințe: [funcții SECURITY DEFINER autentificate](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS fără politici](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Advisor păstrează notificările preexistente pentru pg_net în public, 3 funcții publice anon intenționate pentru catalog/interes la lansare și protecția parolelor compromise dezactivată. Loginul CeFaci folosește cod email și MFA pentru dashboarduri. Referințe: [schema extensiei](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [execuție anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [protecția parolelor compromise](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
