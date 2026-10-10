# CeFaci.app — site de prezentare și documente

Sursa este `website/`; `scripts/package-site-web.mjs` generează documentele prin `scripts/generate-legal-pages.mjs`, verifică paginile necesare și produce `release/CeFaci-site-web.zip`. Documentele folosesc aceeași sursă de conținut ca aplicațiile. Nu există backend nou sau cerință de Node pe găzduire.

Designul păstrează Bilu, Bricolage Grotesque, Instrument Sans și Caveat, cu ecrane reale Client. Include temă zi/noapte, navigare accesibilă cu tastatura, prezentarea Client/Business/Admin și progresul de dezvoltare. Nu publică APK-uri sau o lansare inventată. Portalul Business existent este legat cu status beta; Admin nu este promovat pentru acces public.

Site-ul nu trimite requests de analytics, marketing sau Auth și nu setează cookies. Preferința `cefaci.site.theme` se salvează în localStorage numai după schimbarea explicită a temei. Butonul „Setări stocare” explică această preferință și o șterge separat, fără a șterge datele de autentificare ale altor aplicații. Nu există banner de consimțământ fictiv pentru trackere absente. Orice tracker introdus ulterior cere o revizuire tehnică și juridică înainte de publicare.

## Upload pe gazduire.net

1. Salvează document-root-ul actual al domeniului cefaci.app într-un backup separat.
2. Extrage conținutul ZIP-ului direct în document-root, inclusiv fișierul ascuns `.htaccess`. Nu urca folderul `website/` sau repo-ul.
3. Păstrează HTTPS real activ pe domeniu. `.htaccess` redirecționează HTTP către HTTPS, oprește listarea directoarelor și aplică CSP, HSTS, MIME și cache. Pentru alt server decât Apache/LiteSpeed trebuie transcrise regulile înainte de publicare.
4. Verifică `/`, cele nouă pagini din footer și linkurile vechi `/termeni.html` și `/confidentialitate.html`, care redirecționează spre noile URL-uri. O adresă necunoscută trebuie să răspundă 404.
5. Verifică în browser desktop și telefon, temă zi/noapte, setările stocării, butoanele și absența requests de marketing. Cache-ul HTML este dezactivat, assets se revalidează după o oră.

Pachetul nu conține snapshoturi, SQL, configurații Auth, chei, node_modules sau builduri native. Publicarea pe domeniul real nu a fost făcută fără accesul la găzduire.

## Backup și verificare

`docs/livrare/site-before-legal-20261009/` păstrează HTML-ul public precedent, doar asseturile explicit enumerate din același domeniu și SHA-256 în `snapshot.json`. Nu s-a făcut mirror recursiv și nu s-a citit date din conturi. Acest snapshot rămâne în documentație și nu intră în ZIP-ul public.

`node scripts/test-site-ui.mjs` pornește un server localhost izolat cu CSP și verifică linkurile legale, cele patru lățimi de ecran, tastatura, dialogul și Escape, tema persistentă și ștergerea delimitată, absența cookies și requests externe, blocarea scripturilor inline și 404 real.

`node scripts/test-site-hosting.mjs` cere Apache localhost pe portul 4178 și verifică regulile reale `.htaccess`, apoi rulează aceleași verificări de browser. Headerul X-Forwarded-Proto simulează terminatorul HTTPS; nu verifică certificatul real al domeniului. Capturile de verificare sunt salvate separat în `release/site-ui/`, fără includere în pachet.
