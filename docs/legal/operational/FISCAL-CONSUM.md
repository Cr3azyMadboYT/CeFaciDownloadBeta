# Circuit fiscal, consumatori și lansarea comercială

Surse verificate: 10 octombrie 2026. CeFaci nu are încă firmă; contact confirmat: contact@cornacidev.ro. Acesta este un dosar de pregătire pentru contabil și consultant juridic, nu un circuit fiscal activ. Comisioanele din dashboard sunt estimări; `billing_ready=false` trebuie păstrat până la validare. OCR-ul unui bon nu certifică respectarea obligațiilor ANAF ale emitentului.

## Înaintea primei plăți sau facturi

- Stabilește operatorul economic, forma legală, activitățile autorizate, înregistrările fiscale și mandatul de reprezentare. Publică identitatea, adresa și contactul efectiv potrivit art. 5 din Legea 365/2002. Un footer nu înlocuiește o înregistrare obligatorie.
- Contabilul determină TVA, locul prestării, B2B/B2C/B2G, intermedierea sau prestarea proprie, emitentul și încasatorul. Nu colecta CNP implicit. Pentru magazinele de aplicații verifică separat rolul vânzătorului, facturile și comisioanele.
- Contractul Business precizează serviciile, tariful, baza comisionului, TVA, perioada, scadența, dovezile vizitei, corecțiile, încetarea, răspunderea și rolurile GDPR. Un total estimat nu emite o factură. Nu activa autofacturarea fără condițiile și acordul distinct aplicabile.
- Un viitor checkout Client trebuie să arate operatorul, prețul total, taxele, durata, reînnoirea, anularea, condițiile probei, retragerea și reclamațiile. Acceptarea termenilor nu autorizează singură o reînnoire și nu este o renunțare generică la retragere.
- Verifică protecțiile serviciilor digitale din OUG 141/2021, inclusiv situațiile în care consumatorul furnizează date în locul unui preț, în condițiile acelei ordonanțe. „Gratis” sau „beta” nu elimină automat drepturile.

## RO e-Factura

OUG 120/2021, în forma actuală consultată, reglementează factura structurată XML și obligațiile aplicabile. Din 1 ianuarie 2026, termenul general aplicabil de transmitere este de **5 zile lucrătoare** de la emitere, fără depășirea celor 5 zile lucrătoare de la data-limită legală pentru emitere. Nu folosi regula veche de 5 zile calendaristice. B2C are propriile condiții și excepții; contabilul verifică tranzacția și statutul părților.

Pregătește și testează: înrolare SPV, certificat/delegare, secrete păstrate exclusiv pe server, XML RO_CIUS/EN 16931, validare, idempotency, transmitere, stări și erori, descărcarea XML cu sigiliu, arhivare, retry, reconciliere și alerte pentru deadline. Un PDF sau `billing_ready=true` nu demonstrează transmiterea ANAF. Nu pune credențiale SPV în frontend sau repository.

Bonul localului și factura serviciului platformei sunt documente diferite. OCR-ul este dovadă internă; nu emite bonul în locul casei de marcat și nu transmite e-Factura emitentului bonului. Corecțiile, stornările și anulările urmează circuitul fiscal aprobat, fără ștergerea arbitrară a documentelor.

## Retenție contabilă

Art. 25 din Legea 82/1991 prevede pentru registrele și documentele justificative vizate păstrarea timp de 5 ani calculați de la 1 iulie a anului următor exercițiului financiar în care au fost întocmite. Verifică categoria și excepțiile cu contabilul. Acest termen nu se aplică automat fiecărei poze de suport sau preferințe. Excepțiile legale de la ștergerea GDPR trebuie motivate, minimizate și explicate persoanei.

## Consumatori, SAL și ODR

OUG 34/2014 stabilește informarea și retragerea pentru contractele la distanță aplicabile. Verifică termenul de 14 zile și excepția concretă a serviciului. Un checkbox generic nu elimină dreptul. Serviciul platformei și serviciul localului sunt distincte; nu exclude în bloc răspunderea legală sau instanțele competente pentru consumator.

Păstrează un contact efectiv pentru reclamații și informarea SAL ANPC aplicabilă, inclusiv cerințele formale de afișare la lansarea comercială. **Platforma europeană SOL/ODR este închisă din 20 iulie 2025.** Nu o prezenta ca serviciu activ pe baza unor instrucțiuni vechi. Verifică ordinele ANPC curente și canalele funcționale.

Revizuiește și licențele catalogului/OSM și fonturilor, transparența promovării plătite dacă se introduce, eventualele obligații DSA/P2B pentru modelul efectiv și accesibilitatea serviciului, cu excepțiile legale reale. Paginile juridice nu rezolvă singure aceste formalități.
