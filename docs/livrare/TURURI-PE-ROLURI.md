# Tururi Business și Admin cu Bilu

Turul pornește la prima intrare într-un context autorizat. Începe cu un bun venit, apoi deschide paginile reale și evidențiază intrarea din meniu. Se poate minimiza, închide sau relua din „Tur cu Bilu”. Nu salvează date de business, nu scanează bilete, nu trimite răspunsuri și nu acordă drepturi sau beneficii.

## Admin

| Rol | Ghidul se adaptează la |
| --- | --- |
| Fondator | Întregul meniu acordat de server, inclusiv bani, echipă și jurnal |
| Administrator | Cereri, semnalări, localuri, parteneri, sosiri, oameni, Plus, echipă și jurnal, conform permisiunilor actuale |
| Editor | Semnalări, catalog, sugestii și echipă, conform permisiunilor actuale |
| Moderator | Semnalări, catalog, oameni și echipă, conform permisiunilor actuale |
| Suport | Semnalări, parteneri, sosiri, oameni, Plus, catalog și echipă, conform permisiunilor actuale |
| Contabil | Situație financiară, parteneri, catalog și echipă, conform permisiunilor actuale |

Conținutul este filtrat atât după permisiunile returnate de server, cât și după meniul vizibil. Eticheta rolului nu presupune drepturi suplimentare. Turul explică diferența dintre vizualizare și decizie, verificarea manuală a proprietății și lipsa circuitului de facturare activ.

## Business

| Rol | Pagini din tur |
| --- | --- |
| Proprietar / manager | Azi, Rezervări, Scanner, Oferte, Financiar, Statistici, Profil, Echipă, Ajutor |
| Recepție (`receptie`) | Azi, Rezervări, Scanner, Ajutor |
| Scanare (`scanare`) | Azi, Scanner, Ajutor |
| Solicitant fără acces la local | Cereri și Ajutor; explică folosirea contului existent, revendicarea și solicitarea unui local lipsă |

Paginile sunt intersectate cu meniul disponibil. Turul pentru alt local poate fi diferit deoarece rolul este specific localului. Nu prezintă facturarea, evenimentele cu bilete sau activarea unui parteneriat ca funcții disponibile.

## Persistență, accesibilitate și verificare

Singura valoare salvată este `done`, în cheia `cefaci:<aplicație>:tutorial:<versiune>:<cont>:<rol>:<local>`, cu fiecare segment escapabil. Admin folosește localStorage, Business AsyncStorage. Modificarea acestei valori poate doar relua/ascunde ghidul; autorizarea rămâne pe server. Schimbarea contului sau rolului ascunde imediat ghidul anterior. Citirea întârziată din AsyncStorage nu poate reintroduce turul altui cont.

Admin are navigare cu tastatura, captură de focus la bun venit, Escape pentru închidere, contrast zi/noapte și animație oprită la reduced-motion. Business are butoane etichetate, anunțuri pentru cititorul de ecran pe telefon, layout pentru ecran mic și Bilu fără animație. Pe parcursul turului, paginile reale rămân utilizabile; cardul se poate minimiza.

`tests/role-tutorials.test.ts` verifică filtrarea tuturor rolurilor, roluri necunoscute, drepturi revocate, meniuri ascunse, solicitanți, izolarea cont/local/rol și absența promisiunilor false de activare sau facturare.
