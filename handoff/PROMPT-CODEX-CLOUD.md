# CeFaci — prompt pentru Codex Cloud

Lucrează efectiv în repository `Cr3azyMadboYT/CeFaciDownloadBeta`. Vreau să actualizezi aplicația Client cu regulile de mai jos și apoi să construiești CeFaci Business funcțional, atât web cât și aplicație nativă. Hostul web este gazduire.net. Domeniul pe care îl dețin este `cefaci.app`: Business pe `business.cefaci.app`, Admin ulterior pe `admin.cefaci.app`. Nu presupune că dețin `cefaci.ro`.

Răspunde-mi în română, clar. Nu te opri la plan, concept, mockup sau butoane care simulează succesul. Citește întâi codul, designul, instrucțiunile proiectului și fișierele de predare. Apoi implementează, verifică și pregătește livrarea. Nu cere din nou aprobarea pentru schimbările de cod deja cerute aici. Clarifică doar informații cu adevărat indispensabile care nu pot fi deduse din cod și reguli.

## De unde continui și ce NU este deja livrat

Ramura de predare `codex/handoff-client-business-20261008` conține contextul acestui task. Punctul de plecare al codului este commitul `45ad4963403283ab234d9811a562979c7f1b8cee` de pe `claude/new-session-hzbjtf`, verificat pe GitHub la 08.10.2026. Verifică și eventualele modificări ulterioare înainte să începi.

Implementarea Client + Business încercată anterior a rămas locală, necomisă și nepublicată, iar curățarea automată a mediului temporar a eliminat-o. Ea NU există în această ramură și nu trebuie considerată terminată. Cele patru migrații V2 și noul Business descrise în notele de predare sunt un ghid de reconstrucție, nu fișiere deja disponibile. Nu spune că există un APK sau un backend V2 instalat fără să le verifici. Reparațiile de securitate din commitul de bază sunt deja separate de această dezvoltare nouă.

Ai `handoff/REGULI-ACTIVE.md`, `handoff/STARE-SI-CONTINUARE.md`, `handoff/AUDIT-INTEGRARE.md`. Aceste reguli recente au prioritate asupra formulelor vechi din canvasuri și documente. Dacă primești arhiva de predare, `cefaci-business-actualizat.html` este referință vizuală, nu produs conectat la backend și nu autoritate pentru calculul reducerilor.

## Backup și design

- Păstrează ramurile `backup/claude-original-20261008` și `backup/cefaci-current-20261008`. Nu le suprascrie.
- Lucrează pe o ramură nouă de implementare, păstrând istoricul și modificările altora. Salvează checkpointuri prin commituri reale și push; nu lăsa întreaga muncă doar în fișiere temporare.
- Nu reseta proiectul și nu șterge datele Supabase. Migrații noi, verificări pe date sintetice, plan de revenire concret înainte de instalarea backend-ului.
- Păstrează exact familia vizuală Claude/CeFaci: Bilu, fonturi, culori, carduri și bilete. Nu redesena clientul.
- Citește `CLAUDE.md`, `START-AICI.md`, `design/canvas/client/`, `design/canvas/business/`, `docs/business-v1-concept.md`, `docs/logica-business-admin.md`, `docs/directie-si-decizii.md`.
- Clientul real este în `mobile/`, React Native + Expo. Business trebuie să fie tot o aplicație nativă React Native/Expo, nu o pagină împachetată într-un WebView. Poți reutiliza componentele Business pentru exportul web responsive.
- Modificările canvasului client se fac prin mecanismul existent de patch-uri și regenerare, nu prin editarea arbitrară a fișierelor generate.

## Reguli obligatorii de produs

### Grup și rezervare

1. „6+” permite un grup mai mare de șase. Plus nu limitează grupul la patru persoane. O limită tehnică defensivă mare poate proteja API-ul, dar nu transforma șase în limita produsului.
2. „Vin / Nu pot” este participare; votul pentru alegerea activității este o decizie separată.
3. După trimiterea planului găștii/prietenilor, rezervarea nu poate fi făcută până când au răspuns toți sau au trecut 30 de minute de la trimitere. Deadline-ul este al serverului, nu al telefonului.
4. La 30 de minute, cine nu a răspuns este trecut ca neparticipant la acel plan. Nu primește penalizare de no-show. Grupul final include organizatorul și invitații confirmați. Organizatorul participă implicit în fluxul actual; persoanele fără cont trebuie reprezentate explicit, fără numere contradictorii. Pentru un plan fără invitații, numărul introdus rămâne numărul declarat.
5. Rezervarea folosește grupul final de pe server. Niciun invitat nu primește un bilet cu „2 persoane” introdus fix în cod.
6. Client → cerere reală în backend → Business confirmă/refuză/propune altă oră → același răspuns apare în client. Cererile și sosirile trebuie să aibă identitate comună de plan/grup, să fie idempotente și să nu se dubleze la retry, scanări repetate sau trimitere simultană.
7. Minimum opt persoane: confirmare manuală. Auto-confirmarea pentru grupuri mici respectă capacitatea, intervalele, durata și limitele contului. Folosește data din Auth pentru vechimea contului.
8. Verificarea capacității și ocuparea locurilor se fac atomic. Propunerea altei ore are termen și rezervă temporar capacitatea; expirarea eliberează locurile și permite o cerere nouă. Anularea planului anulează rezervările încă fără sosire, fără să rescrie vizitele realizate.
9. Rezervările făcute direct la telefon/site rămân externe și nu generează automat comision CeFaci.

### Vizibilitatea localului

- Rezervări obligatorii + rezervări oprite: local ascuns peste tot în descoperire, căutare, recomandări, oferte și planuri NOI.
- Rezervări recomandate + oprite: rămâne vizibil, mesaj „Poți merge direct. Momentan nu acceptă rezervări.”
- Rezervări nenecesare: rămâne vizibil, fără buton inutil de rezervare.
- Pauza generală a localului este distinctă de oprirea rezervărilor.
- Istoricul, rezervările confirmate și beneficiile deja revendicate rămân accesibile. Ascunderea pentru planuri noi nu anulează tot trecutul.
- Catalogul public expune numai câmpurile necesare clientului, fără CUI, firmă, contract sau informații private.

### Plus și aplicarea pe bon

- Un participant confirmat cu Plus activează reducerea pentru ÎNTREAGA notă eligibilă a grupului, inclusiv când vin șase sau mai mulți. Nu mai există limita „Plus pentru patru” și nu se calculează o medie ponderată pentru Plus.
- Mai mulți Plus nu cumulează procente. Ospătarul vede un singur procent de aplicat pe nota eligibilă.
- Partenerul alege baza 10%, 15% sau 20%; poate avea intervale opționale pe zile și ore. Valoarea la ora ieșirii se calculează pe server, în Europe/Bucharest.
- Modificările reducerii/programului intră în vigoare de la următoarea zi calendaristică în București, nu retroactiv. Drepturile vizitelor deja înregistrate se păstrează.
- „Plus oprit doar azi”: înainte de 16:00, maximum patru zile distincte pe lună, cu istoric verificabil. Nu reseta contorul prin oprire/pornire repetată.
- O ofertă mai bună poate conta între localuri la fel de potrivite utilizatorului. Nu împinge un local nepotrivit în față doar fiindcă dă reducere mare; explică și testează criteriul.

### Live Drop

- Maximum șase locuri pe revendicare; grupul poate fi mai mare. Minimul grupului unui Drop trebuie să poată fi satisfăcut în limita revendicării.
- Plus al oricărui participant confirmat contează pentru avantajul de zece minute și dreptul la oferta Plus, nu numai Plus al organizatorului.
- Drop „acum”: Plus acum, Free după zece minute. Drop programat: Plus cu zece minute înainte, Free la început. Aliniază afișarea ofertei cu dreptul de revendicare.
- Eligibilitate verificată pentru grup: vârstă/18+, clienți noi prin CeFaci în ultimele 12 luni, membri ai echipei, sosiri/check-in-uri existente, locație la revendicare. Nu pretinde că GPS-ul clientului este o dovadă antifraudă imposibil de falsificat.
- Regula distanței la luare: minimum 150 m de local, conform opțiunilor aprobate în documentație. Între revendicare și sosire minimum zece minute. Un singur claim activ pe cont. Locuri luate și eliberate atomic.
- Impune pe server maximum 12 ore de Drops pe săptămână și minimum două ore între oferte, cu calendarul localului. Oprirea unei oferte nu retrage claim-urile încă valabile.
- Limita de patru nu mai există pentru Plus. Limita locurilor Drop rămâne distinctă. Pentru un Drop Free care acoperă doar o parte din grup, afișează explicit persoanele/consumul eligibil și procentul, astfel încât personalul să îl aplice pe produse sau pe un bon separat; nu inventa o reducere ponderată pentru întreaga masă. Plus poate acoperi întreaga notă eligibilă, fără cumul.
- Verifică toate API-urile vechi: nicio funcție legacy nu trebuie să ocolească participarea, locația, programul, numărul sau drepturile grupului. Dacă retragi un API, oferă mesaj de actualizare și testează compatibilitatea intenționată.

### Sosire, bon și financiar

- Bilet QR al grupului pentru Business și scanarea codului localului din client, cu autorizare și verificare GPS. Aceeași ieșire produce o singură vizită, chiar dacă scanează mai mulți participanți. Ieșiri distincte în aceeași zi nu se amestecă.
- Salvează sosirea înainte de XP. Eșecul acordării XP nu anulează sosirea. Bonul trimis de un participant ajunge la vizita corectă din Business, cu verificarea CUI, datei/orei, totalului și duplicatelor.
- Ziua financiară: Europe/Bucharest, cu pragul 05:00, derivată din sursa ieșirii; ziua XP rămâne separată. Fără confuzii la miezul nopții sau ora de vară.
- Tarife per persoană eligibilă de minimum 12 ani: rezervare 2/5/8 lei, Drop 3/7/10 lei, după treapta contractuală. Fondatori: minus un leu pe tarif unitar. Maximum zece persoane taxabile pe vizită.
- Plan simplu, numai Plus fără rezervare/Drop, vizită spontană: zero comision. Cu Plus + rezervare sau Drop, taxa sursei rămâne. Nu folosi procent din bon, `partners.rate`, o limită de trei vizite/an sau „a patra gratis”.
- Surse mixte: fiecare persoană se taxează o singură dată. Exemplu treapta 2: șase adulți, patru eligibili Drop, ceilalți cu rezervare → 4×7 + 2×5 = 38 lei.
- Gratuitatea contractuală: zero datorie; „ai fi plătit” este doar informativ. Tarifele și condițiile se păstrează la sosire, fără repricing al trecutului.
- Număr redus de local: confirmare/contestație de la client, cu versiunea numărului și termen; cazurile neclare nu se facturează. Refuzul nejustificat al reducerii nu se confundă cu neeligibilitatea și nu șterge automat taxa sursei.
- Financiar, inclusiv pe telefon: SUS suma rămasă localului; JOS încasări totale după reduceri și reduceri acordate, iar dedesubt comisionul CeFaci. Suma rămasă = încasări după reduceri − comision. Nu mai scădea reducerile încă o dată.
- Nu colecta costurile restaurantului și nu afișa profit estimat, marjă sau pierdere după cheltuieli. Asta nu este treaba CeFaci.
- Încasările includ și sursele Plus/plan cu comision zero. Dacă lipsesc bonuri/sume sau confirmări, afișează clar total parțial și evită să prezinți un net incomplet drept total final.
- Facturarea, colectarea plăților și tratamentul fiscal nu sunt configurate. Păstrează `billing_ready=false` până există un circuit verificat și configurația reală. Nu inventa un provider sau documente fiscale emise.

## Business pe bune

Construiește cu aceeași familie vizuală, responsive pe telefon/tabletă/desktop, cu modurile de culoare ale designului:

- autentificare reală pe contul existent și acces numai la localurile/rolurile permise;
- mai multe localuri per utilizator;
- Azi: cereri, programul rezervărilor, sosiri, ce trebuie închis;
- Rezervări: confirmare/refuz/propunere altă oră, capacitate și stări reale;
- Scanner/sosiri: cameră și introducere manuală, local corect, expirare, dubluri;
- Închidere vizite: persoane eligibile, surse, număr real, sumă după reduceri și reducerea efectivă; bonul verificat are prioritate față de o sumă manuală;
- Live Drops și program Plus: creare/editare/oprire conform regulilor;
- Financiar: încasări, reduceri, comision, rămas localului, perioada, gratuitate și detaliile calculului;
- Statistici din date reale, fără clienți sau venituri inventate;
- Profil/setări și echipă, cu roluri și revocare imediată pe server.

Păstrează celelalte funcții relevante ale canvasului dacă pot fi conectate corect. Pentru evenimente cu bilete, facturi sau plăți care au nevoie de infrastructură/configurație suplimentară, delimitează starea reală; nu livra ecrane demo drept funcționalități gata. Nu reconstrui acum Admin-ul integral, dar contractele, permisiunile și sumarul lui trebuie să rămână coerente cu Business.

Roluri: proprietar, manager, recepție, scanare. Proprietar/manager pot vedea financiarul; recepția și scanarea văd doar datele operaționale necesare. Managerul nu acordă rol de proprietar și nu modifică alt proprietar. Verifică exact semnăturile RPC existente; de exemplu scoaterea din echipă folosește `p_role='scos'`, nu null. O sesiune încă validă nu păstrează accesul după revocarea rolului.

Actualizare între Client și Business prin evenimente persistente, Realtime și recuperare după reconectare. Push nu este singura sursă de adevăr. Fără reușită simulată offline; operațiunile dependente de capacitate nu se confirmă local și ulterior „poate” pe server. Dacă livrarea push Business în fundal nu este gata, spune explicit.

## Backend, testare și livrare

Backendul existent este proiectul Supabase CeFaci2.0, ref `vqrmwuarjjntusfbqprx`. Nu modifica alte proiecte. Verifică schema live și istoricul migrațiilor înainte de instalare: numele/timestampurile live nu sunt toate identice cu fișierele repositoryului. Dacă mediul Cloud nu are acces la Supabase, construiește și testează local, livrează migrațiile și raportează exact ce nu s-a instalat; nu pune secrete în chat sau în Git.

RLS, permisiuni de funcții, autorizarea localului, rolul activ și starea fiecărei operațiuni se verifică pe server. Catalogul anonim este whitelist. Nu pune service-role, parole, contracte sau datele personale din backup în bundle-ul web. Nu trimite notificări de test către persoane reale și nu folosi localuri/conturi reale pentru scenarii de fraudă.

Testează cazurile din `REGULI-ACTIVE.md` și audit, plus: deadline-ul, ultima persoană care răspunde simultan cu rezervarea, dubla cerere, ultimele locuri, scanări repetate, rezervare+Drop, Plus numai al invitatului, anulări și propuneri expirate, neveniri/copii, gratuitate, bon canonic, DST/05:00, roluri și revocări, relogare/schimbarea localului și răspunsuri async întârziate. Verifică UI pe telefon și desktop și construcția nativă, nu numai TypeScript.

Fișiere utile: `mobile/src/lib/together.ts`, `plans.ts`, `outing.ts`, `places.ts`, `mobile/src/app/bilet/[pid].tsx`, `mobile/src/app/planuri-gata.tsx`, `src/app/bridge.ts`, `supabase/functions/citeste-bon/index.ts`, `supabase/migrations/`, `tests/security-regressions.test.ts`, `.github/workflows/android.yml`.

Rulează verificările adecvate: instalare reproductibilă din lockfile, testele repositoryului, typecheck Client și Business, verificarea Edge Function, export web și builduri native. Construiește efectiv APK-urile prin GitHub Actions sau mediul potrivit; un export JS nu este un APK. Pentru iOS livrează proiectul și pașii de semnare dacă nu există infrastructură Apple, fără a declara IPA construit.

Webul: pachet static gata de urcat pe gazduire.net, cu HTTPS, fișierele necesare și `.htaccess` dacă hostul folosește Apache/LiteSpeed. Nu instala obligatoriu Node pe shared hosting dacă un export static funcționează. Include pași exacți pentru document-root-ul subdomeniului, cache, cameră și verificarea loginului. Preferă backendul existent pentru reguli, nu un backend paralel pe PHP.

La final: commituri și branch/PR cu schimbările, ZIP web, APK-urile realmente construite, instrucțiuni de upload și configurare, migrații, ce s-a instalat și ce a rămas neconfigurat, plus verificările efectuate. Păstrează istoricul original și backupurile. Începe cu inspecția repo-ului și apoi execută implementarea completă.
