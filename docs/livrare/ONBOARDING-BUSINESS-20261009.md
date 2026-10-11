# Business: cont, revendicare și local lipsă

Actualizare pornită la 09.10.2026 după semnalarea lipsei fluxului de intrare pentru parteneri. Starea verificată a codului, a backendului și a buildurilor este consemnată în [RAPORT.md](RAPORT.md); acest document explică regulile fluxului.

## Intrare și cereri

Business trebuie să distingă contul existent de crearea unui cont pentru o cerere nouă. Contul este comun cu CeFaci; autentificarea sau depunerea unei cereri nu acordă singure rolul de proprietar.

- **Ai deja cont? Intră:** autentificare cu codul primit pe emailul contului existent. Accesul operațional se verifică separat, pe server, pentru fiecare local și acțiune.
- **Revendică localul:** căutare după nume și adresă, alegerea localului, identitatea solicitantului, rolul în firmă, firma și CUI-ul, apoi dovada dreptului de a reprezenta localul.
- **Local deja revendicat:** cerere de dispută cu document obligatoriu. Proprietarul actual vede notificarea în Business; prima citire autorizată pornește intervalul de trei zile pentru răspuns. Fără această notificare și expirarea termenului, verificarea favorabilă rămâne blocată. Cererea nu schimbă pagina publică și nu înlocuiește proprietarul înaintea deciziei. SMS/email/push în fundal pentru această notificare nu sunt configurate.
- **Nu găsesc localul / Solicit adăugarea:** solicitantul trimite datele localului, ale firmei și de contact; publicarea localului o face un administrator CeFaci după verificare.
- **În verificare:** solicitantul își vede cererile și nota deciziei, poate retrage o ciornă/cerere în lucru și reîncerca operațiunile eșuate. Cererea salvată pe server rămâne distinctă de accesul la panoul operațional. Nu există încă un fir de mesaje sau un formular separat pentru completări după trimitere.

Un cont existent nu are numele, username-ul, data nașterii sau preferințele suprascrise de onboardingul Business. `biz_identity_status` verifică existența profilului; `biz_identity_complete` îl completează numai dacă lipsește, sub un lock pentru cont. Datele cererii de parteneriat rămân separate de profilul social. Regulile profilului comun rămân minimum 16 ani, username unic și data nașterii setată o singură dată.

## Verificare și documente

Regulile prioritare sunt în [logica-business-admin.md](../logica-business-admin.md), capitolul 2. Forma și cifra de control a CUI-ului pot fi validate local, dar aceasta nu confirmă firma la ANAF și nu dovedește dreptul de reprezentare. Verificarea firmei și a semnatarului cere o verificare efectivă, consemnată de echipa CeFaci.

SMS-ul/apelul automat trebuie trimis la telefonul public verificat al localului, nu la un număr ales de solicitant pentru a ocoli dovada proprietății. Furnizorii ANAF/ONRC, SMS și apel automat nu sunt configurați în această livrare. Traseul disponibil este verificarea manuală cu documente; aplicația nu simulează coduri trimise, verificări ANAF sau aprobări automate. Durata de 2–3 zile este ținta de procesare manuală, nu rezultatul garantat al unei verificări automate.

Documentul preferat este certificatul constatator ONRC; pentru contracte de închiriere sau autorizații solicitantul trebuie să acopere CNP-ul și datele personale care nu sunt necesare verificării. Documentele nu sunt publicate, incluse în catalog sau în jurnale cu conținutul lor. Autorizarea temporară a accesului echipei se verifică și se jurnalizează; regula de retenție este 90 de zile, după care rămân nota verificării și amprenta, fără fișierul original. Configurarea efectivă a lucrătorului de ștergere trebuie verificată separat de simpla existență a unei funcții de purjare. Amprenta păstrată în această migrare provine din metadatele Storage (`eTag`), nu reprezintă o verificare SHA-256 a conținutului de către un server de analiză. Nu este configurat un serviciu antivirus pentru documente.

## Aprobare, contract și activare

Aprobarea unei cereri nu este echivalentă cu semnarea contractului și activarea parteneriatului. Administratorul verifică firma, legătura cu localul și dreptul solicitantului. O dispută nu poate fi folosită de un solicitant sau de un manager pentru a-și acorda singur acces.

Contractul final trebuie acceptat de administratorul firmei sau de o persoană împuternicită, cu versiunea și amprenta textului, identitatea semnatarului și fiecare clauză specială acceptată separat. Acceptarea pentru firmă, trimiterea PDF-ului și perioada de contestare descrise în regulile produsului nu sunt înlocuite de o bifă generică din formularul cererii.

Activarea cere verificările din capitolul 2.5: contract valid, profil publicat, scanare de probă, instalarea Business și notificare de probă. Furnizorii de contracte/notificări și infrastructura de facturare nu sunt declarați configurați. Rezervările și Live Drops nu trebuie deschise automat de depunerea sau aprobarea cererii. Partenerii existenți își păstrează accesul și istoricul conform rolurilor și regulilor deja instalate.

## Verificare reproductibilă

Testele folosesc conturi, localuri și documente sintetice în baze locale și în browserul cu traficul Supabase interceptat. În producție se verifică definițiile, granturile, RLS și refuzul accesului neautorizat; nu se creează cereri de fraudă, nu se trimit emailuri sau notificări de test către oameni reali.

Numărul testelor, migrarea instalată, checksumurile și commitul buildului actualizat sunt în raportul curent. Un pachet web nou devine public pe gazduire.net numai după upload; un build Android real trebuie reconstruit după schimbarea surselor, iar proiectul iOS nu reprezintă un IPA semnat.

## Contractele API și accesul echipei

Cererea nu se scrie direct într-un tabel expus. Solicitantul folosește `biz_venue_search`, `biz_partner_request_create`, încărcarea documentului în bucketul privat `business-proofs`, apoi `biz_partner_request_submit`. `biz_partner_requests` întoarce numai cererile contului curent; `biz_partner_request_cancel` retrage numai cererile acestuia aflate în lucru. Retrimiterea folosește aceeași cheie și același payload, fără a crea o cerere nouă.

Proprietarul curent folosește `biz_ownership_disputes` și `biz_ownership_dispute_reply`. Identitatea firmei solicitante și documentul acesteia nu sunt expuse echipei localului. Dreptul de proprietar activ este verificat la fiecare citire și răspuns.

`admin_partner_requests` și `admin_partner_request_decide` verifică rolul CeFaci pe server; un manager sau un proprietar de local nu este administrator CeFaci. Decizia cere o notă și, pentru verificare favorabilă, confirmarea verificării reale a firmei/reprezentantului și accesarea documentului. `biz_partner_proof_access` acordă acces autentificat temporar pentru cinci minute și scrie în jurnal; bucketul rămâne privat. Descărcarea autentificată verifică acest acces; un URL semnat generat în această fereastră are însă propria expirare și trebuie tratat ca un link confidențial. RLS nu impune singur o expirare maximă de cinci minute URL-urilor semnate. Decizia favorabilă are starea `verified`, cu contractul și activarea încă în așteptare, fără atribuire automată de proprietar sau creare automată a unui local public.

Admin-ul integral nu este reconstruit în această completare. Contractele RPC sunt disponibile pentru un panou CeFaci autorizat; nu trebuie apelate cu un cont personal de local sau prin introducerea unei chei `service_role` în aplicație. Funcțiile `business_proofs_retention_candidates` și `business_proof_deleted` sunt exclusiv pentru lucrătorul server de retenție: acesta șterge întâi fișierul prin API-ul Storage și apoi confirmă ștergerea. Nu se șterg direct rânduri `storage.objects` prin SQL.

## Lucrătorul server pentru retenție

`scripts/retain-business-proofs.mjs` este un lucrător server separat de aplicații. Are ținta fixată la CeFaci2.0, verifică forma fiecărei căi, elimină prin API-ul Storage toate fișierele eligibile înainte de confirmarea ștergerii și nu afișează cheia sau documentele. Include ciornele abandonate, cererile retrase și retry după o ștergere efectuată înaintea întreruperii procesului.

Se injectează `CEFACI_RETENTION_SERVICE_KEY` numai în mediul privat al unui scheduler. `node scripts/retain-business-proofs.mjs` arată numai numărul eligibil, fără ștergere; `node scripts/retain-business-proofs.mjs --execute` execută retenția. Programarea zilnică și secretul privat al lucrătorului nu sunt configurate în această livrare. Expirarea dreptului de citire la 90 de zile este impusă deja de backend; ștergerea fizică automată necesită activarea schedulerului. Cheia nu se adaugă în APK, ZIP web, Git sau comenzi cu valori literale în istoric.
