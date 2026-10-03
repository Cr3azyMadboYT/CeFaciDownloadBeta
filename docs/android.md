# Aplicația de telefon (React Native, nativă)

Aplicația e scrisă pentru telefon: ecrane native Android (React Native + Expo), nu o pagină web într-o fereastră.
Codul e în `mobile/`. Motorul de căutare, localurile și codul de cont sunt comune cu restul proiectului (`src/engine`, `src/data`, `src/app/bridge.ts`, `src/app/cloud.ts`).
Istoric: `android-capacitor-v1/` (varianta Capacitor, cu pagină web) și `android-webview-v0/` (primul APK). Nu se mai folosesc.

## Cum iau aplicația (fără PC)
La fiecare `push`, GitHub o construiește singur: **Actions → Aplicația Android → ultima rulare → Artifacts → CeFaci-android-N**.
În arhivă e `CeFaci-N.apk` (de instalat pe telefon) și, cu cheia reală, `CeFaci-N.aab` (pentru Google Play).

## Cheia de semnare (o singură dată, pe GitHub)
Settings → Secrets and variables → Actions → New repository secret, patru secrete:
- `CEFACI_KEYSTORE_B64`: fișierul `.jks` în base64;
- `CEFACI_KEYSTORE_PASSWORD`, `CEFACI_KEY_ALIAS`, `CEFACI_KEY_PASSWORD`.

Fără ele, APK-ul se semnează cu o cheie de test: se instalează și merge, dar **login-ul cu Google merge doar cu cheia reală**.
Cheia nu intră niciodată în git (`*.jks` e în `.gitignore`).

## Google (deja făcut pe 03.10)
- Client OAuth **Android**: `9736925899-q7tsi0l9bn6bt00s9t62aht9te3puock.apps.googleusercontent.com`, pachet `ro.cefaci.app`,
  amprenta SHA-1 a cheii: `17:63:E7:B2:9C:4A:3F:EA:98:68:21:B7:4D:A4:39:8A:DB:F1:E0:6F`.
  După ce urci în Google Play, adaugi și amprenta din Play Console → App integrity → App signing.
- Client OAuth **Web** (cel din Supabase → Auth → Google): `9736925899-jlhik3chso7l5176auj2u5lcce8i80iu.apps.googleusercontent.com`, pus în `mobile/src/lib/auth.ts`.

## Pe un PC (dacă vreodată ai unul)
```
cd mobile && npm ci
npx tsc --noEmit                       # verificarea codului
npx expo export --platform web         # previzualizare rapidă în browser (aceleași ecrane, randate pe web)
npx expo prebuild --platform android   # face folderul android/ (nu se pune în git)
cd android && ./gradlew assembleRelease
```
Înainte de o versiune nouă în magazin, crește `version` și `android.versionCode` în `mobile/app.json`.
