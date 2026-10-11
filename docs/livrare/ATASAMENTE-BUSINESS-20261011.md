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

Dovezile buildurilor și verificările finale ale migrării sunt completate după rularea CI. Testele native pe simulator acoperă ecranele pre-login și documentele publice; selecția de documente pe un telefon fizic rămâne o verificare suplimentară utilă.
