# Reparațiile CeFaci — 7 octombrie 2026

Bază analizată: `9d1e02c70aa3c1634c298011e50dd6a65e6ea287`, ramura `claude/new-session-hzbjtf`. Reparațiile păstrează interfața: nu sunt modificate ecrane native, fonturi, culori, stiluri sau canvasuri de design.

## Bugurile confirmate și reparațiile

| Problemă din audit | Reparație | Verificare |
|---|---|---|
| Cont nou care își schimbă `profiles.created_at` obține auto-confirmare | Data profilului este imutabilă; rezervarea folosește data din Supabase Auth | Încercarea de antedatare nu modifică data; rezervarea rămâne cerută. Editarea normală a prenumelui funcționează. |
| Minorii pot citi Live Drops 18+ | Politica RLS filtrează vârsta și la citire | Contul de 17 ani nu citește și nu poate lua oferta; contul adult o poate folosi. |
| Rolul Scanare citește firma, CUI, tariful și notele clienților | Payload pe rol, aceeași restricție în lista localurilor; Manager nu primește CUI | Scanner nu primește bani/rezervări; Manager poate citi partea permisă; dezactivarea rolului blochează imediat apelul. |
| Limita zilnică de prietenii se ocolește prin ștergerea rândului | Istoric privat pentru ultimele 24 h, scris numai de trigger; lacăt pe solicitant | 40 cereri trimise și șterse; a 41-a este refuzată. Istoricul nu este accesibil clientului. |
| Upload-ul consideră o eroare Supabase rezolvată drept succes | Confirmarea doar după succes; coadă serială, stare recentă, reîncercări limitate și oprire la logout | Eroare returnată → reîncercare; modificarea nouă câștigă; logout anulează coada; citirea eșuată nu deschide fals un cont nou. |
| Local închis la o altă dată este exclus global, chiar după un rezultat „deschis” | Cache pe intervalul cerut; constructorul filtrează candidatul la ora lui; eticheta verificării se aplică doar intervalului verificat | Același local poate fi închis mâine și deschis azi; altă durată nu moștenește rezultatul; expirarea permite revalidarea. |

## Întăririle suplimentare legate de Business

- Personalul activ nu poate lua oferta propriului local.
- Scanarea unui drop înainte de 10 minute este refuzată.
- Procentul pe nota comună este ponderat cu locurile eligibile; un loc nu dă reducerea întregii mese.
- Grupul sub minim nu consumă oferta; o scanare validă returnează locurile nefolosite.
- Scanările simultane ale aceluiași client/local sunt serializate, iar o sosire închisă nu-și schimbă numărul prin rescanare.
- Coordonatele geografice în afara intervalelor valide sunt refuzate.
- Helper-ul intern pentru cuvântul serii nu mai poate fi apelat separat de rolul aplicației.

## Regula de bani

Modelul procentual 10%/8% din nota clientului este înlocuit în calcul cu 2/5/8 lei pentru rezervare și 3/7/10 lei pentru Live Drop, pe persoană taxabilă; fondatorii au minus 1 leu. Planul simplu și Plus simplu au taxa 0. Limita este 10 persoane și, la drop, cel mult locurile eligibile luate.

Prețul, treapta, statutul de fondator, gratuitatea și firma/CUI se păstrează la crearea sosirii. Numărul taxabil se confirmă explicit de local; suma notei nu modifică taxa. Treapta inițială este setată numai de un rol Admin autorizat și este jurnalizată. O treaptă existentă nu poate fi înlocuită prin acest endpoint.

Lipsa treptei ori a confirmării produce un calcul blocat. Vizitele vechi nu sunt recalificate retroactiv. `biz_month` și sumarul financiar Admin au `estimate=true`, `billing_ready=false`: **nu reprezintă facturi sau taxe definitive**. Modelul complet pentru grupuri cu surse combinate, contestații, contracte versionate și facturi va fi construit în Business; nu este simulat de această migrare.

## Verificări efectuate

- **263 teste trecute**, 1 test existent omis, în 28 fișiere de teste; includ 798 de scenarii de planificare.
- Teste reale PostgreSQL/PGlite pentru politici, roluri, permisiuni, fraude și calcul; Supabase Auth este simulat în testele locale.
- Matrice pentru toate cele 3 trepte × fondator/normal × rezervare/drop/Plus/plan; plafon, locuri eligibile, gratuitate, neprezentare și păstrarea condițiilor istorice.
- `npx tsc --noEmit` pentru aplicația nativă: trecut.
- Export JavaScript Android prin Expo/Metro: trecut. Acesta verifică pachetul aplicației, fără a fi o probă pe telefon sau un APK instalat.
- Compilare web Vite și verificarea diferențelor Git: trecute.

## Backend instalat

Migrațiile noi, cu aceleași versiuni ca în istoricul live (`20261007165417`, `20261007165421`), au fost aplicate cu succes în proiectul Supabase **CeFaci 2.0**. Verificarea SQL de după aplicare confirmă data imutabilă, folosirea vârstei contului din Auth, RLS pentru 18+, istoricul privat, revocarea helper-ului, calculul per persoană, RLS pe noile tabele, blocarea accesului anonim la noile endpoint-uri și marcarea facturării indisponibile.

La verificarea dinaintea schimbării, baza avea **0 parteneri, 0 rezervări și 0 vizite**. Nu au fost create conturi ori tranzacții sintetice în producție. Încercările de fraudă cu date fictive au rulat local.

Advisor-ul de securitate are aceleași categorii de notificări ca înainte: tabele private fără politici sunt închise intenționat; RPC-urile cu `SECURITY DEFINER` necesită verificările explicite de rol testate; `pg_net` în schema publică și verificarea parolelor compromise sunt notificări de configurare existente. Nu declarăm backend-ul lipsit de orice risc pe baza acestui raport.

## Ce rămâne înainte de lansarea Business

1. Verificarea dispozitivului: hash-ul de telefon folosit la trial poate fi falsificat. Soluția necesită atestarea dispozitivului, nu doar schimbarea hash-ului.
2. Luarea drop-ului cu locație verificată, membrii grupului și minorii din grup; integrarea pe telefon a fluxului de rezervări și scanare.
3. Capacitate reală pe intervale, toate stările de rezervare și verificarea sosirii offline.
4. Identificarea grupului, repartizarea între rezervare și drop, confirmări și contestații; nicio persoană facturată de două ori.
5. Taxe definitive, contracte și perioade gratuite versionate, liste lunare, facturare și reconciliere. Estimarea de acum nu le înlocuiește.
6. Verificare pe dispozitive reale, inclusiv logout/schimbare cont, internet instabil, cameră și notificări.

Conceptul produsului: `business-v1-concept.md`. Reparațiile clientului intră în aplicația instalată numai după recompilare și instalarea versiunii noi; actualizarea backend-ului este deja activă.

Istoricul mai vechi live este împărțit în alte versiuni decât migrațiile istorice din repository. Nu se folosește `supabase db push` pentru a relua toate fișierele fără reconcilierea acelui istoric; cele două migrări de acum sunt deja instalate.
