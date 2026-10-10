# Livrare CeFaci — iconițe Business și nota juridică la cont — 10.10.2026

Client **0.3.4/code7** și Business **1.0.6/code7** includ nota juridică discretă și documentele locale la crearea contului. Business are Bilu cu servietă mare în cinci variante, cu schimbare sezonieră nativă. Designul Clientului, gardurile serverului și backupurile sunt păstrate.

## Sursă, teste și builduri

Sursa APK/AAB și weburilor Admin/Business: **`26591508a442cfa4b9787afc0a661d3ef9f08668`**. [Workflow 38053659611](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38053659611) **SUCCESS**, verificări înainte de compilarea Gradle. Prima rulare 38053584400 a fost anulată înainte de compilare pentru a include manifestul explicit al noului modul local.

- **492 teste trecute, un test opțional omis**, typecheck Client/Business/Admin și **19 scenarii concurente PostgreSQL 17** în CI.
- Toate regresiile browser Client/Business/Admin, onboarding, raportări, MFA, tururi, GDPR și site au trecut. Linkurile noi deschid direct documentele corecte fără autentificare sau trimitere de cereri și păstrează emailul introdus după închidere.
- Pachetele web descărcate din CI au fost retestate pe Apache cu CSP activ; modalurile juridice, drepturile proprii și toate rolurile au trecut. Simularea proxy-ului HTTPS nu este un certificat gazduire.net.
- Audit prebuild Business: cinci aliasuri Android, exact unul activ la instalare, deep link păstrat, resurse legacy/adaptive, patru cataloage alternative iPhone/iPad, setări Xcode și autolinking Android/Apple. Local, fiecare pixel cu alpha nenul al foregroundului încape în cercul sigur Android la inset 27%.
- APK/AAB reale, semnate cu certificatul original **`d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`**. Digesturi GitHub, CRC, checksumuri interne, semnătura APK v2, semnăturile PKCS7/toate intrările AAB și manifestele binare APK verificate. Code7, backup=false, fără debug/cleartext/microfon/overlay/acces larg la galerie; Business fără GPS.

| Pachet în `release/` | Versiune / sursă | Artefact GitHub |
| --- | --- | --- |
| Client APK/AAB + proiect iOS | 0.3.4/code7, `2659150` | `11670304763` |
| Business APK/AAB | 1.0.6/code7, `2659150` | `11670498529` |
| Business proiect iOS corectat | `3c922ab`, generat local | bază CI păstrată separat |
| Business web ZIP | `2659150` | `11670367975` |
| Admin web ZIP | `2659150` | `11670637702` |
| Site public ZIP | `011748c`, reîmpachetat/retestat local | baza CI `11670872229` |
| 38 capturi CI, backend sintetic | fluxuri și nota contului | `11670642568` |

Site-ul final provine din **`011748c477632130c6bac93c8d12e7d1f6b03e0f`** și actualizează numai versiunile confirmate după build: 0.3.4/1.0.6. Pachetul local a fost retestat pe Apache; baza CI este păstrată separat.

Dovezi: [checksumuri](ARTEFACTE-SHA256.txt), `builds/Season-GitHub-artifacts.json`, `builds/Manifest-APK-audit.jsonl`, `builds/AAB-signature-audit.jsonl`. Artefactele GitHub au retenție limitată; salvează-le local.

## Calendar, iconițe și nota contului

Calendarul comun Client/Business este în `src/app/season.ts`: primăvară martie–mai, vară iunie–august, toamnă septembrie–noiembrie, restul iarnă; Crăciun între 1 decembrie și 7 ianuarie inclusiv, după data locală a dispozitivului. Android schimbă iconița când aplicația trece în fundal; API 33+ schimbă atomic aliasurile. iOS folosește API-ul public UIKit în prim-plan și poate afișa notificarea standard a sistemului. O aplicație închisă nu execută schimbarea singură, iar lansatorul poate păstra temporar un cache. Webul are faviconul implicit de toamnă; schimbarea automată descrisă aici este nativă.

**Proiectul iOS Business livrat este generat local din `3c922ab6ec3a3a09bc80ed1145bdab491a27e1cb`**, după o corecție exclusiv iOS care elimină canalul alpha al iconițelor pentru App Store. Iconițele principale și alternative sunt RGB, verificate static. Outputurile Android sunt identice octet cu octet; APK/AAB rămân din workflow-ul de mai sus. ZIP-ul iOS și checksumurile CI originale sunt păstrate în `release/CeFaci-Business-ios-project-ci-season.zip` și `builds/CeFaci-Business-CI-SHA256.txt`; noul proiect are dovada în `builds/Business-ios-project-build.txt` și digestul din checksumurile finale.

`business/assets/icons/` și `release/CeFaci-Business-season-icons.zip` includ cele cinci imagini complete, foregrounduri transparente și fundaluri. Propunerile originale și iconițele Clientului sunt păstrate. Proiectul iOS Business include și sursele modulului local necesar iconițelor; pentru compilare folosește checkoutul sursei, npm ci, CocoaPods și Xcode.

Textul de creare cont: **„Prin crearea contului accepți Termenii de utilizare și confirmi că ai citit Politica de confidențialitate.”** Pentru cont existent Business, textul explică folosirea aplicației, fără a pretinde crearea unui cont nou. Documentele se citesc înainte de autentificare și offline. Informarea GDPR nu este prezentată drept consimțământ universal pentru marketing; nota nu introduce un registru nou de acceptări contractuale pe server.

## Întreaga colaborare și backupuri

[Rezumat pentru Claude](../../handoff/REZUMAT-PENTRU-CLAUDE-20261010.md) acoperă Client, Business, Admin, securitate, tutoriale, site, GDPR, video, builduri și limite. Livrarea anterioară: [RAPORT-GDPR-20261010.md](RAPORT-GDPR-20261010.md), pachete `release/previous-season-icons-20261010/`, metadate `builds/previous-season-icons-20261010/`. Ramurile remote originale și `backup/cefaci-security-20261010` sunt păstrate.

Această actualizare nu instalează migrații noi. Backendul live rămâne cel documentat anterior, cu MFA `20261009215832` și drepturi GDPR `20261010072621`. Rolul fondator pentru `contact@cornacidev.ro` și datele existente sunt păstrate.

## Publicare și limite

Weburile sunt pregătite pentru upload pe gazduire.net, fără publicare efectuată în lipsa accesului hosting/DNS. iOS: proiecte generate și inspectate, **fără IPA compilat/semnat sau test pe telefon fizic**; noul modul Swift și iconițele alternative necesită validare Xcode/dispozitiv Apple. Nu declarăm testare Android pe telefon fizic ori OTP real primit de titular.

Documentele rămân provizorii: utilizatorul nu are firmă și a ales să nu publice încă numele/adresa; contact `contact@cornacidev.ro`. Identitatea operatorului, contractele furnizorilor, retenția și schedulerul de ștergere fizică trebuie completate. Facturarea, plățile, ANAF/SPV, Plus plătit și push Business în fundal nu sunt activate. Detalii: [INSTALARE.md](INSTALARE.md), [dosar juridic](../legal/operational/README.md). Nu se declară securitate absolută ori conformitate integrală.
