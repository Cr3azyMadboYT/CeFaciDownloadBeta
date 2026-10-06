-- Securitatea (Cornel, 07.10: „rezolvă toate șmecheriile ce pot fi făcute sau bugurile ce pot fi abuzate”). Am atacat
-- aplicația ca un om rău-intenționat cu multe conturi și am închis ce se putea abuza. Pe scurt:
--   1. Banii la Google: fiecare verificare „e deschis?” și fiecare bon citit trec printr-o cotă (pe om și pe toată
--      aplicația, pe zi); vremea o cere un singur apel o dată.
--   2. XP: check-in doar la locurile adevărate (poziția și felul locului vin de aici, nu de pe telefon); un bon dă XP o
--      singură dată, pentru oricine (CUI + data + ora + totalul), iar un check-in nu mai poate da două bonuri.
--   3. Notificările: funcția trimite-notificare răspunde doar bazei de date (secret în Vault).
--   4. Prieteni, gășci, planuri, voturi: nimeni nu mai poate muta un rând al lui pe alt om, altă gașcă, alt plan sau alt
--      vot (prietenii forțate, intrat în gășci străine, voturi umflate); voturile trebuie să fie din votul lor.
--   5. Limite: cereri de prietenie, semnalări, voturi, gășci, telefoane; texte și date de mărime normală.
--   6. Ce se vede: cei fără cont văd doar locurile (fără cine le-a modificat); evenimentele live de ștergere nu mai
--      arată cine cu cine e prieten sau în ce gașcă.

-- ---------- 1. cotele pentru Google ----------
create table if not exists private.api_use (
  user_id uuid,
  kind text not null,
  n int not null check (n between 1 and 100),
  at timestamptz not null default now()
);
create index if not exists api_use_user on private.api_use (kind, user_id, at);
create index if not exists api_use_at on private.api_use (kind, at);
alter table private.api_use enable row level security;

-- cât are voie fiecare (pe oră și pe zi, de om; pe zi, pentru toată aplicația)
create or replace function private.quota(kind text) returns int[]
language sql immutable set search_path = '' as $$
  select case kind
    when 'e-deschis' then array[36, 80, 400]   -- locuri verificate: ~3 planuri pe oră de om; ~400 pe zi în total
    when 'bon'       then array[4, 8, 400]     -- poze de bon citite
    else array[0, 0, 0] end
$$;

-- doar serverul (funcțiile e-deschis și citeste-bon): da dacă mai e loc, și ține minte
create or replace function public.api_quota(p_user uuid, p_kind text, p_n int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare q int[] := private.quota(p_kind); h int; d int; all_d int;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  if p_user is null or p_n not between 1 and 100 then return false; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.quota.' || p_kind));
  select coalesce(sum(n) filter (where at > now() - interval '1 hour'), 0), coalesce(sum(n), 0) into h, d
  from private.api_use where kind = p_kind and user_id = p_user and at > now() - interval '1 day';
  select coalesce(sum(n), 0) into all_d from private.api_use where kind = p_kind and at > now() - interval '1 day';
  if h + p_n > q[1] or d + p_n > q[2] or all_d + p_n > q[3] then return false; end if;
  insert into private.api_use (user_id, kind, n) values (p_user, p_kind, p_n);
  return true;
end $$;

-- vremea: un singur apel o dată ia rândul (50 de minute; după o încercare picată, iar peste 10)
create table if not exists private.weather_turn (id smallint primary key default 1 check (id = 1), taken_at timestamptz not null);
alter table private.weather_turn enable row level security;
create or replace function public.weather_turn() returns boolean
language plpgsql security definer set search_path = '' as $$
declare fresh timestamptz;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  select updated_at into fresh from public.weather where id = 1;
  if fresh > now() - interval '50 minutes' then return false; end if;
  insert into private.weather_turn (id, taken_at) values (1, now())
  on conflict (id) do update set taken_at = now() where private.weather_turn.taken_at < now() - interval '10 minutes';
  return found;
end $$;

-- ---------- 2. XP ----------
-- check-in doar la un loc din listă (poziția și felul locului de aici; ce trimite telefonul despre loc nu mai contează)
create or replace function public.xp_check_in(p_venue text, p_lat double precision, p_lon double precision, p_acc double precision,
                                              p_cat text default null, p_vlat double precision default null, p_vlon double precision default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); v public.venues; d double precision;
  today date := (now() at time zone 'Europe/Bucharest')::date; gain int := 0; np boolean; nk boolean;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  select * into v from public.venues where id = p_venue and status = 'on';
  if v.id is null then raise exception 'Nu știm unde e localul ăsta.' using errcode = 'no_data_found'; end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'Nu știm unde ești.' using errcode = 'check_violation'; end if;
  d := private.km(p_lat, p_lon, v.lat, v.lon) * 1000;
  if d > 250 + least(greatest(coalesce(p_acc, 0), 0), 150) then
    raise exception 'departe:%', round(d)::int using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.checkin.' || me::text)); -- două check-in-uri trimise deodată nu trec amândouă
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
  nk := not exists (select 1 from public.xp_log where user_id = me and kind = 'checkin' and cat = v.cat);
  insert into public.xp_log (user_id, kind, venue_id, cat, amount) values (me, 'checkin', p_venue, v.cat, 100);
  gain := 100;
  if np then insert into public.xp_log (user_id, kind, venue_id, cat, amount) values (me, 'new_place', p_venue, v.cat, 50); gain := gain + 50; end if;
  if nk then insert into public.xp_log (user_id, kind, venue_id, cat, amount) values (me, 'new_kind', p_venue, v.cat, 75); gain := gain + 75; end if;
  return jsonb_build_object('gain', gain, 'new_place', np, 'new_kind', nk, 'total', (select xp from public.profiles where id = me));
end $$;

-- bonurile deja puse (doar amprenta: CUI|data|ora|total, amestecată), ca același bon să nu dea XP de două ori
create table if not exists private.receipts_seen (
  fp text primary key,
  user_id uuid,
  at timestamptz not null default now()
);
alter table private.receipts_seen enable row level security;

-- înainte să plătim citirea pozei la Google: are check-in acolo, nu a pus deja bonul, ziua e bună și mai are cotă
create or replace function public.xp_bill_ready(p_user uuid, p_venue text, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'Europe/Bucharest')::date;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  if p_day is null or p_day > today or p_day < today - 2 then return jsonb_build_object('ok', false, 'error', 'Bonul se poate pune până a doua zi seara.'); end if;
  if not exists (select 1 from public.xp_log where user_id = p_user and kind = 'checkin' and venue_id = p_venue and day between p_day - 1 and p_day) then
    return jsonb_build_object('ok', false, 'error', 'Fă întâi check-in la local, apoi pune bonul.'); end if;
  if exists (select 1 from public.xp_log where user_id = p_user and kind = 'bill' and venue_id = p_venue and day between p_day - 1 and p_day + 1) then
    return jsonb_build_object('ok', false, 'error', 'Bonul de la locul ăsta e deja pus.'); end if;
  if not public.api_quota(p_user, 'bon', 1) then return jsonb_build_object('ok', false, 'error', 'Ai trimis destule poze azi. Mâine mai poți.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- varianta veche (fără bon) nu mai dă nimic: un check-in dădea două bonuri
create or replace function public.xp_bill(p_user uuid, p_venue text, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('gain', 0, 'error', 'Actualizează aplicația ca să pui bonul.');
end $$;
-- +25 pentru bon: după un check-in acolo, o dată pe check-in (nu o dată pe zi aleasă de telefon), o dată pe bon
create or replace function public.xp_bill(p_user uuid, p_venue text, p_day date, p_receipt text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare fp text;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  if coalesce(p_receipt, '') = '' then return jsonb_build_object('gain', 0, 'error', 'Nu se vede tot bonul.'); end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.bill.' || p_user::text));
  if not exists (select 1 from public.xp_log where user_id = p_user and kind = 'checkin' and venue_id = p_venue and day between p_day - 1 and p_day) then
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

-- ---------- 3. notificările: doar baza de date cheamă trimite-notificare ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_hook_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'push_hook_secret');
  end if;
exception when others then null; -- fără Vault (testele): notificările nu pleacă, restul merge
end $$;

create or replace function public.push_hook_secret() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret' limit 1);
end $$;

create or replace function private.push(p_kind text, p_ref uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_hook_secret' limit 1;
  perform net.http_post(
    url := 'https://vqrmwuarjjntusfbqprx.supabase.co/functions/v1/trimite-notificare',
    body := jsonb_build_object('kind', p_kind, 'ref', p_ref, 'user', p_user),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cefaci-hook', coalesce(s, ''))
  );
exception when others then
  null; -- never block a vote, a plan or an invitation because a notification could not leave
end $$;

-- ---------- 4. rândurile nu se mută pe altcineva ----------
-- Regulile vechi lăsau omul să-și schimbe orice coloană a rândului lui: o cerere de prietenie primită devenea prietenie
-- cu oricine (chiar cu un minor), un loc în gașcă sau în plan se muta în altă gașcă / alt plan, un vot în alt vot.
create or replace function private.freeze_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;   -- funcțiile serverului (security definer) pot
  if tg_table_name = 'friendships' then
    if (new.requester, new.addressee, new.created_at) is distinct from (old.requester, old.addressee, old.created_at) then
      raise exception 'Nu se poate.' using errcode = '42501'; end if;
    new.accepted_at := case when old.status = 'pending' and new.status = 'accepted' then now() else old.accepted_at end;
  elsif tg_table_name = 'crew_members' then
    if (new.crew_id, new.user_id, new.invited_by, new.created_at) is distinct from (old.crew_id, old.user_id, old.invited_by, old.created_at) then
      raise exception 'Nu se poate.' using errcode = '42501'; end if;
    new.joined_at := case when old.status = 'invited' and new.status = 'member' then now() else old.joined_at end;
  elsif tg_table_name = 'plan_members' then
    if (new.plan_id, new.user_id) is distinct from (old.plan_id, old.user_id) then raise exception 'Nu se poate.' using errcode = '42501'; end if;
    new.answered_at := case when new.answer is distinct from old.answer then now() else old.answered_at end;
  elsif tg_table_name = 'ballots' then
    if (new.session_id, new.option_id, new.user_id) is distinct from (old.session_id, old.option_id, old.user_id) then
      raise exception 'Nu se poate.' using errcode = '42501'; end if;
    new.updated_at := now();
  elsif tg_table_name = 'outing_votes' then
    if (new.plan_id, new.user_id, new.created_at) is distinct from (old.plan_id, old.user_id, old.created_at) then
      raise exception 'Nu se poate.' using errcode = '42501'; end if;
  elsif tg_table_name = 'crews' then
    -- linkul de invitație se schimbă doar din „Resetează linkul”; adminul poate fi doar cineva din gașcă
    if (new.invite_token, new.invite_expires_at, new.created_at, new.temporary) is distinct from
       (old.invite_token, old.invite_expires_at, old.created_at, old.temporary) then raise exception 'Nu se poate.' using errcode = '42501'; end if;
    if new.admin_id is distinct from old.admin_id and coalesce(private.crew_status(new.id, new.admin_id), '') <> 'member' then
      raise exception 'Adminul trebuie să fie în gașcă.' using errcode = '42501'; end if;
  elsif tg_table_name = 'plans' then
    if (new.owner_id, new.created_at) is distinct from (old.owner_id, old.created_at) then raise exception 'Nu se poate.' using errcode = '42501'; end if;
    -- după ce gașca a votat ieșirea, locul ei nu se mai schimbă (altfel voturile s-ar muta pe alt loc)
    if (new.venue_id, new.venue_name) is distinct from (old.venue_id, old.venue_name)
       and exists (select 1 from public.outing_votes v where v.plan_id = old.id) then raise exception 'Planul a fost deja votat.' using errcode = '42501'; end if;
    if new.starts_at is distinct from old.starts_at and new.starts_at < now() - interval '6 hours' then
      raise exception 'Ora planului nu e bună.' using errcode = 'check_violation'; end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['friendships', 'crew_members', 'plan_members', 'ballots', 'outing_votes', 'crews', 'plans'] loop
    execute format('create or replace trigger freeze_keys before update on public.%I for each row execute function private.freeze_keys()', t);
  end loop;
end $$;

-- un vot e mereu al votului lui (și în numărătoare: vote_results, plan_from_vote, crew_taste)
alter table public.vote_options add constraint vote_options_id_session unique (id, session_id);
alter table public.ballots add constraint ballots_option_in_session foreign key (option_id, session_id) references public.vote_options (id, session_id) on delete cascade;

-- gusturile gășcii: fiecare om contează o dată pe loc (nu poate umfla un loc cu zeci de planuri și voturi)
create or replace function public.crew_taste(p_crew uuid) returns table (venue_id text, score int, outings int)
language sql stable security definer set search_path = '' as $$
  with raw as (
    select p.venue_id, ov.user_id, ov.vote::int as score, p.id as plan_id
      from public.outing_votes ov join public.plans p on p.id = ov.plan_id
      where p.crew_id = p_crew and p.starts_at <= now()
    union all
    select o.venue_id, b.user_id, case b.value when 'super' then 2 when 'da' then 1 else -1 end, null
      from public.ballots b join public.vote_options o on o.id = b.option_id and o.session_id = b.session_id
      join public.vote_sessions s on s.id = b.session_id
      where s.crew_id = p_crew
  ), per_person as (
    select venue_id, user_id, round(avg(score))::int as score, count(distinct plan_id) as outings from raw group by venue_id, user_id
  )
  select venue_id, sum(score)::int, max(outings)::int from per_person
  where exists (select 1 from public.crew_members cm where cm.crew_id = p_crew and cm.user_id = (select auth.uid()) and cm.status = 'member')
  group by venue_id
$$;

-- un plan nou e pentru acum sau mai târziu, cu un nume de loc normal (ajunge în notificările altora)
alter policy plans_create on public.plans with check (
  owner_id = (select auth.uid()) and (crew_id is null or private.crew_status(crew_id, (select auth.uid())) = 'member')
  and starts_at > now() - interval '6 hours' and starts_at < now() + interval '60 days'
);
create or replace function private.plan_name() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  select coalesce(edit->>'name', name) into n from public.venues where id = new.venue_id;
  if n is not null then new.venue_name := n;                     -- locul din listă: numele lui adevărat
  elsif private.rude(new.venue_name) then raise exception 'Te rog alege alt nume, acesta nu prea pare potrivit.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create or replace trigger plan_name before insert or update of venue_id, venue_name on public.plans for each row execute function private.plan_name();

-- mărimi normale (doar pentru rândurile noi: cele vechi rămân cum sunt)
alter table public.plans add constraint plans_sizes check (char_length(venue_id) <= 80 and char_length(venue_name) <= 120 and pg_column_size(reservation) <= 2000) not valid;
alter table public.vote_options add constraint vote_options_sizes check (char_length(venue_id) <= 80 and char_length(venue_name) <= 120 and pg_column_size(details) <= 4000) not valid;
alter table public.profile_private add constraint profile_private_sizes check (pg_column_size(prefs) <= 20000 and pg_column_size(app_state) <= 400000) not valid;

-- votul: cel mult 10 variante, nume normale, cel mult 30 de voturi pornite pe zi (fiecare trimite notificări)
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
    select coalesce(edit->>'name', name) into n from public.venues where id = o->>'venue_id';
    n := coalesce(n, left(o->>'venue_name', 120));
    if n is null or private.rude(n) then raise exception 'Te rog alege alt nume, acesta nu prea pare potrivit.' using errcode = 'check_violation'; end if;
    insert into public.vote_options (session_id, venue_id, venue_name, details, position)
    values (s, left(o->>'venue_id', 80), n, case when pg_column_size(o->'details') <= 4000 then coalesce(o->'details', '{}'::jsonb) else '{}'::jsonb end, i);
    i := i + 1;
  end loop;
  return s;
end $$;

-- gășci: cel mult 10 noi pe zi
create or replace function private.crew_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.crews c where c.admin_id = new.admin_id and c.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Ai făcut destule gășci azi. Mâine mai poți.' using errcode = 'check_violation'; end if;
  return new;
end $$;
create or replace trigger crew_limit before insert on public.crews for each row execute function private.crew_limit();

-- când pleacă adminul (și când își șterge contul), gașca primește alt admin dintre membri
create or replace function private.crew_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.crew_members where crew_id = new.crew_id) >= 15 then
      raise exception 'O gașcă are maximum 15 oameni.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if not exists (select 1 from public.crew_members where crew_id = old.crew_id and status = 'member') then
    delete from public.crews where id = old.crew_id;
  elsif coalesce((select admin_id from public.crews where id = old.crew_id), old.user_id) = old.user_id then
    update public.crews set admin_id = (select user_id from public.crew_members
                                        where crew_id = old.crew_id and status = 'member' order by joined_at nulls last, created_at limit 1)
    where id = old.crew_id;
  end if;
  return old;
end $$;

-- ---------- 5. prietenii și semnalările ----------
-- cereri de prietenie: direct (după username) doar către adulți — minorii se adaugă doar cu codul lor; cel mult 30 de
-- cereri care așteaptă și 40 pe zi
alter policy friendships_ask on public.friendships
  with check (requester = (select auth.uid()) and status = 'pending' and accepted_at is null and coalesce(private.age(addressee), 0) >= 18);
create or replace function private.friend_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'pending'; new.accepted_at := null; new.created_at := now();
  if (select count(*) from public.friendships where requester = new.requester and status = 'pending') >= 30
     or (select count(*) from public.friendships where requester = new.requester and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Ai trimis destule cereri de prietenie. Mai încearcă mâine.' using errcode = 'check_violation'; end if;
  return new;
end $$;
create or replace trigger friend_limit before insert on public.friendships for each row execute function private.friend_limit();

-- prietenii comuni doar cu cineva pe care îl vezi deja (prieten, cerere, aceeași gașcă, același plan sau vot)
create or replace function public.mutual_friends(p_other uuid)
returns table (id uuid, username text, first_name text)
language sql stable security definer set search_path = '' as $$
  with ok as (select (select auth.uid()) as me where exists (select 1 from public.friendships f where (f.requester = p_other and f.addressee = (select auth.uid())) or (f.addressee = p_other and f.requester = (select auth.uid())))
                or private.shares_crew(p_other, (select auth.uid())) or private.together(p_other, (select auth.uid()))),
       mine as (select case when requester = ok.me then addressee else requester end as f from public.friendships, ok
                where status = 'accepted' and ok.me in (requester, addressee)),
       theirs as (select case when requester = p_other then addressee else requester end as f from public.friendships
                  where status = 'accepted' and p_other in (requester, addressee))
  select p.id, p.username, p.first_name from public.profiles p join mine on mine.f = p.id join theirs on theirs.f = p.id
$$;

-- „are cineva sub 18 în gașcă?”: doar pentru membri (nu pentru invitați)
create or replace function public.crew_has_minor(p_crew uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when coalesce(private.crew_status(p_crew, (select auth.uid())), '') <> 'member' then null else exists (
    select 1 from public.crew_members m join public.profile_private pp on pp.id = m.user_id
    where m.crew_id = p_crew and pp.birth_date > (current_date - interval '18 years')
  ) end
$$;

-- semnalările: intră mereu ca „nou”, cel mult 20 pe zi de om
create or replace function private.report_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_user = 'authenticated' or (select auth.uid()) is not null then
    new.user_id := (select auth.uid()); new.status := 'nou'; new.handled_by := null; new.handled_at := null; new.answer := null; new.created_at := now();
    if (select count(*) from public.reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'Ai trimis destule semnalări azi. Mulțumim! Mâine mai poți.' using errcode = 'check_violation'; end if;
  end if;
  return new;
end $$;
create or replace trigger report_guard before insert on public.reports for each row execute function private.report_guard();

-- telefonul unui cont: un token de notificări aparține ultimului cont intrat pe el; cel mult 10 telefoane de cont
create or replace function public.push_token_save(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  if coalesce(char_length(p_token), 0) not between 10 and 4096 then raise exception 'Token greșit.'; end if;
  delete from public.push_tokens where token = p_token and user_id <> me;
  insert into public.push_tokens (token, user_id, platform, updated_at) values (p_token, me, 'android', now())
  on conflict (token) do update set updated_at = now();
  delete from public.push_tokens where user_id = me and token in
    (select token from public.push_tokens where user_id = me order by updated_at desc offset 10);
end $$;

-- ---------- 6. ce se vede ----------
-- fără cont: doar locurile, și doar coloanele de care are nevoie aplicația (nu cine le-a modificat)
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
revoke select on public.venues from anon, authenticated;
grant select (id, name, cat, lat, lon, data, edit, status, updated_at) on public.venues to anon, authenticated;

-- evenimentele live de ștergere nu respectă regulile de citire: tabelele cu oameni ies din canalul live; telefonul află
-- de schimbări din vot (vote_sessions.changed_at) și din plan (plans.changed_at), care respectă regulile
alter table public.vote_sessions add column if not exists changed_at timestamptz;
alter table public.plans add column if not exists changed_at timestamptz;
create or replace function private.touch_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'ballots' then
    update public.vote_sessions set changed_at = now() where id = case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  else
    update public.plans set changed_at = now() where id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;
  end if;
  return null;
end $$;
create or replace trigger touch_parent after insert or update or delete on public.ballots for each row execute function private.touch_parent();
create or replace trigger touch_parent after insert or update or delete on public.plan_members for each row execute function private.touch_parent();
alter publication supabase_realtime set table public.vote_sessions, public.plans, public.reservations, public.visits;

-- ---------- drepturile ----------
revoke all on function private.quota(text) from public;
revoke all on function public.api_quota(uuid, text, int), public.weather_turn(), public.xp_bill_ready(uuid, text, date),
  public.xp_bill(uuid, text, date, text), public.xp_bill(uuid, text, date), public.push_hook_secret() from public, anon, authenticated;
revoke all on function public.push_token_save(text) from public, anon;
grant execute on function public.push_token_save(text) to authenticated;
revoke all on function public.start_vote(uuid, uuid[], jsonb, timestamptz, text), public.crew_taste(uuid), public.mutual_friends(uuid),
  public.crew_has_minor(uuid) from public, anon;
grant execute on function public.start_vote(uuid, uuid[], jsonb, timestamptz, text), public.crew_taste(uuid), public.mutual_friends(uuid),
  public.crew_has_minor(uuid) to authenticated;
-- funcțiile din private chemate doar de triggeri sau de alte funcții de server: nimeni din aplicație
revoke all on function private.push(text, uuid, uuid), private.push_vote(), private.push_plan(), private.push_crew(), private.xp_follow(),
  private.freeze_keys(), private.plan_name(), private.crew_limit(), private.friend_limit(), private.report_guard(), private.touch_parent()
  from public, anon, authenticated;
revoke all on function private.km(double precision, double precision, double precision, double precision), private.profiles_xp_guard(),
  private.clean_edit(jsonb) from public, anon;
