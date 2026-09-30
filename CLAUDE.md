# CeFaci — context pentru Claude Code

Aplicație românească pentru ieșit în oraș (București + Ilfov). Utilizatorul: Cornel, scrie în română, casual. Mascota: Bilu (bilet galben) — rămâne în toate versiunile.

## Stare
- Etapa 1 gata: ecranele din canvas (`design/Cont.dc.html`, `design/Demo.dc.html`) rulează pe 3.250 de localuri reale OpenStreetMap (`src/data/venues.json`), cu motorul din `src/engine`.
- Nu redesena UI: se modifică doar prin `scripts/board-patches.mjs` (patch-uri text), apoi `node scripts/extract-boards.mjs`.
- Încă de exemplu: prieteni/gășci/vot (etapa 2), XP/niveluri (etapa 3), codul SMS 318642.

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
