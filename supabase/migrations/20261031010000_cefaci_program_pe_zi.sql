-- Cache pe server pentru funcția e-deschis. Doar serverul (cheia de serviciu) citește și scrie; nimeni din aplicație nu atinge tabelul.
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
