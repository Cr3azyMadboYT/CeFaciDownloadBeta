# Admin și Business: acces securizat și tururi pe rol

Business nativ verificat este la sursa `12ce83b7e6ec6d5fc870de2c8cd8dd8b6b4b2b94`, workflow [37996015334](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37996015334) **SUCCESS**. Weburile finale sunt la sursa `a2e6d5b51ae87981043ac41f785e626caa4ce0ab`, workflow [37997554929](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37997554929) **SUCCESS**, inclusiv regresia schimbării rolului Admin. Migrarea live `20261009215832` este instalată; ZIP-urile web finale au trecut testele Apache și browser cu CSP activ. Business nativ 1.0.4/code5 este construit, semnat și verificat.

## Accesul la date

Toate cele șase roluri Admin și toate cele patru roluri operaționale Business cer MFA TOTP (`aal2`). Serverul verifică identitatea semnată, sesiunea existentă în Auth, utilizatorul asociat, factorul TOTP verificat și legat de sesiune, lipsa anonimatului/ștergerii/interdicției, rolul curent și localul autorizat. O valoare din `user_metadata`, un meniu ascuns sau un token vechi nu acordă drepturi.

| Aplicație | Inactivitate | Durată maximă de la verificare |
| --- | --- | --- |
| Admin | 15 minute | 8 ore |
| Business operațional | 30 minute | 12 ore |

Deadline-urile sunt păstrate și verificate în PostgreSQL. Pollingul și actualizările automate nu prelungesc inactivitatea; interacțiunea utilizatorului poate prelungi numai o sesiune încă activă. După expirare sau închidere trebuie o dovadă TOTP nouă, ulterioară deadline-ului/închiderii. `touch` sau reutilizarea aceluiași JWT nu o reactivează. Logout închide întâi sfera privilegiată, apoi sesiunea Auth.

Permisiunile rămân verificate la fiecare operațiune prin API și RLS, inclusiv rutele legacy și datele operaționale Realtime. Fotografiile și documentele rămân în bucketuri private cu autorizare actuală. Revocarea rolului, ștergerea/interzicerea contului, ștergerea sesiunii Auth sau revocarea factorului închid accesul pe server. Interfața verifică periodic/focusul și ascunde dashboardul la expirare/refuz; răspunsurile întârziate nu pot restaura datele altui cont, altei sesiuni sau unui rol revocat.

Onboardingul Business fără acces la local permite cont valid la `aal1` pentru propriul profil, cereri și dovezi. Nu oferă date operaționale sau rol de proprietar. Identitatea raw de membru/staff rămâne separată de capabilitatea privilegiată, pentru a bloca în Client folosirea ofertelor propriului local și când utilizatorul nu a făcut MFA.

## Prima intrare

1. Intră cu emailul contului CeFaci existent. Admin nu creează conturi prin ecranul de intrare; rolul vine din baza de date.
2. Dacă nu ai încă un autentificator verificat, apasă **Configurează autentificarea**. Folosește Google Authenticator, Microsoft Authenticator, 2FAS sau altă aplicație TOTP compatibilă.
3. În Admin scanezi QR-ul sau introduci cheia manual. Business oferă cheia manuală, utilizabilă și de pe telefonul pe care rulează aplicația.
4. Introdu cele șase cifre. Cheia/QR-ul dispar după verificare și nu sunt salvate de aplicație în stocarea locală sau jurnale.
5. La următoarea verificare folosești autentificatorul existent. Ecranul nu permite ocolirea MFA sau ștergerea unui factor verificat. Configurările abandonate sunt curățate numai dacă au fost create de ecranul respectiv și sunt încă neverificate.

Contul `contact@cornacidev.ro` păstrează rolul **fondator** acordat anterior. Autentificatorul trebuie configurat personal, pe un dispozitiv de încredere, prin noua interfață. Niciun secret/cod nu a fost inventat sau introdus în cont prin SQL. Prima configurare se bazează pe sesiunea inițială autentificată: verifică securitatea emailului și configurează factorul înainte să distribui accesul echipei. Recuperarea unui autentificator pierdut cere verificarea identității de către operatorul autorizat al proiectului; nu există un buton public de dezactivare.

## Stocare și web

Admin și Business web folosesc `sessionStorage` pentru autentificare. Business șterge vechea sesiune persistentă din `localStorage`; prima actualizare cere relogare. Browserul trebuie să permită stocarea de sesiune. Nu sunt pretinse cookie-uri HttpOnly într-o aplicație statică care folosește SDK-ul Auth în browser.

Business nativ folosește Expo SecureStore: Keychain pe iOS, cu `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, și stocare criptată prin Android Keystore pe Android. Nu se pretinde un prompt biometric la fiecare citire pe Android; autentificarea aplicației rămâne OTP + TOTP și sesiune verificată pe server. Sesiunile vechi din AsyncStorage sunt eliminate. Segmentele sunt limitate în octeți UTF-8, operațiunile sunt serializate, manifestul este scris ultimul și un eșec nu înlocuiește sesiunea completă precedentă. Nu există fallback de token în clar.

Pachetele web păstrează HTTPS, CSP fără script inline/eval, HSTS, interzicerea embeddingului, MIME sigur și lipsa cache-ului pe HTML/versiune. QR-ul Admin este reconstruit dintr-o listă strictă de elemente/atribute SVG; nu folosește inserare HTML arbitrară. Nu există chei service-role, parole sau secrete de semnare în web/native.

## Tururile și testele

[TURURI-PE-ROLURI.md](TURURI-PE-ROLURI.md) descrie tururile Bilu, pornirea automată și replay. Ghidul folosește numai paginile permise rolului și nu trimite operațiuni sau acordă drepturi.

Local au trecut **459 teste, cu un test opțional omis**, typecheck Admin/Business și **15 scenarii concurente pe PostgreSQL 17**. Browserul verifică MFA fără acces prematur la date, configurare explicită, cod greșit, dispariția cheii, expirare cu challenge nou, revocare, șase roluri Admin și patru Business, replay și absența modificărilor de date din tur. Harnessul separat verifică schimbarea contului/sesiunii, răspunsuri întârziate, refuzul final al accesului și opt atacuri SVG. Fluxurile anterioare Client/Business/Admin rămân testate. Toate fixture-urile sunt locale și traficul extern este interceptat; nu au fost trimise emailuri sau raportări reale de test.

Nu există test pe telefon fizic sau IPA semnat în acest mediu. Buildul Android real și verificarea pachetelor CI urmează aceste teste. Publicarea pe gazduire.net cere uploadul noilor ZIP-uri; vechile versiuni Admin/Business nu pot ocoli noua politică MFA și trebuie actualizate împreună cu backendul.


Advisory-urile live sunt rezumate în [backend-security-advisors.json](backend-security-advisors.json). Tabelul privat de sesiuni are RLS fără policy directă și fără grant de citire, intenționat deny-by-default; API-urile security-definer validează accesul. Protecția Supabase pentru parole compromise rămâne dezactivată în configurația existentă; nu exista un instrument de administrare Auth pentru activarea ei în acest mediu. Intrarea Admin/Business construită aici folosește OTP email și TOTP obligatoriu. [Setarea și explicația Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).


Business APK/AAB real din `12ce83b`: checksumurile și CRC corespund artefactului GitHub `11647715789`, iar certificatul este cel original. APK-ul verifică semnarea v2 în CI; AAB-ul verifică local semnătura PKCS7 și toate cele 1.314 digesturi de intrări. Manifestul compilat confirmă code5, backup=false, fără debug/cleartext/microfon/locație/stocare largă. SDK-ul SecureStore/AndroidX declară și permisiunile normale de biometrie; interfața construită nu folosește biometria pentru ocolirea MFA și nu primește date biometrice. Bundle-ul Hermes real include MFA, sesiunile server, SecureStore și tururile, fără conturile sau cheia sintetică din teste.

La schimbarea rolului Admin, datele și turul vechi sunt retrase înainte de încărcarea permisiunilor actuale; există regresie în browser pentru trecerea de la fondator la suport, fără a aștepta pollingul mai lent al dashboardului. Buildul final web are sursa `a2e6d5b51ae87981043ac41f785e626caa4ce0ab`; Business nativ și backendul nu diferă de sursa `12ce83b`.
