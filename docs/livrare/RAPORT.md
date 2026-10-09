# Livrare verificată după audit — 09.10.2026

Clientul și Business au fost corectate după auditul cerut, reconstruite și descărcate. Ambele APK-uri sunt builduri Gradle reale, semnate cu certificatul de producție existent. Migrarea de securitate V3 și funcția de bon cu dependență fixată sunt instalate exclusiv pe CeFaci2.0. Designul original și backupurile au fost păstrate.

## Ce a găsit auditul

Au fost corectate modificarea grupului după rezervare/Drop/sosire, ocolirea versiunii prin `null`, conversia votului fără verificarea disponibilității localului, ora zero transformată în 20:xx, participarea implicită la deschiderea câștigătorului și rezultatele async după schimbarea contului. Business păstrează programul Plus, actualizează financiarul, golește rezultatul scanării precedente la verificarea unui alt bilet și tratează retry-urile/valorile invalide. Proba Plus cere confirmare reală, iar mesajele nu promit plăți/providers sau economii inexistente. Detaliile și limitele sunt în [AUDIT-20261009.md](AUDIT-20261009.md).

## Cod și construcție

Completarea fluxului Business pentru cont, revendicare, dispută și solicitarea unui local lipsă este descrisă separat în [ONBOARDING-BUSINESS-20261009.md](ONBOARDING-BUSINESS-20261009.md). Această completare necesită un build Business nou; artefactele auditului de mai jos reprezintă checkpointul anterior până la înlocuirea lor verificată.

Ramură: `codex/cefaci-client-business-20261008`; [PR draft #2](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/pull/2).

Implementarea auditului: `a7eea11b31705352f7b46822271b7457d0f1e34f`. Workflow [37901741752](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/37901741752) este **SUCCESS**, inclusiv verify și ambele joburi native. Ulterior au fost comise documentația, fixarea versiunilor la aceleași valori din lockfile (`2b50310`) și importul exact în Edge (`87b9d77`). Sursele executabile/configurațiile native și versiunile rezolvate ale dependențelor nu s-au schimbat față de buildul `a7eea11`.

| Pachet | Versiune reală | Artefact GitHub |
| --- | --- | --- |
| Client APK/AAB + proiect iOS | `ro.cefaci.app`, 0.3.1, versionCode 4 | `11603147808` |
| Business APK/AAB + proiect iOS | `app.cefaci.business`, 1.0.1, versionCode 2 | `11603027058` |
| Business web ZIP | `version.json` = `a7eea11` | `11601824313` |

Artefactele au fost verificate după digestul GitHub și checksumurile din build. Fișierele finale sunt în `release/`; SHA-256 în [ARTEFACTE-SHA256.txt](ARTEFACTE-SHA256.txt), iar semnarea/metadatele în `builds/`. Artefactele Actions expiră la **07.01.2027**. Certificatul este același pentru APK și AAB: `d7714280ace4bcb3b37d5738f9334fb1fca9f29ac35024d5d5622d1d26cf853e`. APK Signature Scheme v2 a fost verificată de `apksigner` în CI; certificatele AAB au fost verificate prin keytool.

Auditul manifestelor compilate din APK-urile descărcate confirmă package/versionCode, backup dezactivat, release fără debug/cleartext și lipsa microfonului/overlay. Business are numai cameră, rețea și vibrație; nu are locație sau stocare. Clientul păstrează permisiunile necesare pentru GPS, poze și notificări. Scriptul reproductibil este `scripts/audit-native-artifacts.py`. Arhivele au CRC valid, Dex/biblioteci native/proiecte Xcode; nu există keystore-uri/parole incluse. iOS livrează proiectul generat, fără IPA sau test pe dispozitiv Apple.

Pachetele anterioare sunt păstrate în `release/previous-20261008/`, metadatele lor în `builds/previous-20261008/`, iar raportul inițial în [RAPORT-INITIAL-20261008.md](RAPORT-INITIAL-20261008.md).

## Backend instalat

Exclusiv `vqrmwuarjjntusfbqprx`:

- V2 inițial: `20261008110910_cefaci_client_business_v2_20261008`.
- Gard legacy: `20261008114010_cefaci_legacy_group_guard`.
- Audit V3: **`20261009075509_cefaci_security_audit_v3`**, fișier local `20261008143201_cefaci_security_audit_v3.sql`, SHA-256 `8bbb003c798efc45302e0ff978a7e63f3be037594d192d4c04b292441f1dc9d4`.
- `citeste-bon`: **v10 ACTIVE, verify_jwt=true**, import Supabase exact 2.117.2; unica schimbare față de v9 este versiunea bibliotecii. SHA instalat `e61c962f0df066680ca165e4d4ca5f629002e7f52ac0588380c451424d38f180`. Secretele existente sunt păstrate.

Cele șase funcții V3 au gardurile și granturile corecte verificate live; anon nu le poate executa. Public/private păstrează RLS, `outing_events` rămâne Realtime și bonul V2 este service-only. `billing_ready=false` rămâne. Snapshoturile definițiilor pre-V3 și Edge v9 sunt păstrate fără date personale. Procedura de pauză și mappingul local/live sunt în [BACKEND-SI-REVENIRE.md](BACKEND-SI-REVENIRE.md). Migrațiile instalate anterior nu au fost editate/reluate; nu s-au făcut reseturi, ștergeri sau fixture-uri de fraudă în producție.

Diferența istorică de profile a fost confirmată de utilizator ca rezultat al ștergerilor sale. Nu este atribuită migrațiilor și nu au fost încercate restaurări ale persoanelor reale.

## Verificări încheiate

- **313 teste trecute**, unul opțional omis, 34 fișiere de teste trecute, atât local cât și verify în CI.
- 11 regresii V3: nouă eșuează pe implementarea anterioară, toate trec cu V3.
- Typecheck Client/Business; export web Business, Vite root și export Android Hermes Client.
- Șase scenarii PostgreSQL 17 cu conexiuni independente: capacitate, retry, ultim răspuns, invitație simultană cu rezervarea, stock Drop și trei scanări.
- Browser sintetic pe telefon/desktop, zi/noapte: program Plus, scanare invalidă după succes, refresh/ordine financiară, validări, logout, retry și răspunsuri întârziate; zero erori JS.
- Apache: permisiuni, HTTPS redirect, fallback, cache/MIME, login/fonturi, CSP/HSTS; script inline injectat blocat.
- API live: catalog public, Business/grup/bon refuzate anonim, schemele private/net neexpuse, OCR fără sesiune refuzat. Nu s-au trimis emailuri sau notificări de test.
- Pachete: digesturi, SHA-256, CRC, semnare, manifest compilat, lipsa secretelor și a fixture-urilor. Source maps: 470 module Business web și 1.823 Client native; `braces`/`node-forge` nu intră în bundleurile respective.

## Pașii operaționali rămași

`https://business.cefaci.app` este online: la verificarea read-only din 09.10 servește încă **`4d10d80`**, versiunea anterioară, fără noile CSP/HSTS. **Noul ZIP trebuie încărcat pe gazduire.net**; credențialele de upload nu au fost furnizate. Pașii exacți sunt în [INSTALARE.md](INSTALARE.md).

Auditul npm nu mai are critical/moderate, dar păstrează **3 high root și 15 high per aplicație**, propagate din două biblioteci de build fără patch compatibil în registru. Nu se aplică downgrade Expo 44. Advisory-urile și dovada separării de bundle sunt în raportul de audit. PostgreSQL live este 17.6, iar protecția pentru parole compromise este dezactivată: necesită administrarea/configurația platformei. Nu este declarată securitate absolută.

Facturarea fiscală, plățile, abonamentele Plus plătite, biletele plătite și push Business în fundal rămân neconfigurate. Nu este declarată testare pe telefon fizic, OTP primit prin email real sau OCR cu bon real. Activarea localurilor/rolurilor reale și verificarea pe dispozitive proprii sunt pași operaționali descriși în instalare.

## Backupuri

Remote reverificat, fără suprascriere:

- `backup/claude-original-20261008`: `9d1e02c70aa3c1634c298011e50dd6a65e6ea287`.
- `backup/cefaci-current-20261008`: `45ad4963403283ab234d9811a562979c7f1b8cee`.

Snapshoturile de definiții și ramurile de cod nu înlocuiesc backupul de date/PITR administrat pe platformă.
