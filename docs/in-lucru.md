# În lucru (22.10, seara) — de reluat după reset

Cornel (22.10, 21:0x): „Arată urât [profilul prietenului], vreau notificare când cineva îți dă cerere sau te invită în
gașcă sau trebuie să votezi; când construiești ieșirea singur și dai pe Înapoi te duce pe Acasă și pierzi tot. Rezolvă,
apoi verifică toate fluxurile de plan (să nu se suprapună, să nu te pierzi, planul B), rulează aplicația virtual ca un
om și zi tot ce ai găsit.” + „pune și un buton de notificări să vezi tot ce ai primit”.

## Stare
- [x] Notificările vot / plan / gașcă / FreeNow merg deja (push_log pe server are vot, plan, free azi).
- [ ] Prietenie: migrarea `supabase/migrations/20261022040000_cefaci_notificari_lista.sql` SCRISĂ, NEAPLICATĂ pe Supabase
      (trigger `push_friend` pe friendships → kind `friend` / `friend_ok`; tabelul `public.notifications` = lista din
      clopoțel; `notifications_read()`).
- [ ] `supabase/functions/trimite-notificare/index.ts`: de adăugat kind `friend` (ref = cine cere, user = cine primește;
      verifică rândul pending; url `/prieteni`) și `friend_ok` (verifică accepted; url `/prieten/<ref>`); după push_log,
      scrie rândul în `public.notifications` ÎNAINTE de verificarea FCM/tokens (lista merge și fără telefon înregistrat);
      apoi deploy (mcp Supabase deploy_edge_function).
- [ ] Telefonul: clopoțel pe Acasă (sus) cu bulina de necitite → ecranul `app/notificari.tsx` (lista, apăsat = url,
      la deschidere `notifications_read`); traduceri EN; test în tests/ (PGlite) pentru trigger + RLS.
- [ ] „O construiesc eu” (`mobile/src/app/construiesc.tsx`): Înapoi duce pe Acasă și pierde seara → Înapoi = pasul de
      dinainte / întreabă „Renunți la seara asta?”; seara se păstrează (planAsk `startBuild`).
- [ ] Profilul prietenului (`mobile/src/app/prieten/[id].tsx`) — „arată urât” (poza 21:02): de refăcut ca pe Profil
      (carnet cu avatar, nivel, XP, ștampile), butoane mai puține și mai clare, „Elimină din prieteni” discret jos.
- [ ] Audit ca un om pe toate fluxurile de plan (Creează plan, Surprinde-mă, O construiesc eu, Altă surpriză / planul B,
      vot, FreeNow, bilet, Înapoi peste tot), rulat virtual (expo export web + Playwright 412×915, ca în
      scripts/test-client-support-ui.mjs); lista cu tot ce am găsit pentru Cornel.
