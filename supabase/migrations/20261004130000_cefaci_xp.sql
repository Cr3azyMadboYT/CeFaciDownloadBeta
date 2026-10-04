-- XP is counted on the server (decision Cornel, 04.10): the phone asks, the server checks and writes the points.
-- check-in +100 (at the place, at most once per place per day), new place +50, new kind of outing +75,
-- receipt +25 (written by the citeste-bon function, only after a check-in there), welcome +150 once.
-- profiles.xp and profiles.stamps follow the log; nobody can change them by hand.

-- the places the app knows (from OpenStreetMap), to check where a check-in happened
create table public.venues (
  id text primary key check (char_length(id) <= 40),
  name text not null,
  cat text not null,
  lat double precision not null,
  lon double precision not null,
  updated_at timestamptz not null default now()
);
alter table public.venues enable row level security;
create policy venues_read on public.venues for select to authenticated using (true);

create table public.xp_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'checkin', 'new_place', 'new_kind', 'bill', 'carry')),
  venue_id text,
  cat text,
  amount int not null check (amount between 0 and 100000),
  day date not null default (now() at time zone 'Europe/Bucharest')::date,
  created_at timestamptz not null default now()
);
create index xp_log_user on public.xp_log (user_id, created_at desc);
create unique index xp_one_welcome on public.xp_log (user_id) where kind = 'welcome';
create unique index xp_one_carry on public.xp_log (user_id) where kind = 'carry';
create unique index xp_one_checkin on public.xp_log (user_id, venue_id, day) where kind = 'checkin';
create unique index xp_one_bill on public.xp_log (user_id, venue_id, day) where kind = 'bill';
alter table public.xp_log enable row level security;
create policy xp_log_own on public.xp_log for select to authenticated using (user_id = (select auth.uid()));
-- no insert/update/delete policy: only the functions below (and the receipt function, as the service) write here

-- profiles.xp / stamps: only the log changes them
create or replace function private.profiles_xp_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('cefaci.xp', true), '') <> 'on' then
    new.xp := old.xp;
    new.stamps := old.stamps;
  end if;
  return new;
end $$;
create trigger profiles_xp_guard before update on public.profiles for each row execute function private.profiles_xp_guard();

create or replace function private.xp_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('cefaci.xp', 'on', true);
  update public.profiles set
    xp = (select coalesce(sum(amount), 0) from public.xp_log where user_id = new.user_id),
    stamps = (select count(distinct venue_id) from public.xp_log where user_id = new.user_id and kind = 'checkin')
  where id = new.user_id;
  perform set_config('cefaci.xp', 'off', true);
  return new;
end $$;
create trigger xp_follow after insert on public.xp_log for each row execute function private.xp_follow();

create or replace function private.km(a_lat double precision, a_lon double precision, b_lat double precision, b_lon double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 12742 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
         + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lon - a_lon) / 2), 2)))
$$;

-- Bilu's welcome, once per account. Returns the total XP.
create or replace function public.xp_welcome() returns int
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  insert into public.xp_log (user_id, kind, amount) values (me, 'welcome', 150) on conflict do nothing;
  return (select xp from public.profiles where id = me);
end $$;

-- "Sunt aici": the phone sends where it is; the server checks it is at the place and writes the XP.
-- The place's position comes from public.venues; a place newer than that table uses the position the app knows.
create or replace function public.xp_check_in(p_venue text, p_lat double precision, p_lon double precision, p_acc double precision,
                                              p_cat text default null, p_vlat double precision default null, p_vlon double precision default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); v public.venues; vlat double precision; vlon double precision; c text; d double precision;
  today date := (now() at time zone 'Europe/Bucharest')::date; gain int := 0; np boolean; nk boolean;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  select * into v from public.venues where id = p_venue;
  vlat := coalesce(v.lat, p_vlat); vlon := coalesce(v.lon, p_vlon); c := coalesce(v.cat, p_cat);
  if vlat is null or vlon is null or c is null then raise exception 'Nu știm unde e localul ăsta.' using errcode = 'no_data_found'; end if;
  d := private.km(p_lat, p_lon, vlat, vlon) * 1000;
  if d > 250 + least(greatest(coalesce(p_acc, 0), 0), 150) then
    raise exception 'departe:%', round(d)::int using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.xp_log where user_id = me and kind = 'checkin' and venue_id = p_venue and day = today) then
    return jsonb_build_object('gain', 0, 'again', true, 'total', (select xp from public.profiles where id = me));
  end if;
  if (select count(*) from public.xp_log where user_id = me and kind = 'checkin' and day = today) >= 6 then
    raise exception 'Ai făcut destule check-in-uri azi. Mâine mai poți.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.xp_log where user_id = me and kind = 'checkin' and created_at > now() - interval '20 minutes') then
    raise exception 'Abia ai făcut check-in în altă parte. Mai încearcă în câteva minute.' using errcode = 'check_violation';
  end if;
  np := not exists (select 1 from public.xp_log where user_id = me and kind = 'checkin' and venue_id = p_venue);
  nk := not exists (select 1 from public.xp_log where user_id = me and kind = 'checkin' and cat = c);
  insert into public.xp_log (user_id, kind, venue_id, cat, amount) values (me, 'checkin', p_venue, c, 100);
  gain := 100;
  if np then insert into public.xp_log (user_id, kind, venue_id, cat, amount) values (me, 'new_place', p_venue, c, 50); gain := gain + 50; end if;
  if nk then insert into public.xp_log (user_id, kind, venue_id, cat, amount) values (me, 'new_kind', p_venue, c, 75); gain := gain + 75; end if;
  return jsonb_build_object('gain', gain, 'new_place', np, 'new_kind', nk, 'total', (select xp from public.profiles where id = me));
end $$;

-- The receipt's +25, called by the citeste-bon function (service role) for the signed-in person after the
-- receipt was read: only after a check-in at that place on the receipt's day or the day before, once.
create or replace function public.xp_bill(p_user uuid, p_venue text, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  select exists (select 1 from public.xp_log where user_id = p_user and kind = 'checkin' and venue_id = p_venue and day between p_day - 1 and p_day) into ok;
  if not ok then return jsonb_build_object('gain', 0, 'error', 'Fă întâi check-in la local, apoi pune bonul.'); end if;
  insert into public.xp_log (user_id, kind, venue_id, amount, day) values (p_user, 'bill', p_venue, 25, p_day) on conflict do nothing;
  if not found then return jsonb_build_object('gain', 0, 'error', 'Bonul de la locul ăsta e deja pus.'); end if;
  return jsonb_build_object('gain', 25, 'total', (select xp from public.profiles where id = p_user));
end $$;

revoke all on function public.xp_welcome(), public.xp_check_in(text, double precision, double precision, double precision, text, double precision, double precision),
  public.xp_bill(uuid, text, date) from public, anon;
grant execute on function public.xp_welcome(), public.xp_check_in(text, double precision, double precision, double precision, text, double precision, double precision) to authenticated;
-- xp_bill: only the service (the receipt function), never the app directly
revoke all on function public.xp_bill(uuid, text, date) from authenticated;

-- the XP people already had on their phone before this (their saved state) carries over, once
insert into public.xp_log (user_id, kind, amount)
select p.id, 'carry', least((pp.app_state->>'xp')::int, 100000)
from public.profiles p join public.profile_private pp on pp.id = p.id
where (pp.app_state->>'xp') ~ '^\d+$' and (pp.app_state->>'xp')::int > 0
on conflict do nothing;
