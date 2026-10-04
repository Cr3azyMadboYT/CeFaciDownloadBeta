-- The vote becomes a plan only when it is over (time is up, or everybody answered every place); making the plan
-- also closes the vote, so nobody's ballot can change the winner afterwards.
create or replace function public.plan_from_vote(p_session uuid, p_starts_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s public.vote_sessions; w record; p uuid; t timestamptz; missing int;
begin
  if me is null or not private.is_voter(p_session, me) then raise exception 'Nu ești în votul ăsta.' using errcode = 'insufficient_privilege'; end if;
  select * into s from public.vote_sessions where id = p_session for update;
  if s.plan_id is not null then return s.plan_id; end if;
  select count(*) into missing
    from public.vote_voters v cross join public.vote_options o
   where v.session_id = p_session and o.session_id = p_session
     and not exists (select 1 from public.ballots b where b.option_id = o.id and b.user_id = v.user_id);
  if s.closes_at > now() and missing > 0 then raise exception 'Votul nu s-a terminat încă.' using errcode = 'check_violation'; end if;
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
  update public.vote_sessions set plan_id = p, closes_at = least(closes_at, now()) where id = p_session;
  return p;
end $$;
