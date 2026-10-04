-- The weather for București + Ilfov (decision Cornel, 04.10: plans that follow the weather). The Edge Function
-- "vremea" refreshes it at most once an hour from Google's Weather API (the key is in Vault as google_maps_key,
-- never in the app or in git); the app only reads this one row.
create table public.weather (
  id smallint primary key default 1 check (id = 1),
  updated_at timestamptz not null default now(),
  data jsonb not null
);
alter table public.weather enable row level security;
create policy weather_read on public.weather for select to authenticated using (true);

-- the Google key, for the server only (service role)
create or replace function public.google_key() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  return (select decrypted_secret from vault.decrypted_secrets where name = 'google_maps_key' limit 1);
end $$;
revoke all on function public.google_key() from public, anon, authenticated;
