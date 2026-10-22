# Evenimente și bilete

Cornel, 22.10: „concertele pe Acasă și Explorează … să-l poți șterge ușor … gândit foarte bine cu biletele, lucrăm cu banii altora”.

## Faza 1 (făcută): arătăm, nu vindem

- **Banii nu trec prin CeFaci.** Nu vindem, nu încasăm, nu rambursăm, nu vedem datele cardului. „Cumpără bilete pe iaBilet” deschide pagina vânzătorului oficial, în browserul din aplicație.
- **Linkul poate duce doar la un vânzător oficial.** Doar `https`, doar o adresă din lista `private.ticket_sellers` (iaBilet, Eventbook, Entertix, LiveTickets, MyTicket, Bilete.ro, AmBilet, Oveit, Eventim, TicketStore, Fever). Verificarea se face de trei ori:
  - în Admin, când salvezi;
  - pe server, la salvare (`admin_event_save`) și la fiecare apăsare (`event_ticket_url`);
  - pe telefon, înainte să deschidă (`sellerOf`).

  Trucuri ca `iabilet.ro@site-fals.com`, `iabilet.ro.site-fals.com` sau `http://` sunt refuzate (teste: `tests/events.test.ts`, `tests/events-rank.test.ts`). Un vânzător nou se adaugă cu o migrare și în `SELLERS` din `src/events/events.ts`. Testul verifică să fie aceeași listă în ambele locuri.
- **Omul știe de la început cum plătește.** Înainte de buton scrie: „Biletul îl cumperi direct de la {vânzător}. CeFaci nu încasează bani și nu vede datele cardului. Pentru schimburi sau bani înapoi vorbești cu {vânzător}.”
- **Anulat sau amânat:** evenimentul rămâne vizibil cu starea nouă. Aplicația spune că banii îi dă înapoi vânzătorul de la care ai cumpărat biletul. Sold out: fără buton de cumpărare.
- **Cine vede:** doar cine are cont; evenimentele publicate, de acum 12 ore până peste 60 de zile (telefonul arată 30 de zile). Sub 18 ani nu se văd evenimentele 18+.
- **Cine adaugă:** echipa, din Admin → „Evenimente” (dreptul `places.edit`: fondator, admin, editor; sesiunea Admin cu 2FA). Fiecare salvare rămâne în `private.event_log`.
- **Ce numărăm:** câți oameni diferiți au deschis biletele, o dată pe zi pentru fiecare (`private.event_clicks`). Cifra apare în Admin. E argumentul pentru o înțelegere de afiliere cu vânzătorii.
- **Unde apar:** pe Acasă, „Concerte și evenimente”, după „Bilu îți sugerează”. În Explorează, același rând, iar când cauți („concert”, „stand up”, „Subcarpați”, „Control”) apar evenimentele potrivite. Ordinea: cele mai apropiate ca dată și loc și cele care se potrivesc cu gusturile din cont primele, cele sold out la urmă.

## Faza 2 (de hotărât): bani din bilete fără să-i atingem

1. **Afiliere cu vânzătorii:** un procent pe bilet pentru oamenii trimiși de noi. Linkul primește codul nostru de partener, iar ei plătesc lunar, pe factură. Riscul pentru noi e zero: nu ținem bani, nu facem rambursări. Avem nevoie de contracte cu iaBilet, Eventbook etc. Cifrele din `event_clicks` ne ajută la negociere.
2. **Organizatorul plătește listarea** (de exemplu „Recomandat de Bilu” pe Acasă). „Sponsorizat” a fost scos (19.10), deci doar dacă se schimbă decizia.

## Faza 3 (construită, doar pe test): localul partener vinde bilete în CeFaci

Decizia lui Cornel (22.10): „Netopia, fără taxă pentru Plus, 2 lei restul”; procentul l-am ales noi.

**Banii**
- **Localul e vânzătorul** (comerciantul). Clientul plătește cu cardul prin Netopia (plăți împărțite). Banii merg direct la local; Netopia ne oprește automat partea noastră. CeFaci nu ține banii altora.
- **Comisionul CeFaci: 8% din prețul biletelor, totul inclus.** Costul plății cu cardul (~1,5–2%) îl plătim noi din cele 8%. De ce 8%:
  - e sub ce iau vânzătorii mari de bilete de la organizatori (de obicei 8–12% plus taxe);
  - e același procent pentru toți și se explică într-o propoziție;
  - lasă ~6% net pentru noi după Netopia.
- **Taxa de serviciu: 2 lei pe bilet**, plătită de cumpărător și afișată înainte de plată. **0 lei cu Plus.** Taxa merge la CeFaci, nu se scade din banii localului.
- Exemplu: 100 de bilete × 50 lei = 5.000 lei.
  - Localul primește 4.600 lei.
  - CeFaci primește 400 lei comision plus până la 200 lei din taxe.
- Cifrele sunt în `private.ticket_config` (`commission`, `fee`, `hold_minutes`) și în `src/events/tickets.ts` (pentru ecrane).

**Fluxul**
1. **Business → Evenimente.** Proprietarul cere „contul de încasare” (firma, CUI, IBAN; păstrăm doar ultimele 4 caractere). Admin → Evenimente îl aprobă:
   - `test`: doar plăți de test;
   - `activ`: plăți reale, posibil abia când `ticket_config.live = true`.
2. **Localul adaugă evenimentul** și felurile de bilete: preț, câte bilete sunt, maximum pe comandă (cel mult 8 feluri). Reguli:
   - prețul unui fel cu bilete vândute nu se mai schimbă;
   - numărul de bilete nu scade sub cele vândute;
   - un fel scos doar se oprește (nimic nu se șterge).
3. **Clientul alege biletele** pe ecranul evenimentului. Vede totalul cu taxa (sau „0 lei cu Plus”), apoi „Cumpără”. Biletele sunt ținute 15 minute; o comandă nouă o eliberează pe cea veche. Limite:
   - cel mult 10 bilete de persoană la un eveniment;
   - 20 de încercări pe zi;
   - vârsta minimă e verificată pe server.
4. **Plata.** Pe test: „Plată de test”, fără bani (`ticket_order_test_pay`, merge doar cât `live = false`). Real: funcția Supabase `bilete-plata` (de scris la pornire) deschide plata Netopia. La confirmarea Netopia cheamă `ticket_order_paid(order, ref, suma)`, doar cu cheia de serviciu și doar dacă suma se potrivește.
5. **„Biletele mele”** (Planuri → Biletele mele, `mobile/src/app/bilete.tsx`):
   - fiecare bilet are QR-ul lui: `CFB1.<bilet>.<fereastra de 30 s>.<10 hex din sha256(secret.fereastră)>`;
   - QR-ul e făcut pe telefon, merge fără internet și se schimbă singur;
   - o poză mai veche de ~5 minute nu mai merge;
   - biletul se poate da unui prieten din CeFaci (de cel mult 3 ori, cu verificarea vârstei); prietenul primește un cod nou, iar codul vechi nu mai merge.
6. **La intrare:** Business → Scanner (același scanner ca la gășci). Codul `CFB1.` e verificat pe server:
   - biletul trebuie să fie pentru acel local;
   - codul trebuie să fie proaspăt;
   - fiecare bilet intră o singură dată („Biletul a fost deja folosit la 22:14”).
7. **Anulare:** localul apasă „Anulează evenimentul”. Toate comenzile plătite se întorc automat:
   - pe test: `rambursat` imediat;
   - real: `de_rambursat`, pe care `bilete-plata` îl trimite la Netopia.

   Amânat: biletele rămân valabile.
8. **Raport:** Business → Evenimente arată biletele vândute, câți au intrat, vânzările, partea CeFaci și ce primește localul.

**Siguranța**
- Tabelele nu se pot citi sau scrie direct din aplicație; totul trece prin funcțiile de pe server.
- Excepție: `ticket_types`, pe care clientul îl poate doar citi, și numai pentru evenimentele pe care le vede.
- Evenimentele de test le văd doar echipa localului și echipa CeFaci.
- Teste: `tests/tickets.test.ts`.

**Ce mai trebuie pentru plăți reale** (nu pornim până nu sunt toate):
- SRL-ul;
- contractul cu Netopia (marketplace / plăți împărțite) și cu fiecare local;
- termenii pentru cumpărători: fără drept de retragere de 14 zile la evenimentele cu dată fixă, cine răspunde la reclamații, rambursări;
- contabilul (TVA, e-Factura lunară pentru comision și taxe);
- confirmarea scrisă de la Google Play că biletele la evenimente fizice nu trec prin plata Google;
- funcția `bilete-plata` și IPN-ul Netopia;
- `update private.ticket_config set live = true`.

Migrarea: `20261022030000_cefaci_bilete_vanzare.sql` (aplicată pe Supabase 22.10).

## Cum se scoate

- **Rapid:** `mobile/src/features/events/flag.ts` → `EVENTS_ON = false`. Nimic despre evenimente nu mai apare în aplicație.
- **Complet:**
  1. Șterge:
     - `mobile/src/features/events/`
     - `mobile/src/app/eveniment/`
     - `src/events/`
     - `src/i18n/en/events.ts`
     - `admin/src/events.tsx`
     - `tests/events.test.ts`, `tests/events-rank.test.ts`, `tests/tickets.test.ts`
     - `src/events/tickets.ts`, `mobile/src/app/bilete.tsx`, `business/src/tickets.tsx`
  2. Scoate rândurile marcate `Evenimente (22.10)`:
     - `mobile/src/app/(tabs)/acasa.tsx`: importul și `<EventsRail …/>`
     - `mobile/src/app/rezultate.tsx`: importul și `<EventsRail …/>`
     - `admin/src/App.tsx`: importul, tab-ul `events` și ecranul
     - `admin/src/ui.tsx`: iconița `events`
     - `src/i18n/index.ts`: `events`
     - `mobile/src/app/(tabs)/planuri.tsx`: `MyTicketsRow`
     - `business/src/App.tsx`: `Tickets` (tab-ul „Evenimente”); `business/src/screens.tsx`: ramura `CFB1.` din Scanner
     - `shared/role-tutorials.ts`: pașii `events`
  3. Pe server, o migrare nouă:

     ```sql
     drop function public.admin_event_save(uuid,jsonb), public.admin_events(date), public.event_ticket_url(uuid), private.ticket_seller(text);
     drop table private.event_log, private.event_clicks, public.events, private.ticket_sellers;
     ```

     Supabase cere confirmare pentru `drop`.
