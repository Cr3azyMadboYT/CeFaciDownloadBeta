# CeFaci Client + Business — progres verificabil

Ramură: `codex/cefaci-client-business-20261008`, de la `52e7e03` (cod bază `45ad496`).
Backupuri remote verificate și păstrate: `backup/claude-original-20261008` = `9d1e02c`; `backup/cefaci-current-20261008` = `45ad496`.

Au fost citite toate cele patru documente handoff, începând cu PROMPT-CODEX-CLOUD.md, contextul proiectului și regulile/designul. Regulile active au prioritate față de propunerile vechi.

Baza repositoryului: 263 teste trecute, un test opțional de tabel omis. Aceste rezultate validează baza, nu V2.
Schema live CeFaci2.0 inspectată read-only: 30 migrații, ultimele `20261007165417` și `20261007165421`; V2 încă neinstalat la acest checkpoint.

Primul checkpoint: API de participare cu deadline server, număr comun, timeout fără penalizare, serializare pe plan și cheie idempotentă. Urmează testele integrate, operațiunile partener și interfețele. Nu există încă artefacte noi APK/web la acest checkpoint.

Checkpoint 2: migrații V2 pentru operațiuni și financiar; legătura nativă Client; Business React Native cu export static. 274 teste trecute, un test opțional omis. Cinci scenarii de concurență pe PostgreSQL 17 cu conexiuni independente au trecut. Typecheck Client/Business trece; web Business și prebuild Business Android/iOS generate. API-urile V1 rămân testate ca snapshot al backupului; suita V2 încarcă toate migrațiile și verifică retragerea intenționată a scrierilor legacy.

La acest checkpoint, backendul V2 nu este încă instalat live și APK-urile nu sunt încă construite. Workflowul verifică schema concurentă și construiește separat Client și Business; implementarea și validarea continuă pe aceeași ramură.
