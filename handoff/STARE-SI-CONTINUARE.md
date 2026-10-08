# Stare verificată la predarea către Codex Cloud — 8 octombrie 2026

## Cod păstrat și disponibil

Repository: `Cr3azyMadboYT/CeFaciDownloadBeta`.

- `claude/new-session-hzbjtf`: `45ad4963403283ab234d9811a562979c7f1b8cee`, verificat din nou pe remote la pregătirea predării.
- `backup/claude-original-20261008`: `9d1e02c70aa3c1634c298011e50dd6a65e6ea287`.
- `backup/cefaci-current-20261008`: `45ad4963403283ab234d9811a562979c7f1b8cee`.
- `codex/cefaci-client-business-20261008` a existat numai local, fără push. Nu o folosi ca punct de pornire remote.

Commitul de bază conține reparațiile auditului anterior și baza de comision per persoană. Clientul și Business nu sunt încă integrate conform noilor reguli. Auditul atașat descrie 19 contradicții/lipsuri de la această bază. Reproducerea lor se face pe date sintetice, nu prin atacuri asupra persoanelor reale.

## Muncă locală pierdută la curățarea mediului

A existat un checkout local cu Client actualizat, patru migrații și un proiect Business React Native/Expo. Nu a fost comis sau urcat, nu a fost instalat pe backend și nu există în fișierele de predare. Mediul temporar a fost curățat automat între mesaje. Nu se poate restaura acel checkout din fișierele persistente recuperate.

Ultima execuție locală raportase 280 de teste trecute, un test de tabel opțional omis, typecheck Client/Business/root, verificarea Deno a funcției de bon, export web Business, export JS Android Client și UI Business testat pe PostgreSQL local cu fixture-uri sintetice. Aceste rezultate sunt istorice ale codului pierdut, NU dovezi de validare pentru codul din GitHub sau pentru noua implementare Cloud. Nu există APK/IPA din acea încercare. Nu există migrații V2 instalate sau update nou al funcției de bon din acel task.

## Direcția tehnică a încercării — ghid, nu API deja disponibil

1. Migrația de participare: număr pe plan, deadline/închidere, `timed_out`, API-uri `plan_share_v2`, `plan_answer_v2`, `plan_attendance`, idempotency key, garduri contra editării directe a grupului/deadline-ului.
2. Operațiuni partener: mod de rezervare, pauză generală, capacitate și durată, program Plus/versiune de mâine, oprire Plus azi, catalog public whitelist; rezervare pe plan, inventar atomic, altă oră/acceptare/expirare.
3. Vizite: identitate de grup/plan, bilet comun, sosire personal/client, Plus al participanților, tarife înghețate cu surse mixte, confirmare/contestație, toate încasările separate de taxele eligibile, evenimente RLS, legătura bonului cu vizita.
4. Aliniere: finanțele legacy/Admin, anularea planului eliberează rezervarea, vechile API-uri nu ocolesc regulile.
5. Un contract TypeScript comun între native Client și Business; Business într-un proiect `business/`, export web static și Android/iOS native, cu aceleași servicii Supabase.

Numele și semnăturile V2 sunt orientative. Construiește-le coerent, fără să te bazezi pe existența lor pe server.

## Capcane observate — verificări obligatorii în reconstrucție

- Biletul deschis imediat după trimiterea găștii poate crea un plan solo paralel. Folosește idempotency și coordonarea operațiunilor; nu pierde invitațiile.
- Răspunsurile async de la vechiul user/local/plan pot umple ecranul după logout sau schimbare. Folosește invalidarea cererilor și ștergerea datelor private, inclusiv la revocarea rolului.
- `TOKEN_REFRESHED` pentru același utilizator nu trebuie să reseteze dashboardul la nesfârșit. La pornire, două refresh-uri nu trebuie să invalideze încărcarea inițială.
- Un `propusă` expirat nu trebuie să țină indexul de rezervare activă ocupat sau să ascundă butonul unei cereri noi.
- Anularea planului nu se limitează la ștergerea biletului de pe telefon; trebuie eliberată rezervarea reală.
- Plus al prietenului confirmat contează și la Drop, nu numai la sosire.
- Eligibilitatea „client nou” trebuie să includă istoricul membrilor grupului, XP/check-in, bonuri și vizite; vizitele Business fără XP nu trebuie ignorate.
- API-ul vechi `drop_claim` fără grup/GPS poate ocoli complet noul flux. Retrage sau adaptează căile vechi și testează refuzul bypass-ului.
- Editarea numărului/orei în bilet trebuie validată și salvată pe server înainte de confirmarea UI. Nu lăsa limite fixe 6/30 sau diferențe între date locale și server.
- „Merg” și votul de activitate nu trebuie confundate. Traseele cu mai multe bilete trebuie să aibă o regulă explicită pentru participare; nu produce obligația ascunsă de a răspunde de mai multe ori aceluiași plan.
- Feed-ul de Drops trebuie actualizat la modificare/oprire, nu încărcat o singură dată. Dreptul deja luat rămâne distinct de oferta disponibilă acum.
- La setările Plus, butonul de pauză azi trebuie să folosească starea proaspătă de pe server, nu o copie de formular rămasă în urmă.
- `biz_team_set` scoate un om cu `p_role='scos'`, nu null. Managerul gestionează doar recepție/scanare.
- Raportul lunar vechi însumează numai surse taxabile; veniturile totale trebuie să includă Plus/plan. Aliniază și Admin-ul, fără să-l reconstruiești integral.
- Comisionul nu se bazează pe valoarea bonului. Numărul de persoane eligibile nu este automat egal cu numărul planificat, iar refuzarea nejustificată a reducerii nu șterge sursa comisionului.
- O sumă „rămasă” negativă din lipsa bonurilor nu trebuie prezentată drept bani finali ai localului. Marchează incompletitudinea înainte de total.
- Legătura bonului cu vizita trebuie verificată pentru participant, local, CUI și oră; XP are propriul calendar. Reducerea manuală nu se șterge când OCR nu poate extrage reducerea.
- Business offline nu confirmă capacitate sau scanări fictive. Realtime/polling cât aplicația este deschisă nu echivalează cu push de fundal.

## Backend cunoscut

Proiectul CeFaci2.0: `vqrmwuarjjntusfbqprx`, PostgreSQL 17.6. Ultima inspecție read-only din taskul anterior găsea 30 de migrații live, ultimele `20261007165417 cefaci_audit_fixes` și `20261007165421 cefaci_business_fee_basis`. `plans` nu avea încă `people`, deadline sau client key. Partenerii nu aveau încă mod de rezervare/program Plus/capacitate V2. Verifică din nou înainte de instalare.

Funcția `citeste-bon` era versiunea 8, `verify_jwt=true`. Păstrează autentificarea corectă, inclusiv verificarea explicită a userului. Nu schimba funcțiile sociale sau alte proiecte pentru a face Business.

Backupul istoric include date de aplicație și definiții, dar nu este un backup complet Auth/Storage/secrete. Nu îl importa în întregime în mediul Cloud și nu comite date personale. Ramurile de backup sunt punctele de revenire pentru cod.

## Ce livrezi și cum delimitezi starea

Actualizează Clientul, construiește Business, testează legăturile comune și livrează codul, pachetul gazduire.net și APK-urile construite. Verifică fiecare punct de audit în noul cod. Facturi/plăți, push Business de fundal, evenimente cu bilete și disputa financiară completă au nevoie de circuit real; nu le descrie ca gata dacă sunt doar promise. Nu revendica backend instalat sau site publicat doar pentru că exportul a trecut.
