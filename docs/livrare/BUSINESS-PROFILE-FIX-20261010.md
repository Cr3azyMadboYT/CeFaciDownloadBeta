# Business — formular și navigare pe telefon, 10.10.2026

Corecțiile pornesc de la captura trimisă de utilizator și sunt comune web, Android și iOS, în `business/src/`.

- Opțiuni este un control mic de 44 px. Modul zi/noapte, reluarea Turului cu Bilu și Termeni/Confidențialitate/Datele mele apar la deschiderea meniului. Documentele sunt accesibile și înainte de autentificare. Barele permanente mari au fost eliminate. Turul automat inițial rămâne pe cont/rol, se poate închide și nu execută operațiuni asupra datelor.
- Username-ul este normalizat și verificat prin RPC-ul existent `username_available`, după 400 ms. Formatul este identic constrângerii DB: 3–20 caractere, litere mici, cifre, punct, cratimă și underscore. Butonul Salvează rămâne blocat până la disponibilitatea confirmată a numelui curent. Erorile au reîncercare explicită; răspunsurile vechi sunt ignorate după editare/ieșire/schimbare de cont.
- Unicitatea serverului rămâne obligatorie. Dacă alt cont ocupă username-ul între verificare și salvare, contul nu este creat cu date greșite și UI cere alt username. Un profil Client existent nu se suprascrie.
- Zi/Lună/An înlocuiesc câmpul rigid AAAA-LL-ZZ. Se validează calendarul, inclusiv anii bisecți, și vârsta minimă 16 ani. Nu se precompletează o dată inventată. Serverul validează din nou la salvare.
- MFA, rolurile de la server, RLS, documentele private și memorarea loginului web rămân active. Nu este necesară o migrare nouă pentru aceste corecții.

## Verificare înainte de compilare

Local: 517 teste trecute, unul opțional omis; typecheck Business și audit proiect iOS. Testul browser include username invalid/ocupat/disponibil, eroare și retry, răspuns vechi după editare, conflict de unicitate la salvare, dată imposibilă și cont sub 16 ani. Regresii: dashboard Business, onboarding/cereri/dovezi, raportări, MFA și tutoriale pe toate rolurile, documente și export, Admin, memorare 15 zile, Client raportări, site și quiz. Toate fixture-urile sunt locale/interceptate, fără conturi sau mesaje fictive în producție.

Testul Admin a fost sincronizat cu finalizarea efectivă a salvării înainte de redeschiderea editorului. Nu au fost eliminate verificările sau gardurile de securitate. Auditul APK compară acum versiunea cu configurația sursei, în locul unui code7 fix din livrarea precedentă.

## Instalare

Business este 1.0.7 / Android code8 / iOS build8. Android code8 se instalează peste code7 cu aceeași semnătură de producție, fără dezinstalare și pierderea contului. Păstrează backupul privat `release/previous-business-profile-20261010/`.

Pentru web, extrage `CeFaci-Business-web.zip` în document-root-ul Business, inclusiv `.htaccess`: întâi asseturile cu hash, apoi index.html și version.json. HTML/versiunea nu trebuie servite din cache; verifică commitul din version.json. Admin și site-ul nu au nevoie de înlocuire pentru aceste corecții Business. Kitul istoric de quiz include weburile de la lansarea lui; folosește separat ZIP-ul Business actual.

Nu s-a efectuat upload pe hosting. Pentru iOS vezi [IOS-CEFACI-20261010.md](IOS-CEFACI-20261010.md): simulator și arhivă device nesemnată, fără IPA instalabil/TestFlight în lipsa Apple Developer. Android: [GitHub Actions 38087018183](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38087018183) SUCCESS, sursă `7d36324d1113fcfcc8e935f05471bd39680e62f2`. Testele complete preced compilarea. APK-ul este Release, code8/version1.0.7, fără backup/debug/cleartext; AAB-ul are PKCS7 și toate cele 1346 intrări semnate verificate. Certificatul ambelor este `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`, identic livrării code7. CRC, hashul artefactului și sursa web au fost verificate după descărcarea din CI. Dovezile iOS vor fi adăugate după verificarea simulatorului.
