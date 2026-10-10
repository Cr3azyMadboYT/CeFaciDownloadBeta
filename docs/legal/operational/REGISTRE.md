# Evidențe GDPR, retenție și furnizori

Actualizat: 10 octombrie 2026. Responsabilul și aprobările nu sunt încă desemnate. Identitatea publică a operatorului se completează în `shared/legal-config.ts`; persoana fizică rămâne operator în această etapă, nu este exceptată de GDPR.

## Registru inițial al prelucrărilor — art. 30 GDPR

Această evidență trebuie confirmată de operator. Volumul mic nu creează automat excepție de la registru când prelucrarea nu este ocazională. Temeiurile de mai jos trebuie validate pentru scopul concret.

| Activitate | Persoane și date | Scop / temei propus | Destinatari și controale | Retenție de confirmat |
| --- | --- | --- | --- | --- |
| Autentificare/profil | Utilizatori, email, uid, metadate Google, prenume, username, data nașterii | Serviciul solicitat art. 6(1)(b); protecție eligibilitate/minori art. 6(1)(f) pentru controalele distincte | Supabase/Auth, Google dacă ales; profil privat separat, RLS | Cont activ; ștergere și excepții motivate; ciclurile backup/log specifice furnizorului |
| Preferințe/recomandări | Zonă, interese, buget, răspunsuri, punct profil rotunjit | Serviciul solicitat; opțiuni cu consimțământ numai unde realmente facultative | Supabase, dispozitiv; nu publicitate | Cont activ și cache local; reducerea câmpurilor la minim |
| Prieteni/găști/planuri | Relații, invitații, participanți, voturi, stări | Art. 6(1)(b) | Participanții autorizați, RLS; protecțiile minorilor | Evaluare per plan; drepturile altor participanți împiedică promisiunea generică „ștergem tot” |
| Bilete/Drop/vizite | Beneficiar, local, oră, număr persoane, stare; coordonate pentru validare punctuală | Executarea funcției; antifraudă proporțional art. 6(1)(f) | Localul relevant și Admin permis; server validează rol/local | Coordonatele nu se păstrează ca traseu; istorice/constatări până la termenul justificat, de aprobat |
| OCR bon | Imagine tranzitorie, CUI, dată/oră/total/reducere, amprentă | Funcția cerută, antifraudă | Edge + Google Cloud Vision dacă activ; nu bucket permanent de bonuri în cod | Imagine în procesare, câmpuri conform vizitei; metadate furnizor separat |
| Suport/local lipsă | Descriere, email/uid, poză opțională, răspunsuri | Serviciu și interes legitim soluționare/securitate | Admin cu permisiune; `support-photos` privat | Acces poză blocat după 90 de zile; ștergere Storage+ack, job de confirmat; text/răspunsuri termen distinct |
| Revendicare Business | Reprezentant, rol, telefon, firmă, CUI, document dovadă, dispute | Măsuri la cerere, mandat, securitate/fraudă | Admin autorizat, `business-proofs` privat | Acces dovadă blocat după 90 de zile; ștergere fizică de operat; evidențe contractuale separate |
| Roluri/MFA/audit | Echipa Business/Admin, uid/local/rol, sesiune/factor, acțiuni/motive | Serviciu profesional, interes legitim securitate | Acces server scopes; Admin 15 min / 8 ore, Business 30 min / 12 ore | Durata sesiunii nu este durata jurnalului; politici log/archive de stabilit |
| Drepturi GDPR | Autor, tip/scop, descriere, deadline, răspuns, istoric | Respectarea obligațiilor legale art. 6(1)(c) | Proprietarul cazului; fondator/admin cu MFA | Disociere uid la ștergere; conținut poate rămâne personal, termen minim de justificat, cleanup încă de configurat |
| Proba Plus | Hash derivat din ID dispozitiv, uid inițial, ora începerii | Prevenire reutilizare art. 6(1)(f) condiționată de LIA și reguli terminal | Tabel privat `trial_devices`; uid devine null la ștergere | Cod existent nu are TTL; persistența trebuie justificată/limitată, opozițiile evaluate |
| Notificări | Token dispozitiv, uid, payload plan/invitație | Funcția solicitată; permisiune notificare | Firebase dacă activat; mementouri locale separat | Token eliminat la logout/invalidare când posibil; cleanup de confirmat |
| Site/găzduire | IP, cerere HTTP, timestamp; tema aleasă | Livrare/securitate art. 6(1)(f), preferință cerută | Hosting; fonturi și assets selfhosted; fără analytics sau marketing | Logs în contract hosting; `cefaci.site.theme` până la ștergere |

## Registrul împuterniciților și destinatarilor

Nu trata numele produsului ca dovadă a entității juridice sau a regiunii. Completează pentru fiecare furnizor activ: entitate contractuală, scop, tip date, locații și acces suport, subîmputerniciți, DPA art. 28, transfer/SCC/TIA, retenție/backups, securitate, incident SLA, persoană responsabilă, dată revizuire și linkul dovezii.

| Furnizor | Utilizare reală / posibilă | De confirmat înainte de activare cu date reale |
| --- | --- | --- |
| Supabase | DB/Auth/Storage/Edge existente | DPA actual, regiune exactă proiect, Edge/log/backup/subîmputerniciți, mecanism transfer și restaurare |
| Găzduire web (gazduire.net conform cererii) | Landing și dashboarduri statice după încărcare | Firma contractuală, DPA, locație server/log/backups, retenție, acces și TLS; nu există confirmare de publicare automată |
| Google OAuth | Autentificare dacă utilizatorul alege | Roluri Google/cont, scopes email/profile; politica actuală; nu cere permisiuni suplimentare inutile |
| Google Cloud Vision | OCR când cheia/furnizorul activ | DPA, proiect/configurație, API online/global, metadate; documentația online spune procesare în memorie, nu dovedește toate jurnalele sunt în UE |
| Furnizor email tranzacțional | OTP în infrastructura Auth | Identitatea efectivă, DPA, regiune/metadate/logs și retenție; nu inventa SMTP/Resend dacă neconfirmat |
| Firebase Cloud Messaging | Push când configurat în build/backend | Contract și date transmise, tokenuri, transferuri, permisiune; nu amesteca cu mementourile locale |
| OpenStreetMap | Proveniența catalogului | Atribuire © contribuitorii OpenStreetMap/ODbL. Nu afirma că orice nume/telefon local este lipsit de date personale |
| Google Play / App Store | Numai distribuție ori plăți viitoare efectiv active | Identitate developer, Data safety/privacy disclosures, rol fiscal și termenii achiziției înainte de checkout |

## Convenție cu localurile și DPA

Pentru rezervare și servire, un local poate fi operator independent. Dacă CeFaci procesează anumite date numai la instrucțiunile localului, acel scop poate necesita DPA art. 28. Dacă scopurile sunt determinate împreună, analizează art. 26. Nu semna același tip de anexă indiferent de realitate.

O anexă de împuternicire, când este necesară, trebuie să includă: obiect/durată, natura și scopul prelucrării, categorii de date/persoane, instrucțiuni documentate, confidențialitate, măsuri de securitate, condițiile pentru subîmputerniciți, asistență drepturi/DPIA/incidente, ștergere/returnare, audit și transferuri. Identitatea și mandatul părților trebuie verificate. Acest dosar este lista de condiții de contractat, nu un DPA semnat.

## Retenție: dovada execuției

Ține un registru pentru fiecare job: scop, categorie, termen, excepții și păstrare justificată pentru litigiu, ultima execuție, candidați, fișiere șterse, confirmări, erori, retry și persoana care verifică. Service role rămâne numai pe server. Nu șterge rânduri `storage.objects` direct cu SQL: binarul se șterge prin Storage API, apoi RPC confirmă eliminarea.

RPC-uri reale: `business_proofs_retention_candidates()` → Storage remove → `business_proof_deleted(p_id)` și `support_photos_retention_candidates()` → Storage remove → `support_photo_deleted(p_id)`. Rulează dry-run și apoi o probă cu date sintetice înainte de a programa. Restricțiile de acces de 90 de zile și granturile numai pentru serviciul server nu demonstrează că schedulerul este activ. Dacă o păstrare justificată pentru litigiu este necesar, proiectează-l și documentează-l înainte de a păstra arbitrar documentul peste termen.

Separat trebuie definite termene pentru cererile GDPR, textul suportului, operațiuni/jurnal, hashul trial, tokenuri, backup/log și exporturi. Nu aplica termenul fiscal fiecărei preferințe sau poze; nu confunda pseudonimizarea cu anonimizarea.
