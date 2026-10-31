-- The weekly opening hours of a place, kept for at most 30 days and then asked again (scripts/fetch-hours.mjs, monthly,
-- and the function e-deschis when a row is missing or older). Only the server (service key) reads and writes it.
create table if not exists public.place_hours (
  venue_id text primary key check (char_length(venue_id) <= 80),
  periods jsonb,                            -- weekly periods, null = the place publishes no hours
  utc_offset int,
  fetched_at timestamptz not null default now()
);
alter table public.place_hours enable row level security;
revoke all on public.place_hours from anon, authenticated;
