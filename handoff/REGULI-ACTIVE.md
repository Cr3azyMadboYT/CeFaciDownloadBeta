# CeFaci — reguli active pentru Client și Business

Deciziile recente de mai jos au prioritate față de formulele istorice din canvas și documente. Ele sunt cerințe de implementare, nu o afirmație că există deja în cod.

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

