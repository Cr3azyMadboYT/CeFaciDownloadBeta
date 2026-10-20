# Intrarea și bonul: cum câștigă CeFaci bani (decizie Cornel, 20.10)

Înlocuiește taxele pe om (rezervare 2/5/8, Live Drop 3/7/10, din plan 1/3/5) și treptele de preț.
**Regula: localul partener dă CeFaci 10% din bonul fiecărei intrări CeFaci.** Același procent pentru toate localurile.
Nu se mai numără oameni, nu mai există trepte, plafoane pe masă sau taxe diferite după cum a venit omul.

## Cuvintele
- **Intrarea** = o gașcă (sau o singură persoană) venită la un local partener din CeFaci, într-o seară. Are un număr
  (#12), ora sosirii, câți sunt în plan, masa (opțional) și bonurile.
- **Bonul** = nota fiscală de la local. Una sau mai multe pe intrare (note separate se adună).
- **Datorat** = 10% din suma bonurilor intrării, rotunjit la bani.

## Fluxul, de la plan până a doua zi

### 1. Planul (aplicația de client)
Omul face planul (Creează plan / Surprinde-mă / FreeNow / O construiesc eu) și apasă „Facem așa”: primește biletul.
Dacă planul e trimis gășcii, toți cei care au zis „Vin” sunt în aceeași intrare.

### 2. „Ai ajuns?”
- **Cu locația pornită:** când telefonul e la cel mult 150 m de local, în fereastra planului (de la 30 de minute înainte
  până la 3 ore după ora planului), aplicația întreabă: **„Ai ajuns la Aubergine?”** (pe Acasă și pe bilet; cu
  notificare dacă aplicația e închisă).
- **Cu locația oprită:** aceeași întrebare apare pe bilet și pe Acasă la ora planului, fără locație.
- Butoane: **„Da, scanez codul”** / „Încă nu”.

### 3. Scanarea codului de pe masă
- Se deschide camera. Codul CeFaci al localului e lipit pe masă sau la bar.
- Codul scanat trebuie să fie al localului din plan. Altfel: „Codul ăsta e de la alt local.”
- Dacă nu merge camera: „Scrie codul de sub QR” (6 caractere).
- Rezultat: **„Ați ajuns! Intrarea #12 · Andrei + 4”**. Toată gașca vede același lucru; dacă al doilea om scanează,
  intră în aceeași intrare (nu se face alta).

### 4. „La ce masă stați?” (opțional)
Numerele 1–40 sau „scriu eu”, cu **Continuă** și **Sari peste**. Masa doar ajută ospătarul să găsească intrarea.

### 5. Ospătarul vede intrarea imediat
În CeFaci Business, **Intrări deschise acum**: „#12 · Andrei + 4 · masa 7 · 20:14 · așteaptă bonul”.

### 6. După 40 de minute: „Nu uita de bon”
Notificare de la Bilu: „Nu uita de bon, ne ajută și pe noi și pe tine :)” (a doua: a doua zi la prânz).
Pe bilet: **„Scanează bonul”**.

### 7. Bonul: trei căi, oricare ajunge
1. **Clientul face poză bonului.** Serverul citește firma (CUI), data, ora, numărul bonului și totalul.
2. **Ospătarul scanează biletul clientului** (codul de pe biletul din aplicație) și face poză notei.
3. **Ospătarul alege intrarea din listă** (după masă, nume, oră) și face poză notei.

Reguli pentru bon:
- Același bon (aceeași firmă, același număr, aceeași zi) se numără **o singură dată**, oricâți l-ar scana.
  Pe intrare scrie **„bon scanat de 3/5”** (câți din gașcă l-au scanat).
- Note separate (fiecare plătește a lui): toate se adună la aceeași intrare.
- Bonul se primește doar dacă: e de la firma localului, are data serii, ora bonului e după sosire, nu e mai vechi de
  ~26 de ore. Altfel: „Bonul ăsta nu pare de la seara asta.”
- Cine scanează bonul primește **+25 XP** și ștampila serii (o dată pe om pe intrare).

### 8. Plata la masă
Clientul arată biletul („Arată biletul la plată”), ospătarul îl scanează și face poza notei (calea 2).

### 9. Închiderea intrării
- Intrarea se închide când are cel puțin un bon. Mai pot veni bonuri (note separate) până a doua zi la 12:00.
- O intrare fără niciun bon până a doua zi la 12:00 rămâne **„fără bon”: nu se plătește nimic** (la dubiu nu facturăm).
  Localul o poate închide scriind totalul și făcând poză notei; intrările lăsate des fără bon coboară localul în
  recomandări (nu-l amendăm).

### 10. A doua zi: dashboardul proprietarului (Business)
- **Ieri:** câte intrări, câți oameni, suma bonurilor, datorat (10%), câte fără bon.
- Lista intrărilor: #12 · Andrei + 4 · masa 7 · 20:14 · bon 420 lei · scanat de 3/5 · CeFaci 42 lei, cu poza bonului.
- **„Nu e al lor”** pe orice bon: îl contestă (motiv obligatoriu), iar echipa CeFaci verifică.
- Luna: lista pe 3 ale lunii, 5 zile lucrătoare pentru contestații, factura prin e-Factura, plata în 15 zile.

## Ce rămâne
- Fondatorii (primele 20 de localuri): 3 luni gratis de la activare (+ până la 3 luni dacă n-a venit nimeni).
  Intrările din lunile gratuite apar cu „ai fi plătit X”.
- Reducerile (Plus, Live Drop): un singur procent pe toată nota; 10% se ia din totalul de pe bon (după reducere).
- Copiii, plafoanele, treptele: nu mai contează la bani.

## Simularea
În ambele aplicații există **„Simulează o seară”** (Setări / Profil la client, meniul Business): rulează tot fluxul de
mai sus pe date de probă, fără server și fără bani reali: plan → „Ai ajuns?” (cu sau fără locație) → scanare cod →
masa (Continuă / Sari peste) → 40 de minute mai târziu → bonul (client sau ospătar) → plata → a doua zi, dashboardul.
Butoanele de simulare înlocuiesc camera și locația („Simulează scanarea”, „Simulează poza bonului”).
