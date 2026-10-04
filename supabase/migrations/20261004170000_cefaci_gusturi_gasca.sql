-- Gașca învață (decizie Cornel, 04.10): după fiecare ieșire fiecare votează cum a fost; din voturile de după ieșiri
-- și din voturile de dinainte („Unde mergem?”: Super / Da / Nu) se adună gusturile gășcii, pe care Bilu le folosește
-- când face planuri pentru gașca aia.

create table public.outing_votes (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1, 2)),          -- nu prea / mi-a plăcut / super
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
alter table public.outing_votes enable row level security;

-- you vote for yourself, for an outing you were part of, once it has started
create policy outing_votes_insert on public.outing_votes for insert to authenticated with check (
  user_id = (select auth.uid())
  and private.in_plan(plan_id, (select auth.uid()))
  and exists (select 1 from public.plans p where p.id = plan_id and p.starts_at <= now())
);
create policy outing_votes_change on public.outing_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and vote in (-1, 1, 2));
create policy outing_votes_read on public.outing_votes for select to authenticated using (user_id = (select auth.uid()));

-- the crew's taste, only for its members: per place, the votes after outings with the crew (−1, +1, +2) and the votes
-- before them (Super +2, Da +1, Nu −1); `outings`: how many times the crew went there and voted
create or replace function public.crew_taste(p_crew uuid) returns table (venue_id text, score int, outings int)
language sql stable security definer set search_path = '' as $$
  select x.venue_id, sum(x.score)::int, sum(x.outing)::int
  from (
    select p.venue_id, ov.vote::int as score, 1 as outing
      from public.outing_votes ov join public.plans p on p.id = ov.plan_id
      where p.crew_id = p_crew
    union all
    select o.venue_id, case b.value when 'super' then 2 when 'da' then 1 else -1 end, 0
      from public.ballots b join public.vote_options o on o.id = b.option_id join public.vote_sessions s on s.id = b.session_id
      where s.crew_id = p_crew
  ) x
  where exists (select 1 from public.crew_members cm where cm.crew_id = p_crew and cm.user_id = (select auth.uid()) and cm.status = 'member')
  group by x.venue_id
$$;
revoke all on function public.crew_taste(uuid) from public, anon;
grant execute on function public.crew_taste(uuid) to authenticated;
