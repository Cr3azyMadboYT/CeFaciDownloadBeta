-- Persist operational events, without personal/financial payloads. Realtime is an invalidation signal;
-- applications refetch authorized state on subscription/reconnect and periodically while foregrounded.
create table public.outing_events(id bigint generated always as identity primary key,venue_id text not null,plan_id uuid references public.plans(id) on delete set null,kind text not null,created_at timestamptz not null default now());
create index outing_events_plan on public.outing_events(plan_id,id);
create index outing_events_venue on public.outing_events(venue_id,id);
alter table public.outing_events enable row level security;
revoke all on public.outing_events from public,anon,authenticated;
grant select on public.outing_events to authenticated;
create policy outing_events_read on public.outing_events for select to authenticated using(private.plan_access(plan_id,(select auth.uid())) or private.member_role(venue_id) is not null);
create or replace function private.outing_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(new); local_venue text;
begin
 local_venue:=coalesce(row_data->>'venue_id',(select venue_id from public.plans where id=(row_data->>'plan_id')::uuid));
 insert into public.outing_events(venue_id,plan_id,kind) values(local_venue,case when tg_table_name='plans' then (row_data->>'id')::uuid else (row_data->>'plan_id')::uuid end,tg_table_name);
 return new;
end $$;
revoke all on function private.outing_event() from public,anon,authenticated;
create trigger reservation_event after insert or update on public.reservations for each row execute function private.outing_event();
create trigger visit_event after insert or update on public.visits for each row execute function private.outing_event();
create trigger claim_event after insert or update on public.drop_claims for each row execute function private.outing_event();
create trigger plan_event after insert or update on public.plans for each row execute function private.outing_event();
alter publication supabase_realtime add table public.outing_events;

create or replace function public.plan_cancel_v2(p_plan uuid) returns void
language plpgsql security definer set search_path='' as $$
declare x public.plans;
begin
 select * into x from public.plans where id=p_plan for update;
 if auth.uid() is null or x.owner_id is distinct from auth.uid() then raise exception 'Doar organizatorul anulează planul.'; end if;
 perform 1 from public.partners where venue_id=x.venue_id for update;
 update public.reservations set status='anulată' where plan_id=p_plan and status in('cerută','propusă','confirmată') and not exists(select 1 from public.visits where plan_id=p_plan);
 update public.drop_claims set status='anulat' where plan_id=p_plan and status='activ';
 update public.plans set status='cancelled' where id=p_plan;
end $$;
revoke all on function public.plan_cancel_v2(uuid) from public,anon,authenticated;
grant execute on function public.plan_cancel_v2(uuid) to authenticated;

create or replace function public.biz_dashboard_v2(p_venue text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r text:=private.member_role(p_venue); data jsonb; cfg public.partners; today date:=private.work_day(now());
begin
 if r is null then raise exception 'Nu ești în echipa localului.'; end if;
 select * into cfg from public.partners where venue_id=p_venue for update;
 update public.reservations set status='expirată' where venue_id=p_venue and((status='propusă' and proposal_expires_at<=now()) or(status='cerută' and response_due_at<=now()));
 data:=jsonb_build_object('role',r,'day',today,'word',private.day_word(p_venue,today),'token',case when r in('proprietar','manager') then(select token from public.venue_codes where venue_id=p_venue)end,'partner',case when r in('proprietar','manager') then to_jsonb(cfg)-'created_by' else '{}'::jsonb end,'drops',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'pct_all',d.pct_all,'pct_plus',d.pct_plus,'seats',d.seats,'min_group',d.min_group,'taken',(select coalesce(sum(seats),0) from public.drop_claims where drop_id=d.id and(status='folosit' or(status='activ' and expires_at>now()))),'starts_at',d.starts_at,'ends_at',d.ends_at,'adult',d.adult,'new_only',d.new_only)) from public.drops d where d.venue_id=p_venue and stopped_at is null and ends_at>now()),'[]'));
 data:=data||jsonb_build_object('settings',jsonb_build_object('mode',cfg.reservation_mode,'on',cfg.reservations_on,'paused',cfg.venue_paused,'capacity',cfg.capacity,'duration',cfg.duration_minutes,'auto',cfg.auto_confirm_max,'hours',cfg.reservation_hours),
 'plus_program',case when r in('proprietar','manager') then jsonb_build_object('current_pct',private.plus_pct_at(p_venue,now()),'today_off',exists(select 1 from private.plus_off_days where venue_id=p_venue and day=(now() at time zone 'Europe/Bucharest')::date),'off_days_this_month',(select count(*) from private.plus_off_days where venue_id=p_venue and date_trunc('month',day)=date_trunc('month',now() at time zone 'Europe/Bucharest')),'next',(select to_jsonb(v)-'by_user' from private.plus_versions v where venue_id=p_venue and effective_date>(now() at time zone 'Europe/Bucharest')::date order by effective_date limit 1)) end,
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'name',p.first_name,'people',q.people,'kids',q.kids,'at',q.at,'status',q.status,'proposal_expires_at',q.proposal_expires_at,'response_due_at',q.response_due_at,'note',q.note) order by q.at) from public.reservations q left join public.profiles p on p.id=q.user_id where r<>'scanare' and q.venue_id=p_venue and q.at between now()-interval '3 hours' and now()+interval '30 days' and q.status in('cerută','confirmată','propusă')),'[]'),
 'visits',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',p.first_name,'kind',v.kind,'people',v.people,'table',v.table_no,'discount',v.discount_pct,'discount_people',v.discount_people,'scope',v.discount_scope,'plus',v.plus,'at',v.scanned_at,'day',v.work_day,'outcome',v.outcome,'closed_at',v.closed_at,'bill',case when r in('proprietar','manager') then v.bill end,'source',case when r in('proprietar','manager') then v.bill_source end,'count',to_jsonb(c)-'by_user','drop_limit',s.drop_limit,'reservation_limit',s.reservation_limit) order by v.scanned_at) from public.visits v left join public.profiles p on p.id=v.user_id left join private.visit_counts c on c.visit_id=v.id left join private.visit_pricing s on s.visit_id=v.id where v.venue_id=p_venue and v.work_day between today-1 and today),'[]'),
 'statistics',jsonb_build_object('visits',(select count(*) from public.visits where venue_id=p_venue and work_day>=today-30),'people',(select coalesce(sum(c.people),0) from private.visit_counts c join public.visits v on v.id=c.visit_id where v.venue_id=p_venue and v.work_day>=today-30 and c.state='confirmed'),'unclosed',(select count(*) from public.visits where venue_id=p_venue and closed_at is null),'reservations',(select count(*) from public.reservations where venue_id=p_venue and created_at>now()-interval '30 days')));
 return data;
end $$;
revoke all on function public.biz_dashboard_v2(text) from public,anon,authenticated;
grant execute on function public.biz_dashboard_v2(text) to authenticated;

create or replace function public.drop_feed_v2(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare x public.plans; plus boolean;
begin
 if not private.plan_access(p_plan,auth.uid()) then raise exception 'Nu ai acces la plan.'; end if;
 select * into x from public.plans where id=p_plan;
 plus:=private.group_plus(p_plan);
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'pct',case when plus then d.pct_plus else d.pct_all end,'seats',d.seats-(select coalesce(sum(seats),0) from public.drop_claims where drop_id=d.id and(status='folosit' or(status='activ' and expires_at>now()))),'min_group',d.min_group,'starts_at',d.starts_at,'ends_at',d.ends_at,'adult',d.adult,'new_only',d.new_only,'plus',plus))
 from public.drops d join public.partners p on p.venue_id=d.venue_id where d.venue_id=x.venue_id and x.status='active' and d.stopped_at is null and p.status='activ' and not p.venue_paused and not(p.reservation_mode='required' and not p.reservations_on) and d.ends_at>now()+interval '15 minutes' and
 now()>=case when d.immediate then d.starts_at+case when plus then interval '0' else interval '10 minutes' end else d.starts_at-case when plus then interval '10 minutes' else interval '0' end end
 and(not d.adult or not exists(select 1 from public.profile_private where id in(select private.group_users(p_plan)) and birth_date>(now() at time zone 'Europe/Bucharest')::date-interval '18 years'))),'[]');
end $$;
revoke all on function public.drop_feed_v2(uuid) from public,anon,authenticated;
grant execute on function public.drop_feed_v2(uuid) to authenticated;
revoke select on public.drops from anon,authenticated;

create table private.receipt_fingerprints(fingerprint text primary key,visit_id uuid not null references public.visits(id));
alter table private.receipt_fingerprints enable row level security;
revoke all on private.receipt_fingerprints from public,anon,authenticated;

-- Receipt authorization happens before OCR, independent of whether the participant's XP succeeded.
create or replace function public.visit_receipt_ready_v2(p_user uuid,p_visit uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 select * into v from public.visits where id=p_visit;
 if v.id is null or not private.plan_access(v.plan_id,p_user,true) or now()>((v.work_day+2)::timestamp at time zone 'Europe/Bucharest') then return jsonb_build_object('ok',false,'error','Vizita nu este disponibilă pentru bon.'); end if;
 if exists(select 1 from public.receipts where visit_id=p_visit) then return jsonb_build_object('ok',false,'error','Bonul vizitei este deja pus.'); end if;
 if not public.api_quota(p_user,'bon',1) then return jsonb_build_object('ok',false,'error','Ai trimis destule bonuri azi.'); end if;
 return jsonb_build_object('ok',true,'venue',v.venue_id,'day',(v.scanned_at at time zone 'Europe/Bucharest')::date);
end $$;
revoke all on function public.visit_receipt_ready_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.visit_receipt_ready_v2(uuid,uuid) to service_role;

create or replace function public.visit_receipt_v2(p_user uuid,p_visit uuid,p_cui text,p_total numeric,p_discount numeric,p_date date,p_time time) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.visits; expected_cui text; issued timestamptz;
begin
 select * into v from public.visits where id=p_visit for update;
 if v.id is null or now()>((v.work_day+2)::timestamp at time zone 'Europe/Bucharest') or not private.plan_access(v.plan_id,p_user,true) then raise exception 'Nu participi la ieșire.'; end if;
 select s.cui into expected_cui from private.visit_pricing s where s.visit_id=v.id;
 if regexp_replace(coalesce(p_cui,''),'[^0-9]','','g')<>expected_cui then raise exception 'Bonul nu este de la firma localului.'; end if;
 if p_total is null or p_total<=0 or p_total>=100000 or p_discount<0 or p_discount>=100000 or p_time is null or p_date is null then raise exception 'Bonul trebuie să conțină totalul, data și ora.'; end if;
 issued:=(p_date+p_time) at time zone 'Europe/Bucharest';
 if issued<v.scanned_at-interval '5 minutes' or issued>v.scanned_at+interval '12 hours' or issued>now()+interval '5 minutes' then raise exception 'Ora bonului nu corespunde vizitei.'; end if;
 if exists(select 1 from public.receipts where visit_id=p_visit) then raise exception 'Bonul vizitei este deja pus.'; end if;
 if exists(select 1 from public.receipts r join private.visit_pricing old_price on old_price.visit_id=r.visit_id where old_price.cui=expected_cui and r.total=p_total and r.issued_at=issued) then raise exception 'Bonul a fost deja folosit.'; end if;
 insert into private.receipt_fingerprints(fingerprint,visit_id) values(expected_cui||'|'||p_date||'|'||p_time||'|'||round(p_total,2),v.id);
 insert into public.receipts(visit_id,venue_id,user_id,total,discount,issued_at) values(v.id,v.venue_id,p_user,p_total,p_discount,issued);
 update public.visits set bill=p_total,bill_source='bon',discount_amount=coalesce(p_discount,discount_amount),proof='receipt',outcome='a venit' where id=v.id;
 return jsonb_build_object('ok',true,'visit',v.id,'bill',p_total);
end $$;
revoke all on function public.visit_receipt_v2(uuid,uuid,text,numeric,numeric,date,time) from public,anon,authenticated;
grant execute on function public.visit_receipt_v2(uuid,uuid,text,numeric,numeric,date,time) to service_role;

-- Legacy writes cannot bypass the shared group/location/capacity rules. Preserve readable old history.
create or replace function public.reservation_request(p_venue text,p_at timestamptz,p_people int,p_kids int default 0,p_note text default null) returns public.reservations
language plpgsql security definer set search_path='' as $$begin raise exception 'Actualizează aplicația pentru rezervarea grupului.'; end $$;
create or replace function public.drop_claim(p_drop uuid,p_seats int) returns public.drop_claims
language plpgsql security definer set search_path='' as $$begin raise exception 'Actualizează aplicația pentru oferta grupului și locație.'; end $$;
create or replace function public.visit_scan(p_token text,p_lat double precision,p_lon double precision,p_table text default null,p_people int default null) returns jsonb
language plpgsql security definer set search_path='' as $$begin raise exception 'Actualizează aplicația pentru sosirea pe biletul grupului.'; end $$;
create or replace function public.reservation_decide(p_id uuid,p_ok boolean) returns void
language plpgsql security definer set search_path='' as $$begin raise exception 'Actualizează Business pentru capacitatea rezervării.'; end $$;
create or replace function public.drop_create(p_venue text,p_title text,p_pct_all int,p_pct_plus int,p_seats int,p_minutes int,p_starts timestamptz default null,p_min_group int default 1,p_adult boolean default true,p_new_only boolean default false) returns public.drops
language plpgsql security definer set search_path='' as $$begin raise exception 'Actualizează Business pentru calendarul Live Drops.'; end $$;
create or replace function public.biz_settings_save(p_venue text,p_reservations_on boolean,p_auto_confirm_max int,p_plus_pct int) returns void
language plpgsql security definer set search_path='' as $$begin raise exception 'Actualizează Business pentru programul versionat.'; end $$;

-- Existing Business/Admin month callers receive all revenue sources and an explicitly partial net.
create or replace function public.biz_month(p_venue text,p_month date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d date:=date_trunc('month',coalesce(p_month,(now() at time zone 'Europe/Bucharest')::date))::date; j jsonb;
begin j:=public.biz_finance_v2(p_venue,d,(d+interval '1 month'-interval '1 day')::date); return j||jsonb_build_object('month',d,'bills',j->'revenue'); end $$;

-- Deny anonymous users invoking private operational helpers, including newly created ones.
revoke all on function private.arrive(uuid,boolean,text),private.group_users(uuid),private.group_plus(uuid),private.attendance(uuid),private.capacity_ok(text,timestamptz,int,int,uuid),private.plus_pct_at(text,timestamptz) from public,anon,authenticated;
notify pgrst,'reload schema';

-- Vote winners are decisions, then invite their voters to a separate attendance round.
create or replace function private.invited_plan() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.plans set shared_at=coalesce(shared_at,now()),attendance_deadline=coalesce(attendance_deadline,now()+interval '30 minutes'),people=greatest(people,1+(select count(*) from public.plan_members where plan_id=new.plan_id)) where id=new.plan_id and shared_at is null;
 return new;
end $$;
revoke all on function private.invited_plan() from public,anon,authenticated;
create trigger invited_plan after insert on public.plan_members for each row execute function private.invited_plan();
update public.plans p set shared_at=created_at,attendance_deadline=created_at+interval '30 minutes' where shared_at is null and exists(select 1 from public.plan_members m where m.plan_id=p.id);
create trigger member_outing_event after update on public.plan_members for each row execute function private.outing_event();
create trigger partner_outing_event after update on public.partners for each row execute function private.outing_event();
create trigger drop_outing_event after insert or update on public.drops for each row execute function private.outing_event();
create trigger plus_outing_event after insert or update on private.plus_versions for each row execute function private.outing_event();
create trigger plus_off_outing_event after insert on private.plus_off_days for each row execute function private.outing_event();

create or replace function public.biz_today(p_venue text) returns jsonb language plpgsql security definer set search_path='' as $$begin return public.biz_dashboard_v2(p_venue); end $$;
create or replace function public.reservation_cancel(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 perform 1 from public.plans where id=(select plan_id from public.reservations where id=p_id) for update;
 perform 1 from public.partners where venue_id=(select venue_id from public.reservations where id=p_id) for update;
 select * into r from public.reservations where id=p_id for update;
 if auth.uid() is null or r.user_id is distinct from auth.uid() or r.status not in('cerută','propusă','confirmată') or exists(select 1 from public.visits where reservation_id=p_id) then raise exception 'Rezervarea nu mai poate fi anulată.'; end if;
 update public.reservations set status='anulată' where id=p_id;
end $$;

create or replace function public.visit_close(p_visit uuid, p_came boolean, p_bill numeric default null) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.plan_id is not null then raise exception 'Actualizează Business pentru închiderea grupului.'; end if;
  if x.id is null or private.member_role(x.venue_id) is null or private.member_role(x.venue_id) = 'scanare' then raise exception 'Nu ai voie.'; end if;
  if p_came is null then raise exception 'Spune dacă au venit sau nu.'; end if;
  if now() > ((x.work_day + 1)::timestamp + time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Seara asta s-a închis singură la 12:00.'; end if;
  if p_came is false and x.bill_source = 'bon' then raise exception 'Clientul a pus bonul de aici, deci a venit.'; end if;
  if p_bill is not null and (p_bill < 0 or p_bill >= 100000) then raise exception 'Nota nu pare bună.'; end if;
  update public.visits set outcome = case when p_came then 'a venit' else 'n-a venit' end,
    declared = coalesce(p_bill, declared),
    bill = case when bill_source = 'bon' then bill when p_came and p_bill is not null then p_bill when p_came then bill else null end,
    bill_source = case when bill_source = 'bon' then 'bon' when p_came and p_bill is not null then 'local' when p_came then bill_source else null end,
    closed_by = auth.uid(), closed_at = now()
  where id = p_visit;
end $$;

create or replace function public.biz_visit_attendance(p_visit uuid, p_adults int, p_discounted int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.plan_id is not null then raise exception 'Actualizează Business pentru închiderea grupului.'; end if;
  if x.id is null or coalesce(private.member_role(x.venue_id),'') not in ('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
  if p_adults is null or p_adults not between 0 and x.people
     or coalesce(p_discounted,p_adults) not between 0 and p_adults then raise exception 'Numărul de oameni nu e bun.'; end if;
  if now() > ((x.work_day + 1)::timestamp + time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Seara asta s-a închis.'; end if;
  if x.outcome <> 'a venit' then raise exception 'Confirmă întâi sosirea.'; end if;
  insert into private.visit_attendance(visit_id,adults,discounted,confirmed_by)
  values(x.id,p_adults,coalesce(p_discounted,p_adults),auth.uid())
  on conflict(visit_id) do update set adults=excluded.adults,discounted=excluded.discounted,
    confirmed_by=excluded.confirmed_by,confirmed_at=now();
end $$;

create or replace function public.admin_partners() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m0 date := date_trunc('month', (now() at time zone 'Europe/Bucharest')::date)::date;
begin
  if not private.can('partners.read') then raise exception 'Nu ai voie.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'venue_id', p.venue_id, 'name', coalesce(v.edit->>'name', v.name), 'firm', p.firm, 'cui', p.cui, 'founder', p.founder, 'rate', null, 'price_tier', p.price_tier, 'pricing', 'per-person-v2',
      'status', p.status, 'activated_at', p.activated_at, 'free_until', p.free_until,
      'team', (select jsonb_agg(jsonb_build_object('username', pr.username, 'role', m.role)) from public.partner_members m join public.profiles pr on pr.id = m.user_id where m.venue_id = p.venue_id and m.active),
      'month', case when private.can('partners') or private.can('money') then public.biz_finance_v2(p.venue_id,m0,(m0+interval '1 month'-interval '1 day')::date) end,
      -- de verificat: nota scrisă de local mult sub bon; mese scanate trecute „n-a venit”; seri neînchise
      'flags', (select count(*) from public.visits x join public.receipts r on r.visit_id = x.id where x.venue_id = p.venue_id and x.declared is not null and x.declared < r.total * 0.9 and x.work_day >= m0),
      'noshow', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'n-a venit' and x.work_day >= m0),
      'unclosed', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'deschis' and x.bill is null and x.work_day < private.work_day(now()) - 1)
    ) order by p.created_at) from public.partners p left join public.venues v on v.id = p.venue_id), '[]');
end $$;
notify pgrst,'reload schema';
