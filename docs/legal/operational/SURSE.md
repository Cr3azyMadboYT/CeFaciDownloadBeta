# Surse oficiale și limitele verificării

Consultate prin căutare și acces la surse oficiale la 9–10 octombrie 2026. Documentele sunt parafrazate și adaptate fluxurilor observate în repository; nu sunt copii ale legii și nu reprezintă aviz juridic sau fiscal. Forma consolidată și aplicabilitatea trebuie revizuite la lansare și la modificarea modelului.

| Sursă | Utilizare |
| --- | --- |
| [GDPR, Regulamentul (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/) | Art. 5–6 minimizare/temeiuri; 12–22 drepturi; 28 DPA; 30 registru; 32 securitate; 33–34 incidente; 35–37 DPIA/DPO; capitolul V transferuri. EUR-Lex a oferit rezultate indexate; o versiune RO a afișat verificare JavaScript, deci nu pretindem că acel răspuns a furnizat textul integral. |
| [Legea 506/2004, forma consolidată](https://legislatie.just.ro/Public/DetaliiDocumentAfis/214211) | Art. 4: informare/acord pentru stocare și acces la terminal, excepțiile aplicabile. Nu orice cheie locală este automat exceptată. |
| [Legea 365/2002, forma consolidată](https://legislatie.just.ro/Public/DetaliiDocument/153252) | Art. 5: identitatea și contactul efectiv al furnizorului. No firm/date nepublicate sunt puncte deschise, nu conformitate completă. |
| [OUG 34/2014, forma consolidată](https://legislatie.just.ro/Public/DetaliiDocument/158913) | Informare consumatori, retragere și excepții. Aplicabilitatea se verifică pe contractul real. |
| [OUG 141/2021](https://legislatie.just.ro/Public/FormaPrintabila/00000G0B1RD4AHD7FVE3SGMUQRWMXOG5) | Servicii/conținut digital și situații cu date personale furnizate de consumator; gratuitatea nu este exceptare universală. |
| [SAL — ANPC](https://anpc.ro/sal/) | Canal funcțional de soluționare alternativă și informare. |
| [Comisia Europeană: închiderea ODR](https://consumer-redress.ec.europa.eu/site-relocation_en) | Platforma ODR este oprită din 20 iulie 2025; nu există link de reclamație nouă către vechiul serviciu. |
| [OUG 120/2021, forma consolidată](https://legislatie.just.ro/Public/DetaliiDocument/305980) | RO e-Factura, XML, categorii și termenul actual. Pagina arată consolidări inclusiv în 2026. |
| [ANAF: termen e-Factura 2026](https://static.anaf.ro/static/3/Galati/20260202132103_termen%20transmitere%20factura%20electronica.pdf) | Confirmă termenul de 5 zile lucrătoare aplicabil de la 1 ianuarie 2026. |
| [Legea contabilității 82/1991](https://legislatie.just.ro/Public/DetaliiDocument/38127) | Art. 25: păstrarea documentelor contabile vizate, 5 ani de la 1 iulie a anului următor. Nu aplicăm termenul generic fiecărei categorii de date. |
| [ANSPDCP: plângeri](https://www.dataprotection.ro/?page=Plangeri_meniu) | Canalul pentru persoane, indicat în politicile publice. |
| [ANSPDCP: Decizia 174/2018](https://www.dataprotection.ro/servlet/ViewDocument?id=1556) | Lista operațiunilor pentru care este obligatorie DPIA; evaluarea trebuie făcută pentru implementarea și scara reală. |
| [Supabase: DPA actual](https://supabase.com/legal/customer-resources/data-processing-addendum) | Condițiile împuternicitului; publicarea de către furnizor nu dovedește toate formalitățile operatorului. |
| [Supabase: regiuni și transferuri](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq) | Baza de date, Edge, logs, backup și subîmputerniciți nu sunt automat acoperite de afirmația „totul în UE”. |
| [Google Cloud Vision: folosirea datelor](https://docs.cloud.google.com/vision/docs/data-usage) | API online procesează imaginea în memorie; există metadate de cerere, iar configurația efectivă și transferurile se verifică separat. Nu pretindem lipsa totală a jurnalelor. |

## Dovezi din implementare

- `src/app/cloud.ts`: profil/prefs sincronizate, punctul `home` rotunjit la trei zecimale; locația precisă punctuală în `mobile/src/lib/partner.ts` și `outing.ts`.
- `supabase/functions/citeste-bon/index.ts`: apel Vision online, extragere și amprentă, fără bucket permanent pentru fotografia bonului.
- `20261007020000_cefaci_proba_pe_telefon.sql`: hash persistent și uid eliminat la ștergere; lipsa TTL este consemnată pentru decizie, nu prezentată ca anonimizare.
- `20261009082804_cefaci_business_onboarding.sql` și `20261009095047_cefaci_admin_support.sql`: atașamente private, acces blocat după 90 de zile, retenție în două faze prin Storage și confirmare. Schedulerul nu este demonstrat de existența RPC-urilor.
- `20261009213831_cefaci_privileged_security_sessions.sql`: MFA și autorizare server, limitele sesiunilor Admin/Business.
- `20261010070306_cefaci_privacy_rights.sql`: cereri cu deadline calendaristic, Admin autorizat, export rapid limitat, blocarea ștergerii simple pentru cazuri de analizat.
- `website/assets/site.js`: numai tema solicitată, cheia `cefaci.site.theme`, fără analytics sau marketing.

Nu am verificat un contract de firmă, un DPA semnat al operatorului, un ciclu SPV/e-Factura activ, un job de ștergere programat, o notificare reală către autoritate ori toate configurațiile furnizorilor. Aceste puncte rămân de documentat înaintea scopului respectiv, nu sunt acoperite prin texte sau teste software.
