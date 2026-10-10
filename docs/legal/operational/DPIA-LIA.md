# Screening DPIA și analiza interesului legitim

Actualizat: 10 octombrie 2026. Evaluare inițială: operatorul trebuie să aprobe decizia finală cu sprijin juridic. Nu este o certificare de conformitate. RLS, MFA și un DPA al furnizorului nu înlătură automat riscurile.

## Evaluarea impactului — art. 35 GDPR

Scopuri: recomandări, planuri sociale, verificarea vizitelor prin locație și bonuri, cereri Business, suport și administrare. Persoane: clienți, inclusiv cei de 16–17 ani, personalul și reprezentanții localurilor. Date: relații, locurile și orele ieșirilor, coordonate punctuale, documente și istorice. Acestea pot dezvălui indirect informații sensibile chiar dacă produsul nu cere rubrici din art. 9 GDPR.

Codul actual nu solicită urmărire permanentă a locației în fundal și nu declară decizii exclusiv automate cu efect juridic. Există însă recomandări și verificări automate de eligibilitate, combinarea categoriilor și persoane vulnerabile. Scara viitoarei utilizări nu este confirmată. Verifică criteriile EDPB și lista ANSPDCP înaintea unui rollout amplu; nu concluziona că DPIA nu este necesară doar pentru că proiectul este mic sau în beta.

| Risc | Măsuri și verificări | Decizie deschisă |
| --- | --- | --- |
| Expunerea ieșirilor, relațiilor și locației | RLS, participanți autorizați, protecții pentru minori, minimizarea coordonatelor și a retenției | Necesitatea fiecărui câmp și termenul |
| Documente cu date excesive | Bucket privat, acces temporar, redactare înainte de upload, limită de acces 90 de zile | Jobul de ștergere și excepțiile justificate |
| Imagini și texte de suport cu date ale terților | Informare înainte de upload, acces pe rol, redactare la soluționare | Retenția textului și a copiei de lucru |
| Hash persistent pentru proba Plus | ID brut netransmis, hash dublu, uid eliminat după ștergere | TTL, LIA, reguli privind terminalul și opoziție |
| Acces abuziv al personalului sau cont compromis | MFA, rol/local/sesiune, revocare, jurnal, instruire | Revizuirea periodică a mandatelor și accesului |
| Exporturi, backupuri și restaurare | Livrare sigură, minimizare, reaplicarea ștergerilor după restaurare | Ciclul real al furnizorului și responsabilul |
| Transferuri către furnizori | DPA, regiuni și subîmputerniciți, SCC/TIA când este necesar | Dovezile contractuale pentru serviciile active |

DPIA completă descrie operațiunile, scopurile, necesitatea, proporționalitatea, riscurile pentru persoane, măsurile și riscul rezidual, plus consultarea persoanelor când este potrivit. Dacă este probabil un risc ridicat, efectuează DPIA înaintea prelucrării. Dacă rămâne un risc ridicat după măsuri, verifică obligația de consultare prealabilă, art. 36. Revizuiește evaluarea la schimbări. Nu activa recunoaștere facială, publicitate comportamentală sau urmărire în fundal sub același temei fără o analiză nouă.

## LIA — prevenirea reutilizării probei Plus

1. Scop: prevenirea reutilizării aceleiași probe, nu urmărirea pentru marketing. Operatorul documentează amploarea și costul abuzului.
2. Necesitate: compară limitarea pe cont/email, o perioadă scurtă de retenție, un hash temporar și controlul manual. Hashul stabil rămâne un identificator pseudonim. Codul actual nu are TTL; persistența fără termen este o lacună de decis, nu un termen implicit legal.
3. Echilibru: analizează așteptările utilizatorului, dispozitivele împărțite, minorii, erorile și efectul ștergerii contului. O regulă pe telefon poate afecta persoane diferite; oferă contestare umană.
4. Garanții: acces limitat, scop exclusiv antifraudă, termen aprobat, cleanup, separarea uid, opoziție și revizuire. Art. 6(1)(f) GDPR nu înlătură automat acordul pentru accesul la terminal conform Legii 506/2004. Distinge accesul pentru proba Plus de stocarea strict necesară autentificării.
5. Decizie: consemnează responsabilul, data, alternativele, durata, măsurile și justificarea acceptării/refuzului. Nu marca analiza „aprobată” înainte ca operatorul să decidă.

Aplică aceeași structură logurilor și evidențelor de decizie. Interesul legitim nu este un temei universal pentru orice funcție.
