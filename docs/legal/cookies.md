# Cookies și stocarea pe dispozitiv

Versiunea: 2026-10-10. Conținut comun cu aplicațiile și site-ul.

## 1. Ce acoperă politica

Această politică privește cookie-uri, localStorage, sessionStorage și stocarea locală a aplicațiilor. O cheie de stocare locală nu este automat un cookie, dar poate intra sub regulile accesului la echipamentul terminal. Folosim în versiunea actuală numai stocări pentru funcțiile cerute, securitate și preferințe ale interfeței; nu includem pixeli de marketing, SDK-uri publicitare sau analiză comportamentală.

Stocarea strict necesară furnizării serviciului cerut poate beneficia de excepția prevăzută de art. 4 alin. (6) din Legea 506/2004. Această excepție nu acoperă automat orice scop util operatorului. O viitoare statistică facultativă sau publicitate va necesita evaluarea temeiului și, când este cazul, consimțământ prealabil, specific și retractabil.

## 2. Site-ul cefaci.app

Fonturile și imaginile sunt găzduite împreună cu site-ul. Linkurile spre aplicații și e-mail nu încarcă în prealabil conținut de tracking al unui furnizor extern. Serverul de găzduire poate avea jurnale HTTP; acestea nu sunt cookie-uri și sunt descrise în politica de confidențialitate.

Site-ul folosește cheia localStorage cefaci.site.theme numai când alegi explicit tema de zi sau de noapte. Până atunci folosește preferința sistemului fără a o scrie în stocare. Controlul Setări stocare permite ștergerea acestei chei și revenirea la tema sistemului. Preferința rămâne până când o ștergi sau cureți datele site-ului. Nu există cookies de marketing, analytics sau un buton fictiv de acceptare a acestora.

## 3. Client

Cheile cefaci.prefs și cefaci.state păstrează preferințele și progresul; cefaci.onboarded și cefaci.owner susțin reluarea și separarea stării conturilor. Cache-ul de localuri și cheile cefaci.planAsk și ale sugestiilor recente susțin catalogul și formularul cerut. Ele rămân până la resetarea aplicației, ștergerea datelor ori înlocuirea lor de fluxul aplicației; anumite sugestii recente sunt filtrate la două zile.

Sesiunea Supabase folosește chei de tip sb-<proiect>-auth-token în stocarea aplicației Client; durata sesiunii și reînnoirea sunt controlate de autentificare. Nu susținem că tokenul Client este un cookie HttpOnly. Ștergerea datelor locale poate deconecta contul și poate pierde progresul nesincronizat. Hashul dispozitivului folosit pentru limitarea probei Plus este explicat în informarea de confidențialitate și necesită o evaluare separată a proporționalității și a regulilor privind terminalul.

## 4. Business și Admin

În Business web și Admin, tokenul de autentificare se păstrează în sessionStorage pe durata tabului. Logoutul și revocarea sunt verificate de server. Sesiunea privilegiată are limite suplimentare: Admin 15 minute de inactivitate și maximum 8 ore, Business 30 de minute și maximum 12 ore; după expirare se cere o verificare MFA nouă.

Business nativ păstrează sesiunea prin Expo SecureStore, în stocarea securizată a sistemului de operare. business-theme păstrează tema, iar marcajele tutorialului indică dacă turul a fost parcurs pentru cont, rol și local. Admin folosește cefaci-admin-theme și marcaje de tutorial de tip cefaci.tour. Aceste preferințe nu sunt folosite pentru publicitate. Unele chei pot avea prefixe sau sufixe generate pentru cont și versiune.

## 5. Control și modificări

Poți șterge stocarea din setările browserului/dispozitivului, te poți deconecta sau poți reseta aplicația. Refuzul permisiunilor de locație, cameră sau notificări se gestionează separat din sistemul de operare. Pentru întrebări: contact@cornacidev.ro.

Dacă adăugăm servicii facultative, publicăm numele, scopul, furnizorul și durata lor înainte de activare. Refuzul și retragerea trebuie să fie la fel de ușoare ca acceptarea și să oprească viitoarele accesări facultative; acceptarea politicii de confidențialitate nu este consimțământ pentru tracking.
