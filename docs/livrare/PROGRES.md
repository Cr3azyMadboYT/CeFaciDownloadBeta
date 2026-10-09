# CeFaci Client + Business — progres verificabil

Ramură: `codex/cefaci-client-business-20261008`, de la `52e7e03` (cod bază `45ad496`).
Backupuri remote verificate și păstrate: `backup/claude-original-20261008` = `9d1e02c`; `backup/cefaci-current-20261008` = `45ad496`.

Au fost citite toate cele patru documente handoff, începând cu PROMPT-CODEX-CLOUD.md, contextul proiectului și regulile/designul. Regulile active au prioritate față de propunerile vechi.

Baza repositoryului: 263 teste trecute, un test opțional de tabel omis. Aceste rezultate validează baza, nu V2.
Schema live CeFaci2.0 inspectată read-only: 30 migrații, ultimele `20261007165417` și `20261007165421`; V2 încă neinstalat la acest checkpoint.

Primul checkpoint: API de participare cu deadline server, număr comun, timeout fără penalizare, serializare pe plan și cheie idempotentă. Urmează testele integrate, operațiunile partener și interfețele. Nu există încă artefacte noi APK/web la acest checkpoint.

Checkpoint 2: migrații V2 pentru operațiuni și financiar; legătura nativă Client; Business React Native cu export static. 274 teste trecute, un test opțional omis. Cinci scenarii de concurență pe PostgreSQL 17 cu conexiuni independente au trecut. Typecheck Client/Business trece; web Business și prebuild Business Android/iOS generate. API-urile V1 rămân testate ca snapshot al backupului; suita V2 încarcă toate migrațiile și verifică retragerea intenționată a scrierilor legacy.

La acest checkpoint, backendul V2 nu este încă instalat live și APK-urile nu sunt încă construite. Workflowul verifică schema concurentă și construiește separat Client și Business; implementarea și validarea continuă pe aceeași ramură.

Checkpoint 3: 289 teste trecute, un test opțional omis; 22 cazuri integrate V2 și patru contracte partajate. Cinci scenarii concurente pe PostgreSQL 17 trec. Typecheck ambele aplicații, Deno check Edge și web static trec. Playwright verifică telefon/desktop, zi/noapte, scanner, ordinea financiarului, logout și răspunsuri întârziate după schimbarea localului, fără erori JS. Capturile folosesc exclusiv fixture-uri sintetice interceptate.

Business Android a fost construit realmente din checkpoint 2; Clientul a întâmpinat o rezolvare Metro pentru dependența Router. Resolverul a fost reparat și bundle-ul Android Hermes al Clientului a trecut local. Se pornește un workflow nou pentru APK-urile ambelor aplicații la checkpoint 3; artefactele vechi nu sunt declarate livrare finală. Snapshoturile live pre-V2 și procedura de pauză/revenire au fost salvate înaintea instalării. Backendul încă nu este instalat la acest checkpoint; starea finală va apărea în raportul de livrare.

Checkpoint 4: workflow `37764802703` a trecut integral și a produs APK/AAB reale semnate, descărcate și verificate după digestul GitHub și checksumurile fiecărui fișier. Clientul final este din `1e99f42`; sursele sale și componentele partajate nu s-au schimbat ulterior.

Backend instalat exclusiv pe CeFaci2.0: `20261008110910_cefaci_client_business_v2_20261008`, apoi `20261008114010_cefaci_legacy_group_guard`; Edge `citeste-bon` v9 ACTIVE, verify_jwt=true. RLS, Realtime, service-only la bon și blocarea gardurilor legacy au fost verificate live. Smoke HTTP anonim a trecut fără fixture-uri sau notificări live. ZIP-ul a trecut pe Apache 2.4, inclusiv permisiuni/HTTPS/cache/MIME/rute/antete.

Suita finală locală trece: 293 teste, un test opțional omis; include regresia după ștergerea contului și validarea sumelor cu virgulă/punct. Typecheck, export și browser trec. Business actualizat este în build separat, workflow `37770806493` la `4d10d80`; raportul final va consemna descărcarea și verificarea noului artefact. Diferența dintre citirile agregate de profile live este consemnată în raport, fără ștergeri/restaurări de persoane reale în această sesiune.

Livrare finală: și workflowul Business `37770806493` este SUCCESS. Noul APK/AAB și proiectul iOS au fost descărcate, verificate după digestul GitHub și checksumurile buildului; APK-ul are semnare de producție v2 validată. ZIP-ul web final este verificat pe Apache și are versiunea `3e06220`. Toate artefactele sunt în `release/`, iar metadatele publice și checksumurile sunt salvate în Git, în `docs/livrare/`. Nu există IPA, hosting publicat, facturare/plăți sau push Business în fundal declarate fictiv.

Audit 09.10.2026: checkpoint `a7eea11` comis și împins, 313 teste trecute, șase scenarii PostgreSQL concurente, TypeScript ambele aplicații, browser/Apache/CSP trecute. 11 regresii backend au fost reproduse și fără V3: nouă eșuează pe codul anterior. Migrarea V3 este instalată exclusiv pe CeFaci2.0 ca `20261009075509_cefaci_security_audit_v3`, garduri/granturi reverificate live. Backupurile remote au aceleași SHA. Workflowul `37901741752` a trecut verify și construiește APK/AAB pentru ambele aplicații. Versiunile noi sunt Client 0.3.1/code4 și Business 1.0.1/code2. Site-ul public există, dar arată încă `4d10d80`; acest update web nu este încă publicat. Artefactele anterioare sunt păstrate în `release/previous-20261008/`.

Livrare audit încheiată: workflow `37901741752` integral SUCCESS; Client și Business APK/AAB/iOS au fost descărcate și verificate după digest, SHA-256, CRC, certificat și manifest binar. Ambele sunt semnate cu certificatul original; noile permisiuni și backup=false au fost confirmate în APK, nu doar în app.json. ZIP-ul web CI este verificat și final. Edge v10 ACTIVE/verify_jwt=true fixează numai versiunea Supabase, cu snapshot v9 păstrat. Report/checksumuri/metadate noi în docs/livrare; site-ul public necesită încă uploadul noului ZIP. Nu s-au configurat fictiv billing/plăți/push sau IPA.

Completare Business pornită în 09.10.2026: utilizatorul a semnalat lipsa intrării pentru un partener nou, a revendicării și a solicitării unui local negăsit. Regulile au fost reverificate în capitolul 2 din `docs/logica-business-admin.md`, care are prioritate asupra canvasului. Se implementează separat contul existent/nou, cererile, dovada, verificarea manuală și accesul autorizat; ANAF/ONRC, SMS/apel, contractul final și activarea nu sunt simulate. [ONBOARDING-BUSINESS-20261009.md](ONBOARDING-BUSINESS-20261009.md) documentează limitele și regulile. Migrarea, testele și artefactele acestei completări vor fi consemnate după verificare; buildurile auditului anterior nu includ automat noile surse.
