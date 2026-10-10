# CeFaci Client — „Hai că mergem” — teaser TikTok Ads

Teaser vertical de **48 secunde**, 1080×1920, 30 fps, H.264/yuv420p în MP4, audio AAC stereo 48 kHz. Montaj animat determinist cu Bilu, fonturi CeFaci, ecrane din Client și soundtrack original de 120 BPM. Textul de pe ecran transmite mesajul și cu sunetul oprit. Fără voice-over, stock video ori muzică preluată din TikTok/Spotify/filme.

## Livrabile

- `release/video/CeFaci-Client-teaser-48s.mp4`: fișierul pentru upload în Ads Manager.
- `release/video/CeFaci-Client-teaser-cover.jpg`: copertă extrasă din final.
- `release/video/CeFaci-TikTok-Ads-kit.zip`: video, copertă, instrucțiuni, proveniență și verificări tehnice.
- `release/video/CeFaci-original-soundtrack.wav`: master audio original.
- `docs/livrare/VIDEO-TIKTOK-20261010.json`: rezultatul verificării și checksumurile.

## Poveste și timpi

| Secunde | Cadru |
| --- | --- |
| 0–5 | Conversația „Ce facem diseară?”; trei oameni, zero planuri |
| 5–9 | „Gata cu «nu știu»” și intrarea lui Bilu |
| 9–13 | „Ai chef. Ai gașcă. Ai CeFaci.” |
| 13–20 | Ecranul Acasă: „Seara începe cu tine” |
| 20–27 | Planul: „Un loc. Toată seara. Tu alegi.” |
| 27–34 | Detaliu real dintr-un plan: „Mai puțin scroll. Mai mult afară.” |
| 34–40 | Locuri, gașcă și o seară împreună |
| 40–44 | „Din «ce facem?» în «hai că mergem»” |
| 44–48 | CeFaci, „În curând”, Android/iOS și cefaci.app |

## TikTok Ads: pregătire și publicare

Fișierul respectă cerințele de format verificate la **10.10.2026**: vertical 9:16, peste minimul 540×960, MP4, sub 500 MB și bitrate peste minimul 516 kbps. Lungimea 48 s este în intervalul acceptat publicat de TikTok. Nu se afirmă că regula ar fi „maximum 60 s”: pagina consultată permite până la 10 minute pentru Non-Spark Ads. Textul principal și finalul sunt în centrul compoziției; previzualizează totuși safe zone în Ads Manager, deoarece captionul/CTA/interfața diferă între plasamente.

Campania este pentru **pre-lansare și prezentarea site-ului**, cu destinație web `https://cefaci.app` și CTA **„Află mai multe” / Learn More**. Nu configura obiectiv App Install cu o destinație fictivă: iOS nu este publicat în App Store, iar Android nu este declarat publicat în Google Play. Formularea „În curând pe Android și iOS” nu promite o dată sau disponibilitate actuală. Nu adăuga badge-uri oficiale „Download on the App Store”/„Get it on Google Play” înainte de publicarea reală.

Caption propus, fără hashtaguri sau linkuri în text: **„Din «ce facem?» în «hai că mergem». Descoperă CeFaci. În curând pe Android și iOS.”** Recomandare inițială: România, public adult 18+, destinație web, fără pixel/remarketing adăugat automat de acest proiect. Dacă instalezi ulterior TikTok Pixel ori colectezi lead-uri, trebuie implementate informarea și consimțământul aplicabile înaintea urmăririi opționale.

**Înaintea promovării, publică pachetul web nou și completează identitatea reală a operatorului în documentele publice.** La livrare, noul site nu este urcat pe gazduire.net, iar titularul a cerut să nu publice încă numele/adresa și nu are firmă. Documentele provizorii și emailul nu înlocuiesc aceste informații. Pagina finală trebuie să funcționeze pe mobil și să aibă aceeași ofertă/stare ca reclama. Nu porni colectarea de date ori o promisiune de descărcare pe o pagină care nu le poate susține.

Acest pachet pregătește materialul pentru verificare; **nu certifică legalitatea întregii campanii și nu garantează aprobarea TikTok**. Ads Manager verifică separat contul, piața, targetarea, conținutul, destinația și drepturile. Nu s-a creat sau publicat o campanie și nu s-a cheltuit buget.

## Proveniență și drepturi

Vezi [RIGHTS.md](RIGHTS.md). Muzica este sintetizată procedural de scriptul inclus, fără samples externe. Bilu și capturile sunt din materialele existente ale proiectului; fonturile au licențe OFL în repository. Nu se atribuie exclusivitate ori o verificare independentă a drepturilor asupra desenului Bilu. Folosește comercial identitatea proiectului numai dacă deții drepturile pentru ea.

## Surse oficiale consultate

- [TikTok Auction In-Feed Ads — format, dimensiuni, durată, safe zone](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en)
- [Landing page review checklist](https://ads.tiktok.com/help/article/ad-review-checklist-landing-page?lang=en)
- [Intellectual Property Infringement](https://ads.tiktok.com/help/article/tiktok-ads-policy-intellectual-property-infringement?lang=en)
- [Misleading and false content](https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content?lang=en)

## Reconstrucție

Necesită dependențele proiectului (Playwright/Chromium), FFmpeg cu libx264/AAC, Python cu NumPy. Nu accesează backendul sau conturi reale.

```bash
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node scripts/render-client-teaser.mjs
```

`--preview` exportă 540×960/12 fps pentru control; `--stills` generează doar nouă cadre de verificare. Preview-ul nu este fișierul final pentru reclamă. Sursa creativă este `scene.html`; soundtrackul este `soundtrack.py`. Renderul nu modifică aplicațiile sau pachetele lor.
