# Livrare Client + Business + Admin — 09.10.2026

Admin este construit și conectat la Client și Business: cereri de local lipsă/parteneriat, raportări cu fotografie privată, răspunsuri, catalog, sosiri și contestații, financiar după rol, Plus de suport, sugestii, echipă și jurnal. Clientul are intrarea discretă în Profil; Business are tabul Ajutor, inclusiv înainte de parteneriat. Designul CeFaci/Bilu/fonturile și backupurile sunt păstrate. [ADMIN-20261009.md](ADMIN-20261009.md) descrie funcțiile, permisiunile și limitele; [ONBOARDING-BUSINESS-20261009.md](ONBOARDING-BUSINESS-20261009.md) descrie revendicarea/verificarea.

## Cod și builduri

Ramură `codex/cefaci-client-business-20261008`, [PR draft #2](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/pull/2). Checkpointuri împinse: `47a1744`, `e1e802d`, `ded2cdd`, `1557201`, `11ac445`, apoi documentația. Sursele/configurațiile executabile ale tuturor pachetelor sunt din **`11ac4455f1ad8fba46ac5a308a8c8d9ea74f2974`**; commiturile ulterioare schimbă numai documentația livrării.

Workflow [37945951914](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37945951914): **SUCCESS**, verificări înaintea buildurilor, APK/AAB reale Gradle semnate cu cheia originală.

| Pachet | Versiune | Artefact GitHub |
|---|---|---|
| Client APK/AAB + proiect iOS | `ro.cefaci.app`, 0.3.2 / code5 | `11624533396` |
| Business APK/AAB + proiect iOS | `app.cefaci.business`, 1.0.3 / code4 | `11624147486` |
| Business web ZIP | `version.json` = `11ac445` | `11623411673` |
| Admin web ZIP | `version.json` = `11ac445` | `11623916401` |
| Capturi Client/Business/Admin | backend sintetic izolat | `11624735763` |

Toate artefactele au fost descărcate, verificate după digestul GitHub, CRC și SHA-256. APK-urile au certificat original `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`, semnare v2 verificată în CI; certificatul AAB este verificat și local. Manifestele compilate confirmă versiunile, backup=false, fără debug/cleartext/microfon/overlay; Business nu cere locație sau acces larg la fotografii/stocare. Codul Hermes include noile API-uri, fără chei private sau identități de fixture.

Weburile CI au trecut din nou pe Apache și în browser după descărcare: fallback, rute adânci, HTTPS redirect, CSP/HSTS, MIME, cache, fonturi, mobil. Fișierele publice au permisiuni 644 și directoarele 755. Pachetele sunt în `release/`; checksumurile în [ARTEFACTE-SHA256.txt](ARTEFACTE-SHA256.txt), identitatea buildurilor în `builds/`. Artefactele Actions expiră la **07.01.2027**. Pachetele anterioare sunt păstrate în `release/previous-onboarding-20261009/`, metadatele în `builds/previous-onboarding-20261009/`. Backupurile remote rămân `9d1e02c` și `45ad496`.

## Backend și verificări

Cele două migrații sunt instalate exclusiv pe CeFaci2.0 `vqrmwuarjjntusfbqprx`: **`20261009100906_cefaci_admin_support`** și **`20261009143212_cefaci_admin_operations`**. Snapshoturile, SHA-256, mappingul local/live și procedura de pauză sunt în [BACKEND-SI-REVENIRE.md](BACKEND-SI-REVENIRE.md). Migrațiile instalate anterior nu au fost editate sau reluate; V2, onboardingul și gardurile de audit rămân active. Nu s-au șters/restaurat date și nu s-au creat cereri, conturi, parteneriate sau emailuri de test în producție.

- **403 teste trecute, un test opțional omis**, local și CI; typecheck Client, Business și Admin.
- PostgreSQL 17: **11 scenarii de concurență**, inclusiv identitate Client/Business, ultima capacitate, scanare comună, raportare/submit idempotente și hotărâri Admin protejate de versiune.
- Browser: Client Profil/raportare/local lipsă/răspuns; Business rezervări/scanner/financiar/onboarding/Ajutor/foto/retry/logout; Admin roluri/cozi/poze/catalog/contestații/Plus/revocare. Toate cererile externe și WebSocket sunt interceptate cu date sintetice.
- API live: catalogul public fără date fiscale; **25 verificări read-only** de acces anonim/refuzul schemelor private/OCR; niciun apel de raportare/decizie/sosire reală.
- Live: 1.093 localuri, zero parteneri/membri Business, un cont staff păstrat, o semnalare legacy păstrată; zero raportări/compensații noi. Bucket suport privat 5 MiB, roluri/granturi și RLS reverificate.
- [backend-admin-advisors.json](backend-admin-advisors.json) păstrează rezumatul advisor-urilor live și zero FK noi Admin neindexate. RPC-urile security-definer rămân autorizate explicit; nu se aplică granturi generale pentru a ascunde avertismente.

Prima rulare CI `37945774379` a trecut cele 11 scenarii concurente, dar a eșuat la notificarea de închidere a bazei efemere; fixture-ul a fost reparat în `11ac445`, după care rularea finală a trecut integral. Erorile din operațiunile testate nu sunt ignorate.

## Publicare și limite operaționale

ZIP-urile sunt pregătite pentru `business.cefaci.app` și `admin.cefaci.app` pe gazduire.net; instrucțiuni în [INSTALARE.md](INSTALARE.md). **Noul update nu este publicat**: nu există credențiale de hosting/DNS în acest mediu. Un site anterior online nu dovedește instalarea acestui release.

iOS livrează proiectele generate; **nu există IPA semnat sau testare pe dispozitiv fizic**. SMTP/OTP real, furnizorii de verificare, contractele/activarea, facturarea/plățile/circuitul fiscal cu doi aprobatori, blocarea globală de cont și statisticile detaliate de consum nu sunt configurate/implementate aici. `billing_ready=false`; niciun buton nu simulează facturi ori activări. Push Business în fundal și abonamentele Plus plătite rămân neconfigurate.

Fotografiile/documentele sunt private și accesul expiră; workerii de ștergere fizică la retenție sunt livrați/testați, însă schedulerul privat și cheia lui nu sunt configurate. Advisory-urile legacy și auditul dependențelor sunt consemnate separat; nu este promisă securitate absolută.
