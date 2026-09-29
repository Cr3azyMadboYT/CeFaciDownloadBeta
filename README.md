# CeFaci — aplicația client (etapa 1)

Web-app React + TypeScript, cu motorul de recomandări și căutare separat în `src/engine` (TypeScript pur, refolosit în etapele următoare și în aplicația Expo).

- `data-raw/` — exportul OpenStreetMap (București + Ilfov, 29.09.2026)
- `scripts/import-osm.mjs` — curăță și transformă exportul în `src/data/venues.json`
- `src/engine/core.ts` — scor (35 gust + 20 ocazie + 15 calitate + 10 aproape + 10 nou + 10 gașcă), program deschis/închis, căutare cu înțelegerea cuvintelor („pizza sector 2”, „bar cu terasă”, „deschis acum”)
- `design/` — ecranele din canvas (Cont, Demo), exact cum le-am desenat
- `scripts/extract-boards.mjs` + `scripts/board-patches.mjs` — scot din design șablonul, stilul și logica și le leagă de datele reale
- `src/dc/runtime.ts` — rulează ecranele din canvas într-o pagină normală
- `src/app/bridge.ts` — puntea: localuri reale, motorul, preferințele salvate

Comenzi: `npm i`, `npx vite` (dezvoltare), `npx vitest run` (teste), `node scripts/extract-boards.mjs && npx vite build && node scripts/to-artifact.mjs` (un singur fișier HTML).

Date © contribuitorii OpenStreetMap, licența ODbL: atribuirea trebuie păstrată în aplicație.
