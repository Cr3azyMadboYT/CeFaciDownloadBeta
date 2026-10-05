# CeFaci — direcția UI „Biletul serii” și sistemul de nivel

Decizii din 28 sept. 2026.

- Preview UI (canvas cu ecrane interactive): https://claude.ai/artifact/BMhur4CpQbMRoMotS5LxCd
- Analiza de produs: https://claude.ai/code/artifact/fbae51a5-4617-4372-a017-247aa51772db

## Ideea

Fiecare plan se termină cu un obiect: Biletul serii, care „iese la imprimantă” când gașca a ales. Progresul tău stă într-un Carnet cu ștampile pentru locurile încercate. Identitatea aplicației vine din aceste două obiecte, nu din carduri generice.

## Ecranele din preview

- **Acasă** (seara și sâmbătă): „Ce facem diseară?”, cine vine, filtre scurte, „Arată variante” și „Surprinde-mă”, votul activ, „Acum în jur”.
- **Ce facem?**: foaia de filtre (cine, când, cât timp, buget, vibe, zonă).
- **Rezultate**: trei variante cu roluri diferite (Pariu sigur, Ceva nou pentru voi, Cel mai la îndemână). Fiecare are cost, durată, drum și motivul alegerii.
- **Votul gășcii**: Da / Nu / Super (o singură dată), timer, cine a votat, rezultat.
- **Biletul serii**: planul confirmat, rezervare direct din aplicație (cu ștampila REZERVAT), navigare, calendar, plan B.
- **Carnetul (Profil)**: @username sus, dedesubt poza de profil, apoi nivelul, XP-ul și ștampilele. Rotița duce la Setări.
- **Setări**: tema Zi / Noapte / Ca telefonul, fundalul cu întrebări pornit sau oprit, cont și siguranță.
- **Level up**: feedback după ieșire, XP, animația de nivel.
- **Planuri**: biletul următor, gășcile tale, prietenii.
- **Prieteni**: adaugi după @username, cereri primite, codul tău QR.
- **Gașcă nouă**: nume, ștampila gășcii (simbol și culoare), prieteni invitați. Cardul gășcii „se printează” ca biletul. În Demo se ajunge din Prieteni → Creează gașcă sau din Planuri → Gașcă nouă.
- **Gașca**: membri, carnetul gășcii (ștampile comune), link de invitație.

## Prieteni și gășci

- Fiecare cont are un @username. Căutarea găsește doar username-ul exact: fără liste de sugestii și fără „oameni pe care i-ai putea cunoaște”.
- Prietenia pornește cu o cerere și se face doar dacă celălalt acceptă. Refuzul nu trimite nicio notificare.
- În gășci intri doar prin invitație directă de la un prieten sau prin link. Linkul expiră în 7 zile și adminul îl poate reseta.
- Votul cere cont și aplicație (decizie din 28 sept., schimbă analiza). Linkul trimis pe WhatsApp duce la instalare, contul se face dintr-o apăsare (Apple sau Google), apoi omul ajunge direct la vot. Votul se închide la termen chiar dacă cineva n-a apucat să intre.
- Utilizatorii de 16–17 ani nu apar la căutarea după username. Pot fi adăugați doar prin cod sau link.
- Poza de profil o văd doar prietenii și gășcile din care faci parte.
- **Profilul unui prieten** se deschide când apeși pe el în Prieteni, în lista unei gășci sau în prietenii comuni. Arată:
  - @username, numele, nivelul, câte ieșiri și câte locuri are, câte ieșiri ați făcut împreună;
  - prietenii comuni (pe fiecare îl poți deschide) și gășcile comune;
  - ștampilele lui, cu bifă albastră pe locurile încercate de amândoi;
  - „Faceți un plan” (ieșire în doi), „Invită în gașcă” și „Elimină din prieteni” (a doua apăsare confirmă, iar celălalt nu primește notificare).
  - Nu apar XP-ul exact și nici unde e acum.
- **Cine nu e încă prieten** (rezultatul căutării, o cerere primită) vede doar numele, username-ul și prietenii comuni, plus butonul Adaugă sau Acceptă. Nivelul, ștampilele și poza apar după ce vă împrieteniți.
- Fiecare gașcă are o ștampilă ca poză: alegi un simbol (stea, zar, note, țintă, cocktail, pizza, fulger, inimă, zâmbet, microfon) și o culoare. Gașca își strânge propriul carnet de ștampile.

### Gășci permanente și grupuri temporare

- **Gașca permanentă** o creezi din Prieteni → Creează gașcă: nume, ștampilă, cel puțin 2 prieteni, maxim 15 oameni. Fiecare primește invitație și intră în gașcă doar dacă acceptă. Până acceptă, apare ca „Invitat” și nu primește planurile gășcii.
- Gașca permanentă rămâne până o șterge adminul sau până ies toți membrii. Oricine poate ieși, iar gașca rămâne pentru ceilalți. Dacă iese adminul, rolul trece la cel mai vechi membru. Ștergerea și ieșirea cer o a doua apăsare de confirmare.
- **Grupul temporar** apare când alegi prietenii pe rând pentru un plan. N-are invitație separată: fiecare răspunde doar la plan, cu Vin sau Nu pot. Ține cât ieșirea și se șterge după. În Planuri stă separat, cu eticheta „Se șterge după ieșire”.
- Cu un singur prieten ieșiți în doi și nu se creează niciun grup de păstrat.
- **„Păstrați gașca?”**: după o ieșire cu un grup temporar la care au venit cel puțin doi prieteni, apare cardul care îl transformă în gașcă permanentă. Alegi numele și ștampila, iar cei care au venit primesc invitație. Dacă nu, grupul se șterge.
- În foaia „Cu cine ieși?”, comutatorul „Fă-le gașcă permanentă” te duce la nume și ștampilă, apoi înapoi la plan.

## Sistem vizual

Teme (în aplicație: Profil → Setări → Temă):
- **Zi**, implicit: fundal gri-albăstrui deschis #E8EBF2, carduri albe, linii #D2D7E3.
- **Noapte**: grafit neutru #121215, carduri #1C1C21, fără nuanța de albastru.
- **Ca telefonul**: urmează setarea sistemului.

Fundalul cu întrebări, în stilul wallpaper-ului de la WhatsApp:
- Circa 30 de întrebări scrise de mână (fontul Caveat), de tipul „ce facem diseară?”, „oare e deschis?”, „cât costă?”, „cine conduce?”.
- Printre ele, desene mici din linii (pin, bilet, pizza, popic, lună, cană, zar) și câteva linii ondulate.
- O singură culoare, foarte slabă: bleumarin la 8,5% ziua, alb la 7% noaptea. Cardurile sunt pline, deci desenele se văd doar în spațiile dintre ele.
- Apare pe ecranele aerisite, nu în spatele formularelor și al listelor lungi (Ce facem?, Prieteni, Gașcă nouă).
- Se poate opri din Setări.

Accente, aceleași în toate temele:
- Albastru #2F5BFF
- Galben #FFD43B, culoarea biletului și a nivelului
- Coral #FF6A4D
- Violet #8C6CFF

Pe temele deschise, textul colorat folosește variante închise (#2447E0, #7A5E00, #A8341C, #5B3FD9), ca să treacă de contrastul AA. Textul principal e #0E1440, cel secundar #454E7E / #5A6390.

Tipografie și imagini:
- Bricolage Grotesque pentru titlurile mari (lățime îngustată) și Instrument Sans pentru text. Ambele au diacritice românești.
- Nu folosim Inter.
- Iconurile sunt SVG cu contur. Fără emoji.
- În loc de poze stock folosim artă geometrică pe categorii.

## Reguli de mișcare

- La apăsare, elementul se micșorează la 0,97 în 140 ms.
- Intrările folosesc ease-out și durează sub 300 ms. Nimic nu pornește de la scale(0).
- Chips-urile și cardurile au spring cu ușor overshoot (`linear()` unde e suportat).
- Animăm doar transform și opacity.
- Animațiile mari (biletul, cardul gășcii, level up) apar doar la momente rare.
- Cu „reduce motion” activ, mișcarea dispare aproape complet.
- Votul merge din butoane. Swipe-ul, dacă îl adăugăm, e doar scurtătură (WCAG 2.5.7).

## Sistemul de nivel

XP vine doar din ieșiri reale și nu depinde de nota dată. Nimeni nu trebuie să fie tentat să dea note mai bune ca să primească XP, pentru că pe aceste note se bazează recomandările.

- +100 pentru o ieșire bifată
- +50 pentru un loc nou pentru tine
- +75 pentru o categorie nouă
- 0 pentru „N-am mers”, fără penalizare
- Nimic pentru deschis aplicația și fără streak-uri
- O singură excepție: +150 XP de bun venit, o dată, la finalul turului cu Bilu. Te duce la nivelul 1.

Fiecare nivel are o poreclă și o replică:

| Nivel | Poreclă | Prag XP | Replica |
|---|---|---|---|
| 1 | Boboc | 100 | Abia ai ieșit din casă. Bine ai venit! |
| 2 | Scânteie | 400 | Ai prins gustul ieșitului. |
| 3 | Radar | 900 | Simți de la distanță unde se întâmplă ceva. |
| 4 | Busolă | 1.500 | Toți te întreabă pe tine unde mergem. |
| 5 | Motorul găștii | 2.500 | Fără tine, gașca stă acasă. |
| 6 | Legenda orașului | 4.000 | Localurile știu cum te cheamă. |

Poreclele sunt obiecte și imagini, nu adjective, ca să sune la fel pentru oricine.

Deblocările țin de încredere, nu de plată. La nivelul 4 poți propune locuri noi: le verificăm și apar cu numele tău.

Animația de level up, pas cu pas:
1. XP-ul zboară în bară și bara se umple.
2. Ecranul se întunecă, cu o mică zdruncinătură.
3. Cade ștampila „NIVEL NOU”.
4. Cifra se întoarce ca pe un panou de aeroport (3 → 4).
5. Numele nivelului apare literă cu literă, cu confetti în culorile brandului.
6. Apare cardul cu ce ai deblocat.

## Bilu și turul de bun venit

Bilu e mascota: biletul galben din logo, cu ochi, mâini și picioare. Are câteva stări: salută, face cu ochiul, arată spre ceva, se sperie și sare de bucurie. Clipește și se leagănă ușor.

- **Client, după crearea contului:**
  - două mesaje pe tot ecranul: „Salutare! Bine ai venit în CeFaci. Sperăm să te scăpăm de plictiseală și să te distrezi cu vârf și îndesat!”, apoi „Înainte de toate, un mic tur…”;
  - turul propriu-zis: ecranul se întunecă, iar o lanternă (un decupaj cu contur galben care pulsează) alunecă pe rând peste vremea și Live Drops, „Cine vine?”, butonul principal și Planuri;
  - la Profil apeși tu (acolo sunt carnetul, prietenii și gășcile); dacă apeși în altă parte, Bilu se sperie și îți arată unde;
  - la final sare de bucurie, cu confetti, și îți dă cei 150 XP de bun venit: bara se umple și apare „Nivel 1 · Boboc”, literă cu literă;
  - poți vedea toate nivelurile, iar butonul principal te duce direct la recomandări („Hai să vedem ce faci diseară!”);
  - după XP urmează cadoul Plus: apeși tu pe iconița încețoșată, iar Bilu își face magia pe pagina Plus;
  - se poate sări oricând, iar XP-ul intră oricum. Turul se revede din Profil, fără XP a doua oară.
- **Business (panoul):** 8 pași: bun venit („Hai să-ți umplem localul!”), meniul, oprirea rezervărilor și scanarea din antet, scannerul (cu reducerea Plus și închiderea mesei), Plăți și comisioane, apoi Echipa, pe care o apeși tu. Se revede din butonul cu Bilu, jos în meniu.
- **Angajat (telefon):** după „Da, sunt eu”, Bilu salută pe nume și arată scannerul, plus rezervările pentru Recepție.
- **Reguli:** maximum 8 pași, câte o frază-două pe pas, fundal întunecat 65–80%, „Sari peste” mereu vizibil. Restul funcțiilor primesc sfaturi de la Bilu abia la prima folosire (de făcut).

## Contul nou și preferințele

Pe canvasul de client, înainte de Demo, e un ecran conectat în care Bilu te duce prin 7 pași:
1. **Intrarea:** Google sau email (cod primit pe mail). Fără SMS și fără „Continuă fără cont” (decizia lui Cornel, 04.10). Apple e ascuns deocamdată.
2. **Numele:** prenumele, username-ul (cu sugestii dacă e luat) și anul nașterii. Sub 16 ani nu se poate intra, iar la 16–17 ani locurile 18+ sunt ascunse.
3. **Zona:** Buftea, cât de departe mergi și cum ajungi.
4. **Ce-ți place:** 12 plăci, minimum 3 alese.
5. **Cum ieși:** buget, cu cine, când, chill sau party.
6. **„Ai merge aici?”:** 5 locuri reale, cu Da, Poate sau Nu prea.
7. **Prietenii:** după @username sau cu codul de prieten, din Profil → Prieteni (nu din agendă). „Invită prieteni” cu link spre magazin vine după ce aplicația e pe Google Play.

La final apare un rezumat, explicația despre date („nu vindem date, nu arătăm reclame”) și intrarea în aplicație, unde pornește turul. Din aceste răspunsuri pornește motorul de recomandări (vezi documentul Versiunea 1).

## Panoul de admin al aplicației

Are un canvas separat, „CeFaci Admin — panoul aplicației”, cu un demo conectat:
- **Acasă:** cifrele, venitul pe surse și lista „De rezolvat”.
- **Cereri de la localuri:** verificări (CUI, telefonul localului, adresă, poze), nivelul de risc și butoanele Aprobă, Cere ceva, Respinge.
- **Dispute:** ambele părți, istoricul și decizia.
- **Verificarea notelor:** diferențele, încrederea pe localuri, auditul cu Plus suspendat.
- **Deconturi:** cât plătim sau încasăm de la fiecare local, cu decontul reținut în timpul auditului și export pentru contabil.

**Locurile din aplicație (decizie Cornel, 06.10: „să pot primi cererile de locații, să văd toate locațiile, să le modific și să adaug unele noi”):**
- **Cereri de locuri noi:** tot ce trimit clienții din Explorează → „Lipsește un loc? Spune-ne” (acum în tabelul `reports`, cu `venue_id = 'nou'` și textul „LOC NOU: nume · unde · de ce”). Pentru fiecare: Aprobă (locul intră în aplicație), Cere detalii, Respinge. La aprobare completezi felul, poziția pe hartă, povestea și programul.
- **Semnalări de la clienți:** „E închis”, „Program greșit”, „Telefon greșit”, „Preț greșit” (tot din `reports`), grupate pe local, cu un buton de corectare.
- **Toate locurile:** lista completă (cele alese, cele bine cotate, cele scoase), cu căutare și filtre (zonă, fel, nivel, fără program, cu semnalări). Pentru fiecare se pot modifica numele, felul, poziția, programul, prețul, povestea, „când e lume” și vibe-ul. Mai poate fi ascuns sau scos și trecut ca ales.
- **Adaugă un loc:** formular cu poziția pe hartă (pin), felul, programul pe zile, prețul și povestea.
- **De ce trebuie schimbată și aplicația clientului:** acum locurile vin în APK (`src/data/venues.json`), deci o modificare ar cere APK nou. Pentru admin, locurile trebuie ținute în Supabase (`public.venues` există deja) plus modificările făcute de mână (de exemplu un tabel `venue_edits`). Aplicația ia la pornire ce s-a schimbat, ca o corectură din admin să ajungă la toți în câteva minute, fără APK nou.
- **Când:** după ce e gata aplicația clientului, odată cu Business (același web app, cu cont de admin).
- **Locurile sunt deja în Supabase (06.10):** `public.venues` are tot locul (`data` din import, `edit` cu ce s-a schimbat de mână, `status` on/hidden/gone). Aplicația are în ea copia de la build și ia la pornire doar ce s-a schimbat (`src/app/places.ts`, `mobile/src/lib/places.ts`). Importul hărții (`import_places`) nu atinge niciodată modificările de mână, locurile ascunse sau pe cele adăugate din Admin. Fiecare schimbare intră în jurnal (`venue_log`: cine, ce, înainte, după, de ce).
- **Admin mai amănunțit (Cornel, 06.10):** pe lângă locuri, cereri și semnalări: echipa și rolurile, jurnalul a tot ce s-a schimbat (cu „anulează”), utilizatorii (căutare, blocare, conturi șterse), localurile partenere și cererile lor, dispute, deconturi, statistici (câți oameni, ce caută, ce zone au puține locuri).
- **Rolurile (ca viitorii angajați să nu aibă puteri de fondator):**
  - **fondator:** tot, inclusiv echipa și banii.
  - **admin:** locuri, cereri, semnalări, parteneri, dispute. Adaugă în echipă doar editori, moderatori și suport și nu poate atinge un fondator sau alt admin.
  - **editor:** locuri (modifică, adaugă, ascunde) și cererile de locuri noi.
  - **moderator:** semnalări și cereri. Ascunde un loc, dar nu-l modifică.
  - **suport:** vede, nu schimbă nimic.
  - **contabil:** deconturi și plăți.

  Nimeni nu-și schimbă singur rolul. Regulile sunt în baza de date (`private.can`, `staff_set`, `staff_remove`), deci nu se pot ocoli din aplicație. Sunt testate în `tests/db.test.ts`.

## Versiunea 1

Ce lansăm întâi, ce lăsăm pe V2 și V3, cum funcționează motorul de recomandări, planul de lansare, ce rezolvăm legal și tehnic înainte, cum o construim în Claude Code și ce cifre urmărim sunt în documentul „CeFaci — Versiunea 1: ce lansăm întâi”.

## Cum face CeFaci bani

Aplicația de bază rămâne gratis: recomandări, vot cu gașca, rezervări. Banii vin din trei locuri.

**1. Comision de la localuri**
- **5% din nota meselor venite prin CeFaci:** rezervări, Live Drops și clienți Plus. Ospătarul scrie totalul notei după reduceri la „Închide masa”, din scanner sau din Rezervări.
- **8% din biletele vândute online.** Banii de bilete trec prin noi, iar localul îi primește lunar, minus comisionul.
- **0 lei** pentru clienții veniți fără aplicație și pentru scanările fără notă.
- **Decont lunar:** biletele de primit minus comisionul datorat. Rezultatul e fie o sumă de primit, fie una de plătit.

**2. CeFaci Plus: 20 de lei pe lună, cu gașca inclusă**
- **Ce primești:** 10–20% reducere la localurile partenere, pentru membru și prietenii de la aceeași masă (maximum 4); Live Drops cu 10 minute mai devreme; fără taxă de serviciu la bilete; evenimente doar pentru Plus; Bilu și carnet aurii.
- **Reducerea o dau localurile.** Aleg cât (10, 15 sau 20%) și pot exclude serile de vârf. Se aplică prin același cod QR: la scanare apare „Client Plus · −15% pentru 4 din 6”. CeFaci nu atinge plata la masă.
- **Proba:** o săptămână gratis, fără card. Iconița Plus e ultima din bara de jos și stă încețoșată, la fel toată pagina Plus. La finalul turului, Bilu te pune să apeși pe iconiță, te duce pe pagina încețoșată și acolo face „Hocus… pocus!”: pagina și iconița se limpezesc. Dacă ai sărit turul, pe pagina încețoșată te așteaptă „Aici e ascuns un cadou”.
- **Când expiră sau oprești Plus:** pagina și iconița se încețoșează iar, cu un card „Plus s-a oprit” (cât ai economisit și „Reia Plus · 20 lei pe lună”).
- **Mesajele lui Bilu:** în ziua 5, „Mai ai 3 zile, ai economisit X lei”. La final: „Hei, săptămâna de probă a expirat! Ai economisit X lei cu Plus. Vrei să continui sau ne oprim aici? Poți reveni oricând!”. Nu luăm bani automat; plata începe doar dacă omul alege să continue.
- **Tab-ul Plus** arată cât ai economisit și unde, ce primești, lista localurilor cu reducere și butonul de anulare. Pe rezultate apare „−15% cu Plus”, iar pe bilet „Plus · −15% pentru gașcă”.

**3. Taxă de serviciu la bilete (1,5–3 lei pe bilet)** pentru cine nu are Plus.

**Verificarea notelor** (ca localurile să nu declare mai puțin):
- **Fiecare masă:** clientul scanează codul localului la sosire și pune poza bonului fiscal la plecare, pentru +25 XP. Aplicația citește CUI-ul, ora și totalul (vezi „Decizii din 29 septembrie seara”).
- **Reducerea Plus:** clientul e întrebat și dacă i s-a aplicat. Dacă nu, îi dăm diferența ca reducere la următoarea ieșire și vorbim cu localul.
- **Ce vede localul:** în Plăți fiecare tranzacție are „Verificat cu poza”, „Declarat de voi” sau „Diferență”. O diferență se corectează sau se explică. Diferențele mari repetate duc la verificare și, la nevoie, la oprirea parteneriatului.

**Ce nu facem:** reclame printre recomandări, localuri care plătesc ca să urce în top, XP cumpărat, vândut date.

**În business:** tab-ul „Plăți și comisioane”, ultimul din meniu. Are comisionul pe luna curentă, biletele de primit, decontul pe luna trecută, graficul pe zile (cu vedere de tabel), tranzacțiile cu filtre și stare de verificare, deconturile lunare în PDF și tarifele. În Oferte e setarea reducerii Plus.

## Decizii din 29 septembrie seara

- **Zona:** lansăm direct în tot Bucureștiul și Ilfovul, nu doar în Buftea. Aplicația are toate localurile din prima zi, din date publice gratuite (OpenStreetMap) plus adăugate de mână. Recomandările merg și la localurile nepartenere, iar partenerii își revendică pagina când văd clienți veniți din CeFaci.
- **Localurile fondatoare (15–20):** 0% în primele 3 luni, apoi 4% pe viață în loc de 5%, plus insigna „Partener fondator”. Totul e scris în contract din prima zi.
- **Buget minim:** fără salarii, fără SMS la înscriere (Apple, Google sau email), hărți gratuite, fără Plus în primele 3–6 luni, marketing din conținut propriu și ambasadori. Estimare: ~1.700 lei o singură dată și ~550 lei pe lună, deci ~6.000–7.000 lei pentru 6 luni fără venit.
- **Persoană fizică la început:** e ok cât nu se încasează niciun ban. SRL-ul se face înainte de primul leu încasat, adică înainte să se termine perioada gratuită a fondatorilor.
- **Dovada ieșirii:** clientul o face, nu ospătarul. La local e un singur cod QR CeFaci, la bar sau la intrare. Clientul îl scanează când ajunge („Am ajuns”), iar dacă nu găsește codul, confirmă cu locația. Oferta sau reducerea Plus apare pe ecranul lui. La plecare pune poza bonului fiscal, iar aplicația citește CUI-ul, ora și totalul. (Schimbat pe 03.10: la nepartenere XP-ul vine la check-in cu locația, iar bonul aduce +25 XP în plus; vezi „Bonul și check-in-ul”.) Scannerul personalului rămâne opțional. În Business, codul e în Profilul localului („Descarcă pentru print”, „Vreau un stand gratuit”), iar mesele apar „Confirmat cu bonul”. Rezervările nu mai au cod QR arătat la intrare.

## Aplicația funcțională (29 septembrie seara)

- **Etapa 1 e gata:** ecranele din canvas (Cont + Demo, cu Bilu, turul, biletul, Plus) rulează pe localuri reale din București și Ilfov (OpenStreetMap), cu motorul de recomandări și căutare. (Istoric: prima variantă a fost un APK WebView; din 03.10 aplicația e scrisă nativ, vezi mai jos.)
- **Live Drops și reducerile Plus** sunt goale până apar parteneri reali.
- **Prioritatea numărul 1 (când Cornel are PC):** motorul de căutare trebuie să fie impecabil, iar întrebările de la crearea contului, inclusiv designul lor, la fel. Sunt lucrul cel mai important de lustruit înainte de lansare.

## Banii și taxele (propunere, de verificat cu contabilul)

Planul complet e în documentul „CeFaci — Banii și taxele: cum nu intrăm în datorii”. Ce schimbă față de cele de mai sus, dacă e aprobat:
- **Firma:** SRL fără angajat la început, deci impozit pe profit 16%. Salariu (4.418 lei pe lună cost total) abia de la ~790 de ieșiri verificate pe lună. Fără salariu, pragul e ~200 de ieșiri, la ~1.521 lei costuri fixe.
- **TVA:** nu suntem plătitori sub 395.000 lei pe an, dar cerem codul special (art. 317) înainte de prima factură de la Apple, Google, Supabase sau Meta și plătim 21% TVA pe ele, pe 25. Contractele spun „5% + TVA, dacă e cazul”.
- **Comisionul:** decont și factură pe 1 (e-Factura automat), contestații până pe 5, transfer până pe 10, card salvat al localului pe 11, ieșire din recomandări pe 15, suspendare pe 30. Localurile noi au decont la două săptămâni în primele două luni.
- **Reducerea Plus neaplicată:** diferența se scade din decontul localului, nu o plătim noi.
- **Bilete (V2):** vândute „în numele și pe seama localului”, cu procesator care împarte plata (de exemplu Stripe Connect). Localul primește banii la 3 zile după eveniment, nu lunar.
- **Plus:** din 20 lei ajung la noi ~14,05 lei (TVA 21% și 15% comisionul magazinului), cu 5–9 săptămâni întârziere. Plata doar prin Apple și Google; proba o dă aplicația, fără reînnoire automată.
- **Conturi:** Operare, Taxe (2% din încasări pe micro sau 10% pe profit, plus 21% din facturile străine), Rezervă (3 luni de costuri înainte de lansare).

## Localuri verificate și parteneri

- **Verificat** (sigiliu albastru cu bifă lângă nume): localul și-a revendicat pagina, a dovedit că e al lui și își ține programul și prețurile la zi.
- **Partener** (eticheta de pe ofertele din „Acum în jur”): are o ofertă sau o colaborare cu CeFaci.
- Niciuna nu urcă localul în recomandări. Plasarea plătită e marcată „Sponsorizat”.

## Rezervări

- **Obligatorie**: pe rezultat apare „Cere rezervare”, iar pe bilet apar mesajul „Faceți o rezervare ca să vă asigurați locul.” și butonul Rezervă.
- **Recomandată** (vineri seara, grup mare, local care se umple): același mesaj, ca sfat.
- **Nu e nevoie**: nu apare nimic.
- Cum funcționează: alegi numărul de persoane și ora (orele pline sunt tăiate), iar cererea trimisă apare „În așteptare”. După ce localul confirmă, pe bilet cade ștampila REZERVAT. Anularea e gratuită până la o oră stabilită de local.
- Rezervarea direct din aplicație merge doar la localurile partenere care își trec locurile libere în CeFaci. Cererea ajunge la ei și primești cod QR.
- **La localurile nepartenere** butonul Rezervă rămâne, dar îți arată cum rezervi direct la ei, din datele publice ale localului:
  - **Sună** (cu numărul lor), **Scrie pe WhatsApp** (mesajul e deja scris) și **Rezervă pe site-ul lor**, după ce are fiecare local;
  - textul gata de spus sau de copiat: „Bună ziua! Aș vrea o masă pentru 4 persoane, azi la 20:00, pe numele Cornel Adrian.” (masă, teren sau sesiune, după local);
  - „Ceva nu e bun?” ca să semnalezi un număr greșit.
- Când te întorci în app, te întreabă „Ai reușit să rezervi?”:
  - **Da**: notezi ora și câte persoane, iar pe bilet apare „Rezervat prin telefon / WhatsApp / site”, cu ștampila REZERVAT. Nu are cod QR, pentru că localul nu e în CeFaci, așa că spui numele la intrare. Gașca vede rezervarea pe bilet.
  - **Nu mai aveau loc**: îți propune să cauți altceva la aceeași oră sau să mergeți fără rezervare.
  - **Încă nu**: butonul Rezervă rămâne pe bilet.

## Bilete (filme, party-uri, stand-up)

- Biletul e diferit de rezervare: e plătit, e pentru fiecare om în parte și e pentru o oră fixă. Apare doar la locurile unde intri cu bilet: pe rezultat eticheta „Cu bilet”, iar pe Biletul serii secțiunea „Aici intri cu bilet”, cu prețul și câte bilete mai sunt. Dacă se vând și la intrare, apare și prețul de la ușă.
- **Partenerii** vând direct în CeFaci: alegi câte bilete (implicit tu și cei care au zis „vin”), la cinema și locurile în sală (se propune automat cel mai bun rând liber), apoi plătești cu Apple Pay sau Google Pay. Fiecare primește biletul lui în aplicație.
- **Nepartenerii**: „Cumpără de pe site” te trimite pe site-ul lor, apoi adaugi biletul în CeFaci.
- **„Am deja bilet”**: îl imporți din poze (screenshot), din PDF sau mail sau îl scanezi. Aplicația citește codul și îl pune pe Biletul serii.
- Biletele salvate: pe cotor scrie „Bilete: 3 din 4”, iar dacă lipsesc, apare cine încă n-are. Apeși pe cod și biletele se deschid mare, cu săgeți de la unul la altul: al cui e, locul, codul, „Adaugă în Wallet”. Merg și fără internet, iar la 18+ amintesc de buletin.
- Un bilet plătit nu se anulează niciodată automat. Dacă un plan nou se suprapune, avertismentul spune că biletele nu se returnează automat, dar le poți da unor prieteni.
- Un Live Drop cu intrare liberă înlocuiește biletul: pe planul făcut din drop nu mai apare nimic despre bilete.
- De decis mai târziu: vânzarea de bilete în CeFaci înseamnă plăți, rambursări și facturi. Până atunci, varianta sigură e trimiterea la vânzător plus importul.

## Codul QR al biletului

- Când rezervarea e confirmată, apare un moment scurt pe tot ecranul: ecranul se întunecă și cade ștampila REZERVAT. Apoi ștampila rămâne mică pe linia de rupere a biletului, fără să acopere titlul.
- Pe cotorul biletului apare un cod QR mic. Apeși și se face mare, cu o animație scurtă. Se închide dacă apeși oriunde în afara lui sau pe X.
- Codul se schimbă la câteva secunde, ca să nu poată fi trimis ca screenshot. Are dedesubt și un cod de 6 cifre, pentru când nu merge camera.

## Live Drops (cum funcționează)

- Sunt oferte scurte de la localurile partenere din zonă, care apar doar cât sunt active. Au un ceas care scade și un număr limitat de locuri („rămân 5 din 10”).
- Pe Acasă apare un rând care se derulează cu primele 5. „Vezi toate” deschide ecranul Live Drops.
- „Ia oferta” rezervă oferta pentru tine 45 de minute și o pune ca bilet în Planuri, cu cod QR de arătat la casă. Dacă nu ajungi, oferta revine altcuiva.
- Ordinea e după distanță și după cât timp a mai rămas, nu după cine plătește. Notificările vin doar dacă le-ai activat, maximum una pe zi.

## Planuri multiple

- Poți avea oricâte planuri, dar nu două în locuri diferite care se suprapun ca oră.
- Dacă se suprapun, apare: „Ai deja o rezervare confirmată la X, azi la 20:00. Nu poți fi în două locuri deodată. Dacă vrei să continui cu Y, renunță mai întâi la X.” Ai două butoane: „Renunț la X și continui” și „Păstrez X”.
- Un plan se poate trimite gășcii. Fiecare răspunde cu Vin sau Nu pot, iar răspunsurile apar pe bilet.

## Profil

- Contul din demo: Cornel Adrian, @CornaciDev, cu badge de Founder.

## Solo, în doi, gașcă (regulile planurilor)

- Principiul de bază: un plan nu mută pe nimeni fără acordul lui. Poți ieși doar tu dintr-un plan. Ca să-i muți pe ceilalți, le propui și decide majoritatea.
- Pe Acasă, după „Cine vine?”, alegi „Cu cine ieși”: o gașcă existentă (doar membrii care au acceptat) sau prieteni luați pe rând, care formează un grup temporar. Dacă alegi cel puțin doi prieteni, îi poți face gașcă permanentă. Invitațiile la plan pleacă abia când alegi planul.
- Tipul planului vine din cine participă: solo (doar tu), în doi (un prieten) sau gașcă (2+ prieteni). Numărul pentru rezervare = tu + cei care au zis „vin”.
- Live Drop: „Pentru cine iei oferta?”:
  - „Doar pentru mine”: un loc, ceilalți nu sunt implicați.
  - „Pentru gașcă”: câte un loc de fiecare, iar ei primesc invitație.
  - Varianta nu merge dacă nu mai sunt destule locuri sau dacă oferta cere un grup minim (de exemplu 4+).
- Dacă un plan nou se suprapune cu unul existent:
  - Plan solo: „Renunț la X și continui” sau „Păstrez X”.
  - Plan cu alții: „Propun gășcii să ne mutăm la Y” (se mută toți doar dacă zice da majoritatea, iar planul vechi rămâne până atunci), „Ies doar eu” (ei merg mai departe, iar localul află că sunt cu unul mai puțin) sau „Rămân la planul cu gașca”.
  - Mutarea nu e posibilă dacă oferta nu are locuri pentru toți.
- Dacă ai deja un plan de gașcă la un local și iei oferta de acolo doar pentru tine, planul gășcii rămâne neschimbat.

## Cerul și titlul după oră

- Partea de sus de pe Acasă urmează ora reală:
  - dimineața (6–11): răsare soarele;
  - ziua (11–17): senin, cu nori;
  - apusul (17–21): soare coral la orizont și primele stele;
  - noaptea: lună, stele și ferestre aprinse.
- Titlul se schimbă odată cu ora: „Ce facem astăzi?”, „Ce facem în seara asta?”, iar după miezul nopții „Ce facem acum?”. Pentru „Mâine” și „Weekend” rămân „mâine?” și „în weekend?”.
- În demo, dacă apeși pe pastila cu ora, vezi celelalte momente ale zilei.

## CeFaci Business (panoul localurilor)

Designul e pe canvasul separat „CeFaci Business — panoul localurilor” (29 sept. 2026). Localul din demo e Pista 9; oamenii și cifrele sunt inventate. Panoul de administrare al aplicației (pentru noi) vine mai târziu, separat.

- **Azi:** cererile de rezervare cu Confirmă / Altă oră / Refuză, programul pistelor pe ore (rezervări, de confirmat, Live Drop, eveniment, la intrare), Live Drop-ul activ (mai pui locuri sau îl oprești), ultimele scanări și un comutator care oprește rezervările noi pe ziua respectivă.
- **Rezervări:** ziua din săptămână, filtre, lista cu sursa (CeFaci, Live Drop, telefon) și starea, detaliul cu notiță pentru personal și acțiuni (au venit, n-au venit, mută pe altă pistă, anulează). Tot aici se setează:
  - dacă rezervarea e obligatorie, recomandată sau nu e nevoie;
  - câte piste dai prin CeFaci pe oră;
  - cât ții locul și până când se poate anula gratuit;
  - confirmarea automată a grupurilor mici.
- **Scanner (telefonul personalului):** contul de personal poate doar să scaneze. Rezultate: cod valid (bifezi sosirea), cod valid cu ofertă (aplici reducerea în casa de marcat), cod expirat, cod deja folosit. Există și introducerea manuală a codului de 6 cifre.
- **Oferte și Live Drops:** reducere, ceva gratuit sau ofertă pentru grupuri; zile și ore sau Live Drop la o oră fixă; stoc și grup minim; previzualizare cum apare în aplicație. Un singur Live Drop activ odată.
- **Evenimente și bilete:** vânzări, preț online și la intrare, locuri, vârstă minimă, graficul biletelor vândute pe zi (cu tabel), oprirea vânzării online. La anulare, banii se întorc automat.
- **Statistici:**
  - drumul de la „te-au văzut” la „au venit cu cod scanat”;
  - când vin (zi × oră);
  - mărimea grupurilor;
  - ce spun după ieșire;
  - o sugestie de Live Drop pentru orele goale.
  Răspunsurile clienților nu schimbă XP-ul și nici locul în recomandări.
- **Profilul localului:** nume, descriere, preț, durată, vârstă, rezervare, maxim 3 vibe-uri, program, contact public (arătat doar când nu se poate rezerva prin CeFaci), poze. În dreapta se vede cum apare localul în rezultate. Eticheta „Pariu sigur” nu se cumpără.
- **Echipă și acces:** proprietar plus trei roluri: Manager (aproape tot, fără profilul localului și fără manageri noi), Recepție (rezervările zilei și scannerul, pe telefon) și Scanare (doar scannerul). Personalul vede la scanare doar prenumele, câte persoane sunt și oferta, niciodată telefonul clientului. Fiecare scanare rămâne în istoric cu numele celui care a scanat.
  - **Codul de angajat:** șeful scrie numele și rolul, iar aplicația generează un cod unic (de forma P9-4K7M), pe care îl trimite pe WhatsApp sau îl arată pe ecran. Codul merge o singură dată și expiră în 48 de ore doar dacă nu e folosit. La prima folosire se leagă de telefonul acelui om, care rămâne apoi logat. Pe un telefon nou îți trebuie cod nou, generat din Echipă.
  - **Pauză:** pentru concediu sau zile libere. Aplicația angajatului arată „Ești pe pauză” și nu scanează. Se repornește cu un tap, fără cod nou.
  - **Program (opțional):** zile și ore pe fiecare angajat. Implicit, angajatul intră oricând e deschis localul. Cu program, poate intra cu o oră înainte de tură, iar în afara lui vede „Nu ești în tură acum”.
  - **Scăpări când lipsește cineva:** „Tură extra azi”, dată de șef sau manager, și „Cer acces” din aplicația angajatului. Șeful primește notificare și aprobă.
  - **Cine administrează echipa:** managerul poate genera coduri, pune pauză și program doar pentru Recepție și Scanare. Pe manageri îi adaugă și îi scoate doar proprietarul.
  - **Scoaterea din echipă** închide contul pe loc, și pe telefon.

- **Intrarea în aplicația de business (telefon):** la prima deschidere, „Cine ești?”: Business sau Angajat.
  - **Business:** intri în cont sau îți cauți localul.
    - **Local găsit și nerevendicat:** revendicare în 3 pași: cine ești, CUI-ul verificat automat la Registrul Comerțului, apoi un cod trimis prin SMS sau apel automat la telefonul public al localului. Numărul îl luăm din Google și de pe site-ul localului, nu din ce scrie omul. Dacă nu are acces la telefonul acela, încarcă un document (certificat de înregistrare, contract de închiriere, autorizație), iar verificarea durează 2–3 zile.
    - **Local deja revendicat:** dispută, cu document obligatoriu. Proprietarul actual e anunțat și are 3 zile să răspundă, iar pagina nu se schimbă până la decizie.
    - **Local negăsit:** înscriere în 3 pași: localul, firma și tu, apoi telefonul tău confirmat prin SMS.
    - După trimitere apare ecranul „În verificare”, cu pașii. Profilul se poate pregăti ca ciornă, dar nu apare nimic public până nu acceptă adminul CeFaci.
  - **Angajat:** scrii codul primit de la șef și confirmi „Da, sunt eu” (codul se leagă de telefon). Apoi vezi aplicația de angajat după rol: Scanare doar scannerul, Recepție scannerul și rezervările zilei. Tot aici apar ecranele de pauză și „Nu ești în tură”, cu „Cer acces pentru azi”.
- **Demo conectat:** primul ecran de pe canvas. Totul e legat, ca la Demo-ul de client:
  - ceasul merge, la ~24 de secunde intră o cerere nouă (Laura P.), iar Live Drop-ul e luat singur de clienți;
  - confirmi sau propui altă oră, iar clientul acceptă după câteva secunde; rezervarea se mută în program;
  - scannerul se deschide din meniu, iar o scanare bifează sosirea și în Rezervări, pe Azi și la Live Drop;
  - anularea turneului eliberează pistele 7–8; numele schimbat în Profil apare în meniu;
  - dacă pui pe pauză sau scoți din echipă persoana care scanează, scannerul arată de ce s-a oprit și cine scanează mai departe;
  - la ~46 de secunde, Denisa (Recepție, program doar în weekend) cere acces, iar tu îi dai tură extra din Echipă.

Ideile de la care am pornit:
- Același QR de pe bilet face trei lucruri: confirmă rezervarea, aplică oferta și bifează ieșirea. Bifarea înseamnă ștampilă și XP automat, pentru că ieșirea e dovedită, nu doar declarată.
- Localurile cu pagina revendicată își creează oferte din panou: „−15% / −30% la nota prin CeFaci”, „desertul gratuit”, „la 4+ persoane, o porție din partea casei”. Au reguli pentru zile, ore, câte oferte pe zi și grupul minim.
- Ospătarul scanează codul din CeFaci Business, cu un cont de personal care poate doar să scaneze. La el apare pop-up-ul „Cod valid” (sau motivul pentru care nu merge), iar clientul simte o vibrație și vede „S-a aplicat reducerea”.
- CeFaci nu atinge plata. Ospătarul aplică reducerea în sistemul lui de casă.
- Ofertele nu urcă localul în recomandări și apar ca bonus, ca să nu devenim o aplicație de cupoane.

## De verificat

- Prietenii din preview sunt inventați (Ioana, Mihai, Sara, Radu etc.), iar poza de profil e o ilustrație care ține locul unei poze reale.
- Numele de localuri sunt inventate: Pista 9, Casa Grill, Laboratorul, Nota Falsă, Cofetăria Mia, Cinema Nord, Padel Chitila, Zarul, Boabe. Lacul Buftea și Mogoșoaia sunt locuri reale.
- Numerele de telefon din demo (0721 000 111 etc.) sunt inventate. În aplicația reală vin din datele publice ale localului și trebuie verificate periodic.
- În Demo-ul de client, turul arată ce vede un cont nou (Nivel 1, Boboc), iar restul Demo-ului e pe un cont cu istoric (Nivel 3, Radar).
- Poziția lanternei pe Acasă e calculată pentru ecranul de 390×844. În aplicația reală se ia din poziția elementului.
- Procentele (5% din note, 8% din bilete), prețul Plus (20 de lei) și reducerile (10–20%) sunt propuneri. Trebuie testate cu primele localuri.
- Facturarea, TVA-ul și banii de bilete care trec prin noi trebuie verificate cu un contabil. Pentru bilete și Plus ne trebuie un procesator de plăți.
- Cifrele din tab-ul de plăți (1.284 lei comision, 1.836 lei decont, 312 membri Plus) sunt inventate pentru demo.
- Pragurile de XP sunt estimări. Le calibrăm după câte ieșiri pe lună face un utilizator real.
- Analiza de produs spune „fără puncte, streak-uri sau badge-uri”. Sistemul de nivel e o excepție asumată, pentru că XP vine doar din ieșiri reale. Dacă îl păstrăm, analiza trebuie actualizată.
- Analiza pune gășcile și prietenii în „Should Have, faza 4”. Căutarea după username e o cerință nouă și trebuie trecută și acolo.
- Analiza numește „votul prin link, fără aplicație” killer feature și motor de creștere. Decizia nouă (vot doar cu cont) trebuie trecută acolo, cu riscul asumat: grupurile în care nu toți au aplicația.
- Rezervările din aplicație depind de aplicația pentru business (faza 4 în analiză).
- Adresele și firmele din căutarea de localuri (ex. „CASA GRILL BUFTEA SRL”, Str. Mihai Eminescu 5) sunt inventate. Codurile din demo (482915, 271604, P9-4K7M etc.) sunt doar de test.
- Revendicarea depinde de două lucruri pe care trebuie să le avem în aplicația reală: acces la datele Registrului Comerțului după CUI și un furnizor de SMS și apeluri automate.
- Coada de revendicări, dispute și înscrieri noi merge în panoul de admin al aplicației, care urmează.
- Urmează: motorul de căutare și recomandări după persoană și grup, ecranul cu preferințe la crearea contului și panoul de administrare al aplicației.
- În Demo, sfârșitul unei ieșiri se simulează din Planuri, cu butonul „Demo: ieșirea s-a terminat”. În aplicația reală ar veni din ora planului sau din QR-ul scanat la local.
- Ecranele separate „Gașcă nouă” și „Gașca de vineri” de pe canvas au încă varianta veche, cu inițiale în loc de simbol. Demo-ul are varianta nouă.

## Bonul și check-in-ul la toate localurile (decizie Cornel, 03.10 seara)

- **Bonul se citește pe server**, cu Google Cloud Vision (funcția Supabase `citeste-bon`): CUI-ul localului, cu cifra de control verificată, plus data, ora și totalul. Poza nu se păstrează. Primele 1.000 de bonuri pe lună sunt gratuite, apoi ~1,5 $ la 1.000.
- **Localuri partenere:** „Am ajuns” cu codul QR CeFaci de la bar. Bonul e obligatoriu: din el se calculează comisionul și se verifică reducerea Plus.
- **Localuri nepartenere:** „Am ajuns” cu locația telefonului (acolo nu e cod QR). Bonul e opțional și aduce +25 XP. Totalul e folosit doar pentru:
  - prețul real mediu de persoană al localului, care înlocuiește estimarea pe tip de local;
  - statistici pe care le arătăm localului când îi propunem parteneriatul („luna trecută au venit 43 de oameni prin CeFaci”).
- Amintirea „Nu uita de bon” (la 40 de minute) merge la toată lumea, cu aceeași motivație de XP.
- Google Cloud: proba gratuită (300 $) se termină pe 10.11.2026. Pe 3.11 Cornel trece pe cont plătit și pune un buget de 10 $ cu alertă (amintirea e programată).

## Starea la 4 octombrie

- **Aplicația de telefon e nativă** (React Native + Expo, folderul `mobile/`), decizia lui Cornel din 03.10. APK-ul îl face GitHub la fiecare push, semnat cu cheia reală (secretele `CEFACI_KEYSTORE_*`).
- **Contul:** doar Google sau email. Fără „Continuă fără cont”.
- **Locurile:** 3.412 din OpenStreetMap, cu categorii noi: **Natură** (parcuri, rezervații, grădina botanică, plajă) și **Sport** (padel, tenis, fotbal, piscină, escaladă, squash, golf, călărie), plus karting, paintball, biliard, acvariu, planetariu, palate, conace, castele și mănăstiri. La palate și castele din oraș intră doar cele care se pot vizita (multe „palate” sunt bănci sau birouri).
- **Actualizare lunară automată:** GitHub descarcă datele OSM pe 1 ale lunii (Actions → „Date OSM”), refăcând localurile și programul, și le salvează doar dacă trec testele. Pe pagina rulării apare un rezumat pe zone.
- **Variație în orașele mici (problema din Buftea):** la cont, cele 5 locuri sunt câte unul din fiecare fel de ieșire (mâncare, băut, cultură, joacă, aer liber), apoi următoarele. Dacă în zonă sunt doar restaurante, căutăm până la 22 km. Testat pe toate cele 19 zone.
- **Votul cu gașca merge:** din Rezultate, „Trimite gășcii la vot” (o gașcă sau prieteni aleși), cu termen de 30 min până a doua zi. Fiecare votează Da, Nu sau Super (un singur Super), rezultatele se văd în timp real, iar la final „Facem planul” îl trimite tuturor. Planul se face doar când votul s-a terminat și atunci votul se închide.
- **Planul trimis gășcii:** de pe bilet îl trimiți unei gășci sau unor prieteni; ei răspund cu Vin sau Nu pot în Planuri, iar tu vezi pe bilet cine vine. Dacă cel care l-a făcut îl anulează sau îi schimbă ora, ceilalți primesc schimbarea.
- **Prieteni și gășci:** profilul prietenului (nivel, XP, ștampile, prieteni comuni, invită în gașcă, elimină), codul gășcii (7 zile, adminul face unul nou), „Intră cu un cod” în Planuri, membri noi, carnetul gășcii cu ieșirile făcute împreună, „Păstrați gașca?” după un vot cu prieteni aleși unul câte unul.
- **Nivelul:** check-in +100, loc nou +50, categorie nouă +75, bon +25, bun venit +150 (o dată). La un nivel nou apare ștampila „NIVEL NOU”, cu confetti și Bilu.
- **Setări** (rotița din Profil): temă Zi / Noapte / Ca telefonul, „Mai puține animații” (pornește singur dacă telefonul are reducerea mișcării), amintirea pentru bon.
- **Amintirea pentru bon:** notificare la 40 de minute după check-in și, dacă tot lipsește bonul, a doua zi la prânz. Maximum două, oprite când pui bonul. Biletul de ieri rămâne în Planuri până pui bonul.
- **Biletul:** câte persoane și ora pentru rezervare, WhatsApp pentru numerele de mobil, „Cum a fost?”, Plan B aproape, avertisment pentru planuri suprapuse, „Ceva nu e bun la locul ăsta?” (semnalările ajung în tabelul `reports`).
- **Încă de făcut:** „Invită prieteni” cu link spre magazin (după Google Play), codul QR de la bar pentru parteneri, plata Plus prin Google Play.

## Ce s-a adăugat după-amiaza (4 octombrie)

- **Locuri verificate pe Google Maps:** 188 închise definitiv și 63 închise temporar au ieșit din aplicație (rămân 3.163). Verificarea se repetă lunar; ștrandurile și patinoarele sezoniere revin singure.
- **Vremea în recomandări:** prognoza Google (48 de ore și 7 zile), luată cel mult o dată pe oră. Pe ploaie sau frig urcă locurile la adăpost, pe soare terasele și parcurile. Pe Acasă e o pastilă cu vremea, iar pe bilet un avertisment dacă plouă la ora planului.
- **Ajustări dintr-un tap** pe rezultate: Mai ieftin, Mai aproape, Deschis acum, La adăpost / Afară, Ca la început.
- **Căutare mai deșteaptă:** orele cum le spun oamenii („după 22”, „înainte de 9”, „la 1 noaptea”, „brunch la 11”) și ce trebuie să aibă locul (wifi, nefumători, se poate fuma, scaun cu rotile, aer condiționat), din datele OpenStreetMap.
- **Seara completă:** 6 feluri de seară (Cină și un pahar, Seara lungă, Spectacol și cină, Joacă apoi masă, Ziua afară, Ceva dulce și un film). Fiecare loc e deschis la ora lui și la câteva minute pe jos de cel dinainte (în orașele mici, cu mașina). „Facem așa” face un bilet pentru fiecare pas, iar serile se pot trimite gășcii la vot.
- **Harta** rezultatelor și a serii complete (MapLibre + OpenFreeMap, gratuit, fără cheie).
- **Notificări de la prieteni** (vot, plan, gașcă) prin Firebase; **XP pe server**; dublu „Înapoi” pe Acasă ca să ieși.

## Acasă nouă și „Creează plan” (decizie Cornel, 04.10 seara)

- Acasă devine simplă: vremea reală, ziua și ora, „Ce facem în seara asta?”, un singur buton mare **Creează plan**, plus **Surprinde-mă** (un plan dintr-un tap) și **Ca data trecută** (aceleași răspunsuri, fără întrebări). Sub ele: **Bilu îți sugerează** (idei fără să întrebi nimic: după vreme, lângă tine, pe gustul tău), apoi „Ai chef de…” și Live Drops. Au dispărut de pe Acasă: „Cine vine?”, rândul cu filtre, „Arată variante”, butonul „Seara completă”.
- **Creează plan**, o întrebare pe ecran, cu Bilu: un singur loc sau toată seara → când (oricare din următoarele 7 zile, cu vremea, sau din calendar; apoi ora) → câți sunteți (1–5, 6+ cu „− 8 +”, sau gașca) → bugetul de persoană pe toată ieșirea (bara cu două buline + Gratis / Ieftin / Normal / Oricât) → vibe. Răspunsurile cu o singură alegere trec singure mai departe; „Arată-mi acum” sare peste rest; data viitoare răspunsurile sunt deja bifate.
- Rezultatul nu mai e o listă de 183 de locuri, ci **3 planuri gata**, fiecare cu ce a verificat Bilu: deschis la ora lui, distanța, bugetul („+35 peste buget” când e cazul, cu sfatul „Cu X în loc de Y: ~N lei”), vremea. Planul deschis are harta, Rezervă / Drum / „Alt bar”, costul pe persoană și pentru toți, „Facem așa” (bilete) și „La vot” (gașca votează între planuri întregi).
- **Spune-i lui Bilu**: scrii „cu terasă, după 22”, „mai ieftin”, „fără fum”, „aproape”; Bilu arată ce a înțeles și reface cele 3 planuri.
- Reparații de motor: ora exactă a planului (nu mai apare o cafenea închisă la 17:00 „pentru diseară”), un pas din seară se termină cel târziu la închiderea localului, bugetul serii e pe toată seara, „aproape / lângă mine” înțeles în căutare.
- Etapa 2: „O construiesc eu” (alegi vibe-ul pentru fiecare parte a serii, Bilu caută lângă locul de dinainte).
