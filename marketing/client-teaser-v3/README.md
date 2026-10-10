# CeFaci — „Biletul de ieșit” (TikTok, pre-lansare)

55 s, 1080×1920, 30 fps, H.264 + AAC, 124 BPM (tăieturile cad pe măsură). Design propriu, din limbajul aplicației: biletul galben cu perforație și cod de bare, ștampila „Bilu aprobă”, întrebările de pe fundalul aplicației, Bilu în 4 ipostaze (hi, yay, wink, oops — din `mobile/src/ui/Bilu.tsx`, cu fularul de toamnă). Ecranele din telefoane sunt reale (versiunea de test), cu numele localurilor blurate. Muzica e sintetizată în `soundtrack.py`.

Randare: `node scripts/render-teaser-v3.mjs` (`--stills` pentru cadre de probă) → `release/video/CeFaci-bilet-55s.mp4`.

| Măsuri | Ce se vede |
| --- | --- |
| 0–3 | „Vineri. 20:30. Iar «ce facem?»” — întrebările umplu ecranul |
| 3–4 | Biletul galben: „Stai. Am eu un plan.” — se rupe pe perforație |
| 4–6 | Drop: „CeFaci.”, Bilu sare, „Bilu face planul. Voi doar ieșiți.” |
| 6–12 | 5 întrebări, sub un minut (ecrane reale, apăsări) |
| 12–16 | 3 planuri verificate + ștampila „Bilu aprobă” |
| 16–19 | Gașca votează |
| 19–22 | Planul devine bilet; check-in = ștampilă + XP |
| 22–24,5 | Surprinde-mă: ruleta lui Bilu |
| 24,5–28,5 | În curând · Android · iOS · București & Ilfov · cefaci.app → „Tu ai folosi-o? Zi-ne în comentarii” |

Reguli TikTok avute în vedere: fără interfețe de sistem imitate (notificări, erori), fără „descarcă acum” sau badge-uri de magazin, fără superlative/gratuități, fără lumini care pâlpâie, muzică originală, text în zona sigură, mențiunea „Aplicație în dezvoltare · Ecrane din versiunea de test”. Pentru campanie: obiectiv trafic/comunitate, destinație `https://cefaci.app` (pagina trebuie să fie urcată), CTA „Află mai multe”, 18+, România.
