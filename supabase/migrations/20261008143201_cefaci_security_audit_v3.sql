-- Additive security audit: immutable operational groups, null-safe optimistic versions,
-- validated legacy vote conversion, and role-scoped Plus configuration hydration.

create or replace function public.plan_share_v2(p_key text,p_venue text,p_at timestamptz,p_people int,
 p_friends uuid[] default '{}',p_crew uuid default null,p_guests int default 0,p_guest_ages int[] default '{}',p_existing uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); x public.plans; ids uuid[]; title text;
begin
 perform private.require_v2();
 if me is null then raise exception 'Intră în cont.'; end if;
 if p_key is null or length(p_key) not between 1 and 100 or p_people is null or p_people not between 1 and 500
 or p_guests is null or p_guests not between 0 and 499 or cardinality(p_guest_ages)>p_guests
 or exists(select 1 from unnest(p_guest_ages) a where a is null or a not between 0 and 120)
 or p_at is null or p_at<now()-interval '6 hours' or p_at>now()+interval '1 year' then raise exception 'Datele planului nu sunt valide.'; end if;
 perform pg_advisory_xact_lock(hashtext('plan-key.'||me||p_key));
 if p_crew is not null and not exists(select 1 from public.crew_members where crew_id=p_crew and user_id=me and status='member') then raise exception 'Nu ești în gașca asta.'; end if;
 select coalesce(array_agg(distinct id),'{}') into ids from (
 select unnest(coalesce(p_friends,'{}')) id union select user_id from public.crew_members where crew_id=p_crew and status='member') s where id<>me;
 -- Declared groups without account invitations still contain explicit anonymous guests.
 if cardinality(ids)=0 then p_guests:=p_people-1; end if;
 if cardinality(p_guest_ages)>p_guests then raise exception 'Vârstele nu corespund invitaților fără cont.'; end if;
 if cardinality(ids)>499 or 1+cardinality(ids)+p_guests>500 then raise exception 'Grupul este prea mare.'; end if;
 if exists(select 1 from unnest(coalesce(p_friends,'{}')) f where f<>me and not exists(select 1 from public.friendships where status='accepted' and ((requester=me and addressee=f) or (requester=f and addressee=me)))) then raise exception 'Poți invita doar prieteni.'; end if;
 select * into x from public.plans where owner_id=me and client_key=p_key for update;
 if x.id is not null and p_existing is not null and x.id<>p_existing then raise exception 'Cheia aparține altui plan.';end if;
 if x.id is null and p_existing is not null then
  select * into x from public.plans where id=p_existing and owner_id=me for update;
  if x.id is null then raise exception 'Planul nu îți aparține.';end if;
  update public.plans set client_key=coalesce(client_key,p_key) where id=x.id;
 end if;
 if x.id is null then
  select coalesce(edit->>'name',name) into title from public.venues where id=p_venue and status='on';
  if title is null or exists(select 1 from public.partners where venue_id=p_venue and(venue_paused or(reservation_mode='required' and not reservations_on))) then raise exception 'Localul nu mai este disponibil.'; end if;
  insert into public.plans(owner_id,crew_id,venue_id,venue_name,starts_at,people,guests,guest_ages,client_key)
   values(me,p_crew,p_venue,title,p_at,p_people,p_guests,p_guest_ages,p_key) returning * into x;
 end if;
 if x.status<>'active' or x.venue_id<>p_venue then raise exception 'Planul nu mai este disponibil.'; end if;
 if cardinality(ids)>0 and x.shared_at is null then
  -- A reservation, claim or arrival has already snapshotted group identity and eligibility.
  -- The plan lock is also held by these writers, so inviting cannot race the snapshot.
  if exists(select 1 from public.reservations where plan_id=x.id)
   or exists(select 1 from public.drop_claims where plan_id=x.id)
   or exists(select 1 from public.visits where plan_id=x.id) then
   raise exception 'Grupul are deja o rezervare, ofertă sau sosire. Creează un plan nou pentru alte invitații.';
  end if;
  update public.plans set shared_at=now(),attendance_deadline=now()+interval '30 minutes',guests=p_guests,guest_ages=p_guest_ages,people=greatest(p_people,1+cardinality(ids)+p_guests) where id=x.id;
  insert into public.plan_members(plan_id,user_id) select x.id,id from unnest(ids) id on conflict do nothing;
 elsif cardinality(ids)>0 and exists(select 1 from unnest(ids) id where not exists(select 1 from public.plan_members where plan_id=x.id and user_id=id)) then
  raise exception 'Invitațiile sunt deja trimise. Creează un plan nou pentru alt grup.';
 end if;
 return x.id;
end $$;

revoke all on function public.plan_share_v2(text,text,timestamptz,int,uuid[],uuid,int,int[],uuid) from public,anon,authenticated;
grant execute on function public.plan_share_v2(text,text,timestamptz,int,uuid[],uuid,int,int[],uuid) to authenticated;

create or replace function public.plan_from_vote(p_session uuid, p_starts_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); s public.vote_sessions; w record; p uuid; t timestamptz; missing int; title text; invited int;
begin
  if me is null or not private.is_voter(p_session, me) then raise exception 'Nu ești în votul ăsta.' using errcode = 'insufficient_privilege'; end if;
  select * into s from public.vote_sessions where id = p_session for update;
  if s.plan_id is not null then return s.plan_id; end if;
  perform private.require_v2();
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
  if t is null or t<now()-interval '6 hours' or t>now()+interval '1 year' then
    raise exception 'Data planului nu este validă. Alegeți un plan nou.';
  end if;
  select coalesce(edit->>'name',name) into title from public.venues where id=w.venue_id and status='on';
  if title is null or exists(select 1 from public.partners where venue_id=w.venue_id and
    (venue_paused or (reservation_mode='required' and not reservations_on))) then
    raise exception 'Localul nu mai este disponibil. Alegeți un plan nou.';
  end if;
  select count(*) into invited from public.vote_voters where session_id=p_session and user_id<>me;
  if invited>499 then raise exception 'Grupul este prea mare.'; end if;
  insert into public.plans (owner_id, crew_id, venue_id, venue_name, starts_at, people, shared_at, attendance_deadline)
  values (me, s.crew_id, w.venue_id, title, t, 1+invited,
    case when invited>0 then now() end, case when invited>0 then now()+interval '30 minutes' end) returning id into p;
  insert into public.plan_members (plan_id, user_id)
  select p, v.user_id from public.vote_voters v where v.session_id = p_session and v.user_id <> me;
  update public.vote_sessions set plan_id = p, closes_at = least(closes_at, now()) where id = p_session;
  return p;
end $$;

revoke all on function public.plan_from_vote(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.plan_from_vote(uuid,timestamptz) to authenticated;

create or replace function public.visit_count_answer_v2(p_visit uuid,p_version int,p_confirm boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.visit_counts;
begin
 perform private.require_v2();
 select * into v from public.visits where id=p_visit for update;
 if not private.plan_access(v.plan_id,auth.uid(),true) then raise exception 'Nu participi la ieșire.'; end if;
 select * into c from private.visit_counts where visit_id=p_visit for update;
 if c.visit_id is null or c.version is distinct from p_version or c.state is distinct from 'awaiting' or c.deadline is null or c.deadline<=now() or p_confirm is null then raise exception 'Întrebarea nu mai este actuală.'; end if;
 update private.visit_counts set state=case when p_confirm then 'confirmed' else 'disputed' end where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $$;

revoke all on function public.visit_count_answer_v2(uuid,int,boolean) from public,anon,authenticated;
grant execute on function public.visit_count_answer_v2(uuid,int,boolean) to authenticated;

create or replace function public.admin_benefit_decide_v2(p_visit uuid,p_version int,p_uphold boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.benefit_cases;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.benefit_cases where visit_id=p_visit for update;
 if c.visit_id is null or c.state<>'pending' or c.version is distinct from p_version or p_uphold is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Versiune sau motiv invalid.';end if;
 if p_uphold and c.reporter is not null then
  perform 1 from public.profile_private where id=c.reporter for update;
  if not exists(select 1 from private.benefit_cases where reporter=c.reporter and compensated and decided_at>now()-interval '60 days') then
   perform set_config('cefaci.plus','on',true);update public.profile_private set plus_until=greatest(coalesce(plus_until,now()),now())+interval '7 days' where id=c.reporter;perform set_config('cefaci.plus','off',true);update private.benefit_cases set compensated=true where visit_id=p_visit;
  end if;
 end if;
 update private.benefit_cases set state=case when p_uphold then 'upheld' else 'dismissed' end,decision_reason=p_reason,decided_by=auth.uid(),decided_at=now(),version=version+1 where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'benefit',to_jsonb(c),to_jsonb(n),p_reason from private.benefit_cases n where visit_id=p_visit;
 -- Count eligibility is retained; refusal cannot convert eligible Drop persons to zero.
 update public.visits set proof=proof where id=p_visit;
end $$;

revoke all on function public.admin_benefit_decide_v2(uuid,int,boolean,text) from public,anon,authenticated;
grant execute on function public.admin_benefit_decide_v2(uuid,int,boolean,text) to authenticated;

create or replace function public.admin_count_resolve_v2(p_visit uuid,p_version int,p_people int,p_adults int,p_drop_adults int,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.visit_counts; s private.visit_pricing;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.visit_counts where visit_id=p_visit for update;select * into s from private.visit_pricing where visit_id=p_visit;
 if c.visit_id is null or c.version is distinct from p_version or p_people is null or p_people not between 1 and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,s.drop_limit) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Număr, versiune sau motiv invalid.';end if;
 update private.visit_counts set version=version+1,people=p_people,adults=p_adults,drop_adults=p_drop_adults,state='confirmed',reason=p_reason,by_user=auth.uid() where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'count',to_jsonb(c),to_jsonb(n),p_reason from private.visit_counts n where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $$;

revoke all on function public.admin_count_resolve_v2(uuid,int,int,int,int,text) from public,anon,authenticated;
grant execute on function public.admin_count_resolve_v2(uuid,int,int,int,int,text) to authenticated;

create or replace function public.biz_dashboard_v2(p_venue text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r text:=private.member_role(p_venue); data jsonb; cfg public.partners; plus_cfg private.plus_versions; today date:=private.work_day(now());
begin
 if r is null then raise exception 'Nu ești în echipa localului.'; end if;
 select * into cfg from public.partners where venue_id=p_venue for update;
 select * into plus_cfg from private.plus_versions where venue_id=p_venue and effective_date<=(now() at time zone 'Europe/Bucharest')::date order by effective_date desc limit 1;
 update public.reservations set status='expirată' where venue_id=p_venue and((status='propusă' and proposal_expires_at<=now()) or(status='cerută' and response_due_at<=now()));
 data:=jsonb_build_object('role',r,'day',today,'word',private.day_word(p_venue,today),'token',case when r in('proprietar','manager') then(select token from public.venue_codes where venue_id=p_venue)end,'partner',case when r in('proprietar','manager') then to_jsonb(cfg)-'created_by' else '{}'::jsonb end,'drops',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'pct_all',d.pct_all,'pct_plus',d.pct_plus,'seats',d.seats,'min_group',d.min_group,'taken',(select coalesce(sum(seats),0) from public.drop_claims where drop_id=d.id and(status='folosit' or(status='activ' and expires_at>now()))),'starts_at',d.starts_at,'ends_at',d.ends_at,'adult',d.adult,'new_only',d.new_only)) from public.drops d where d.venue_id=p_venue and stopped_at is null and ends_at>now()),'[]'));
 data:=data||jsonb_build_object('settings',jsonb_build_object('mode',cfg.reservation_mode,'on',cfg.reservations_on,'paused',cfg.venue_paused,'capacity',cfg.capacity,'duration',cfg.duration_minutes,'auto',cfg.auto_confirm_max,'hours',cfg.reservation_hours),
 'plus_program',case when r in('proprietar','manager') then jsonb_build_object('base_pct',case when plus_cfg.venue_id is null then cfg.plus_pct else plus_cfg.pct end,'current_schedule',coalesce(plus_cfg.schedule,'[]'::jsonb),'current_pct',private.plus_pct_at(p_venue,now()),'today_off',exists(select 1 from private.plus_off_days where venue_id=p_venue and day=(now() at time zone 'Europe/Bucharest')::date),'off_days_this_month',(select count(*) from private.plus_off_days where venue_id=p_venue and date_trunc('month',day)=date_trunc('month',now() at time zone 'Europe/Bucharest')),'next',(select to_jsonb(v)-'by_user' from private.plus_versions v where venue_id=p_venue and effective_date>(now() at time zone 'Europe/Bucharest')::date order by effective_date limit 1)) end,
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'name',p.first_name,'people',q.people,'kids',q.kids,'at',q.at,'status',q.status,'proposal_expires_at',q.proposal_expires_at,'response_due_at',q.response_due_at,'note',q.note) order by q.at) from public.reservations q left join public.profiles p on p.id=q.user_id where r<>'scanare' and q.venue_id=p_venue and q.at between now()-interval '3 hours' and now()+interval '30 days' and q.status in('cerută','confirmată','propusă')),'[]'),
 'visits',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',p.first_name,'kind',v.kind,'people',v.people,'table',v.table_no,'discount',v.discount_pct,'discount_people',v.discount_people,'scope',v.discount_scope,'plus',v.plus,'at',v.scanned_at,'day',v.work_day,'outcome',v.outcome,'closed_at',v.closed_at,'bill',case when r in('proprietar','manager') then v.bill end,'source',case when r in('proprietar','manager') then v.bill_source end,'count',to_jsonb(c)-'by_user','benefit',(select to_jsonb(b)-'reporter'-'decided_by' from private.benefit_cases b where b.visit_id=v.id),'drop_limit',s.drop_limit,'reservation_limit',s.reservation_limit) order by v.scanned_at) from public.visits v left join public.profiles p on p.id=v.user_id left join private.visit_counts c on c.visit_id=v.id left join private.visit_pricing s on s.visit_id=v.id where v.venue_id=p_venue and v.work_day between today-1 and today),'[]'),
 'statistics',jsonb_build_object('visits',(select count(*) from public.visits where venue_id=p_venue and work_day>=today-30),'people',(select coalesce(sum(c.people),0) from private.visit_counts c join public.visits v on v.id=c.visit_id where v.venue_id=p_venue and v.work_day>=today-30 and c.state='confirmed'),'unclosed',(select count(*) from public.visits where venue_id=p_venue and closed_at is null),'reservations',(select count(*) from public.reservations where venue_id=p_venue and created_at>now()-interval '30 days')));
 return data;
end $$;

revoke all on function public.biz_dashboard_v2(text) from public,anon,authenticated;
grant execute on function public.biz_dashboard_v2(text) to authenticated;

notify pgrst,'reload schema';
