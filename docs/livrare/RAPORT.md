# Actualizare în curs — iconițe Business și nota juridică de cont

Sursa nouă `ce0d56019c1bfb9ff19a7c95e738a02496e97f49` este salvată și împinsă. Client 0.3.4/code7 și Business 1.0.6/code7 sunt pregătite în cod, cu cinci iconițe Business sezoniere, module native și linkuri juridice la creare cont. Local: 492 teste trecute + un test opțional omis, typecheck toate trei, audit proiecte native și teste browser GDPR/notă cont trecute.

[Workflow 38053584400](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38053584400) este pornit pentru ambele aplicații. **Până la verificarea artefactelor, pachetele livrate rămân cele code6 din raportul de mai jos.** Backupurile sunt în `release/previous-season-icons-20261010/`, metadatele în `builds/previous-season-icons-20261010/`, raportul precedent în `RAPORT-GDPR-20261010.md`.

Rezumatul întregii colaborări: [handoff pentru Claude](../../handoff/REZUMAT-PENTRU-CLAUDE-20261010.md).

---

# Livrare CeFaci — site, Client, Business, Admin și GDPR — 10.10.2026

Noul site public și drepturile privind datele personale sunt implementate în aceeași familie vizuală CeFaci. Clientul, Business și Admin folosesc aceleași documente, cereri reale, istoric și export propriu. Inboxul GDPR este protejat pe server pentru fondator/admin cu MFA. Securizarea și tururile Bilu din livrarea precedentă sunt păstrate.

## Sursă și builduri reale

Ramură `codex/cefaci-client-business-20261008`, [PR draft #2](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/pull/2). Client/Business native și weburile Admin/Business au aceeași sursă **`b98721b5c576cfe8f158520f969650b5a63a764a`**. Site-ul final este la **`9eb728c254a5a678db18e2984e6970d27a461aa7`**: după verificarea buildurilor reale, actualizarea adaugă numai versiunile confirmate 0.3.3/1.0.5 în pagina de progres. Nu schimbă sursele aplicațiilor/backendului. Documentația ulterioară păstrează mappingul.

[Workflow 38033998387](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38033998387): **SUCCESS** pentru verificări, Client și Business. Testele au precedat Gradle. Nu sunt bundleuri redenumite: APK/AAB sunt construite nativ și semnate cu cheia originală de producție.

| Pachet în `release/` | Versiune | Artefact GitHub |
| --- | --- | --- |
| Client APK/AAB + proiect iOS | `ro.cefaci.app`, 0.3.3/code6 | `11664105062` |
| Business APK/AAB + proiect iOS | `app.cefaci.business`, 1.0.5/code6 | `11664065002` |
| Business web ZIP | `b98721b` | `11662999079` |
| Admin web ZIP | `b98721b` | `11662944092` |
| Site public ZIP | `9eb728c` | pachet local retestat; baza CI `11662699455` |
| 36 capturi CI, backend sintetic izolat | fluxuri Client/Business/Admin | `11662744196` |

Arhivele descărcate au digesturile GitHub, CRC, checksumurile interne și sursa verificate. APK-urile au semnătură v2 validată în CI; certificatul original este `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`. Manifestele binare reale confirmă code6, backup=false, fără debug, cleartext, microfon, overlay ori acces larg la galerie/stocare. Business nu cere locație. AAB-urile au semnătura PKCS7 și fiecare intrare verificată local. [Checksumuri](ARTEFACTE-SHA256.txt), `builds/Legal-GitHub-artifacts.json`, `builds/Manifest-APK-audit.jsonl` și `builds/AAB-signature-audit.jsonl` păstrează dovezile. Artefactele Actions expiră la **08.01.2027**.

## Ce s-a livrat și testat

- Site responsive cu Bilu, fonturi locale licențiate, zi/noapte, progresul celor trei produse și nouă pagini juridice. Fără analytics/cookies adăugate; tema este o alegere explicită și poate fi ștearsă separat.
- Confidențialitate, termeni Client/Business, cookies/stocare, reguli Admin, drepturi, securitate, contact și ștergerea contului; aceeași sursă în aplicații și site, disponibilă înainte de login și MFA.
- Cereri proprii idempotente, istoric paginat, export limitat și explicat; autorizare din sesiunea live, fără ID arbitrar ori date ale altui cont. Drepturile proprii la aal1 nu acordă acces operațional.
- Inbox Admin fondator/admin cu MFA, răspunsuri versionate, termen calendaristic, prelungire motivată și jurnal imuabil. Răspunsul nu pretinde că o ștergere a fost executată.
- Ștergere directă numai pentru conturi simple; cazurile cu date asociate merg la evaluare. UI așteaptă confirmarea serverului. Selectorul foto Client folosește imaginea aleasă, fără acces la întreaga galerie.
- **484 teste trecute, un test opțional omis**, typecheck toate trei, build web legacy și **19 scenarii concurente PostgreSQL 17** trecute local și în CI.
- Browser: toate rolurile Admin/Business, retry după răspuns pierdut, peste 100 cereri, retragerea datelor la retrogradarea rolului și export întârziat după închiderea ecranului. Pachetele web reale CI au fost retestate pe Apache cu CSP activ; site-ul include mobil/tastatură/301/404/header/cache/MIME. Proxy-ul TLS este simulat, nu certificatul gazduire.net.

## Backend, securitate și backupuri

Migrare live **`20261010072621_cefaci_privacy_rights`**, numai pe CeFaci2.0 `vqrmwuarjjntusfbqprx`; sursă locală `20261010070306_cefaci_privacy_rights.sql`. Definițiile și contoarele înainte/după instalare sunt păstrate. RLS este activ; tabelele private nu acordă citire directă, anon nu poate executa RPC-urile, search_path este gol. **27 probe HTTP live read-only** au trecut fără conturi, emailuri, TOTP, cereri sau fotografii fictive în producție. Cele 1.093 localuri, două roluri staff și rolul fondator pentru `contact@cornacidev.ro` sunt păstrate.

MFA TOTP, sesiuni validate pe server, revocarea și autorizarea pe rol/local rămân obligatorii. Admin expiră după 15 minute inactivitate/8 ore maximum, Business după 30 minute/12 ore. Webul folosește sessionStorage, nativul SecureStore. [Securitatea existentă](SECURITATE-ADMIN-BUSINESS-20261009.md) și [tururile](TURURI-PE-ROLURI.md) rămân documentate. Advisory-urile Supabase sunt consemnate cu numărul real de constatări în `backend-privacy-advisors-20261010.json`; RPC-urile security-definer sunt intenționate și autorizate, iar tabelele private fără policies directe refuză accesul implicit. Setarea existentă pentru parole compromise rămâne dezactivată; intrarea dashboardurilor construite aici folosește OTP + TOTP. [Documentația setării](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Livrarea precedentă este în `release/previous-legal-20261010/`, metadatele în `builds/previous-legal-20261010/`, raportul în [RAPORT-SECURITATE-20261009.md](RAPORT-SECURITATE-20261009.md). Backupul remote `backup/cefaci-security-20261010` păstrează `fc91382`; ramurile originale nu sunt suprascrise. Revenirea vizuală nu elimină cererile/jurnalele ori gardurile serverului.

## Publicare și limite

**Pachetele web necesită upload pe gazduire.net**; nu există credențiale hosting/DNS în acest mediu. [Instalare](INSTALARE.md), [site](SITE-CEFACI-20261010.md) și [raport GDPR detaliat](LEGAL-GDPR-20261010.md) explică verificările după publicare. OTP/TOTP cu propriul cont rămâne verificarea personală; nu s-au trimis emailuri reale de test. iOS livrează proiecte generate, **fără IPA semnat sau test pe telefon fizic**.

Titularul nu are firmă și a ales să nu publice încă numele/adresa. Contact: contact@cornacidev.ro; identitatea incompletă este explicită, fără firmă/CUI/DPO inventate. [Dosarul juridic/fiscal](../legal/operational/README.md) include registre, proceduri GDPR/incidente, retenție, DPIA/LIA, fiscal/consumatori și surse oficiale. Identitatea operatorului, contractele furnizorilor, deciziile de retenție și schedulerul de ștergere fizică trebuie completate; expirarea accesului la atașamente nu dovedește eliminarea binarelor. Documentele rămân provizorii, fără promisiune de conformitate completă ori securitate absolută. Facturarea, plățile, Plus plătit, ANAF/SPV și push Business în fundal nu sunt activate fictiv.
