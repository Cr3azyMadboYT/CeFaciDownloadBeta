# CeFaci: cum merg împreună aplicația, Business și Admin

Logica completă, înainte de construcție (06.10). Banii sunt partea cea mai importantă: fiecare leu trebuie să se poată
verifica și refăcut din date, iar nimeni (local, client, angajat CeFaci) să nu-l poată muta pe ascuns.

Documentul e scris ca să-l poată citi oricine. Partea tehnică (tabele, funcții) e la final, în Anexa A.

---

## 0. Ce s-a lămurit înainte (contradicții vechi din documente)

| Ce se bătea cap în cap | Ce rămâne |
|---|---|
| Codul QR: „clientul scanează codul de la bar” vs. „ospătarul scanează codul de pe biletul clientului” | **Clientul scanează codul localului.** Scanerul ospătarului rămâne doar de rezervă (când clientului nu-i merge camera). Adevărul nu e ce arată telefonul clientului, ci lista „Sosiri” din Business, venită de pe server. |
| PFA la primul leu (CLAUDE.md) vs. SRL înainte de primul leu (decizia din 29.09 și documentul de taxe) | **De hotărât cu contabilul, înainte de prima factură** (vezi cap. 14). Recomandarea: SRL. |
| Documentul de taxe: „ieșire din recomandări pe 15” pentru neplată | **Nu.** Neplata oprește doar rezervările și Live Drop-urile după 30 de zile. Recomandările nu se cumpără și nu se pierd pe bani (decizia din 06.10). |
| „Clienți Plus: 0 lei” | **De confirmat:** propunerea e că vizita cu reducerea Plus, fără rezervare sau Live Drop, costă 0 lei, iar rezervarea sau Live Drop-ul se plătesc la fel, cu sau fără Plus (cap. 6). |
| Reducerea Plus neaplicată: „îi dăm diferența”, „o scădem din decontul localului”, „o recuperăm de la local” | **Propunere nouă, de confirmat:** nu mută nimeni bani. Clientul primește zile de Plus gratuite, iar localul primește un avertisment, apoi iese din program (cap. 6). |
| Documentul de taxe vorbea de „5% + TVA” | Înlocuit de taxa pe om venit (06.10). Rămâne doar mențiunea „+ TVA dacă e cazul”. |

---

## 1. Trei aplicații, o singură bază de date

- **CeFaci** (aplicația de telefon, gata): oamenii fac planuri, rezervă la parteneri, iau Live Drops și anunță că au ajuns.
- **CeFaci Business** (web, merge pe telefon și pe calculator, fără magazin de aplicații): localul își confirmă rezervările, își vede sosirile, pune Live Drops, își ține echipa și își vede lista lunii și facturile.
- **CeFaci Admin** (web, pentru echipa noastră): cererile de parteneriat, locurile, semnalările, banii, disputele, oamenii din echipă, jurnalul.

Toate trei scriu în aceeași bază de date (Supabase). **Regulile stau în baza de date, nu în aplicații:** o aplicație
modificată sau un buton apăsat de două ori nu poate face ce nu e voie (aceeași idee ca rolurile din Admin, deja făcute).
Fiecare schimbare care atinge bani sau un partener rămâne în jurnal: cine, când, ce era înainte, ce e după, de ce.

---

## 2. Viața unui local partener

```
caută localul → cere parteneriatul → verificare → contract acceptat → activ ⇄ pauză → ieșire
                                         ↘ respins
```

1. **Cererea.** Patronul își face cont (email sau Google, ca în aplicație), își caută localul și scrie:
   - cine e (nume, ce rol are în firmă);
   - CUI-ul firmei.
2. **Verificarea:**
   - **CUI-ul se verifică singur la ANAF:** numele firmei, adresa, dacă e activă sau radiată.
   - **Dovada că localul e al lui** (una dintre ele):
     - (a) noi sunăm la telefonul public al localului (luat de pe Google sau de pe site, nu din ce scrie omul) și dăm un cod;
     - (b) un document: certificat de înregistrare, contract de închiriere sau autorizație.

     Documentele stau într-un dosar privat, le văd doar fondatorul și adminii și se șterg la 90 de zile după decizie.
   - **Local deja revendicat de altcineva:** dispută, cu document obligatoriu. Cel de acum e anunțat și are 3 zile să răspundă, iar pagina nu se schimbă până la decizie.
   - **Local care nu e pe hartă:** îl adaugă un admin în timpul verificării.
3. **Contractul.** „Termenii pentru parteneri”, versiunea X, se acceptă cu un clic. Rămân salvate versiunea, ziua, ora și contul care a acceptat.
   - Orice schimbare de termeni se anunță cu 30 de zile înainte și cere o nouă acceptare.
   - Tarifele de fondator nu se schimbă niciodată cât localul rămâne partener.
4. **Treapta de preț** (2/5/8 lei la rezervare, 3/7/10 la Live Drop) o pune un admin, cu motiv scris (meniul, bonurile). Localul o vede înainte să accepte contractul.
5. **Activarea** e ziua în care sunt îndeplinite toate trei:
   - contractul e acceptat;
   - profilul e publicat;
   - a avut loc o scanare de probă a codului de la bar.

   **Din ziua activării curg cele 3 luni gratuite.**
6. **Pauza:** localul poate opri oricând rezervările sau Live Drop-urile (pentru o zi sau până le pornește iar). Ce era deja confirmat rămâne valabil.
7. **Ieșirea:** oricând, fără penalizări.
   - Rezervările noi și drop-urile noi se opresc pe loc.
   - Cele deja confirmate: localul alege dacă le onorează sau le anulează, iar clienții sunt anunțați automat.
   - Ce s-a adunat până atunci intră în factura următoare.
   - Statutul de fondator se pierde. Dacă revine, plătește tarifele obișnuite, fără luni gratuite.
8. **Mai multe localuri ale aceleiași firme:** fiecare local e separat (treaptă, statut de fondator, luni gratuite), dar firma primește o singură factură pe lună, cu câte un rând pe local.

**Fondatori:** maximum 20 de localuri, numărul e păzit de baza de date. Statutul de fondator îl dă doar fondatorul CeFaci (Cornel).

---

## 3. Rezervarea prin CeFaci

| Stare | Cum ajunge acolo | Ce vede clientul |
|---|---|---|
| **Cerută** | clientul alege ziua, ora, câți adulți și câți copii sub 12 ani | „În așteptare” |
| **Confirmată** | localul confirmă (sau automat, la grupurile mici, dacă localul a ales asta) | ștampila REZERVAT |
| **Altă oră propusă** | localul propune altă oră; clientul acceptă (devine confirmată) sau refuză (devine anulată) | „Localul propune 21:00” |
| **Refuzată** | localul refuză | „N-au loc. Uite alte locuri la ora asta” |
| **Expirată** | localul n-a răspuns la timp | același mesaj ca la refuz |
| **Anulată de client** | clientul anulează | — |
| **Anulată de local** | localul anulează, cu motiv | anunț + alte locuri |
| **Au venit** | sosirea e dovedită (cap. 5) | „Distracție plăcută” |
| **N-au venit** | nicio dovadă până la sfârșitul ferestrei | — |
| **N-au putut fi primiți** | localul spune că n-a avut loc la sosire | scuze + alte locuri |

**Regulile:**
- **Locurile prin CeFaci le alege localul:** câte mese (sau persoane) pe oră. Orele pline apar tăiate în aplicație.
- **Răspunsul localului:** în 30 de minute. Dacă rezervarea e peste mai puțin de 2 ore, în 15 minute. Altfel cererea expiră, iar clientul primește variante pe loc.
- **Grupurile de 8+** se confirmă mereu de mână.
- **Anularea e gratuită pentru client, mereu.** Clientul nu plătește niciodată nimic. Anularea după termenul localului (implicit cu 2 ore înainte) contează ca jumătate de „n-a venit” în istoricul lui.
- **Clienții care nu vin:** la 2 neveniri în 60 de zile clientul primește un avertisment. La 3, nu mai poate rezerva și nu mai poate lua Live Drops la parteneri timp de 30 de zile. Asta apără localurile, iar fără ea partenerii pierd încrederea în rezervările noastre.
- **Masa e ținută** cât alege localul (10–30 de minute după oră, implicit 15). Clientul vede un ceas.
- **„N-au putut fi primiți” nu se plătește.** Localul are voie s-o folosească, dar fiecare caz apare în Admin. Dacă se repetă, îl sunăm.

**Ce se plătește:** doar „Au venit”, după cap. 7.

---

## 4. Live Drop

- **Ce poate pune localul:**
  - reducere în procente: pentru toți 10–15%, pentru Plus cu cel puțin 5 puncte mai mult, cel mult 30%;
  - ceva gratis;
  - o ofertă pentru grup.
- **Ce alege la fiecare drop:** câte locuri dă, grupul minim, ora de început (acum sau mai târziu), cât ține (cel mult 4 ore) și cui se adresează: tuturor sau doar „clienților noi” (cine n-a mai venit la el prin CeFaci).
- **Câte drop-uri deodată:** unul singur activ pe local; regula e păzită de baza de date.
- **Plus îl vede cu 10 minute mai devreme:** în primele 10 minute drop-ul apare doar pentru Plus.
- **Stările:** programat → doar Plus (10 minute) → pentru toți → terminat (a trecut ora, s-au terminat locurile sau l-a oprit localul). Dacă localul îl oprește, cine l-a luat deja rămâne cu el.
- **„Ia oferta”:**
  - clientul îl ia pentru el sau pentru gașcă, cu un loc pentru fiecare om;
  - locurile se scad pe loc, fără să se poată lua același loc de două ori;
  - oferta e a lui 45 de minute, apoi revine altcuiva.
- **Limite pentru client:**
  - o singură ofertă luată deodată, la orice local;
  - dacă lasă 2 oferte să expire în 30 de zile, nu mai poate lua drop-uri timp de 7 zile.
- **La masă:**
  - clientul scanează codul localului;
  - pe ecranul lui și în „Sosiri” la local apare, de exemplu, „−15% · 4 persoane”. Dacă a luat oferta un membru Plus: „−20% pentru 4 · −15% pentru ceilalți”;
  - ospătarul aplică reducerea în casa lui de marcat. CeFaci nu atinge plata.
- **Reducerile nu se adună.** Într-un drop, Plus primește prețul Plus al drop-ului, nu drop + reducerea Plus obișnuită.
- **Ce se plătește:** cei care au venit, cel mult câte locuri au fost luate și cel mult 10.

---

## 5. Sosirea: de unde știm că au venit

Asta e baza tuturor banilor.

**Dovezile:**

| Dovada | Cine o face |
|---|---|
| **A. Scanarea codului localului**, cu telefonul la cel mult 250 m (plus marja de eroare a GPS-ului, cel mult 150 m) și cu o locație care nu e falsă (Android spune când e simulată) | clientul |
| **B. Check-in cu locația**, când nu găsește codul (aceleași reguli de distanță) | clientul |
| **C. „Au venit” bifat în Business** | localul |
| **D. Ospătarul scanează codul de pe biletul clientului** (codul se schimbă la câteva secunde; de rezervă: 6 cifre) | localul |

**Regula:** o rezervare sau un drop e „au venit” dacă există **cel puțin o dovadă de la client (A sau B) sau una de la local (C sau D)**, în fereastra de timp:
- **rezervarea:** de la 30 de minute înainte de oră până la 3 ore după (un grup care întârzie tot prin noi a venit). Localul poate bifa „au venit” oricând în aceeași zi de lucru;
- **Live Drop:** cât ține oferta luată (45 de minute). Localul poate bifa oricând în aceeași zi de lucru.

**Unitatea plătită e rezervarea sau oferta luată, nu fiecare telefon.** Dacă vin 4 prieteni și scanează toți, e tot o
singură sosire. Fiecare își ia XP-ul și ștampila, dar plata e una.

**O singură taxă pe seară:** dacă același grup are și rezervare, și drop la același local în aceeași seară, rămâne o
singură sosire, plătită ca Live Drop.

**Câți au venit:**
1. Clientul spune la rezervare sau la drop câți adulți și câți copii sub 12 ani vin.
2. La scanare confirmă numărul („Suntem 6, plus 1 copil”). Îl poate scădea; la rezervare îl poate și crește.
3. Localul vede numărul în „Sosiri” și îl poate corecta.
4. Dacă localul îl scade, clientul e întrebat „Ați fost 6 sau 4?” și are 24 de ore să răspundă:
   - confirmă numărul localului: rămâne numărul localului;
   - spune că erau mai mulți: rămâne numărul clientului, iar diferența apare în Admin;
   - nu răspunde: rămâne numărul localului (la dubiu, câștigă localul).

**Localul spune „n-au venit”, clientul are dovadă A sau B:** clientul e întrebat „Ai fost la X?”. Dacă zice da, sosirea
se plătește și apare în Admin. Mai multe cazuri la același local înseamnă verificare.

**Ziua de lucru se schimbă la 05:00** (ca în restul aplicației): o sosire la 01:30 în noaptea de 31 octombrie spre
1 noiembrie ține de 31 octombrie, deci de luna octombrie.

---

## 6. Plus la localuri

- **Programul Plus e opțional pentru local.** Dacă intră, alege:
  - reducerea: 10, 15 sau 20%;
  - zilele și orele în care nu se aplică (serile pline);
  - schimbările se aplică de a doua zi, ca să nu se schimbe ceva în mijlocul unei seri.
- **Cine are Plus o știe doar serverul:** proba de 7 zile (o dată pe cont, deja făcută) sau abonamentul plătit prin Google Play, verificat de server. Pe ecranul de la local, „Client Plus” apare doar dacă serverul spune că Plus e activ în clipa aia; o aplicație modificată nu poate să-l arate singură.
- **„Pentru 4 din 6”:** reducerea Plus o primesc membrul și încă trei oameni de la aceeași masă.
- **Ce se plătește (propunere, de confirmat):**
  - o vizită cu reducerea Plus, fără rezervare și fără Live Drop: **0 lei**;
  - o rezervare sau un Live Drop: **la fel ca pentru oricine**, chiar dacă omul are Plus.

  Pe prezentare scrie acum „Clienți Plus: 0 lei”. Trebuie scris exact, ca să nu iasă o ceartă la prima factură.
- **„Nu mi s-a aplicat reducerea” (propunere, de confirmat):**
  - **Clientul** primește 7 zile de Plus gratis, o dată la 60 de zile cel mult. Așa nu poate scoate bani mințind.
  - **Localul** poate răspunde în Business. La prima plângere primește un avertisment. Dacă vin 2 plângeri de la oameni diferiți în 30 de zile, după ce le vede un admin, iese din programul Plus pentru 30 de zile.
  - **La Live Drop**, dacă un admin vede că reducerea chiar n-a fost aplicată, taxa pentru acea sosire se anulează: localul nu plătește pentru o ofertă pe care n-a dat-o.
  - **Nicio regulă nu scoate bani din buzunarul nostru** și nici nu ia bani de la local pentru client.

---

## 7. Banii: cum se calculează fiecare leu

### 7.1 Tarifele

| Treapta localului (de persoană) | Rezervare | Live Drop | Fondator: rezervare / Live Drop |
|---|---|---|---|
| Sub 50 lei | 2 lei | 3 lei | 1 / 2 lei |
| 50–150 lei | 5 lei | 7 lei | 4 / 6 lei |
| Peste 150 lei | 8 lei | 10 lei | 7 / 9 lei |

Tarifele stau în baza de date, cu data de la care sunt valabile. O schimbare de tarif nu atinge lunile trecute.

### 7.2 Ce se întâmplă cu fiecare sosire

1. **Sosirea devine definitivă** după fereastra de 24 de ore pentru „câți au venit”. Atunci baza de date scrie **o taxă**, legată de sosire; o sosire nu poate avea două taxe. Taxa conține:
   - ziua de lucru;
   - felul: rezervare sau Live Drop;
   - oamenii plătiți: adulții care au venit, cel mult 10, iar la drop cel mult câte locuri s-au luat;
   - tariful zilei, după treapta și statutul de fondator valabile în ziua aceea;
   - suma: tarif × oameni.
2. **În lunile gratuite** taxa se scrie la fel, dar e **iertată**. Localul o vede ca „ai fi plătit X lei”. Asta e și argumentul care îl ține partener.
3. **Taxele nu se mai șterg și nu se mai modifică.** O greșeală se îndreaptă cu o **corecție** separată (minus sau plus), cu motiv și cu numele omului din echipă care a făcut-o.

### 7.3 Luna

| Când | Ce se întâmplă |
|---|---|
| **Ziua 1, ora 06:00** | Se face **lista lunii trecute** pentru fiecare local: taxele neiertate, corecțiile, plus ce a rămas din lunile dinainte. Localul o primește în Business și pe email. |
| **Zilele 1–3** | Localul poate contesta orice rând, cu motiv. Un rând contestat nu oprește restul. |
| **Ziua 4** | Se emite **factura** pentru rândurile necontestate și pentru contestațiile deja rezolvate. Ce e încă în dispută trece pe luna următoare. Sub 30 de lei nu se emite factură, iar suma trece pe luna următoare. |
| **Ziua 4 + 15** | **Termenul de plată.** |
| **După termen** | Amintiri la +3 și +7 zile. **La 30 de zile de întârziere** se opresc singure rezervările și Live Drop-urile localului. Pornesc singure la loc când se plătește. Recomandările nu se ating. |

### 7.4 Factura și plata

- **Factura se face printr-un serviciu de facturare cu e-Factura** (de exemplu Oblio, SmartBill sau FGO; de ales), nu de mână. Numărul facturii și raportarea la ANAF le face serviciul.
- **O factură pe firmă (CUI) pe lună**, cu un rând pe fiecare local al firmei.
- **Plata, la început:** prin transfer bancar, cu numărul facturii în detalii. Contabilul (sau fondatorul) o marchează plătită. Mai târziu, cu card salvat, prin Netopia.
- **O factură emisă nu se modifică.** O greșeală se îndreaptă cu factură de stornare plus factură nouă. Peste 100 de lei e nevoie de două persoane: contabilul propune, fondatorul aprobă.

### 7.5 Verificări automate (în fiecare noapte)

- Fiecare sosire plătibilă are exact o taxă. Nicio taxă nu e fără sosire.
- Nicio taxă nu e pe două facturi.
- Suma rândurilor de pe fiecare factură e egală cu totalul facturii.
- Fiecare taxă are tariful corect pentru ziua ei. Calculul se reface din date și se compară.

Orice nepotrivire oprește facturarea acelui local și trimite o alertă în Admin. **Mai bine o factură întârziată decât una greșită.**

### 7.6 Exemple de calcul (devin teste automate)

| Situația | Calcul | Sumă |
|---|---|---|
| Restaurant (treapta din mijloc), rezervare pentru 6, au venit 4 | 4 × 5 lei | **20 lei** |
| Același, fondator | 4 × 4 lei | **16 lei** |
| Cafenea, Live Drop luat pentru 3, au venit 3 | 3 × 3 lei | **9 lei** |
| Live Drop luat pentru 4, au venit 6 | min(6, 4) × 7 lei | **28 lei** |
| Rezervare pentru 14 adulți și 2 copii, au venit toți | min(14, 10) × 5 lei; copiii nu se pun | **50 lei** |
| Grup cu rezervare + drop în aceeași seară | o singură taxă, ca drop: 5 × 7 lei | **35 lei** |
| Rezervare confirmată, n-a venit nimeni | — | **0 lei** |
| Localul: „n-au venit”; clientul: scanare la 40 m + „da, am fost” | sosire plătită, apare în Admin | după tarif |
| Localul scade 6 → 4, clientul nu răspunde în 24 de ore | 4 × tarif | după tarif |
| În lunile gratuite, 30 de oameni la treapta din mijloc | iertat, se arată „ai fi plătit 150 lei” | **0 lei** |
| Factura lunii ar fi 24 de lei | sub 30 de lei, trece pe luna următoare | **0 lei acum** |
| Sosire la 01:30, în noaptea 31 octombrie → 1 noiembrie | intră în octombrie | — |
| Vizită cu reducerea Plus, fără rezervare și fără drop | — | **0 lei** |

### 7.7 Lunile gratuite, exact

- **Încep în ziua activării și țin 3 luni calendaristice** (de pe 14 martie până pe 13 iunie inclusiv).
- **Dacă în cele 3 luni n-a venit nimeni plătibil**, gratuitatea se prelungește până la primul om adus. Acea primă sosire e tot gratuită, iar plata începe de a doua zi. Prelungirea ține cel mult 3 luni.
- **O singură dată pentru fiecare local al unei firme (CUI).** Ieșitul și reintratul nu le mai dau.

---

## 8. Business: cine ce poate face

| | Proprietar | Manager | Recepție | Scanare |
|---|---|---|---|---|
| Azi, Sosiri | da | da | da | doar Sosiri și scanerul |
| Confirmă, refuză sau mută rezervări | da | da | da (ziua curentă) | nu |
| „Au venit”, „n-au venit”, numărul de oameni | da | da | da | doar la scanare |
| Live Drops, oferte, programul Plus | da | da | nu | nu |
| Profilul localului (texte, poze, program) | da | nu | nu | nu |
| Echipa | toți | doar Recepție și Scanare | nu | nu |
| Plăți: lista lunii, facturile | da | doar le vede și poate contesta | nu | nu |
| Datele firmei, contractul, ieșirea din parteneriat | da | nu | nu | nu |

- **Angajații nu au nevoie de email.** Proprietarul sau managerul generează un cod (de forma P9-4K7M) care:
  - merge o singură dată;
  - expiră în 48 de ore dacă nu e folosit;
  - se leagă de telefonul angajatului.

  Pentru asta se folosește un cont anonim de la Supabase, legat de rol. Pe un telefon nou e nevoie de un cod nou.
- **Scoaterea din echipă** închide accesul pe loc. **Pauza** și **tura** rămân ca în design.
- **Ce vede un angajat despre client:** doar prenumele, câte persoane sunt și oferta. Telefonul și emailul, niciodată.
- **Fiecare acțiune rămâne în istoric** cu numele celui care a făcut-o: confirmare, „au venit”, corectura numărului.

**Ecranele** (din canvasul Business):
- **Azi:** cererile, programul pe ore, drop-ul activ, ultimele sosiri, comutatorul „opresc rezervările azi”.
- **Rezervări:** lista și setările.
- **Sosiri / Scanner.**
- **Oferte și Live Drops:** bara de reducere nu iese din 10–15%, iar Plus are minim +5 și maxim 30%.
- **Profil:** codul QR de printat.
- **Echipă.**
- **Statistici:** doar cifre adunate. O cifră pe un grup sub 5 oameni nu se arată, ca să nu se poată recunoaște cineva.
- **Plăți:**
  - lista lunii, cu „ai fi plătit” în lunile gratuite;
  - contestațiile;
  - facturile;
  - tarifele și treapta lui.

  Canvasul arată încă „5% comision” și trebuie schimbat.

---

## 9. Admin: ce face echipa CeFaci

| Rol | Ce poate face |
|---|---|
| **Fondator** | tot; în plus, dă statutul de fondator, aprobă corecțiile de bani peste 100 de lei și aprobă treptele |
| **Admin** | cereri de parteneriat, parteneri, dispute, locuri, semnalări, echipa (doar editori, moderatori, suport) |
| **Contabil** | luna, facturile, plățile, întârzierile, corecțiile (peste 100 de lei cu aprobarea fondatorului) |
| **Editor** | locuri: modifică, adaugă, ascunde; cererile de locuri noi de la clienți |
| **Moderator** | semnalări, poze puse de localuri, plângeri Plus, blocarea unui cont de client |
| **Suport** | răspunde oamenilor, vede ce îi trebuie ca să ajute, dă zile de Plus la o plângere (cel mult 7) |

**Ecranele:**
1. **Acasă:** ce e de rezolvat azi: cereri, dispute, alerte de bani, facturi întârziate. Plus cifrele reale.
2. **Cereri de parteneriat:** verificarea ANAF, documentul, apelul la local, dispute de proprietate. Butoanele: Aprobă, Cere ceva, Respinge.
3. **Parteneri:** fiecare local cu treapta (și istoricul ei), statutul de fondator, lunile gratuite (de când până când), starea (activ, pauză, întârziere, ieșit), echipa lui și contractul acceptat.
4. **Locuri:** ce există deja (modificare, adăugare, ascundere, jurnal).
5. **Semnalări și cereri de locuri noi** (există deja).
6. **Sosiri:** căutare, diferențe de număr, „n-au venit” contestat, cazuri „n-au putut fi primiți”, cu statistica pe local.
7. **Bani:**
   - luna pe fiecare local;
   - contestațiile;
   - facturile;
   - plățile;
   - întârzierile;
   - corecțiile;
   - alertele verificărilor de noapte.
8. **Plus:** plângerile („nu mi s-a aplicat”), avertismentele localurilor, zilele de Plus date.
9. **Sugestii de parteneri:** localurile nepartenere cu cele mai multe ieșiri și bonuri din CeFaci (de ținut minte de pe 06.10). Cere ca bonurile să fie păstrate.
10. **Oameni:** suport pentru clienți: căutare după @username sau email, istoricul de neveniri, blocare. Doar cât trebuie pentru ajutor.
11. **Echipa** și **jurnalul**: tot ce a făcut fiecare.

---

## 10. Ce se schimbă în aplicația de client

1. **Pagina localului** (Detalii, deja făcută) primește, doar la parteneri:
   - „Rezervă prin CeFaci” (dacă are rezervările pornite);
   - drop-ul activ;
   - „−15% cu Plus” (zilele lui);
   - eticheta „Partener”.

   Locul în recomandări nu se schimbă.
2. **Rezervarea la parteneri:**
   - ziua și ora (orele pline tăiate), adulți și copii sub 12 ani;
   - „În așteptare”, apoi REZERVAT, „Altă oră propusă” sau refuzată, cu variante;
   - anularea;
   - notificările.
3. **Live Drops:** rândul de pe Acasă și ecranul cu toate (designul există). „Ia oferta” pentru mine sau pentru gașcă, cu ceas.
4. **„Am ajuns” la parteneri:**
   - scanarea codului; dacă nu-l găsește, „Nu găsesc codul” face check-in cu locația;
   - apoi ecranul de sosire: oferta, câți sunt, animat, ca să nu poată fi trimis ca poză.
5. **După ieșire:**
   - „Ați fost 6 sau 4?” (doar dacă localul a schimbat numărul);
   - „Ți s-a aplicat reducerea?” (la drop și la Plus);
   - „Cum a fost?” și bonul (există).
6. **Plus vine de pe server**, nu din telefon. Proba e deja pe server. Abonamentul plătit vine prin Google Play (faza 2).
7. **Avertismentul de neveniri.**
8. **Bonul se păstrează** (local, zi, total, câți oameni, grupele de pe bon), pentru sugestiile de parteneri și pentru treaptă. Poza nu se păstrează. Când cineva își șterge contul, bonul rămâne fără nume.

---

## 11. Notificări

| Cine | Când |
|---|---|
| **Localul** | cerere nouă de rezervare (pe telefoanele echipei din tura respectivă; dacă nimeni nu răspunde în 10 minute, și email la proprietar); sosire nouă (live, în „Sosiri”); drop luat; contestație rezolvată; lista lunii; factura; amintirile de plată |
| **Clientul** | confirmat / refuzat / altă oră / expirat; oferta expiră în 10 minute; „Ați fost 6 sau 4?”; „Ți s-a aplicat reducerea?”; avertismentul de neveniri |
| **Admin** | cerere nouă de parteneriat; dispută; alertă de bani; factură întârziată; prea multe diferențe la un local |

---

## 12. Cum ar putea trișa cineva și ce îl oprește

| Cine încearcă | Ce | Ce îl oprește |
|---|---|---|
| Localul | scade numărul de oameni | numărul îl dă clientul; „Ați fost 6 sau 4?”; diferențele, în Admin |
| Localul | „n-au venit”, deși au venit | dovada de la client (scanare sau locație) + întrebarea „Ai fost?” |
| Localul | le zice clienților să nu scaneze | la drop, reducerea apare doar după scanare; la rezervare se poate dovedi și cu locația sau cu „Am fost acolo” |
| Localul | declară că e mai ieftin | treapta o pune adminul, din meniu și din bonuri |
| Localul | trece adulți drept copii | copiii îi trece clientul la rezervare |
| Localul | iese și reintră pentru luni gratuite | o singură dată pe local și pe CUI |
| Localul | „n-au putut fi primiți” la toată lumea | fiecare caz apare în Admin; dacă se repetă, îl sunăm |
| Localul | contestă tot | contestația cere motiv; dovada clientului câștigă; cine contestă fără temei pierde lunile gratuite sau iese din program |
| Localul | le zice „sunați direct data viitoare” | nu se poate opri; de asta rezervarea e ieftină |
| Clientul | check-in fals pentru XP | locația verificată (inclusiv cea simulată), limite pe zi, 20 de minute între check-in-uri (deja făcut) |
| Clientul | ia drop-uri și nu vine | o ofertă deodată; 2 expirate în 30 de zile înseamnă 7 zile fără drop-uri |
| Clientul | rezervă și nu vine | 3 neveniri în 60 de zile înseamnă 30 de zile fără rezervări la parteneri |
| Clientul | „nu mi s-a aplicat” ca să ia Plus gratis | o dată la 60 de zile, cel mult 7 zile; localul poate răspunde |
| Clientul | conturi noi pentru probe Plus repetate | proba e o dată pe cont și o dată pe telefon |
| Concurența | rezervări false la un rival | neveniturile nu se plătesc; limitele de neveniri; localul vede istoricul clientului (doar câte neveniri, nu cine e) |
| Angajat CeFaci | mută bani | corecțiile cer motiv și apar în jurnal; peste 100 de lei e nevoie de două persoane; facturile emise nu se modifică |
| Oricine | aplicație modificată | toate regulile stau în baza de date |

---

## 13. Date personale (GDPR)

- **Localul nu vede datele clienților**, doar prenumele, câte persoane sunt și oferta.
- **Statisticile sunt doar adunate**, iar grupurile sub 5 nu se arată.
- **Contul șters:** profilul dispare, dar sosirile și taxele rămân (legea contabilității cere păstrarea documentelor), fără numele omului.
  > ⚠️ **Tehnic important:** acum ștergerea unui cont șterge în lanț tot ce e legat de el. Tabelele de bani trebuie să păstreze rândul și să pună doar „fără cont” în loc de om.
- **Documentele de la cererile de parteneriat:** șterse la 90 de zile după decizie.
- **De făcut:** termenii și politica de confidențialitate pentru clienți (le cere și Google Play), plus termenii pentru parteneri. Toate trebuie văzute de un jurist.

---

## 14. Firma, facturile, taxele (de verificat cu contabilul înainte de prima factură)

1. **SRL sau PFA.** Documentele noastre se contrazic. Recomandarea: **SRL înainte de prima factură**:
   - facturăm multe firme;
   - avem contracte cu răspundere;
   - biletele, mai târziu, cer o firmă.
2. **e-Factura:** facturile către firme trebuie trimise prin sistemul ANAF. De aceea folosim un serviciu de facturare care face asta singur.
3. **TVA:** sub pragul legal nu suntem plătitori. Contractul spune „tarifele nu includ TVA; se adaugă dacă e cazul”. Contabilul confirmă cum facem cu facturile de la Google, Supabase și ceilalți furnizori din străinătate.
4. **Plus prin Google Play:** Google încasează de la oameni și ne plătește nouă. Contabilul confirmă cum se înregistrează.
5. **Biletele (faza 3):** banii nu trec prin contul nostru. Se folosește un procesator care împarte plata direct (Netopia sau Stripe): localul primește partea lui, noi comisionul. Așa nu ținem banii altora și nu rămânem noi cu rambursările.
6. **Cât păstrăm documentele:** cât cere legea, conform contabilului.

---

## 15. În ce ordine construim

**Faza 1, ca să lansăm cu primii 5–10 parteneri:**
- **Admin:** cereri de parteneriat, parteneri, treapta, statutul de fondator, echipa, jurnalul (locurile și semnalările există deja).
- **Business:**
  - intrarea și revendicarea, contractul;
  - profilul și codul QR;
  - echipa cu coduri;
  - rezervările și sosirile;
  - Live Drops cu regulile din baza de date;
  - programul Plus;
  - statistici simple;
  - Plăți, cu „ai fi plătit” în lunile gratuite.
- **Client:** rezervarea la parteneri, Live Drops, „Am ajuns”, ecranul de sosire, întrebările de după, Plus de pe server, bonul păstrat.
- **Banii:** taxele se scriu din prima zi, chiar dacă primii parteneri au 3 luni gratis. Așa verificăm motorul de bani pe date reale înainte să emitem vreo factură.

**Faza 2, gata înainte de luna a 4-a a primului fondator:**
- luna (lista, contestațiile, factura prin serviciul cu e-Factura), plățile, întârzierile;
- corecțiile cu două persoane, verificările de noapte;
- Plus plătit prin Google Play.

**Faza 3:** biletele (procesator care împarte plata), evenimentele „Sponsorizat”, abonamentul pentru uneltele Business.

**Unde stau Business și Admin:** două site-uri separate din același cod (de exemplu business.cefaci.ro și admin.cefaci.ro).
Admin nu e expus localurilor. Găzduirea gratuită (Cloudflare Pages, Netlify sau Vercel) cere un cont făcut de Cornel.

---

## 16. Ce trebuie să hotărască Cornel

1. **„Clienți Plus: 0 lei”** înseamnă doar vizitele cu reducerea Plus (fără rezervare și fără drop)? Recomandarea: **da**. Rezervările și drop-urile se plătesc la fel pentru toți.
2. **Reducerea Plus neaplicată:** clientul primește zile de Plus, localul avertisment și apoi iese din program, fără bani mutați? Recomandarea: **da**.
3. **SRL înainte de prima factură?** Recomandarea: **da**, de discutat cu contabilul.
4. **Verificarea localului la început:** sunăm noi la telefonul public al localului, gratis, cât sunt puțini? Mai târziu, SMS sau apel automat, care costă. Recomandarea: **noi sunăm**.
5. **Serviciul de facturare cu e-Factura:** Oblio, SmartBill sau FGO. Ne trebuie la faza 2.
6. **Domeniul și găzduirea** pentru Business și Admin (de exemplu cefaci.ro).
7. **Cifrele de mai jos, ca pornire:**
   - răspuns la rezervare în 30 de minute (15 dacă e curând);
   - masa ținută 15 minute;
   - 3 neveniri în 60 de zile înseamnă 30 de zile fără rezervări;
   - 2 oferte expirate înseamnă 7 zile fără drop-uri;
   - 24 de ore pentru „Ați fost 6 sau 4?”;
   - 3 zile de contestații;
   - plata în 15 zile;
   - 30 de zile de întârziere până la pauză;
   - pragul de 30 de lei;
   - 100 de lei pentru corecțiile cu două persoane.

---

## Anexa A. Tabelele și funcțiile (pentru construcție)

Toate sumele sunt **în bani** (1 leu = 100 de bani), număr întreg, moneda RON. Ora se ține cu fus orar; ziua de lucru
e `(ora în Europe/Bucharest − 5 ore)::date`. Toate scrierile trec prin funcții `security definer` care verifică rolul,
blochează rândul (`for update`) și scriu în jurnal. RLS e închis implicit.

**Parteneri**
- `firms` (cui unic, nume, adresa, reg_com, verificată_anaf_la, email_facturare)
- `partners` (venue_id unic → firm, status: ciorna | in_verificare | activ | pauza | iesit, activat_la, iesit_la)
- `partner_terms` (venue_id, treapta: mic | mediu | mare, fondator, valabil_de_la, valabil_pana_la, motiv, pus_de) — istoric, fără suprapuneri (constrângere de excludere)
- `free_periods` (venue_id, cui, de_la, pana_la, prelungit_pana_la) — unic pe (cui, venue_id)
- `contracts` (versiune, text), `contract_acceptances` (venue_id, versiune, user_id, la, ip)
- `partner_requests` (cerere sau dispută, verificări, document în bucket privat, decizie, decis_de)
- `partner_members` (venue_id, user_id, rol: proprietar | manager | receptie | scanare, stare, program, adăugat_de)
- `staff_invites` (cod hash, venue_id, rol, expiră_la, folosit_la, device)
- `partner_settings` (rezervări: locuri pe oră, ținut minute, anulare gratuită până la, auto-confirmare până la N; Plus: participă, procent 10 | 15 | 20, zile/ore excluse, valabil_de_la)

**Rezervări, oferte, sosiri**
- `reservations` (venue_id, user_id null la ștergere, adulți, copii, ora, stare, motiv, istoric stări)
- `drops` (venue_id, fel, reducere_toti 10–15, reducere_plus ≥ toti+5 ≤ 30, locuri, rămase ≥ 0, grup_minim, public: toti | noi, start, plus_de_la = start − 10 min, sfarsit ≤ start + 4 h, stare) — un singur drop activ pe local (index unic parțial)
- `drop_claims` (drop_id, user_id, locuri, expiră_la = luat + 45 min, stare) — o ofertă activă pe client; scăderea locurilor într-o singură instrucțiune: `update … set ramase = ramase − n where ramase >= n`
- `venue_codes` (venue_id, token aleator, activ, rotit_la) — codul de la bar; se poate schimba
- `arrivals` (venue_id, sursa: rezervare | drop | plus | plan, sursa_id, zi_lucru, adulti_client, adulti_local, copii, dovezi: scanare | locatie | local | cod_bilet, stare: deschisă | definitivă | contestată | anulată, definitivă_la) — unic pe (sursa, sursa_id); o sosire pe grup și seară la un local
- `arrival_events` (cine, ce, la) — istoric

**Bani**
- `tariffs` (treapta, fel, standard_bani, fondator_bani, valabil_de_la)
- `charges` (arrival_id **unic**, venue_id, zi_lucru, fel, oameni_platiti, tarif_bani, suma_bani, iertată, stare: deschisă | în_listă | facturată | contestată) — **nu se modifică după facturare**
- `adjustments` (venue_id, charge_id opțional, suma_bani ±, motiv, propus_de, aprobat_de, la)
- `statements` (venue_id, luna, total_bani, report_bani, stare: ciorna | contestare | închisă), `statement_lines`
- `disputes` (charge_id, motiv, răspuns, decis_de, rezultat)
- `invoices` (cui, luna, total_bani, furnizor_id, numar, emisă_la, scadentă_la, stare: emisă | plătită | stornată), `invoice_lines` (charge_id unic pe factură nestornată)
- `payments` (invoice_id, suma_bani, la, referință, marcat_de)
- `plus_entitlements` (user_id, sursa: proba | google_play | compensare, de_la, pana_la, token Google verificat) — Plus activ = există un rând care acoperă clipa de acum
- `plus_issues` (arrival_id, user_id, răspunsul localului, decizie)
- `bills` (venue_id, user_id null la ștergere, zi, total_bani, oameni, grupe) — de la `citeste-bon`
- `admin_log` (cine, ce, țintă, înainte, după, motiv, la) — pentru tot ce nu are jurnal propriu

**Funcții (exemple)**
- client: `reservation_request`, `reservation_cancel`, `drop_claim`, `arrival_scan(token, lat, lon, acc, mocked)`, `arrival_checkin`, `arrival_people_answer`, `plus_issue_report`
- Business: `reservation_confirm | decline | propose`, `arrival_mark(venue, sursa, adulti)`, `arrival_no_show`, `arrival_turned_away`, `drop_create | stop`, `partner_settings_save`, `staff_invite`, `staff_remove`, `statement_dispute`
- Admin: `partner_request_decide`, `partner_terms_set` (fondator pentru statutul de fondator), `free_period_set`, `dispute_decide`, `adjustment_propose | approve`, `month_close` (job), `invoice_issue` (prin furnizor), `payment_mark`, `plus_issue_decide`, `reconcile` (job de noapte)
- job-uri (pg_cron): expirarea cererilor și a ofertelor luate, ferestrele de 24 de ore, sosirile definitive, luna pe 1, factura pe 4, amintirile de plată, pauza la 30 de zile, verificările de noapte

**Teste:** fiecare rând din exemplele de calcul (cap. 7.6) devine un test pe baza de date (ca `tests/db.test.ts`), plus:
- două scanări în același timp;
- două oferte luate pe ultimul loc;
- noaptea de schimbare a orei;
- ultima zi din lună;
- un cont șters cu taxe;
- un local cu două treapte în aceeași lună.
