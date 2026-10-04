-- CeFaci 2.0, pasul 2: the crew vote ends in a plan, people in the same vote or plan see each other's name,
-- and friends see each other's level (XP) and how many stamps they have.

-- people who vote together or go out together (a plan) see each other's name, even if they are not friends
create or replace function private.together(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vote_voters x join public.vote_voters y on y.session_id = x.session_id where x.user_id = a and y.user_id = b)
      or exists (select 1 from public.plan_members x join public.plan_members y on y.plan_id = x.plan_id where x.user_id = a and y.user_id = b)
      or exists (select 1 from public.plans p join public.plan_members m on m.plan_id = p.id
                 where (p.owner_id = a and m.user_id = b) or (p.owner_id = b and m.user_id = a))
$$;
revoke all on function private.together(uuid, uuid) from public;
grant execute on function private.together(uuid, uuid) to authenticated;
create policy profiles_read_together on public.profiles for select to authenticated using (private.together(id, (select auth.uid())));

-- what friends see on a friend's profile (the owner's app keeps them in step with its state)
alter table public.profiles add column xp int not null default 0 check (xp between 0 and 10000000),
                            add column stamps int not null default 0 check (stamps between 0 and 100000);

-- a vote remembers the plan it became, so it is made once
alter table public.vote_sessions add column plan_id uuid references public.plans (id) on delete set null;

-- The vote is over (time is up or everybody voted): any voter turns the winner into a plan for all the voters.
-- The time of the outing comes from the winning option (details.starts_at), else p_starts_at.
create or replace function public.plan_from_vote(p_session uuid, p_starts_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s public.vote_sessions; w record; p uuid; t timestamptz;
begin
  if me is null or not private.is_voter(p_session, me) then raise exception 'Nu ești în votul ăsta.' using errcode = 'insufficient_privilege'; end if;
  select * into s from public.vote_sessions where id = p_session for update;
  if s.plan_id is not null then return s.plan_id; end if;
  select o.venue_id, o.venue_name, o.details,
         coalesce(sum(case b.value when 'super' then 2 when 'da' then 1 when 'nu' then -1 end), 0) score
    into w
    from public.vote_options o left join public.ballots b on b.option_id = o.id
   where o.session_id = p_session
   group by o.id order by 4 desc, o.position limit 1;
  t := coalesce(nullif(w.details->>'starts_at', '')::timestamptz, p_starts_at, now() + interval '2 hours');
  insert into public.plans (owner_id, crew_id, venue_id, venue_name, starts_at)
  values (me, s.crew_id, w.venue_id, w.venue_name, t) returning id into p;
  insert into public.plan_members (plan_id, user_id)
  select p, v.user_id from public.vote_voters v where v.session_id = p_session and v.user_id <> me;
  update public.vote_sessions set plan_id = p where id = p_session;
  return p;
end $$;
revoke all on function public.plan_from_vote(uuid, timestamptz) from public, anon;
grant execute on function public.plan_from_vote(uuid, timestamptz) to authenticated;

alter publication supabase_realtime add table public.plans;
