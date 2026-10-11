# Business — trimitere cereri și recepție Admin

Versiune nouă: Business 1.0.8, Android code 9, iOS build 9.

## Cauză verificată

Logurile reale Supabase, 10.10.2026, 21:53:35–21:54:25 UTC, arată apeluri Android `biz_partner_request_create` respinse HTTP 400 / P0001: „Completează numele, rolul, firma și telefonul de contact.” Cererea nu era creată, deci Admin nu avea ce primi. Nu au fost citite valorile private ale formularului; nu putem identifica din aceste loguri care dintre câmpuri a fost invalid.

Interfața verifica numai dacă aceste câmpuri conțineau text. Serverul verifică și lungimi, formatul telefonului și CUI-ul. Eroarea apărea sus în formular, în afara ecranului după apăsarea butonului de jos. Documentul lipsă bloca trimiterea fără explicație lângă buton. ScrollView-urile native puteau consuma prima apăsare pentru închiderea tastaturii.

Validările instalate pentru telefon/extensie au fost verificate direct din funcțiile PostgreSQL și sunt corecte. Suspiciunea inițială legată de caractere escape a fost infirmată; nu a fost modificată baza de date. Scrierile V2 sunt active. Documentele și fotografiile rămân private; autentificarea, MFA, drepturile Admin și RLS sunt păstrate.

## Corecție

- Validare locală cu aceleași limite și checksum CUI ca serverul, cu mesaj pentru câmpul invalid lângă „Trimite”. Documentul obligatoriu are explicație explicită.
- Erorile API/încărcare apar lângă buton; datele și aceeași cheie de reîncercare sunt păstrate.
- Succesul cererii Business se afișează numai după confirmarea serverului cu ID-ul cererii și starea `pending`. Confirmarea raportării trebuie să fie o stare trimisă, nu `draft`.
- Tastatura nu mai consumă apăsarea butoanelor din formulare. După succes, cererea și confirmarea sunt aduse în vedere.
- Profilul și raportarea problemelor afișează explicațiile aproape de acțiunea folosită.

## Verificare

- 520 teste automate trecute, un test opțional fără serviciul său separat omis.
- Browser pe telefon și desktop: telefon invalid, document lipsă/invalid, HTTP 400 la creare, eroare upload, confirmare `draft` respinsă, reîncercare cu aceeași cheie, claim/new/dispute, raportare cu/fără poză, logout și răspunsuri întârziate. Toate apelurile browser sunt interceptate; fără emailuri/documente reale.
- PostgreSQL local real, baze izolate: `scripts/test-business-admin-delivery.mjs` verifică claim/PDF, local nou/JPEG, dispută/PNG și raportări Business cu/fără poză. Ciornele nu apar în Admin, trimiterile apar o singură dată; documentul lipsă și uploadul altui utilizator sunt refuzate.
- Testele concurente în PostgreSQL real au trecut; typecheck Business/Admin a trecut.

## Instalare și limite

Înlocuiește Business web cu noul ZIP și aplicația Android cu APK code 9 din buildul final verificat. Admin și site-ul public nu necesită înlocuire pentru această corecție; nu există migrație SQL nouă.

În Admin: revendicări/localuri noi/dispute la „Cereri Business”, raportări la „Semnalări”, conform rolului. O ciornă nu este o cerere trimisă.

Testele autentificate folosesc identități sintetice în baze locale. Nu s-au creat conturi sau cereri false în producție. Verificarea HTTP anonimă în live a refuzat cu 401/42501 crearea/citirea cererilor Business, coada Admin și raportările. Nu pretindem o trimitere autentificată reală în numele utilizatorului; corecția trebuie instalată pe dispozitivul folosit.

Builduri finale verificate la 11.10.2026: [Android 38090188021 SUCCESS](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38090188021), [Business iOS 38090190410 SUCCESS](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38090190410). Sursa `794710b927a1e1f2bc6e33394cf69bf360d96b5d`. APK/AAB 1.0.8/code9 cu certificat de producție păstrat; iOS1.0.8/build9 are simulator Release și xcarchive device nesemnat, cu Maestro iPhone/iPad trecut. Hashuri și rapoarte: `ARTEFACTE-SHA256.txt`, `builds/Business-submit-*`. Arhivele precedente sunt păstrate în `release/previous-business-submit-20261010/`.
