# CeFaci — contradicții între Business, client și backend

Verificare: 8 octombrie 2026. Repository: `Cr3azyMadboYT/CeFaciDownloadBeta`, branch `claude/new-session-hzbjtf`, commit `45ad4963403283ab234d9811a562979c7f1b8cee`, verificat din nou în GitHub. Backend: proiectul CeFaci2.0, definiții și metadate citite live din Supabase. Preview: `cefaci-business-actualizat.html`, cu logica din `main-template.html` și `business-rules.js`.

Nu am schimbat aplicația, preview-ul, regulile din repository sau baza de date. Am citit definițiile, am rulat scenarii sintetice într-un SELECT fără scrieri și am executat logica existentă a preview-ului într-un mediu local izolat. Cele 20 de verificări confirmă observațiile de mai jos; nu reprezintă 20 de teste end-to-end reușite ale produsului.

**Concluzie:** Business-ul demonstrativ, aplicația mobilă și backend-ul nu formează încă un flux complet. Unele probleme sunt contradicții între implementări; altele sunt funcții planificate, încă lipsă. Regulile aprobate în conversație după backup au prioritate față de textele mai vechi, dar nu sunt încă implementate.

## 1. Rezervarea din client nu ajunge în Business

**Funcție lipsă, esențială pentru integrare.** În aplicația mobilă, „Rezervă” deschide telefonul/site-ul localului, iar „Da, notează rezervarea” schimbă biletul local în `noted`. Nu trimite o cerere CeFaci. Business-ul folosește date sintetice și nu contactează backend-ul. În conversia catalogului, fiecare local este încă marcat `partner: false`.

**Consecință:** rezervarea notată pe telefon nu apare în panoul localului. Nu este o rezervare confirmată prin CeFaci și nu poate justifica un comision de rezervare.

**De construit:** cererea unică de pe server, ID-ul ei pe bilet, răspunsul localului și actualizarea aceluiași rând în ambele interfețe. Rezervările prin telefon/site rămân externe, fără comision CeFaci.

Dovezi: `mobile/src/app/bilet/[pid].tsx`, `mobile/src/lib/plans.ts` (`res: none | ext | noted`), `src/app/bridge.ts:toPlace`, `output/business-rules.js:1–3`. Nu există apeluri native la `reservation_request`, `drop_claim` sau `visit_scan`.

## 2. „Rezervări obligatorii + oprite = ascuns” nu este conectat

**Regulă nouă aprobată, neimplementată.** Backend-ul păstrează `reservations_on`, dar nu un mod comun „obligatorii / recomandate / nenecesare”. Clientul deduce necesitatea rezervării din categoria locului și din existența telefonului/site-ului. Sincronizează `venues`, fără să citească setările partenerului. Oprirea rezervărilor blochează RPC-ul de rezervare, dar nu ascunde localul din planuri, căutare și hartă.

**Regula necesară:** obligatorii + oprite → indisponibil pentru descoperire și planuri noi; recomandate + oprite → vizibil, fără rezervare CeFaci; nenecesare → mers direct. „Pauză local” trebuie separată de „Pauză parteneriat”, de oprirea Drops și de oprirea Plus.

Rezervările deja confirmate trebuie păstrate. Nu putem implementa ascunderea prin ștergerea localului din toate datele telefonului: biletul existent îl caută tot după ID. Trebuie păstrat un acces distinct pentru rezervări și istoric. Nici linkurile directe, nici sugestiile de înlocuire și nici rezultatele ținute în cache nu trebuie să permită un plan nou neeligibil.

Dovezi: `public.biz_settings_save`, `public.reservation_request`; `mobile/src/lib/places.ts`; `src/app/bridge.ts:toPlace/rebuild`; coloanele live din `partners`.

## 3. Programul Plus există în prezentare, dar nu în setările serverului

**Contradicție și funcție lipsă.** Clientul promite reduceri în zilele alese de local. Preview-ul are excluderea serilor aglomerate și spune „schimbarea se aplică de mâine”. Serverul păstrează un singur `plus_pct` și îl schimbă imediat. Nu are intervale de 10/15/20%, excepții, dată de intrare în vigoare sau operațiunea limitată „Plus oprit azi”.

**Exemplu:** 20% marți între 14:00 și 18:00 nu poate fi reprezentat corect în backend. Fără un model comun, biletul și scannerul pot arăta alt procent decât cel așteptat de local.

**De construit:** program pe ora localului, modificări cu dată de aplicare, afișarea procentului valabil la ora planului și păstrarea dreptului aplicabil la sosire pentru întreaga vizită.

Dovezi: `public.biz_settings_save`; `public.visit_scan`; `mobile/src/app/(tabs)/plus.tsx`; `output/business-rules.js:plNextPct/plNextPeak`; coloanele live din `partners`.

## 4. Plus pentru maximum 4 persoane devine Plus pentru toată masa

**Contradicție confirmată în calcul.** Clientul și Business-ul spun „membrul + încă 3 persoane”. Preview-ul calculează reducerea proporțional pe nota comună. Backend-ul poate salva direct `pr.plus_pct`, indiferent de mărimea grupului.

**Exemplu verificat:** 6 persoane, un Plus care acoperă 4, reducere 15% → preview-ul calculează **10% pe nota comună**. Ramura Plus din backend salvează **15%**. Pentru Drop, backend-ul nici nu combină beneficiul celor cu Plus din afara locurilor Drop în același mod ca preview-ul.

**De construit:** un singur calcul al persoanelor eligibile și al celui mai bun beneficiu per persoană, fără cumularea reducerilor. Toate ecranele folosesc rezultatul serverului.

Dovezi: `public.visit_scan`; `output/business-rules.js:cfOfferPct/arrive`; `mobile/src/app/(tabs)/plus.tsx:PERKS`. Calculul de 10% a fost executat și prin metoda reală `arrive` din preview.

## 5. Rezervare + Live Drop: serverul ignoră Drop-ul

**Contradicție confirmată.** Scannerul serverului caută un Drop numai dacă nu găsește o rezervare confirmată. Nu creează sosirea mixtă pe care Business-ul o prezintă.

**Exemplu:** 6 adulți, 4 cu Drop, treapta 2 → regula și preview-ul dau **4 × 7 + 2 × 5 = 38 lei**. Ramura actuală a serverului alege rezervarea, nu consumă oferta și nu aplică beneficiul Drop; calculul rezervării singure ar fi 30 lei după confirmarea celor 6 adulți.

**De construit:** aceeași sosire poate avea ambele surse. Repartizăm persoanele între surse, păstrăm ambele dovezi și numărăm o singură dată fiecare persoană taxabilă.

Dovezi: `public.visit_scan` (`if r.id is null then`); `private.price_visit`; `private.visit_fees`; `output/business-rules.js:cfFee`. Valoarea de 38 lei a fost verificată local; nu am creat sosiri în producție.

## 6. Capacitatea din Business nu există în rezervările serverului

**Funcție esențială lipsă.** Preview-ul blochează pistele și intervalele ocupate. Backend-ul auto-confirmă în funcție de mărimea grupului și de vechimea contului, fără inventar de mese/piste, intervale sau durată de ocupare.

**Consecință:** două conturi pot primi confirmări pentru același interval chiar dacă localul nu mai are loc. Blocarea concurenței pe cont nu ține loc de verificare a capacității localului.

**De construit:** resurse/capacitate pe intervale, rezervare atomică și aceeași disponibilitate în client și Business.

Dovezi: `public.reservation_request`; `output/business-rules.js:blocks/confirm/propose`; metadatele live ale tabelelor.

## 7. „Propune altă oră” nu are corespondent în client sau backend

**Funcție lipsă.** Preview-ul are propunere, termen de 15 minute și acceptare explicită simulată. Serverul permite doar `cerută`, `confirmată`, `refuzată`, `anulată`; decizia localului este doar da/nu. Nu există o propunere de oră pe care clientul real s-o accepte.

**De construit:** propunere cu termen, loc ținut temporar, răspuns al clientului, expirare și eliberarea capacității. Niciuna dintre aplicații nu declară confirmarea înainte de acceptarea serverului.

Dovezi: `public.reservation_decide`, constrângerea `reservations_status_check`; `output/business-rules.js:propose/acceptProposal`; modelul nativ `Plan`.

## 8. „Am ajuns” și bonul clientului nu completează fluxul Business

**Legătură lipsă.** „Am ajuns” din client apelează `xp_check_in` pentru XP și ștampile, nu `visit_scan` pentru sosirea Business. Bonul este trimis la `citeste-bon`, dar clientul nu are ID-ul sosirii Business pe bilet. În schimb, panoul localului listează `visits`.

**Consecință:** un check-in reușit în client nu este aceeași confirmare de sosire folosită în Business. Bonul/XP nu trebuie transformate implicit în taxă sau rezervare.

**De construit:** legătura explicită între plan, rezervare/ofertă, sosire și dovadă, cu rezultatul operațiunii întors clientului. XP și comisioanele păstrează scopuri și reguli distincte.

Dovezi: `mobile/src/lib/outing.ts:checkIn/sendBill`; `public.visit_scan`; `public.biz_today`.

## 9. Grupul nu are o identitate comună, iar a doua vizită poate fi absorbită

**Contradicție de model.** Regulile cer o sosire comună pentru gașcă și permit brunch + cină ca două rezervări reale. Backend-ul deduplică după cont + local + zi de lucru. Tabelele rezervări/ofertă/sosire nu au legături comune la `plan_id`, `crew_id` sau `outing_id`.

**Consecință:** același cont care revine în aceeași zi poate primi sosirea veche în locul celei pentru noua rezervare. Prietenii care scanează nu sunt legați automat de rezervarea făcută de organizator; apar alte înregistrări și numărătorile pot diverge. Nu am demonstrat facturare dublă prin operațiuni live.

**De construit:** ID pentru ieșire/grup și idempotență pe operațiune, nu o limitare a tuturor vizitelor zilnice la una singură.

Dovezi: `public.visit_scan`; coloanele live din `reservations`, `drop_claims`, `visits`; logica de produs, cap. 5.5.

## 10. Același plan poate avea 6 persoane la organizator și 2 la invitat

**Diferență confirmată în client.** Acceptarea unei invitații reconstruiește planul cu numărul **2** introdus direct în cod. Planul partajat pe server nu transmite numărul grupului prin acest flux.

**Consecință:** numărul de persoane de pe biletele gașcăi nu este o sursă comună pentru rezervare, ofertă și sosire.

**De construit:** numărul grupului pe planul serverului, distinct de cine a răspuns „Vin”; rezervarea folosește numărul confirmat, iar sosirea numărul real.

Dovezi: `mobile/src/lib/together.ts:answer` — `createPlanAt(inv.venueId, new Date(inv.startsAt), 2, ...)`.

## 11. Avantajul de 10 minute al Plus diferă între Drops

**Contradicție verificată prin calcule SQL fără scrieri.**

| Caz | Regula prezentată | Condițiile serverului |
|---|---|---|
| Drop „acum”, ora 20:00 | Plus acum, Free la 20:10 | Free poate trece verificarea de început chiar la 20:00 |
| Drop programat pentru 20:00 | Plus la 19:50, Free la 20:00 | Plus la 19:50, Free abia la 20:10 |

În plus, politica de citire a Drops permite utilizatorilor eligibili după vârstă să citească ofertele cu până la 12 ore înainte, fără o condiție Plus. Vizibilitatea anticipată și dreptul de a lua oferta trebuie definite separat și implementate consecvent.

Dovezi: `public.drop_claim`; politica `drops_read`; clientul Plus și regulile cap. 4.2. Verificarea a evaluat predicatele de timp pe date sintetice, fără apelarea RPC-ului care creează claim-uri.

## 12. Se poate crea o ofertă pe care nimeni nu o poate lua

**Contradicție matematică confirmată.** Backend-ul acceptă grup minim până la **10**, dar o luare de ofertă acceptă maximum **6** locuri și cere ca acestea să atingă minimul.

**Exemplu:** Drop „minimum 8 persoane” → orice solicitare permisă, de 1–6 locuri, este respinsă.

**De aliniat:** pentru modelul aprobat cu maximum 6 locuri, minimul unui Drop nu poate depăși 6. O eventuală ofertă de grup mai mare ar necesita alt flux explicit.

Dovezi: `drops_min_group_check`; `public.drop_claim`; `output/business-rules.js:fMoreMin`.

## 13. Eligibilitatea Drop-ului nu este verificată pentru întreaga gașcă

**Protecții planificate, încă lipsă.** Preview-ul și regulile resping luarea de lângă local, grupurile cu minori pentru alcool și grupurile care au deja o sosire. RPC-ul verifică vârsta și istoricul titularului, dar nu primește grupul sau poziția la luare. Verifică `visits`, fără să includă check-in-urile XP folosite de clientul actual.

**Consecință:** regulile promise nu pot fi impuse complet de server. „Client nou prin CeFaci” poate avea alt sens în client și în backend, iar un adult poate fi titularul unui grup neeligibil.

**De construit:** grup comun, istoric relevant și verificări de eligibilitate pe server. O poziție trimisă de telefon rămâne o dovadă limitată; nu trebuie prezentată drept protecție completă antifraudă.

Dovezi: semnătura și corpul `public.drop_claim`; `mobile/src/lib/outing.ts`; `output/business-rules.js:cfDropCheck`; regulile cap. 4.2–4.3. Nu am încercat luări frauduloase pe date reale.

## 14. Limita de 12 ore pe săptămână și pauza de 2 ore lipsesc din server

**Diferență confirmată.** Preview-ul le verifică în memoria demo. Serverul verifică durata și suprapunerea, dar nu impune plafonul săptămânal sau intervalul de 2 ore între Drops.

**Consecință:** un alt client/API poate crea oferte succesive care respectă verificarea de suprapunere, dar încalcă politica prezentată localului.

**De construit:** aceleași limite în backend, pe calendarul localului, inclusiv pentru oferte programate.

Dovezi: `public.drop_create`; `output/business-rules.js:patchOffer` și salvarea ofertei.

## 15. Totalul încasărilor Business nu poate veni din sumarul actual

**Contract de date incomplet.** Ecranul Business promite încasări, reduceri, comision și suma rămasă localului, inclusiv sursele cu comision zero. `biz_month` adună `bills` din `visit_fees`, care include numai rezervări și Drops închise și confirmate. Vizitele doar Plus/plan nu intră în acest total. Numărul general de vizite/oameni are altă selecție, care include și vizite neînchise.

**Consecință:** încasările sunt subraportate dacă le prezentăm drept totalul tuturor vizitelor. Ratele și mediile pot folosi numărători care nu au aceeași bază.

**De construit:** sumar de încasări pentru toate sursele și selecția perioadei, separat de comision; reduceri raportate sau verificate; sumă rămasă = încasări după reduceri − comisionul corespunzător aceleiași selecții. Dacă lipsesc note, afișăm total parțial. Costurile restaurantului rămân în afara produsului.

Dovezi: `public.biz_month`; `private.visit_fees`; `output/business-rules.js:renderVals/finance`.

## 16. Refuzarea reducerii poate șterge taxa Drop

**Contradicție cu regula scrisă.** Regulile spun că, dacă localul refuză nejustificat beneficiul unui client eligibil adus de Drop și cazul este confirmat, taxa rămâne; clientul primește compensația Plus prevăzută, iar localul avertisment. Preview-ul blochează calculul când `benefit === false`. Backend-ul folosește numărul declarat ca beneficiind de reducere; zero poate duce la taxă zero.

**De clarificat în date:** ofertă neeligibilă/expirată, beneficiu aplicat și refuz nejustificat confirmat sunt situații diferite. Refuzul nu trebuie confundat cu neeligibilitatea și nu trebuie să devină o metodă de evitare a taxei. Cazul contestat rămâne blocat până la decizie.

Dovezi: regulile cap. 4.5; `output/business-rules.js:cfFee`; `private.visit_fees`; `public.biz_visit_attendance`. Nu există încă facturare finală automată: problema afectează logica estimărilor și proiectarea fluxului final.

## 17. Răspunsurile localului și disputele nu au circuit complet

**Legături lipsă.** În client există actualizări pentru planurile sociale și voturi, dar nu un flux de rezervare/ofertă/sosire. În backend, rezervările și sosirile sunt în publicația Realtime, dar asta singură nu construiește abonarea clientului. Nu există trigger de push pentru rezervări, iar funcția de notificări existentă tratează fluxurile sociale. Confirmarea numărului redus, întrebarea către client cu termen de 24 h, contestația și soluționarea nu au circuit complet.

**Consecință:** dacă un local schimbă o stare, clientul nu primește automat în fluxul actual informația și acțiunea necesare. Un mesaj „așteptăm clientul” din demo nu este o întrebare livrată unui cont real.

**De construit:** evenimente persistente și răspunsuri autorizate, actualizare în aplicație, notificări unde sunt necesare, termen și comportament la lipsa răspunsului; recuperare după reconectare, fără a considera push-ul drept singura sursă de adevăr.

Dovezi: metadatele live pentru trigger-e și Realtime; `mobile/src/lib/together.ts`, `votes.ts`, `push.ts`; `output/business-rules.js:closeTable`; funcțiile `reservation_decide` și `biz_visit_attendance`.

## 18. Textele mai vechi se bat cap în cap cu deciziile aprobate

**Nealiniere de documentație și preview.** Preview-ul încă spune că reducerile nu influențează recomandările. În conversație s-a aprobat o posibilă prioritate pentru oferta mai bună între două localuri la fel de potrivite. Documentul vechi mai păstrează în corp propunerea „a patra vizită gratuită”, deși nota de actualizare și conceptul nou spun că aceasta nu este activată. Formularea „clientul este gata” include și fluxuri de parteneri încă neimplementate în aplicația nativă.

**De aliniat:** un singur document cu regulile active și o coloană separată pentru starea implementării. Marcăm bonusul ofertei numai între variante potrivite utilizatorului, dacă păstrăm decizia aprobată; nu promitem promovare indiferent de relevanță. Eliminăm formulările obsolete din documentația activă când se implementează noua regulă.

Dovezi: `output/main-template.html` — „Ofertele nu te urcă în recomandări”; `docs/logica-business-admin.md` — introducere și cap. 8.2; `docs/business-v1-concept.md`; deciziile din conversație.

## 19. O sosire în jurul orei 05:00 poate ajunge în altă zi financiară

**Diferență de regulă confirmată în sursă, fără scenariu live.** Documentul spune că ziua de lucru financiară se ia din rezervare sau luarea ofertei. `visit_scan` o ia din momentul scanării. O rezervare la 04:50, scanată la 05:05, poate avea ziua financiară deplasată, cu termen de închidere și sumar zilnic diferite.

**De aliniat:** ziua operațională pe sursa sosirii, în fusul localului; XP poate păstra calendarul lui separat. Aceeași zi trebuie folosită de Business, Admin, comision și termene.

Dovezi: `public.visit_scan` — `today := private.work_day(now())`; regulile cap. 5.1 și 5.2; `public.visit_close/biz_visit_attendance`.

## Ce este deja coerent și ce nu trebuie confundat cu un bug

- Backend-ul și preview-ul folosesc baza per persoană, nu procent din bon. Plus fără rezervare/Drop și planul simplu nu sunt surse taxabile în calculul existent.
- Există tarife păstrate la sosire, plafon de 10 persoane taxabile și confirmarea numărului eligibil. Gratuitatea este distinctă de taxa informativă.
- Oprirea unui Drop blochează luările noi, dar scannerul serverului poate păstra beneficiul pentru un claim deja luat și încă valabil. Acesta este comportamentul dorit; nu trebuie schimbat într-o anulare globală.
- `biz_month` este marcat explicit `estimate: true`, `billing_ready: false`. Facturile, contestațiile financiare complete și plățile sunt dezvoltare viitoare. Cifrele demo nu reprezintă încasări reale.
- Evenimentele/biletele și activarea invitațiilor Business sunt fluxuri planificate; prezentarea lor în demo nu dovedește că sunt conectate la client sau la plăți.

## Ordinea necesară de rezolvare

1. Contract comun pentru local, vizibilitate și program Plus; reguli active separate de propuneri și de starea implementării.
2. Rezervare reală: client → server → Business → răspuns în client, cu inventar de capacitate, propuneri de oră și anulări.
3. Identitate comună de plan/grup/ieșire și sosire; numere consecvente pe biletele tuturor.
4. Eligibilitate și calcul unic Plus/Drop/rezervare, inclusiv surse mixte și drepturi păstrate.
5. Sumar financiar complet și stări de clarificare; facturarea finală numai după validarea întregului circuit.

Până la aceste legături, designul poate fi păstrat, dar nu trebuie prezentat ca un Business deja funcțional în relație cu aplicația mobilă. Backup-urile existente rămân punctele de revenire; verificarea de acum a fost doar citire și simulare locală.
