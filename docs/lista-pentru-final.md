# CeFaci — ce mai trebuie ca să terminăm aplicația (03.10.2026)

Răspunde cu numărul și litera (ex: „9b, 10a, 14a”). ⭐ = ce recomand eu.

## A. De făcut de tine (doar tu ai acces)

1. **Supabase „CeFaci 2.0” de la zero.** De două ori ștergerea a fost anulată la confirmare, așa că n-am șters nimic.
   - a ⭐ Deschizi Supabase → SQL Editor, lipești `supabase/reset-cefaci-2.sql`, apeși Run, apoi îmi scrii „gata”. Eu pun schema nouă (`supabase/migrations/…_cefaci_etapa2.sql`, testată, 49 de verificări de securitate).
   - b Data viitoare, când îți apare confirmarea, apeși „Aprobă”.
   - În plus, din dashboard (eu nu pot): șterge funcțiile Edge `context-weather` și `route-matrix` și bucket-ul gol `cf-avatars` din Storage.
2. **GitHub.** Nu pot urca nimic, pentru că legătura cu repo-ul e blocată de permisiuni.
   - a ⭐ În setările Claude Code permiți `git remote add` și `git push` pentru repo.
   - b Pornești o sesiune nouă direct pe repo și mut eu commit-urile acolo.
3. **Parola cheii APK** e scrisă în `START-AICI.md`, în 4 commit-uri locale. N-a ajuns încă pe GitHub. Rescrierea istoricului mi-a fost blocată.
   - a ⭐ Îmi dai voie (permisiune pentru `git filter-branch`) s-o scot din istoric înainte de primul push.
   - b O lași și facem o cheie nouă de semnare când urcăm pe Google Play (cheia veche n-a fost folosită în magazin).
4. **Unde stă aplicația pe internet.** Login-ul cu Google merge doar de pe o adresă web.
   - a ⭐ Cloudflare Pages (gratis) + domeniu `cefaci.ro` (~50 lei/an). Îmi trebuie doar domeniul ales, restul fac eu.
   - b Netlify sau Vercel (tot gratis).
5. **Google login, setări:** în Supabase → Authentication → URL Configuration pui adresa site-ului, iar în Google Cloud → OAuth consent screen pui numele „CeFaci”, logo, un **email de suport** și linkurile la Termeni și Confidențialitate. Îmi trebuie: emailul de suport.
6. **Termeni și Politica de confidențialitate.** În aplicație există doar textul, paginile lipsesc. Obligatoriu pentru GDPR și Google. Le scriu eu, dar îmi trebuie: numele operatorului (tu ca persoană fizică, PFA sau SRL, cu CUI dacă e), emailul de contact și orașul.
7. **Google Play Console** (25 $, o singură dată) pentru varianta de Android. Când vrei să-l faci?

## B. Decizii

8. **Cei de 16–17 ani**: acum văd doar locurile pentru oricine. Am ascuns cluburile, barurile, pub-urile, grădinile de bere, narghileaua și locurile marcate 18+ pe hartă (doar SIP Bucharest Cocktail Bar are asta). E ok? (a ⭐ da / b barurile să rămână vizibile)
9. **Aplicația de Android.** APK-ul de acum e doar o pagină web într-o fereastră. Acolo nu merge login-ul cu Google, nici notificările (amintirea pentru bon, votul), iar camera (bon, cod QR) e limitată.
   - a ⭐ Capacitor: aceeași aplicație, dar cu login Google nativ, notificări push și cameră. Tot gratis.
   - b TWA (aplicația web „împachetată”): mai simplu. Merge Google login și notificări web, dar fără cameră nativă.
   - c Rămâne APK-ul de acum (fără Google și fără notificări).
10. **Lucruri inventate pe care le vede orice om nou** (din demo):
    - pe Acasă: „Ioana, Mihai și Sara sunt liberi în seara asta… Radu n-a zis încă”;
    - în Planuri: gășcile „Gașca de vineri” și „Padel de joi”;
    - în Profil: „Founder”, „Nivel 3 Radar, 1.420 XP”, „7 prieteni, 1 cerere”;
    - „Populare în Sector 1”: **același muzeu de 3 ori**, cu „41, 33, 29 de ieșiri” inventate.

    - a ⭐ Le înlocuiesc cu stări goale care explică (ex: „Încă n-ai prieteni. Adaugă-i după @username”). Fiecare om nou pornește de la Nivel 1 „Boboc”, cu 150 XP, cum ai decis. „Populare” se ascunde până avem ieșiri reale. „Founder” rămâne doar la tine.
    - b Le ascund complet până la etapa 2.
11. **CeFaci Plus.** Ai decis „fără Plus în primele 3–6 luni”, dar aplicația oferă proba gratuită și cadoul lui Bilu. Plata prin Google Play nu e făcută.
    - a ⭐ Ascund Plus (tab-ul și cadoul) până avem parteneri.
    - b Tab-ul rămâne, cu „În curând”.
    - c Las proba ca acum.
12. **Live Drops** apare gol („Vezi toate (0)”). a ⭐ îl ascund până la primul partener / b las rândul gol.
13. **Aplicația uită tot la închidere:** planurile, tema, XP-ul, iar turul cu Bilu apare din nou de fiecare dată. a ⭐ le salvez pe telefon acum și în Supabase după etapa 2.
14. **„Gratuit” la buget dă 0 rezultate** (nu avem niciun loc gratuit în date).
    - a ⭐ Adaug din OpenStreetMap parcuri, lacuri și promenade („Natură și plimbări”, gratis). Asta rezolvă și alegerea „Natură” de la cont.
    - b Scot butonul „Gratuit”.
15. **Ce-ți place fără date în spate.** Pe hartă nu există bowling, karaoke, board games sau stand-up, iar padel și fotbal nu sunt importate.
    - a ⭐ Import din OSM terenurile și centrele de sport (padel, fotbal, tenis) și parcurile. Ce rămâne fără date (karaoke, board games, stand-up) apare cu „Încă strângem locuri” și cu ce e cel mai apropiat.
    - b Ascund alegerile fără date.
16. **Titlul de pe Acasă** propune „…poate un bowling? …sau karaoke? …padel cu gașca?”, adică lucruri care nu există încă în date. a ⭐ îl schimb pe ce există / b rămâne.
17. **Poze la localuri:** nu avem. a ⭐ fără poze până își revendică localurile pagina (cardurile colorate rămân) / b poze de la Google (cu plată, ~7 $ la 1.000 de afișări).
18. **Programul lipsește la 47% din localuri.**
    - a ⭐ Rămâne „Program necunoscut” plus un buton „Știi programul? Spune-ne” (merge la admin).
    - b Le ascundem din rezultate când omul alege „acum”.
19. **Locația.** Acum distanța se calculează de la zona aleasă.
    - a ⭐ Opțional „Folosește locația mea”, cu permisiune.
    - b Doar zona.
20. **Login cu email** ca a treia variantă (pentru cine nu vrea Google).
    - a ⭐ Da, cod pe email prin Supabase, cu Resend (gratis până la 3.000 de emailuri pe lună).
    - b Nu, doar Google și „fără cont”.
21. **Fonturile** se încarcă de pe Google Fonts, deci fără internet aplicația arată altfel. a ⭐ le pun în aplicație (licență gratuită) / b rămân.
22. **CeFaci Business și Admin** există doar ca design. Când le facem?
    - a ⭐ După lansarea pentru clienți: întâi „Revendică localul”, apoi admin cu aprobări, apoi oferte.
    - b Odată cu lansarea.
23. **Citirea bonului** (CUI, oră, total) pentru XP.
    - a ⭐ Direct pe telefon, gratis (ML Kit), merge doar cu varianta 9a.
    - b Pe server, cu plată.
    - c Mai târziu (etapa 3).
24. **Cifre** (câți oameni intră, câte planuri, câte voturi).
    - a ⭐ PostHog, gratis, cu servere în UE.
    - b Doar numărători simple în Supabase.
    - c Nimic deocamdată.
25. **Datele OpenStreetMap** sunt din 29.09. a ⭐ le actualizez lunar cu un script / b doar la cerere.
26. **Supabase gratuit** se oprește după 7 zile fără activitate (ți s-a întâmplat la ForajeAgenda și Revora). a ⭐ gratis până la lansare, Pro (25 $/lună) de la lansare / b gratis și după lansare.
27. **CeFaci 1.0** (nu l-am atins): tabela `device_push_tokens` e deschisă oricui are cheia publică. a ⭐ o închid (activez RLS + o regulă „doar proprietarul”) / b o las / c ștergem tot proiectul 1.0.

## C. Le fac eu, fără să întreb (doar ca să știi)

- Ecran „Șterge-mi contul” în Setări (GDPR; funcția există deja în schema nouă).
- Legarea aplicației la Supabase după pasul 1: profil, prieteni după @username sau cod, gășci, planuri cu „Vin / Nu pot”, vot în timp real.
- Contul creat pe un telefon se salvează în Supabase după login cu Google.
- Teste pentru tot ce adaug, ca până acum.
