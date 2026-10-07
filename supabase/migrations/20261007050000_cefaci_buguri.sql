-- Buguri găsite la verificare (07.10):
--   * check-in după miezul nopții (un pas de la 23:30 la care ajungi la 00:15): bonul pus pe ziua serii nu-l găsea;
--   * votul pe o seară întreagă („Cină și bar: A → B → C”) primea numele primului loc, iar două variante care încep la
--     același restaurant arătau la fel.
create or replace function public.xp_bill_ready(p_user uuid, p_venue text, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'Europe/Bucharest')::date;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  if p_day is null or p_day > today or p_day < today - 2 then return jsonb_build_object('ok', false, 'error', 'Bonul se poate pune până a doua zi seara.'); end if;
  if not exists (select 1 from public.xp_log where user_id = p_user and kind = 'checkin' and venue_id = p_venue and day between p_day - 1 and p_day + 1) then
    return jsonb_build_object('ok', false, 'error', 'Fă întâi check-in la local, apoi pune bonul.'); end if;
  if exists (select 1 from public.xp_log where user_id = p_user and kind = 'bill' and venue_id = p_venue and day between p_day - 1 and p_day + 1) then
    return jsonb_build_object('ok', false, 'error', 'Bonul de la locul ăsta e deja pus.'); end if;
  if not public.api_quota(p_user, 'bon', 1) then return jsonb_build_object('ok', false, 'error', 'Ai trimis destule poze azi. Mâine mai poți.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.xp_bill(p_user uuid, p_venue text, p_day date, p_receipt text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare fp text;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  if coalesce(p_receipt, '') = '' then return jsonb_build_object('gain', 0, 'error', 'Nu se vede tot bonul.'); end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.bill.' || p_user::text));
  if not exists (select 1 from public.xp_log where user_id = p_user and kind = 'checkin' and venue_id = p_venue and day between p_day - 1 and p_day + 1) then
    return jsonb_build_object('gain', 0, 'error', 'Fă întâi check-in la local, apoi pune bonul.'); end if;
  if exists (select 1 from public.xp_log where user_id = p_user and kind = 'bill' and venue_id = p_venue and day between p_day - 1 and p_day + 1) then
    return jsonb_build_object('gain', 0, 'error', 'Bonul de la locul ăsta e deja pus.'); end if;
  fp := encode(sha256(convert_to('cefaci.bon:' || lower(p_receipt), 'UTF8')), 'hex');
  insert into private.receipts_seen (fp, user_id) values (fp, p_user) on conflict do nothing;
  if not found then return jsonb_build_object('gain', 0, 'error', 'Bonul ăsta a fost deja pus.'); end if;
  insert into public.xp_log (user_id, kind, venue_id, amount, day) values (p_user, 'bill', p_venue, 25, p_day) on conflict do nothing;
  if not found then return jsonb_build_object('gain', 0, 'error', 'Bonul de la locul ăsta e deja pus.'); end if;
  return jsonb_build_object('gain', 25, 'total', (select xp from public.profiles where id = p_user));
end $$;

create or replace function public.start_vote(p_crew uuid, p_friends uuid[], p_options jsonb, p_closes_at timestamptz, p_title text default 'Unde mergem?')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s uuid; o jsonb; i int := 0; f uuid; n text;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  if jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options) < 2 then raise exception 'Votul are nevoie de cel puțin 2 variante.' using errcode = 'check_violation'; end if;
  if jsonb_array_length(p_options) > 10 then raise exception 'Votul are cel mult 10 variante.' using errcode = 'check_violation'; end if;
  if coalesce(array_length(p_friends, 1), 0) > 30 then raise exception 'Prea mulți oameni la vot.' using errcode = 'check_violation'; end if;
  if p_closes_at <= now() or p_closes_at > now() + interval '7 days' then raise exception 'Termenul votului nu e bun.' using errcode = 'check_violation'; end if;
  if private.rude(p_title) then raise exception 'Te rog alege alt nume, acesta nu prea pare potrivit.' using errcode = 'check_violation'; end if;
  if p_crew is not null and private.crew_status(p_crew, me) is distinct from 'member' then
    raise exception 'Nu ești în gașca asta.' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.vote_sessions where created_by = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Ai pornit destule voturi azi. Mâine mai poți.' using errcode = 'check_violation'; end if;
  insert into public.vote_sessions (created_by, crew_id, title, closes_at) values (me, p_crew, coalesce(nullif(trim(p_title), ''), 'Unde mergem?'), p_closes_at) returning id into s;
  insert into public.vote_voters (session_id, user_id) values (s, me);
  if p_crew is not null then
    insert into public.vote_voters (session_id, user_id)
    select s, user_id from public.crew_members where crew_id = p_crew and status = 'member' on conflict do nothing;
  end if;
  foreach f in array coalesce(p_friends, '{}') loop
    if not private.is_friend(me, f) then raise exception 'Poți chema la vot doar prieteni.' using errcode = 'insufficient_privilege'; end if;
    insert into public.vote_voters (session_id, user_id) values (s, f) on conflict do nothing;
  end loop;
  for o in select * from jsonb_array_elements(p_options) loop
    -- o seară întreagă (details.route) își păstrează numele („Cină și bar: A → B”), verificat; un loc ia numele lui
    if jsonb_typeof(o->'details'->'route') = 'array' then n := left(o->>'venue_name', 120);
    else select coalesce(edit->>'name', name) into n from public.venues where id = o->>'venue_id'; n := coalesce(n, left(o->>'venue_name', 120)); end if;
    if n is null or private.rude(n) then raise exception 'Te rog alege alt nume, acesta nu prea pare potrivit.' using errcode = 'check_violation'; end if;
    insert into public.vote_options (session_id, venue_id, venue_name, details, position)
    values (s, left(o->>'venue_id', 80), n, case when pg_column_size(o->'details') <= 4000 then coalesce(o->'details', '{}'::jsonb) else '{}'::jsonb end, i);
    i := i + 1;
  end loop;
  return s;
end $$;
