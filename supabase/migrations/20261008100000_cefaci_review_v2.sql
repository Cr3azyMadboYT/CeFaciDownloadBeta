-- Operational pause is reversible and preserves all V2 history; never re-enable bypassing V1 writes.
create table private.v2_release(id boolean primary key default true check(id),writes_on boolean not null default true);
insert into private.v2_release values(true,true);
alter table private.v2_release enable row level security;
revoke all on private.v2_release from public,anon,authenticated;
create or replace function private.require_v2() returns void language plpgsql security definer set search_path='' as $$begin if not(select writes_on from private.v2_release where id) then raise exception 'Operațiunile sunt în mentenanță. Istoricul rămâne disponibil.'; end if; end $$;
revoke all on function private.require_v2() from public,anon,authenticated;

create or replace function public.visit_benefit_report_v2(p_visit uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 perform private.require_v2();select * into v from public.visits where id=p_visit for update;
 if v.id is null or not private.plan_access(v.plan_id,auth.uid(),true) or v.discount_pct<=0 or now()>v.scanned_at+interval '24 hours' then raise exception 'Vizita nu este eligibilă pentru această sesizare.'; end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'Descrie ce reducere a fost refuzată.'; end if;
 if exists(select 1 from private.benefit_cases where visit_id=p_visit) then return; end if;
 insert into private.benefit_cases(visit_id,reason,reporter) values(p_visit,p_reason,auth.uid());
 -- Current Plus is a non-paid trial; one compensation per outing, independent of repeated participants.
 perform 1 from public.profile_private where id=auth.uid() for update;
 perform set_config('cefaci.plus','on',true);
 update public.profile_private set plus_until=greatest(coalesce(plus_until,now()),now())+interval '1 day' where id=auth.uid();
 perform set_config('cefaci.plus','off',true);
 update public.visits set proof=proof where id=p_visit;
end $$;
revoke all on function public.visit_benefit_report_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.visit_benefit_report_v2(uuid,text) to authenticated;

create or replace function public.biz_benefit_reply_v2(p_visit uuid,p_reply text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 perform private.require_v2();select * into v from public.visits where id=p_visit for update;
 if coalesce(private.member_role(v.venue_id),'') not in('proprietar','manager') or length(trim(coalesce(p_reply,''))) not between 5 and 1000 then raise exception 'Nu ai voie sau lipsește răspunsul.'; end if;
 update private.benefit_cases set reply=p_reply where visit_id=p_visit and state='pending';if not found then raise exception 'Cazul nu mai așteaptă răspuns.';end if;
 update public.visits set proof=proof where id=p_visit;
end $$;
revoke all on function public.biz_benefit_reply_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.biz_benefit_reply_v2(uuid,text) to authenticated;

create or replace function public.admin_benefit_decide_v2(p_visit uuid,p_version int,p_uphold boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.benefit_cases;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.benefit_cases where visit_id=p_visit for update;
 if c.visit_id is null or c.state<>'pending' or c.version<>p_version or p_uphold is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Versiune sau motiv invalid.';end if;
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
 if c.visit_id is null or c.version<>p_version or p_people is null or p_people not between 1 and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,s.drop_limit) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Număr, versiune sau motiv invalid.';end if;
 update private.visit_counts set version=version+1,people=p_people,adults=p_adults,drop_adults=p_drop_adults,state='confirmed',reason=p_reason,by_user=auth.uid() where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'count',to_jsonb(c),to_jsonb(n),p_reason from private.visit_counts n where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $$;
revoke all on function public.admin_count_resolve_v2(uuid,int,int,int,int,text) from public,anon,authenticated;
grant execute on function public.admin_count_resolve_v2(uuid,int,int,int,int,text) to authenticated;
notify pgrst,'reload schema';

create or replace function public.plan_expire_mine_v2() returns void language plpgsql security definer set search_path='' as $$declare p uuid;begin if auth.uid() is null then raise exception 'Intră în cont.';end if;for p in select x.id from public.plans x where x.status='active' and x.attendance_closed_at is null and x.attendance_deadline<=now() and private.plan_access(x.id,auth.uid()) order by x.id loop perform private.attendance(p);end loop;end $$;
revoke all on function public.plan_expire_mine_v2() from public,anon,authenticated;
grant execute on function public.plan_expire_mine_v2() to authenticated;
