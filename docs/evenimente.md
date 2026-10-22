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

## Faza 3 (doar cu SRL, avocat și contabil): vânzare în CeFaci

Banii ar trece printr-un procesator autorizat (Stripe Connect sau Netopia), care plătește direct organizatorul. Ar trebui gândit și rezolvat:
- rambursările la anulare;
- biletele nominale și verificarea la intrare;
- TVA-ul și e-Factura;
- reclamațiile și chargeback-urile (banii ceruți înapoi prin bancă);
- protecția consumatorului (ANPC);
- termenii Google Play pentru vânzarea de bilete.

Până atunci rămânem la faza 1.

## Cum se scoate

- **Rapid:** `mobile/src/features/events/flag.ts` → `EVENTS_ON = false`. Nimic despre evenimente nu mai apare în aplicație.
- **Complet:**
  1. Șterge:
     - `mobile/src/features/events/`
     - `mobile/src/app/eveniment/`
     - `src/events/`
     - `src/i18n/en/events.ts`
     - `admin/src/events.tsx`
     - `tests/events.test.ts`, `tests/events-rank.test.ts`
  2. Scoate rândurile marcate `Evenimente (22.10)`:
     - `mobile/src/app/(tabs)/acasa.tsx`: importul și `<EventsRail …/>`
     - `mobile/src/app/rezultate.tsx`: importul și `<EventsRail …/>`
     - `admin/src/App.tsx`: importul, tab-ul `events` și ecranul
     - `admin/src/ui.tsx`: iconița `events`
     - `src/i18n/index.ts`: `events`
  3. Pe server, o migrare nouă:

     ```sql
     drop function public.admin_event_save(uuid,jsonb), public.admin_events(date), public.event_ticket_url(uuid), private.ticket_seller(text);
     drop table private.event_log, private.event_clicks, public.events, private.ticket_sellers;
     ```

     Supabase cere confirmare pentru `drop`.
