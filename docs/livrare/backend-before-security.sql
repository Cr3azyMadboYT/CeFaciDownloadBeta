-- CeFaci2.0 before mandatory privileged MFA/session migration, 2026-10-09.
-- Schema definitions only; no account rows, tokens or authenticator secrets.
-- Snapshot for review; do not execute as an automatic downgrade.

CREATE OR REPLACE FUNCTION private.business_authenticated()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and not coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'is_anonymous')::boolean,false)
$function$


CREATE OR REPLACE FUNCTION private.can(perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((select case perm
 when 'staff.read' then s.role in('fondator','admin','editor','moderator','suport','contabil')
 when 'places.edit' then s.role in('fondator','admin','editor')
 when 'places.hide' then s.role in('fondator','admin','editor','moderator')
 when 'reports.read' then s.role in('fondator','admin','editor','moderator','suport')
 when 'reports.close' then s.role in('fondator','admin','editor','moderator')
 when 'support.manage' then s.role in('fondator','admin','editor','moderator','suport')
 when 'staff.manage' then s.role in('fondator','admin')
 when 'partners' then s.role in('fondator','admin')
 when 'partners.read' then s.role in('fondator','admin','suport','contabil')
 when 'founder' then s.role='fondator'
 when 'money' then s.role in('fondator','contabil')
 when 'operations.read' then s.role in('fondator','admin','suport')
 when 'operations.decide' then s.role in('fondator','admin')
 when 'money.read' then s.role in('fondator','contabil')
 when 'users.read' then s.role in('fondator','admin','moderator','suport')
 when 'plus.manage' then s.role in('fondator','admin','suport')
 when 'suggestions.read' then s.role in('fondator','admin','editor')
 when 'audit.read' then s.role in('fondator','admin') else false end
 from public.staff s where s.user_id=(select auth.uid())),false)
$function$


CREATE OR REPLACE FUNCTION public.admin_activity(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare plus_sql text:=''; statement text; result jsonb;
begin
 if not private.business_authenticated() or not private.can('audit.read') then raise exception 'Nu ai voie să citești jurnalul Admin.' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Filtre invalide.'; end if;
 if to_regclass('private.admin_plus_grants') is not null then plus_sql:=' union all select ''plus:''||id::text,''plus'',''plus_granted'',created_at,by_user,user_id::text,''Zi de Plus acordată de suport'' from private.admin_plus_grants'; end if;
 statement:=$query$select coalesce(jsonb_agg(jsonb_build_object('id',events.id,'origin',origin,'action',action,'at',at,'by_user',by_user,'username',p.username,'subject_id',subject_id,'summary',summary) order by at desc,events.id desc),'[]') from(
 select * from(
 select 'support:'||id::text id,'support' origin,action,at,by_user,report_id::text subject_id,'Raportare: '||action summary from private.support_report_log
 union all select 'legacy:'||id::text,'legacy',action,at,by_user,report_id::text,'Semnalare: '||action from private.legacy_report_log
 union all select 'partner:'||id::text,'partner',action,at,by_user,request_id::text,'Cerere parteneriat: '||action from private.partner_request_log
 union all select 'venue:'||id::text,'venue',action,at,by_user,venue_id,'Loc: '||action from public.venue_log
 union all select 'staff:'||id::text,'staff',case when next_role is null then 'staff_removed' else 'staff_changed' end,at,by_user,target_user::text,'Rol în echipă: '||coalesce(previous_role,'fără acces')||' → '||coalesce(next_role,'fără acces') from private.admin_staff_log$query$||plus_sql||$query$
 )all_events order by at desc,id desc limit $1 offset $2
 )events left join public.profiles p on p.id=events.by_user$query$;
 execute statement using p_limit,p_offset into result;
 return result;
end $function$


CREATE OR REPLACE FUNCTION public.admin_benefit_decide_v2(p_visit uuid, p_version integer, p_uphold boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_count_resolve_v2(p_visit uuid, p_version integer, p_people integer, p_adults integer, p_drop_adults integer, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.visits; c private.visit_counts; s private.visit_pricing;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.visit_counts where visit_id=p_visit for update;select * into s from private.visit_pricing where visit_id=p_visit;
 if c.visit_id is null or c.version is distinct from p_version or p_people is null or p_people not between 1 and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,s.drop_limit) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Număr, versiune sau motiv invalid.';end if;
 update private.visit_counts set version=version+1,people=p_people,adults=p_adults,drop_adults=p_drop_adults,state='confirmed',reason=p_reason,by_user=auth.uid() where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'count',to_jsonb(c),to_jsonb(n),p_reason from private.visit_counts n where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $function$


CREATE OR REPLACE FUNCTION public.admin_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform public.admin_me();
 return jsonb_build_object('support_new',case when private.can('reports.read') then(select count(*) from private.support_reports where status='new' and kind='issue')end,
 'support_in_progress',case when private.can('reports.read') then(select count(*) from private.support_reports where status='in_progress')end,
 'missing_place_new',case when private.can('reports.read') then(select count(*) from private.support_reports where status='new' and kind='missing_place')end,
 'legacy_new',case when private.can('reports.read') then(select count(*) from public.reports where status='nou')end,
 'partner_pending',case when private.can('partners') then(select count(*) from private.partner_requests where status='pending')end,
 'places',(select count(*) from public.venues),'partners',case when private.can('partners.read') then(select count(*) from public.partners)end);
end $function$


CREATE OR REPLACE FUNCTION public.admin_finance(p_from date, p_to date, p_venue text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_legacy_report_update(p_id uuid, p_status text, p_answer text, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reports; reply text:=nullif(trim(p_answer),''); target_status text;
begin
 if not private.business_authenticated() or not private.can('reports.close') then raise exception 'Nu ai voie să închizi semnalări.' using errcode='42501'; end if;
 if p_status is null or p_status not in('resolved','rejected') or p_version is null or p_version<1 or length(coalesce(reply,'')) not between 5 and 300 then raise exception 'Alege rezolvat sau respins și un răspuns (5–300 caractere).'; end if;
 target_status:=case when p_status='resolved' then 'rezolvat' else 'respins' end;
 select * into r from public.reports where id=p_id for update;
 if r.id is null then raise exception 'Semnalarea nu este disponibilă.'; end if;
 if r.revision=p_version+1 and r.status=target_status and r.answer is not distinct from reply and r.handled_by=auth.uid() then return private.legacy_report_public(r); end if;
 if r.revision<>p_version then raise exception 'Semnalarea a fost modificată între timp. Reîncarcă lista.' using errcode='40001'; end if;
 update public.reports set status=target_status,answer=reply,handled_by=auth.uid(),handled_at=now(),revision=revision+1 where id=r.id returning * into r;
 insert into private.legacy_report_log(report_id,by_user,action,data) values(r.id,auth.uid(),'staff_updated',jsonb_build_object('status',p_status,'answer',reply,'version',r.revision));
 return private.legacy_report_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.admin_me()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare role text:=private.staff_role(auth.uid()); perms jsonb;
begin
 if not private.business_authenticated() or role is null then raise exception 'Accesul în Admin este rezervat echipei CeFaci.' using errcode='42501'; end if;
 select jsonb_agg(p) into perms from unnest(array['staff.read','places.edit','places.hide','reports.read','reports.close','support.manage','staff.manage','partners','partners.read','founder','money','operations.read','operations.decide','money.read','users.read','plus.manage','suggestions.read','audit.read'])p where private.can(p);
 return jsonb_build_object('user_id',auth.uid(),'username',(select username from public.profiles where id=auth.uid()),'role',role,'permissions',coalesce(perms,'[]'));
end $function$


CREATE OR REPLACE FUNCTION public.admin_operations(p_from date, p_to date, p_venue text DEFAULT NULL::text, p_filter text DEFAULT 'attention'::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_operations_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_partner_request_decide(p_id uuid, p_decision text, p_note text, p_firm_verified boolean DEFAULT false, p_venue text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.partner_requests; target text;
begin
 if not private.can('partners') then raise exception 'Doar echipa CeFaci care verifică partenerii.'; end if;
 perform private.require_v2();
 if p_decision is null or p_decision not in('verified','rejected') or p_note is null or length(trim(p_note)) not between 10 and 1000 then raise exception 'Alege o decizie și o notă de verificare (10–1000 caractere).'; end if;
 select * into r from private.partner_requests where id=p_id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Cererea nu mai așteaptă verificarea.'; end if;
 if r.user_id=auth.uid() then raise exception 'Nu îți poți verifica propria cerere.'; end if;
 if p_decision='verified' then
  if not coalesce(p_firm_verified,false) then raise exception 'Confirmă verificarea reală a firmei la ANAF și a dreptului reprezentantului.'; end if;
  if r.proof_deleted_at is not null or r.proof_uploaded_at<=now()-interval '90 days' or not exists(select 1 from private.partner_request_log where request_id=r.id and by_user=auth.uid() and action='proof_access_authorized') then raise exception 'Verifică documentul înainte de aprobare.'; end if;
  if r.kind='dispute' and (r.owner_response_deadline is null or now()<r.owner_response_deadline) then raise exception 'Proprietarul actual are 3 zile să răspundă.'; end if;
  target:=case when r.kind='new' then p_venue else r.venue_id end;
  if target is null or not exists(select 1 from public.venues where id=target and status='on') then raise exception 'Localul nou trebuie adăugat și verificat de un admin înainte de aprobare.'; end if;
  if r.kind in('claim','new') and exists(select 1 from public.partner_members where venue_id=target and active and role='proprietar') then raise exception 'Localul este revendicat. Este necesară o dispută.'; end if;
 end if;
 update private.partner_requests set status=p_decision,venue_id=case when p_decision='verified' then target else venue_id end,
 decision_note=trim(p_note),decided_by=auth.uid(),decided_at=now(),updated_at=now(),firm_verified_by=case when p_decision='verified' then auth.uid() end,firm_verified_at=case when p_decision='verified' then now() end where id=r.id returning * into r;
 insert into private.partner_request_log(request_id,by_user,action,data) values(r.id,auth.uid(),'decided',jsonb_build_object('decision',p_decision,'note',trim(p_note)));
 return private.partner_request_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.admin_partner_requests(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.business_authenticated() or not private.can('partners') then raise exception 'Doar echipa CeFaci care verifică partenerii.'; end if;
 if p_status is null or p_status not in('draft','pending','verified','rejected','cancelled') then raise exception 'Stare invalidă.'; end if;
 return coalesce((select jsonb_agg(private.partner_request_public(r)||jsonb_build_object('applicant_id',r.user_id,'applicant_username',(select username from public.profiles where id=r.user_id),
 'owner_username',(select p.username from public.partner_members m join public.profiles p on p.id=m.user_id where m.venue_id=r.venue_id and m.active and m.role='proprietar' order by m.user_id limit 1),
 'owner_response',r.owner_response,'owner_responded_at',r.owner_responded_at,'owner_notice_at',r.owner_notice_at,'firm_verified_at',r.firm_verified_at,
 'proof_available',r.proof_path is not null and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days') order by r.created_at)
 from(select * from private.partner_requests where status=p_status order by created_at limit 100)r),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_partner_save(p_venue text, p_firm text, p_cui text, p_founder boolean, p_status text DEFAULT 'activ'::text, p_owner text DEFAULT NULL::text)
 RETURNS partners
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old public.partners; pr public.partners; today date := (now() at time zone 'Europe/Bucharest')::date; owner uuid;
begin
if not private.can('partners') then raise exception 'Nu ai voie să faci parteneri.'; end if;
if not exists (select 1 from public.venues where id = p_venue) then raise exception 'Locul nu există în CeFaci.'; end if;
if p_status not in ('activ', 'pauza', 'iesit') then raise exception 'Stare necunoscută.'; end if;
perform pg_advisory_xact_lock(hashtext('cefaci.founders'));
select * into old from public.partners where venue_id = p_venue for update;
if p_founder and (old.venue_id is null or not old.founder) then
if not private.can('founder') then raise exception 'Statutul de fondator îl dă doar fondatorul CeFaci.'; end if;
if (select count(*) from public.partners where founder) >= 20 then raise exception 'Sunt deja 20 de fondatori.'; end if;
end if;
if old.venue_id is not null and old.founder and not p_founder and not private.can('founder') then raise exception 'Doar fondatorul CeFaci scoate statutul de fondator.'; end if;
insert into public.partners (venue_id, firm, cui, founder, rate, status, activated_at, free_until, created_by)
values (p_venue, trim(p_firm), regexp_replace(p_cui, '\D', '', 'g'), p_founder, case when p_founder then 0.08 else 0.10 end, p_status,
today, (today + case when p_founder then interval '3 months' else interval '1 month' end)::date, auth.uid())
on conflict (venue_id) do update set firm = excluded.firm, cui = excluded.cui, founder = excluded.founder,
rate = case when excluded.founder then 0.08 else 0.10 end, status = excluded.status
returning * into pr;
insert into public.venue_codes (venue_id, token) values (p_venue, private.new_code(12)) on conflict (venue_id) do nothing;
if nullif(trim(p_owner), '') is not null then
select id into owner from public.profiles where username = lower(trim(both '@ ' from p_owner));
if owner is null then raise exception 'Nu găsesc @%. Proprietarul își face întâi cont în aplicația CeFaci.', p_owner; end if;
if private.staff_role(owner) is not null then raise exception 'Cineva din echipa CeFaci nu poate fi proprietarul unui local partener.'; end if;
insert into public.partner_members (venue_id, user_id, role, added_by) values (p_venue, owner, 'proprietar', auth.uid())
on conflict (venue_id, user_id) do update set role = 'proprietar', active = true;
end if;
insert into public.venue_log (venue_id, by_user, action, before, after)
values (p_venue, auth.uid(), 'partener', to_jsonb(old), to_jsonb(pr));
return pr;
end $function$


CREATE OR REPLACE FUNCTION public.admin_partner_suggestions()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_partner_tier_set(p_venue text, p_tier integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old_tier int;
begin
  if auth.uid() is null or not private.can('money') then raise exception 'Nu ai voie.'; end if;
  if p_tier is null or p_tier not between 1 and 3 then raise exception 'Treapta nu e bună.'; end if;
  select price_tier into old_tier from public.partners where venue_id = p_venue for update;
  if not found then raise exception 'Localul nu există.'; end if;
  if old_tier is not null and old_tier <> p_tier then raise exception 'Schimbarea treptei cere o versiune nouă de contract.'; end if;
  insert into public.venue_log(venue_id,by_user,action,before,after)
  values(p_venue,auth.uid(),'partener',jsonb_build_object('price_tier',old_tier),jsonb_build_object('price_tier',p_tier));
  update public.partners set price_tier = p_tier where venue_id = p_venue;
end $function$


CREATE OR REPLACE FUNCTION public.admin_partners()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_place_add(p_data jsonb, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
                                                                                                                                                                             declare d jsonb := private.clean_edit(p_data); nid text := 'a-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
                                                                                                                                                                             begin
                                                                                                                                                                               if not private.can('places.edit') then raise exception 'Nu ai voie să adaugi locuri.'; end if;
                                                                                                                                                                                 if coalesce(d->>'name', '') = '' or d->>'k' is null or d->>'cat' is null or d->>'lat' is null or d->>'lon' is null then
                                                                                                                                                                                     raise exception 'Un loc nou are nevoie de nume, fel, categorie și poziție.';
                                                                                                                                                                                       end if;
                                                                                                                                                                                         d := d || jsonb_build_object('id', nid, 'pick', true);
                                                                                                                                                                                           insert into public.venues (id, name, cat, lat, lon, data, source, status, edited_by, edited_at, updated_at)
                                                                                                                                                                                               values (nid, d->>'name', d->>'cat', (d->>'lat')::double precision, (d->>'lon')::double precision, d, 'admin', 'on', auth.uid(), now(), now());
                                                                                                                                                                                                 insert into public.venue_log (venue_id, by_user, action, after, note) values (nid, auth.uid(), 'add', d, p_note);
                                                                                                                                                                                                   return nid;
                                                                                                                                                                                                   end $function$


CREATE OR REPLACE FUNCTION public.admin_place_log(p_venue text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.business_authenticated() or not(private.can('places.edit') or private.can('places.hide') or private.can('partners')) then raise exception 'Nu ai voie să citești jurnalul locului.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(l) order by at desc,id desc) from(select * from public.venue_log where venue_id=p_venue
 and((action='partener' and private.can('partners')) or(action<>'partener' and(private.can('places.edit') or private.can('places.hide')))) order by at desc,id desc limit 100)l),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_place_save(p_id text, p_edit jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
                                                                                                                                                     declare v public.venues; e jsonb; merged jsonb;
                                                                                                                                                     begin
                                                                                                                                                       if not private.can('places.edit') then raise exception 'Nu ai voie să modifici locuri.'; end if;
                                                                                                                                                         select * into v from public.venues where id = p_id for update;
                                                                                                                                                           if not found then raise exception 'Locul nu există.'; end if;
                                                                                                                                                             e := jsonb_strip_nulls(v.edit || private.clean_edit(p_edit));
                                                                                                                                                               merged := v.data || e;
                                                                                                                                                                 update public.venues set edit = e, name = coalesce(merged->>'name', name), cat = coalesce(merged->>'cat', cat),
                                                                                                                                                                     lat = coalesce((merged->>'lat')::double precision, lat), lon = coalesce((merged->>'lon')::double precision, lon),
                                                                                                                                                                         edited_by = auth.uid(), edited_at = now(), updated_at = now() where id = p_id;
                                                                                                                                                                           insert into public.venue_log (venue_id, by_user, action, before, after, note) values (p_id, auth.uid(), 'edit', v.edit, e, p_note);
                                                                                                                                                                             return merged;
                                                                                                                                                                             end $function$


CREATE OR REPLACE FUNCTION public.admin_place_status(p_id text, p_hidden boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
                                                                                                                                                                                                   declare v public.venues;
                                                                                                                                                                                                   begin
                                                                                                                                                                                                     if not private.can('places.hide') then raise exception 'Nu ai voie să ascunzi locuri.'; end if;
                                                                                                                                                                                                       select * into v from public.venues where id = p_id for update;
                                                                                                                                                                                                         if not found then raise exception 'Locul nu există.'; end if;
                                                                                                                                                                                                           if v.status = 'gone' and not p_hidden then raise exception 'Locul a dispărut de pe hartă: adaugă-l din nou.'; end if;
                                                                                                                                                                                                             update public.venues set status = case when p_hidden then 'hidden' else 'on' end, edited_by = auth.uid(), edited_at = now(), updated_at = now() where id = p_id;
                                                                                                                                                                                                               insert into public.venue_log (venue_id, by_user, action, note) values (p_id, auth.uid(), case when p_hidden then 'hide' else 'show' end, p_note);
                                                                                                                                                                                                               end $function$


CREATE OR REPLACE FUNCTION public.admin_places(p_query text DEFAULT ''::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare term text:=trim(coalesce(p_query,''));
begin
 perform public.admin_me();
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 or length(term)>100 then raise exception 'Filtre invalide.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(v) order by v.name,v.id) from(select * from public.venues where term='' or strpos(lower(coalesce(edit->>'name',name)),lower(term))>0 or id=term order by name,id limit p_limit offset p_offset)v),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_plus_grant(p_user uuid, p_days integer, p_reason text, p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.admin_report_close(p_id uuid, p_status text, p_answer text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rev integer;
begin
 if not private.can('reports.close') then raise exception 'Nu ai voie să închizi semnalări.'; end if;
 if p_status is null or p_status not in('rezolvat','respins') then raise exception 'Stare necunoscută.'; end if;
 select revision into rev from public.reports where id=p_id for update;
 if rev is null then raise exception 'Semnalarea nu este disponibilă.'; end if;
 perform public.admin_legacy_report_update(p_id,case when p_status='rezolvat' then 'resolved' else 'rejected' end,coalesce(nullif(trim(p_answer),''),'Verificată de echipa CeFaci.'),rev);
end $function$


CREATE OR REPLACE FUNCTION public.admin_staff_change(p_user uuid, p_role text, p_note text, p_expected_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old_role text; username text;
begin
 if not private.business_authenticated() or not private.can('staff.manage') then raise exception 'Nu ai voie să schimbi echipa.' using errcode='42501'; end if;
 if p_user is null or p_note is null or length(trim(p_note)) not between 5 and 300 then raise exception 'Alege persoana și motivul (5–300 caractere).'; end if;
 perform pg_advisory_xact_lock(hashtext('cefaci.staff.'||p_user::text));
 select s.role into old_role from public.staff s where s.user_id=p_user for update;
 if old_role is distinct from p_expected_role then raise exception 'Rolul a fost modificat între timp. Reîncarcă echipa.' using errcode='40001'; end if;
 select p.username into username from public.profiles p where p.id=p_user;
 if username is null then raise exception 'Contul nu este disponibil.'; end if;
 if p_role is null then
  if old_role is null then raise exception 'Persoana nu este în echipă.'; end if;
  perform public.staff_remove(p_user);
 else perform public.staff_set(p_user,p_role);
 end if;
 insert into private.admin_staff_log(target_user,by_user,previous_role,next_role,note) values(p_user,auth.uid(),old_role,p_role,trim(p_note));
 return jsonb_build_object('user_id',p_user,'username',username,'role',p_role,'removed',p_role is null);
end $function$


CREATE OR REPLACE FUNCTION public.admin_staff_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.business_authenticated() or not private.can('staff.read') then raise exception 'Nu ai voie să citești echipa.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',s.user_id,'username',p.username,'role',s.role,'added_by',s.added_by,'created_at',s.created_at) order by s.created_at,s.user_id)
 from public.staff s join public.profiles p on p.id=s.user_id),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_staff_search(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare term text:=lower(trim(both '@ ' from p_query));
begin
 if not private.business_authenticated() or not private.can('staff.manage') then raise exception 'Nu ai voie să cauți membri pentru echipă.' using errcode='42501'; end if;
 if term is null or length(term) not between 3 and 30 then raise exception 'Scrie @username-ul complet (3–30 caractere).'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',id,'username',username)) from public.profiles where username=term),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_support_report_update(p_id uuid, p_status text, p_answer text, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.support_reports; reply text:=nullif(trim(p_answer),''); old_status text;
begin
 if not private.business_authenticated() or not private.can('support.manage') then raise exception 'Nu ai voie să răspunzi raportărilor.' using errcode='42501'; end if;
 if p_status is null or p_status not in('new','in_progress','resolved','rejected') or p_version is null or p_version<1 or length(coalesce(reply,''))>2000 or(p_status in('resolved','rejected') and length(coalesce(reply,''))<5) then raise exception 'Alege starea și un răspuns pentru persoană (5–2000 caractere).'; end if;
 select * into r from private.support_reports where id=p_id and status not in('draft','cancelled') for update;
 if r.id is null then raise exception 'Raportarea nu este disponibilă.'; end if;
 if r.version=p_version+1 and r.status=p_status and r.answer is not distinct from reply and r.handled_by=auth.uid() then return private.support_report_public(r); end if;
 if r.version<>p_version then raise exception 'Raportarea a fost modificată între timp. Reîncarcă lista.' using errcode='40001'; end if;
 old_status:=r.status;
 update private.support_reports set status=p_status,answer=reply,handled_by=auth.uid(),version=version+1,updated_at=now() where id=r.id returning * into r;
 insert into private.support_report_log(report_id,by_user,action,data) values(r.id,auth.uid(),'staff_updated',jsonb_build_object('from',old_status,'to',p_status,'answer',reply,'version',r.version));
 return private.support_report_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.admin_support_reports(p_status text DEFAULT 'new'::text, p_kind text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.business_authenticated() or not private.can('reports.read') then raise exception 'Nu ai voie să citești raportările.' using errcode='42501'; end if;
 if p_status is not null and p_status not in('new','in_progress','resolved','rejected') or p_kind is not null and p_kind not in('issue','missing_place','venue_report') or p_source is not null and p_source not in('client','business') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Filtre invalide.'; end if;
 return coalesce((select jsonb_agg(item order by created_at,id) from (
 select item,created_at,id from (
 select private.support_report_public(r)||jsonb_build_object('username',p.username) item,r.created_at,r.id from private.support_reports r left join public.profiles p on p.id=r.user_id
 where r.status not in('draft','cancelled') and(p_status is null or r.status=p_status) and(p_kind is null or r.kind=p_kind) and(p_source is null or r.source=p_source)
 union all
 select private.legacy_report_public(r)||jsonb_build_object('username',p.username),r.created_at,r.id from public.reports r left join public.profiles p on p.id=r.user_id
 where(p_status is null or case r.status when 'nou' then 'new' when 'rezolvat' then 'resolved' else 'rejected' end=p_status) and(p_kind is null or case when r.venue_id='nou' then 'missing_place' else 'venue_report' end=p_kind) and(p_source is null or p_source='client')
 )q order by created_at,id limit p_limit offset p_offset
 )list),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_user_lookup(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.biz_benefit_reply_v2(p_visit uuid, p_reply text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.visits;
begin
 perform private.require_v2();select * into v from public.visits where id=p_visit for update;
 if coalesce(private.member_role(v.venue_id),'') not in('proprietar','manager') or length(trim(coalesce(p_reply,''))) not between 5 and 1000 then raise exception 'Nu ai voie sau lipsește răspunsul.'; end if;
 update private.benefit_cases set reply=p_reply where visit_id=p_visit and state='pending';if not found then raise exception 'Cazul nu mai așteaptă răspuns.';end if;
 update public.visits set proof=proof where id=p_visit;
end $function$


CREATE OR REPLACE FUNCTION public.biz_close_v2(p_visit uuid, p_people integer, p_adults integer, p_drop_adults integer, p_bill numeric, p_discount numeric, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.visits; cfg private.visit_counts; snapshot private.visit_pricing; state text; scans int; ver int;
begin
 perform private.require_v2();
 select * into v from public.visits where id=p_visit for update;
 if v.id is null or coalesce(private.member_role(v.venue_id),'') not in('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
 if now()>((v.work_day+1)::timestamp+time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Termenul de închidere a trecut.'; end if;
 select * into snapshot from private.visit_pricing where visit_id=p_visit;
 select count(*) into scans from private.visit_scanners where visit_id=p_visit;
 if p_people is null or p_people not between greatest(1,scans) and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,snapshot.drop_limit) or p_bill<0 or p_bill>=100000 or p_discount<0 then raise exception 'Număr sau sumă invalidă.'; end if;
 select * into cfg from private.visit_counts where visit_id=p_visit;
 if cfg.visit_id is not null and (cfg.people,cfg.adults,cfg.drop_adults,coalesce(v.declared,-1),coalesce(v.discount_amount,-1)) is not distinct from (p_people,p_adults,p_drop_adults,coalesce(p_bill,-1),coalesce(p_discount,-1)) then return cfg.version; end if;
 state:=case when p_people<v.people or p_adults<greatest(0,v.people-coalesce((select kids from public.reservations where id=v.reservation_id),0)) or p_drop_adults<least(p_adults,snapshot.drop_limit) then 'awaiting' else 'confirmed' end;
 if cfg.state in('awaiting','disputed') then state:='awaiting';end if;
 if state='awaiting' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'Scrie motivul diferenței de număr.'; end if;
 ver:=coalesce(cfg.version,0)+1;
 insert into private.visit_counts(visit_id,version,people,adults,drop_adults,state,deadline,reason,by_user)
 values(p_visit,ver,p_people,p_adults,p_drop_adults,state,case when state='awaiting' then now()+interval '24 hours' end,p_reason,auth.uid())
 on conflict(visit_id) do update set version=excluded.version,people=excluded.people,adults=excluded.adults,drop_adults=excluded.drop_adults,state=excluded.state,deadline=excluded.deadline,reason=excluded.reason,by_user=excluded.by_user;
 update public.visits set outcome='a venit',declared=p_bill,bill=case when bill_source='bon' then bill else p_bill end,
 bill_source=case when bill_source='bon' then 'bon' when p_bill is not null then 'local' end,discount_amount=case when bill_source='bon' then coalesce(discount_amount,p_discount) else coalesce(p_discount,discount_amount) end,closed_by=auth.uid(),closed_at=now() where id=p_visit;
 return ver;
end $function$


CREATE OR REPLACE FUNCTION public.biz_dashboard_v2(p_venue text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.biz_finance_v2(p_venue text, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.biz_identity_complete(p_username text, p_first_name text, p_birth_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare created_id uuid;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtext('business-identity:'||auth.uid()::text));
 if exists(select 1 from public.profiles where id=auth.uid()) then return public.biz_identity_status(); end if;
 if p_birth_date is null or p_birth_date>current_date-interval '16 years' then raise exception 'CeFaci e de la 16 ani în sus.' using errcode='check_violation'; end if;
 if p_birth_date<current_date-interval '110 years' then raise exception 'Data nașterii nu pare bună.' using errcode='check_violation'; end if;
 -- ON CONFLICT DO NOTHING also protects a Client profile concurrently created outside this wrapper's lock.
 insert into public.profiles(id,username,first_name) values(auth.uid(),lower(p_username),trim(p_first_name)) on conflict(id) do nothing returning id into created_id;
 if created_id is not null then insert into public.profile_private(id,birth_date,prefs) values(created_id,p_birth_date,'{}') on conflict(id) do nothing; end if;
 return public.biz_identity_status();
end $function$


CREATE OR REPLACE FUNCTION public.biz_identity_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.profiles;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into p from public.profiles where id=auth.uid();
 return jsonb_build_object('has_profile',p.id is not null,'username',p.username,'first_name',p.first_name);
end $function$


CREATE OR REPLACE FUNCTION public.biz_month(p_venue text, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date:=date_trunc('month',coalesce(p_month,(now() at time zone 'Europe/Bucharest')::date))::date; j jsonb;
begin j:=public.biz_finance_v2(p_venue,d,(d+interval '1 month'-interval '1 day')::date); return j||jsonb_build_object('month',d,'bills',j->'revenue'); end $function$


CREATE OR REPLACE FUNCTION public.biz_my_venues()
 RETURNS TABLE(venue_id text, name text, role text, status text, founder boolean, rate numeric, free_until date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.venue_id, coalesce(v.edit->>'name', v.name), m.role, p.status, case when m.role in ('proprietar','manager') then p.founder end, null::numeric, case when m.role in ('proprietar','manager') then p.free_until end
  from public.partner_members m join public.partners p on p.venue_id = m.venue_id left join public.venues v on v.id = m.venue_id
  where m.user_id = (select auth.uid()) and m.active order by 2
$function$


CREATE OR REPLACE FUNCTION public.biz_ownership_dispute_reply(p_id uuid, p_reply text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.partner_requests;
begin
 select * into r from private.partner_requests where id=p_id for update;
 if not private.business_authenticated() or r.id is null or r.kind<>'dispute' or coalesce(private.member_role(r.venue_id),'')<>'proprietar' then raise exception 'Doar proprietarul localului.'; end if;
 if r.status<>'pending' or r.owner_response_deadline is null or now()>r.owner_response_deadline then raise exception 'Termenul de răspuns a expirat.'; end if;
 if p_reply is null or length(trim(p_reply)) not between 10 and 2000 then raise exception 'Descrie situația în 10–2000 de caractere.'; end if;
 if r.owner_responded_at is not null then raise exception 'Răspunsul a fost deja trimis.'; end if;
 update private.partner_requests set owner_response=trim(p_reply),owner_responded_by=auth.uid(),owner_responded_at=now(),updated_at=now() where id=r.id;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,auth.uid(),'owner_replied');
end $function$


CREATE OR REPLACE FUNCTION public.biz_ownership_disputes(p_venue text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.business_authenticated() or coalesce(private.member_role(p_venue),'')<>'proprietar' then raise exception 'Doar proprietarul localului.'; end if;
 with noticed as (update private.partner_requests set owner_notice_at=now(),owner_response_deadline=now()+interval '3 days',updated_at=now() where venue_id=p_venue and kind='dispute' and status='pending' and owner_notice_at is null returning id) insert into private.partner_request_log(request_id,by_user,action) select id,auth.uid(),'owner_notice_displayed' from noticed;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'venue_id',venue_id,'venue_name',venue_name,'submitted_at',submitted_at,'deadline',owner_response_deadline,'response',owner_response,'status',status) order by submitted_at desc)
 from private.partner_requests where venue_id=p_venue and kind='dispute' and status='pending'),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.biz_partner_proof_access(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.partner_requests;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.partner_requests where id=p_id and(user_id=auth.uid() or private.can('partners'));
 if r.id is null or r.proof_path is null or r.proof_deleted_at is not null or r.proof_uploaded_at<=now()-interval '90 days' then raise exception 'Documentul nu este disponibil.'; end if;
 insert into private.partner_proof_access values(r.id,auth.uid(),now()+interval '5 minutes') on conflict(request_id,user_id) do update set expires_at=excluded.expires_at;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,auth.uid(),'proof_access_authorized');
 return jsonb_build_object('bucket','business-proofs','path',r.proof_path,'expires_in',300);
end $function$


CREATE OR REPLACE FUNCTION public.biz_partner_request_cancel(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.partner_requests;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.partner_requests where id=p_id and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Cererea nu este disponibilă.'; end if;
 if r.status='cancelled' then return private.partner_request_public(r); end if;
 if r.status not in('draft','pending') then raise exception 'Cererea a fost deja soluționată.'; end if;
 update private.partner_requests set status='cancelled',updated_at=now() where id=r.id returning * into r;
 delete from private.partner_proof_access where request_id=r.id;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,auth.uid(),'cancelled');
 return private.partner_request_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.biz_partner_request_create(p_key text, p_kind text, p_venue text, p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid(); r private.partner_requests; d jsonb; k text; val text; vn text; claimed boolean;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 perform private.require_v2();
 if private.staff_role(me) is not null then raise exception 'Echipa CeFaci nu poate solicita propriul parteneriat.'; end if;
 if p_key is null or length(p_key) not between 1 and 100 or p_kind is null or p_kind not in('claim','new','dispute') then raise exception 'Cerere invalidă.'; end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or length(p_details::text)>4000 then raise exception 'Completează datele cererii.'; end if;
 d:='{}';
 for k,val in select key,trim(value) from jsonb_each_text(p_details) loop
  if k not in('requester_name','requester_role','firm','cui','phone','venue_name','address','city','category') or val is null or length(val)>300 or val ~ '[[:cntrl:]]' then raise exception 'Datele cererii nu sunt valide.'; end if;
  d:=d||jsonb_build_object(k,val);
 end loop;
 if coalesce(length(d->>'requester_name'),0) not between 2 and 100 or coalesce(length(d->>'requester_role'),0) not between 2 and 100 or coalesce(length(d->>'firm'),0) not between 2 and 120 or coalesce(d->>'phone','') !~ '^\+?[0-9 ()-]{7,24}$' then raise exception 'Completează numele, rolul, firma și telefonul de contact.'; end if;
 if not private.business_cui_valid(d->>'cui') then raise exception 'CUI invalid. Verifică cifrele (inclusiv cifra de control).'; end if;
 d:=jsonb_set(d,'{cui}',to_jsonb(regexp_replace(upper(d->>'cui'),'^RO','','')));
 perform pg_advisory_xact_lock(hashtext('business-request:'||me::text));
 select * into r from private.partner_requests where user_id=me and request_key=p_key;
 if r.id is not null then
  if r.kind<>p_kind or r.venue_id is distinct from p_venue or r.details<>d then raise exception 'Această cheie aparține altei cereri.'; end if;
  return private.partner_request_public(r);
 end if;
 if (select count(*) from private.partner_requests where user_id=me and status in('draft','pending'))>=5 or (select count(*) from private.partner_requests where user_id=me and created_at>now()-interval '1 day')>=10 then raise exception 'Ai deja cereri în lucru. Așteaptă verificarea lor.'; end if;
 if p_kind='new' then
  if p_venue is not null then raise exception 'Un local nou nu are încă ID.'; end if;
  if coalesce(length(d->>'venue_name'),0) not between 2 and 120 or coalesce(length(d->>'address'),0) not between 3 and 200 or coalesce(length(d->>'city'),0) not between 2 and 100 or coalesce(length(d->>'category'),0) not between 2 and 50 then raise exception 'Completează numele, adresa, orașul și categoria localului.'; end if;
  vn:=d->>'venue_name';
  if exists(select 1 from private.partner_requests where user_id=me and kind='new' and status in('draft','pending') and lower(details->>'venue_name')=lower(vn) and lower(details->>'city')=lower(d->>'city') and lower(details->>'address')=lower(d->>'address')) then raise exception 'Ai deja o cerere pentru acest local.'; end if;
 else
  select coalesce(edit->>'name',name) into vn from public.venues where id=p_venue and status='on';
  if vn is null then raise exception 'Localul nu mai este disponibil. Caută-l din nou.'; end if;
  select exists(select 1 from public.partner_members where venue_id=p_venue and role='proprietar' and active) into claimed;
  if claimed and p_kind<>'dispute' then raise exception 'Localul este revendicat. Deschide o dispută cu document.'; end if;
  if not claimed and p_kind='dispute' then raise exception 'Localul nu este revendicat. Trimite o cerere de revendicare.'; end if;
  if exists(select 1 from public.partner_members where venue_id=p_venue and user_id=me and role='proprietar' and active) then raise exception 'Ai deja acces ca proprietar la acest local.'; end if;
  if exists(select 1 from private.partner_requests where user_id=me and venue_id=p_venue and status in('draft','pending')) then raise exception 'Ai deja o cerere pentru acest local.'; end if;
 end if;
 insert into private.partner_requests(user_id,request_key,kind,venue_id,venue_name,details) values(me,p_key,p_kind,p_venue,vn,d) returning * into r;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,me,'created');
 return private.partner_request_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.biz_partner_request_submit(p_id uuid, p_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.partner_requests; m jsonb; mime text; suffix text;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 perform private.require_v2();
 select * into r from private.partner_requests where id=p_id and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Cererea nu este disponibilă.'; end if;
 if r.status='pending' and r.proof_path=p_path then return private.partner_request_public(r); end if;
 if r.status<>'draft' then raise exception 'Cererea nu mai poate fi trimisă.'; end if;
 if not coalesce(private.business_proof_upload_allowed(p_path),false) then raise exception 'Documentul nu aparține acestei cereri.'; end if;
 if to_regclass('storage.objects') is null then raise exception 'Încărcarea documentelor nu este configurată.'; end if;
 select metadata into m from storage.objects where bucket_id='business-proofs' and name=p_path;
 mime:=m->>'mimetype'; suffix:=substring(p_path from '\.([a-z]+)$');
 if m is null or coalesce(m->>'size','') !~ '^[0-9]{1,9}$' then raise exception 'Încarcă documentul înainte de trimitere.'; end if;
 if (m->>'size')::bigint not between 1 and 8388608 or not coalesce((suffix='pdf' and mime='application/pdf') or(suffix='jpg' and mime='image/jpeg') or(suffix='png' and mime='image/png'),false) then raise exception 'Documentul trebuie să fie PDF, JPEG sau PNG, cel mult 8 MB.'; end if;
 -- Refresh claimed state when the draft is sent, so a newly claimed venue becomes a dispute.
 if r.kind='claim' and exists(select 1 from public.partner_members where venue_id=r.venue_id and role='proprietar' and active) then raise exception 'Localul a fost revendicat între timp. Anulează cererea și deschide o dispută.'; end if;
 update private.partner_requests set status='pending',proof_path=p_path,proof_fingerprint=m->>'eTag',proof_uploaded_at=now(),submitted_at=now(),updated_at=now(),owner_response_deadline=null where id=r.id returning * into r;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,auth.uid(),'submitted');
 return private.partner_request_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.biz_partner_requests()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 return coalesce((select jsonb_agg(private.partner_request_public(r) order by r.created_at desc) from private.partner_requests r where user_id=auth.uid()),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.biz_plus_off_today(p_venue text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date:=(now() at time zone 'Europe/Bucharest')::date;
begin
 perform private.require_v2();
 perform 1 from public.partners where venue_id=p_venue for update;
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if exists(select 1 from private.plus_off_days where venue_id=p_venue and day=d) then return; end if;
 if (now() at time zone 'Europe/Bucharest')::time>=time '16:00' then raise exception 'Plus poate fi oprit azi doar înainte de 16:00.'; end if;
 if (select count(*) from private.plus_off_days where venue_id=p_venue and date_trunc('month',day)=date_trunc('month',d))>=4 then raise exception 'Ai folosit cele patru zile din lună.'; end if;
 insert into private.plus_off_days values(p_venue,d,auth.uid(),now());
end $function$


CREATE OR REPLACE FUNCTION public.biz_plus_v2(p_venue text, p_pct integer, p_schedule jsonb)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.biz_scan_v2(p_venue text, p_ticket text, p_table text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t private.group_tickets; v public.visits; name text;
begin
 perform private.require_v2();
 if auth.uid() is null or private.member_role(p_venue) is null then raise exception 'Nu ești în echipa localului.'; end if;
 select * into t from private.group_tickets where token=trim(p_ticket);
 if t.plan_id is null or t.expires_at<=now() or not exists(select 1 from public.plans where id=t.plan_id and venue_id=p_venue and status='active') then raise exception 'Cod greșit, expirat sau pentru alt local.'; end if;
 v:=private.arrive(t.plan_id,true,p_table);
 select first_name into name from public.profiles where id=v.user_id;
 return jsonb_build_object('visit',v.id,'name',name,'people',v.people,'discount',v.discount_pct,'scope',v.discount_scope,'discount_people',v.discount_people,'plus',v.plus,'table',v.table_no,'word',private.day_word(v.venue_id,v.work_day));
end $function$


CREATE OR REPLACE FUNCTION public.biz_settings_save(p_venue text, p_reservations_on boolean, p_auto_confirm_max integer, p_plus_pct integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin raise exception 'Actualizează Business pentru programul versionat.'; end $function$


CREATE OR REPLACE FUNCTION public.biz_settings_v2(p_venue text, p_mode text, p_on boolean, p_paused boolean, p_capacity integer, p_duration integer, p_auto integer, p_hours jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.biz_team(p_venue text)
 RETURNS TABLE(user_id uuid, username text, first_name text, role text, active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select m.user_id, p.username, p.first_name, m.role, m.active from public.partner_members m join public.profiles p on p.id = m.user_id
where m.venue_id = p_venue and private.member_role(p_venue) in ('proprietar', 'manager') order by m.created_at
$function$


CREATE OR REPLACE FUNCTION public.biz_team_set(p_venue text, p_username text, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare mine text := private.member_role(p_venue); who uuid;
begin
if mine is null or mine not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
if p_role not in ('proprietar', 'manager', 'receptie', 'scanare', 'scos') then raise exception 'Rol necunoscut.'; end if;
if mine = 'manager' and p_role not in ('receptie', 'scanare', 'scos') then raise exception 'Managerul adaugă doar recepție și scanare.'; end if;
select id into who from public.profiles where username = lower(trim(both '@ ' from p_username));
if who is null then raise exception 'Nu găsesc @%. Omul își face întâi cont în aplicația CeFaci.', p_username; end if;
if who = auth.uid() then raise exception 'Nu-ți poți schimba singur rolul.'; end if;
if mine = 'manager' and exists (select 1 from public.partner_members where venue_id = p_venue and user_id = who and role in ('proprietar', 'manager')) then
raise exception 'Nu ai voie.'; end if;
if p_role = 'scos' then
update public.partner_members set active = false where venue_id = p_venue and user_id = who;
else
insert into public.partner_members (venue_id, user_id, role, added_by) values (p_venue, who, p_role, auth.uid())
on conflict (venue_id, user_id) do update set role = excluded.role, active = true;
end if;
end $function$


CREATE OR REPLACE FUNCTION public.biz_today(p_venue text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin return public.biz_dashboard_v2(p_venue); end $function$


CREATE OR REPLACE FUNCTION public.biz_venue_search(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare term text:=trim(p_query);
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 if term is null or length(term)<2 then return '[]'; end if;
 if length(term)>100 then raise exception 'Caută după nume sau oraș (cel mult 100 de caractere).'; end if;
 return coalesce((select jsonb_agg(x.item order by x.name,x.id) from (
 select v.id,coalesce(v.edit->>'name',v.name) name,jsonb_build_object('id',v.id,'name',coalesce(v.edit->>'name',v.name),
 'address',coalesce(v.edit->>'street',v.data->>'street',''),'city',coalesce(v.edit->>'city',v.data->>'city',''),
 'claimed',exists(select 1 from public.partner_members m where m.venue_id=v.id and m.active and m.role='proprietar')) item
 from public.venues v where v.status='on' and position(lower(term) in lower(coalesce(v.edit->>'name',v.name)||' '||coalesce(v.edit->>'city',v.data->>'city','')))>0
 order by coalesce(v.edit->>'name',v.name),v.id limit 25) x),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.biz_visit_attendance(p_visit uuid, p_adults integer, p_discounted integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.plan_id is not null or x.group_visit or exists(select 1 from private.visit_pricing s where s.visit_id=x.id and s.version='per-person-v2') then raise exception 'Actualizează Business pentru închiderea grupului.'; end if;
  if x.id is null or coalesce(private.member_role(x.venue_id),'') not in ('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
  if p_adults is null or p_adults not between 0 and x.people
     or coalesce(p_discounted,p_adults) not between 0 and p_adults then raise exception 'Numărul de oameni nu e bun.'; end if;
  if now() > ((x.work_day + 1)::timestamp + time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Seara asta s-a închis.'; end if;
  if x.outcome <> 'a venit' then raise exception 'Confirmă întâi sosirea.'; end if;
  insert into private.visit_attendance(visit_id,adults,discounted,confirmed_by)
  values(x.id,p_adults,coalesce(p_discounted,p_adults),auth.uid())
  on conflict(visit_id) do update set adults=excluded.adults,discounted=excluded.discounted,
    confirmed_by=excluded.confirmed_by,confirmed_at=now();
end $function$


CREATE OR REPLACE FUNCTION public.drop_create(p_venue text, p_title text, p_pct_all integer, p_pct_plus integer, p_seats integer, p_minutes integer, p_starts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_min_group integer DEFAULT 1, p_adult boolean DEFAULT true, p_new_only boolean DEFAULT false)
 RETURNS drops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin raise exception 'Actualizează Business pentru calendarul Live Drops.'; end $function$


CREATE OR REPLACE FUNCTION public.drop_create_v2(p_venue text, p_title text, p_all integer, p_plus integer, p_seats integer, p_minutes integer, p_min integer DEFAULT 1, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_adult boolean DEFAULT false, p_new boolean DEFAULT false, p_key text DEFAULT NULL::text, p_edit uuid DEFAULT NULL::uuid)
 RETURNS drops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.drop_stop(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v text;
begin
select venue_id into v from public.drops where id = p_id;
if coalesce(private.member_role(v), '') not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
update public.drops set stopped_at = now() where id = p_id and stopped_at is null;
end $function$


CREATE OR REPLACE FUNCTION public.reservation_decide(p_id uuid, p_ok boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin raise exception 'Actualizează Business pentru capacitatea rezervării.'; end $function$


CREATE OR REPLACE FUNCTION public.reservation_decide_v2(p_id uuid, p_action text, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION public.support_report_create(p_key text, p_kind text, p_source text, p_title text, p_description text, p_venue text DEFAULT NULL::text, p_photo_mime text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid:=auth.uid(); r private.support_reports; title text:=trim(p_title); body text:=trim(p_description); rid uuid:=gen_random_uuid();
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 if p_key is null or length(p_key) not between 1 and 100 or p_kind is null or p_kind not in('issue','missing_place') or p_source is null or p_source not in('client','business') then raise exception 'Cererea nu este validă.'; end if;
 if title is null or length(title) not between 3 and 120 or body is null or length(body) not between (case when p_kind='issue' then 10 else 2 end) and 4000 or title ~ '[[:cntrl:]]' or body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'Completează titlul (3–120 caractere) și descrierea (10–4000 caractere pentru o problemă).'; end if;
 if p_photo_mime is not null and p_photo_mime not in('image/jpeg','image/png') then raise exception 'Poza trebuie să fie JPEG sau PNG, cel mult 5 MB.'; end if;
 if p_kind='missing_place' and (p_source<>'client' or p_venue is not null) then raise exception 'Propune locul nou din Client.'; end if;
 if p_venue is not null then
  if not exists(select 1 from public.venues where id=p_venue and status='on') then raise exception 'Localul nu este disponibil.'; end if;
  if p_source='business' and private.member_role(p_venue) is null then raise exception 'Nu ai acces la acest local.'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtext('cefaci.support.'||me::text));
 select * into r from private.support_reports where user_id=me and request_key=p_key;
 if r.id is not null then
  if r.kind<>p_kind or r.source<>p_source or r.title<>title or r.description<>body or r.venue_id is distinct from p_venue or r.photo_mime is distinct from p_photo_mime then raise exception 'Aceeași cheie nu poate fi folosită pentru altă raportare.'; end if;
  return private.support_report_public(r);
 end if;
 if (select count(*) from private.support_reports where user_id=me and(status in('new','in_progress') or(status='draft' and created_at>now()-interval '1 day')))>=10 or ((select count(*) from private.support_reports where user_id=me and created_at>now()-interval '1 day')+(select count(*) from public.reports where user_id=me and created_at>now()-interval '1 day'))>=20 then raise exception 'Ai trimis destule raportări. Așteaptă răspunsul echipei.'; end if;
 insert into private.support_reports(id,user_id,request_key,kind,source,title,description,venue_id,photo_mime,photo_path)
 values(rid,me,p_key,p_kind,p_source,title,body,p_venue,p_photo_mime,case when p_photo_mime is not null then me::text||'/'||rid::text||'/photo.'||case when p_photo_mime='image/jpeg' then 'jpg' else 'png' end end) returning * into r;
 insert into private.support_report_log(report_id,by_user,action) values(r.id,me,'created');
 return private.support_report_public(r);
end $function$


CREATE OR REPLACE FUNCTION public.visit_close(p_visit uuid, p_came boolean, p_bill numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.plan_id is not null or x.group_visit or exists(select 1 from private.visit_pricing s where s.visit_id=x.id and s.version='per-person-v2') then raise exception 'Actualizează Business pentru închiderea grupului.'; end if;
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
end $function$


