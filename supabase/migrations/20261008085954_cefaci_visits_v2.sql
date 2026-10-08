alter table public.visits add column plan_id uuid references public.plans(id) on delete set null,
 add column discount_scope text not null default 'bill' check(discount_scope in('bill','eligible_consumption')),
 add column discount_people int not null default 0,
 add column discount_amount numeric(10,2) check(discount_amount>=0),
 add column proof text not null default 'client_location' check(proof in('client_location','staff_ticket','receipt'));
alter table public.visits drop constraint visits_people_check;
alter table public.visits add constraint visits_people_check check(people between 1 and 500);
drop index public.visits_one_a_day;
create unique index visits_one_plan on public.visits(plan_id) where plan_id is not null;
create unique index visits_legacy_one_day on public.visits(user_id,venue_id,work_day) where plan_id is null;
create table private.group_tickets(plan_id uuid primary key references public.plans(id) on delete cascade,token text not null unique default replace(gen_random_uuid()::text,'-',''),expires_at timestamptz not null);
create table private.visit_scanners(visit_id uuid references public.visits(id),user_id uuid references public.profiles(id) on delete cascade,primary key(visit_id,user_id));
create table private.visit_counts(visit_id uuid primary key references public.visits(id),version int not null default 1,people int not null,adults int not null,drop_adults int not null,state text not null check(state in('confirmed','awaiting','disputed')),deadline timestamptz,reason text,by_user uuid references public.profiles(id) on delete set null);
alter table private.group_tickets enable row level security;
alter table private.visit_scanners enable row level security;
alter table private.visit_counts enable row level security;
revoke all on private.group_tickets,private.visit_scanners,private.visit_counts from public,anon,authenticated;
alter table private.visit_pricing add column reservation_unit numeric not null default 0,
 add column drop_unit numeric not null default 0,
 add column reservation_limit int not null default 0,
 add column drop_limit int not null default 0;

create or replace function private.price_visit() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partners; nr int:=0; nd int:=0; r numeric:=0; d numeric:=0;
begin
 select * into p from public.partners where venue_id=new.venue_id;
 if new.reservation_id is not null then select people-kids into nr from public.reservations where id=new.reservation_id; end if;
 if new.claim_id is not null then select seats into nd from public.drop_claims where id=new.claim_id; end if;
 r:=coalesce((array[2,5,8])[p.price_tier],0); d:=coalesce((array[3,7,10])[p.price_tier],0);
 if p.founder then r:=greatest(0,r-1); d:=greatest(0,d-1); end if;
 insert into private.visit_pricing(visit_id,version,tier,founder,unit_fee,free,eligible_limit,firm,cui,reservation_unit,drop_unit,reservation_limit,drop_limit)
 values(new.id,'per-person-v2',p.price_tier,p.founder,case when new.kind='drop' then d when new.kind='rezervare' then r else 0 end,new.work_day<p.free_until,least(10,greatest(nr,nd)),p.firm,p.cui,r,d,coalesce(nr,0),coalesce(nd,0));
 return new;
end $$;

create or replace function public.plan_ticket_v2(p_plan uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare x public.plans; n int; ticket private.group_tickets; expiry timestamptz;
begin
 select * into x from public.plans where id=p_plan for update;
 if not private.plan_access(p_plan,auth.uid(),true) then raise exception 'Doar participanții confirmați au bilet.'; end if;
 n:=private.attendance(p_plan); if n is null then raise exception 'Așteptăm răspunsurile grupului.'; end if;
 expiry:=greatest(x.starts_at+interval '3 hours',coalesce((select max(c.expires_at) from public.drop_claims c where plan_id=p_plan and status='activ'),x.starts_at));
 insert into private.group_tickets(plan_id,expires_at) values(p_plan,expiry) on conflict(plan_id) do update set expires_at=excluded.expires_at returning * into ticket;
 return jsonb_build_object('plan',p_plan,'token',ticket.token,'expires_at',ticket.expires_at,'people',n);
end $$;
revoke all on function public.plan_ticket_v2(uuid) from public,anon,authenticated;
grant execute on function public.plan_ticket_v2(uuid) to authenticated;

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
 if plus then pct:=private.plus_pct_at(x.venue_id,x.starts_at); end if;
 if c.id is not null then pct:=greatest(pct,coalesce(c.claimed_pct,0)); end if;
 insert into public.visits(venue_id,user_id,plan_id,kind,reservation_id,claim_id,people,table_no,discount_pct,plus,discount_scope,discount_people,work_day,proof)
 values(x.venue_id,x.owner_id,p_plan,case when c.id is not null then 'drop' when r.id is not null then 'rezervare' when plus and pct>0 then 'plus' else 'plan' end,r.id,c.id,n,p_table,pct,plus,
 case when c.id is not null and not plus then 'eligible_consumption' else 'bill' end,case when plus then n else coalesce(c.seats,0) end,private.work_day(coalesce(r.at,c.created_at,x.starts_at)),case when p_staff then 'staff_ticket' else 'client_location' end) returning * into v;
 if not p_staff then insert into private.visit_scanners values(v.id,auth.uid()) on conflict do nothing; end if;
 return v;
end $$;
revoke all on function private.arrive(uuid,boolean,text) from public,anon,authenticated;

create or replace function public.visit_client_arrive_v2(p_plan uuid,p_token text,p_lat double precision,p_lon double precision) returns public.visits
language plpgsql security definer set search_path='' as $$
declare pos public.venues; venue text;
begin
 select venue_id into venue from public.venue_codes where token=trim(p_token);
 if venue is null or venue is distinct from(select venue_id from public.plans where id=p_plan) then raise exception 'Codul nu este al localului din bilet.'; end if;
 select * into pos from public.venues where id=venue;
 if pos.id is null or p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 or private.km(p_lat,p_lon,pos.lat,pos.lon)>0.250 then raise exception 'Scanează când ești la local, cu locația pornită.'; end if;
 return private.arrive(p_plan,false,null);
end $$;
revoke all on function public.visit_client_arrive_v2(uuid,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.visit_client_arrive_v2(uuid,text,double precision,double precision) to authenticated;

create or replace function public.biz_scan_v2(p_venue text,p_ticket text,p_table text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.group_tickets; v public.visits; name text;
begin
 if auth.uid() is null or private.member_role(p_venue) is null then raise exception 'Nu ești în echipa localului.'; end if;
 select * into t from private.group_tickets where token=trim(p_ticket);
 if t.plan_id is null or t.expires_at<=now() or not exists(select 1 from public.plans where id=t.plan_id and venue_id=p_venue and status='active') then raise exception 'Cod greșit, expirat sau pentru alt local.'; end if;
 v:=private.arrive(t.plan_id,true,p_table);
 select first_name into name from public.profiles where id=v.user_id;
 return jsonb_build_object('visit',v.id,'name',name,'people',v.people,'discount',v.discount_pct,'scope',v.discount_scope,'discount_people',v.discount_people,'plus',v.plus,'table',v.table_no,'word',private.day_word(v.venue_id,v.work_day));
end $$;
revoke all on function public.biz_scan_v2(text,text,text) from public,anon,authenticated;
grant execute on function public.biz_scan_v2(text,text,text) to authenticated;

create or replace function public.biz_close_v2(p_visit uuid,p_people int,p_adults int,p_drop_adults int,p_bill numeric,p_discount numeric,p_reason text default null) returns int
language plpgsql security definer set search_path='' as $$
declare v public.visits; cfg private.visit_counts; snapshot private.visit_pricing; state text; scans int; ver int;
begin
 select * into v from public.visits where id=p_visit for update;
 if v.id is null or coalesce(private.member_role(v.venue_id),'') not in('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
 if now()>((v.work_day+1)::timestamp+time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Termenul de închidere a trecut.'; end if;
 select * into snapshot from private.visit_pricing where visit_id=p_visit;
 select count(*) into scans from private.visit_scanners where visit_id=p_visit;
 if p_people is null or p_people not between greatest(1,scans) and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,snapshot.drop_limit) or p_bill<0 or p_bill>=100000 or p_discount<0 then raise exception 'Număr sau sumă invalidă.'; end if;
 select * into cfg from private.visit_counts where visit_id=p_visit;
 if cfg.visit_id is not null and (cfg.people,cfg.adults,cfg.drop_adults,coalesce(v.declared,-1),coalesce(v.discount_amount,-1)) is not distinct from (p_people,p_adults,p_drop_adults,coalesce(p_bill,-1),coalesce(p_discount,-1)) then return cfg.version; end if;
 state:=case when p_people<v.people or p_adults<greatest(0,v.people-coalesce((select kids from public.reservations where id=v.reservation_id),0)) or p_drop_adults<least(p_adults,snapshot.drop_limit) then 'awaiting' else 'confirmed' end;
 if state='awaiting' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Scrie motivul diferenței de număr.'; end if;
 ver:=coalesce(cfg.version,0)+1;
 insert into private.visit_counts(visit_id,version,people,adults,drop_adults,state,deadline,reason,by_user)
 values(p_visit,ver,p_people,p_adults,p_drop_adults,state,case when state='awaiting' then now()+interval '24 hours' end,p_reason,auth.uid())
 on conflict(visit_id) do update set version=excluded.version,people=excluded.people,adults=excluded.adults,drop_adults=excluded.drop_adults,state=excluded.state,deadline=excluded.deadline,reason=excluded.reason,by_user=excluded.by_user;
 update public.visits set outcome='a venit',declared=p_bill,bill=case when bill_source='bon' then bill else p_bill end,
 bill_source=case when bill_source='bon' then 'bon' when p_bill is not null then 'local' end,discount_amount=case when bill_source='bon' then coalesce(discount_amount,p_discount) else coalesce(p_discount,discount_amount) end,closed_by=auth.uid(),closed_at=now() where id=p_visit;
 return ver;
end $$;
revoke all on function public.biz_close_v2(uuid,int,int,int,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.biz_close_v2(uuid,int,int,int,numeric,numeric,text) to authenticated;

create or replace function public.visit_count_answer_v2(p_visit uuid,p_version int,p_confirm boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.visit_counts;
begin
 select * into v from public.visits where id=p_visit for update;
 if not private.plan_access(v.plan_id,auth.uid(),true) then raise exception 'Nu participi la ieșire.'; end if;
 select * into c from private.visit_counts where visit_id=p_visit for update;
 if c.version<>p_version or c.state<>'awaiting' or c.deadline<=now() or p_confirm is null then raise exception 'Întrebarea nu mai este actuală.'; end if;
 update private.visit_counts set state=case when p_confirm then 'confirmed' else 'disputed' end where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $$;
revoke all on function public.visit_count_answer_v2(uuid,int,boolean) from public,anon,authenticated;
grant execute on function public.visit_count_answer_v2(uuid,int,boolean) to authenticated;

create or replace function public.plan_state_v2(p_plan uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare attendance jsonb;
begin
 if not private.plan_access(p_plan,auth.uid()) then raise exception 'Nu ai acces la plan.'; end if;
 if exists(select 1 from public.plans where id=p_plan and status='active') then attendance:=public.plan_attendance(p_plan); end if;
 return jsonb_build_object('attendance',attendance,'reservation',(select to_jsonb(r)-'user_id'-'decided_by' from public.reservations r where plan_id=p_plan order by created_at desc limit 1),
 'claim',(select to_jsonb(c)-'user_id' from public.drop_claims c where plan_id=p_plan order by created_at desc limit 1),
 'visit',(select to_jsonb(v)-'user_id'-'closed_by' from public.visits v where plan_id=p_plan),
 'count',(select to_jsonb(c)-'by_user' from private.visit_counts c join public.visits v on v.id=c.visit_id where v.plan_id=p_plan));
end $$;
revoke all on function public.plan_state_v2(uuid) from public,anon,authenticated;
grant execute on function public.plan_state_v2(uuid) to authenticated;

create or replace function private.visit_fees(v text,d0 date,d1 date)
returns table(visit_id uuid,work_day date,kind text,bill numeric,bill_source text,fee numeric,free boolean)
language sql stable security definer set search_path='' as $$
 select x.id,x.work_day,x.kind,x.bill,x.bill_source,
 case when s.version='per-person-v2' then
  s.drop_unit*least(10,c.drop_adults,s.drop_limit) + s.reservation_unit*least(greatest(0,10-least(c.drop_adults,s.drop_limit)),greatest(0,c.adults-least(c.drop_adults,s.drop_limit)),s.reservation_limit)
 else s.unit_fee*least(s.eligible_limit,a.adults,case when x.kind='drop' then a.discounted else a.adults end) end,s.free
 from public.visits x join private.visit_pricing s on s.visit_id=x.id
 left join private.visit_counts c on c.visit_id=x.id left join private.visit_attendance a on a.visit_id=x.id
 where x.venue_id=v and x.work_day between d0 and d1 and x.kind in('rezervare','drop') and s.tier is not null and x.outcome='a venit' and x.closed_at is not null
 and ((s.version='per-person-v2' and c.state='confirmed') or(s.version<>'per-person-v2' and a.visit_id is not null))
$$;

create or replace function public.biz_finance_v2(p_venue text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipts numeric; reductions numeric; commission numeric; missing int; blocked int;
begin
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') and not private.can('money') and not private.can('partners') then raise exception 'Nu ai voie.'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Perioadă invalidă.'; end if;
 select coalesce(sum(bill),0),coalesce(sum(discount_amount),0),count(*) filter(where bill is null or discount_amount is null or closed_at is null) into receipts,reductions,missing from public.visits where venue_id=p_venue and work_day between p_from and p_to and outcome<>'n-a venit';
 select coalesce(sum(fee) filter(where not free),0) into commission from private.visit_fees(p_venue,p_from,p_to);
 select count(*) into blocked from public.visits x left join private.visit_counts c on c.visit_id=x.id left join private.visit_pricing s on s.visit_id=x.id where x.venue_id=p_venue and x.work_day between p_from and p_to and x.kind in('rezervare','drop') and x.outcome<>'n-a venit' and ((s.version='per-person-v2' and c.state is distinct from 'confirmed') or (s.version<>'per-person-v2' and not exists(select 1 from private.visit_attendance where visit_id=x.id)) or s.tier is null or x.closed_at is null);
  return jsonb_build_object('billing_ready',false,'estimate',true,'partial',missing>0 or blocked>0,'missing',missing,'blocked',blocked,'revenue',receipts,'discounts',reductions,'fee',commission,'remaining',case when missing=0 and blocked=0 then receipts-commission end,
 'would_pay',(select coalesce(sum(fee) filter(where free),0) from private.visit_fees(p_venue,p_from,p_to)),
 'visits',(select count(*) from public.visits where venue_id=p_venue and work_day between p_from and p_to),
 'lines',coalesce((select jsonb_agg(jsonb_build_object('visit',f.visit_id,'day',f.work_day,'kind',f.kind,'bill',f.bill,'fee',case when f.free then 0 else f.fee end,'would_pay',case when f.free then f.fee else 0 end,'free',f.free,'calculation',jsonb_build_object('reservation_unit',s.reservation_unit,'drop_unit',s.drop_unit,'reservation_limit',s.reservation_limit,'drop_limit',s.drop_limit,'adults',c.adults,'drop_adults',c.drop_adults))) from private.visit_fees(p_venue,p_from,p_to) f join private.visit_pricing s on s.visit_id=f.visit_id left join private.visit_counts c on c.visit_id=f.visit_id),'[]'));
end $$;
revoke all on function public.biz_finance_v2(text,date,date) from public,anon,authenticated;
grant execute on function public.biz_finance_v2(text,date,date) to authenticated;
