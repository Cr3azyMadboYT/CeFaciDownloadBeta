# Livrare Client + Business + Admin — securizare 09.10.2026

Admin și Business sunt securizate cu MFA TOTP obligatoriu, sesiuni verificate pe server și permisiuni actuale pe rol/local. Tururile Bilu sunt construite pentru toate cele șase roluri Admin, patru roluri Business și solicitant, în designul CeFaci, cu pornire automată și replay. Clientul, cererile de local/parteneriat, raportarea cu fotografie privată, răspunsurile, catalogul, sosirile, financiarul după rol, Plus de suport, echipa și jurnalul rămân conectate și testate. Designul și backupurile sunt păstrate.

## Cod, backend și builduri reale

Ramură `codex/cefaci-client-business-20261008`, [PR draft #2](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/pull/2). Checkpointurile de securizare sunt comise și împinse. Business nativ are sursa **`12ce83b7e6ec6d5fc870de2c8cd8dd8b6b4b2b94`**; weburile finale au sursa **`a2e6d5b51ae87981043ac41f785e626caa4ce0ab`**, care adaugă revalidarea imediată a rolului Admin și regresia aferentă. Sursele Business/Client/backend nu diferă între aceste două commituri. Clientul nativ existent rămâne cel verificat din `11ac4455f1ad8fba46ac5a308a8c8d9ea74f2974`.

[Workflow nativ 37996015334](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37996015334): **SUCCESS**, teste înainte de Gradle, APK/AAB reale semnate cu cheia originală. [Workflow web final 37997554929](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37997554929): **SUCCESS**, toate verificările repetate; jobul nativ este omis intenționat deoarece Business nativ nu s-a schimbat.

| Pachet actual | Versiune / sursă | Artefact GitHub |
| --- | --- | --- |
| Client APK/AAB + proiect iOS | `ro.cefaci.app`, 0.3.2 / code5, `11ac445` | `11624533396` |
| Business APK/AAB + proiect iOS | `app.cefaci.business`, 1.0.4 / code5, `12ce83b` | `11647715789` |
| Business web ZIP | `version.json` = `a2e6d5b` | `11647946472` |
| Admin web ZIP | `version.json` = `a2e6d5b` | `11647601909` |
| Capturi Client/Business/Admin | 33 imagini, backend sintetic izolat | `11648011437` |

Artefactele au fost descărcate și verificate după digest GitHub, CRC, SHA-256 și sursă. Business APK confirmă code5, semnare v2 în CI și certificatul original **`d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`**. AAB-ul are semnătură PKCS7 și toate cele **1.314 digesturi de intrări** verificate local. Manifestul compilat are backup=false, fără debug/cleartext/microfon/locație/stocare largă; SecureStore/AndroidX declară și permisiunile normale de biometrie, fără un flux biometric implementat. Bundle-ul Hermes real include MFA, sesiuni server, SecureStore și tururile, fără conturi sau chei sintetice ori chei private. Clientul existent păstrează verificările sale originale și checksumurile neschimbate.

Pachetele sunt în `release/`; [ARTEFACTE-SHA256.txt](ARTEFACTE-SHA256.txt) și metadatele `builds/Security-native-GitHub-artifacts.json`, `builds/Security-web-GitHub-artifacts.json`, `Business-build.txt`, `Manifest-APK-audit.jsonl` păstrează dovezile. Pachetele precedente și metadatele lor sunt în `release/previous-security-v1-20261009/` și `builds/previous-security-v1-20261009/`; toate backupurile anterioare rămân. Backupurile remote originale sunt `9d1e02c` și `45ad496`. Artefactele Actions expiră în **07.01.2027**.

## Securitate și verificări

Migrarea **`20261009215832_cefaci_privileged_security_sessions`** este instalată exclusiv pe CeFaci2.0 `vqrmwuarjjntusfbqprx`; fișier local `20261009213831`, SHA-256 **`cbca3d395a5a233eb3a4ffa84ce0988e7126fa774259564c178315f8ff1fb182`**. Migrațiile deja instalate nu au fost editate sau reluate. [BACKEND-SI-REVENIRE.md](BACKEND-SI-REVENIRE.md) descrie mappingul, snapshoturile și păstrarea gardurilor la revenire.

- **459 teste trecute, un test opțional omis**, local și CI; typecheck Client, Business și Admin.
- PostgreSQL 17: **15 scenarii concurente**, inclusiv închiderea sesiunii simultan cu open/touch, revocarea Auth și factorului, identitate, capacitate, scanare comună, raportări idempotente și hotărâri protejate de versiune.
- Browser: fluxurile precedente Client/Business/Admin, MFA configurare/cod greșit/cheie retrasă/expirare/challenge nou/revocare, șase roluri Admin și patru Business, replay fără operațiuni, fondator → suport fără meniu financiar vechi. Harness separat pentru schimbarea contului/sesiunii, răspunsuri întârziate și opt injecții SVG.
- ZIP-urile finale CI testate pe Apache: redirect HTTPS simulat prin terminator proxy local, fallback/rute adânci, CSP/HSTS, script inline blocat, MIME, cache, fonturi, mobil și întregul flux MFA/tururi. Nu este un test al certificatului gazduire.net.
- Live: **22 verificări HTTP read-only** de refuz anonim, catalog whitelist și scheme private/OCR; granturi, search_path și RLS verificate separat prin metadata. Nu s-au creat conturi, TOTP, cereri, sosiri, bonuri sau notificări de test în producție.
- Cele **1.093 localuri**, **2 roluri staff**, o semnalare legacy și lipsa partenerilor/membrilor/raportărilor noi sunt păstrate. `contact@cornacidev.ro` păstrează rolul **fondator**. Niciun secret MFA nu a fost inventat pentru cont.

Admin expiră după 15 minute fără activitate sau maximum 8 ore; Business după 30 minute sau maximum 12 ore. Serverul validează Auth session_id, utilizatorul, TOTP verificat legat de sesiune, dovada semnată și drepturile curente. Dovada veche nu redeschide sesiunea închisă/expirată. Pollingul nu prelungește inactivitatea. Revocarea rolului/factorului/sesiunii și interdicția/ștergerea contului refuză accesul chiar cu JWT încă valabil. RLS/API/Storage păstrează autorizarea; rolurile raw rămân vizibile regulilor Client împotriva beneficiilor propriului local.

Webul folosește sessionStorage; Business elimină tokenurile persistente vechi și cere relogare. Nativul folosește SecureStore cu scrieri atomice, segmente limitate în octeți și fără fallback în clar. [SECURITATE-ADMIN-BUSINESS-20261009.md](SECURITATE-ADMIN-BUSINESS-20261009.md) detaliază politica și prima intrare; [TURURI-PE-ROLURI.md](TURURI-PE-ROLURI.md) descrie ghidurile.

## Instalare și limite operaționale

**Weburile noi nu sunt publicate pe gazduire.net:** nu există credențiale de hosting/DNS în mediu. Urcă ZIP-urile finale conform [INSTALARE.md](INSTALARE.md). Versiunile vechi Admin/Business nu pot ocoli backendul MFA și trebuie actualizate. La prima intrare configurează personal Google Authenticator/2FAS/Microsoft Authenticator; rolul fondator nu ocolește MFA. Autentificarea OTP/TOTP cu propriul cont pe serviciul live rămâne verificarea personală; testele automate au folosit fixture-uri și nu au trimis emailuri reale.

iOS livrează proiectul generat, **fără IPA semnat sau test pe telefon fizic**. SMTP/șabloanele OTP, furnizorii de verificare, contractele/activarea, facturarea/plățile, abonamentele Plus plătite și push Business în fundal rămân neconfigurate. `billing_ready=false`; nu se simulează activări sau facturi. Workerii de retenție sunt livrați/testați, schedulerul privat nu este configurat.

[backend-security-advisors.json](backend-security-advisors.json) consemnează advisory-urile reale. Tabelele private fără policy directă sunt intenționat deny-by-default, fără grant de citire; RPC-urile security-definer sunt autorizate explicit. Protecția Supabase pentru parole compromise rămâne dezactivată în configurația existentă și nu a putut fi administrată prin instrumentele disponibile; intrarea construită aici folosește OTP + TOTP. [Documentația setării](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Nu se promite securitate absolută.
