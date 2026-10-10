-- Operational Admin reads reuse the canonical V2 identity and frozen financial calculation.
-- No invoices, payment provider, repricing, ownership activation or client identity export.
create index if not exists visits_admin_day on public.visits(work_day,scanned_at desc,id);
create index if not exists reservations_admin_at on public.reservations(at,id);
create index if not exists xp_admin_suggestions on public.xp_log(venue_id,created_at,user_id) where kind in('checkin','bill');

create function private.admin_operations_authorize(p_permission text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.business_authenticated() or not private.can(p_permission) then
  raise exception 'Nu ai acces la această secțiune Admin.' using errcode='42501';
 end if;
end $$;
revoke all on function private.admin_operations_authorize(text) from public,anon,authenticated;

create function public.admin_operations_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date:=private.work_day(now());
begin
 perform private.admin_operations_authorize('operations.read');
 return jsonb_build_object(
  'visits_today',(select count(*) from public.visits where work_day=today),
  'reservations_pending',(select count(*) from public.reservations where status='cerută' and at>=now()),
  'counts_awaiting',(select count(*) from private.visit_counts where state='awaiting'),
  'counts_disputed',(select count(*) from private.visit_counts where state='disputed'),
  'benefits_pending',(select count(*) from private.benefit_cases where state='pending'),
  'unclosed',(select count(*) from public.visits where outcome='deschis' and closed_at is null and work_day<today),
  'work_day',today,'time_zone','Europe/Bucharest','day_boundary','05:00');
end $$;

create function public.admin_operations(p_from date,p_to date,p_venue text default null,p_filter text default 'attention',p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare visits jsonb; reservations jsonb; nv bigint; nr bigint; money boolean:=private.can('money.read');
begin
 perform private.admin_operations_authorize('operations.read');
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_filter is null or p_filter not in('all','attention') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Filtru sau perioadă invalidă.'; end if;
 if p_venue is not null and not exists(select 1 from public.venues where id=p_venue) then raise exception 'Localul nu există.'; end if;
 with matched as (
  select x.*,v.name,v.edit,c.version count_version,c.people count_people,c.adults,c.drop_adults,c.state count_state,c.deadline,c.reason count_reason,
   b.version benefit_version,b.state benefit_state,b.reason benefit_reason,b.reply,b.decision_reason
  from public.visits x left join public.venues v on v.id=x.venue_id
  left join private.visit_counts c on c.visit_id=x.id left join private.benefit_cases b on b.visit_id=x.id
  where x.work_day between p_from and p_to and(p_venue is null or x.venue_id=p_venue)
   and(p_filter='all' or c.state in('awaiting','disputed') or b.state='pending' or x.closed_at is null or (x.outcome='n-a venit' and x.proof in('staff_ticket','receipt')))
 ), page as(select * from matched order by work_day desc,scanned_at desc,id limit p_limit offset p_offset)
 select (select count(*) from matched),coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'venue_id',x.venue_id,'venue_name',coalesce(x.edit->>'name',x.name,x.venue_id),'work_day',x.work_day,'created_at',x.scanned_at,
  'kind',x.kind,'people',x.people,'outcome',x.outcome,'closed_at',x.closed_at,'proof',x.proof,'plan_id',x.plan_id,
  'discount_pct',x.discount_pct,'discount_scope',x.discount_scope,
  'count',case when x.count_version is not null then jsonb_build_object('version',x.count_version,'people',x.count_people,'adults',x.adults,'drop_adults',x.drop_adults,'state',x.count_state,'deadline',x.deadline,'reason',x.count_reason)end,
  'benefit',case when x.benefit_version is not null then jsonb_build_object('version',x.benefit_version,'state',x.benefit_state,'reason',x.benefit_reason,'reply',x.reply,'decision_reason',x.decision_reason)end,
  'bill',case when money then x.bill end,'discount_amount',case when money then x.discount_amount end
 )order by x.work_day desc,x.scanned_at desc,x.id),'[]') into nv,visits from page x;
 with matched as(
  select x.*,v.name,v.edit from public.reservations x left join public.venues v on v.id=x.venue_id
  where x.at>=(p_from::timestamp+interval '5 hours')at time zone 'Europe/Bucharest' and x.at<((p_to+1)::timestamp+interval '5 hours')at time zone 'Europe/Bucharest' and(p_venue is null or x.venue_id=p_venue)
   and(p_filter='all' or x.status in('cerută','propusă'))
 ),page as(select * from matched order by at desc,id limit p_limit offset p_offset)
 select (select count(*) from matched),coalesce(jsonb_agg(jsonb_build_object('id',x.id,'venue_id',x.venue_id,'venue_name',coalesce(x.edit->>'name',x.name,x.venue_id),'at',x.at,'people',x.people,'status',x.status,'reason',x.note,'proposal_at',case when x.status='propusă' then x.at end,'proposal_expires_at',x.proposal_expires_at)order by x.at desc,x.id),'[]') into nr,reservations from page x;
 return jsonb_build_object('visits',visits,'reservations',reservations,'total_visits',nv,'total_reservations',nr);
end $$;

-- Accounting reads are scoped to founder/accountant; operational Admin is not a billing role.
-- Active Business owners/managers retain their own finance access.
create or replace function public.biz_finance_v2(p_venue text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipts numeric; reductions numeric; commission numeric; missing int; blocked int;
begin
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') and not private.can('money') then raise exception 'Nu ai voie.'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Perioadă invalidă.'; end if;
 select coalesce(sum(bill),0),coalesce(sum(discount_amount),0),count(*) filter(where bill is null or discount_amount is null or closed_at is null) into receipts,reductions,missing from public.visits where venue_id=p_venue and work_day between p_from and p_to and outcome<>'n-a venit';
 select coalesce(sum(fee) filter(where not free),0) into commission from private.visit_fees(p_venue,p_from,p_to);
 select count(*) into blocked from public.visits x left join private.visit_counts c on c.visit_id=x.id left join private.visit_pricing s on s.visit_id=x.id where x.venue_id=p_venue and x.work_day between p_from and p_to and x.kind in('rezervare','drop') and x.outcome<>'n-a venit' and (exists(select 1 from private.benefit_cases b where b.visit_id=x.id and b.state='pending') or (s.version='per-person-v2' and c.state is distinct from 'confirmed') or (s.version<>'per-person-v2' and not exists(select 1 from private.visit_attendance where visit_id=x.id)) or s.tier is null or x.closed_at is null);
  return jsonb_build_object('billing_ready',false,'estimate',true,'partial',missing>0 or blocked>0,'missing',missing,'blocked',blocked,'revenue',receipts,'discounts',reductions,'fee',commission,'remaining',case when missing=0 and blocked=0 then receipts-commission end,
 'would_pay',(select coalesce(sum(fee) filter(where free),0) from private.visit_fees(p_venue,p_from,p_to)),
 'visits',(select count(*) from public.visits where venue_id=p_venue and work_day between p_from and p_to),
 'lines',coalesce((select jsonb_agg(jsonb_build_object('visit',f.visit_id,'day',f.work_day,'kind',f.kind,'bill',f.bill,'fee',case when f.free then 0 else f.fee end,'would_pay',case when f.free then f.fee else 0 end,'free',f.free,'calculation',jsonb_build_object('drop_billable',least(10,c.drop_adults,s.drop_limit),'reservation_billable',least(greatest(0,10-least(c.drop_adults,s.drop_limit)),greatest(0,c.adults-least(c.drop_adults,s.drop_limit)),s.reservation_limit),'reservation_unit',s.reservation_unit,'drop_unit',s.drop_unit,'reservation_limit',s.reservation_limit,'drop_limit',s.drop_limit,'adults',c.adults,'drop_adults',c.drop_adults))) from private.visit_fees(p_venue,p_from,p_to) f join private.visit_pricing s on s.visit_id=f.visit_id left join private.visit_counts c on c.visit_id=f.visit_id),'[]'));
end $$;
revoke all on function public.biz_finance_v2(text,date,date) from public,anon,authenticated;
grant execute on function public.biz_finance_v2(text,date,date) to authenticated;

create or replace function public.admin_partners() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m0 date := date_trunc('month', (now() at time zone 'Europe/Bucharest')::date)::date;
begin
  if not private.can('partners.read') then raise exception 'Nu ai voie.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'venue_id', p.venue_id, 'name', coalesce(v.edit->>'name', v.name), 'firm', p.firm, 'cui', p.cui, 'founder', p.founder, 'rate', null, 'price_tier', p.price_tier, 'pricing', 'per-person-v2',
      'status', p.status, 'activated_at', p.activated_at, 'free_until', p.free_until,
      'team', (select jsonb_agg(jsonb_build_object('username', pr.username, 'role', m.role)) from public.partner_members m join public.profiles pr on pr.id = m.user_id where m.venue_id = p.venue_id and m.active),
      'month', case when private.can('money') then public.biz_finance_v2(p.venue_id,m0,(m0+interval '1 month'-interval '1 day')::date) end,
      -- de verificat: nota scrisă de local mult sub bon; mese scanate trecute „n-a venit”; seri neînchise
      'flags', (select count(*) from public.visits x join public.receipts r on r.visit_id = x.id where x.venue_id = p.venue_id and x.declared is not null and x.declared < r.total * 0.9 and x.work_day >= m0),
      'noshow', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'n-a venit' and x.work_day >= m0),
      'unclosed', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'deschis' and x.bill is null and x.work_day < private.work_day(now()) - 1)
    ) order by p.created_at) from public.partners p left join public.venues v on v.id = p.venue_id), '[]');
end $$;
revoke all on function public.admin_partners() from public,anon,authenticated;
grant execute on function public.admin_partners() to authenticated;

create function public.admin_finance(p_from date,p_to date,p_venue text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p record; f jsonb; venues jsonb:='[]'; revenue numeric:=0; discounts numeric:=0; fee numeric:=0; would_pay numeric:=0; missing bigint:=0; blocked bigint:=0; visits bigint:=0;
begin
 perform private.admin_operations_authorize('money.read');
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Perioadă invalidă.'; end if;
 if p_venue is not null and not exists(select 1 from public.partners where venue_id=p_venue) then raise exception 'Partenerul nu există.'; end if;
 for p in select pr.venue_id,coalesce(v.edit->>'name',v.name,pr.venue_id) name from public.partners pr left join public.venues v on v.id=pr.venue_id where p_venue is null or pr.venue_id=p_venue order by pr.venue_id loop
  f:=public.biz_finance_v2(p.venue_id,p_from,p_to);
  venues:=venues||jsonb_build_array(jsonb_build_object('venue_id',p.venue_id,'name',p.name,'finance',f));
  revenue:=revenue+(f->>'revenue')::numeric;discounts:=discounts+(f->>'discounts')::numeric;fee:=fee+(f->>'fee')::numeric;would_pay:=would_pay+(f->>'would_pay')::numeric;
  missing:=missing+(f->>'missing')::bigint;blocked:=blocked+(f->>'blocked')::bigint;visits:=visits+(f->>'visits')::bigint;
 end loop;
 return jsonb_build_object('billing_ready',false,'estimate',true,'partial',missing>0 or blocked>0,'missing',missing,'blocked',blocked,'revenue',revenue,'discounts',discounts,'fee',fee,'remaining',case when missing=0 and blocked=0 then revenue-fee end,'would_pay',would_pay,'visits',visits,'venues',venues,'from',p_from,'to',p_to,'time_zone','Europe/Bucharest','day_boundary','05:00');
end $$;

create function public.admin_user_lookup(p_username text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare requested_username text:=lower(trim(coalesce(p_username,''))); result jsonb;
begin
 perform private.admin_operations_authorize('users.read');
 requested_username:=regexp_replace(requested_username,'^@','');
 if requested_username !~ '^[a-z0-9._-]{3,20}$' then raise exception 'Caută numele de utilizator exact.'; end if;
 select jsonb_build_object('id',p.id,'username',p.username,'first_name',p.first_name,'created_at',p.created_at,'staff_role',s.role,'plus_until',q.plus_until,
  'no_shows',(select count(*) from public.visits x where x.user_id=p.id and x.outcome='n-a venit'),
  'plus_grant_allowed',private.can('plus.manage')) into result
 from public.profiles p left join public.profile_private q on q.id=p.id left join public.staff s on s.user_id=p.id where p.username=requested_username;
 return result;
end $$;

-- One goodwill day, not an unrestricted Plus entitlement editor. Verified seven-day compensation
-- remains in admin_benefit_decide_v2, with the canonical complaint/version and 60-day guard.
create table private.admin_plus_grants(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete set null,
 by_user uuid references public.profiles(id) on delete set null,
 days integer not null check(days=1),
 reason text not null check(length(reason) between 5 and 1000),
 request_key text not null check(length(request_key) between 1 and 100),
 plus_until timestamptz not null,
 created_at timestamptz not null default now(),
 unique(by_user,request_key)
);
create index admin_plus_grants_user_time on private.admin_plus_grants(user_id,created_at desc);
create index admin_plus_grants_actor_time on private.admin_plus_grants(by_user,created_at desc);
alter table private.admin_plus_grants enable row level security;
revoke all on private.admin_plus_grants from public,anon,authenticated;
create function private.admin_plus_grant_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 and new.id=old.id and (to_jsonb(new)-'user_id'-'by_user')=(to_jsonb(old)-'user_id'-'by_user') and(new.user_id is not distinct from old.user_id or(new.user_id is null and old.user_id is not null))and(new.by_user is not distinct from old.by_user or(new.by_user is null and old.by_user is not null)) then return new; end if;
 raise exception 'Jurnalul Plus nu poate fi modificat.';
end $$;
revoke all on function private.admin_plus_grant_immutable() from public,anon,authenticated;
create trigger admin_plus_grants_immutable before update or delete on private.admin_plus_grants for each row execute function private.admin_plus_grant_immutable();

create function public.admin_plus_grant(p_user uuid,p_days integer,p_reason text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.admin_plus_grants; reason text:=trim(coalesce(p_reason,'')); expires timestamptz;
begin
 perform private.admin_operations_authorize('plus.manage');
 if p_days is distinct from 1 or p_user is null or p_key is null or length(p_key) not between 1 and 100 or length(reason) not between 5 and 1000 then raise exception 'Poți acorda o singură zi Plus, cu un motiv și o cheie de cerere.'; end if;
 -- The actor lock serializes the daily quota; the profile lock serializes every grant to this client.
 perform pg_advisory_xact_lock(hashtextextended('admin-plus:'||auth.uid()::text,0));
 select * into g from private.admin_plus_grants where by_user=auth.uid() and request_key=p_key;
 if found then
  if g.user_id is distinct from p_user or g.days is distinct from p_days or g.reason is distinct from reason then raise exception 'Cheia a fost folosită pentru o altă cerere.'; end if;
  return jsonb_build_object('id',g.id,'user_id',g.user_id,'days',g.days,'plus_until',g.plus_until,'reason',g.reason,'created_at',g.created_at);
 end if;
 perform 1 from public.profile_private where id=p_user for update;
 if not found then raise exception 'Profilul nu există.'; end if;
 if exists(select 1 from public.staff where user_id=p_user) or exists(select 1 from public.partner_members where user_id=p_user and active) then raise exception 'Zilele de suport sunt pentru clienți, nu pentru echipe.'; end if;
 if exists(select 1 from private.admin_plus_grants where user_id=p_user and created_at>now()-interval '60 days') or exists(select 1 from private.benefit_cases where reporter=p_user and reported_at>now()-interval '60 days') then raise exception 'Clientul a primit deja o compensare în ultimele 60 de zile.'; end if;
 if(select count(*) from private.admin_plus_grants where by_user=auth.uid() and created_at>now()-interval '24 hours')>=10 then raise exception 'Limita de suport este de 10 acordări în 24 de ore.'; end if;
 perform set_config('cefaci.plus','on',true);
 update public.profile_private set plus_until=greatest(coalesce(plus_until,now()),now())+interval '1 day' where id=p_user returning plus_until into expires;
 perform set_config('cefaci.plus','off',true);
 insert into private.admin_plus_grants(user_id,by_user,days,reason,request_key,plus_until)values(p_user,auth.uid(),1,reason,p_key,expires)returning * into g;
 return jsonb_build_object('id',g.id,'user_id',g.user_id,'days',g.days,'plus_until',g.plus_until,'reason',g.reason,'created_at',g.created_at);
end $$;

-- Complaint compensation shares the same profile lock and 60-day cap with manual support gifts.
create or replace function public.admin_benefit_decide_v2(p_visit uuid,p_version int,p_uphold boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.benefit_cases;
begin
 perform private.require_v2();if not private.business_authenticated() or not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.benefit_cases where visit_id=p_visit for update;
 if c.visit_id is null or c.state<>'pending' or c.version is distinct from p_version or p_uphold is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Versiune sau motiv invalid.';end if;
 if p_uphold and c.reporter is not null then
  perform 1 from public.profile_private where id=c.reporter for update;
  if not exists(select 1 from private.benefit_cases where reporter=c.reporter and compensated and decided_at>now()-interval '60 days') and not exists(select 1 from private.admin_plus_grants where user_id=c.reporter and created_at>now()-interval '60 days') then
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

create function public.admin_partner_suggestions() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.admin_operations_authorize('suggestions.read');
 -- Count server check-in evidence for nonpartners; do not infer restaurant receipts
 -- from completed plans. At least five distinct accounts protect small cohorts.
 return coalesce((select jsonb_agg(jsonb_build_object('venue_id',x.id,'name',x.name,'visits',x.visits,'receipts',x.receipts,'people',x.people,'last_visit',x.last_visit)order by x.visits desc,x.id)from(
  select v.id,coalesce(v.edit->>'name',v.name)name,count(*)visits,
   (select count(*) from public.xp_log r where r.venue_id=v.id and r.kind='bill' and r.created_at>now()-interval '12 months')receipts,
   count(distinct c.user_id)people,max(c.created_at)last_visit
  from public.venues v join public.xp_log c on c.venue_id=v.id and c.kind='checkin' and c.created_at>now()-interval '12 months'
  where not exists(select 1 from public.partners pr where pr.venue_id=v.id)
  group by v.id having count(distinct c.user_id)>=5 order by count(*)desc,v.id limit 100
 )x),'[]');
end $$;

revoke all on function public.admin_operations_summary(),public.admin_operations(date,date,text,text,integer,integer),public.admin_finance(date,date,text),public.admin_user_lookup(text),public.admin_plus_grant(uuid,integer,text,text),public.admin_partner_suggestions() from public,anon,authenticated;
grant execute on function public.admin_operations_summary(),public.admin_operations(date,date,text,text,integer,integer),public.admin_finance(date,date,text),public.admin_user_lookup(text),public.admin_plus_grant(uuid,integer,text,text),public.admin_partner_suggestions() to authenticated;
notify pgrst,'reload schema';
