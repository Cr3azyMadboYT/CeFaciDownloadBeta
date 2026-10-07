# CeFaci Business — concept pentru aplicație și web

Decizie de lucru: 7 octombrie 2026. Cornel a autorizat alegerea variantei echilibrate pentru CeFaci și localuri. Acest document concretizează produsul care urmează; nu afirmă că interfața, facturarea sau toate protecțiile sunt deja construite. Regulile detaliate rămân în `logica-business-admin.md`, cu precizările de mai jos.

## Ce promitem localului

„Îți aducem rezervări și oameni prin oferte. Plătești o sumă cunoscută doar pentru sosirile eligibile. Vezi fiecare calcul și poți contesta.”

Nu cerem abonament pentru funcțiile de bază la lansare. Un local poate folosi rezervările fără Live Drops și poate activa separat programul Plus. Clientul își plătește consumația direct la local; CeFaci facturează serviciul către firmă. Programul Plus și eventualele servicii viitoare nu se confundă cu această taxă.

## Banii: varianta aleasă

Tarif fix pe persoană taxabilă (12+), pe treapta contractuală a localului. Reducerea oferită consumatorului este separată de taxa CeFaci.

| Treaptă: consum estimat de persoană | Rezervare | Live Drop | Fondator: rezervare / drop |
|---|---:|---:|---:|
| Sub 50 lei | 2 lei | 3 lei | 1 / 2 lei |
| 50–150 lei | 5 lei | 7 lei | 4 / 6 lei |
| Peste 150 lei | 8 lei | 10 lei | 7 / 9 lei |

Acestea sunt tarifele de pornire pentru pilot, înaintea eventualelor taxe fiscale aplicabile. Prețul și condițiile se acceptă contractual înainte de activare. Le verificăm cu primele localuri, iar schimbările viitoare au versiune și dată de intrare în vigoare; nu rescriu trecutul.

- Rezervare pentru 6, au venit 4: 4 × tariful rezervării.
- Drop luat pentru 4, au venit 6: cel mult 4 persoane plătibile prin drop; ceilalți nu primesc automat oferta.
- Maximum 10 persoane taxabile pentru aceeași masă/sosire; copiii sub 12 ani sunt excluși.
- Plan simplu, vizită spontană sau numai reducere Plus: **0 lei**.
- Plus + rezervare / drop: taxa pentru sursa respectivă rămâne; reducerea Plus se tratează separat, conform ofertei.
- Nimeni nu a venit, drop expirat, numai o dovadă slabă sau caz neclar: **0 lei până la clarificare**.
- În perioada gratuită: 0 datorie; „ai fi plătit X” este informativ.
- Pentru aceeași persoană din același grup nu se cumulează taxa de rezervare cu taxa de drop. Modelul complet repartizează oamenii între surse, conform capitolului 5.5 din logica v2. Exemplu: 6 persoane, 4 cu drop la treapta 2 → 4 × 7 + 2 × 5 = 38 lei.
- Nu activăm implicit propunerea „a patra vizită este gratuită”. O rezervare nouă, adusă și onorată, creează în continuare valoare; o asemenea facilitate se poate negocia explicit ulterior. Nici baza nouă de calcul nu aplică vechea limită de trei vizite a modelului procentual.

Treapta inițială se justifică din meniul localului și coșul tip, nu se inventează dintr-un bon izolat. Revizuirile respectă logica v2. Fondatorii păstrează condițiile acceptate cât timp rămân parteneri; avem un plafon de 20 de localuri fondatoare. Pentru pilot recomand: 3 luni gratuite pentru fondatori, o lună pentru ceilalți, scrise explicit la activare. Prelungirea fondatorilor urmează logica v2 și va necesita implementare înainte de a fi promisă în produs.

## Cum ajunge o rezervare din client în Business

Din plan: **„Rezervă pentru noi”**, cu localul, ora, oamenii și copiii completate. Persoana verifică și trimite. Un plan simplu nu devine rezervare și nu generează taxă prin simpla afișare sau acceptare a invitației.

Localul primește cererea în Azi și poate confirma, refuza sau propune o altă oră. Auto-confirmarea este disponibilă numai în capacitatea oferită de local, cu limite pentru conturile noi și grupurile mari. Înainte de implementare completăm inventarul pe intervale și verificăm simultaneitatea, ca două cereri să nu ocupe aceeași masă.

La sosire se identifică rezervarea/oferta, se verifică dreptul la reducere și se înregistrează grupul real. O scanare repetată întoarce aceeași sosire. La închiderea serii se confirmă persoanele taxabile, cei care au primit oferta și eventualele diferențe. Dacă numărul scade, clientul primește întrebarea prevăzută în logica v2; disputa blochează rândul financiar, nu toate operațiunile localului.

## Ecranele și scopul lor

| Ecran | Ce rezolvă |
|---|---|
| **Azi** | Cereri care așteaptă, programul serii, sosiri, oferta activă și ce mai trebuie închis. Acțiunile urgente apar primele. |
| **Rezervări** | Calendar și listă; confirmare/refuz/altă oră; capacitate pe intervale, grup maxim și auto-confirmare. |
| **Sosiri / Scanner** | Verificare cod/cuvântul serii, grup, ofertă și procent; evită dublurile. Angajatul vede doar informațiile necesare servirii. |
| **Închide seara** | „Au venit / n-au venit”, numărul real și diferențele. Nota de plată nu este baza comisionului. |
| **Oferte** | Live Drops cu locuri, durată, grup minim și limite de reducere; program Plus separat. |
| **Rezultate** | Rezervări onorate, oameni confirmați și oferte folosite; estimări financiare distincte de taxe definitive. Fără statistici fabricate. |
| **Plăți** | Fiecare rând și calculul lui, perioada gratuită, lista lunii, contestații, facturi și plăți. |
| **Local și echipă** | Profil, setări, invitații, roluri și revocarea imediată a accesului. Datele firmei și contractul au acces separat. |

Designul folosește aceeași familie vizuală ca aplicația CeFaci: fonturi, culori, bilete și Bilu din sursele existente. Ecranele operative au contrast bun, ținte tactile mari și puține acțiuni. Nu schimbăm designul clientului în etapa de remediere.

## Aplicația și web-ul

**Aplicația Business**: rezervări, notificări de tură, sosiri/scanner și închiderea serii. Proprietarul poate consulta și situația financiară. Camera și notificările folosesc integrarea nativă; offline arătăm starea reală și nu confirmăm fictiv o operațiune nereușită.

**Web Business**: aceleași operațiuni pe mobil și tabletă, plus calendar larg, setări, echipă și situația lunii pe desktop. Începem cu web responsive; reutilizăm serviciile și regulile pentru aplicație. Admin-ul CeFaci rămâne o interfață separată.

Ambele folosesc același cont și același backend. Ascunderea unui buton nu reprezintă permisiune: fiecare apel verifică în server localul, rolul activ și starea operațiunii. Revocarea rolului se aplică la următorul apel, inclusiv când sesiunea de autentificare mai există.

Domeniul cumpărat în conversație este **cefaci.app**. Adresa disponibilă de configurat este **business.cefaci.app**, cu Admin separat pe **admin.cefaci.app**. `business.cefaci.ro` poate fi publicat doar după ce controlezi și DNS-ul domeniului `.ro`. Nu a fost făcută nicio publicare sau modificare DNS în această etapă.

## Permisiunile Business

| Operațiune | Proprietar | Manager | Recepție | Scanare |
|---|---|---|---|---|
| Rezervări și program | Da | Da | Da | Nu |
| Sosiri și reducerea de aplicat | Da | Da | Da | Da |
| Închiderea serii | Da | Da | Da | Nu |
| Live Drops și program Plus | Da | Da | Nu | Nu |
| Situație financiară și contestații | Da | Da | Nu | Nu |
| Profilul localului | Da | Nu | Nu | Nu |
| Gestionarea echipei | Toți | Recepție / scanare | Nu | Nu |
| Firmă, contract și ieșire | Semnatarul verificat | Nu | Nu | Nu |

Conturile angajaților nu primesc emailul, telefonul sau istoricul clientului. Pentru dispozitive comune, invitații fără email și acces pe tură construim fluxuri explicite, cu jurnalul persoanei care a făcut acțiunea. PIN-ul de pe tabletă nu înlocuiește autorizarea serverului.

## Live Drop: ofertă de atragere, nu reducere luată la masa existentă

Blocăm personalul localului, persoanele deja sosite, folosirea imediată după luare și grupurile care nu ating minimul. O ofertă de un loc nu dă procentul întregului grup: procentul de pe nota comună se calculează pentru persoanele eligibile, conform logicii v2.

Înainte de lansare construim și verificarea distanței la luare, identificarea grupului, controlul minorilor din grup, returnarea locurilor nefolosite și dovezile de telefon/poziție. Locația și codurile de telefon trimise de client pot fi falsificate; nu tratăm un simplu hash drept dovadă de dispozitiv verificat. Aceste protecții nu sunt declarate gata prin reparațiile de acum.

## Plăți și contestații

Sosirea → dovezi și număr confirmat → rezolvarea eventualei contestații → taxă definitivă cu valorile păstrate → listă lunară → factură → încasare.

Tariful, treapta, firma, contractul, gratuitatea, sursele și persoanele taxabile se păstrează la calcul. O taxă definitivă are identitate unică; intră pe o singură factură activă. Corecțiile se jurnalizează, iar rândurile deja facturate folosesc documente de corecție, nu ștergere sau rescriere. Modificările financiare sensibile respectă regula celor doi aprobatori din logica v2.

Lista arată „Rezervare #123 · 4 persoane”, calculul și motivul, fără numele clienților. Localul poate contesta un rând cu un motiv concret. Tarifele ori prelungirile nu se schimbă pe ascuns. Furnizorul de facturare, contractul și configurația fiscală se finalizează cu contabilul înainte de emiterea primei facturi.

**Starea actuală a codului:** baza de calcul per persoană există, cu valori păstrate la sosire și confirmare explicită a numărului taxabil. `biz_month` și sumarul financiar Admin sunt marcate **estimări, facturare indisponibilă**. Lipsa treptei ori a confirmării lasă sosirea blocată la calcul. Nu există încă motorul de taxe definitive, contestații și facturi; nu activăm încasări pe baza acestor estimări.

## Ordinea de construcție

1. **Fundația operațională:** identitate local/firmă/semnatar, echipă și roluri; capacitate și stări de rezervare; jurnal și teste de simultaneitate.
2. **Web pentru pilot:** Azi, Rezervări, Sosiri și Închide seara. Se probează cu date sintetice și cu 2–3 localuri în mod gratuit.
3. **Live Drops și Plus:** grupuri, eligibilitate, verificările de telefon și locație; teste pentru fraude și reduceri.
4. **Financiar complet:** contestații, taxe definitive cu versiuni, listă înghețată, facturi și reconciliere. Rulează întâi un ciclu gratuit.
5. **Aplicația Business:** servicii și roluri comune cu web, cameră și notificări native; verificare pe telefoane și dispozitive comune.

Prima etapă de interfață pe care o construim va fi **Azi + Rezervări + Sosiri**, cu backend-ul și permisiunile lor verificate împreună. Extindem produsul după ce acest flux funcționează într-o seară reală, fără dubluri, rezervări pierdute sau taxe din date neclare.
