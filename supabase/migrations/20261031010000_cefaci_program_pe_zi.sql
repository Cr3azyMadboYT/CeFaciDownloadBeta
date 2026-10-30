-- Programul unui loc de la Google, păstrat DOAR pentru ziua curentă (ora României) și refolosit pentru toți utilizatorii.
-- Cornel a întrebat suportul Google Maps Platform (31.10.2026, 10:42) „putem păstra programul unui loc, pentru toți
-- utilizatorii aplicației, doar pentru ziua curentă?”; răspuns (10:44): „Da, puteți păstra programul unui loc și îl
-- puteți reutiliza pentru toți utilizatorii aplicației pe durata zilei curente. La începutul zilei următoare,
-- informațiile trebuie actualizate.” (captura: docs/google-suport-program-pe-zi.webp).
-- De aceea: un singur rând pe loc, mereu al zilei de azi; funcția e-deschis șterge rândurile mai vechi și le ia din nou de la
-- Google. Doar serverul (cheia de serviciu) citește și scrie; nimeni din aplicație nu atinge tabelul.
create table if not exists public.place_day (
  venue_id text primary key check (char_length(venue_id) <= 80),
  day date not null,                       -- ziua (ora României) pentru care e valabil rândul
  status text check (char_length(status) <= 40),  -- businessStatus de la Google
  periods jsonb,                           -- programul pe săptămână, cum îl dă Google
  utc_offset int,                          -- minute față de UTC ale locului
  fetched_at timestamptz not null default now()
);
alter table public.place_day enable row level security;
revoke all on public.place_day from anon, authenticated;
