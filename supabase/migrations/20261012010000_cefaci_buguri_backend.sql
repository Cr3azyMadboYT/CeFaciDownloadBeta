-- Buguri găsite la verificarea din 12.10 (backend):
-- 1. sesizarea „mi s-a refuzat reducerea” dădea o zi de Plus de fiecare dată → cel mult o dată pe săptămână, 4 în 60 de zile;
-- 2. o dispută de proprietate rămânea blocată dacă proprietarul actual nu deschidea ecranul → dacă nu deschide notificarea, după 7 zile echipa poate decide (când o deschide, are 3 zile întregi);
-- 3. „toți sunt copii” făcea rezervarea gratuită → cel puțin un adult plătitor;
-- 4. rezervările făcute de oamenii localului la propriul local nu se mai taxează;
-- 5. la un partener în pauză nu se mai aplică reducerea Plus la sosire.
create or replace function private.price_visit() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partners; nr int:=0; nd int:=0; r numeric:=0; d numeric:=0;
begin
 select * into p from public.partners where venue_id=new.venue_id;
 if new.reservation_id is not null then select greatest(people-kids,1) into nr from public.reservations where id=new.reservation_id; end if;
 if new.claim_id is not null then select seats into nd from public.drop_claims where id=new.claim_id; end if;
 if exists(select 1 from public.partner_members m where m.venue_id=new.venue_id and m.user_id=new.user_id) then nr:=0; nd:=0; end if;
 r:=coalesce((array[2,5,8])[p.price_tier],0); d:=coalesce((array[3,7,10])[p.price_tier],0);
 if p.founder then r:=greatest(0,r-1); d:=greatest(0,d-1); end if;
 insert into private.visit_pricing(visit_id,version,tier,founder,unit_fee,free,eligible_limit,firm,cui,reservation_unit,drop_unit,reservation_limit,drop_limit)
 values(new.id,'per-person-v2',p.price_tier,p.founder,case when new.kind='drop' then d when new.kind='rezervare' then r else 0 end,new.work_day<p.free_until,least(10,greatest(nr,nd)),p.firm,p.cui,r,d,coalesce(nr,0),coalesce(nd,0));
 return new;
end $$;

create or replace function private.arrive(p_plan uuid,p_staff boolean,p_table text) returns public.visits
language plpgsql security definer set search_path='' as $$
declare x public.plans; v public.visits; r public.reservations; c public.drop_claims; d public.drops; n int; pct int:=0; plus boolean;
begin
 select * into x from public.plans where id=p_plan for update;
 perform 1 from public.partners where venue_id=x.venue_id for update;
 if not p_staff and not private.plan_access(p_plan,auth.uid(),true) then raise exception 'Nu participi la plan.'; end if;
 if p_staff and private.member_role(x.venue_id) is null then raise exception 'Nu ești în echipa localului.'; end if;
 select * into v from public.visits where plan_id=p_plan;
 if v.id is not null then
  if p_staff then update public.visits set proof=case when proof='receipt' then proof else 'staff_ticket' end,table_no=coalesce(p_table,table_no) where id=v.id returning * into v; end if;
  if not p_staff then insert into private.visit_scanners values(v.id,auth.uid()) on conflict do nothing; end if;
  return v;
 end if;
 n:=private.attendance(p_plan); if n is null then raise exception 'Participarea nu este închisă.'; end if;
 select * into r from public.reservations where plan_id=p_plan and status='confirmată' and now() between at-interval '90 minutes' and at+interval '3 hours';
 select * into c from public.drop_claims where plan_id=p_plan and status='activ' and expires_at>now() for update;
 if c.id is not null then
  if now()<c.created_at+interval '10 minutes' then raise exception 'Sosirea cu Drop este după minimum 10 minute.'; end if;
  select * into d from public.drops where id=c.drop_id;
  if n<d.min_group then raise exception 'Grupul nu îndeplinește minimul ofertei.'; end if;
  update public.drop_claims set status='folosit',seats=least(seats,n) where id=c.id returning * into c;
 end if;
 if r.id is null and c.id is null and not(now() between x.starts_at-interval '90 minutes' and x.starts_at+interval '3 hours') then raise exception 'Biletul este în afara ferestrei de sosire.'; end if;
 if not exists(select 1 from public.partners where venue_id=x.venue_id and status<>'iesit') then raise exception 'Localul nu mai este partener.'; end if;
 plus:=private.group_plus(p_plan) or coalesce(c.plus_at_claim,false);
 if plus and exists(select 1 from public.partners where venue_id=x.venue_id and status='activ') then pct:=private.plus_pct_at(x.venue_id,x.starts_at); end if;
 if c.id is not null then pct:=greatest(pct,coalesce(c.claimed_pct,0)); end if;
 insert into public.visits(venue_id,user_id,plan_id,group_visit,kind,reservation_id,claim_id,people,table_no,discount_pct,plus,discount_scope,discount_people,work_day,proof)
 values(x.venue_id,x.owner_id,p_plan,true,case when c.id is not null then 'drop' when r.id is not null then 'rezervare' when plus and pct>0 then 'plus' else 'plan' end,r.id,c.id,n,p_table,pct,plus,
 case when c.id is not null and not plus then 'eligible_consumption' else 'bill' end,case when plus then n else coalesce(c.seats,0) end,private.work_day(coalesce(r.at,c.created_at,x.starts_at)),case when p_staff then 'staff_ticket' else 'client_location' end) returning * into v;
 if not p_staff then insert into private.visit_scanners values(v.id,auth.uid()) on conflict do nothing; end if;
 return v;
end $$;
revoke all on function private.arrive(uuid,boolean,text) from public,anon,authenticated;

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
 -- o zi de Plus cel mult o dată pe săptămână și de 4 ori în 60 de zile; restul așteaptă decizia echipei
 if not exists(select 1 from private.benefit_cases where reporter=auth.uid() and compensated and reported_at>now()-interval '7 days')
  and (select count(*) from private.benefit_cases where reporter=auth.uid() and compensated and reported_at>now()-interval '60 days')<4 then
  perform set_config('cefaci.plus','on',true);
  update public.profile_private set plus_until=greatest(coalesce(plus_until,now()),now())+interval '1 day' where id=auth.uid();
  perform set_config('cefaci.plus','off',true);
  update private.benefit_cases set compensated=true where visit_id=p_visit;
 end if;
 update public.visits set proof=proof where id=p_visit;
end $$;
revoke all on function public.visit_benefit_report_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.visit_benefit_report_v2(uuid,text) to authenticated;

create or replace function private.dispute_deadline() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='dispute' and new.status='pending' and new.owner_response_deadline is null then new.owner_response_deadline:=now()+interval '7 days'; end if;
 return new;
end $$;
revoke all on function private.dispute_deadline() from public,anon,authenticated;
create or replace trigger partner_requests_dispute_deadline before insert or update on private.partner_requests for each row execute function private.dispute_deadline();
