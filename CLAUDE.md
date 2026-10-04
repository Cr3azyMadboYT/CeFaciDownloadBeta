# CeFaci — context pentru Claude Code

Aplicație românească pentru ieșit în oraș (București + Ilfov). Utilizatorul: Cornel, scrie în română, casual. Mascota: Bilu (bilet galben) — rămâne în toate versiunile.

## Unde e designul
- `design/canvas/client/`, `design/canvas/business/`, `design/canvas/admin/` — toate cele 3 canvasuri (sursa de adevăr pentru UI).
- `docs/directie-si-decizii.md` — deciziile de produs și bani. `START-AICI.md` — pașii de lucru.

## Stare
- Etapa 1 gata: ecranele din canvas (`design/Cont.dc.html`, `design/Demo.dc.html`) rulează pe 3.412 localuri reale OpenStreetMap (`src/data/venues.json`), cu motorul din `src/engine`.
- Datele OSM: `.github/workflows/osm.yml` (lunar + manual) descarcă de pe Overpass ce alege `scripts/osm-kinds.mjs`, rulează `import-osm.mjs` + `build-hours.mjs` + testele și salvează doar dacă trec. Brut: `data-raw/osm-bucuresti-ilfov.json`. Rezumat: `node scripts/osm-summary.mjs`. Categorii: și `natura`, `sport` (04.10, problema „în Buftea doar restaurante”). Varietatea pe zone: `tests/variety.test.ts` (`variedPicks` în bridge.ts).
- Nu redesena UI: se modifică doar prin `scripts/board-patches.mjs` (patch-uri text), apoi `node scripts/extract-boards.mjs`.
- Căutarea: `src/engine/catalog.ts` (TOPICS = ce caută oamenii, PLACES = cartiere/sectoare/mall-uri/orașe, STOP), `search()` în `src/engine/core.ts`. Cele 88 de căutări reale + ce trebuie să apară primul: `src/engine/queries.ts` (testate în `search.test.ts`). Tabelul: `TABLE=1 npx vitest run scripts/search-table.test.ts`.
- Contul: fără telefon/SMS. Intrare cu Google (nativ în aplicație, prin `@capgo/capacitor-social-login` + Supabase `signInWithIdToken`), sau cu email (codul de pe mail, 6–10 cifre). Fără „Continuă fără cont” (decizie Cornel, 04.10). Apple ascuns (`showApple: false`). Supabase „CeFaci 2.0”: schema în `supabase/migrations/` (testată în `tests/db.test.ts`), sincronizarea în `src/app/cloud.ts`.
- Toți pornesc de la 0 (03.10): fără prieteni, gășci, XP sau „Populare” inventate (`scripts/board-patches-real.mjs`). Starea (planuri, XP, tur, proba Plus pe zile reale) se păstrează în `cefaci.state` și, cu cont, în Supabase. Plus: săptămâna gratuită rămâne, plata nu e simulată.
- Lansarea: după ce avem 5–10 localuri partenere. Business și Admin se leagă după ce terminăm clientul.
- Data nașterii se scrie de mână (ZZ.LL.AAAA), apoi „Sigur e data corectă?”. Sub 16 nu intră; 16–17 nu văd cluburi, narghilea, locuri 18+ (`adultOnly` în core.ts, `ctx.minor`).
- Răspunsurile de la cont (buget, cu cine, când, chill/party, cum ajunge, „da/nu prea” la locuri) se salvează în `cefaci.prefs` și pornesc filtrele de pe Acasă (`APP.homeDefaults`).
- Filtre: buget cu interval „de la – până la” + avertisment că prețurile sunt estimate. Patch-uri noi: `scripts/board-patches-cont.mjs`, `scripts/board-patches-budget.mjs`.
- XP-ul e pe server (04.10): `xp_log` + RPC `xp_check_in`, `xp_welcome`; bonul +25 îl scrie funcția `citeste-bon` (`xp_bill`); `profiles.xp/stamps` nu se pot schimba din aplicație. `public.venues` se umple din workflow-ul OSM dacă există secretul `SUPABASE_SERVICE_ROLE_KEY` (altfel serverul folosește poziția trimisă de aplicație). Locurile dispărute din OSM: `src/data/gone.json` (6 luni).
- Notificări de la prieteni: `push_tokens` + triggeri → funcția `trimite-notificare` (FCM v1, secretul Supabase `FCM_SERVICE_ACCOUNT`); în build, `google-services.json` din secretul GitHub `GOOGLE_SERVICES_JSON` (`mobile/app.config.js`). Telefonul: `mobile/src/lib/push.ts`.
- Bara de jos: modulul nativ local `mobile/modules/cefaci-insets` (`fitNavBar`, chemat din `_layout.tsx`) face ca Android să oprească aplicația deasupra butoanelor telefonului, ca la Instagram; ecranele nu mai adaugă nimic jos (`useSafeAreaInsets` din `mobile/src/ui/insets.ts`), doar foile de jos și turul, care acoperă tot ecranul (`useModalInsets`).
- Vremea (04.10): funcția `vremea` (Google Weather, cheia în Vault `google_maps_key`) → `public.weather`; motorul: `src/engine/weather.ts` (ploaie/frig → la adăpost, soare → afară), `Ctx.weather`; pe telefon `mobile/src/lib/weather.ts`. Teste: `tests/weather.test.ts`.
- Seara completă: `src/engine/evening.ts` (șabloane cină→bar→club etc., fiecare pas deschis la ora lui, ≤1,2 km pe jos sau cu mașina în orașele mici), ecranul `mobile/src/app/seara.tsx`. Teste: `tests/evening.test.ts`.
- Căutare: ore („după 22”, „înainte de 9”, „la 1 noaptea”), nevoi (wifi, fumat, scaun cu rotile, aer condiționat; din OSM). Teste: `tests/vocab.test.ts`. Ajustări dintr-un tap: `mobile/src/lib/tweaks.ts`. Harta: `mobile/src/ui/PlacesMap.tsx` (WebView + MapLibre + OpenFreeMap, fără cheie).
- Locurile verificate pe Google Maps (Places API): `scripts/verify-places.mjs` → `src/data/checked.json` (închise scoase la import); workflow „Verifică locurile” (lunar, secretul `PLACES_API_KEY`).
- Pe telefon merg pe Supabase: prieteni, gășci (cod 7 zile, carnet), votul în timp real (`mobile/src/lib/votes.ts`, `plan_from_vote`), planuri trimise cu Vin/Nu pot (`together.ts`), nivel nou (`ui/LevelUp.tsx`), Setări, amintirea pentru bon (`lib/remind.ts`, expo-notifications), semnalări (`reports`). Încă de făcut: „Invită prieteni” cu link spre magazin (după Google Play).

## Priorități
1. Motorul de căutare impecabil (`src/engine/core.ts`, teste în `src/engine/*.test.ts`).
2. Întrebările de la crearea contului impecabile, inclusiv designul.
3. Etapa 2: conturi + gașca cu vot în timp real (Supabase).

## Bani (decizii)
- Start ca PFA la primul leu încasat; SRL peste ~50–60k lei/an sau când pornesc biletele.
- Plus (20 lei/lună) doar prin Google Play / App Store. Netopia pentru comisionul localurilor și bilete.
- Localuri fondatoare: 0% 3 luni, apoi 4% pe viață. Dovada ieșirii: un cod QR CeFaci la bar + poza bonului fiscal.

## Aplicația de telefon = `mobile/` (decizie Cornel, 03.10: „aplicație scrisă pentru telefon, nu web app împachetat”)
- React Native + Expo (SDK 57), ecrane native refăcute după canvas (`mobile/src/app/*`, piese în `mobile/src/ui`). Pachet `ro.cefaci.app`.
- Folosește direct `src/engine`, `src/data`, `src/app/bridge.ts` (APP) și `src/app/cloud.ts`; `localStorage` vine din SQLite (`expo-sqlite/localStorage`).
- Ecranele web din `src/boards` (generate din `design/`) rămân referința vizuală și testele lor; UI-ul aplicației se schimbă acum în `mobile/`.
- Prietenii și gășcile merg pe Supabase (`mobile/src/lib/friends.ts`, `crews.ts`); votul (`votes.ts`, ecranul `app/vot/[id].tsx`) și planurile comune (`together.ts`).
- Ștampile: check-in cu locația pe bilet (≤250 m) + poza bonului prin `citeste-bon` (`mobile/src/lib/outing.ts`).
- Programul localurilor: tabel săptămânal `wk` în venues.json (`TZ=Europe/Bucharest node scripts/build-hours.mjs`, de rulat la fiecare actualizare OSM); pe telefon `opening_hours` era prea lent (teste: `tests/hours.test.ts`).
- Verificare: `cd mobile && npx tsc --noEmit`; previzualizare: `npx expo export --platform web` + Playwright la 412×915.
- Istoric, nefolosit: `android-capacitor-v1/`, `android-webview-v0/`.

## Comenzi
- `npm i`, `npx vitest run`, `node scripts/extract-boards.mjs && npx vite build`
- Telefonul: `cd mobile && npm ci && npx tsc --noEmit`. APK-ul îl face GitHub la fiecare push (`.github/workflows/android.yml`, Actions → Artifacts). Semnat cu cheia reală doar dacă există secretele `CEFACI_KEYSTORE_B64`, `CEFACI_KEYSTORE_PASSWORD`, `CEFACI_KEY_ALIAS`, `CEFACI_KEY_PASSWORD`; altfel cu o cheie de test (Google login nu merge). Pașii: `docs/android.md`.

## Bonul (decizie Cornel, 03.10)
- Bonul se citește pe server: funcția Supabase `citeste-bon` (Google Vision, cheia în secretul `VISION_API_KEY`), cititorul în `supabase/functions/citeste-bon/bon.ts` (teste: `tests/bon.test.ts`).
- Parteneri: QR la bar + bon obligatoriu (comision, Plus). Nepartenere: check-in cu locația, bon opțional pentru +25 XP; totalurile dau prețul real mediu al localului și statistici pentru parteneriat. Detalii: `docs/directie-si-decizii.md`.

## Amintirea pentru bon (decizie Cornel, 30.09)
- La 40 de minute după check-in (scanat codul localului sau scanat de ospătar), Bilu trimite notificarea: „Nu uita de bon, ne ajută și pe noi și pe tine :)”.
- La check-in, pe ecran, Bilu spune o dată: „Păstrează bonul la final, îți aduce 25 XP.”
- Maximum 2 amintiri; a doua: a doua zi la prânz („Ai uitat bonul de aseară?”). Bonul se poate pune până a doua zi seara.
