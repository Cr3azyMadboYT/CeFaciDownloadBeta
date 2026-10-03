# CeFaci — context pentru Claude Code

Aplicație românească pentru ieșit în oraș (București + Ilfov). Utilizatorul: Cornel, scrie în română, casual. Mascota: Bilu (bilet galben) — rămâne în toate versiunile.

## Unde e designul
- `design/canvas/client/`, `design/canvas/business/`, `design/canvas/admin/` — toate cele 3 canvasuri (sursa de adevăr pentru UI).
- `docs/directie-si-decizii.md` — deciziile de produs și bani. `START-AICI.md` — pașii de lucru.

## Stare
- Etapa 1 gata: ecranele din canvas (`design/Cont.dc.html`, `design/Demo.dc.html`) rulează pe 3.250 de localuri reale OpenStreetMap (`src/data/venues.json`), cu motorul din `src/engine`.
- Nu redesena UI: se modifică doar prin `scripts/board-patches.mjs` (patch-uri text), apoi `node scripts/extract-boards.mjs`.
- Căutarea: `src/engine/catalog.ts` (TOPICS = ce caută oamenii, PLACES = cartiere/sectoare/mall-uri/orașe, STOP), `search()` în `src/engine/core.ts`. Cele 88 de căutări reale + ce trebuie să apară primul: `src/engine/queries.ts` (testate în `search.test.ts`). Tabelul: `TABLE=1 npx vitest run scripts/search-table.test.ts`.
- Contul (03.10): fără telefon/SMS deocamdată (pasul e scos, ecranul rămâne în design). Intrare cu Google prin Supabase „CeFaci 2.0” (`src/app/auth.ts`, merge doar din versiunea web, nu din APK/file://) sau „Continuă fără cont” (profil doar pe telefon). Apple ascuns (`showApple: false`).
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
- APK: `cp dist/index.html android/assets/` apoi apktool b + uber-apk-signer cu `android-release.jks` (parola în chat, nu în git).

## Amintirea pentru bon (decizie Cornel, 30.09)
- La 40 de minute după check-in (scanat codul localului sau scanat de ospătar), Bilu trimite notificarea: „Nu uita de bon, ne ajută și pe noi și pe tine :)”.
- La check-in, pe ecran, Bilu spune o dată: „Păstrează bonul la final, îți aduce 25 XP.”
- Maximum 2 amintiri; a doua: a doua zi la prânz („Ai uitat bonul de aseară?”). Bonul se poate pune până a doua zi seara.
