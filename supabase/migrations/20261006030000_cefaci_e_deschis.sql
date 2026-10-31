-- Verificarea pe loc pe Google Maps (funcția e-deschis): id-ul locului, păstrat ca să nu-l mai căutăm.
-- Doar serverul îl citește și îl scrie.
create table if not exists public.venue_google (
  venue_id text primary key check (char_length(venue_id) <= 80),
  place_id text not null check (char_length(place_id) <= 300),
  checked_at timestamptz not null default now()
);
alter table public.venue_google enable row level security;
