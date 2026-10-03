# Aplicația de Android (Capacitor)

Aplicația e acum nativă: aceleași ecrane, într-o aplicație Android cu login Google nativ și locație.
Proiectul e în `android/`. Vechiul APK WebView a rămas în `android-webview-v0/`, doar ca istoric.

## O singură dată, pe PC
1. Instalează **Android Studio**.
2. În `~/.gradle/gradle.properties` (pe Windows: `C:\Users\<tu>\.gradle\gradle.properties`) adaugă cheia de semnare. Fișierul ăsta nu intră niciodată în git:
   ```
   CEFACI_KEYSTORE=C:/drum/spre/cefaci-android-release.jks
   CEFACI_KEYSTORE_PASSWORD=parola-ta
   CEFACI_KEY_ALIAS=cefaci
   CEFACI_KEY_PASSWORD=parola-ta
   ```
3. **Google Cloud → APIs & Services → Credentials**, în același proiect ca login-ul din Supabase:
   - un client OAuth de tip **Android** (făcut pe 03.10: `9736925899-q7tsi0l9bn6bt00s9t62aht9te3puock.apps.googleusercontent.com`; nu se pune în cod, Google recunoaște aplicația după pachet și amprentă), cu pachetul `ro.cefaci.app` și amprenta SHA-1 a cheii:
     `17:63:E7:B2:9C:4A:3F:EA:98:68:21:B7:4D:A4:39:8A:DB:F1:E0:6F`
     (după ce urci în Google Play, adaugi și amprenta SHA-1 din Play Console → App integrity → App signing);
   - clientul de tip **Web** e cel pus deja în Supabase → Authentication → Providers → Google. ID-ul lui se scrie în `.env.local`:
     ```
     VITE_GOOGLE_WEB_CLIENT_ID=9736925899-jlhik3chso7l5176auj2u5lcce8i80iu.apps.googleusercontent.com   (e deja pus în src/app/auth.ts)
     ```

## De fiecare dată când faci o versiune
```
npm i
node scripts/extract-boards.mjs && npx vite build
npx cap sync android
cd android && ./gradlew bundleRelease     # fișierul pentru Google Play: app/build/outputs/bundle/release/app-release.aab
cd android && ./gradlew assembleRelease   # sau un APK de instalat direct: app/build/outputs/apk/release/app-release.apk
```
Înainte de fiecare versiune nouă, crește `versionCode` (cu 1) și `versionName` în `android/app/build.gradle`.
