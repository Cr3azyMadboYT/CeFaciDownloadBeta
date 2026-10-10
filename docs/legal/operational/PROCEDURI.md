# Proceduri: drepturi, ștergere și incidente

Actualizat: 10 octombrie 2026. Canal unic verificat: contact@cornacidev.ro. Responsabil operațional, înlocuitor și avocat/contabil trebuie desemnați; codul nu monitorizează singur cutia poștală și nu trimite notificări către autorități.

## Cereri ale persoanelor

1. Înregistrează data primirii, canalul, persoana, dreptul, scopul, categoriile, numărul de caz și termenul. Cererile prin email/alte canale valabile se gestionează și dacă nu apar automat în Admin. Limita tehnică a formularului nu poate elimina canalul alternativ pentru drepturi.
2. Verifică identitatea proporțional. Contul autentificat este o dovadă utilă; nu cere implicit copie act/CNP. Dacă există îndoieli rezonabile, explică informația minimă suplimentară. Nu dezvălui unui reclamant neautorizat datele altuia.
3. Deadline: **o lună calendaristică**, nu30 de zile fixe. Pentru cereri complexe/numeroase poți prelungi cu cel mult două luni și comunici motivul în prima lună. Folosește termenul serverului; nu edita data din browser și nu aplica automat prelungirea tuturor cererilor.
4. Colectează datele din toate scopurile relevante: Auth/profile/privateprefs, relații/planuri/voturi, bilete/rezervări/vizite/bonuri, suport/proof, drepturi/istoric, roluri/log/trial/push și eventuale exporturi externe. Exportul rapid are acoperire limitată și ultimele 100 de cereri, nu este un răspuns final complet.
5. Pentru acces, livrează și informațiile art. 15, cu protejarea drepturilor altor persoane și redacții motivate. Pentru portabilitate, separă datele aplicabile art. 20 și livrează un format structurat utilizabil, fără a eticheta fiecare jurnal intern drept portabil.
6. Pentru rectificare, modifică numai câmpurile permise și consemnează corecția; unele câmpuri precum data nașterii blocate în UI necesită analiză de operator. Pentru restricționare/opoziție, documentează schimbarea tehnică sau motivul unei excepții; simpla stare „răspuns” nu execută efectiv restricția.
7. Explică un refuz parțial/complet, temeiul, datele păstrate și dreptul de plângere/instanță. Răspunsul Admin trebuie să fie complet, fără secrete sau datele terților. Înregistrează când și cum a fost comunicat; nu considera automat o stare DB dovadă că persoana a citit mesajul.
8. Închide cazul numai după execuție și verificare. Păstrează o evidență minimă pentru demonstrarea conformării, cu termen justificat și acces limitat; descrierile/răspunsurile pot fi personale după uid NULL și necesită cleanup.

## Ștergere manuală și backup

`delete_my_account()` permite ștergerea imediată doar conturilor simple. Refuză înaintea ștergerii când există rol staff/member, rezervări, revendicări Drop, vizite/bonuri, cerere Business, fișier privat ori cerere GDPR deschisă. Un refuz este o trimitere către analiza manuală, nu o excepție legală automată pentru păstrarea tuturor datelor.

Analiza manuală: verifică cererea și temeiurile de retenție, anulează/soluționează operațiunile când legal necesar, retrage rolurile și închide sesiunile, redactează textele/atașamentele, șterge binarele prin API, elimină identitatea prin circuitul autorizat, verifică tokenurile/notificările și exporturile, apoi confirmă. Pentru localuri stabilește continuitatea reprezentării prin mandat verificat; nu transfera automat owner la un altcont. Nu face SQL distructiv generic pe datele reale fără analiză și backup.

Hashul trial persistă fără uid în implementare: justifică termenul și opoziția, decide eliminarea/restricția după LIA. Istoricele fără uid nu sunt garantat anonime. Backupurile pot conține date șterse până la expirarea ciclului; se izolează de utilizarea curentă și, la o restaurare, se reaplică lista cererilor de ștergere/restricție. Documentează ciclul real furnizorului, nu un termen inventat.

## Încălcări ale securității datelor — art. 33/34 GDPR

1. **Imediat:** înregistrează momentul primei luări la cunoștință, sistemul, tipul evenimentului și investigatorul. Restricționează accesul, revocă roluri/sesiuni/tokenuri afectate și securizează probele fără a exporta masiv date personale. Nu șterge logurile care ar demonstra incidentul.
2. Determină dacă este un incident de date (confidențialitate, integritate sau disponibilitate), categoriile/numărul aproximativ de persoane și înregistrări, durata, destinatarii, caracterul sensibil, minori/locație/bonuri, măsurile și consecințele posibile. Un bug vizual nu este automat breach; indisponibilitatea poate fi breach dacă afectează datele.
3. Evaluează riscul pentru persoane și consemnează motivarea. **Notifică ANSPDCP fără întârzieri nejustificate și, când este posibil, în cel mult72 de ore de la luarea la cunoștință**, cu excepția cazului în care este improbabil un risc. O investigație incompletă nu suspendă automat termenul; informațiile se pot completa etapizat. Justifică întârzierile.
4. Dacă există risc ridicat, informează persoanele fără întârzieri nejustificate, în limbajclar, cu măsurile și contactul. Verifică excepțiile legale art. 34 înainte de a decide că nu trebuie comunicat. Nu include în notificaredatele altor victime ori secrete.
5. Dacă CeFaci acționează ca împuternicit pentru un scop, notifică operatorul fără întârzieri nejustificate; contractul trebuie să definească escaladarea. Personalul/localul/furnizorul nu decide unilateral notificarea în locul operatorului.
6. Păstrează registrul tuturor încălcărilor și deciziilor, inclusiv cele nenotificate: fapte, efecte, remedieri, termene/notificări, dovezi și revizuirile controalelor. Condu un exercițiu cu date sintetice și responsabilii desemnați.

Model registru: `incident_id`, `aware_at`, `detected_by`, `systems`, `data_categories`, `subjects_approx`, `records_approx`, `confidentiality/integrity/availability`, `containment`, `risk_assessment`, `authority_due_at`, `authority_notified_at`, `individuals_notified_at`, `delay_reason`, `legal_decision`, `corrective_actions`, `closed_at`. Jurnalul rămâne privat și nu se pune în repo dacă include date personale/secrete.
