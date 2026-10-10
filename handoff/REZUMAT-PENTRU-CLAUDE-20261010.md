# CeFaci — handoff pentru Claude, 10 octombrie 2026

Citește întâi `handoff/PROMPT-CODEX-CLOUD.md`, apoi acest rezumat și `docs/livrare/RAPORT.md`. Repo: `Cr3azyMadboYT/CeFaciDownloadBeta`, ramură de lucru `codex/cefaci-client-business-20261008`, PR draft #2. Nu modifica ramurile backup, nu reseta datele și nu redesena Clientul. Istoricul conține commituri și pushuri reale pentru fiecare etapă. Documentele de livrare descriu sursele exacte ale artefactelor; commitul HEAD nu este automat commitul dintr-un APK mai vechi.

## 1. Client și motorul comun

Clientul real este `mobile/`, React Native + Expo, nu pagina web veche. Familia vizuală Claude/CeFaci a fost păstrată: Bilu, fonturi Bricolage Grotesque / Instrument Sans / Caveat, culori, carduri, bilete, zi/noapte și canvasuri. `src/` conține motorul și regulile comune; `shared/` componente/contracte pentru aplicații.

- Grupurile pot avea 6+ persoane. Participarea „Vin / Nu pot” este separată de votarea activității. Organizatorul participă; invitații fără cont sunt reprezentați explicit.
- Rezervarea așteaptă răspunsurile sau cele 30 minute calculate pe server. Lipsa răspunsului înseamnă neparticipare, fără penalizare no-show. Numărul real al grupului este comun Client/Business/bilet.
- Rezervarea este idempotentă, cu capacitate ocupată atomic. Business confirmă/refuză/propune altă oră; propunerile expirate eliberează capacitatea. Grupurile de minimum opt persoane cer confirmare manuală.
- Vizibilitatea pentru descoperire respectă pauza localului și rezervările obligatorii/recomandate/nenecesare; istoricul și rezervările confirmate sunt păstrate.
- Plus al unui participant eligibil se aplică întregii note eligibile a grupului; limita veche de patru persoane a fost eliminată. Live Drops respectă stocul, grupul, calendarul, vârsta și celelalte garduri server.
- Sosirea, scanarea și vizita au identitate comună; retry sau scanările simultane nu dublează vizita. Bonurile au verificări pentru participant, CUI, timp și duplicate; salvarea nu depinde de XP.
- Calcul financiar cu trepte, fondatori, perioade gratuite, copii, surse mixte/zero-comision, sumă canonică, corecții și contestații versionate. `billing_ready=false`: nu se inventează încasări/facturi active.

## 2. Business nativ și web

`business/` este o aplicație React Native/Expo cu export web responsive pentru gazduire.net, fără WebView. Include Azi, Rezervări, Scanner/manual, Oferte/Live Drops, Financiar, Statistici, Profil, Echipă și Ajutor, filtrate după rolul de la server și localul selectat. Conturile Client/Business sunt comune; datele profilului existent nu sunt suprascrise de o cerere de parteneriat.

Am completat fluxurile semnalate ulterior de utilizator:

- „Ai deja cont? Intră”: OTP numai pentru cont existent, fără creare implicită.
- „Revendică localul”: căutare, selectare, date solicitant/firmă/CUI și dovadă privată.
- „Nu găsesc localul”: cerere de adăugare primită în Admin; nu publică automat localul.
- Local deja revendicat: dispută documentată, notificare autorizată către proprietarul actual și fereastră de răspuns de trei zile. Solicitantul nu își acordă singur acces.
- Cereri proprii cu stări, retragere și retry. Confirmarea emailului, depunerea cererii sau aprobarea verificării nu echivalează cu activarea parteneriatului.
- Verificarea efectivă disponibilă este manuală cu documente; nu sunt simulate ANAF/ONRC, SMS/apel, contract semnat ori notificare de probă. Activarea are condiții distincte.

Detalii: `docs/livrare/ONBOARDING-BUSINESS-20261009.md`.

## 3. Admin și legătura cu celelalte aplicații

`admin/` este dashboardul web CeFaci conectat la același backend. Include cereri de local/parteneriat, semnalări, catalog/localuri, parteneri, sosiri, oameni, Plus, financiar, echipă și jurnal, după permisiunile reale ale rolului. Deciziile și operațiunile sensibile sunt validate pe server, cu istoric/versionare unde este necesar.

„Lipsește un loc” din Client și solicitările Business ajung la Admin. Raportarea problemelor este discretă în profilul Clientului și în Ajutor la Business: titlu, descriere și fotografie opțională. Fotografiile sunt private; Admin vede raportările prin acces autorizat. Există stări/răspunsuri și garduri contra duplicatelor și răspunsurilor întârziate.

`contact@cornacidev.ro` are rolul **fondator**, acordat în baza de date. Login Admin: emailul contului existent → cod email → TOTP personal. Rolul nu elimină MFA. Autentificatorul trebuie configurat de titular; nu am inventat parole, factori sau coduri prin SQL.

## 4. Securitate și tutoriale

- MFA TOTP obligatoriu pentru cele șase roluri Admin și patru roluri operaționale Business; serverul verifică sesiunea Auth, factorul, rolul live, localul și interdicțiile.
- Admin: 15 minute inactivitate / maximum 8 ore. Business: 30 minute / maximum 12 ore. Pollingul nu menține sesiunea vie; expirarea/revocarea cere o verificare nouă.
- Web: `sessionStorage`; Business nativ: SecureStore, Android Keystore/iOS Keychain. Fără fallback de token în clar; sesiunile vechi persistente sunt curățate.
- RLS/grants/RPC, bucketuri private, operațiuni privilegiate refuzate anonimilor, rute legacy protejate. `user_metadata`, un meniu ascuns sau un JWT vechi nu acordă drepturi.
- În interfață, logout, schimbarea contului/localului/rolului și răspunsurile întârziate nu trebuie să reintroducă datele vechi.
- Web static: HTTPS/CSP/HSTS/anti-embedding/MIME/cache adecvat. Pachetele nu conțin chei service-role, keystoreuri sau parole. Dimensiunea mică a fișierelor nu măsoară securitatea.
- Tutoriale Bilu pe rol pentru Admin și Business, inclusiv solicitant fără local, replay, zi/noapte și accesibilitate. Turul este filtrat după drepturile reale; nu execută operațiuni și nu acordă acces.
- S-au făcut audituri cu agenți pentru Client, Business, Admin, backend, integrare și securitate. Constatările și corecțiile sunt în rapoartele din `docs/livrare/`.

Detalii: `SECURITATE-ADMIN-BUSINESS-20261009.md`, `TURURI-PE-ROLURI.md`, `AUDIT-20261009.md`. Nu afirma securitate absolută. Protecția Supabase pentru parole compromise rămâne neactivată în configurația existentă; dashboardurile implementate folosesc OTP + TOTP.

## 5. Site cefaci.app, juridic și GDPR

`website/`: site public modern în aceeași familie vizuală, responsive, Bilu, zi/noapte, fonturi locale licențiate, progresul celor trei produse și nouă pagini juridice. ZIP pregătit pentru gazduire.net; nu există o publicare efectuată în lipsa accesului la hosting/DNS.

Documente comune în `shared/legal-config.ts` / `shared/legal-content.ts`: confidențialitate, termeni Client, termeni Business beta, reguli Admin, cookies/stocare, drepturi, securitate, contact și ștergerea contului. Se citesc offline în aplicații, înainte de login/MFA. Site-ul nu introduce analytics/cookies publicitare; stocarea temei este explicată și poate fi ștearsă.

Cereri GDPR reale: cereri proprii idempotente, istoric paginat, export de bază limitat, răspunsuri versionate. Inbox Admin doar fondator/admin cu MFA, termene/prelungiri motivate/jurnal imuabil. Drepturile proprii la `aal1` nu dau acces operațional. Ștergerea directă este disponibilă numai pentru cazurile simple; cele cu date asociate merg la evaluare. Un răspuns în inbox nu pretinde că ștergerea a fost executată.

**Decizii juridice ale utilizatorului:** nu are încă firmă; contact `contact@cornacidev.ro`; deocamdată nu publicăm numele și adresa. Nu inventa firmă/CUI/sediu/DPO. Documentele sunt provizorii, iar identitatea operatorului trebuie completată înaintea unei lansări conforme. Dosarul `docs/legal/operational/` conține registre/proceduri GDPR, incidente, retenție, DPIA/LIA, fiscal/consumatori și surse oficiale. Contractele furnizorilor, retenția și ștergerea fizică programată mai cer configurare. Nu pretinde integrare ANAF/SPV sau conformitate juridică integrală.

## 6. Backend instalat, teste și builduri livrate

Unicul proiect vizat: CeFaci2.0 `vqrmwuarjjntusfbqprx`. Au fost instalate migrații aditive pentru regulile Client/Business, onboarding, Admin, securitate și drepturi GDPR. Ultima migrare juridică live: `20261010072621_cefaci_privacy_rights`; securitate: `20261009215832`. Snapshoturi și revenire documentate. Nu s-au resetat datele și nu s-au creat conturi/raportări/bonuri/emailuri fictive în producție. Utilizatorul a confirmat că el a șters anumite profile; agentul nu a făcut acele ștergeri.

Ultima livrare completă verificată înaintea iconițelor/notelor de cont: Client **0.3.3/code6**, Business **1.0.5/code6**, sursă `b98721b5c576cfe8f158520f969650b5a63a764a`, workflow **38033998387 SUCCESS**. Site final `9eb728c254a5a678db18e2984e6970d27a461aa7`. APK/AAB sunt builduri Gradle reale semnate cu cheia originală, nu bundleuri JS redenumite. Certificat SHA-256 `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`.

Suita livrării precedente: 484 teste trecute + un test opțional omis, typecheck toate trei, 19 scenarii concurente PostgreSQL 17, teste browser pe roluri și fluxuri, Apache/CSP, digesturi/CRC/checksumuri, manifestele APK și semnăturile APK/AAB. Probe HTTP live read-only, fără scrieri către persoane reale.

`release/`: APK/AAB/proiect iOS pentru Client și Business, ZIP web Business/Admin/site, capturi și dovezi. Proiect iOS **nu înseamnă IPA**: pe Ubuntu nu avem compilare/semnare Apple sau test pe telefon fizic. Apple Developer a fost discutat, dar nu este configurat aici. Nu există încă test end-to-end pe telefoane fizice, OTP primit efectiv de titular ori OCR cu bon real.

## 7. Video de prezentare

Teaser Client **48 secunde, vertical 1080×1920**, cu Bilu și ecrane reale de test, mesaj „în curând pe Android și iOS”, pentru promovare TikTok Ads. MP4 H.264/AAC, muzică originală compusă procedural, fără samples/melodii terțe/voci clonate/testimoniale. Kitul include copertă, WAV, surse, ghid și proveniență/licențe. Nu este publicat ca reclamă și nu există o aprobare garantată de TikTok.

Fișiere: `release/video/CeFaci-Client-teaser-48s.mp4`, `release/video/CeFaci-TikTok-Ads-kit.zip`; surse `marketing/client-teaser/`; drepturi `RIGHTS.md`. Checksumuri în `docs/livrare/VIDEO-TIKTOK-SHA256.txt`.

## 8. Ultima livrare — iconițe sezoniere și nota juridică de cont

Utilizatorul a aprobat Bilu Business cu **servietă mai mare**. Propunerea de toamnă și versiunea originală sunt păstrate în `design/proposals/business-icon/`, commituri `09888ed` / `2de3227`.

Finalizat după aceste aprobări:

- Cinci iconițe Business: primăvară, vară, toamnă, iarnă și Crăciun, toate cu servietă mare; foreground transparent și fundaluri din familia Clientului. Nu înlocuim iconițele Clientului.
- Schimbare sezonieră nativă Business, calendar comun Client: Android alias în fundal; iOS API public pentru alternate icons în prim-plan, cu notificarea standard posibilă a sistemului. Aplicația închisă nu poate executa singură cod pentru schimbarea iconiței.
- Text discret la crearea contului în Client și Business: **„Prin crearea contului accepți Termenii de utilizare și confirmi că ai citit Politica de confidențialitate.”** Linkurile deschid documentele locale corecte; închiderea păstrează formularul. Nu transformăm informarea GDPR în consimțământ universal pentru marketing.
- Buildul Android final este la sursa `26591508a442cfa4b9787afc0a661d3ef9f08668`, workflow `38053659611` **SUCCESS** pentru verificări, Client și Business. Prima rulare `38053584400` a fost anulată înaintea compilării pentru a include manifestul explicit al modulului local.
- Versiuni livrate: Client **0.3.4/code7**, Business **1.0.6/code7**, APK/AAB reale semnate cu cheia originală. Digesturi GitHub, CRC, SHA-256, manifestele binare și semnăturile APK/AAB sunt verificate.
- 492 teste trecute + un test opțional omis, inclusiv opt regresii pentru iconițe; typecheck toate trei, 19 scenarii concurente PostgreSQL și toate verificările browser au trecut în CI înainte de Gradle. Weburile CI au fost retestate pe Apache/CSP.
- Proiectul iOS Business este generat local din `3c922ab6ec3a3a09bc80ed1145bdab491a27e1cb`, cu iconițe RGB fără alpha, necesare App Store. Nu este IPA. Originalul CI este păstrat separat; corecția iOS nu schimbă outputurile Android.
- Site final `011748c477632130c6bac93c8d12e7d1f6b03e0f`, cu versiunile confirmate; pachetele sunt în `release/`, checksumurile și toate mappingurile în `docs/livrare/RAPORT.md`.

Pentru starea exactă ulterioară acestui rezumat, citește `docs/livrare/RAPORT.md`, metadatele în `docs/livrare/builds/`, ultimul workflow și istoricul Git. Nu atribui noile funcții APK-urilor vechi.

## 9. Backupuri și pași operaționali rămași

Backupuri remote păstrate: `backup/claude-original-20261008` (`9d1e02c`), `backup/cefaci-current-20261008` (`45ad496`), `backup/cefaci-security-20261010` (`fc91382`). Livrările vechi și metadatele rămân în subdirectoare `previous-*`; înainte de iconițe s-a salvat `previous-season-icons-20261010`.

Au fost discutate și costul contului Apple Developer și trecerea ulterioară la firmă; acestea sunt informații/pași de cont Apple, nu o integrare activată în proiect. Utilizatorul a trimis și `studio-update-v12.zip` pentru comparația cu Studio cornacidev.ro; acest handoff nu atribuie arhivei un verdict de securitate fără raportul comparativ verificabil.

Limite Admin din livrarea documentată: blocarea globală a conturilor și statisticile detaliate de consum din roadmap nu sunt implementate; nu există acțiuni care să simuleze aceste rezultate.

Rămân externe livrării: upload hosting/DNS, identitatea operatorului și firma/modelul comercial, contracte și activarea reală a partenerilor, furnizori ANAF/ONRC/SMS/apel/notificări, facturare/plăți/Plus plătit, scheduler de ștergere fizică și configurări de retenție, circuit Apple/macOS și testare fizică. Nu inventa aceste integrări și nu elimina gardurile serverului pentru a face demonstrații.
