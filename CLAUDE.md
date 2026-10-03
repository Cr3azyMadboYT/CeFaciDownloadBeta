# CeFaci — context pentru Claude Code

Aplicație românească pentru ieșit în oraș (București + Ilfov). Utilizatorul: Cornel, scrie în română, casual. Mascota: Bilu (bilet galben) — rămâne în toate versiunile.

## Unde e designul
- `design/canvas/client/`, `design/canvas/business/`, `design/canvas/admin/` — toate cele 3 canvasuri (sursa de adevăr pentru UI).
- `docs/directie-si-decizii.md` — deciziile de produs și bani. `START-AICI.md` — pașii de lucru.

## Stare
- Etapa 1 gata: ecranele din canvas (`design/Cont.dc.html`, `design/Demo.dc.html`) rulează pe 3.250 de localuri reale OpenStreetMap (`src/data/venues.json`), cu motorul din `src/engine`.
- Nu redesena UI: se modifică doar prin `scripts/board-patches.mjs` (patch-uri text), apoi `node scripts/extract-boards.mjs`.
- Căutarea: `src/engine/catalog.ts` (TOPICS = ce caută oamenii, PLACES = cartiere/sectoare/mall-uri/orașe, STOP), `search()` în `src/engine/core.ts`. Cele 88 de căutări reale + ce trebuie să apară primul: `src/engine/queries.ts` (testate în `search.test.ts`). Tabelul: `TABLE=1 npx vitest run scripts/search-table.test.ts`.
- Contul: fără telefon/SMS. Intrare cu Google (nativ în aplicație, prin `@capgo/capacitor-social-login` + Supabase `signInWithIdToken`), cu email (cod de 6 cifre, pe ecranul de telefon din design) sau „Continuă fără cont”. Apple ascuns (`showApple: false`). Supabase „CeFaci 2.0”: schema în `supabase/migrations/` (testată în `tests/db.test.ts`), sincronizarea în `src/app/cloud.ts`.
- Toți pornesc de la 0 (03.10): fără prieteni, gășci, XP sau „Populare” inventate (`scripts/board-patches-real.mjs`). Starea (planuri, XP, tur, proba Plus pe zile reale) se păstrează în `cefaci.state` și, cu cont, în Supabase. Plus: săptămâna gratuită rămâne, plata nu e simulată.
- Lansarea: după ce avem 5–10 localuri partenere. Business și Admin se leagă după ce terminăm clientul.
- Data nașterii se scrie de mână (ZZ.LL.AAAA), apoi „Sigur e data corectă?”. Sub 16 nu intră; 16–17 nu văd cluburi, narghilea, locuri 18+ (`adultOnly` în core.ts, `ctx.minor`).
- Răspunsurile de la cont (buget, cu cine, când, chill/party, cum ajunge, „da/nu prea” la locuri) se salvează în `cefaci.prefs` și pornesc filtrele de pe Acasă (`APP.homeDefaults`).
- Filtre: buget cu interval „de la – până la” + avertisment că prețurile sunt estimate. Patch-uri noi: `scripts/board-patches-cont.mjs`, `scripts/board-patches-budget.mjs`.
- Încă de exemplu: prieteni/gășci/vot (etapa 2), XP/niveluri (etapa 3).

## Priorități
1. Motorul de căutare impecabil (`src/engine/core.ts`, teste în `src/engine/*.test.ts`).
2. Întrebările de la crearea contului impecabile, inclusiv designul.
3. Etapa 2: conturi + gașca cu vot în timp real (Supabase).

## Bani (decizii)
- Start ca PFA la primul leu încasat; SRL peste ~50–60k lei/an sau când pornesc biletele.
- Plus (20 lei/lună) doar prin Google Play / App Store. Netopia pentru comisionul localurilor și bilete.
- Localuri fondatoare: 0% 3 luni, apoi 4% pe viață. Dovada ieșirii: un cod QR CeFaci la bar + poza bonului fiscal.

## Comenzi
- `npm i`, `npx vitest run`, `node scripts/extract-boards.mjs && npx vite build`
- Aplicația Android e nativă (Capacitor, `android/`, pachet `ro.cefaci.app`): `npx vite build && npx cap sync android`, apoi `cd android && ./gradlew bundleRelease`. Cheia de semnare se citește din `~/.gradle/gradle.properties`, niciodată din git. Pașii: `docs/android.md`. Vechiul APK WebView: `android-webview-v0/` (doar istoric).

## Amintirea pentru bon (decizie Cornel, 30.09)
- La 40 de minute după check-in (scanat codul localului sau scanat de ospătar), Bilu trimite notificarea: „Nu uita de bon, ne ajută și pe noi și pe tine :)”.
- La check-in, pe ecran, Bilu spune o dată: „Păstrează bonul la final, îți aduce 25 XP.”
- Maximum 2 amintiri; a doua: a doua zi la prânz („Ai uitat bonul de aseară?”). Bonul se poate pune până a doua zi seara.
