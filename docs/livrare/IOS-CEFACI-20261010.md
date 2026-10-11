# CeFaci Client și Business pentru iOS — 10.10.2026

## Scop și stare

Utilizatorul a cerut implementarea iOS și a confirmat că **nu are încă Apple Developer**. Livrarea pregătește ambele aplicații native, cu același design și aceleași verificări ale serverului. Compilarea se execută pe GitHub Actions macOS 26 Apple Silicon cu Xcode 26.6, nu printr-un export JavaScript pe Ubuntu. Verificarea finală din 11.10.2026 confirmă compilări și teste reușite: [Client CI 38089793167](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38089793167) și [Business CI 38090190410](https://github.com/Cr3azyMadboYT/CeFaciDownloadBeta/actions/runs/38090190410). Pachetele au fost descărcate și verificate prin digestul artefactului GitHub, checksumurile interioare, CRC și Info.plist real.

Client: **0.3.4, build iOS 8**, bundle `ro.cefaci.app`. Business: **1.0.8, build iOS 9**, bundle `app.cefaci.business`, iPhone și iPad. Client Android/code7, Admin și site-ul livrate anterior sunt păstrate. Business Android este actualizat separat la code9; un pachet iOS nu se încarcă pe gazduire.net.

## Completări iOS

- Client primește modulul Swift `CefaciIcon`, podspec/autolinking Apple și patru cataloage alternative, pe lângă iconița principală. Business păstrează modulul Swift și Bilu cu servietă. Toate cele cinci iconițe sunt RGB fără alpha.
- Calendarul este comun: primăvară martie–mai, vară iunie–august, toamnă septembrie–noiembrie, iarnă restul; Crăciun 1 decembrie–7 ianuarie inclusiv. UIKit schimbă iconița în prim-plan și poate afișa mesajul standard Apple. Aplicația închisă nu rulează singură schimbarea.
- Client iOS folosește loginul real prin cod email. Google și Apple iOS nu sunt configurate, deci nu există butoane care deschid un SDK neconfigurat. Google Android este păstrat. Înainte de activarea Google iOS sunt necesare clientul OAuth iOS, URL scheme și configurarea Supabase, plus evaluarea cerinței Apple pentru un serviciu alternativ de login.
- Client cere doar locație în timpul folosirii, cameră și selectarea fotografiilor la acțiunile utilizatorului; fără locație permanentă, motion ori microfon. Business nu cere GPS, microfon sau Face ID nefolosit. Stocarea Business rămâne SecureStore/keychain, cu aceleași sesiuni MFA și roluri verificate pe server.
- „Ține-mă minte 15 zile” este opțiunea web; nu se afișează un checkbox web în Business nativ. Admin rămâne dashboard web, accesibil separat, nu o nouă aplicație iOS.
- Documentele și drepturile proprii sunt disponibile în aplicații înaintea accesului operațional. Datele operatorului rămân incomplete conform alegerii titularului și trebuie completate înainte de colectare publică/publicare.

## Corecții Business din feedbackul pe telefon

Username-ul se verifică online după 400 ms, numai pentru formatul valid. Salvarea cere confirmarea disponibilității pentru exact numele curent; răspunsurile întârziate, erorile și numele ocupate nu activează butonul. Verificarea atomică și unicitatea serverului rămân decisive la salvare. Datele se introduc prin Zi/Lună/An, fără valoare inventată, cu validare calendaristică și minimum 16 ani. Meniul compact Opțiuni înlocuiește barele permanente pentru tur, temă și documente. Turul inițial și memorarea finalizării pe cont/rol sunt păstrate.

## Ce înseamnă fiecare pachet

`*-ios-simulator.zip`: aplicație `.app` Release compilată pentru simulator macOS. Semnarea ad-hoc servește simulatorului; **nu este semnare Apple Distribution și nu permite instalare pe iPhone**.

`*-ios-device-unsigned.zip`: arhivă `.xcarchive` cu executabil arm64 și bundle offline, compilată prin Xcode pentru dispozitiv, **nesemnată**. Nu este IPA instalabil sau build TestFlight.

`*-ios-project.zip`: proiectul Xcode generat, Podfile/lockfile rezultat și modulele native locale. Nu include Pods/node_modules, credențiale sau calea locală de Node a runnerului. Folosește sursele din `CeFaci-iOS-source.zip`, cu structura monorepo intactă.

`*-ios-audit.json`, `*-ios-build.txt`, checksumuri și rapoarte Maestro/JUnit: dovezi ale produselor compilate și ale testelor. Pachetele există doar când verificările native trec; nu se atribuie un rezultat de compilare unui proiect generat pe Linux.

## Folosirea simulatorului și reconstruirea

Pe Mac, instalează Xcode și componentele iOS Simulator. Folosește simulatorul compatibil cu arhitectura indicată în audit: x86_64 necesită Mac Intel, arm64 necesită Apple Silicon. Deschide Simulator, apoi instalează `.app` prin drag-and-drop sau `xcrun simctl install booted /cale/CeFaci.app`; lansează bundle-ul indicat mai sus. Business are numele `CeFaciBusiness.app`.

Pentru reconstruire: checkout la sursa indicată în raport, `npm ci` la rădăcină și în `mobile`/`business`, apoi generează iOS cu `npx expo prebuild --platform ios --clean --no-install` din aplicație. Dacă reproduci buildul livrat, copiază lockfile-ul Pods din proiectul livrat după prebuild; `pod install` în `ios`, apoi deschide **.xcworkspace**, nu doar .xcodeproj. Nu muta proiectul din monorepo fără adaptarea căilor către src/shared și modulele locale.

Workflow-ul este `.github/workflows/ios.yml`, cu selecție Client, Business sau ambele. Rulează întâi testele și auditul proiectului, apoi compilarea simulator/device, auditul binarelor și testele native fără ocolirea loginului (`EXPO_PUBLIC_E2E=0`). Nu solicită coduri OTP și nu creează conturi/date fictive în producție.

## După activarea Apple Developer

Pentru un test local pe propriul iPhone există și Personal Team în Xcode, cu un Apple Account gratuit și reprovisionare la șapte zile. Are limitări de dispozitive/aplicații și capabilități; nu oferă TestFlight sau distribuție publică. Business poate folosi această cale locală; pentru Client, profilul trebuie să corespundă entitlements generate (Push Notifications necesită verificarea capabilităților Team-ului). Această livrare nu a făcut provisioning pentru un telefon personal. [Explicația Apple](https://developer.apple.com/help/account/basics/about-your-developer-account).

1. Înregistrează cele două Bundle ID-uri pentru Team-ul propriu, creează aplicațiile corespunzătoare în App Store Connect și configurează certificatele/provisioning în Xcode. Nu trimite parole, fișiere .p12 sau chei .p8 în chat/repository. Folosește Keychain sau secrets într-un workflow separat de semnare.
2. Selectează Team-ul în Signing & Capabilities pentru fiecare proiect și verifică entitlements/profilul. Clientul are entitlements pentru notificări generate de Expo; Push Notifications/APNs trebuie configurate pentru o funcție remote iOS activă. În această livrare, notificările sociale remote sunt încă numai Android; reminderele locale folosesc codul comun. Nu se pretinde că APNs este activat.
3. Testează pe iPhone real: email OTP cu contul propriu, locație doar la cerere, cameră/galerie, linkuri, fundal/revenire, retenția contului și logout. În Business: MFA și fiecare rol autorizat, local/cereri/raportări și documente. Simulatorul nu înlocuiește testarea GPS/camerei/provisioning pe dispozitiv.
4. Recompilează Release pentru sursa verificată, Product → Archive, validează și exportă cu profilul App Store Connect, apoi încarcă în TestFlight. Nu transforma arhiva nesemnată într-un IPA public pretinzând că poate fi instalat; semnarea și verificarea Apple sunt pași reali.
5. Completează metadata App Store, suport/confidențialitate, declarațiile App Privacy conform datelor efectiv folosite și dosarul operatorului. Alegerea unui cont personal Apple poate afișa identitatea personală a vânzătorului. Furnizează echipei Apple instrucțiuni de review și accesul legitim necesar pentru funcții Business fără a elimina MFA/RLS sau a pune conturi demo privilegiate în aplicație.

Referințe oficiale: [builduri iOS Expo](https://docs.expo.dev/build-reference/ios-builds/), [simulator fără semnare Distribution](https://docs.expo.dev/build-reference/simulators/), [Google iOS în Expo](https://react-native-google-signin.github.io/docs/setting-up/expo), [Supabase Google nativ](https://supabase.com/docs/guides/auth/social-login/auth-google), [cerințele Apple pentru login](https://developer.apple.com/app-store/review/guidelines/#login-services), [imagini macOS GitHub](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md).

## Rezultatele reale livrate

Client: sursa `6fa10304614fcab5ce4752da54cdbe1425fa3a3e`, 0.3.4/build8, ARM64 simulator și device. Maestro a trecut start → email → documente → întoarcere pe iPhone17Pro/iOS26.4. Business: sursa `794710b927a1e1f2bc6e33394cf69bf360d96b5d`, 1.0.8/build9, ARM64 simulator și device; login și documente testate pe iPhone17Pro și iPadPro13-inch/iOS26.4. Toate rapoartele au zero failures. Nu s-au cerut OTP-uri reale.

Arhivele din `release/` sunt produse Xcode Release, nu doar proiecte generate. Auditul verifică Mach-O, modulul Swift al iconițelor sezoniere, TLS, manifestele de confidențialitate și semnarea ad-hoc a simulatorului; device rămâne nesemnat. Proiectele iOS livrate sunt cele împachetate pe macOS, cu Podfile.lock; proiectul Linux din artefactul Android rămâne numai în ZIP-ul CI original. `CeFaci-Business-SHA256.txt` acoperă produsele Android, iar `CeFaci-Business-ios-SHA256.txt` acoperă separat proiectul și produsele iOS reale. Dovezile originale GitHub și auditurile sunt păstrate în `docs/livrare/builds/`.
