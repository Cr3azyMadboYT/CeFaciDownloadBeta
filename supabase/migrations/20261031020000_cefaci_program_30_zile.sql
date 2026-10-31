-- Cache pe server pentru funcția e-deschis. Doar serverul (cheia de serviciu) citește și scrie.
create table if not exists public.place_hours (
  venue_id text primary key check (char_length(venue_id) <= 80),
  periods jsonb,                            -- weekly periods, null = the place publishes no hours
  utc_offset int,
  fetched_at timestamptz not null default now()
);
alter table public.place_hours enable row level security;
revoke all on public.place_hours from anon, authenticated;
