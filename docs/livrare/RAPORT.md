# Raport de livrare — 08.10.2026

Clientul actualizat și Business folosesc identitatea comună a ieșirii, participarea pe server și aceleași reguli de rezervare, Drop, sosire, bon și financiar. Business este React Native/Expo cu export web static. Designul Clientului și canvasurile generate au fost păstrate; componentele Business folosesc familia vizuală CeFaci, Bilu și fonturile/paletele originale.

## Cod și backupuri

Ramură: `codex/cefaci-client-business-20261008`. Checkpointuri reale comise și împinse: `2f7eece`, `c9c6484`, `a5c6438`, `4bf232d`, `1e99f42`, `e00c0af`, `6be9d20`, `4d10d80`, `3e06220`. Commiturile finale de raport nu schimbă sursele aplicațiilor.

Backupurile remote au fost reverificate și nu au fost suprascrise:

- `backup/claude-original-20261008`: `9d1e02c70aa3c1634c298011e50dd6a65e6ea287`
- `backup/cefaci-current-20261008`: `45ad4963403283ab234d9811a562979c7f1b8cee`

## Artefacte

Clientul Android provine din commitul `1e99f429fc2e30395f2139936068982d44368a2a`, workflow [37764802703](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37764802703), integral reușit. Sursele Clientului, motorului și componentelor sale partajate nu au fost modificate ulterior.

Business este reconstruit din `4d10d80cea11457d7c14d28d6b12ce5cc7b60ede`, workflow [37770806493](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37770806493), pentru a include validarea sumelor cu virgulă/punct. Sursele Business nu s-au schimbat după acest commit. Verificarea finală și checksumurile sunt în `builds/` și `ARTEFACTE-SHA256.txt`.

Ambele rulări sunt încheiate cu succes. Business final a fost descărcat și verificat după digestul GitHub `a9d34928cfe88a896dac5fb1ac84add19f001664263ec5e06030dd0cd1814f52`; Clientul după `21bdb13195407021ea546652905bbf110befff67eec5622046b9a239521e8551`. ZIP-ul web final include permisiunile Apache și validarea sumelor; `version.json` indică `3e0622028b71c37c1f042b7e13f230d97035aa13`. Commiturile ulterioare sunt exclusiv documentație.

Fișierele din `release/`: APK, AAB și proiect iOS pentru fiecare aplicație; `CeFaci-Business-web.zip` pentru gazduire.net. APK-urile sunt builduri Gradle reale, nu exporturi JS. Metadatele verificării `apksigner` și identitatea pachetului sunt păstrate în `builds/`. Certificatul de producție existent are SHA-256 `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`; nu au fost incluse keystore-uri sau parole în livrare. Proiectele iOS au fost generate; nu există IPA construit sau test pe dispozitiv Apple.

Descarcă și păstrează local artefactele: GitHub Actions are retenție limitată (artefactele acestor rulări expiră la 06.01.2027). ZIP-ul web este gata de upload; nu a fost publicat pe gazduire.net în lipsa accesului la hosting/DNS. Urmează [INSTALARE.md](INSTALARE.md).

## Backend instalat

Exclusiv CeFaci2.0, `vqrmwuarjjntusfbqprx`:

- Migrarea celor cinci fișiere V2, într-o tranzacție: `20261008110910_cefaci_client_business_v2_20261008`. SHA-256 al SQL-ului concatenat în ordinea documentată, cu newline suplimentar după fiecare fișier: `16b2ac95dc79a8992fefff74b6afb44d2205705df7a9e9adca95167e082501c2`.
- Corecție aditivă pentru protecția legacy după ștergerea planului: `20261008114010_cefaci_legacy_group_guard`.
  SHA-256 fișier: `27e0babeea45f34b89fef26febd47015c6fa43fa1347e7afbe00b01cc549e74c`.
- Edge `citeste-bon`: versiunea **9**, ACTIVE, **verify_jwt=true**. Secretele providerului existent nu au fost înlocuite.
- Audit live: toate tabelele public/private au RLS; `outing_events` este în Realtime; scrierea directă în plan/participare este revocată; înregistrarea bonului este service-only; gardurile legacy sunt active și inaccesibile anonimilor; `billing_ready=false` verificat în funcția live.
- HTTP live: catalog anonim permis; operațiuni Business/plan și Edge refuzate fără autentificare. Nu au fost create fixture-uri live și nu au fost trimise emailuri sau notificări de test către persoane reale.

Catalogul live verificat nu are parteneri activați. Scenariile pozitive operaționale folosesc date sintetice izolate, nu venituri demonstrative în aplicație. Activarea contractuală a unui local și acordarea rolurilor reale rămân pași operaționali ai proprietarului/adminului.

Nu am executat reseturi sau ștergeri de conturi/date în producție. O citire agregată preinstalare a raportat 9 profile, iar citirile ulterioare au raportat 2 profile și 11 conturi Auth. Utilizatorul a confirmat ulterior explicit că el a șters profilele. Diferența este explicată de această intervenție; migrațiile livrate nu conțin ștergeri de profile/Auth și nu am încercat restaurări sau modificări ale persoanelor reale. Tabelele operaționale consultate aveau zero rânduri înainte și după instalare.

Snapshotul funcțiilor pre-V2 și Edge v8, procedura de pauză, mappingul migrațiilor și revenirea fără ștergerea istoricului sunt în [BACKEND-SI-REVENIRE.md](BACKEND-SI-REVENIRE.md).

## Verificări

Suita finală: **293 teste trecute**, un test opțional de tabel omis; 31 fișiere de teste trecute. Include 22 scenarii integrate V2, cinci contracte partajate și trei cazuri pentru sume. Testele V1 validează snapshotul istoric separat; testele V2 încarcă toate migrațiile curente, inclusiv corecția legacy.

| Domeniu | Verificare efectuată |
| --- | --- |
| Participare | 30 minute pe server, timeout fără no-show, organizator implicit, invitați anonimi expliciți, vârste, număr comun |
| Rezervări | Grup mare, idempotentă, limite, capacitate, propunere/expirare, anulare, ascundere pentru planuri noi |
| Plus/Drop | Plus al invitatului, reducere grup, avans, GPS/wait, min/max locuri, stock, calendar, oprire cu claim păstrat, 18+/clienți noi |
| Sosire | Client și Business, o vizită comună, retry, ieșiri distincte în aceeași zi, păstrarea financiarului la ștergerea contului |
| Bon | Participant autorizat, CUI, timp/duplicat, sumă canonică prioritară, salvare independentă de XP |
| Financiar | Trepte/fondatori/gratuitate, copii, limită zece, surse mixte 38 lei, surse zero-comision, net parțial, DST/05:00 |
| Contestații | Număr versionat, refuz beneficiu, compensație limitată, review auditat, caz neclar nefacturat |
| Securitate | RLS/grants, whitelist, roluri/revocare, API legacy retras inclusiv după dispariția planului, pauză fără pierderea istoricului |
| Concurență reală | PostgreSQL 17, conexiuni independente: ultima capacitate, cerere repetată, ultim răspuns vs rezervare, ultimele locuri Drop, trei scanări simultane |
| Browser | Telefon/desktop, zi/noapte, scanner/manual, ordine financiară, logout, local schimbat, răspuns vechi financiar, bani cu virgulă și input invalid; zero erori JS |
| Hosting | Apache 2.4: permisiuni, HTTPS redirect, fallback la reîncărcare, MIME manifest, cache HTML/asset, antete cameră și integritatea ZIP |
| Construcție | Lockfile-uri, typecheck Client/Business, Deno check, Hermes Android, web static, Gradle APK/AAB, proiecte iOS |

Capturile din `release/screenshots/` sunt din teste interceptate cu date sintetice și nu sunt date din producție. Validările pe PostgreSQL sunt independente de emularea PGlite.

Nu declar testare pe telefon fizic, OTP primit efectiv prin email sau OCR live cu bon real. Acestea cer dispozitive/date/conturi autorizate. Facturarea fiscală, plățile, biletele plătite, abonamentul Plus plătit și push Business în fundal rămân neconfigurate, conform [INSTALARE.md](INSTALARE.md).
