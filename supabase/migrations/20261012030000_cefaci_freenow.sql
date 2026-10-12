-- FreeNow (Cornel, 12.10): „Intră pe FreeNow ⚡” = ai timp de ieșit acum (sau de la o oră, azi) și le dai de veste.
-- Te văd: prietenii tăi, prietenii prietenilor (doar 2 pași: eu–Mihai–Andrei, nu și Gabi, prietenul lui Andrei),
-- o gașcă aleasă sau câțiva prieteni aleși. Cine vrea apasă „Vin și eu” și intră în ieșirea ta (2–10 oameni);
-- Bilu propune 3 locuri, votați 15 minute, planul ajunge pe biletul fiecăruia.
-- Reguli:
--   * se stinge singur (ends_at); cel târziu la 05:00 (ziua aplicației); sub 18 cel târziu la 23:00;
--   * sub 18: doar prietenii direcți (sau gașca) îl văd și doar pe ei îi vede; prietenii prietenilor nu trec printr-un minor;
--     într-o ieșire cu cineva sub 18 intră doar prietenii lui;
--   * cel mult 3 intrări pe FreeNow pe zi; notificări: cel mult 3 pe zi pentru un om, 1 pe zi de la același om, nimic 02–09;
--   * „Nu mai vreau să aflu de la X” și oprirea tuturor (free_mute), fără ca celălalt să afle;
--   * nicio poziție: doar zona aleasă de om (sector / oraș), opțional;
--   * totul se scrie doar prin funcțiile de mai jos (tabelele n-au reguli de scriere), deci nimeni nu-și mută rândul pe altcineva.
-- Fără ștergeri: oprirea pune ends_at = acum, plecarea din ieșire pune left_at.

create table public.free_now (
  id uuid primary key default gen_random_uuid(),            -- se schimbă la fiecare intrare nouă (notificările o dată pe intrare)
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  moods text[] not null default '{}',
  audience text not null default 'friends' check (audience in ('friends', 'fof', 'crew', 'pick')),
  crew_id uuid references public.crews (id) on delete set null,
  picked uuid[] not null default '{}',
  zone text check (char_length(zone) <= 40),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.free_now enable row level security;
create policy free_now_own_read on public.free_now for select to authenticated using (user_id = (select auth.uid()));
comment on table public.free_now is 'FreeNow: cine are timp de ieșit. Ceilalți îl văd doar prin free_now_list (vizibilitatea din private.free_sees).';

create table public.free_outings (
  id uuid primary key default gen_random_uuid(),
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  open boolean not null default true,                       -- „Mai poate veni lume”
  ends_at timestamptz not null,
  vote_id uuid references public.vote_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  changed_at timestamptz not null default now()             -- telefonul ascultă schimbarea și reîncarcă
);
create table public.free_outing_members (
  id uuid not null unique default gen_random_uuid(),        -- ref-ul notificării „X iese cu voi”
  outing_id uuid not null references public.free_outings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (outing_id, user_id)
);
create index free_outing_members_user on public.free_outing_members (user_id);
alter table public.free_outings enable row level security;
alter table public.free_outing_members enable row level security;

create table public.free_mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted uuid not null references public.profiles (id) on delete cascade,  -- = user_id: toate notificările FreeNow oprite
  active boolean not null default true,
  primary key (user_id, muted)
);
alter table public.free_mutes enable row level security;
create policy free_mutes_own_read on public.free_mutes for select to authenticated using (user_id = (select auth.uid()));

create table private.free_starts (user_id uuid not null, day date not null, n int not null default 0, primary key (user_id, day));
create table private.free_pushes (receiver uuid not null, sender uuid not null, day date not null, at timestamptz not null default now(),
  primary key (receiver, sender, day));
alter table private.free_starts enable row level security;
alter table private.free_pushes enable row level security;

-- ---------- ajutoare ----------
create or replace function private.free_day() returns date
language sql stable set search_path = '' as $$ select ((now() at time zone 'Europe/Bucharest') - interval '5 hours')::date $$;

create or replace function private.free_minor(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(private.age(u), 0) < 18 $$;

create or replace function private.friends_of(u uuid) returns table (f uuid)
language sql stable security definer set search_path = '' as $$
  select case when requester = u then addressee else requester end from public.friendships
   where status = 'accepted' and u in (requester, addressee)
$$;

-- un prieten comun, major, prin care b îl vede pe a (prietenii prietenilor)
create or replace function private.free_via(a uuid, b uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select x.f from private.friends_of(a) x join private.friends_of(b) y on y.f = x.f
   where x.f <> a and x.f <> b and not private.free_minor(x.f) order by x.f limit 1
$$;

create or replace function private.free_sees(v uuid, r public.free_now) returns boolean
language sql stable security definer set search_path = '' as $$
  select v is not null and r.user_id is not null and v <> r.user_id and r.ends_at > now() and case r.audience
    when 'friends' then private.is_friend(r.user_id, v)
    when 'pick' then v = any (r.picked) and private.is_friend(r.user_id, v)
    when 'crew' then r.crew_id is not null and private.crew_status(r.crew_id, v) = 'member' and private.crew_status(r.crew_id, r.user_id) = 'member'
    when 'fof' then private.is_friend(r.user_id, v) or (not private.free_minor(v) and not private.free_minor(r.user_id)
                    and private.free_via(r.user_id, v) is not null)
    else false end
$$;

-- ieșirea deschisă în care e omul acum
create or replace function private.free_outing_of(u uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select o.id from public.free_outing_members m join public.free_outings o on o.id = m.outing_id
   where m.user_id = u and m.left_at is null and o.status = 'open' and o.ends_at > now()
   order by m.joined_at desc limit 1
$$;

create or replace function private.free_in(o uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.free_outing_members where outing_id = o and user_id = u and left_at is null)
$$;
create policy free_outings_members_read on public.free_outings for select to authenticated using (private.free_in(id, (select auth.uid())));
create policy free_outing_members_read on public.free_outing_members for select to authenticated using (private.free_in(outing_id, (select auth.uid())));

-- o notificare FreeNow poate pleca? (oprit de el, oră de liniște, 3 pe zi, 1 pe zi de la același om)
create or replace function private.free_push_ok(r uuid, s uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare h int := extract(hour from now() at time zone 'Europe/Bucharest'); d date := private.free_day();
begin
  if h >= 2 and h < 9 then return false; end if;
  if exists (select 1 from public.free_mutes where user_id = r and muted in (r, s) and active) then return false; end if;
  if (select count(*) from private.free_pushes where receiver = r and day = d) >= 3 then return false; end if;
  insert into private.free_pushes (receiver, sender, day) values (r, s, d) on conflict do nothing;
  return found;
end $$;

create or replace function private.free_touch(o uuid) returns void
language sql security definer set search_path = '' as $$ update public.free_outings set changed_at = now() where id = o $$;

-- planul ieșirii (după vot)
create or replace function private.free_plan(o uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.plan_id from public.free_outings x join public.vote_sessions s on s.id = x.vote_id where x.id = o
$$;

create or replace function private.free_leave_outing(u uuid, o uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; rest uuid; p uuid := private.free_plan(o);
begin
  update public.free_outing_members set left_at = now() where outing_id = o and user_id = u and left_at is null;
  if not found then return; end if;
  if p is not null then update public.plan_members set answer = 'nu_pot' where plan_id = p and user_id = u; end if;
  select count(*) into n from public.free_outing_members where outing_id = o and left_at is null;
  if n < 2 then
    update public.free_outings set status = 'closed', changed_at = now() where id = o;
    for rest in select user_id from public.free_outing_members where outing_id = o and left_at is null loop
      perform private.push('free_left', o, rest);
    end loop;
  else
    update public.free_outings set host = (select user_id from public.free_outing_members where outing_id = o and left_at is null order by joined_at limit 1),
      changed_at = now() where id = o and host = u;
    perform private.free_touch(o);
  end if;
end $$;

-- ---------- ce face telefonul ----------

-- Intră pe FreeNow (sau schimbă: +1 oră, alt chef, alt public). Dacă e deja pornit, se schimbă fără notificări noi.
create or replace function public.free_now_set(p_ends_at timestamptz, p_starts_at timestamptz default null, p_moods text[] default '{}',
  p_audience text default 'friends', p_crew uuid default null, p_picked uuid[] default '{}', p_zone text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); d date := private.free_day(); st timestamptz; en timestamptz; lim timestamptz; cur public.free_now;
  r public.free_now; v uuid; notified int := 0; others int; z text; m text; minor boolean;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  minor := private.free_minor(me);
  st := greatest(coalesce(p_starts_at, now()), now());
  lim := ((d + 1) + time '05:00') at time zone 'Europe/Bucharest';
  if minor then lim := least(lim, (d + time '23:00') at time zone 'Europe/Bucharest'); end if;
  if st >= lim - interval '15 minutes' then
    raise exception '%', case when minor then 'Pe FreeNow poți intra până la 23:00.' else 'E prea târziu pentru azi. Mâine mai poți.' end using errcode = 'check_violation'; end if;
  en := least(coalesce(p_ends_at, st + interval '2 hours'), lim, st + interval '12 hours');
  if en < st + interval '15 minutes' then raise exception 'Alege cât timp ai.' using errcode = 'check_violation'; end if;
  if coalesce(array_length(p_moods, 1), 0) > 2 then raise exception 'Alege cel mult 2.' using errcode = 'check_violation'; end if;
  foreach m in array coalesce(p_moods, '{}') loop
    if m not in ('orice', 'mancare', 'pahar', 'cafea', 'film', 'plimbare', 'joaca', 'desert') then
      raise exception 'Nu știu ce chef e ăsta.' using errcode = 'check_violation'; end if;
  end loop;
  if p_audience not in ('friends', 'fof', 'crew', 'pick') then raise exception 'Alege cine te vede.' using errcode = 'check_violation'; end if;
  if p_audience = 'crew' and (p_crew is null or private.crew_status(p_crew, me) is distinct from 'member') then
    raise exception 'Nu ești în gașca asta.' using errcode = 'insufficient_privilege'; end if;
  if p_audience = 'pick' then
    if coalesce(array_length(p_picked, 1), 0) = 0 or array_length(p_picked, 1) > 50 then raise exception 'Alege pe cine anunți.' using errcode = 'check_violation'; end if;
    if exists (select 1 from unnest(p_picked) x where not private.is_friend(me, x)) then
      raise exception 'Poți anunța doar prieteni.' using errcode = 'insufficient_privilege'; end if;
  end if;
  z := nullif(left(regexp_replace(btrim(coalesce(p_zone, '')), '[[:cntrl:]<>]', '', 'g'), 40), '');

  select * into cur from public.free_now where user_id = me for update;
  if found and cur.ends_at > now() then
    update public.free_now set starts_at = least(cur.starts_at, st), ends_at = en, moods = coalesce(p_moods, '{}'), audience = p_audience,
      crew_id = case when p_audience = 'crew' then p_crew end, picked = case when p_audience = 'pick' then p_picked else '{}' end, zone = z
     where user_id = me returning * into r;
    update public.free_outings set ends_at = greatest(ends_at, en), changed_at = now() where id = private.free_outing_of(me);
  else
    insert into private.free_starts (user_id, day, n) values (me, d, 1)
      on conflict (user_id, day) do update set n = private.free_starts.n + 1 returning n into others;
    if others > 3 then raise exception 'Ai intrat de 3 ori pe FreeNow azi. Mâine mai poți.' using errcode = 'check_violation'; end if;
    insert into public.free_now (user_id, starts_at, ends_at, moods, audience, crew_id, picked, zone)
    values (me, st, en, coalesce(p_moods, '{}'), p_audience, case when p_audience = 'crew' then p_crew end,
            case when p_audience = 'pick' then p_picked else '{}' end, z)
    on conflict (user_id) do update set id = gen_random_uuid(), starts_at = excluded.starts_at, ends_at = excluded.ends_at, moods = excluded.moods,
      audience = excluded.audience, crew_id = excluded.crew_id, picked = excluded.picked, zone = excluded.zone, created_at = now()
    returning * into r;
    -- cine poate afla: prietenii, prietenii lor, gașca
    for v in
      select c from (
        select f as c from private.friends_of(me)
        union select y.f from private.friends_of(me) x cross join lateral private.friends_of(x.f) y where r.audience = 'fof'
        union select user_id from public.crew_members where r.audience = 'crew' and crew_id = r.crew_id and status = 'member'
      ) t where private.free_sees(c, r)
    loop
      if private.free_push_ok(v, me) then perform private.push('free', r.id, v); notified := notified + 1; end if;
    end loop;
  end if;
  select count(*) into others from public.free_now f where f.ends_at > now() and private.free_sees(me, f);
  return jsonb_build_object('id', r.id, 'starts_at', r.starts_at, 'ends_at', r.ends_at, 'notified', notified, 'others', others);
end $$;

-- „Ieși de pe FreeNow” (și din ieșire, dacă erai într-una)
create or replace function public.free_now_stop() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); o uuid;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  update public.free_now set starts_at = least(starts_at, now() - interval '1 second'), ends_at = now() where user_id = me and ends_at > now();
  o := private.free_outing_of(me);
  if o is not null then perform private.free_leave_outing(me, o); end if;
end $$;

-- Tot ce arată ecranul: eu, ieșirea mea, cine mai e pe FreeNow (doar cei pe care am voie să-i văd).
create or replace function public.free_now_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); o uuid; mine jsonb; outing jsonb; people jsonb; p uuid;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  select jsonb_build_object('id', id, 'starts_at', starts_at, 'ends_at', ends_at, 'moods', moods, 'audience', audience, 'crew_id', crew_id,
                            'picked', picked, 'zone', zone)
    into mine from public.free_now where user_id = me and ends_at > now();
  o := private.free_outing_of(me);
  if o is not null then
    p := private.free_plan(o);
    select jsonb_build_object('id', x.id, 'host', x.host, 'open', x.open, 'ends_at', x.ends_at, 'vote_id', x.vote_id,
      'vote_closes_at', (select closes_at from public.vote_sessions where id = x.vote_id),
      'plan', (select jsonb_build_object('id', pl.id, 'venue_id', pl.venue_id, 'venue_name', pl.venue_name, 'starts_at', pl.starts_at)
                 from public.plans pl where pl.id = p),
      'has_minor', exists (select 1 from public.free_outing_members m where m.outing_id = x.id and m.left_at is null and private.free_minor(m.user_id)),
      'members', (select jsonb_agg(jsonb_build_object('id', pr.id, 'first_name', pr.first_name, 'username', pr.username, 'avatar_path', pr.avatar_path,
                    'friend', private.is_friend(me, pr.id) or pr.id = me) order by m.joined_at)
                    from public.free_outing_members m join public.profiles pr on pr.id = m.user_id
                   where m.outing_id = x.id and m.left_at is null))
      into outing from public.free_outings x where x.id = o;
  end if;
  select coalesce(jsonb_agg(j order by (j->>'starts_at')), '[]'::jsonb) into people from (
    select jsonb_build_object('id', pr.id, 'first_name', pr.first_name, 'username', pr.username, 'avatar_path', pr.avatar_path,
      'starts_at', f.starts_at, 'ends_at', f.ends_at, 'moods', f.moods, 'zone', f.zone,
      'friend', private.is_friend(me, f.user_id),
      'via', case when private.is_friend(me, f.user_id) then null else (select first_name from public.profiles where id = private.free_via(f.user_id, me)) end,
      'muted', exists (select 1 from public.free_mutes where user_id = me and muted = f.user_id and active),
      'outing', (select jsonb_build_object('id', x.id, 'open', x.open, 'count', (select count(*) from public.free_outing_members where outing_id = x.id and left_at is null),
                   'mine', x.id = o,
                   'plan', (select jsonb_build_object('venue_name', pl.venue_name, 'starts_at', pl.starts_at) from public.plans pl where pl.id = private.free_plan(x.id)))
                   from public.free_outings x where x.id = private.free_outing_of(f.user_id))) as j
      from public.free_now f join public.profiles pr on pr.id = f.user_id
     where f.ends_at > now() and private.free_sees(me, f)
  ) t;
  return jsonb_build_object('me', mine, 'outing', outing, 'people', people,
    'quiet', exists (select 1 from public.free_mutes where user_id = me and muted = me and active));
end $$;

-- „Vin și eu”: intri în ieșirea omului (sau o pornești cu el). p_switch = ieși din ieșirea în care erai.
create or replace function public.free_join(p_user uuid, p_switch boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.free_now; target uuid; cur uuid; x public.free_outings; mid uuid; m uuid; n int; p uuid; mine_end timestamptz;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.free'));
  select * into r from public.free_now where user_id = p_user;
  if not found or not private.free_sees(me, r) then raise exception 'Nu mai e pe FreeNow.' using errcode = 'check_violation'; end if;
  target := private.free_outing_of(p_user);
  cur := private.free_outing_of(me);
  if cur is not null and cur = target then return target; end if;
  if cur is not null then
    if not p_switch then raise exception 'Ești deja într-o ieșire. O schimbi?' using errcode = 'P0001', hint = 'switch'; end if;
    perform private.free_leave_outing(me, cur);
  end if;
  if target is null then
    insert into public.free_outings (host, ends_at) values (p_user, r.ends_at) returning id into target;
    insert into public.free_outing_members (outing_id, user_id) values (target, p_user);
  end if;
  select * into x from public.free_outings where id = target for update;
  if not x.open then raise exception 'Ieșirea s-a închis, nu mai intră nimeni.' using errcode = 'check_violation'; end if;
  select count(*) into n from public.free_outing_members where outing_id = target and left_at is null;
  if n >= 10 then raise exception 'Ieșirea e plină (10 oameni).' using errcode = 'check_violation'; end if;
  if private.free_minor(me) and exists (select 1 from public.free_outing_members where outing_id = target and left_at is null and not private.is_friend(me, user_id)) then
    raise exception 'Poți intra doar într-o ieșire cu prietenii tăi.' using errcode = 'insufficient_privilege'; end if;
  if not private.free_minor(me) and exists (select 1 from public.free_outing_members where outing_id = target and left_at is null
       and private.free_minor(user_id) and not private.is_friend(me, user_id)) then
    raise exception 'În ieșirea asta e cineva sub 18 ani: intră doar prietenii lui.' using errcode = 'insufficient_privilege'; end if;
  insert into public.free_outing_members (outing_id, user_id) values (target, me)
    on conflict (outing_id, user_id) do update set left_at = null, joined_at = now(), id = gen_random_uuid()
    returning id into mid;
  select ends_at into mine_end from public.free_now where user_id = me and ends_at > now();
  update public.free_outings set ends_at = greatest(ends_at, coalesce(mine_end, ends_at)), changed_at = now() where id = target;
  if x.vote_id is not null then
    insert into public.vote_voters (session_id, user_id) values (x.vote_id, me) on conflict do nothing;
    p := private.free_plan(target);
    if p is not null then
      insert into public.plan_members (plan_id, user_id, answer, answered_at) values (p, me, 'vin', now())
        on conflict (plan_id, user_id) do update set answer = 'vin', answered_at = now();
      update public.plans set people = least(500, greatest(people, 1 + (select count(*) from public.plan_members where plan_id = p and answer <> 'nu_pot'))) where id = p;
    end if;
  end if;
  for m in select user_id from public.free_outing_members where outing_id = target and left_at is null and user_id <> me loop
    perform private.push('free_join', mid, m);
  end loop;
  return target;
end $$;

create or replace function public.free_leave() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); o uuid;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.free'));
  o := private.free_outing_of(me);
  if o is not null then perform private.free_leave_outing(me, o); end if;
end $$;

-- Votul ieșirii: locurile lui Bilu, 15 minute, votează toți cei din ieșire (și cei care intră după).
create or replace function public.free_vote(p_options jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); o uuid; x public.free_outings; s uuid; e jsonb; i int := 0; n text;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.free'));
  o := private.free_outing_of(me);
  if o is null then raise exception 'Nu ești într-o ieșire.' using errcode = 'check_violation'; end if;
  select * into x from public.free_outings where id = o for update;
  if (select count(*) from public.free_outing_members where outing_id = o and left_at is null) < 2 then
    raise exception 'Așteaptă să mai vină cineva.' using errcode = 'check_violation'; end if;
  if x.vote_id is not null then
    if private.free_plan(o) is not null then raise exception 'Aveți deja plan.' using errcode = 'check_violation'; end if;
    if (select closes_at from public.vote_sessions where id = x.vote_id) > now() then return x.vote_id; end if;
  end if;
  if jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options) not between 2 and 5 then
    raise exception 'Votul are nevoie de 2–5 variante.' using errcode = 'check_violation'; end if;
  if (select count(*) from public.vote_sessions where created_by = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Ai pornit destule voturi azi. Mâine mai poți.' using errcode = 'check_violation'; end if;
  insert into public.vote_sessions (created_by, title, closes_at) values (me, 'FreeNow: unde mergem?', now() + interval '15 minutes') returning id into s;
  insert into public.vote_voters (session_id, user_id) select s, user_id from public.free_outing_members where outing_id = o and left_at is null;
  for e in select * from jsonb_array_elements(p_options) loop
    select coalesce(edit->>'name', name) into n from public.venues where id = e->>'venue_id' and status = 'on';
    if n is null then raise exception 'Unul dintre locuri nu mai e disponibil.' using errcode = 'check_violation'; end if;
    insert into public.vote_options (session_id, venue_id, venue_name, details, position)
    values (s, left(e->>'venue_id', 80), n, case when pg_column_size(e->'details') <= 4000 then coalesce(e->'details', '{}'::jsonb) else '{}'::jsonb end, i);
    i := i + 1;
  end loop;
  update public.free_outings set vote_id = s, changed_at = now() where id = o;
  return s;
end $$;

-- Cel care a pornit ieșirea poate încheia votul mai devreme („Alegem acum”); câștigă locul cu cele mai multe voturi.
create or replace function public.free_vote_end() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); o uuid := private.free_outing_of(auth.uid()); x public.free_outings;
begin
  select * into x from public.free_outings where id = o;
  if x.id is null or x.host is distinct from me then raise exception 'Doar cine a pornit ieșirea încheie votul.' using errcode = 'insufficient_privilege'; end if;
  update public.vote_sessions set closes_at = greatest(created_at + interval '1 second', now()) where id = x.vote_id and plan_id is null and closes_at > now();
  perform private.free_touch(o);
end $$;

-- „Mai poate veni lume” (doar cine a pornit ieșirea)
create or replace function public.free_outing_open(p_open boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  update public.free_outings set open = coalesce(p_open, true), changed_at = now() where id = private.free_outing_of(me) and host = me;
  if not found then raise exception 'Doar cine a pornit ieșirea poate schimba asta.' using errcode = 'insufficient_privilege'; end if;
end $$;

-- „Nu mai vreau să aflu când e X pe FreeNow” (p_user = tu: toate notificările FreeNow oprite)
create or replace function public.free_mute(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or p_user is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then return; end if;
  if (select count(*) from public.free_mutes where user_id = me) >= 500 then raise exception 'Prea multe.' using errcode = 'check_violation'; end if;
  insert into public.free_mutes (user_id, muted, active) values (me, p_user, coalesce(p_on, true))
    on conflict (user_id, muted) do update set active = excluded.active;
end $$;

-- după vot, cei din ieșire au deja „Vin” pe plan
create or replace function private.free_plan_made() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o uuid;
begin
  if new.plan_id is not null and old.plan_id is null then
    select id into o from public.free_outings where vote_id = new.id;
    if o is not null then
      update public.plan_members set answer = 'vin', answered_at = now()
       where plan_id = new.plan_id and user_id in (select user_id from public.free_outing_members where outing_id = o and left_at is null);
      perform private.free_touch(o);
    end if;
  end if;
  return new;
end $$;
create trigger free_plan_made after update of plan_id on public.vote_sessions for each row execute function private.free_plan_made();

-- nimeni nu primește notificare pentru ce a făcut chiar el (intră singur în vot / plan)
create or replace function private.push_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from (select created_by from public.vote_sessions where id = new.session_id)
     and new.user_id is distinct from (select auth.uid()) then
    perform private.push('vote', new.session_id, new.user_id);
  end if;
  return new;
end $$;
create or replace function private.push_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from (select auth.uid()) then perform private.push('plan', new.plan_id, new.user_id); end if;
  return new;
end $$;

-- telefonul ascultă ieșirea (doar cei din ea o văd)
do $$ begin alter publication supabase_realtime add table public.free_outings; exception when others then null; end $$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.free_in(uuid, uuid) to authenticated;
revoke all on function public.free_now_set(timestamptz, timestamptz, text[], text, uuid, uuid[], text), public.free_now_stop(), public.free_now_list(),
  public.free_join(uuid, boolean), public.free_leave(), public.free_vote(jsonb), public.free_vote_end(), public.free_outing_open(boolean),
  public.free_mute(uuid, boolean) from public, anon;
grant execute on function public.free_now_set(timestamptz, timestamptz, text[], text, uuid, uuid[], text), public.free_now_stop(), public.free_now_list(),
  public.free_join(uuid, boolean), public.free_leave(), public.free_vote(jsonb), public.free_vote_end(), public.free_outing_open(boolean),
  public.free_mute(uuid, boolean) to authenticated;
