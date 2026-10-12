# Admin și Business web — memorarea autentificării, 10.10.2026

Opțiunea **Ține-mă minte 15 zile pe acest dispozitiv** este nebifată implicit, pe ambele pagini de login. Fără bifă, autentificarea rămâne în tab. Cu bifă, după verificarea OTP și confirmarea serverului, contul poate fi reluat în același profil de browser inclusiv după închiderea tabului/browserului. Logoutul șterge memorarea aplicației respective, fără să afecteze tema sau cealaltă aplicație.

Limita este fixă: momentul real al creării sesiunii Supabase Auth + 15 zile. Refreshul tokenului, redeschiderea browserului și repetarea cererii nu o prelungesc. Browserul elimină sesiunea la expirare, inclusiv într-un tab deschis; backendul refuză accesul cu vechiul token chiar dacă ceasul/stocarea browserului au fost schimbate. Revocarea sesiunii, contului, factorului MFA sau rolului poate opri accesul mai devreme.

**MFA nu este memorat pentru 15 zile.** Admin păstrează blocarea după 15 minute de inactivitate / maximum 8 ore; Business după 30 minute / maximum 12 ore. Pentru redeschiderea datelor privilegiate este necesară o dovadă MFA nouă. Memorarea nu acordă roluri, nu aprobă cereri Business și nu permite accesul unui cont fără drepturi.

Tokenurile web sunt în localStorage doar la alegerea explicită a utilizatorului, cu chei separate și marcaj de expirare legat de sesiunea reală. Sunt accesibile JavaScript, nu cookies HttpOnly; memorarea trebuie folosită pe dispozitive personale protejate. Politica de stocare explică această alegere. Stocarea nativă Business prin SecureStore este păstrată; acest checkbox este pentru web.

În caz de eroare RPC sau stocare blocată, contul rămâne numai în tab și primește un mesaj explicit; interfața nu pretinde că l-a memorat. Nu se persistă codul OTP sau datele auxiliare PKCE.

Migrare locală: `20261010200458_cefaci_remembered_web_auth.sql`; aplicată live în CeFaci2.0 (`vqrmwuarjjntusfbqprx`) ca **20261010201619**. Tabel privat cu RLS, fără acces direct anon/authenticated; expirarea este verificată în `private.live_auth_session`. RPC `remember_web_session` permite numai înregistrarea sesiunii proprii deja autentificate, fără parametru de utilizator/sesiune. Ștergerea sesiunii Auth elimină marcajul prin FK cascade; marcajele expirate nu sunt șterse prematur, pentru a nu reactiva un token vechi.

Testele includ nouă scenarii de stocare/refresh/erori, trei scenarii SQL suplimentare pentru termen/MFA/revocare și opt fluxuri browser Admin/Business: implicit, memorare, expirarea tabului deschis după 15 zile, fallback la eroarea serverului. Suitele existente pentru roluri, OTP, revendicări, tutoriale și concurență sunt păstrate. Verificări HTTP live: anon primește 401 la RPC și 404 la tabelul privat, fără crearea de utilizatori sau sesiuni fictive în producție.

Advisor Supabase raportează intenționat RLS fără politici pentru tabelul privat (deny-by-default) și RPC SECURITY DEFINER executabil de authenticated, necesar pentru înregistrarea sesiunii proprii. Referințe: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy și https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Avertismentele anterioare ale proiectului nu sunt considerate remediate de această modificare.

ZIP-urile furnizate de utilizator au fost identificate la sursa **8f2df4f1d3edfed6f1020ff222a5f13792b8440f**. Sursele au fost aduse la această versiune înainte de modificări, inclusiv capturile inline din quiz pe mobil. Originalele sunt păstrate în `release/previous-remember-login-20261010/`. Livrarea recompilată se încarcă în rădăcinile domeniilor Admin și Business, cu fișierele `.htaccess`; nu se publică sursele, SQL sau backupurile în webroot.
