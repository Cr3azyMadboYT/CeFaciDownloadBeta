# Google Play — formularul „Siguranța datelor” (CeFaci Client)

Pregătit 23.10.2026 după ce face aplicația acum (cod + baza de date). Se completează în Play Console → Conținutul aplicației → Siguranța datelor. Trebuie să spună același lucru ca politica de confidențialitate (https://cefaci.app/confidentialitate/). Recitește-l la fiecare funcție nouă care trimite date pe server.

## Răspunsuri generale

- Colectează sau trimite date? **Da.**
- Datele sunt criptate în tranzit? **Da** (doar https; Supabase, Google, FCM).
- Utilizatorul poate cere ștergerea datelor? **Da**: în aplicație (Profil → Șterge-mi contul) și pe web: https://cefaci.app/sterge-contul/
- Datele partajate cu terți? **Nu**: Supabase, Google Cloud Vision, Firebase și Netopia sunt furnizori care lucrează pentru noi. Localul primește datele intrării sau biletului doar pentru că utilizatorul a mers acolo / a cumpărat de la el, așa că nu se socotește partajare. Dacă se adaugă vreodată publicitate sau analize de la terți, răspunsul se schimbă.

## Ce date se colectează

| Categoria Play | Ce anume | Obligatoriu? | Scop |
| --- | --- | --- | --- |
| Locație aproximativă | Punctul de acasă rotunjit (~100 m), zona FreeNow opțională | Opțional (se poate alege zona de mână) | Funcționalitatea aplicației |
| Locație exactă | La „Ai ajuns?” / check-in, trimisă o dată pentru verificare | Opțional | Funcționalitate, prevenirea fraudei |
| Informații personale: nume | Prenumele, username-ul | Obligatoriu | Gestionarea contului, funcționalitate |
| Informații personale: adresă de e-mail | E-mailul contului (Google sau cod pe mail) | Obligatoriu | Gestionarea contului |
| Informații personale: ID-uri de utilizator | Id-ul contului | Obligatoriu | Gestionarea contului |
| Informații personale: alte informații | Data nașterii (verifică 16+ și locurile 18+) | Obligatoriu | Funcționalitate, siguranță |
| Informații financiare: istoricul achizițiilor | Comenzile și biletele la evenimente | Opțional | Funcționalitate (de bifat de când vânzarea iese din test; datele de card le ia Netopia, nu noi) |
| Fotografii | Poza bonului: citită pe server și apoi aruncată (**procesată efemer**); poza de profil (256 px, păstrată cu starea contului) | Opțional | Funcționalitate (XP, intrarea la partener, profilul) |
| Activitate în aplicație: interacțiuni | Planuri, voturi, ieșiri, XP, ștampile, FreeNow, deschiderea linkurilor de bilete | Obligatoriu | Funcționalitate; linkurile de bilete și pentru statistici (interes pe eveniment) |
| Activitate în aplicație: alt conținut creat de utilizator | Numele gășcii, semnalările, „Lipsește un loc?” | Opțional | Funcționalitate, suport |
| ID-uri dispozitiv | Hash din ANDROID_ID (proba Plus o dată pe telefon); tokenul de notificări FCM | Obligatoriu / opțional (notificările) | Prevenirea fraudei; funcționalitate |

**Nu** se colectează: contacte, calendar, SMS, istoricul de navigare, fișiere, audio, sănătate, jurnale de erori (nu avem SDK de crash sau analytics). Căutările recente rămân doar pe telefon.

## Alte formulare Play care țin de asta

- **Acces la aplicație** (pentru recenzia Google): un cont de test cu e-mail. Contul E2E nu e potrivit.
- **Public țintă:** 16+ (nu se adresează copiilor). Locurile 18+ sunt ascunse sub 18.
- **Reclame:** nu.
- **Aplicație financiară / plăți:** abia când vânzarea de bilete iese din test. Biletele la evenimente fizice nu trebuie să treacă prin facturarea Google Play; de verificat din nou pentru Plus.
- **Permisiuni:** locația (exactă și aproximativă), camera (codul de pe masă, poza bonului), notificările. Nu cerem acces la galerie, microfon sau locație în fundal.
