# Livrare Business cu intrare și revendicare — 09.10.2026

Business include acum cont existent/nou, profil CeFaci comun, căutarea și revendicarea localului, solicitarea unui local lipsă și disputa dacă există deja un proprietar. Documentele ajung într-un bucket privat, cererile au stare persistentă și decizie, iar proprietarul actual poate răspunde în Business. Verificarea cererii rămâne separată de contract și activarea accesului. Regulile și limitele sunt în [ONBOARDING-BUSINESS-20261009.md](ONBOARDING-BUSINESS-20261009.md).

Designul CeFaci/Bilu/fonturile și backupurile sunt păstrate. Clientul 0.3.1/code4 și corecțiile auditului anterior rămân disponibile; detaliile acelei livrări sunt în [RAPORT-AUDIT-20261009.md](RAPORT-AUDIT-20261009.md) și [AUDIT-20261009.md](AUDIT-20261009.md).

## Cod și builduri

Ramură `codex/cefaci-client-business-20261008`, [PR draft #2](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/pull/2). Implementarea Business este `8b27361b881fd0f4018768bf9b100a88afd38fd3`, împinsă pe remote. Checkpointul `5aa731e` adaugă verificarea concurentă PostgreSQL și indexurile backendului, fără schimbări în sursele executabile/configurația aplicațiilor.

Workflow [37909653680](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37909653680): **SUCCESS**, inclusiv verify, APK și AAB Business semnate. Testele din browser și capturile sunt incluse și în CI.

| Pachet | Versiune / commit de build | Artefact GitHub |
| --- | --- | --- |
| Client APK/AAB + proiect iOS | `ro.cefaci.app`, 0.3.1/code4, `a7eea11` | `11603147808`, workflow anterior |
| Business APK/AAB + proiect iOS | `app.cefaci.business`, 1.0.2/code3, `8b27361` | `11606214367` |
| Business web ZIP | `version.json` = `8b27361` | `11606435446` |
| Capturi de test Business | date sintetice, telefon/desktop | `11605679696` |

APK-ul și AAB-ul noi sunt builduri Gradle reale, descărcate și verificate după digestul artefactului, CRC, checksumurile buildului și certificatul original `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`. APK Signature Scheme v2 este verificată în CI; certificatul AAB este verificat și local. Manifestul compilat confirmă Business 1.0.2/code3, backup=false, fără debug/cleartext/microfon/overlay/locație/stocare; uploadul folosește selectorul de documente al sistemului. Bundleul Hermes conține API-urile noi și nu conține chei private sau fixture-uri. Webul CI a fost descărcat și verificat după digestul artefactului, CRC, commit, absența cheilor private/fixture-urilor și permisiunile 755/644. A trecut testele Apache și fluxurile de onboarding pe exact pachetul descărcat. Fișierele sunt în `release/`, checksumurile finale în [ARTEFACTE-SHA256.txt](ARTEFACTE-SHA256.txt); metadatele semnării sunt în `builds/`. Artefactele Actions expiră la 07.01.2027. iOS livrează proiectul generat; nu există IPA semnat sau testare pe dispozitiv Apple declarate.

Pachetele auditului anterior sunt păstrate în `release/previous-audit-20261009/`, metadatele în `builds/previous-audit-20261009/`. Backupurile din 08.10 sunt păstrate separat.

## Backend instalat și verificat

Ținta este exclusiv CeFaci2.0, `vqrmwuarjjntusfbqprx`:

- `20261009091138_cefaci_business_onboarding`, fișier local `20261009082804`, SHA-256 `27e3a98c1559eb235cab8a5ec0220ad0f41f32f85b2056657f07e15ea4aea2ac`.
- `20261009091432_cefaci_business_onboarding_indexes`, fișier local `20261009091301`, SHA-256 `6e7fea19967cd1f892331a34edfcf7487c43ce18daa22df6f1d6cab192f10616`.
- V2, gardul legacy, auditul V3 și Edge `citeste-bon` v10/verify_jwt=true rămân instalate conform raportului auditului. Migrațiile instalate anterior nu au fost editate sau reluate.

Cele trei tabele noi sunt private, cu RLS și fără drepturi directe de citire/scriere pentru aplicații. RPC-urile cer sesiune, identitatea/rolul actual și obiectul corect; retenția este exclusiv service-only. Bucketul `business-proofs` este privat, maximum 8 MiB, PDF/JPEG/PNG; documentele sunt imutabile după upload. Conturile anonime Auth sunt refuzate. Verificarea CUI-ului controlează formatul/cifra de control; confirmarea reală a firmei rămâne manuală.

Migrarea nu a publicat localuri și nu a acordat roluri. Numărul existent de localuri/parteneri/membri a rămas identic; în producție nu au fost create cereri de test. Snapshotul de metadate, mappingul timestampurilor și pauza reversibilă sunt în [BACKEND-SI-REVENIRE.md](BACKEND-SI-REVENIRE.md).

## Verificări

- **343 teste trecute**, unul opțional omis; 37 fișiere de teste trecute, local și în verify CI. Include 23 teste SQL pentru onboarding și șapte teste pentru documente/lucrătorul de retenție.
- Typecheck Client și Business, instalare din lockfile, export web și buildurile configurate în workflow.
- PostgreSQL 17 cu conexiuni independente: șase scenarii operaționale și creare simultană Client/Business a profilului. Business păstrează username-ul, prenumele și data nașterii salvate de Client.
- Browser cu întreg traficul Supabase interceptat: opțiuni OTP pentru cont existent/nou, profil, local lipsă, revendicare, dispută, dovadă obligatorie, document invalid, retry idempotent, status/retragere, răspuns proprietar, logout și responsive. Zero erori JS; zero emailuri/documente trimise live.
- Apache: redirect HTTPS, fallback, cache/MIME, fonturi, CSP/HSTS, blocarea scriptului inline, telefon fără depășirea lățimii.
- API live read-only: cereri/profil/retention refuzate anonim, scheme private/net neexpuse, catalog whitelist și OCR fără sesiune refuzat.
- Advisors după instalare: indexurile externe noi sunt acoperite. Tabelele private fără politici sunt închise intenționat, iar funcțiile SECURITY DEFINER autorizate sunt API-uri cu garduri testate, nu granturi anonime către date private.

## Configurări operaționale rămase

Site-ul `https://business.cefaci.app` este online, dar ultima verificare read-only arată încă release-ul `4d10d80`. **ZIP-ul nou trebuie urcat pe gazduire.net**; nu există credențiale de upload în mediu. [INSTALARE.md](INSTALARE.md) explică document-root-ul, TLS, cache-ul și verificarea versiunii.

ANAF/ONRC și SMS/apel automat nu sunt configurate: se folosește documentul și verificarea manuală. Contractul final, clauzele speciale, PDF-ul și activarea parteneriatului sunt pași separați de cerere; Admin-ul integral nu este reconstruit. Disputa notifică proprietarul în Business, iar termenul de trei zile începe la prima consultare; nu există notificare email/SMS/push în fundal livrată pentru acest flux.

Lucrătorul server de retenție este livrat și testat, cu simulare implicită și execuție explicită. **Schedulerul și secretul său privat trebuie configurate** pentru ștergerea fizică automată la 90 de zile. Expirarea dreptului de citire este impusă pe server. Fișierele sunt păstrate în Storage privat cu criptarea gestionată de platformă; nu există scanare antivirus sau verificare SHA-256 a documentului pe server declarate.

Facturarea fiscală, plățile, abonamentele Plus plătite, biletele plătite și push Business în fundal rămân neconfigurate; `billing_ready=false`. Nu este declarată testare pe telefon fizic, OTP primit prin email real sau OCR cu bon real. Auditul npm Business rămâne 15 high în dependențe de build, fără critical/moderate și fără downgrade Expo. Problemele platformei și advisory-urile existente sunt documentate în audit; nu se declară securitate absolută.

## Backupuri

Ramurile remote rămân:

- `backup/claude-original-20261008`: `9d1e02c70aa3c1634c298011e50dd6a65e6ea287`.
- `backup/cefaci-current-20261008`: `45ad4963403283ab234d9811a562979c7f1b8cee`.

Snapshoturile de definiții și ramurile de cod nu înlocuiesc backupul de date/PITR al platformei.
