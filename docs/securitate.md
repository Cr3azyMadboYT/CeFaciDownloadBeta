# Securitatea CeFaci — atacul din 07.10

Cornel (07.10): „rezolvă toate șmecheriile ce pot fi făcute sau bugurile ce pot fi abuzate… atacă aplicația”.
Am atacat-o din trei părți (baza de date, funcțiile de pe server + GitHub, aplicația de pe telefon), ca un om
rău-intenționat cu multe conturi, telefon rootat și GPS fals. Fiecare atac reparat are un test în `tests/db.test.ts`.

## Ce era grav și e reparat

| # | Atacul | Reparația |
|---|---|---|
| 1 | Oricine cu cont gratuit putea umfla factura Google (verificarea „e deschis?” și citirea bonului), fără limită | Cotă pe om și pe toată aplicația, pe zi (`api_quota`); citirea bonului se plătește doar după ce serverul a verificat check-in-ul |
| 2 | Oricine putea face un local adevărat să apară „închis pe Google” pentru toți | Numele și poziția locului le ia serverul din lista lui, nu de la telefon |
| 3 | Prietenie forțată cu oricine, chiar cu un minor (cererea primită se „muta” pe alt om) | Rândurile nu se mai pot muta pe alt om / altă gașcă / alt plan / alt vot (`private.freeze_keys`) |
| 4 | Intrat în orice gașcă sau plan al cărui id îl știai | La fel (3) |
| 5 | Vot trucat: voturi din voturi false mutate în votul adevărat | La fel (3) + un vot trebuie să fie pentru o variantă din votul lui (cheie compusă) |
| 6 | XP la nesfârșit: check-in la locuri inventate, cu poziția trimisă de telefon | Check-in doar la locuri din listă; poziția și felul locului vin de pe server |
| 7 | Același bon pus de mai multe conturi / de două ori pe același check-in | Amprenta bonului (CUI + data + ora + total) o singură dată pentru oricine; un check-in → un bon |
| 8 | Funcția de notificări putea fi chemată de oricine de pe internet | Răspunde doar bazei de date (secret în Vault, `push_hook_secret`) |
| 9 | Partenerii: localul putea scăpa de comision (`n-a venit` peste bonul clientului, închis fără răspuns) | Bonul clientului bate „n-a venit”; „Închide seara” cere da/nu; Admin vede mesele „n-a venit” și serile neînchise |
| 10 | Cuvântul serii se putea calcula de acasă; codul de la bar putea fi fotografiat și scanat de acasă | Cuvântul pornește din codul secret al localului; scanarea cere poziția la ≤ 300 m |
| 11 | Mese ocupate cu conturi noi (rezervări confirmate singure), oferte Live Drop ținute pe loc | Confirmare automată doar pentru conturi de ≥ 7 zile sau cu o vizită; max 4 rezervări/zi; după 2 oferte lăsate să expire, pauză |
| 12 | Oricine vedea firma, CUI-ul și procentul fiecărui partener | Aplicația vede doar ce îi trebuie (rezervări da/nu, reducerea Plus) |
| 13 | Cei fără cont (cheia publică) puteau asculta ștergerile live (cine cu cine e prieten, cine iese din gașcă) | Tabelele cu oameni ies din canalul live; telefonul află de schimbări prin vot/plan (care respectă regulile); cheia publică vede doar locurile |
| 14 | Cereri de prietenie spam, către minori după id; semnalări „deja rezolvate”; voturi cu sute de variante, nume urâte în notificări | Limite pe zi; minorii doar cu codul lor; semnalarea intră mereu „nouă”; max 10 variante; numele locului ia numele adevărat |
| 15 | Notificările unui cont rămâneau pe telefon după schimbarea contului | Tokenul telefonului trece pe contul intrat acum (`push_token_save`); la ieșire se șterg și amintirile pentru bon |
| 16 | Linkuri din datele locurilor (site, telefon) și din hartă puteau deschide alte aplicații | Doar `https`/`http` și numere de telefon; harta deschide doar creditele ei; MapLibre verificat cu hash (SRI) |
| 17 | O modificare greșită din Admin putea bloca aplicația la pornire pentru toți | Câmpurile de la server se iau doar cu tipul corect; un rând greșit e sărit |
| 18 | Poziția de acasă urca exactă | Urcă rotunjită la ~100 m |
| 19 | GitHub: un număr de la „Verifică locurile” intra direct în comandă | Verificat că e număr; `android.yml` doar cu drept de citire |

Migrarea: `supabase/migrations/20261007030000_cefaci_securitate.sql` (+ reparațiile din `…010000_cefaci_parteneri.sql`).
Funcțiile schimbate: `e-deschis`, `citeste-bon`, `vremea`, `trimite-notificare` (se urcă **după** migrare).

## Ce rămâne (nu se poate repara doar din cod)

- **Google Cloud (Cornel):** la Places API, Vision API și Weather API pune o limită pe zi (Quotas) și o alertă de buget
  care oprește cheia. Cheia Firebase din `google-services.json` restrânge-o doar la API-urile Firebase.
- **Funcțiile vechi `context-weather` și `route-matrix`** de pe server: acum nu fac nimic (le lipsește tabelul), dar
  trebuie șterse din Supabase → Edge Functions.
- **Proba Plus pe telefon:** un atacator care scrie singur cereri poate trimite un „cod de telefon” inventat. Reparația
  adevărată e Play Integrity (Google confirmă că e telefonul real), după ce aplicația e pe Google Play.
- **GPS fals** la check-in nu se poate opri complet; tot ce înseamnă bani la parteneri merge pe codul de la bar + cuvântul
  serii + bon, nu doar pe poziție.
- **Semnarea APK-ului** fără secretele cheii folosește cheia de test; înainte de Google Play, build-ul trebuie să
  ceară cheia reală.
- **Google sign-in fără nonce** (risc mic): de pus când refacem intrarea cu Google.
