# Build Android pe PC-ul lui Cornel (din 30.10, în locul buildului de pe GitHub).
# Face exact ce face jobul „native” din .github/workflows/android.yml: expo prebuild, APK + AAB semnate cu cheia reală,
# verificarea semnăturii, apoi pune totul în release/.
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1            # aplicația CeFaci (client)
#   powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 business   # CeFaci Business
#
# Cheia de semnare NU stă în proiect. Scriptul o ia din %USERPROFILE%\.gradle\gradle.properties:
#   CEFACI_KEYSTORE=C:/Users/corne/CeFaci-chei/cefaci-android-release.jks
#   CEFACI_KEYSTORE_PASSWORD=...
#   CEFACI_KEY_ALIAS=cefaci
#   CEFACI_KEY_PASSWORD=...
# Harta satelit (opțional): EXPO_PUBLIC_ESRI_MAPS_KEY=... în mobile\.env.local (nu intră în git). Fără ea, harta e OpenFreeMap.
param([ValidateSet('client', 'business')][string]$App = 'client')
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$folder = if ($App -eq 'business') { 'business' } else { 'mobile' }
$name = if ($App -eq 'business') { 'CeFaci-Business' } else { 'CeFaci-Client' }

# Uneltele: Java din Android Studio, SDK-ul Android din AppData.
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw "Nu găsesc Java în $env:JAVA_HOME (instalează Android Studio)." }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "Nu găsesc SDK-ul Android în $env:ANDROID_HOME." }

# Fără cheia reală nu livrăm nimic (la fel ca pe GitHub): Google login nu merge cu cheia de test.
$props = Join-Path $env:USERPROFILE '.gradle\gradle.properties'
$text = if (Test-Path $props) { Get-Content $props -Raw } else { '' }
foreach ($k in 'CEFACI_KEYSTORE', 'CEFACI_KEYSTORE_PASSWORD', 'CEFACI_KEY_ALIAS', 'CEFACI_KEY_PASSWORD') {
  if ($text -notmatch "(?m)^$k=.+") { throw "Lipsește $k în $props. Vezi începutul scriptului." }
}
$jks = ([regex]::Match($text, '(?m)^CEFACI_KEYSTORE=(.+)$').Groups[1].Value).Trim()
if (-not (Test-Path $jks)) { throw "Fișierul cheii nu există: $jks" }

Push-Location (Join-Path $root $folder)
try {
  $env:CI = '1'; $env:EXPO_NO_TELEMETRY = '1'
  Write-Host "== ${name}: proiectul nativ Android" -ForegroundColor Cyan
  npx expo prebuild --platform android --clean --no-install
  if ($LASTEXITCODE) { throw 'expo prebuild a picat' }

  Push-Location android
  try {
    Write-Host "== ${name}: APK + AAB" -ForegroundColor Cyan
    .\gradlew.bat assembleRelease bundleRelease --no-daemon
    if ($LASTEXITCODE) { throw 'gradle a picat' }
  } finally { Pop-Location }

  $out = Join-Path $root 'release'
  New-Item -ItemType Directory -Force $out | Out-Null
  Copy-Item android\app\build\outputs\apk\release\app-release.apk "$out\$name.apk" -Force
  Copy-Item (Get-ChildItem android\app\build\outputs\bundle\release\*.aab | Select-Object -First 1).FullName "$out\$name.aab" -Force

  # Semnătura: trebuie să fie cheia CeFaci, nu cea de test.
  $tools = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Directory | Sort-Object { [version]$_.Name } | Select-Object -Last 1
  $info = & "$($tools.FullName)\apksigner.bat" verify --print-certs "$out\$name.apk"
  if ($LASTEXITCODE) { throw 'APK-ul nu e semnat corect' }
  if ($info -match 'CN=Android Debug') { throw 'APK-ul e semnat cu cheia de test, nu cu cheia CeFaci' }
  $badge = & "$($tools.FullName)\aapt.exe" dump badging "$out\$name.apk" | Select-Object -First 1
  $commit = git -C $root rev-parse --short HEAD
  @("Commit $commit", $badge, $info) | Set-Content "$out\$name-build.txt" -Encoding utf8
  Write-Host "`nGata: $out\$name.apk și $out\$name.aab" -ForegroundColor Green
  Write-Host $badge
} finally { Pop-Location }
