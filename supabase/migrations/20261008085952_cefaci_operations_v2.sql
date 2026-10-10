-- Existing contracts remain unchanged. Capacity defaults to zero until the venue configures it.
alter table public.partners add column reservation_mode text not null default 'recommended' check(reservation_mode in ('required','recommended','none')),
 add column venue_paused boolean not null default false,
 add column capacity int not null default 0 check(capacity between 0 and 5000),
 add column duration_minutes int not null default 120 check(duration_minutes between 30 and 480),
 add column reservation_hours jsonb not null default '[]';
create table private.plus_versions(venue_id text not null references public.partners(venue_id),effective_date date not null,pct int check(pct in(10,15,20)),schedule jsonb not null default '[]',by_user uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),primary key(venue_id,effective_date));
create table private.plus_off_days(venue_id text not null references public.partners(venue_id),day date not null,by_user uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),primary key(venue_id,day));
alter table private.plus_versions enable row level security;
alter table private.plus_off_days enable row level security;
revoke all on private.plus_versions,private.plus_off_days from public,anon,authenticated;

create or replace function private.plus_pct_at(v text,t timestamptz) returns int
language plpgsql stable security definer set search_path='' as $$
declare outing_day date:=(t at time zone 'Europe/Bucharest')::date; cfg private.plus_versions; base int; rule jsonb; local_ts timestamp:=t at time zone 'Europe/Bucharest'; interval_day date;
begin
 if exists(select 1 from private.plus_off_days where venue_id=v and plus_off_days.day=outing_day) then return 0; end if;
 select * into cfg from private.plus_versions where venue_id=v and effective_date<=outing_day order by effective_date desc limit 1;
 if cfg.venue_id is null then select plus_pct into base from public.partners where venue_id=v; else base:=cfg.pct; end if;
 for rule in select value from jsonb_array_elements(coalesce(cfg.schedule,'[]')) loop
  foreach interval_day in array array[local_ts::date-1,local_ts::date] loop
   if (rule->>'day')::int=extract(isodow from interval_day) and local_ts >= interval_day+(rule->>'from')::time and local_ts < interval_day+(case when (rule->>'to')::time<=(rule->>'from')::time then 1 else 0 end)+(rule->>'to')::time then return (rule->>'pct')::int;end if;
  end loop;
 end loop;
 return coalesce(base,0);
end $$;
revoke all on function private.plus_pct_at(text,timestamptz) from public,anon,authenticated;

create or replace function public.biz_settings_v2(p_venue text,p_mode text,p_on boolean,p_paused boolean,p_capacity int,p_duration int,p_auto int,p_hours jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare h jsonb;
begin
 perform private.require_v2();
 perform 1 from public.partners where venue_id=p_venue for update;
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if p_capacity not between 0 and 5000 or p_duration not between 30 and 480 or p_auto not between 0 and 7 then raise exception 'Capacitate, durată sau auto-confirmare invalidă.'; end if;
 if p_mode is null or p_mode not in('required','recommended','none') or p_on is null or p_paused is null or p_capacity is null or p_duration is null or p_auto is null or p_hours is null or jsonb_typeof(p_hours)<>'array' then raise exception 'Setări invalide.'; end if;
 for h in select value from jsonb_array_elements(p_hours) loop
  if h->>'day' is null or h->>'from' is null or h->>'to' is null or not(h ?& array['day','from','to']) or (h->>'day')::int not between 1 and 7 or (h->>'from')::time = (h->>'to')::time then raise exception 'Interval invalid.'; end if;
 end loop;
 insert into public.venue_log(venue_id,by_user,action,before,after) select p_venue,auth.uid(),'partener',jsonb_build_object('capacity',capacity,'mode',reservation_mode),jsonb_build_object('capacity',p_capacity,'mode',p_mode) from public.partners where venue_id=p_venue;
 update public.partners set reservation_mode=p_mode,reservations_on=p_on,venue_paused=p_paused,capacity=p_capacity,duration_minutes=p_duration,auto_confirm_max=p_auto,reservation_hours=p_hours where venue_id=p_venue;
end $$;
revoke all on function public.biz_settings_v2(text,text,boolean,boolean,int,int,int,jsonb) from public,anon,authenticated;
grant execute on function public.biz_settings_v2(text,text,boolean,boolean,int,int,int,jsonb) to authenticated;

create or replace function public.biz_plus_v2(p_venue text,p_pct int,p_schedule jsonb) returns date
language plpgsql security definer set search_path='' as $$
declare tomorrow date:=((now() at time zone 'Europe/Bucharest')::date+1); r jsonb;
begin
 perform private.require_v2();
 perform 1 from public.partners where venue_id=p_venue for update;
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if p_pct is not null and p_pct not in(10,15,20) or p_schedule is null or jsonb_typeof(p_schedule)<>'array' or jsonb_array_length(p_schedule)>100 then raise exception 'Program Plus invalid.'; end if;
 for r in select value from jsonb_array_elements(p_schedule) loop
  if r->>'day' is null or r->>'from' is null or r->>'to' is null or r->>'pct' is null or not(r ?& array['day','from','to','pct']) or (r->>'day')::int not between 1 and 7 or (r->>'pct')::int not in(0,10,15,20) or (r->>'from')::time = (r->>'to')::time then raise exception 'Interval Plus invalid.'; end if;
 end loop;
 insert into private.plus_versions(venue_id,effective_date,pct,schedule,by_user) values(p_venue,tomorrow,p_pct,p_schedule,auth.uid()) on conflict(venue_id,effective_date) do update set pct=excluded.pct,schedule=excluded.schedule,by_user=excluded.by_user;
 insert into public.venue_log(venue_id,by_user,action,after) values(p_venue,auth.uid(),'partener',jsonb_build_object('plus_effective',tomorrow,'pct',p_pct,'schedule',p_schedule));
 return tomorrow;
end $$;
revoke all on function public.biz_plus_v2(text,int,jsonb) from public,anon,authenticated;
grant execute on function public.biz_plus_v2(text,int,jsonb) to authenticated;

create or replace function public.biz_plus_off_today(p_venue text) returns void
language plpgsql security definer set search_path='' as $$
declare d date:=(now() at time zone 'Europe/Bucharest')::date;
begin
 perform private.require_v2();
 perform 1 from public.partners where venue_id=p_venue for update;
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if exists(select 1 from private.plus_off_days where venue_id=p_venue and day=d) then return; end if;
 if (now() at time zone 'Europe/Bucharest')::time>=time '16:00' then raise exception 'Plus poate fi oprit azi doar înainte de 16:00.'; end if;
 if (select count(*) from private.plus_off_days where venue_id=p_venue and date_trunc('month',day)=date_trunc('month',d))>=4 then raise exception 'Ai folosit cele patru zile din lună.'; end if;
 insert into private.plus_off_days values(p_venue,d,auth.uid(),now());
end $$;
revoke all on function public.biz_plus_off_today(text) from public,anon,authenticated;
grant execute on function public.biz_plus_off_today(text) to authenticated;

create or replace function public.partner_catalog(p_at timestamptz default now()) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('venue_id',venue_id,'partner',status='activ','discoverable',not venue_paused and not(reservation_mode='required' and not reservations_on),
 'mode',reservation_mode,'reservations_on',reservations_on and status='activ','plus_pct',private.plus_pct_at(venue_id,p_at))), '[]') from public.partners
$$;
revoke all on function public.partner_catalog(timestamptz) from public,anon,authenticated;
grant execute on function public.partner_catalog(timestamptz) to anon,authenticated;

alter table public.reservations drop constraint reservations_kids_check;
alter table public.reservations add constraint reservations_kids_check check(kids between 0 and 500 and kids<=people);
alter table public.reservations add column plan_id uuid references public.plans(id) on delete set null,
 add column duration_minutes int not null default 120,
 add column proposal_expires_at timestamptz,
 add column response_due_at timestamptz,
 add column request_key text;
alter table public.reservations drop constraint reservations_people_check;
alter table public.reservations add constraint reservations_people_check check(people between 1 and 500);
alter table public.reservations drop constraint reservations_status_check;
alter table public.reservations add constraint reservations_status_check check(status in('cerută','confirmată','refuzată','anulată','propusă','expirată'));
create unique index reservations_active_plan on public.reservations(plan_id) where plan_id is not null and status in('cerută','confirmată','propusă');
create unique index reservations_request_key on public.reservations(user_id,request_key) where request_key is not null;
create index reservations_capacity on public.reservations(venue_id,at) where status in('confirmată','propusă');

create or replace function private.capacity_ok(v text,t timestamptz,n int,duration int,skip uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare pr public.partners; point timestamptz; used int; local_ts timestamp; h jsonb; valid boolean; interval_day date; open_at timestamptz; close_at timestamptz;
begin
 select * into pr from public.partners where venue_id=v for update;
 if pr.capacity<n then return false; end if;
 -- Test occupancy at the requested start and every overlapping reservation start, not a sum of non-overlapping tables.
 for point in select t union select at from public.reservations where venue_id=v and at>t and at<t+make_interval(mins=>duration) and id is distinct from skip and status in('confirmată','propusă') loop
  select coalesce(sum(people),0) into used from public.reservations where venue_id=v and id is distinct from skip and status in('confirmată','propusă') and (status<>'propusă' or proposal_expires_at>now()) and at<=point and at+make_interval(mins=>duration_minutes)>point;
  if used+n>pr.capacity then return false; end if;
 end loop;
 -- Hours must cover the entire occupancy interval; [] means capacity has not been opened.
 local_ts:=t at time zone 'Europe/Bucharest'; valid:=false;
 for h in select value from jsonb_array_elements(pr.reservation_hours) loop
  foreach interval_day in array array[local_ts::date-1,local_ts::date] loop
   open_at:=(interval_day+(h->>'from')::time) at time zone 'Europe/Bucharest';
   close_at:=(interval_day+(case when (h->>'to')::time<=(h->>'from')::time then 1 else 0 end)+(h->>'to')::time) at time zone 'Europe/Bucharest';
   if (h->>'day')::int=extract(isodow from interval_day) and t>=open_at and t+make_interval(mins=>duration)<=close_at then valid:=true;end if;
  end loop;
 end loop;
 return valid;
end $$;
revoke all on function private.capacity_ok(text,timestamptz,int,int,uuid) from public,anon,authenticated;

create or replace function public.reservation_request_v2(p_plan uuid,p_key text,p_kids int default 0,p_note text default null) returns public.reservations
language plpgsql security definer set search_path='' as $$
declare x public.plans; pr public.partners; r public.reservations; n int; auto boolean;
begin
 perform private.require_v2();
 select * into x from public.plans where id=p_plan for update;
 if x.owner_id is distinct from auth.uid() or auth.uid() is null then raise exception 'Doar organizatorul rezervă.'; end if;
 if p_key is null or length(p_key) not between 1 and 100 then raise exception 'Cheie invalidă.'; end if;
 perform pg_advisory_xact_lock(hashtext('reservation-user.'||auth.uid()));
 select * into pr from public.partners where venue_id=x.venue_id for update;
 update public.reservations set status='expirată' where plan_id=p_plan and ((status='propusă' and proposal_expires_at<=now()) or(status='cerută' and response_due_at<=now()));
 select * into r from public.reservations where user_id=auth.uid() and request_key=p_key;
 if r.id is not null then if r.plan_id is distinct from p_plan then raise exception 'Cheia aparține altei ieșiri.';end if; return r; end if;
 select * into r from public.reservations where plan_id=p_plan and status in('cerută','confirmată','propusă');
 if r.id is not null then return r; end if;
 n:=private.attendance(p_plan);
 if n is null then raise exception 'Așteptăm toate răspunsurile sau termenul de 30 de minute.'; end if;
 if pr.venue_id is null or pr.status<>'activ' or pr.venue_paused or not pr.reservations_on or pr.reservation_mode='none' then raise exception 'Localul nu primește rezervări noi.'; end if;
 if p_kids is null or p_kids<0 or p_kids>n or x.starts_at<now()+interval '15 minutes' or x.starts_at>now()+interval '30 days' then raise exception 'Verifică ora și copiii sub 12 ani.'; end if;
 if (select count(*) from public.reservations where user_id=auth.uid() and created_at>now()-interval '1 day')>=4 or
 (select count(*) from public.reservations where user_id=auth.uid() and at>now() and status in('cerută','confirmată','propusă') and (status<>'propusă' or proposal_expires_at>now()))>=2 then raise exception 'Ai atins limita rezervărilor.'; end if;
 if not private.capacity_ok(x.venue_id,x.starts_at,n,pr.duration_minutes) then raise exception 'Nu mai sunt locuri în intervalul ales.'; end if;
 auto:=n<8 and n<=pr.auto_confirm_max and exists(select 1 from auth.users where id=auth.uid() and created_at<now()-interval '7 days');
 insert into public.reservations(venue_id,user_id,plan_id,people,kids,at,note,duration_minutes,status,request_key,response_due_at)
 values(x.venue_id,auth.uid(),p_plan,n,p_kids,x.starts_at,p_note,pr.duration_minutes,case when auto then 'confirmată' else 'cerută' end,p_key,now()+interval '15 minutes') returning * into r;
 return r;
end $$;
revoke all on function public.reservation_request_v2(uuid,text,int,text) from public,anon,authenticated;
grant execute on function public.reservation_request_v2(uuid,text,int,text) to authenticated;

create or replace function public.reservation_decide_v2(p_id uuid,p_action text,p_at timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 perform private.require_v2();
 -- Same lock order as client: plan, venue, reservation.
 perform 1 from public.plans where id=(select plan_id from public.reservations where id=p_id) for update;
 perform 1 from public.partners where venue_id=(select venue_id from public.reservations where id=p_id) for update;
 select * into r from public.reservations where id=p_id for update;
 if r.id is null or coalesce(private.member_role(r.venue_id),'') not in('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
 if p_action='confirm' and r.status='confirmată' or p_action='decline' and r.status='refuzată' then return; end if;
 if r.status not in('cerută','propusă') or r.response_due_at<=now() or (r.status='propusă' and r.proposal_expires_at<=now()) then raise exception 'Cererea nu mai așteaptă răspuns.'; end if;
 if p_action='decline' then update public.reservations set status='refuzată',decided_by=auth.uid(),decided_at=now() where id=p_id; return; end if;
 if p_action='confirm' and (r.status<>'cerută' or p_at is not null) then raise exception 'Clientul trebuie să accepte ora propusă.'; end if;
 if p_action is null or p_action not in('confirm','propose') or p_action='propose' and (p_at is null or p_at<now()+interval '15 minutes' or p_at>now()+interval '30 days') then raise exception 'Decizie invalidă.'; end if;
 if not private.capacity_ok(r.venue_id,coalesce(p_at,r.at),r.people,r.duration_minutes,r.id) then raise exception 'Nu mai sunt locuri în interval.'; end if;
 update public.reservations set status=case when p_action='propose' then 'propusă' else 'confirmată' end,at=coalesce(p_at,at),proposal_expires_at=case when p_action='propose' then now()+interval '15 minutes' end,decided_by=auth.uid(),decided_at=now() where id=p_id;
end $$;
revoke all on function public.reservation_decide_v2(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reservation_decide_v2(uuid,text,timestamptz) to authenticated;

create or replace function public.reservation_proposal_answer(p_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 perform private.require_v2();
 perform 1 from public.plans where id=(select plan_id from public.reservations where id=p_id) for update;
 perform 1 from public.partners where venue_id=(select venue_id from public.reservations where id=p_id) for update;
 select * into r from public.reservations where id=p_id for update;
 if r.id is null or auth.uid() is null or r.user_id is distinct from auth.uid() then raise exception 'Nu ai voie.'; end if;
 if r.status='confirmată' and p_accept then return; end if;
 if r.status<>'propusă' or r.proposal_expires_at<=now() then raise exception 'Propunerea a expirat.'; end if;
 if p_accept is null then raise exception 'Alege un răspuns.'; end if;
 update public.reservations set status=case when p_accept then 'confirmată' else 'anulată' end where id=p_id;
 if p_accept then update public.plans set starts_at=r.at where id=r.plan_id; end if;
end $$;
revoke all on function public.reservation_proposal_answer(uuid,boolean) from public,anon,authenticated;
grant execute on function public.reservation_proposal_answer(uuid,boolean) to authenticated;

create or replace function public.plan_edit_v2(p_plan uuid,p_at timestamptz,p_people int) returns void
language plpgsql security definer set search_path='' as $$
declare x public.plans;
begin
 perform private.require_v2();
 select * into x from public.plans where id=p_plan for update;
 if auth.uid() is null or x.owner_id is distinct from auth.uid() then raise exception 'Nu ai voie.'; end if;
 if x.status<>'active' or p_people is null or p_people not between 1 and 500 or p_at is null or p_at<now()-interval '6 hours' or p_at>now()+interval '1 year' then raise exception 'Plan invalid.'; end if;
 if exists(select 1 from public.visits where plan_id=p_plan) or exists(select 1 from public.drop_claims where plan_id=p_plan and status='activ' and expires_at>now()) or exists(select 1 from public.reservations where plan_id=p_plan and status in('cerută','confirmată','propusă')) or exists(select 1 from public.visits where reservation_id in(select id from public.reservations where plan_id=p_plan)) then raise exception 'Anulează rezervarea înainte de modificare.'; end if;
 if x.shared_at is not null and p_people<>x.people then raise exception 'Numărul unui plan trimis vine din participare.'; end if;
 update public.plans set starts_at=p_at,people=p_people,
 guests=case when shared_at is null then p_people-1 else guests end,
 guest_ages=case when shared_at is null and people<>p_people then '{}'::int[] else guest_ages end where id=p_plan;
end $$;
revoke all on function public.plan_edit_v2(uuid,timestamptz,int) from public,anon,authenticated;
grant execute on function public.plan_edit_v2(uuid,timestamptz,int) to authenticated;

alter table public.drops add column immediate boolean not null default false,add column request_key text;
create unique index drops_request_key on public.drops(venue_id,request_key) where request_key is not null;
alter table public.drop_claims add column plan_id uuid references public.plans(id) on delete set null,
 add column plus_at_claim boolean not null default false,
 add column claimed_pct int,
 add column request_key text;
create unique index drop_claim_key on public.drop_claims(user_id,request_key) where request_key is not null;
create unique index drop_claim_active_plan on public.drop_claims(plan_id) where status='activ' and plan_id is not null;
create table private.claim_members(claim_id uuid not null references public.drop_claims(id),user_id uuid references public.profiles(id) on delete cascade,primary key(claim_id,user_id));
alter table private.claim_members enable row level security;
revoke all on private.claim_members from public,anon,authenticated;

create or replace function private.group_users(p uuid) returns setof uuid
language sql stable security definer set search_path='' as $$
 select owner_id from public.plans where id=p union select user_id from public.plan_members where plan_id=p and answer='vin'
$$;
revoke all on function private.group_users(uuid) from public,anon,authenticated;
create or replace function private.group_plus(p uuid) returns boolean
language sql stable security definer set search_path='' as $$select exists(select 1 from private.group_users(p) u where private.plus_active(u))$$;
revoke all on function private.group_plus(uuid) from public,anon,authenticated;

create or replace function public.drop_create_v2(p_venue text,p_title text,p_all int,p_plus int,p_seats int,p_minutes int,p_min int default 1,p_at timestamptz default null,p_adult boolean default false,p_new boolean default false,p_key text default null,p_edit uuid default null) returns public.drops
language plpgsql security definer set search_path='' as $$
declare d public.drops; starttime timestamptz:=coalesce(p_at,now()); endtime timestamptz; wk timestamp; weekstart timestamptz; weekend timestamptz; used interval; pr public.partners; normalized_title text:=private.plain(p_title);
begin
 perform private.require_v2();
 select * into pr from public.partners where venue_id=p_venue for update;
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') then raise exception 'Doar proprietarul sau managerul.'; end if;
 if pr.status<>'activ' or pr.venue_paused then raise exception 'Localul este în pauză.'; end if;
 if p_key is not null and length(p_key) not between 1 and 100 then raise exception 'Cheie invalidă.';end if;
 if p_edit is not null then
  select * into d from public.drops where id=p_edit and venue_id=p_venue for update;
  if d.id is null or d.starts_at<=now() or d.stopped_at is not null or exists(select 1 from public.drop_claims where drop_id=p_edit) then raise exception 'Editează numai oferte viitoare, fără revendicări.';end if;
 else
  select * into d from public.drops where venue_id=p_venue and request_key=p_key; if d.id is not null then return d;end if;
 end if;
 if p_minutes is null or p_minutes not between 15 and 240 or p_min is null or p_min not between 1 and 6 or p_adult is null or p_new is null or starttime<now()-interval '1 minute' or starttime>now()+interval '30 days' then raise exception 'Verifică durata și grupul minim (1–6).' ; end if;
 if normalized_title~'(tutun|narghil|n4rghil|shisha|sisha|hookah|vape|vapat|tigar|iqos|tobacco|glo)' then raise exception 'Tutunul nu poate fi ofertă.'; end if;
 endtime:=starttime+make_interval(mins=>p_minutes);
 if p_plus<private.plus_pct_at(p_venue,starttime) then raise exception 'Drop Plus nu poate fi sub programul Plus.'; end if;
 if exists(select 1 from public.drops where venue_id=p_venue and id is distinct from p_edit and starts_at<endtime+interval '2 hours' and ends_at>starttime-interval '2 hours') then raise exception 'Păstrează două ore între oferte.'; end if;
 -- Count portions in each local calendar week, including a drop crossing Sunday midnight.
 wk:=date_trunc('week',starttime at time zone 'Europe/Bucharest');
 while wk<(endtime at time zone 'Europe/Bucharest') loop
  weekstart:=wk at time zone 'Europe/Bucharest'; weekend:=(wk+interval '7 days') at time zone 'Europe/Bucharest';
  select coalesce(sum(least(ends_at,weekend)-greatest(starts_at,weekstart)),interval '0') into used from public.drops where venue_id=p_venue and id is distinct from p_edit and starts_at<weekend and ends_at>weekstart;
  if used+least(endtime,weekend)-greatest(starttime,weekstart)>interval '12 hours' then raise exception 'Maximum 12 ore de Drops pe săptămână.'; end if;
  wk:=wk+interval '7 days';
 end loop;
 if p_edit is not null then
  update public.drops set title=p_title,pct_all=p_all,pct_plus=p_plus,seats=p_seats,min_group=p_min,starts_at=starttime,ends_at=endtime,adult=p_adult or normalized_title~'(alcool|cocktail|coctail|bere|beri|vin|shot|prosecco|spritz|whisk|vodka|votca|gin|rom|tequila|lichior|palinc|tuica|aperol|happy hour|halba|pahar)',new_only=p_new,immediate=p_at is null where id=p_edit returning * into d;return d;
 end if;
 insert into public.drops(venue_id,title,pct_all,pct_plus,seats,min_group,starts_at,ends_at,adult,new_only,created_by,immediate,request_key)
 values(p_venue,p_title,p_all,p_plus,p_seats,p_min,starttime,endtime,p_adult or normalized_title~'(alcool|cocktail|coctail|bere|beri|vin|shot|prosecco|spritz|whisk|vodka|votca|gin|rom|tequila|lichior|palinc|tuica|aperol|happy hour|halba|pahar)',p_new,auth.uid(),p_at is null,p_key) returning * into d;
 return d;
end $$;
revoke all on function public.drop_create_v2(text,text,int,int,int,int,int,timestamptz,boolean,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.drop_create_v2(text,text,int,int,int,int,int,timestamptz,boolean,boolean,text,uuid) to authenticated;

create or replace function public.drop_claim_v2(p_drop uuid,p_plan uuid,p_seats int,p_lat double precision,p_lon double precision,p_key text) returns public.drop_claims
language plpgsql security definer set search_path='' as $$
declare x public.plans; d public.drops; c public.drop_claims; pos public.venues; n int; plus boolean; ids uuid[];
begin
 perform private.require_v2();
 select * into x from public.plans where id=p_plan for update;
 if auth.uid() is null or x.owner_id is distinct from auth.uid() then raise exception 'Doar organizatorul ia oferta.'; end if;
 n:=private.attendance(p_plan); if n is null then raise exception 'Așteptăm participarea finală.'; end if;
 select array_agg(u) into ids from private.group_users(p_plan) u;
 -- Lock every participating account in sorted order: overlapping groups cannot take simultaneous claims.
 perform pg_advisory_xact_lock(hashtext('claim-user.'||u)) from unnest(ids) u order by u;
 select * into c from public.drop_claims where user_id=auth.uid() and request_key=p_key;
 if c.id is not null then if c.plan_id is distinct from p_plan or c.drop_id is distinct from p_drop then raise exception 'Cheia aparține altei ieșiri.';end if;return c; end if;
 select * into d from public.drops where id=p_drop for update;
 select * into pos from public.venues where id=d.venue_id;
 if p_key is null or length(p_key) not between 1 and 100 or p_seats is null or p_seats not between 1 and 6 or p_seats>n or p_seats<d.min_group then raise exception 'Locuri invalide (maximum șase).' ; end if;
 if d.id is null or x.venue_id<>d.venue_id or d.stopped_at is not null or d.ends_at<=now()+interval '15 minutes' or
 not exists(select 1 from public.partners where venue_id=d.venue_id and status='activ' and not venue_paused and not(reservation_mode='required' and not reservations_on)) then raise exception 'Oferta nu este disponibilă.'; end if;
 plus:=private.group_plus(p_plan);
 if now()<(case when d.immediate then d.starts_at+case when plus then interval '0' else interval '10 minutes' end else d.starts_at-case when plus then interval '10 minutes' else interval '0' end end) then raise exception 'Oferta nu a început pentru grupul tău.'; end if;
 if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 or pos.id is null or private.km(p_lat,p_lon,pos.lat,pos.lon)<0.150 then raise exception 'Ia oferta de la cel puțin 150 m de local.'; end if;
 if exists(select 1 from public.partner_members where venue_id=d.venue_id and active and user_id=any(ids)) then raise exception 'Echipa localului nu poate lua oferta.'; end if;
 if d.adult and (exists(select 1 from unnest(ids) u where not exists(select 1 from public.profile_private p where p.id=u and p.birth_date<=(now() at time zone 'Europe/Bucharest')::date-interval '18 years')) or x.guests>cardinality(x.guest_ages) or exists(select 1 from unnest(x.guest_ages) a where a<18)) then raise exception 'Toți participanții trebuie să aibă 18 ani.'; end if;
 if exists(select 1 from public.visits where venue_id=d.venue_id and user_id=any(ids) and work_day=private.work_day(now())) or
 exists(select 1 from private.visit_scanners s join public.visits v on v.id=s.visit_id where s.user_id=any(ids) and v.venue_id=d.venue_id and v.work_day=private.work_day(now())) or
 exists(select 1 from public.xp_log where user_id=any(ids) and venue_id=d.venue_id and created_at>=((private.work_day(now())::timestamp+time '05:00') at time zone 'Europe/Bucharest')) then raise exception 'Grupul are deja o sosire la local.'; end if;
 if d.new_only and (x.guests>0 or exists(select 1 from private.visit_scanners s join public.visits v on v.id=s.visit_id where s.user_id=any(ids) and v.venue_id=d.venue_id and v.scanned_at>now()-interval '12 months') or exists(select 1 from public.visits where venue_id=d.venue_id and user_id=any(ids) and scanned_at>now()-interval '12 months') or exists(select 1 from public.xp_log where venue_id=d.venue_id and user_id=any(ids) and created_at>now()-interval '12 months') or exists(select 1 from public.receipts where venue_id=d.venue_id and user_id=any(ids) and created_at>now()-interval '12 months')) then raise exception 'Oferta este pentru grupuri noi prin CeFaci.'; end if;
 update public.drop_claims set status='anulat' where status='activ' and expires_at<=now();
 if exists(select 1 from public.drop_claims c2 left join private.claim_members m on m.claim_id=c2.id where c2.status='activ' and c2.expires_at>now() and(c2.user_id=any(ids) or m.user_id=any(ids))) then raise exception 'Un participant are deja o ofertă activă.'; end if;
 if p_seats+(select coalesce(sum(seats),0) from public.drop_claims where drop_id=p_drop and(status='folosit' or(status='activ' and expires_at>now())))>d.seats then raise exception 'Nu mai sunt suficiente locuri.'; end if;
 insert into public.drop_claims(drop_id,user_id,plan_id,seats,expires_at,plus_at_claim,claimed_pct,request_key)
 values(p_drop,auth.uid(),p_plan,p_seats,least(now()+interval '45 minutes',d.ends_at+interval '15 minutes'),plus,case when plus then d.pct_plus else d.pct_all end,p_key) returning * into c;
 insert into private.claim_members(claim_id,user_id) select c.id,u from unnest(ids) u;
 return c;
end $$;
revoke all on function public.drop_claim_v2(uuid,uuid,int,double precision,double precision,text) from public,anon,authenticated;
grant execute on function public.drop_claim_v2(uuid,uuid,int,double precision,double precision,text) to authenticated;
