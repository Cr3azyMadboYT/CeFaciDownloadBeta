-- CeFaci, etapa 2: accounts, friends, gășci (crews), plans and live voting.
-- Rules from docs/directie-si-decizii.md ("Prieteni și gășci", "Solo, în doi, gașcă").
-- Everything is behind Row Level Security; whatever needs to look past it goes through the functions at the end.
-- Venues stay in the app (OpenStreetMap); here they are referenced by their id ("n123456") and name.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.new_code(len int default 8) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, len)
$$;

-- ---------- people ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  first_name text not null check (char_length(first_name) between 2 and 24),
  avatar_path text,                                         -- in the private "avatars" bucket, seen by friends only
  friend_code text not null unique default private.new_code(8), -- how 16-17 year olds get added (they are not searchable)
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'What friends and crew-mates see. Birth date and preferences live in profile_private.';

create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date not null,
  prefs jsonb not null default '{}'::jsonb,                 -- the sign-up answers (zone, likes, budget...)
  updated_at timestamptz not null default now()
);
comment on table public.profile_private is 'Only the owner reads or changes it.';

create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index friendships_one_per_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on public.friendships (addressee);
comment on table public.friendships is 'A refusal deletes the row: no notification. Removing a friend also deletes it.';

-- ---------- gășci ----------

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  stamp_icon text not null default 'star'
    check (stamp_icon in ('star', 'dice', 'notes', 'target', 'cocktail', 'pizza', 'bolt', 'heart', 'smile', 'mic')),
  stamp_color text not null default '#FFD43B' check (stamp_color ~ '^#[0-9A-Fa-f]{6}$'),
  admin_id uuid references public.profiles (id) on delete set null,
  temporary boolean not null default false,                 -- a one-off group for a plan, deleted after the outing
  invite_token text not null unique default private.new_code(12),
  invite_expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'member')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index crew_members_user on public.crew_members (user_id);

-- ---------- plans ----------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  crew_id uuid references public.crews (id) on delete set null,
  venue_id text not null,
  venue_name text not null,
  starts_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  reservation jsonb not null default '{}'::jsonb,           -- {"how":"telefon","at":"20:00","people":4}
  created_at timestamptz not null default now()
);
create index plans_owner on public.plans (owner_id);

create table public.plan_members (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer text not null default 'pending' check (answer in ('pending', 'vin', 'nu_pot')),
  answered_at timestamptz,
  primary key (plan_id, user_id)
);
create index plan_members_user on public.plan_members (user_id);

-- ---------- voting ----------

create table public.vote_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  crew_id uuid references public.crews (id) on delete cascade,
  title text not null default 'Unde mergem?' check (char_length(title) <= 80),
  closes_at timestamptz not null,                           -- the vote ends then, even if someone did not vote
  created_at timestamptz not null default now(),
  check (closes_at > created_at)
);

create table public.vote_voters (
  session_id uuid not null references public.vote_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (session_id, user_id)
);
create index vote_voters_user on public.vote_voters (user_id);

create table public.vote_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vote_sessions (id) on delete cascade,
  venue_id text not null,
  venue_name text not null,
  details jsonb not null default '{}'::jsonb,
  position int not null default 0
);
create index vote_options_session on public.vote_options (session_id);

create table public.ballots (
  session_id uuid not null references public.vote_sessions (id) on delete cascade,
  option_id uuid not null references public.vote_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value text not null check (value in ('da', 'nu', 'super')),
  updated_at timestamptz not null default now(),
  primary key (session_id, option_id, user_id)
);
create unique index ballots_one_super on public.ballots (session_id, user_id) where value = 'super';
comment on table public.ballots is 'Da / Nu / Super, one Super per person and vote.';

-- ---------- helpers for the policies (security definer, so they can read past RLS without looping) ----------

create or replace function private.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted' and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)))
$$;

create or replace function private.crew_status(c uuid, u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.status from public.crew_members m where m.crew_id = c and m.user_id = u
$$;

create or replace function private.shares_crew(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.crew_members x join public.crew_members y on y.crew_id = x.crew_id
                 where x.user_id = a and y.user_id = b)
$$;

create or replace function private.in_plan(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plans pl where pl.id = p and pl.owner_id = u)
      or exists (select 1 from public.plan_members m where m.plan_id = p and m.user_id = u)
$$;

create or replace function private.is_voter(s uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vote_voters v where v.session_id = s and v.user_id = u)
$$;

create or replace function private.age(u uuid) returns int
language sql stable security definer set search_path = '' as $$
  select extract(year from age(current_date, p.birth_date))::int from public.profile_private p where p.id = u
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------- crew rules: max 15 people, the admin role moves on, an empty crew disappears ----------

create or replace function private.crew_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.crew_members where crew_id = new.crew_id) >= 15 then
      raise exception 'O gașcă are maximum 15 oameni.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  -- DELETE: someone left or was removed
  if not exists (select 1 from public.crew_members where crew_id = old.crew_id and status = 'member') then
    delete from public.crews where id = old.crew_id;
  elsif (select admin_id from public.crews where id = old.crew_id) = old.user_id then
    update public.crews set admin_id = (select user_id from public.crew_members
                                        where crew_id = old.crew_id and status = 'member' order by joined_at nulls last, created_at limit 1)
    where id = old.crew_id;
  end if;
  return old;
end $$;
create trigger crew_members_guard_ins before insert on public.crew_members for each row execute function private.crew_members_guard();
create trigger crew_members_guard_del after delete on public.crew_members for each row execute function private.crew_members_guard();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.friendships enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.vote_sessions enable row level security;
alter table public.vote_voters enable row level security;
alter table public.vote_options enable row level security;
alter table public.ballots enable row level security;

-- profiles: me, my friends, people in my crews, and anyone with a pending request between us
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or private.is_friend(id, (select auth.uid()))
  or private.shares_crew(id, (select auth.uid()))
  or exists (select 1 from public.friendships f where (f.requester = id and f.addressee = (select auth.uid()))
                                                   or (f.addressee = id and f.requester = (select auth.uid())))
);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- created only through complete_signup(); deleted with the account

create policy private_own on public.profile_private for select to authenticated using (id = (select auth.uid()));
create policy private_update_own on public.profile_private for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy friendships_read on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy friendships_ask on public.friendships for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending' and accepted_at is null);
create policy friendships_accept on public.friendships for update to authenticated
  using (addressee = (select auth.uid()) and status = 'pending')
  with check (addressee = (select auth.uid()) and status = 'accepted');
create policy friendships_end on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

create policy crews_read on public.crews for select to authenticated
  using (private.crew_status(id, (select auth.uid())) is not null);
create policy crews_admin_update on public.crews for update to authenticated
  using (admin_id = (select auth.uid())) with check (admin_id is not null);
create policy crews_admin_delete on public.crews for delete to authenticated using (admin_id = (select auth.uid()));
-- created through create_crew()

create policy crew_members_read on public.crew_members for select to authenticated
  using (private.crew_status(crew_id, (select auth.uid())) is not null);
-- a member invites a friend; the friend shows as "Invitat" until they accept
create policy crew_members_invite on public.crew_members for insert to authenticated with check (
  status = 'invited' and invited_by = (select auth.uid())
  and private.crew_status(crew_id, (select auth.uid())) = 'member'
  and private.is_friend(user_id, (select auth.uid()))
);
create policy crew_members_accept on public.crew_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and status = 'member');
create policy crew_members_leave on public.crew_members for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.crews c where c.id = crew_id and c.admin_id = (select auth.uid()))
);

create policy plans_read on public.plans for select to authenticated
  using (owner_id = (select auth.uid()) or private.in_plan(id, (select auth.uid())));
create policy plans_create on public.plans for insert to authenticated with check (
  owner_id = (select auth.uid()) and (crew_id is null or private.crew_status(crew_id, (select auth.uid())) = 'member')
);
create policy plans_owner_update on public.plans for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy plans_owner_delete on public.plans for delete to authenticated using (owner_id = (select auth.uid()));

create policy plan_members_read on public.plan_members for select to authenticated using (private.in_plan(plan_id, (select auth.uid())));
-- the owner invites friends or crew-mates; nobody is moved without answering
create policy plan_members_invite on public.plan_members for insert to authenticated with check (
  answer = 'pending'
  and exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = (select auth.uid()))
  and (private.is_friend(user_id, (select auth.uid())) or private.shares_crew(user_id, (select auth.uid())))
);
create policy plan_members_answer on public.plan_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy plan_members_leave on public.plan_members for delete to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = (select auth.uid()))
);

create policy vote_sessions_read on public.vote_sessions for select to authenticated using (private.is_voter(id, (select auth.uid())));
create policy vote_voters_read on public.vote_voters for select to authenticated using (private.is_voter(session_id, (select auth.uid())));
create policy vote_options_read on public.vote_options for select to authenticated using (private.is_voter(session_id, (select auth.uid())));
-- created through start_vote()

create policy ballots_read on public.ballots for select to authenticated using (private.is_voter(session_id, (select auth.uid())));
create policy ballots_cast on public.ballots for insert to authenticated with check (
  user_id = (select auth.uid()) and private.is_voter(session_id, (select auth.uid()))
  and exists (select 1 from public.vote_sessions s where s.id = session_id and s.closes_at > now())
  and exists (select 1 from public.vote_options o where o.id = option_id and o.session_id = ballots.session_id)
);
create policy ballots_change on public.ballots for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.vote_sessions s where s.id = session_id and s.closes_at > now()))
  with check (user_id = (select auth.uid()));
create policy ballots_take_back on public.ballots for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.vote_sessions s where s.id = session_id and s.closes_at > now()));

-- ---------- functions the app calls ----------

-- After Google: pick the username, first name and birth date. Under 16 cannot have an account.
create or replace function public.complete_signup(p_username text, p_first_name text, p_birth_date date, p_prefs jsonb default '{}'::jsonb)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); out_row public.profiles;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  if p_birth_date > current_date - interval '16 years' then
    raise exception 'CeFaci e de la 16 ani în sus.' using errcode = 'check_violation';
  end if;
  if p_birth_date < current_date - interval '110 years' then
    raise exception 'Data nașterii nu pare bună.' using errcode = 'check_violation';
  end if;
  insert into public.profiles (id, username, first_name) values (me, lower(p_username), trim(p_first_name))
  on conflict (id) do update set username = excluded.username, first_name = excluded.first_name
  returning * into out_row;
  insert into public.profile_private (id, birth_date, prefs) values (me, p_birth_date, coalesce(p_prefs, '{}'::jsonb))
  on conflict (id) do update set prefs = excluded.prefs, updated_at = now();   -- the birth date is set once
  return out_row;
end $$;

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(p_username) ~ '^[a-z0-9._]{3,20}$' and not exists (select 1 from public.profiles where username = lower(p_username))
$$;

-- Exact username only, no suggestions; 16-17 year olds are never found this way.
create or replace function public.find_user(p_username text)
returns table (id uuid, username text, first_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.first_name from public.profiles p
  where p.username = lower(p_username) and p.id <> auth.uid() and coalesce(private.age(p.id), 0) >= 18
$$;

create or replace function public.add_friend_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid;
begin
  select id into them from public.profiles where friend_code = lower(p_code);
  if them is null or them = me then raise exception 'Codul nu e bun.' using errcode = 'no_data_found'; end if;
  insert into public.friendships (requester, addressee) values (me, them) on conflict do nothing;
  return them;
end $$;

create or replace function public.mutual_friends(p_other uuid)
returns table (id uuid, username text, first_name text)
language sql stable security definer set search_path = '' as $$
  with mine as (select case when requester = auth.uid() then addressee else requester end as f from public.friendships
                where status = 'accepted' and auth.uid() in (requester, addressee)),
       theirs as (select case when requester = p_other then addressee else requester end as f from public.friendships
                  where status = 'accepted' and p_other in (requester, addressee))
  select p.id, p.username, p.first_name from public.profiles p join mine on mine.f = p.id join theirs on theirs.f = p.id
$$;

-- A permanent crew needs at least 2 friends; a temporary group (for one plan) at least 1.
create or replace function public.create_crew(p_name text, p_icon text, p_color text, p_friends uuid[], p_temporary boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); new_id uuid; f uuid;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  if coalesce(array_length(p_friends, 1), 0) < (case when p_temporary then 1 else 2 end) then
    raise exception 'Alege cel puțin % prieteni.', case when p_temporary then 1 else 2 end using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_friends, 1), 0) > 14 then raise exception 'O gașcă are maximum 15 oameni.' using errcode = 'check_violation'; end if;
  insert into public.crews (name, stamp_icon, stamp_color, admin_id, temporary) values (p_name, p_icon, p_color, me, p_temporary)
  returning id into new_id;
  insert into public.crew_members (crew_id, user_id, status, joined_at) values (new_id, me, 'member', now());
  foreach f in array p_friends loop
    if not private.is_friend(me, f) then raise exception 'Poți invita doar prieteni.' using errcode = 'insufficient_privilege'; end if;
    insert into public.crew_members (crew_id, user_id, status, invited_by) values (new_id, f, 'invited', me) on conflict do nothing;
  end loop;
  return new_id;
end $$;

create or replace function public.join_crew(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.crews;
begin
  select * into c from public.crews where invite_token = p_token;
  if c.id is null or c.invite_expires_at < now() then raise exception 'Linkul a expirat. Cere unul nou.' using errcode = 'no_data_found'; end if;
  insert into public.crew_members (crew_id, user_id, status, joined_at) values (c.id, me, 'member', now())
  on conflict (crew_id, user_id) do update set status = 'member', joined_at = coalesce(public.crew_members.joined_at, now());
  return c.id;
end $$;

create or replace function public.reset_crew_link(p_crew uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := private.new_code(12);
begin
  update public.crews set invite_token = t, invite_expires_at = now() + interval '7 days'
  where id = p_crew and admin_id = auth.uid();
  if not found then raise exception 'Doar adminul gășcii poate reseta linkul.' using errcode = 'insufficient_privilege'; end if;
  return t;
end $$;

-- Start a vote for a crew (its members) or for friends picked one by one. Options: [{"venue_id","venue_name","details"}].
create or replace function public.start_vote(p_crew uuid, p_friends uuid[], p_options jsonb, p_closes_at timestamptz, p_title text default 'Unde mergem?')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s uuid; o jsonb; i int := 0; f uuid;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) < 2 then raise exception 'Votul are nevoie de cel puțin 2 variante.' using errcode = 'check_violation'; end if;
  if p_closes_at <= now() or p_closes_at > now() + interval '7 days' then raise exception 'Termenul votului nu e bun.' using errcode = 'check_violation'; end if;
  if p_crew is not null and private.crew_status(p_crew, me) is distinct from 'member' then
    raise exception 'Nu ești în gașca asta.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.vote_sessions (created_by, crew_id, title, closes_at) values (me, p_crew, p_title, p_closes_at) returning id into s;
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
    insert into public.vote_options (session_id, venue_id, venue_name, details, position)
    values (s, o->>'venue_id', o->>'venue_name', coalesce(o->'details', '{}'::jsonb), i);
    i := i + 1;
  end loop;
  return s;
end $$;

-- Score: Super = 2, Da = 1, Nu = -1. Ties go to the option listed first.
create or replace function public.vote_results(p_session uuid)
returns table (option_id uuid, venue_id text, venue_name text, da int, nu int, super int, score int, closed boolean)
language sql stable security definer set search_path = '' as $$
  select o.id, o.venue_id, o.venue_name,
         count(*) filter (where b.value = 'da')::int, count(*) filter (where b.value = 'nu')::int, count(*) filter (where b.value = 'super')::int,
         coalesce(sum(case b.value when 'super' then 2 when 'da' then 1 when 'nu' then -1 end), 0)::int,
         s.closes_at <= now()
  from public.vote_options o
  join public.vote_sessions s on s.id = o.session_id
  left join public.ballots b on b.option_id = o.id
  where o.session_id = p_session and private.is_voter(p_session, auth.uid())
  group by o.id, s.closes_at
  order by 7 desc, o.position
$$;

-- GDPR: delete my account and everything tied to it.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.complete_signup(text, text, date, jsonb), public.username_available(text), public.find_user(text),
  public.add_friend_by_code(text), public.mutual_friends(uuid), public.create_crew(text, text, text, uuid[], boolean),
  public.join_crew(text), public.reset_crew_link(uuid), public.start_vote(uuid, uuid[], jsonb, timestamptz, text),
  public.vote_results(uuid), public.delete_my_account() from public, anon;
grant execute on function public.complete_signup(text, text, date, jsonb), public.username_available(text), public.find_user(text),
  public.add_friend_by_code(text), public.mutual_friends(uuid), public.create_crew(text, text, text, uuid[], boolean),
  public.join_crew(text), public.reset_crew_link(uuid), public.start_vote(uuid, uuid[], jsonb, timestamptz, text),
  public.vote_results(uuid), public.delete_my_account() to authenticated;

-- ---------- live updates (votes, answers to plans, crew invites, friend requests) ----------
alter publication supabase_realtime add table public.ballots, public.plan_members, public.crew_members, public.friendships, public.vote_sessions;
