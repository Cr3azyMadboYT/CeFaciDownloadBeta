-- Forward-only hardening. Public RPC signatures remain compatible.
create or replace function private.profiles_xp_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  if coalesce(current_setting('cefaci.xp', true), '') <> 'on' then
    new.xp := old.xp; new.stamps := old.stamps;
  end if;
  return new;
end $$;

-- The original timestamp is not a trust signal: Auth is the server authority.
create or replace function public.reservation_request(p_venue text, p_at timestamptz, p_people int, p_kids int default 0, p_note text default null)
returns public.reservations
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pr public.partners; r public.reservations;
begin
  if me is null then raise exception 'Intră în cont ca să rezervi.'; end if;
  select * into pr from public.partners where venue_id = p_venue;
  if pr.venue_id is null or pr.status <> 'activ' or not pr.reservations_on then raise exception 'Localul nu primește acum rezervări prin CeFaci.'; end if;
  if p_at < now() + interval '15 minutes' or p_at > now() + interval '30 days' then raise exception 'Alege o oră de peste cel puțin 15 minute, în următoarele 30 de zile.'; end if;
  if p_people not between 1 and 20 or coalesce(p_kids, 0) not between 0 and 10 then raise exception 'Numărul de oameni nu e bun.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.res.' || me::text));   -- două cereri trimise deodată nu ocolesc limita
  if (select count(*) from public.reservations where user_id = me and created_at > now() - interval '1 day') >= 4 then
    raise exception 'Ai făcut destule rezervări azi. Mâine mai poți.'; end if;
  if (select count(*) from public.reservations where user_id = me and at > now() and status in ('cerută', 'confirmată')) >= 2 then
    raise exception 'Ai deja 2 rezervări care urmează. Anulează una ca să faci alta.'; end if;
  insert into public.reservations (venue_id, user_id, people, kids, at, note, status)
  values (p_venue, me, p_people, coalesce(p_kids, 0), p_at, nullif(trim(p_note), ''),
          -- confirmată singură doar pentru conturi cunoscute (de cel puțin 7 zile sau cu o vizită adevărată): conturile noi,
          -- făcute pe bandă, nu pot ocupa mesele fără ca localul să vadă cererea
          case when p_people + coalesce(p_kids, 0) <= pr.auto_confirm_max and p_people < 8
                    and ((select created_at from auth.users where id = me) < now() - interval '7 days'
                         or exists (select 1 from public.visits where user_id = me and outcome = 'a venit'))
               then 'confirmată' else 'cerută' end)
  returning * into r;
  return r;
end $$;

alter policy drops_read on public.drops using (
  stopped_at is null and ends_at > now() and starts_at < now() + interval '12 hours'
  and (not adult or coalesce(private.age((select auth.uid())), 0) >= 18)
);

-- Immutable request history survives deleting the friendship row.
create table private.friend_request_events (
  requester uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index friend_request_events_user_time on private.friend_request_events(requester, requested_at);
alter table private.friend_request_events enable row level security;
revoke all on private.friend_request_events from public, anon, authenticated;
insert into private.friend_request_events(requester, requested_at)
select requester, created_at from public.friendships where created_at > now() - interval '1 day';
create or replace function private.friend_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('cefaci.friend.' || new.requester::text));
  delete from private.friend_request_events where requester = new.requester and requested_at <= now() - interval '1 day';
  new.status := 'pending'; new.accepted_at := null; new.created_at := now();
  if (select count(*) from public.friendships where requester = new.requester and status = 'pending') >= 30
     or (select count(*) from private.friend_request_events where requester = new.requester and requested_at > now() - interval '1 day') >= 40 then
    raise exception 'Ai trimis destule cereri de prietenie. Mai încearcă mâine.' using errcode = 'check_violation';
  end if;
  insert into private.friend_request_events(requester) values (new.requester);
  return new;
end $$;

create or replace function public.biz_my_venues() returns table (venue_id text, name text, role text, status text, founder boolean, rate numeric, free_until date)
language sql stable security definer set search_path = '' as $$
  select m.venue_id, coalesce(v.edit->>'name', v.name), m.role, p.status, case when m.role in ('proprietar','manager') then p.founder end, case when m.role in ('proprietar','manager') then p.rate end, case when m.role in ('proprietar','manager') then p.free_until end
  from public.partner_members m join public.partners p on p.venue_id = m.venue_id left join public.venues v on v.id = m.venue_id
  where m.user_id = (select auth.uid()) and m.active order by 2
$$;


create or replace function public.biz_today(p_venue text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text := private.member_role(p_venue); today date := private.work_day(now());
begin
  if role is null then raise exception 'Nu ești în echipa localului.'; end if;
  return jsonb_build_object(
    'role', role, 'day', today, 'word', private.day_word(p_venue, today),
    'token', case when role in ('proprietar', 'manager') then (select token from public.venue_codes where venue_id = p_venue) end,
    'partner', (select jsonb_build_object('venue_id',p.venue_id,'status',p.status,'reservations_on',p.reservations_on,'auto_confirm_max',p.auto_confirm_max,'plus_pct',p.plus_pct)
      || case when role = 'proprietar' then jsonb_build_object('firm',p.firm,'cui',p.cui) else '{}'::jsonb end
      || case when role in ('proprietar','manager') then jsonb_build_object('founder',p.founder,'rate',p.rate,'free_until',p.free_until) else '{}'::jsonb end from public.partners p where venue_id = p_venue),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', pr.first_name, 'people', r.people, 'kids', r.kids, 'at', r.at, 'status', r.status, 'note', r.note) order by r.at)
       from public.reservations r left join public.profiles pr on pr.id = r.user_id
       where role <> 'scanare' and r.venue_id = p_venue and r.at > now() - interval '3 hours' and r.at < now() + interval '30 days' and r.status in ('cerută', 'confirmată')), '[]'),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', pr.first_name, 'kind', x.kind, 'people', x.people, 'table', x.table_no,
         'discount', x.discount_pct, 'plus', x.plus, 'at', x.scanned_at, 'outcome', x.outcome, 'bill', case when role in ('proprietar','manager') then x.bill end, 'source', case when role in ('proprietar','manager') then x.bill_source end, 'day', x.work_day) order by x.scanned_at)
       from public.visits x left join public.profiles pr on pr.id = x.user_id
       where x.venue_id = p_venue and x.work_day between today - 1 and today), '[]'),
    'noshow', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', pr.first_name, 'people', r.people, 'at', r.at))
       from public.reservations r left join public.profiles pr on pr.id = r.user_id
       where role <> 'scanare' and r.venue_id = p_venue and r.status = 'confirmată' and r.at between now() - interval '30 hours' and now() - interval '3 hours'
         and not exists (select 1 from public.visits x where x.reservation_id = r.id)), '[]'),
    'drops', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'pct_all', d.pct_all, 'pct_plus', d.pct_plus, 'seats', d.seats,
         'taken', (select coalesce(sum(seats), 0) from public.drop_claims c where c.drop_id = d.id and (c.status = 'folosit' or (c.status = 'activ' and c.expires_at > now()))),
         'starts_at', d.starts_at, 'ends_at', d.ends_at, 'adult', d.adult, 'new_only', d.new_only) order by d.starts_at)
       from public.drops d where role in ('proprietar','manager') and d.venue_id = p_venue and d.stopped_at is null and d.ends_at > now()), '[]')
  );
end $$;

create or replace function public.drop_claim(p_drop uuid, p_seats int) returns public.drop_claims
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); d public.drops; taken int; c public.drop_claims; plus boolean := private.plus_active(me);
begin
  if me is null then raise exception 'Intră în cont ca să iei oferta.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.claim.' || me::text)); -- o singură ofertă odată, chiar trimisă deodată
  if (select count(*) from public.drop_claims c2 where c2.user_id = me and c2.status = 'activ' and c2.expires_at < now()
        and c2.created_at > now() - interval '7 days') >= 2 then
    raise exception 'Ai lăsat 2 oferte să expire săptămâna asta. Mai poți lua peste câteva zile.'; end if;
  select * into d from public.drops where id = p_drop for update;   -- un singur om ia ultimele locuri
  if d.id is null or d.stopped_at is not null or now() >= d.ends_at - interval '15 minutes' then raise exception 'Oferta s-a terminat.'; end if;
  if now() < d.starts_at - (case when plus then interval '10 minutes' else interval '0' end) then raise exception 'Oferta nu a început încă.'; end if;
  if now() < d.starts_at + interval '10 minutes' and d.starts_at > d.created_at + interval '1 minute' and not plus then
    raise exception 'Primele 10 minute oferta e doar pentru Plus.'; end if;
  if (select status from public.partners where venue_id = d.venue_id) <> 'activ' then raise exception 'Localul nu are oferte acum.'; end if;
  if exists (select 1 from public.partner_members where venue_id = d.venue_id and user_id = me and active) then raise exception 'Echipa localului nu poate lua propriile oferte.'; end if;
  if p_seats is null or p_seats not between greatest(1, d.min_group) and 6 then raise exception 'Oferta e pentru cel puțin % și cel mult 6 oameni.', greatest(1, d.min_group); end if;
  if d.adult and coalesce(private.age(me), 0) < 18 then raise exception 'Oferta e doar de la 18 ani.'; end if;
  if exists (select 1 from public.drop_claims c2 join public.drops d2 on d2.id = c2.drop_id
             where c2.user_id = me and c2.status = 'activ' and c2.expires_at > now()) then raise exception 'Ai deja o ofertă luată. Folosește-o sau las-o să expire.'; end if;
  if exists (select 1 from public.visits where user_id = me and venue_id = d.venue_id and work_day = private.work_day(now())) then
    raise exception 'Ești deja la local azi: oferta e pentru cei care vin.'; end if;
  if d.new_only and exists (select 1 from public.visits where user_id = me and venue_id = d.venue_id and scanned_at > now() - interval '12 months') then
    raise exception 'Oferta e doar pentru cei care vin prima dată prin CeFaci.'; end if;
  select coalesce(sum(seats), 0) into taken from public.drop_claims
  where drop_id = p_drop and (status = 'folosit' or (status = 'activ' and expires_at > now()));
  if taken + p_seats > d.seats then raise exception 'Mai sunt doar % locuri.', greatest(0, d.seats - taken); end if;
  insert into public.drop_claims (drop_id, user_id, seats, expires_at)
  values (p_drop, me, p_seats, least(now() + interval '45 minutes', d.ends_at + interval '15 minutes'))
  returning * into c;
  return c;
end $$;

create or replace function public.visit_scan(p_token text, p_lat double precision, p_lon double precision, p_table text default null, p_people int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v text; pr public.partners; today date := private.work_day(now());
        x public.visits; r public.reservations; c public.drop_claims; d public.drops; plus boolean; vname text; pos public.venues;
begin
  if me is null then raise exception 'Intră în cont ca să scanezi.'; end if;
  select venue_id into v from public.venue_codes where token = trim(p_token);
  if v is null then raise exception 'Codul nu e al unui local CeFaci.'; end if;
  select * into pos from public.venues where id = v;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 or pos.id is null or private.km(p_lat, p_lon, pos.lat, pos.lon) > 0.3 then
    raise exception 'Scanează codul când ești la local (pornește locația).'; end if;
  select * into pr from public.partners where venue_id = v;
  if pr.status = 'iesit' then raise exception 'Localul nu mai e partener CeFaci.'; end if;
  if p_people is not null and p_people not between 1 and 30 then raise exception 'Numărul de oameni nu e bun.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.scan.' || me::text || v));
  plus := private.plus_active(me);
  select * into x from public.visits where user_id = me and venue_id = v and work_day = today;
  if x.id is null then
    select * into r from public.reservations where user_id = me and venue_id = v and status = 'confirmată'
      and now() between at - interval '90 minutes' and at + interval '3 hours' order by at limit 1;
    if r.id is null then
      select c2.* into c from public.drop_claims c2 join public.drops d2 on d2.id = c2.drop_id
      where c2.user_id = me and d2.venue_id = v and c2.status = 'activ' and c2.expires_at > now() limit 1 for update of c2;
    end if;
    if c.id is not null then
      select * into d from public.drops where id = c.drop_id;
      if now() < c.created_at + interval '10 minutes' then raise exception 'Oferta se poate folosi după cel puțin 10 minute de la luare.'; end if;
      if coalesce(p_people, c.seats) < d.min_group then
        raise exception 'Grupul nu îndeplinește oferta. Revino când sunteți suficienți.';
      else
        update public.drop_claims set status = 'folosit', seats = least(seats, coalesce(p_people, seats)) where id = c.id returning * into c;
      end if;
    end if;
    insert into public.visits (venue_id, user_id, kind, reservation_id, claim_id, people, table_no, discount_pct, plus, work_day)
    values (v, me,
            case when r.id is not null then 'rezervare' when c.id is not null then 'drop' when plus and pr.plus_pct is not null then 'plus' else 'plan' end,
            r.id, c.id,
            greatest(1, least(30, coalesce(p_people, r.people, c.seats, 1))), nullif(trim(p_table), ''),
            case when c.id is not null then floor((case when plus then d.pct_plus else d.pct_all end) * least(c.seats, coalesce(p_people, c.seats))::numeric / coalesce(p_people, c.seats))::int
                 when plus and pr.plus_pct is not null then pr.plus_pct else 0 end,
            plus, today)
    returning * into x;
  elsif (p_table is not null or p_people is not null) and x.closed_at is null then
    if x.claim_id is not null then
      select * into c from public.drop_claims where id = x.claim_id;
      select * into d from public.drops where id = c.drop_id;
      if coalesce(p_people, x.people) < d.min_group then raise exception 'Grupul nu îndeplinește oferta.'; end if;
    end if;
    update public.visits set table_no = coalesce(nullif(trim(p_table), ''), table_no), people = greatest(1, least(30, coalesce(p_people, people))),
      discount_pct = case when x.claim_id is not null then floor((case when x.plus then d.pct_plus else d.pct_all end) * least(c.seats, coalesce(p_people, x.people))::numeric / coalesce(p_people, x.people))::int else discount_pct end
    where id = x.id returning * into x;
  end if;
  select coalesce(edit->>'name', name) into vname from public.venues where id = v;
  return jsonb_build_object('visit', x.id, 'venue', v, 'name', vname, 'word', private.day_word(v, today), 'kind', x.kind,
    'discount', x.discount_pct, 'plus', x.plus, 'people', x.people, 'table', x.table_no,
    'offer', case when x.kind = 'drop' then (select title from public.drops where id = (select drop_id from public.drop_claims where id = x.claim_id)) end);
end $$;

-- Internal word helper is not an independently callable API.
revoke all on function private.day_word(text, date), private.friend_limit(), private.profiles_xp_guard()
from public, anon, authenticated;
notify pgrst, 'reload schema';
