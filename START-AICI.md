# CeFaci — pornire în Claude Code

## Pașii (o singură dată, pe PC)
1. Dezarhivează `CeFaci-pentru-Claude-Code.zip` într-un folder, de exemplu `Documente/cefaci-app`.
2. Pune lângă el fișierul `cefaci-android-release.jks` (cheia APK-ului, primită separat). Parola o știi tu: nu o scrie în niciun fișier. Nu-l urca niciodată pe GitHub.
3. Instalează Node.js 20 sau mai nou (nodejs.org).
4. Deschide Claude Code în folderul `cefaci-app` și lipește promptul de mai jos.

Claude Code citește singur `CLAUDE.md` (contextul, regulile, deciziile). Restul e explicat mai jos.

## Ce e în folder
- `CLAUDE.md` — contextul pentru Claude Code: reguli, priorități, decizii de bani, comenzi
- `docs/directie-si-decizii.md` — toate deciziile luate până acum (zona, localurile fondatoare, codul QR + bonul, banii)
- `design/canvas/client/` — toate ecranele aplicației de client (Bilu, tur, cont, acasă, rezultate, bilet, gașcă, vot, Plus, carnet, nivel)
- `design/canvas/business/` — CeFaci Business (localuri): intrare, rezervări, oferte, scanner, plăți, echipă, profil cu codul QR
- `design/canvas/admin/` — panoul de admin
- `design/Cont.dc.html`, `design/Demo.dc.html` — ecranele care rulează deja în aplicație, pe date reale
- `src/` — aplicația: motorul de căutare (`src/engine`), puntea către design (`src/app/bridge.ts`), rularea ecranelor (`src/dc/runtime.ts`)
- `src/data/venues.json` — 3.250 de localuri reale din București și Ilfov (OpenStreetMap)
- `android/` — APK-ul (WebView cu aplicația)
- `tests/`, `src/engine/*.test.ts` — testele

## Promptul de lipit în Claude Code

```
Salut! Lucrăm la CeFaci, aplicația mea pentru ieșit în oraș în București și Ilfov.
Citește întâi CLAUDE.md, START-AICI.md și docs/directie-si-decizii.md. Vorbește cu mine în română, simplu.

Reguli fixe:
- Designul e cel din design/canvas/ (client, business, admin). Nu redesena nimic din capul tău: tot ce construiești arată exact ca acolo. Bilu (biletul galben) rămâne în toate versiunile.
- Ecranele care rulează deja se modifică doar prin scripts/board-patches.mjs, apoi node scripts/extract-boards.mjs.
- Localurile sunt reale (src/data/venues.json). Nu inventa oferte, parteneri sau reduceri la localuri reale.
- După fiecare pas: npx vitest run și npx vite build trebuie să treacă. Fă commit cu un mesaj clar în română.

Pas 1 — Motorul de căutare, impecabil (prioritatea nr. 1).
Fișiere: src/engine/core.ts, catalog.ts, teste în src/engine/*.test.ts.
- Scrie întâi o listă de 60+ căutări reale cum ar scrie un român pe telefon, cu greșeli și fără diacritice
  (ex: „pizza sector 2”, „bar cu terasa”, „cafenea deschisa acum”, „bowlng”, „mc donalds”, „ceva ieftin in centru”,
  „unde ies cu gasca de 6”, „club vineri noaptea”, „brunch duminica pipera”, „escape room pt 4”, „teatru diseara”).
  Pentru fiecare, ce rezultate ar trebui să apară primele. Fă-le teste.
- Repară motorul până trec toate: greșeli de tastare, sinonime, zone și cartiere, „deschis acum/diseară/la noapte”,
  buget („ieftin”, „sub 50 lei”), număr de persoane, nume de localuri (inclusiv lipite sau despărțite).
- Rezultatele fără sens (lanțuri când cer ceva anume, locuri închise când cer „deschis”) nu au voie să apară primele.
- La final arată-mi un tabel: căutarea → primele 3 rezultate.

Pas 2 — Întrebările de la crearea contului, impecabile (prioritatea nr. 2).
Ecranele sunt în design/canvas/client/Cont.dc.html. Verifică fiecare pas pe un ecran de telefon (390×844):
texte clare, fără greșeli, butoane la îndemână, nimic tăiat, Bilu prezent. Întrebările trebuie să alimenteze motorul
(zona, ce-i place, buget, distanță) și să se vadă imediat în recomandări. Propune-mi îmbunătățiri înainte să le aplici.

Pas 3 — Ecranul Acasă, mai aerisit.
E prea încărcat. Păstrează: titlul „Ce facem azi?” cu Bilu, „Cine vine?” și butonul mare galben „Arată variante”.
Restrânge rândul de informații (dată, oră, număr de localuri) la un singur rând discret, mută rezumatul filtrelor
într-un singur buton „Filtre”, fă „Alege cu cine ieși” mai mic, iar „Ai chef de…” lasă-l sub buton.
Arată-mi înainte și după, în același stil.

Pas 4 — doar după ce îți confirm: conturi și gașca cu vot în timp real pe Supabase (etapa 2).
Întreabă-mă înainte să creezi orice cont sau proiect.

Începe cu Pas 1. Spune-mi pe scurt ce ai înțeles, apoi apucă-te.
```

## Comenzi utile
- `npm i` — o singură dată
- `npx vite` — aplicația în browser, pe calculator
- `npx vitest run` — testele
- `node scripts/extract-boards.mjs && npx vite build` — construiește aplicația (`dist/index.html`)
- Aplicația de telefon (nativă, React Native) e în `mobile/`; APK-ul îl face GitHub. Vezi `docs/android.md`.
