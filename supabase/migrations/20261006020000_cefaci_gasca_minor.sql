-- O gașcă cu cineva sub 18 ani (decizie Cornel, 06.10: „când e cineva sub 18, Bilu să zică: în gașcă aveți pe cineva
-- sub 18, deci rezultatele vor fi potrivite”). Un plan pentru gașcă e atunci ca pentru un minor: fără cluburi, baruri,
-- narghilea și locuri 18+. Spune doar da sau nu (nu cine și nici vârsta), și doar celor din gașcă.
create or replace function public.crew_has_minor(p_crew uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when private.crew_status(p_crew, (select auth.uid())) is null then null else exists (
    select 1 from public.crew_members m join public.profile_private pp on pp.id = m.user_id
    where m.crew_id = p_crew and pp.birth_date > (current_date - interval '18 years')
  ) end
$$;
revoke all on function public.crew_has_minor(uuid) from public;
grant execute on function public.crew_has_minor(uuid) to authenticated;

-- id-urile locurilor adăugate din cercetare pot avea până la 42 de caractere („c-calea-victoriei-pietonala-…”)
alter table public.venues drop constraint if exists venues_id_check;
alter table public.venues add constraint venues_id_check check (char_length(id) <= 80);
alter table public.reports drop constraint if exists reports_venue_id_check;
alter table public.reports add constraint reports_venue_id_check check (char_length(venue_id) <= 80);
