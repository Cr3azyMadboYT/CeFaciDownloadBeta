-- "Ceva nu e bun?" on a ticket: people tell us when a place closed, the hours or the phone are wrong.
-- Insert-only for the person who reports; read by us (service role) when the map data is updated.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  venue_id text not null check (char_length(venue_id) <= 40),
  kind text not null check (kind in ('inchis', 'program', 'telefon', 'pret', 'altceva')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index reports_venue on public.reports (venue_id);
alter table public.reports enable row level security;
create policy reports_add on public.reports for insert to authenticated with check (user_id = (select auth.uid()));
