# Backend V2 și revenire

## Admin și suport — instalate 09.10.2026

| Fișier local | Migrare live | SHA-256 |
|---|---|---|
| `20261009095047_cefaci_admin_support.sql` | `20261009100906_cefaci_admin_support` | `267c5b02e46a9cc8988360fcd6423806a1f30f7ed84c2397a2b7f129e0d2d0c1` |
| `20261009095924_cefaci_admin_operations.sql` | `20261009143212_cefaci_admin_operations` | `e643788e8367d5a9a25979c1b1596fbce822472767f50861568f6b9ecbff8b39` |

Ambele sunt instalate pe CeFaci2.0 și verificate prin metadate și granturi. Snapshoturile înainte de instalare sunt `backend-before-admin.json` și `backend-before-admin.sql`, fără date personale. Tabelele/cozile/jurnalele sunt aditive; funcțiile legacy care ar ocoli auditul/financiarul sunt restrânse. Nu relua aceste fișiere peste live și nu modifica migrațiile instalate.

`supabase/rollback/pause-admin-support.sql` oprește API-urile Admin și scrierile suport/încărcările noi, păstrând datele, documentele și operațiunile existente Client/Business. Este un script de urgență, nu un pas de instalare. Revenirea web folosește pachetul anterior salvat privat. Nu restaura automat vechile funcții care ocoleau auditul sau drepturile financiarului; pentru reluare folosește granturi explicite după corecție și teste. Workerul privat de retenție și limitele operaționale sunt descrise în [ADMIN-20261009.md](ADMIN-20261009.md).

Ținta autorizată este exclusiv **CeFaci2.0**, `vqrmwuarjjntusfbqprx`. Istoricul live a fost inspectat: 30 migrații înainte de V2, ultimele `20261007165417` și `20261007165421`. Timestampurile vechi nu coincid integral cu repositoryul. Nu se execută reset, repair al istoricului sau replay al migrațiilor de bază peste producție.

Cele cinci fișiere V2 sunt:

1. `20261008085951_cefaci_group_v2.sql`
2. `20261008085952_cefaci_operations_v2.sql`
3. `20261008085954_cefaci_visits_v2.sql`
4. `20261008085955_cefaci_legacy_alignment_v2.sql`
5. `20261008100000_cefaci_review_v2.sql`

Pe instalația existentă se aplică împreună, în aceeași tranzacție, ca migrare `cefaci_client_business_v2_20261008`. Aceasta evită o stare intermediară în care Clientul, Business și API-urile legacy folosesc reguli diferite. Pe o bază nouă de test se execută normal toate fișierele ordonate. Suma SHA-256 a SQL-ului concatenat și versiunea Edge instalată sunt în raportul de livrare.

Instalarea a fost efectuată: versiune live `20261008110910`. A urmat corecția `20261008111500_cefaci_legacy_group_guard.sql`, instalată live ca `20261008114010_cefaci_legacy_group_guard`. Aceasta blochează scrierile legacy asupra vizitelor V2 chiar după ștergerea contului/planului, folosind identitatea vizitei și snapshotul tarifului. Cele cinci fișiere inițiale instalate nu au fost editate după instalare. Nu executa automat `supabase db push` sau replay-ul acestora peste live: mappingul între fișiere și cele două intrări live trebuie păstrat explicit, împreună cu diferențele de timestamp din baza originală.

Migrațiile sunt aditive pentru datele operaționale și istorice. Funcțiile vechi care ar ocoli V2 răspund cu mesaj de actualizare. Istoricul V1 păstrează tarifele sale; V2 salvează tarife și eligibilități per vizită. Noile funcții validează rolul activ, localul, starea, participarea, cheile idempotente și limitele pe server. Backendul nu are nevoie de un serviciu PHP paralel.

`docs/livrare/backend-before-v2.sql` păstrează definițiile funcțiilor suprascrise, extrase înainte de instalare, fără datele utilizatorilor. `docs/livrare/edge-before-v2/` păstrează sursa live `citeste-bon`, versiunea 8, fără valori de secrete. Ramurile de backup păstrează separat codul original. Aceste snapshoturi nu înlocuiesc backupul/PITR al platformei pentru date.

## Revenire sigură

Auditul din 09.10.2026 a adăugat fișierul `20261008143201_cefaci_security_audit_v3.sql`, instalat live ca **`20261009075509_cefaci_security_audit_v3`**. SHA-256: `8bbb003c798efc45302e0ff978a7e63f3be037594d192d4c04b292441f1dc9d4`. Corectează înghețarea grupului, verificarea versiunilor null, conversia votului și datele programului Plus. Snapshotul celor șase funcții înainte de această migrare este `backend-before-audit-v3.sql`, fără date personale. Migrațiile deja instalate nu au fost editate sau reluate. Păstrează aceste garduri la orice revenire; preferă pauza fluxului și o corecție aditivă unei restaurări a bypass-urilor.

1. Dacă apar probleme, aplică `supabase/rollback/pause-v2.sql` numai pe ținta autorizată. Flagul `private.v2_release.writes_on=false` oprește operațiunile principale V2; citirea istoricului și dovezile rămân disponibile. Nu reseta baza, nu șterge vizite și nu redeschide scrierile V1 retrase.
2. Pentru web, reinstalează pachetul anterior salvat privat și golește cache-ul HTML. Un Client vechi va primi mesaj de actualizare pentru API-urile retrase; acest comportament este intenționat și mai sigur decât permiterea calculelor vechi peste datele V2.
3. Dacă problema privește OCR, redeploy al snapshotului Edge v8 cu **verify_jwt=true** poate fi făcut separat, păstrând configurația de secrete existentă. Versiunea veche nu conectează bonurile V2, deci menține pauza fluxului afectat până la corecție.
4. Analizează evenimentele, versiunile numărului și jurnalul de review, apoi livrează o migrare corectivă. Nu executa orbește toate definițiile vechi peste noile date: ar pierde semantica V2. Pentru revenire completă de date este necesar backup/PITR administrat separat.
5. După teste și verificări, reactivează `writes_on=true` conform comentariului din script. Billing rămâne false.

În producție verificările folosesc cataloage/permisiuni și apeluri anonime neautorizate. Nu creează conturi/localuri de fraudă, nu trimit notificări și nu introduc bonuri sintetice în datele reale. Deadline-urile/expirările sunt calculate de server și persistate la consultare/operațiune; nu depind de un cron pe telefon.

În audit a fost instalată și funcția `citeste-bon` v10 (ACTIVE, verify_jwt=true), păstrând secretele existente și fixând exclusiv importul Supabase la 2.117.2. Snapshotul v9 este în `edge-before-audit-v3/`; logica V2 a bonului nu a fost schimbată.

## Completare onboarding Business — 09.10.2026

Migrarea `20261009082804_cefaci_business_onboarding.sql` este aditivă: trei tabele private, API-uri noi și un bucket privat nou pentru documente. Nu înlocuiește funcțiile Client/Business deja instalate. Snapshotul de metadate înainte de instalare este `backend-before-onboarding.json`; nu conține persoane, documente sau secrete. Instalarea și mappingul timestampului live se consemnează în raport după verificare.

Pentru oprirea de urgență a cererilor noi, `supabase/rollback/pause-business-onboarding.sql` revocă scrierile de cerere/decizie și oprește încărcările noi. Citirea cererilor, dovezile și jurnalul sunt păstrate, iar operațiunile anterioare Client/Business nu sunt oprite. Scriptul nu se rulează la instalarea normală. Reactivează numai după corecția verificată; nu șterge tabelele, bucketul sau documentele pentru a reveni la un APK anterior.

Instalat exclusiv pe CeFaci2.0: `20261009091138_cefaci_business_onboarding` (fișier local `20261009082804`, SHA-256 `27e3a98c1559eb235cab8a5ec0220ad0f41f32f85b2056657f07e15ea4aea2ac`). A urmat `20261009091432_cefaci_business_onboarding_indexes` (fișier local `20261009091301`, SHA-256 `6e7fea19967cd1f892331a34edfcf7487c43ce18daa22df6f1d6cab192f10616`), care acoperă cheile externe noi pentru anonimizarea conturilor și administrarea localurilor. Numărul localurilor/partenerilor/membrilor existent a rămas identic înainte și după instalare; nu au fost create cereri reale de test. RLS și lipsa drepturilor directe pe tabelele private, granturile RPC și bucketul privat 8 MiB au fost verificate live, iar API-urile de cereri/profil/retention refuză accesul anonim.
