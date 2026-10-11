# Dosarul operațional CeFaci

Actualizat: 10 octombrie 2026. Aplicabil Client, Business, Admin și site. Acest dosar este un set de proceduri și evidențe de lucru, nu o certificare, un aviz juridic sau dovada că au fost semnate contractele furnizorilor. Operatorul trebuie să confirme identitatea, datele și deciziile marcate mai jos. Obligațiile GDPR există și dacă dezvoltatorul este persoană fizică.

Situația confirmată de titular: încă nu există firmă; contactul este **contact@cornacidev.ro**. Titularul a ales să nu publice încă numele și adresa; identitatea completă rămâne un punct deschis înaintea lansării. Nu există un CUI ori un sediu comercial confirmat. Nu sunt activate abonamente plătite, emiterea automată a facturilor sau RO e-Factura. `billing_ready=false` trebuie păstrat până la verificarea fiscală și contractuală.

## Ce este implementat și ce necesită operare

- O sursă comună de nouă documente în `shared/legal-content.ts`, identitate publică explicit incompletă în `shared/legal-config.ts`, versiune `2026-10-10`. HTML/Markdown se generează prin `scripts/generate-legal-pages.mjs`; modificarea manuală numai a paginii web nu actualizează aplicațiile.
- Cereri personale: acces, rectificare, ștergere, restricționare, opoziție, portabilitate, urmărite în cont. Deadline o lună calendaristică; prelungire motivată cu cel mult două luni, comunicată în prima lună. Adminul de caz este limitat la fondator/admin cu MFA. Cererile personale ale utilizatorului nu necesită rol de dashboard sau MFA suplimentar.
- Export rapid: profil și preferințe de bază, ultimele 100 de cereri cu marcaj de trunchiere. Nu înlocuiește colectarea celorlalte categorii pentru un răspuns GDPR complet.
- Ștergerea imediată poate fi blocată pentru conturi cu documente/operațiuni/roluri sau cereri în curs. Se folosește analiza manuală, fără a afișa o confirmare falsă de ștergere.
- Fișierele private au acces normal blocat după 90 de zile și RPC-uri de retenție în două faze. **Schedulerul și monitorizarea ștergerii fizice trebuie configurate și probate.** Blocarea accesului nu este dovada distrugerii binarului.
- Documentele nu automatizează obligațiile unui contabil, notificarea autorităților, răspunsurile juridice ori semnarea contractelor. Personalul autorizat trebuie să urmărească zilnic coada și termenele; o stare „răspuns transmis” nu dovedește că răspunsul este complet sau corect.

## Înaintea utilizării cu date reale la scară ori lansării comerciale

1. Confirmă numele și adresa operatorului și publică o identitate suficientă pentru contact efectiv. Pentru activitate economică, stabilește forma legală, registrul și identificarea fiscală potrivit situației reale.
2. Completează și aprobă [registrul prelucrărilor și furnizorilor](REGISTRE.md). Verifică DPA/subîmputerniciți/regiuni/backup/transferuri pentru serviciile efectiv active, nu pentru o listă ipotetică.
3. Aprobă termenele de retenție pentru fiecare scop și probează ștergerea, inclusiv exporturi, copii de lucru, restaurare și atașamente. Nu folosi termenul generic „totul în 30 zile”.
4. Parcurge [screeningul DPIA și analiza interesului legitim](DPIA-LIA.md), cu atenție la minori, locație, date sociale și identificatorul persistent pentru proba Plus. Decide dacă scopul justifică persistența și dacă este necesar consimțământ pentru terminal; nu transforma hashul în „date anonime” prin etichetare.
5. Desemnează responsabilul pentru [drepturi, ștergere și incidente](PROCEDURI.md), instruiește echipa, documentează mandatul și confidențialitatea. Un DPO este desemnat numai după evaluarea condițiilor art. 37 GDPR; nu declara un DPO fictiv.
6. Înaintea oricărei plăți/abonament/comision activ, contabilul și consultantul juridic validează [circuitul fiscal și de consum](FISCAL-CONSUM.md), operatorul, contractul, TVA, retragerea, facturile și SPV. Acordul de parteneriat și un eventual DPA se încheie separat, pe rolurile reale.
7. Publică același set de texte în site și aplicații. Actualizează declarațiile magazinelor (Google Play Data safety/App Store privacy, URL de ștergere cont), ca să corespundă binarelor și serviciilor efectiv activate. Nu bifa „fără date colectate” dacă există cont/server/OCR.

Sursele oficiale verificate și limitele sunt în [SURSE.md](SURSE.md). Orice schimbare de scop, furnizor, plată sau tracking necesită revizuirea dosarului și, după caz, informarea/consimțământul înaintea activării.
