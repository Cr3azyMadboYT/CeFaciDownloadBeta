# CeFaci: cum merg împreună aplicația, Business și Admin

**Versiunea 2 (06.10), după verificare.** Prima versiune a trecut prin trei verificări separate, făcute ca de oameni
care vor să găsească greșeli: un inginer (baza de date și banii), un contabil-jurist și un patron de local care caută
cum să plătească mai puțin. Au găsit 89 de probleme (11 grave). Toate sunt rezolvate mai jos; lista completă, cu
capitolul unde e rezolvată fiecare, e în Anexa B. Documentul se citește de sus în jos; partea tehnică e în Anexa A.

Banii sunt partea cea mai importantă: fiecare leu trebuie să se poată verifica și reface din date, iar nimeni (local,
client, angajat CeFaci) să nu-l poată muta pe ascuns. Nimic de aici nu se construiește până nu aprobă Cornel (cap. 17).

---

## 0. Regulile de bază (ce am învățat din verificare)

1. **La dubiu nu facturăm și nu pedepsim.** Dacă nu e clar că omul a venit, localul nu plătește. Dacă nu e clar că
   n-a venit, clientul nu primește „nevenire”. Cazurile neclare se numără, ca să vedem cine abuzează.
2. **O dovadă slabă nu bate cuvântul localului.** Telefonul clientului poate fi păcălit; o poziție GPS sau un „da” nu
   ajung ca localul să plătească împotriva lui „n-au venit” (cap. 5).
3. **Tăcerea nu e gratuită.** Localul trebuie să închidă fiecare seară (cine a venit, cine nu). Cine nu închide pierde
   rezervările, nu câștigă bani (cap. 5.3).
4. **Un om adus se plătește de cel mult 3 ori pe an la același local** (propunere, cap. 8.2). De la a 4-a vizită e
   clientul localului, nu al nostru. Asta închide obiecția „vine la mine de 3 ani”.
5. **Banii se scriu o dată și nu se șterg.** O greșeală se îndreaptă cu o corecție; orice micșorare a unei facturi o
   aprobă un al doilea om (cap. 8.9).
6. **Contractul îl semnează firma CeFaci (SRL), cu firma localului, prin cineva care are dreptul s-o facă** (cap. 2, 15).
7. **Ce spunem la vânzare = ce scrie în termeni = ce face aplicația.** Prezentarea, exersarea și canvasul Business se
   rescriu după documentul ăsta, nu invers (cap. 16).

**Contradicțiile vechi, închise:**

| Se bătea cap în cap | Ce rămâne |
|---|---|
| Clientul scanează codul de la bar vs. ospătarul scanează biletul | Clientul scanează codul localului; scanerul ospătarului e de rezervă. Adevărul e lista „Sosiri” de pe server. |
| PFA la primul leu vs. SRL | **SRL înainte de primul contract cu un local**, nu doar înainte de prima factură (cap. 15). |
| „Ieșire din recomandări pe 15” pentru neplată | Nu. Neplata oprește doar rezervările și Live Drop-urile (cap. 8.8). Recomandările nu se cumpără și nu se pierd pe bani. |
| „Clienți Plus: 0 lei” | Scris exact (cap. 7.2): vizitele fără rezervare și fără Live Drop, inclusiv cele cu reducerea Plus, sunt 0 lei; rezervările și drop-urile se plătesc la fel, cu sau fără Plus. |
| Reducerea Plus neaplicată: „recuperăm diferența de la local” | Nu mută nimeni bani. Clientul primește zile de Plus, localul avertisment, apoi iese din program (cap. 7.5). |
| „Am fost acolo” ca dovadă a vizitei | E dovadă slabă: îl scapă pe client de „nevenire”, dar nu face localul să plătească (cap. 5.1). |
| Banii de bilete trec prin noi, se scad facturile din ei | Nu. Biletele trec printr-un procesator care plătește direct localul; nu compensăm facturi din banii altora (cap. 15.7). |
| „Prima lună gratis” (exersare) și 3 luni pentru toți (v1) | Un singur tabel: fondatori 3 luni (+ cel mult 3), ceilalți cât hotărăște Cornel (cap. 2.6). |
| „Pe viață” la fondatori | „Cât timp rămâi partener”, la prețul cel mai mic dintre tabelul de fondator și tariful obișnuit minus 1 leu (cap. 8.3). |
| „5% + TVA” | Taxa pe om venit; „Tarifele nu includ TVA…” (cap. 15.3). |
| Canvasul Business „Plăți” (5% din bon) și „Închide masa” cu suma notei | Se schimbă: tarifele pe om și „Închide seara” fără sume (cap. 9). |

---

## 1. Trei aplicații, o singură bază de date

- **CeFaci** (telefon, gata): planuri; la parteneri: rezervare, Live Drops, „Am ajuns”, reducerea Plus.
- **CeFaci Business** (web instalat pe ecranul telefonului sau pe tabletă, fără magazin de aplicații): cererile de
  rezervare, sosirile, închiderea serii, Live Drops, echipa, lista lunii și facturile.
- **CeFaci Admin** (web, doar echipa noastră): parteneri, locuri, semnalări, sosiri contestate, bani, echipă, jurnal.

**Regulile stau în baza de date, nu în aplicații.** Ce nu e voie nu se poate face nici cu o aplicație modificată, nici
apăsând de două ori. Mai precis (după verificarea inginerului):

- **Banii stau într-o schemă separată (`billing`)**, pe care aplicațiile nu o văd direct; se ajunge la ea doar prin
  funcțiile permise. Job-urile de bani (luna, facturile, verificările) pot fi pornite doar de server.
- **Nimic nou nu e deschis implicit.** Pe Supabase, orice funcție nouă primea automat drept de rulare pentru oricine
  are cheia publică din APK. Așa a rămas deschisă `import_places` (reparată pe 06.10, migrarea
  `20261006050000_cefaci_drepturi_nume.sql`, de rulat în SQL Editor). De acum fiecare funcție primește drept explicit,
  iar testul bazei de date verifică automat: cheia publică nu poate rula nimic, toate tabelele au RLS.
- **O funcție din Business ia localul din rândul pe care îl schimbă**, nu din ce trimite telefonul. Un manager de la
  localul A nu poate marca o sosire de la localul B.
- **Business citește clienții doar prin vederi** care dau prenumele, câte persoane, oferta și un cod pe local, niciodată
  id-ul contului (altfel două localuri ar putea urmări același om).
- **Apartenența la echipă se verifică la fiecare acțiune**, nu se ține în token: scos din echipă = fără acces pe loc.
- **Orice scriere are un cod de cerere unic.** O cerere trimisă de două ori (internet slab) face un singur lucru.
- **Jurnal pentru tot ce atinge bani sau un partener:** cine, când, rolul lui, pe ce dispozitiv, ce era înainte, ce e
  după, de ce. Jurnalele și banii nu se pot modifica sau șterge (regulă în baza de date, nu promisiune).

---

## 2. Viața unui local partener

```
caută localul → cere parteneriatul → verificare → contract acceptat de cine are dreptul → activ ⇄ pauză → ieșire
                                         ↘ respins                          (preluare de altă firmă: cap. 2.8)
```

### 2.1 Cererea
Patronul își face cont (email sau Google), își caută localul și scrie cine e (nume, ce rol are în firmă) și CUI-ul.

### 2.2 Verificarea
- **CUI-ul se verifică singur la ANAF:** numele, adresa (în forma cerută de e-Factura: județ, sector), dacă e activă,
  inactivă sau radiată. Se re-verifică înainte de fiecare factură.
- **Dovada că localul e al firmei** (una): (a) sunăm noi la telefonul public al localului (de pe Google sau de pe site)
  și dăm un cod; (b) un document. Preferăm **certificatul constatator ONRC** (arată și administratorii); la contracte de
  închiriere sau autorizații cerem să fie acoperit CNP-ul. Fișierele stau criptate, cu jurnal de acces, și se șterg la
  90 de zile; rămâne doar o notă (ce document, cine l-a verificat, când, amprenta fișierului).
- **Local revendicat de altcineva:** dispută cu document obligatoriu; cel de acum are 3 zile să răspundă.
- **Local care nu e pe hartă:** îl adaugă un admin.

### 2.3 Cine semnează
Codul primit la telefonul localului dovedește doar că omul are acces la telefon, nu că poate semna pentru firmă. De
aceea:
- **Acceptă doar administratorul firmei** (cel din certificatul constatator) **sau cineva cu împuternicire semnată.**
- **Se semnează în numele firmei (CUI), nu al localului.** O firmă cu 3 localuri semnează o dată.
- **Clauzele speciale se acceptă separat, explicit** (cere Codul civil, art. 1203): pauza la neplată, ieșirea din
  programul Plus, limitele de răspundere, pierderea statutului de fondator, regulile dovezilor, instanța. Un ecran
  separat le listează și cere bifă pentru fiecare.
- **Clauza de dovadă:** evidențele CeFaci (scanări, închiderea serii, răspunsurile clienților) dovedesc o sosire dacă nu
  sunt contestate în termenul din contract.
- Rămân salvate: versiunea, amprenta textului exact, cine a acceptat (nume, funcție, dovada dreptului), ziua, ora, IP-ul.
- **PDF-ul acceptat pleacă pe emailul de facturare al firmei**, cu 7 zile în care firma poate spune „nu e valabil”.
- Pentru fondatori (contract pe termen lung), de luat în calcul semnătura electronică a administratorului.

### 2.4 Treapta de preț
Treapta (cap. 8.1) o calculează CeFaci după formula din contract (cap. 8.4) și o vede localul **înainte** să accepte.

### 2.5 Activarea
Ziua (de lucru) în care sunt îndeplinite toate: contract acceptat de cine are dreptul, profil publicat, o scanare de
probă la bar, Business instalat pe ecranul telefonului și o notificare de probă primită. **Înainte de activare nu se pot
cere rezervări și nu se pot pune Live Drops** (regulă în baza de date).

### 2.6 Lunile gratuite (un singur tabel)

| | Luni gratuite | Prelungire dacă n-a venit nimeni plătibil |
|---|---|---|
| Fondator (cel mult 20) | 3 | până la primul om adus, cel mult încă 3 luni |
| Ceilalți parteneri | **de hotărât de Cornel** (propunere: 1) | nu |

Regulile exacte sunt în cap. 8.6. Pe scurt: se dau **o singură dată pentru același loc fizic** (adresă și coordonate),
oricare ar fi firma, timp de 24 de luni; ieșitul și reintratul nu le mai dau.

### 2.7 Pauza, termeni noi, ieșirea
- **Pauza:** localul poate opri rezervările sau Live Drop-urile oricând (o zi sau până le pornește). Ce era confirmat
  rămâne valabil și se plătește normal.
- **Termeni noi:** se anunță cu 30 de zile înainte, cu motivul, și cer acceptare nouă. Nu se aplică niciodată înapoi.
  Cine nu acceptă: rămâne pe termenii vechi 90 de zile, apoi rezervările și drop-urile se opresc; statutul de fondator
  rămâne. Poate pleca liber oricând.
- **Ieșirea:** oricând, fără penalizări. Rezervările și drop-urile noi se opresc pe loc; cele confirmate deja: localul
  le onorează (se plătesc la tariful zilei) sau le anulează (clienții sunt anunțați). Se face **o factură finală**,
  oricât de mică. Statutul de fondator se pierde; la revenire, tarife obișnuite, fără luni gratuite.
- **Noi îl putem opri doar cu motive scrise**, trimise înainte sau odată cu oprirea (cere Regulamentul european P2B,
  cap. 15.4). Încetarea parteneriatului de către noi: cu 30 de zile înainte.

### 2.8 Localul trece la altă firmă (preluare)
Se întâmplă des în HoReCa. Firma nouă acceptă contractul; firma veche primește factura finală pentru ce s-a adunat până
în ziua preluării (fiecare taxă știe firma din ziua ei, cap. 8.5). Lunile gratuite nu se dau din nou (sunt pe loc, nu pe
firmă). Statutul de fondator trece doar dacă proprietarul e același, hotărât și scris în jurnal de un admin. Un loc cu
facturi neplătite nu se poate reactiva sub altă firmă până nu se plătesc sau firma nouă le preia.

### 2.9 Mai multe localuri ale aceleiași firme
Fiecare local are treapta, statutul și lunile lui; firma primește o singură factură pe lună, cu rânduri pe fiecare
local. Dacă un local are o problemă (alertă, dispută), restul firmei se facturează normal.

**Fondatori:** cel mult 20, numerotați 1–20 în baza de date (nu se pot da 21 nici dacă doi admini apasă deodată). Îi
dă doar Cornel. Un loc de fondator nu se eliberează când cineva pleacă (propunere).

---

## 3. Rezervarea prin CeFaci

### 3.1 Stările

| Stare | Cum ajunge acolo | Se plătește? |
|---|---|---|
| **Cerută** | clientul alege ziua, ora, adulți, copii sub 12 | — |
| **Confirmată** | localul confirmă, sau automat (cap. 3.3) | — |
| **Altă oră propusă** | localul propune; clientul are 15 minute să accepte (se verifică iar locurile) | — |
| **Refuzată** / **Expirată** | localul refuză / n-a răspuns la timp | nu |
| **Anulată de client** | oricând, gratuit | nu |
| **Anulată de local** | cu motiv; dacă e cu mai puțin de 2 ore înainte, se numără (cap. 3.5) | nu |
| **Au venit** | închiderea serii sau dovezile (cap. 5) | **da** |
| **Au întârziat** | au ajuns după timpul în care masa e ținută + 10 minute și n-au mai avut loc | nu; jumătate de nevenire pentru client |
| **N-au putut fi primiți** | localul: n-a avut loc la sosire (doar în 30 de minute de la scanare) | nu |
| **N-au venit** | localul o spune explicit și clientul nu o contestă cu dovadă | nu; nevenire pentru client |
| **Neclar** | dovezi slabe de o parte, nimic sigur de cealaltă (cap. 5.4) | nu, nicio pedeapsă |

Toate trecerile se fac printr-o singură funcție, care verifică starea de acum. **După ce există o dovadă de sosire sau
a început fereastra de sosire, anularea de către client sau de către local nu mai schimbă plata** (altfel: „anulați din
aplicație și vă dăm 10%”).

### 3.2 Locurile
- **Capacitatea e în persoane pe sloturi de 30 de minute**, cu cât stă o masă (implicit 2 ore, se poate schimba pe ore)
  și **grupul maxim** pe slot. Sau, mai simplu, o listă de mese (de 2, 4, 6, 8).
- Locul se rezervă într-o singură instrucțiune („doar dacă mai e loc”), ca două cereri simultane să nu ia aceeași masă.
- **Un „n-au putut fi primiți” cauzat de capacitatea pe care sistemul o arăta liberă nu contează împotriva localului.**

### 3.3 Răspunsul localului
- **Ceasul merge doar în orele de rezervări ale localului** (implicit, programul lui). La 01:30 nu expiră nimic.
- Rezervare pentru azi: 15 minute (în orele de rezervări). Pentru mâine sau mai târziu: până la 12:00 în următoarea zi
  deschisă. **Clientul vede până când primește răspunsul.**
- **Auto-confirmare implicită pentru grupuri de cel mult 6, cât e loc.** Contractul spune că auto-confirmarea e
  confirmarea localului. Localul o poate opri.
- **Grupurile de 8+ se confirmă mereu de mână.** Recepția poate confirma orice zi, cât e loc.
- Cerere nouă: notificare pe telefoanele din tură; după 10 minute fără răspuns, și proprietarului.
- **Cererea expirată:** clientul vede „Localul n-a răspuns la timp”, telefonul localului și alte locuri. Nu „N-au loc”.
- **3 cereri expirate în 7 zile** opresc singure rezervările CeFaci ale localului, până le pornește iar.

### 3.4 Grupurile mari și conturile false
- **Grupuri de 6+ sau vineri–sâmbătă după 19:00:** doar conturi de cel puțin 14 zile sau cu cel puțin o ieșire
  dovedită. (Localul poate relaxa regula.)
- **Cel mult 2 rezervări viitoare la parteneri pe cont.**
- **Grupurile de 6+ reconfirmă în aplicație** (până la 17:00 în ziua rezervării sau cu 3 ore înainte). Altfel masa se
  eliberează, iar pentru client contează ca anulare târzie.
- **Rezervare pentru altcineva** (părinți, șef): clientul scrie numele celui care vine; în „Sosiri” apare numele și un
  cod de 4 cifre. Aici contează doar dovada localului, și nu se dă nevenire fără „n-au venit” explicit.
- Localul poate trimite mesaje gata scrise („Masa e gata”, „Terasa e închisă azi”) fără să vadă telefonul clientului.

### 3.5 Clienții care nu vin și localurile care anulează
- **Nevenirea se dă doar dintr-un „n-au venit” explicit al localului, necontestat.** Tăcerea localului nu dă nevenire.
- 2 neveniri în 60 de zile: avertisment. 3: 30 de zile fără rezervări și drop-uri la parteneri. Clientul poate cere
  să-i verifice un om (Suport), nu doar sistemul.
- Anularea de către client după termenul localului (implicit 2 ore înainte): jumătate de nevenire.
- **Localul:** dacă „n-au putut fi primiți” plus anulările lui cu mai puțin de 2 ore înainte trec de 5% din
  rezervările lunii, rezervările CeFaci se opresc 7 zile.

### 3.6 Numărul de oameni la rezervare
- Numărul îl dă cel care a rezervat. La scanare îl confirmă; are buton „+1, a mai venit cineva” până la închiderea serii.
- **Creșterea peste numărul confirmat se plătește doar dacă localul o acceptă** („Primiți 9 în loc de 4?”). Altfel se
  plătește cel mult numărul confirmat. Peste 8 e nevoie mereu de acordul localului. Localul poate răspunde „Am primit
  doar N”.

---

## 4. Live Drop

### 4.1 Ce poate pune localul
- Reducere: pentru toți 10–15%; pentru Plus cu cel puțin 5 puncte mai mult, cel mult 30%, și **niciodată mai puțin decât
  reducerea Plus obișnuită a localului din ziua aceea** (altfel un membru Plus ar primi mai puțin luând drop-ul).
- Ceva gratis sau o ofertă de grup.
- **Interzis:** tutun, narghilea, vape (în drop-uri, în reducerea Plus și la „Sponsorizat”).
- **Alcoolul:** orice drop care pomenește alcool are eticheta 18+: nu apare la cei de 16–17 ani, nu poate fi luat de o
  gașcă cu un minor, iar pe ecranul de sosire scrie „18+ · verificați actul”.
- **Consumația minimă de persoană** (opțional), arătată înainte de „Ia oferta”.
- **Ce nu intră în reducere** (implicit): produse deja la promoție, meniul zilei, tutun și narghilea, taxa de serviciu,
  bacșișul, completarea consumației minime la masă. Localul poate adăuga excepții; apar pe card, pe pagina localului și
  pe ecranul de sosire.

### 4.2 Cât și cât de des
- **Cel puțin 4 locuri pe drop.** Cel mult 4 ore. Un singur drop activ pe local; cel mult 12 ore de drop pe săptămână,
  cu cel puțin 2 ore între drop-uri (regulă în baza de date, fără suprapuneri).
- **Plus îl vede cu 10 minute mai devreme.** La un drop „acum”, Plus îl vede acum, ceilalți peste 10 minute.
- Cui se adresează: tuturor sau **„noi prin CeFaci”** = contul (și cei din grup) n-au în ultimele 12 luni check-in,
  bon sau sosire la localul ăsta, inclusiv dinainte de parteneriat.

### 4.3 „Ia oferta”
- Pentru el sau pentru gașcă, cel mult 6 locuri pe o luare. Locurile se scad într-o singură instrucțiune.
- **Nu se poate lua oferta:**
  - dacă el sau cineva din grup are deja azi o sosire sau check-in la local (altfel: oameni deja la masă, coada de la ușă);
  - de la mai puțin de 150 m de local (localul poate permite „și de pe stradă”);
  - din conturile echipei localului sau de pe telefoane logate în Business;
  - dacă are deja o ofertă activă oriunde;
  - cu un cont anonim.
- **Între luare și scanare trebuie să treacă cel puțin 10 minute.**
- Oferta e valabilă până la cel mai devreme dintre: luare + 45 de minute, sfârșitul drop-ului + 15 minute. Se poate lua
  cel târziu cu 15 minute înainte de sfârșit.
- **La scanare cu mai puțini oameni,** locurile rămase se întorc pe loc altora.
- **Grupul minim neîndeplinit** (oferta „de la 4”, au venit 3): oferta nu se aplică; dacă localul o dă totuși, se
  plătește ca drop.
- **Clientul și drop-ul oprit:** dacă localul oprește drop-ul, cine l-a luat rămâne cu el.
- Starea ofertei se schimbă doar dacă e încă activă și neexpirată; job-ul de expirare nu poate întoarce locuri deja
  folosite.

### 4.4 Oferta care expiră
- Clientul e întrebat: „Ai ajuns? Ți-au dat oferta fără scanare?”.
  - „Da” (ți-au dat-o fără scanare): **fără pedeapsă pentru client, un semn la local.** 3 astfel de răspunsuri de la
    oameni diferiți în 30 de zile opresc drop-urile localului 14 zile.
  - „N-am ajuns” sau nimic: ofertă expirată pentru client (2 în 30 de zile = 7 zile fără drop-uri).
- **Au ajuns după expirare:** dacă localul îi primește cu oferta (bifează la închiderea serii), se plătește și nu e
  pedeapsă; dacă nu, nu se plătește și clientul ia jumătate de pedeapsă.
- O ofertă expirată în timp ce telefonul era fără semnal nu e pedeapsă dacă există o sosire.

### 4.5 Reducerea neaplicată la drop
Dacă se confirmă că reducerea nu s-a aplicat: **taxa rămâne** (omul a fost adus), localul primește avertisment, iar
2 cazuri confirmate în 30 de zile opresc drop-urile 30 de zile. Clientul primește o zi de Plus pe loc, ca scuză.
(În v1 taxa se anula, ceea ce răsplătea localul care nu aplică reducerea.)

---

## 5. Sosirea: de unde știm că au venit

### 5.1 Dovezile, pe două niveluri

| Dovada | Cine | Nivel |
|---|---|---|
| Bifat „au venit” de local (la închiderea serii sau pe loc) | localul | **puternică** |
| Ospătarul scanează codul de pe biletul clientului | localul | **puternică** |
| Poza bonului fiscal cu CUI-ul localului și ora în fereastră | clientul | **puternică** |
| Scanare **verificată**: codul localului + telefon verificat (Play Integrity, după ce suntem în Magazin Play) + poziție proaspătă (sub 60 de secunde, precizie sub 50 m, la cel mult 75 m de coordonatele verificate ale localului) + o a doua poziție după cel puțin 15 minute, tot la cel mult 75 m (sau conectat la Wi-Fi-ul localului, dacă localul și l-a înregistrat) | clientul | **puternică** |
| Orice altceva: scanare fără telefon verificat, o singură poziție, check-in cu locația, „Am fost acolo”, răspunsul „da” | clientul | **slabă** |

- **Marja de eroare a GPS-ului nu mai mărește raza** (în v1, cine raporta o precizie mai proastă primea o rază mai mare,
  până la 400 m). Locația simulată doar respinge, nu ajută niciodată.
- **Codul de la bar e unic pe sticker** și se schimbă la 3 luni sau când a fost fotografiat și folosit în altă parte
  (scanări de departe, la ore ciudate).
- Coordonatele localului vin din copia verificată de la parteneriat, nu din telefon.
- În fază 1 (APK fără Magazin Play) nu există „scanare verificată”: dovezile clientului sunt toate slabe, în afară de bon.

### 5.2 Fereastra
- Rezervarea: de la 90 de minute înainte de oră până la 3 ore după. Drop-ul: cât e valabilă oferta (cap. 4.3).
- **Ziua de lucru se schimbă la 05:00** și vine **din ora rezervării sau a luării ofertei**, calculată de o singură
  funcție (nu „+24 de ore”, care greșește în nopțile de schimbare a orei: 25 octombrie 2026, 28 martie 2027).

### 5.3 Închiderea serii (cel mai important lucru nou)
- **Localul închide fiecare rezervare confirmată și fiecare ofertă luată până la 12:00 a doua zi:** au venit (câți,
  reducerea aplicată pentru câți), n-au venit, n-au putut fi primiți, au întârziat.
- Lista vine **pre-completată** din scanări („Andrei · 4 · a scanat 20:07”). Dacă e corect, un singur buton: „Totul e
  corect”. Personalul schimbă doar excepțiile.
- **Cine nu închide:** 3 seri neînchise în 30 de zile opresc rezervările CeFaci până localul închide restanțele.
- Ce rămâne neînchis la 12:00 se hotărăște singur: dovadă puternică de la client → au venit, cu numărul clientului (cel
  mult cel confirmat); dovadă slabă → neclar; nimic → nimic (fără plată, fără nevenire, un semn la local).
- Fără dovadă și fără bifă, clientul e întrebat „Ați ajuns?” cu bon opțional: „da” + bon = puternică; „da” fără bon =
  slabă.

### 5.4 Cine câștigă când nu se potrivesc

| Localul spune | Clientul are | Rezultat |
|---|---|---|
| au venit | orice | **se plătește** (numărul: cap. 5.6) |
| nimic (n-a închis) | puternică | se plătește, cu numărul clientului (cel mult cel confirmat) |
| nimic | slabă | **neclar**: nu se plătește, fără nevenire |
| nimic | nimic | nu se plătește, fără nevenire; semn la local |
| n-au venit | puternică (nu de la local) | **contestată**: nu se plătește până nu hotărăște un admin (în 5 zile lucrătoare); fără hotărâre = nu se plătește, fără nevenire |
| n-au venit | slabă | **neclar** |
| n-au venit | nimic | n-au venit; nevenire pentru client (poate cere verificare la Suport) |

- **Neclarul se numără pe local.** Dacă un local are într-o lună de peste 2 ori mai multe cazuri neclare decât media,
  primește avertisment; dacă se repetă luna următoare, neclarul lui se plătește după numărul clientului (localul poate
  contesta cu dovadă). E scris în contract.
- Mai multe scanări contestate la același local sau de pe același cont: verificare în Admin.

### 5.5 O singură taxă pe seară, și grupul
- **Unitatea plătită e rezervarea sau oferta luată, nu fiecare telefon.** 4 prieteni scanează: o singură sosire;
  fiecare își ia XP-ul și ștampila.
- **Grupul** = cel care a rezervat (sau a luat oferta), oamenii de pe același plan sau bilet de gașcă și cei intrați prin
  linkul lui, la același local, în aceeași zi de lucru. Orice scanare a cuiva din grup se leagă de rezervarea grupului.
- **Rezervare + drop în aceeași seară, același grup:** se unesc la sfârșitul serii (când se știe tot):
  `drop × min(adulți, locuri luate) + rezervare × adulții rămași`, cel mult 10 oameni, și **niciodată mai puțin decât
  rezervarea singură** (altfel un drop de 1 loc „shot gratis” ar șterge taxa unei mese de 10).
- Ordinea: drop > rezervare > Plus/plan (ultimele sunt 0 lei). Cele care pierd rămân în istoric, cu trimitere la sosirea
  care le-a înlocuit.
- O a doua rezervare reală în aceeași zi (brunch și cină) rămâne separată.

### 5.6 Câți au venit
- Pornim de la cel mai mare dintre: numărul confirmat la scanare și numărul de conturi diferite din grup care au scanat.
  **Localul nu poate coborî sub numărul de conturi care au scanat.**
- Localul poate corecta doar până la 12:00 a doua zi, cu motiv. Orice scădere (inclusiv adulți mutați la copii)
  trimite întrebarea „Ați fost 6 sau 4?” **în aceeași seară**, către cel care a rezervat; are 24 de ore.
  - Confirmă: numărul localului. Spune că erau mai mulți: numărul clientului, iar cazul apare în Admin.
  - Nu răspunde: numărul localului, **dar** dacă localul a scăzut numărul la peste 15% din sosirile lui în 30 de zile,
    primește avertisment, iar după aceea tăcerea clientului înseamnă numărul clientului.
- Întrebarea se referă la o versiune a numărului: dacă localul îl schimbă din nou, întrebarea veche nu mai contează.
- Copiii sub 12 nu se plătesc; îi declară clientul la rezervare.

### 5.7 Fără semnal (subsoluri, mall-uri)
- Oferta luată se salvează în telefon semnată de server; scanarea merge și fără internet (codul, ora, ultima poziție bună)
  și se trimite când revine semnalul, cel târziu în ziua de lucru + 12 ore, marcată „fără semnal”. Reducerea apare din
  oferta semnată, cu eticheta „fără semnal”.
- Localurile marcate „semnal slab”: dovada așteptată e bifa localului sau codul de pe bilet; o verificare de locație
  eșuată nu dă niciodată pedeapsă.
- Ce face Business fără internet se trimite mai târziu, dar ora dispozitivului se crede doar în limitele de mai sus.

### 5.8 XP-ul
Sosirea se salvează întâi; XP-ul și ștampila vin după, separat. O eroare la XP (limita pe zi, 20 de minute între
check-in-uri) nu mai poate anula o sosire. XP-ul își schimbă ziua la miezul nopții, banii la 05:00: sunt separate.

---

## 6. Reducerea la masă

### 6.1 Cum o vede ospătarul
- **„Cuvântul serii”:** Business arată personalului, la începutul turei, două cuvinte, noi în fiecare zi pentru fiecare
  local („Lămâie albastră”). Ecranul de sosire al clientului arată aceleași cuvinte **doar după ce serverul a acceptat
  scanarea**. O captură, un video al ecranului unui prieten sau o aplicație modificată nu au cuvântul de azi.
- Pe ecran mai apar: oferta, câte persoane, numărul mesei (scris de client la scanare), ora.
- O singură sosire Plus activă pe cont la 3 ore, de pe telefonul contului.

### 6.2 Un singur procent pe notă
Casa de marcat aplică reduceri pe notă sau pe produs, nu „pe persoană”. De aceea ecranul arată **un singur procent pe
notă**:
- Notă comună: media pe toată masa, rotunjită în jos. 4 oameni cu 20% și 2 cu 15% → **18%**. Drop luat pentru 4, au
  venit 6 → 15% × 4/6 = **10%**.
- Note separate: „−20% pe 4 note, la alegere · −15% pe rest”.
- Asta e definiția „reducerii aplicate” în contract.

### 6.3 Când și pe ce
- **„Arată ecranul înainte să ceri nota.”** După bonul fiscal nu se mai aplică; plângerile cu scanarea după notă nu se
  primesc.
- Clientul primește **cea mai bună** dintre promoția localului și reducerea CeFaci, niciodată pe amândouă.
- Excepțiile implicite sunt cele din cap. 4.1.

### 6.4 Raportul serii
În Business, fiecare drop și fiecare sosire Plus, cu ora, câți, reducerea și cine a fost de serviciu. Localul îl poate
potrivi cu rândurile „Reducere CeFaci” din casa lui (și își prinde ospătarul care trece „reducere CeFaci” pe notele
turiștilor plătite cash).

---

## 7. Plus la localuri

### 7.1 Programul
- **Opțional pentru local.** Alege reducerea (10, 15 sau 20%) și zilele/orele excluse. Ca să apară cu insigna Plus,
  trebuie să dea reducerea cel puțin 3 seri pe săptămână (propunere), altfel insigna ar fi doar reclamă.
- Schimbările se aplică de a doua zi. **„Plus oprit azi”** (o seară plină neașteptată): se poate apăsa până la 16:00,
  de cel mult 4 ori pe lună, și se vede imediat în aplicație.
- **Dreptul la Plus se stabilește la scanare și ține toată vizita** (scanat la 20:30, plătit la 23:00 = Plus).
- Insigna „−15% cu Plus” apare pe rezultate și planuri doar dacă e valabilă la ora planului.
- „Pentru 4 din 6”: membrul și încă trei oameni de la aceeași masă (procentul pe notă: cap. 6.2).
- **Cine are Plus o știe doar serverul.** Starea Plus se salvează pe sosire, așa cum era în clipa aia (un refund Google
  de mai târziu nu rescrie istoria).

### 7.2 Ce se plătește (formularea exactă, pentru contract)
> Vizitele fără rezervare CeFaci și fără Live Drop, inclusiv cele cu reducerea Plus: **0 lei**. Rezervările confirmate
> și Live Drop-urile: tariful treptei, **indiferent dacă clientul are Plus**.

### 7.3 Proba Plus și conturile false
- Proba de 7 zile: o dată pe cont Google/email **și o dată pe telefon** (telefonul verificat, după Magazin Play).
- Conturile anonime nu pot folosi nicio funcție de client.

### 7.4 Plus plătit (faza 2): ce trebuie înainte
- **Întrebăm în scris Google Play** dacă Plus trebuie sau nu prin Google Play: reducerile la localuri sunt servicii
  fizice (Google spune că acestea **nu** se plătesc prin Play), iar Bilu auriu e digital. Propunere: Bilu și carnetul
  auriu devin insigna de membru, nu un „beneficiu vândut”. Răspunsul schimbă și banii: prin Play ~14 lei din 20;
  direct (Netopia/Stripe), ~19 lei.
- **Plus plătit doar de la 18 ani.** Informațiile dinainte de cumpărare (preț cu taxe, reînnoire, cum anulezi, cine
  vinde), dreptul de retragere de 14 zile, butonul de retragere cerut din 19 iunie 2026 (de verificat cum e transpus).
- Textul „nu-ți luăm nimic automat” e adevărat azi (proba), dar devine fals cu un abonament care se reînnoiește: se
  schimbă în „se reînnoiește lunar până anulezi” sau se vinde o lună fără reînnoire.
- Nu se încasează nimic până nu există parteneri reali, iar lista lor se vede înainte de cumpărare.

### 7.5 „Nu mi s-a aplicat reducerea”
- Se primește **în 24 de ore**, doar dacă există o scanare Plus valabilă **înainte de notă**.
- **Se numără pe vizită, nu pe om:** doi prieteni de la aceeași masă = o singură plângere.
- Localul poate răspunde; o poză a bonului cu rândul de reducere închide plângerea.
- **Clientul:** o zi de Plus pe loc, ca scuză; 7 zile doar dacă plângerea e confirmată de un om din echipă, cel mult o
  dată la 60 de zile, date „sub cheie” (două plângeri simultane nu dau de două ori). Pentru un abonat plătitor, zilele
  se dau amânând următoarea plată; dacă se repetă, i se întoarce luna. E un gest de scuză, nu înlocuiește drepturile
  legale.
- **Localul:** avertisment la prima plângere confirmată; 2 confirmate (de la vizite diferite) în 30 de zile → iese din
  Plus 30 de zile.
- Nu mută nimeni bani între local și client.

---

## 8. Banii

### 8.1 Tarifele

| Treapta localului (de persoană) | Rezervare | Live Drop | Fondator: rezervare / Live Drop |
|---|---|---|---|
| Sub 50 lei | 2 lei | 3 lei | 1 / 2 lei |
| 50–150 lei | 5 lei | 7 lei | 4 / 6 lei |
| Peste 150 lei | 8 lei | 10 lei | 7 / 9 lei |

Fără TVA (cap. 15.3). Tarifele au versiuni, cu data de la care sunt valabile; un tarif nou intră în vigoare cel mai
devreme la 30 de zile după ce e creat și doar cu o versiune nouă de contract. Nu atinge nimic din trecut.

### 8.2 Ce se plătește, într-o propoziție
Pentru fiecare rezervare confirmată sau ofertă luată care a ajuns „au venit”: **tariful zilei × adulții plătiți**, unde
adulții plătiți sunt cei veniți, cel mult 10, iar la drop cel mult câte locuri s-au luat și doar cei care au primit
reducerea. Câți au primit reducerea scrie localul la închiderea serii; dacă scrie mai puțini decât au venit, clientul
e întrebat „Ți s-a aplicat reducerea?”. Dacă reducerea a fost refuzată cuiva care o voia, se plătesc toți (cap. 4.5);
dacă unii n-au consumat nimic (au băut doar apă, au plecat), se plătesc doar cei cu reducere.
- **Propunere (de hotărât):** același om care rezervă sau ia oferta la același local se plătește **de cel mult 3 ori în
  12 luni**; de la a 4-a vizită e 0 lei.

### 8.3 Fondatorii
- **Prețul de fondator = cel mai mic dintre tabelul de fondator și tariful obișnuit de atunci minus 1 leu.** Dacă
  tarifele scad, fondatorul nu rămâne mai scump.
- „Pe viață” înseamnă **cât timp rămâi partener**. Tarifele lui sunt înghețate pe local în ziua în care primește statutul.
- **Fără abonament, pentru fondatori, la ce există azi:** rezervările, Live Drops, Sosiri, Echipa și statisticile de bază.
- Biletele nu intră în promisiunea de fondator până nu alegem cum se vând (cap. 15.7).
- Dacă CeFaci devine plătitoare de TVA, TVA-ul se adaugă (clauza din cap. 15.3); asta nu e o schimbare de preț.

### 8.4 Treapta
- **Formula, în contract:** mediana (totalul bonului înainte de reducerea CeFaci ÷ adulții de pe bon), pe ultimele 6
  luni, din cel puțin 30 de bonuri. Bonurile puse de oamenii care au împărțit nota nu se împart la tot grupul.
- **Până sunt 30 de bonuri:** coșul tip: restaurant = fel principal + suc + cafea; bar = 2 băuturi ale casei;
  cafenea = cafea + prăjitură (din meniu).
- **Revizuirea:** cel mult o dată la 6 luni; treapta se schimbă doar dacă localul e cu peste 10% dincolo de limită la
  două revizuiri la rând, câte o treaptă; cu 30 de zile înainte, cu cifrele arătate și o contestație. Nu se aplică înapoi.
- Opțional mai târziu: treaptă de zi (înainte de 17:00), pentru localurile cu prânz ieftin și cină scumpă.

### 8.5 Viața unei taxe
1. **Sosirea are o zi de închidere** (`finalize_at`): cel mai târziu dintre 12:00 a doua zi (închiderea serii) și
   termenul întrebărilor pentru client, **dar niciodată după ziua de lucru + 48 de ore**. Orice întrebare are termen și
   un răspuns implicit (cap. 5).
2. La ziua de închidere, un job scrie **o singură taxă** pentru sosire (sau nimic, dacă nu se plătește) și, în aceeași
   tranzacție, o marchează definitivă. Dacă nu poate calcula (lipsește treapta), pune sosirea „blocată” și trimite alertă.
   O sosire contestată primește taxa abia după hotărârea adminului.
3. **Taxa ține minte tot ce a folosit:** firma (CUI-ul valabil în ziua aceea), treapta, tariful, versiunea contractului,
   versiunea regulilor (setările de pornire au și ele versiuni), perioada gratuită, oamenii plătiți, suma.
4. **Stări:** de facturat → în listă → facturată; sau **anulată** (cu motiv) sau **gratuită** (în lunile gratuite).
   Contestația se ține separat, nu ca stare.
5. **Înainte de factură:** o greșeală se îndreaptă cu corecție sau anulare. **După factură:** doar factură de stornare
   (parțială, care trimite la factura inițială) și, dacă e cazul, una nouă. Nu se fac corecții pe taxe facturate (altfel
   s-ar scădea de două ori).

### 8.6 Lunile gratuite, exact
- **Încep în ziua de lucru a activării.** Se salvează o dată, cu început și sfârșit, și se arată localului.
  Sfârșitul: aceeași zi a lunii, 3 luni mai târziu; dacă ziua nu există (31 → 30 aprilie), ultima zi a lunii.
- **Prelungirea** (doar fondatori): dacă în cele 3 luni n-a venit nimeni plătibil, gratuitatea ține până la prima sosire
  plătibilă, inclusiv, cel mult 3 luni. Sfârșitul se fixează abia când toate sosirile dinainte sunt definitive.
- În lunile gratuite **serviciul e gratuit**, nu „iertat” (fără datorie, fără factură, fără venit). Localul vede „ai fi
  plătit X lei”, doar informativ. Verificarea de noapte se asigură că nicio taxă gratuită nu ajunge pe o factură.
- O schimbare a perioadei gratuite nu atinge luni deja închise și cere al doilea om (cap. 8.9).
- **Luna de probă:** în lunile gratuite rulăm tot ciclul: lista, contestațiile și o „factură de 0 lei” cu „ai fi plătit
  X”. Așa vede localul exact ce va primi și găsim greșelile înainte de primul leu.

### 8.7 Luna
Toate orele sunt ora României; zilele lucrătoare țin cont de sărbătorile legale.

| Când | Ce |
|---|---|
| **Ziua 3, 09:00** (după ce s-au închis toate sosirile lunii) | **Lista lunii** pentru fiecare firmă și local: taxele definitive care nu sunt încă pe nicio listă, din zilele de lucru de până la sfârșitul lunii. Una pe local și lună (regulă în baza de date). Pleacă în Business și pe email, iar o copie a ei rămâne înghețată. Pe listă oamenii apar ca „Rezervare #4821 · 4 pers.”, nu cu nume. |
| **3 zile lucrătoare** de la trimiterea listei | Contestații, cu motiv, pe rând. Un rând contestat nu oprește restul. |
| **Ziua lucrătoare de după** | **Factura** pentru rândurile necontestate și pentru contestațiile deja hotărâte. Contestațiile se hotărăsc în 5 zile lucrătoare: cele respinse intră pe factura următoare (cu luna serviciului scrisă), cele acceptate se anulează. |
| **Factura + 15 zile** (mutat pe zi lucrătoare, numărat de la validarea ANAF) | Termenul de plată. |
| **După termen** | Amintiri la +3 și +7 zile. Cap. 8.8. |

- **Fără prag de 30 de lei** (propunere; e-Factura nu costă nimic pe factură, iar o sumă care se tot amână nu se mai
  facturează niciodată). Dacă contabilul preferă pragul: pe firmă, nu pe local, cel mult 3 luni, mereu în decembrie și
  la ieșire, și se reportează taxele, nu suma.
- Taxele unei sosiri hotărâte târziu (o contestație) intră pe prima listă de după ce sunt definitive, cu data lor.
- Job-urile rulează la fiecare oră și fac ce e „de făcut” după ora României, ținând minte ce au făcut (fiecare rulare o
  singură dată pe perioadă). Un job pierdut se recuperează singur la următoarea oră.
- Lista se face într-un singur pas (taxele se leagă de listă și totalul se ia din rândurile legate), cu lacăt pe local,
  ca o taxă scrisă în aceeași clipă să nu fie nici pierdută, nici numărată de două ori.

### 8.8 Factura, plata, întârzierea
- **Factura se face printr-un serviciu cu e-Factura** (Oblio, SmartBill sau FGO; de ales). O factură pe firmă pe lună,
  cu rânduri pe local și luna serviciului.
- **Fără facturi duble:** întâi scriem factura la noi („de trimis”, cu un cod al nostru, pus și în notele facturii),
  apoi o trimitem serviciului. Dacă nu răspunde, starea e „necunoscut” și **căutăm întâi factura la serviciu**; nu
  retrimitem niciodată orbește.
- Stările facturii: de trimis → emisă (număr) → trimisă la ANAF → **validată** sau **respinsă** → plătită parțial →
  plătită; stornată. O factură respinsă de ANAF n-a existat. Termenul de plată pornește de la validare.
- Factura păstrează o copie a datelor firmei din ziua emiterii; XML-ul și semnătura ANAF se arhivează la noi (ANAF le
  ține doar ~60 de zile).
- **Plata:** transfer bancar, cu numărul facturii. Extrasul de cont se încarcă și se potrivește (o plată = o referință
  bancară, se poate împărți pe mai multe facturi). Plățile parțiale acoperă întâi rândurile cele mai vechi.
- **Întârzierea:** rezervările și drop-urile se opresc **doar pentru sume necontestate de cel puțin 30 de lei,
  întârziate 30 de zile**, după un anunț cu 72 de ore înainte și cu motivul scris. Un ordin de plată încărcat amână
  oprirea 5 zile. Se opresc doar localurile cu rânduri neplătite. Oprirea o pune doar sistemul (localul nu o poate
  scoate) și se ridică singură la plată. Rezervările confirmate și ofertele luate rămân valabile și se plătesc.
- Dobânda legală și cei 40 € pe factură întârziată (Legea 72/2013): propunere, scriem în contract că **renunțăm la ele**
  la început.

### 8.9 Patru ochi
**Orice acțiune care micșorează ce plătește un local** (o contestație acceptată, o corecție, o taxă anulată, o schimbare
de perioadă gratuită, o treaptă coborâtă, o hotărâre Plus care anulează o taxă, o sosire modificată de admin) **o
propune un om și o aprobă altul**, cu rol de bani. Baza de date nu lasă pe nimeni să-și aprobe singur propunerea. Pragul
se adună pe local și lună (nu se poate ocoli cu corecții de 99 de lei). Cât timp echipa e doar Cornel, al doilea om e
**contabilul extern**, cu rolul Contabil (vede doar banii, nu caută clienți).

### 8.10 Verificări de noapte
După ce s-au terminat celelalte job-uri, pe o copie consistentă a datelor:
- fiecare sosire plătibilă are exact o taxă; nicio taxă fără sosire; nicio taxă pe două facturi active;
- suma rândurilor = totalul fiecărei liste și facturi; nicio taxă gratuită pe o factură;
- fiecare taxă se recalculează din valorile pe care le-a ținut minte (nu din setările de azi) și se compară;
- facturile noastre se compară cu lista serviciului de facturare, plățile cu extrasul.

Orice nepotrivire pune **doar localul respectiv** deoparte (restul firmei se facturează), deschide o alertă cu stare
(deschisă / rezolvată, de cine) și trimite mesaj în Admin. **Mai bine o factură întârziată decât una greșită.**

### 8.11 Exemple de calcul (devin teste automate)

| Situația | Calcul | Sumă |
|---|---|---|
| Restaurant (treapta din mijloc), rezervare pentru 6, au venit 4 | 4 × 5 lei | **20 lei** |
| Același, fondator | 4 × 4 lei | **16 lei** |
| Cafenea, drop luat pentru 3, au venit 3, toți cu reducere | 3 × 3 lei | **9 lei** |
| Drop luat pentru 4, au venit 6 | min(6, 4) × 7 lei | **28 lei** |
| Drop pentru 4, au venit 4, doi n-au comandat nimic (clientul confirmă) | 2 × 7 lei | **14 lei** |
| Drop pentru 4, au venit 4, localul n-a dat reducerea la 2 care au cerut-o | 4 × 7 lei + avertisment | **28 lei** |
| Rezervare pentru 14 adulți și 2 copii, au venit toți, localul a acceptat 14 | min(14, 10) × 5 lei | **50 lei** |
| Rezervare confirmată pentru 4, la scanare „suntem 9”, localul n-a acceptat | min(9, 4) × 5 lei | **20 lei** |
| Rezervare pentru 10 + drop „shot gratis” de 1 loc, același grup | 1 × 7 + 9 × 5 = 52 ≥ 50 | **52 lei** |
| Rezervare pentru 6 la 20:00 + drop pentru 4 la 22:00, același grup, 6 oameni | 4 × 7 + 2 × 5 | **38 lei** |
| Rezervare confirmată, n-a venit nimeni | — | **0 lei** |
| Localul n-a închis seara, clientul are doar check-in cu locația | neclar | **0 lei** |
| Localul: „n-au venit”; clientul: bon cu CUI-ul localului la 20:40 | contestată → adminul hotărăște | după hotărâre |
| Localul scade 6 → 4, clientul nu răspunde | 4 × tarif | după tarif |
| A 4-a rezervare a aceluiași om la același local în 12 luni (dacă se aprobă) | — | **0 lei** |
| Au întârziat, n-au mai fost primiți | — | **0 lei** |
| Lunile gratuite, 30 de oameni la treapta din mijloc | gratuit, „ai fi plătit 150 lei” | **0 lei** |
| Sosire la 01:30, în noaptea 31 octombrie → 1 noiembrie | ziua de lucru 31 octombrie, lista lui octombrie | — |
| Sosire contestată în octombrie, hotărâtă pe 12 noiembrie | intră pe lista din decembrie, cu „serviciu: octombrie” | după tarif |
| Vizită cu reducerea Plus, fără rezervare și fără drop | — | **0 lei** |

---

## 9. Business: cine ce poate face

| | Proprietar | Manager | Recepție | Scanare |
|---|---|---|---|---|
| Azi, Sosiri, cuvântul serii | da | da | da | doar Sosiri și scanerul |
| Confirmă, refuză, mută rezervări | da | da | da (orice zi, cât e loc) | nu |
| Închiderea serii, numărul de oameni | da | da | da | doar la scanare |
| Live Drops, oferte, programul Plus, „Plus oprit azi” | da | da | nu | nu |
| Profilul localului | da | nu | nu | nu |
| Echipa | toți | doar Recepție și Scanare | nu | nu |
| Plăți: lista lunii, facturile | da | le vede și contestă | nu | nu |
| Datele firmei, contractul, ieșirea | doar cine a semnat pentru firmă | nu | nu | nu |

- **Ce face personalul într-o seară (pagina de o foaie pentru local, maximum 3 lucruri):**
  1. Confirmă cererile (sau le lasă pe auto-confirmare).
  2. Când vine un client CeFaci: verifică **cuvântul serii** pe ecranul lui și aplică procentul pe notă **înainte** de nota de plată.
  3. La sfârșitul serii sau a doua zi până la 12:00: **„Închide seara”** (de obicei un singur buton, „Totul e corect”).
- **Angajații fără email:** proprietarul sau managerul face un cod de invitație (cel puțin 10 caractere, câteva
  încercări, expiră în 48 de ore); proprietarul aprobă telefonul nou. Contul angajatului e legat de rol. Managerul poate
  relega același om dintr-un buton (telefon nou), fără cod nou.
- **Business se instalează pe ecranul telefonului** (altfel, pe iPhone, Safari șterge datele după ~7 zile fără vizită).
- **Tabletă comună la recepție:** mod „dispozitiv comun”, fiecare angajat are un PIN de 4 cifre cerut la fiecare acțiune,
  ca jurnalul să știe cine a făcut-o.
- **Accesul ține cât tura + 2 ore** (o tură „până la 24:00” cu servire până la 02:00 nu mai rămâne fără acces).
- **Ce vede un angajat despre client:** prenumele (sau numele scris la „rezervare pentru altcineva”), câte persoane,
  oferta, un cod. Niciodată telefonul, emailul sau istoricul de neveniri (vezi cap. 14).
- Scoaterea din echipă: acces închis pe loc; angajatul nu se șterge, se dezactivează (jurnalul rămâne cu numele lui).

**Ecranele** (din canvasul Business, cu schimbările):
- **Azi:** cererile, programul pe ore, cuvântul serii, drop-ul activ, ultimele sosiri, „opresc rezervările azi”.
- **Rezervări:** lista, setările (capacitatea pe sloturi, durata mesei, grupul maxim, auto-confirmare, ore de rezervări).
- **Sosiri / Scanner** și **Închide seara** (înlocuiește „Închide masa” cu suma notei din canvas).
- **Oferte și Live Drops:** bara de reducere în limite, excepțiile, consumația minimă, 18+.
- **Raportul serii** (cap. 6.4).
- **Profil:** codul QR de printat (unic pe sticker), Wi-Fi-ul localului (opțional), „semnal slab” (opțional).
- **Echipă.** **Statistici** (doar cifre adunate, fără grupuri sub 5 oameni).
- **Plăți:** lista lunii (cu „ai fi plătit” în lunile gratuite), contestațiile, facturile, treapta cu cifrele ei,
  tarifele, „fără TVA”. Canvasul „Plăți” (5% din bon) se schimbă înainte să-l vadă vreun local.

---

## 10. Admin: ce face echipa CeFaci

| Rol | Ce poate face |
|---|---|
| **Fondator** | tot; dă statutul de fondator; aprobă (ca al doilea om) micșorările |
| **Admin** | cereri de parteneriat, parteneri, sosiri contestate (propune), locuri, semnalări, echipa (editori, moderatori, suport) |
| **Contabil** | listele, facturile, plățile, extrasele, întârzierile; propune sau aprobă micșorări (nu pe ale lui); nu caută clienți |
| **Editor** | locuri: modifică, adaugă, ascunde; cereri de locuri noi |
| **Moderator** | semnalări, poze puse de localuri, plângeri Plus (propune), blocarea unui cont de client |
| **Suport** | răspunde oamenilor, verifică o nevenire la cerere, dă o zi de Plus (cel mult; restul cu aprobare); tot ce dă rămâne în jurnal |

**Ecranele:**
1. **Acasă:** ce e de rezolvat azi (cereri, contestații, alerte de bani, facturi întârziate, localuri cu multe cazuri
   neclare sau seri neînchise) și cifrele reale.
2. **Cereri de parteneriat:** ANAF, certificatul constatator, cine semnează și dovada dreptului, apelul la local,
   disputele de proprietate, preluările.
3. **Parteneri:** treapta (cu cifrele și istoricul), fondator (nr. 1–20), perioada gratuită (de când până când),
   starea, echipa, contractul acceptat, firma pe istoric.
4. **Locuri** și **Semnalări** (există deja).
5. **Sosiri:** contestate, neclare, „n-au putut fi primiți”, diferențe de număr, seri neînchise, statistica pe local.
6. **Bani:** listele, contestațiile, facturile (cu starea la ANAF), plățile și extrasele, întârzierile, propunerile de
   micșorare de aprobat, alertele verificărilor.
7. **Plus:** plângerile, avertismentele, zilele date.
8. **Sugestii de parteneri** (de ținut minte de pe 06.10): localurile nepartenere cu cele mai multe ieșiri și bonuri
   din CeFaci, cu textul gata pentru local. Primul contact cu localul: în persoană sau la telefon.
9. **Oameni:** căutare după @username sau email, nevenirile cu motivul, verificarea la cerere, blocarea. Doar cât trebuie.
10. **Echipa** și **jurnalul**.

---

## 11. Ce se schimbă în aplicația de client

1. **Pagina localului** (Detalii, făcută), doar la parteneri: „Rezervă prin CeFaci”, drop-ul activ, „−15% cu Plus”
   (doar dacă e valabil la ora aleasă), „Partener”. **Locul în recomandări nu se schimbă.**
2. **Rezervarea:** ziua și ora (sloturile pline tăiate), adulți și copii, „pentru altcineva”; până când răspunde
   localul; REZERVAT / altă oră (15 minute să accepți) / refuzată / „n-a răspuns la timp” + telefonul; reconfirmarea
   pentru grupuri de 6+; anularea.
3. **Live Drops:** rândul de pe Acasă și ecranul cu toate; „Ia oferta” (pentru mine sau gașcă, cel mult 6), cu ceas,
   consumația minimă, ce nu intră în reducere, 18+.
4. **„Am ajuns”:** scanarea codului (și numărul mesei); „Nu găsesc codul” face check-in cu locația (dovadă slabă);
   ecranul de sosire cu **cuvântul serii**, procentul pe notă și „Arată-l înainte să ceri nota”. Funcționează și fără
   semnal (cap. 5.7).
5. **După ieșire:** „Ați fost 6 sau 4?” (doar dacă localul a scăzut); „Ți s-a aplicat reducerea?”; „Ați ajuns?” (cu
   bon) când localul n-a închis seara; „Ai ajuns? Ți-au dat oferta fără scanare?” la o ofertă expirată; „Cum a fost?”.
6. **Plus vine de pe server.**
7. **Avertismentul de neveniri**, cu „Cere verificare”.
8. **Bonul se păstrează** fără cont (cap. 14): local, zi, total, câți oameni, totaluri pe grupe (mâncare / băutură).
   Fără produsele pe rând, fără textul citit, fără bonurile celor de 16–17 ani.

---

## 12. Notificări

| Cine | Când |
|---|---|
| **Localul** | cerere nouă (echipa din tură; după 10 minute, și proprietarul); sosire (live); drop luat; seara de închis (la 10:00 a doua zi, dacă e neînchisă); contestație hotărâtă; lista lunii; factura; amintirile de plată; anunțul de oprire cu 72 de ore înainte |
| **Clientul** | confirmat / refuzat / altă oră / n-a răspuns la timp; reconfirmă (grupuri de 6+); oferta expiră în 10 minute; întrebările de după (cap. 11.5); avertismentul de neveniri |
| **Admin** | cerere de parteneriat; sosire contestată; alertă de bani; factură respinsă de ANAF; factură întârziată; local cu multe cazuri neclare, seri neînchise sau scăderi de număr |

---

## 13. Cum ar putea trișa cineva și ce îl oprește

| Cine | Ce | Ce îl oprește |
|---|---|---|
| Local | scade numărul de oameni | nu sub conturile care au scanat; doar până la 12:00, cu motiv; întrebarea în aceeași seară; peste 15% scăderi → tăcerea clientului îi dă dreptate clientului |
| Local | „n-au venit”, deși au venit | bonul fiscal sau scanarea verificată → contestată → admin; tiparele pe local |
| Local | nu închide seara, nu scanează („sunteți pe listă”) | 3 seri neînchise → rezervările se opresc; dovada puternică a clientului se plătește; neclarul se numără și, după avertisment, se plătește |
| Local | dă reducerea fără scanare ca să nu plătească drop-ul | întrebarea la oferta expirată; 3 răspunsuri → drop-urile oprite 14 zile |
| Local | nu dă reducerea, ca să i se anuleze taxa | taxa rămâne; avertisment; 2 cazuri → drop-uri oprite 30 de zile |
| Local | un drop de 1 loc ca să șteargă taxa unei mese de 10 | taxa unită nu scade sub rezervare; cel puțin 4 locuri pe drop |
| Local | își ia singur drop-urile ca să stea „plin” pe Acasă | conturile echipei și telefoanele din Business nu pot lua; drop-urile care expiră des coboară |
| Local | „n-au putut fi primiți” după ce au stat 2 ore | doar în 30 de minute de la scanare; clientul e întrebat; peste 5% → rezervările oprite 7 zile |
| Local | plătește pentru clienții lui vechi | oferta nu se poate lua de cine e deja la masă sau la ușă; „noi prin CeFaci” pe 12 luni; propunerea de 3 vizite plătite pe an |
| Local | declară că e mai ieftin | treapta din formula din contract, din bonuri |
| Local | trece adulți la copii | copiii îi declară clientul; orice scădere îl întreabă |
| Local | firmă nouă pentru luni gratuite | lunile gratuite sunt pe loc, 24 de luni; datoriile rămân pe loc la preluare |
| Local | contestă tot ca să amâne plata | rândurile cu dovadă puternică se contestă doar pentru număr greșit sau local greșit, cu dovadă; hotărâre în 5 zile; peste 30% contestații respinse 2 luni → dovadă obligatorie la contestație 3 luni |
| Local | ospătarul trece „reducere CeFaci” pe nota cash a turiștilor | raportul serii arată fiecare reducere adevărată |
| Client | scanare falsă de acasă (aplicație modificată, poză a codului) | dovezile clientului sunt slabe fără telefon verificat și a doua poziție; slab nu bate „n-au venit”; codul unic pe sticker se schimbă |
| Client | ecran Plus sau drop fals (video, captură) | cuvântul serii; o sosire Plus la 3 ore, de pe telefonul contului |
| Client | împrumută contul Plus | o sosire Plus la 3 ore; numărul mesei |
| Client | conturi noi pentru probe Plus sau ca să ocolească limitele | o probă pe cont și pe telefon; fără conturi anonime; vechimea contului la grupuri mari |
| Client | ia oferte și nu vine | o ofertă deodată; 2 expirate → 7 zile fără drop-uri |
| Client | rezervă și nu vine | nevenire doar din „n-au venit” explicit; 3 → 30 de zile; reconfirmarea grupurilor mari |
| Client | „nu mi s-a aplicat” ca să ia Plus | doar cu scanare înainte de notă, în 24 de ore; o zi pe loc, 7 doar confirmat, o dată la 60 de zile |
| Client | doi prieteni se plâng ca să scoată localul din Plus | plângerile se numără pe vizită |
| Concurență | rezervări false la un rival | vechimea contului la grupuri mari și seri de vârf; 2 rezervări viitoare pe cont; reconfirmarea |
| Concurență | ia toate locurile unui drop | cel mult 6 pe luare, o ofertă deodată, fără conturi anonime |
| Angajat CeFaci | mută bani | patru ochi pe orice micșorare, pragul adunat pe lună; jurnal care nu se poate modifica; facturile nu se modifică |
| Oricine | cheia publică din APK | nicio funcție deschisă pentru ea (testat automat) |

---

## 14. Date personale (GDPR)

- **Politica de confidențialitate și termenii pentru clienți trebuie rescriși ACUM** (înainte de Magazin Play, nu doar
  înainte de Business): spun că locația „rămâne pe telefon”, dar check-in-ul trimite poziția la server; spun că se poate
  folosi fără cont, ceea ce nu mai e adevărat; nu pomenesc destinatarii (localurile partenere, Firebase/FCM, Resend,
  serviciul de facturare) și nici scopurile (dovada sosirii, anti-fraudă, neveniri, bonuri, „clienți noi”). Formularul
  „Siguranța datelor” din Google Play trebuie să spună același lucru.
- **Un tabel pe funcție:** ce date, de ce, pe ce temei, cât timp, cine le primește. Plus o notă separată pentru
  patroni și angajați.
- **Localul vede:** prenumele, câte persoane, oferta, un cod. **Nu vede numărul de neveniri** al clientului (ar fi o
  listă neagră comună); CeFaci aplică pedepsele central, iar clientul poate cere verificare de un om.
- **Poziția:** pentru dovadă se păstrează doar distanța, precizia și verdictul, nu coordonatele.
- **Contul șters:** profilul dispare; sosirile, taxele și bonurile rămân **fără cont** (legea contabilității cere
  documentele firmei, nu identitatea clientului). Nimic din tabelele de bani sau din jurnale nu se mai șterge în lanț
  (acum ștergerea contului șterge tot ce e legat de el: de schimbat înainte de Business). Listele lunii folosesc coduri,
  nu nume.
- **Bonurile:** fără cont, doar totaluri pe grupe, fără textul citit (poate avea numele casierului, cifre de card, CNP),
  fără bonurile celor de 16–17 ani; Google Vision prin serverul din UE (`eu-vision.googleapis.com`). Înainte de a
  porni păstrarea: anunț în politică și evaluarea interesului legitim.
- **Angajații localurilor:** în termenii pentru parteneri, un acord de prelucrare (CeFaci prelucrează datele echipei
  pentru local); angajatul vede o notă scurtă la prima intrare; legarea de telefon se face cu o cheie făcută de
  aplicație, nu cu id-uri de reclamă.
- **Documentele de verificare:** cap. 2.2.
- **Evaluarea de impact (DPIA)** înainte de lansarea Business (locație, minori de 16–17 ani, scoruri, bonuri, date
  date localurilor), registrul prelucrărilor și acordurile cu furnizorii (Supabase, Google, Resend, PostHog, Cloudflare,
  serviciul de facturare).

---

## 15. Firma, contractele, taxele (de confirmat cu contabilul și cu un jurist)

1. **SRL înainte de primul contract cu un local.** Contractele de fondator se acceptă cu ~3 luni înainte de prima
   factură, iar taxele se scriu din prima zi. Un om fără firmă nu poate face activitate plătită (Legea 12/1990), un
   contract semnat ca persoană fizică nu trece la SRL fără acordul fiecărui local, iar adresa de acasă ar deveni
   publică (Google Play cere datele comerciantului). Totul pe SRL: contractele, politicile, contul de dezvoltator Play,
   plățile. Construitul aplicației ca persoană fizică e în regulă.
   - Impozit: cu 0 angajați, impozit pe profit 16% (bun cât suntem pe pierdere); microîntreprinderea cere un angajat
     (de verificat regulile din 2026).
   - Înainte de prima factură: cont bancar în lei, înregistrarea fiscală, codul de TVA art. 317, acces SPV cu semnătura
     electronică a administratorului, serviciul de facturare cu e-Factura și serie, contabil, arhivă.
2. **e-Factura:** fiecare factură către o firmă (și către PFA/II) se urcă în 5 zile (de verificat calendaristice sau
   lucrătoare). Originalul legal e XML-ul din SPV. Stornările sunt facturi separate, care trimit la factura inițială.
3. **TVA:** nu suntem plătitori sub prag (de verificat: probabil 300.000 lei din septembrie 2025, nu 395.000). **Codul
   art. 317 imediat după înființare** (Google Cloud plătit din 3.11.2026, Supabase, Play, Meta, Resend…), trecut în
   conturile furnizorilor, declarația 301 lunar, 21% în plus la serviciile din străinătate. În contract: „Tarifele nu
   includ TVA. CeFaci nu este în prezent înregistrată în scopuri de TVA; dacă devine, TVA se adaugă la cota legală.” În
   Business: „fără TVA”. Prețul Plus de 20 lei rămâne cu TVA inclus.
4. **Regulamentul european P2B (2019/1150)** se aplică oricât de mici suntem. Termenii pentru parteneri trebuie să aibă:
   limbaj clar, mereu la îndemână; motivele de oprire sau restrângere (neplata, ieșirea din Plus, contestațiile fără
   temei); anunț cu cel puțin 15 zile (noi dăm 30) și dreptul de a pleca; motive scrise la orice oprire; 30 de zile la
   încetarea de către noi; **cum ordonăm recomandările** (parteneriatul nu le schimbă; „Sponsorizat” separat și marcat);
   ce date vede fiecare parte; nimic retroactiv; licența pentru pozele și meniul localului. Pentru clienți: o pagină
   „Cum alegem recomandările” și eticheta „Sponsorizat”. Pentru conținutul pus de localuri: cum se raportează, motive
   scrise la ștergere, un contact.
5. **Contractul acceptat cu un clic e valabil între firme,** cu regulile din cap. 2.3 (cine semnează, clauzele
   speciale acceptate separat, clauza de dovadă).
6. **Plus prin Google Play sau direct:** de întrebat Google în scris (cap. 7.4). Același lucru pe Apple.
7. **Biletele (faza 3):** un singur model: procesator autorizat (Stripe Connect cu plata direct la local sau plata
   împărțită Netopia), **localul e vânzătorul**, comisionul nostru e o taxă facturată localului. Biletul spune „vândut în
   numele și pe seama organizatorului”. Fără compensarea facturilor din banii de bilete. Prețul total (cu taxa de
   serviciu) arătat de la început; la anulare, banii înapoi.
8. **Reducerile din drop-uri (10–15%, Plus până la 30%)** se prezintă ca formatul produsului Live Drop; localul e liber
   să dea orice reducere în afara CeFaci. Înainte să creștem: o părere de la un specialist în concurență.
9. **Google Maps:** „Bine cotat” (din notele Google) și „Verificat acum pe Google” trebuie verificate cu regulile Google
   Maps Platform (ce avem voie să păstrăm și cum se citează).
10. **Cât păstrăm documentele:** cât spune contabilul (de obicei 5–10 ani pentru documentele de contabilitate).

---

## 16. În ce ordine construim

**Faza 0, înainte de primul contract cu un local (nu e cod):**
- SRL-ul și contul bancar; contabilul; codul art. 317.
- Termenii pentru parteneri și politica de confidențialitate (clienți + parteneri), scrise după documentul ăsta și
  văzute de un jurist; formularul de siguranță a datelor din Google Play.
- Prezentarea pentru localuri și exersarea rescrise după documentul ăsta, cu pagina „Ce face personalul” (3 lucruri);
  fără cifre de treaptă spuse din gură; canvasul Business „Plăți” și „Închide masa” schimbate.
- Întrebarea scrisă către Google Play despre Plus.

**Faza 1, ca să lansăm cu primii 5–10 parteneri:**
- Baza de date: schema `billing`, drepturile (gata pe 06.10), sosirile cu dovezi, închiderea serii, taxele scrise din
  prima zi, toate regulile de mai sus ca reguli în baza de date, cu testele din cap. 8.11 și Anexa A.
- Admin: cereri de parteneriat (cu cine semnează), parteneri, treapta, fondatori, perioade gratuite, sosiri contestate,
  echipa, jurnalul.
- Business: intrarea, revendicarea, contractul cu clauzele separate, profilul și codul QR, echipa cu coduri și PIN,
  rezervările, Sosiri, cuvântul serii, Închide seara, Live Drops, programul Plus, raportul serii, statistici simple,
  Plăți cu „ai fi plătit” și luna de probă.
- Client: rezervarea la parteneri, Live Drops, „Am ajuns” cu cuvântul serii, întrebările de după, Plus de pe server,
  bonul păstrat fără cont.

**Faza 2, gata înainte de luna a 4-a a primului fondator:** factura prin serviciul cu e-Factura (cu căsuța de ieșire și
verificarea la serviciu), plățile și extrasele, întârzierile, patru ochi, verificările de noapte, Play Integrity
(scanarea verificată), Plus plătit (după răspunsul Google).

**Faza 3:** biletele, „Sponsorizat”, uneltele Business cu abonament (nu pentru ce au fondatorii azi).

**Unde stau:** două site-uri din același cod (de exemplu business.cefaci.ro și admin.cefaci.ro); găzduirea gratuită
(Cloudflare Pages, Netlify sau Vercel) cere un cont făcut de Cornel.

---

## 17. Ce trebuie să hotărască Cornel

**Mari (schimbă banii sau vânzarea):**
1. **Cel mult 3 vizite plătite pe an de același om la același local** (cap. 8.2)? Recomandarea: **da**. Pierdem puțin
   (puțini oameni merg de 4+ ori pe an la același loc prin aplicație) și câștigăm răspunsul la „vine la mine de 3 ani”.
2. **Lunile gratuite pentru cei care nu sunt fondatori:** câte? Recomandarea: **1 lună**.
3. **SRL acum**, înainte de primul contract? Recomandarea: **da** (e o regulă, nu o preferință).
4. **Fără prag de 30 de lei la factură?** Recomandarea: **da, fără prag** (dacă nu zice altceva contabilul).
5. **Renunțăm la dobânda de întârziere și la cei 40 € la început?** Recomandarea: **da**.
6. **Bilu și carnetul auriu ca insignă de membru** (nu beneficiu vândut), până răspunde Google? Recomandarea: **da**.

**Mici (cifre de pornire, se pot schimba după):**
- răspuns la rezervare: 15 minute azi, până la 12:00 pentru zilele următoare, doar în orele de rezervări;
  auto-confirmare până la 6 persoane;
- masa ținută 15 minute; „au întârziat” după +10 minute;
- închiderea serii până la 12:00; 3 seri neînchise → oprire;
- 3 neveniri în 60 de zile → 30 de zile; 2 oferte expirate în 30 de zile → 7 zile;
- „Ați fost 6 sau 4?”: 24 de ore; 15% scăderi → tăcerea e a clientului;
- drop: cel puțin 4 locuri, cel mult 6 pe luare, 12 ore pe săptămână, 150 m, 10 minute între luare și scanare;
- 3 zile lucrătoare de contestații, 5 zile lucrătoare pentru hotărâre, plata în 15 zile, oprire la 30 de zile pentru
  sume de cel puțin 30 de lei;
- grupuri mari: conturi de 14 zile; 2 rezervări viitoare pe cont;
- Plus: cel puțin 3 seri pe săptămână; „Plus oprit azi” de 4 ori pe lună;
- verificare locală: noi sunăm la telefonul public al localului; serviciul de facturare (Oblio, SmartBill sau FGO);
  domeniul (de exemplu cefaci.ro).

---

## Anexa A. Tabelele și funcțiile (pentru construcție)

Sumele sunt **în bani** (1 leu = 100 de bani), întregi, RON. Orele cu fus orar; ziua de lucru o dă o singură funcție
`private.work_day(ts)` = `((ts at time zone 'Europe/Bucharest') - interval '5 hours')::date`, testată în nopțile de
schimbare a orei. În SQL-ul de bani nu se folosește `current_date`. Totul în schema `billing` (neexpusă); aplicațiile
ajung doar prin funcții `security definer` care verifică rolul, iau localul din rândul blocat (`for update`), primesc un
cod de cerere unic și scriu în jurnal. Job-urile verifică `current_user`/rolul de serviciu. Niciun `on delete cascade`
din conturi spre bani sau jurnale: `set null` + copia actorului (id, nume, rol în clipa aia); un test trece prin toate
cheile străine. Trigger-e care opresc `update`/`delete` pe taxe, rânduri de factură, jurnale.

**Parteneri**
- `firms` (cui unic, nume, adresa structurată pentru e-Factura, reg_com, stare ANAF, verificată_la, email_facturare)
- `partnerships` (venue_id, firm_id, de_la, pana_la, motiv) — istoric, fără suprapuneri; firma unei taxe = cea valabilă în ziua ei
- `partners` (venue_id unic, status: ciorna | in_verificare | activ | pauza | oprit_neplata | iesit, activat_la, iesit_la) + istoric stări
- `locations` (venue_id, adresa, lat, lon verificate) — de aici coordonatele pentru dovezi și unicitatea lunilor gratuite
- `partner_terms` (venue_id, treapta, valabil_de_la (cel devreme ziua de lucru următoare), valabil_pana_la, motiv, cifrele, pus_de, aprobat_de) — fără suprapuneri (`btree_gist`), cel puțin 6 luni între schimbări
- `founder_slots` (nr 1–20 primar, venue_id unic, dat_la, dat_de, tarife_inghetate)
- `free_periods` (location_id, venue_id, de_la, pana_la_exclusiv, prelungire_pana_la, motiv) — una pe loc fizic în 24 de luni
- `contracts` (versiune, text, amprenta, clauze_speciale), `contract_acceptances` (firm_id, venue_ids, versiune, amprenta, semnatar_nume, functie, dovada_dreptului, user_id, la, ip, tarife_si_treapta_aratate, clauze_bifate, pdf_trimis_la)
- `partner_requests` (cerere | dispută | preluare, verificări, document criptat, notă de verificare, decizie, decis_de)
- `partner_members` (venue_id, user_id, rol, stare activ | dezactivat, nume_afisat, pin_hash, program, adăugat_de, scos_de, scos_la)
- `staff_invites` (cod_hash ≥ 10 caractere, venue_id, rol, creat_de, încercări, expiră_la, folosit_la, device_aprobat_de)
- `settings_versions` (cheie, valoare, valabil_de_la) — toate cifrele de pornire, cu versiuni
- `partner_settings` (versionate: sloturi de 30 min, persoane pe slot, durata mesei, grup maxim, ore de rezervări, auto-confirmare până la N, ținut minute, Plus: procent, excluse, „oprit azi” folosit, Wi-Fi, semnal slab)
- `venue_codes` (venue_id, token unic pe sticker, activ, rotit_la) — index unic pe tokenul activ
- `daily_words` (venue_id, zi_lucru, cuvinte)
- `holidays` (zi) — pentru zilele lucrătoare

**Rezervări, oferte, sosiri**
- `slots` (venue_id, start, persoane_max, folosite) — `update … where folosite + n <= persoane_max`
- `reservations` (venue_id, user_id null la ștergere, cod_4_cifre, pentru_altcineva_nume, adulți, copii, ora, zi_lucru, stare, motiv, termen_raspuns, reconfirmată_la, request_id unic) + istoric stări
- `drops` (venue_id, fel, reducere_toti 10–15, reducere_plus între toti+5 și 30 și ≥ Plus-ul localului, locuri ≥ 4, rămase între 0 și locuri, grup_minim, consumatie_minima, exceptii, adult_18, public: toti | noi_cefaci, start, plus_de_la, sfarsit ≤ start + 4 h, oprit_la, stare) — fără suprapuneri pe local; cel mult 12 ore pe săptămână
- `drop_claims` (drop_id, user_id, group_id, locuri ≤ 6, luat_la, expiră_la, scanat_la, stare, plus_la_luare, semnătura offline) — o ofertă activă pe client (index unic parțial); expirarea doar `where stare = 'activă' and expiră_la < now()`
- `groups` (id, venue_id, zi_lucru, organizator) + `group_members` (user_id, de unde: plan | gașcă | link)
- `arrivals` (venue_id, reservation_id **sau** drop_claim_id **sau** plus/plan (exact una, cu chei străine care refuză ștergerea), group_id, zi_lucru, user_id null la ștergere, adulti_confirmati, adulti_local (versiune), copii, conturi_scanate, stare: deschisă | definitivă | contestată | neclară | blocată | unită_în, unit_în_id, finalize_at, plus_la_scanare, offline)
- `arrival_proofs` (arrival_id, fel: bifa_local | cod_bilet | bon | scanare | locatie | raspuns, nivel: puternică | slabă, distanta_m, precizie_m, verdict_integrity, a_doua_pozitie, wifi, la, dispozitiv, versiune_app) — fără coordonate brute
- `count_questions` (arrival_id, versiune_numar, trimisă_la, termen, raspuns, implicit_aplicat)
- `evening_closes` (venue_id, zi_lucru, închis_de, la, pin_user) + rândurile
- `client_sanctions` (user_id, fel: nevenire | jumatate | oferta_expirata, sursa, anulată_la, verificată_de) — avertismente și opriri calculate din ele
- `venue_flags` (venue_id, fel: neclar | neinchis | scaderi | refuzati | oferta_fara_scanare | reducere_neaplicata, perioadă, valoare) — opririle automate citesc de aici
- `device_attestations` (user_id, verdict, la)
- `arrival_events` (arrival_id, cine, rol, ce, înainte, după, dispozitiv, versiune_app, verdict, la)

**Bani**
- `tariffs` (versiune, treapta, fel, standard_bani, fondator_bani, valabil_de_la ≥ creat + 30 zile, contract_versiune)
- `charges` (arrival_id **unic**, venue_id, firm_id, zi_lucru, fel, oameni_platiti 1–10, tarif_bani, suma_bani = tarif × oameni (constrângere), tariff_versiune, contract_versiune, settings_versiune, free_period_id, stare: de_facturat | în_listă | facturată | anulată | gratuită, motiv_anulare, statement_id, invoice_id) — felul doar rezervare sau drop (Plus și plan nu pot avea taxă)
- `adjustments` (venue_id, charge_id, suma_bani ±, motiv, propus_de, propus_la, aprobat_de ≠ propus_de, aprobat_la, statement_id) — pragul adunat pe local și lună
- `statements` (venue_id, firm_id, perioada, trimisă_la, termen_contestatii, total_bani din rânduri, copie_trimisă, stare) — unic pe (venue_id, perioada); `statement_lines`
- `disputes` (charge_id, motiv, dovadă, răspuns, propus_de, aprobat_de, rezultat, hotărât_la) — una deschisă pe taxă
- `invoices` (firm_id, perioada, tip: normală | storno, storno_al, copie_cumparator, cheie_idempotenta, furnizor_id, numar, serie, emisă_la, index_spv, stare: de_trimis | necunoscut | emisă | trimisă_spv | validată | respinsă | plătită_parțial | plătită | stornată, net/tva/total_bani, scadentă_la, răspunsuri_brute, xml_arhivat) — o factură normală nestornată pe firmă și perioadă
- `invoice_lines` (invoice_id, charge_id, activă) — index unic pe charge_id unde activă
- `outbox` (fel, payload, stare, încercări, ultimul_raspuns) — orice apel la furnizori
- `bank_transactions` (referință unică, suma_bani, la, extras), `payment_allocations` (tranzacție, factură, suma_bani)
- `plus_entitlements` (user_id, sursa: proba | plătit | compensare, de_la, pana_la, revocat_la, verificare) — revocările sunt rânduri noi
- `plus_issues` (visit_id unic, user_id, răspunsul localului, decizie, zile_date)
- `bills` (venue_id, zi, total_bani, oameni, grupe) — **fără user_id** (legătura doar la încărcare, pentru XP)
- `job_runs` (job, cheie_perioadă unic, pornit_la, terminat_la, rezultat), `billing_alerts` (fel, venue_id, stare, rezolvat_de)
- `admin_log` (cine, rol, ce, țintă, înainte, după, motiv, la)

**Funcții (exemple)**
- client: `reservation_request`, `reservation_cancel`, `reservation_reconfirm`, `proposal_answer`, `drop_claim`, `arrival_scan(token, table, fix, integrity)`, `arrival_checkin`, `count_answer`, `arrived_answer`, `plus_issue_report` — toate refuză conturile anonime și conturile oprite
- Business: `reservation_confirm | decline | propose`, `evening_close`, `arrival_mark`, `count_correct`, `drop_create | stop`, `plus_off_today`, `partner_settings_save`, `staff_invite | relink | remove`, `statement_dispute`
- Admin: `partner_request_decide`, `acceptance_verify`, `partner_terms_propose | approve`, `founder_grant`, `free_period_propose | approve`, `arrival_decide`, `dispute_propose | approve`, `adjustment_propose | approve`, `payment_import`, `plus_issue_decide`
- job-uri (pg_cron la fiecare oră, ora României calculată înăuntru, `job_runs`): expirări, închiderea automată a serilor la 12:00, `finalize`, `statement_build` (ziua 3), `invoice_issue` (prin `outbox`), `invoice_sync` (verificarea la furnizor și ANAF), amintiri, oprirea la neplată, `reconcile`

**Teste** (pe o bază ca `tests/db.test.ts`, cu drepturile Supabase reproduse): fiecare rând din cap. 8.11, plus:
două scanări în același timp; două luări pe ultimul loc; două rezervări pe ultimul slot; dublu clic pe corecție și pe
plată; noaptea de 25 octombrie 2026 și 28 martie 2027; 31 octombrie (sâmbătă) → lista din 3 noiembrie; 1–3 ianuarie
(sărbători); un cont șters cu taxe (nimic nu dispare); preluarea de altă firmă la mijlocul lunii; două treapte în
aceeași lună; aprobarea propriei propuneri (refuzată); corecții de 99 de lei adunate; factura cu răspuns pierdut de la
furnizor (fără dublură); cheia publică nu poate rula nicio funcție.

---

## Anexa B. Ce a găsit verificarea și unde e rezolvat

**Inginerul (32):** 1 funcții deschise pentru cheia publică (cap. 1, reparat 06.10) · 2 dovada clientului declarată de
el (5.1, 5.4) · 3 „definitivă” fără termen (8.5) · 4 lista lunii pe 1, înainte de ultimele sosiri, cu dubluri (8.7) ·
5 facturi duble la furnizor (8.8) · 6 suma reportată în loc de taxe (8.7) · 7 anularea după sosire (3.1) · 8 grupul
nedefinit (5.5) · 9 ștergeri în lanț (Anexa A, 14) · 10 Business pe rândurile altui local (1) · 11 conturile anonime
(4.3, 7.3, 9) · 12 lunile gratuite contradictorii (2.6, 8.6) · 13 tarifele de fondator neînghețate (8.1, 8.3) · 14 firma
fără istoric (2.8, Anexa A) · 15 patru ochi doar peste 100 de lei (8.9) · 16 corecții și stornări suprapuse (8.5) ·
17 scrieri repetate (1) · 18 numărul de oameni (3.6, 5.6) · 19 verificarea pe setări schimbate (8.10) · 20 contestații
pe zile calendaristice (8.7) · 21 ziua de lucru și ora de vară (5.2) · 22 pg_cron în UTC (8.7, Anexa A) · 23 sosirea
legată de XP (5.8) · 24 timpii drop-ului (4.2, 4.3) · 25 istoricul treptei (8.4, Anexa A) · 26 plățile și oprirea
(8.8) · 27 capacitatea în paralel (3.2) · 28 fondatorii în paralel (2.9) · 29 fără semnal (5.7) · 30 jurnalul (1, 9,
Anexa A) · 31 starea Plus în timp (7.1, 7.5) · 32 datele de poziție (14).

**Contabilul-jurist (27):** 1 SRL înainte de contract (15.1) · 2 politica și termenii contrazic codul (14) · 3 clicul,
clauzele speciale, cine semnează (2.3) · 4 P2B (15.4) · 5 TVA și pragul (15.3) · 6 termenele de facturare (8.7) ·
7 Plus prin Google Play (7.4) · 8 banii de bilete (15.7) · 9 ștergerea contului (14) · 10 Plus plătit și legea
consumatorului (7.4) · 11 compensarea Plus (7.5) · 12 „pe viață” (8.3) · 13 întârzierea și oprirea (8.8) · 14 stările
e-Factura și stornările (8.8, 15.2) · 15 firma pe istoric (2.8) · 16 bonurile (11, 14) · 17 ce văd localurile (14) ·
18 datele angajaților (14) · 19 documentele de verificare (2.2) · 20 DPIA (14) · 21 regulile de bani contradictorii
(0, 16) · 22 tutun și alcool (4.1) · 23 „iertat” (8.6) · 24 controale interne (8.8, 8.9) · 25 concurența (15.8) ·
26 cardul salvat (mai târziu: mandat scris, plata după validarea ANAF) · 27 Google Maps (15.9).

**Patronul de local (30):** 1 dovada slabă bate localul (5.1, 5.4) · 2 plătesc clienții pe care îi aveam (4.3, 8.2) ·
3 tăcerea nu costă (5.3) · 4 drop dat fără scanare (4.4) · 5 drop de 1 loc șterge taxa (5.5) · 6 scăderea numărului
(5.6) · 7 refuzați, ținut 15 minute, anulări (3.1, 3.5) · 8 ecrane false (6.1) · 9 reducere pe persoană (6.2) ·
10 pe ce se aplică reducerea (4.1, 6.3) · 11 răspunsul la cereri (3.3) · 12 grupuri mari și conturi gratuite (3.4) ·
13 treapta nedefinită (8.4) · 14 „pe viață” (8.3, 2.7) · 15 cine semnează (2.3) · 16 firmă nouă, luni gratuite (2.6,
2.8, 8.6) · 17 prezentarea promite altceva (16, docs/exersare-localuri.md) · 18 contestații fără sfârșit și oprirea
(8.7, 8.8, 13) · 19 ce scanare e a cui (3.4, 5.5) · 20 grupul crescut la scanare (3.6) · 21 alcool la minori (4.1) ·
22 plângeri Plus de la prieteni (7.5) · 23 drop ca reclamă gratuită (4.2, 4.3) · 24 capacitatea (3.2) · 25 taxă pe
oameni care nu consumă (4.1, 8.2) · 26 subsoluri (5.7) · 27 tabletă comună, Safari, ture (9) · 28 sfârșitul lunii,
sărbători, cluburi (5.2, 8.7) · 29 Plus: ora, oprit azi, insigna (7.1) · 30 Plus primește mai puțin cu drop (4.1).
