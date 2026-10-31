-- Reparații din simularea de lansare (31.10, tests/launch-simulation.test.ts, raportul release/simulare-lansare-31-10.md).

-- 1. Localul nu-și contestă propriul total (bonul scris de el cu biz_entry_total_v3): îl corectează, nu-l scoate din
--    calcul fără nimeni altcineva („patru ochi”, docs/logica-business-admin.md §8.9). Bonurile clientului sau ale
--    ospătarului rămân contestabile; contestația așteaptă Adminul.
create or replace function public.biz_receipt_dispute_v3(p_receipt uuid, p_reason text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare r public.bills; v public.visits;
begin perform private.require_secure_scope('business');
 select * into r from public.bills where id=p_receipt;
 select * into v from public.visits where id=r.visit_id;
 if r.id is null or coalesce(private.secured_member_role(r.venue_id),'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if r.by_role='local' then raise exception 'Totalul scris de local se corectează, nu se contestă: scrie totalul corect.'; end if;
 if v.work_day<private.work_day(now())-35 then raise exception 'Bonul e prea vechi pentru contestație.'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Scrie motivul (cel puțin 5 litere).'; end if;
 insert into private.receipt_disputes(receipt_id,reason,by_user) values(r.id,left(trim(p_reason),300),auth.uid()) on conflict(receipt_id) do nothing;
end $function$;

-- 2. Adminul vede contestațiile și le hotărăște (până acum rămâneau „pending” pentru totdeauna).
alter table private.receipt_disputes add column if not exists decided_by uuid references public.profiles(id) on delete set null;
alter table private.receipt_disputes add column if not exists decided_at timestamptz;
alter table private.receipt_disputes add column if not exists decision_note text check (decision_note is null or length(decision_note) <= 300);

create or replace function public.admin_receipt_disputes(p_state text default 'pending')
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin perform private.require_secure_scope('admin');
 if not private.can('operations.read') then raise exception 'Nu ai voie.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('receipt',d.receipt_id,'state',d.state,'reason',d.reason,'at',d.at,
   'venue',b.venue_id,'visit',b.visit_id,'total',b.total,'discount',b.discount,'issued_at',b.issued_at,'number',b.number,'by_role',b.by_role,
   'work_day',x.work_day,'decided_at',d.decided_at,'note',d.decision_note) order by d.at)
  from private.receipt_disputes d join public.bills b on b.id=d.receipt_id join public.visits x on x.id=b.visit_id
  where p_state is null or d.state=p_state),'[]'::jsonb);
end $function$;

-- upheld = bonul nu e al lor (rămâne scos din total); dismissed = bonul e bun (intră din nou în 10%)
create or replace function public.admin_receipt_dispute_decide(p_receipt uuid, p_uphold boolean, p_note text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare d private.receipt_disputes;
begin perform private.require_secure_scope('admin');
 if not private.can('operations.decide') then raise exception 'Nu ai voie.'; end if;
 select * into d from private.receipt_disputes where receipt_id=p_receipt for update;
 if d.receipt_id is null then raise exception 'Contestația nu există.'; end if;
 if d.state<>'pending' then raise exception 'Contestația a fost deja hotărâtă.'; end if;
 if d.by_user=auth.uid() then raise exception 'Nu poți hotărî propria contestație.'; end if;
 if length(trim(coalesce(p_note,'')))<5 then raise exception 'Scrie de ce (cel puțin 5 litere).'; end if;
 update private.receipt_disputes set state=case when p_uphold then 'upheld' else 'dismissed' end, decided_by=auth.uid(), decided_at=now(), decision_note=left(trim(p_note),300)
  where receipt_id=p_receipt;
end $function$;
revoke all on function public.admin_receipt_disputes(text), public.admin_receipt_dispute_decide(uuid,boolean,text) from public, anon;
grant execute on function public.admin_receipt_disputes(text), public.admin_receipt_dispute_decide(uuid,boolean,text) to authenticated;

-- 3 + 4. Bonul: amprenta ține și de local (două localuri ale aceleiași firme pot avea același număr în aceeași zi) și
--    limita de 20 de bonuri pe intrare se verifică aici, sub lacătul intrării (două cereri deodată nu o mai depășesc).
create or replace function public.visit_receipt_v3(p_user uuid, p_visit uuid, p_cui text, p_total numeric, p_discount numeric, p_date date, p_time time without time zone, p_number text, p_staff boolean)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v public.visits; expected_cui text; issued timestamptz; fp text; oldv uuid; rid uuid; num text;
begin
 perform private.require_v2();
 select * into v from public.visits where id=p_visit for update;
 if v.id is null then raise exception 'Nu găsim intrarea.'; end if;
 if p_staff then
  if not exists(select 1 from public.partner_members m where m.venue_id=v.venue_id and m.user_id=p_user and m.active) then raise exception 'Intrarea nu e la localul tău.'; end if;
  if now()>((v.work_day+1)+time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Intrarea s-a închis a doua zi la 12:00.'; end if;
 elsif now()>((v.work_day+2)::timestamp at time zone 'Europe/Bucharest') or not private.plan_access(v.plan_id,p_user,true) then raise exception 'Nu participi la ieșire.'; end if;
 select s.cui into expected_cui from private.visit_pricing s where s.visit_id=v.id;
 if regexp_replace(coalesce(p_cui,''),'[^0-9]','','g')<>expected_cui then raise exception 'Bonul nu este de la firma localului.'; end if;
 if p_total is null or p_total<=0 or p_total>=100000 or p_discount<0 or p_discount>=100000 or p_time is null or p_date is null then raise exception 'Bonul trebuie să conțină totalul, data și ora.'; end if;
 issued:=(p_date+p_time) at time zone 'Europe/Bucharest';
 if issued<v.scanned_at-interval '5 minutes' or issued>v.scanned_at+interval '12 hours' or issued>now()+interval '5 minutes' then raise exception 'Bonul ăsta nu pare de la seara asta.'; end if;
 num:=nullif(ltrim(regexp_replace(coalesce(p_number,''),'[^0-9]','','g'),'0'),'');
 fp:=case when num is not null then expected_cui||'|'||v.venue_id||'|nr|'||num||'|'||p_date else expected_cui||'|'||v.venue_id||'|'||p_date||'|'||to_char(p_time,'HH24:MI')||'|'||round(p_total,2) end;
 select f.visit_id into oldv from private.receipt_fingerprints f where f.fingerprint=fp;
 if oldv is null then
  select r.visit_id,r.id into oldv,rid from public.bills r join private.visit_pricing s on s.visit_id=r.visit_id where s.cui=expected_cui and r.venue_id=v.venue_id and r.total=p_total and r.issued_at=issued limit 1;
 end if;
 if oldv is not null and oldv<>v.id then raise exception 'Bonul ăsta e deja la altă intrare.'; end if;
 if oldv is not null then
  if rid is null then select r.id into rid from public.bills r where r.visit_id=v.id and r.issued_at=issued and r.total=p_total limit 1; end if;
  if rid is null then select r.id into rid from public.bills r where r.visit_id=v.id and r.number=num limit 1; end if;
  if not p_staff and rid is not null then insert into private.receipt_scanners(receipt_id,user_id) values(rid,p_user) on conflict do nothing; end if;
  return jsonb_build_object('ok',true,'visit',v.id,'duplicate',true,'receipt',rid);
 end if;
 if (select count(*) from public.bills where visit_id=v.id)>=20 then raise exception 'Intrarea are deja 20 de bonuri.'; end if;
 insert into private.receipt_fingerprints(fingerprint,visit_id) values(fp,v.id);
 insert into public.bills(visit_id,venue_id,user_id,total,discount,issued_at,number,by_role)
  values(v.id,v.venue_id,p_user,p_total,p_discount,issued,num,case when p_staff then 'staff' else 'client' end) returning id into rid;
 if not p_staff then insert into private.receipt_scanners(receipt_id,user_id) values(rid,p_user) on conflict do nothing; end if;
 update public.visits set bill=(select sum(total) from public.bills where visit_id=v.id),bill_source='bon',discount_amount=coalesce(p_discount,discount_amount),proof='receipt',outcome='a venit',closed_at=coalesce(closed_at,now()) where id=v.id;
 return jsonb_build_object('ok',true,'visit',v.id,'duplicate',false,'receipt',rid);
end $function$;

-- 5. Un minor (16–17 ani) nu face plan la un loc doar pentru adulți, nici ocolind aplicația (aceeași regulă ca adultOnly
--    din src/engine/core.ts: club, bar, pub, grădină de bere, narghilea, 18+ din date).
create or replace function private.venue_adult_only(p_venue text) returns boolean
 language sql stable security definer set search_path to ''
as $$
 select coalesce((select coalesce((d->>'minAge')::int,0)>=18 or cat in('club','bar') or d->>'k' in('nightclub','bar','pub','biergarten')
   or coalesce(d->'cuisines','[]'::jsonb) ? 'shisha'
   or lower(coalesce(d->>'name',name,'')) ~ '(shisha|hookah|narghil|strip|gentlemen|erotic|casino|cazino|pariuri)'
  from (select coalesce(v.data,'{}'::jsonb)||coalesce(v.edit,'{}'::jsonb) d, coalesce(v.edit->>'cat',v.cat) cat, v.name from public.venues v where v.id=p_venue) x), false)
$$;
revoke all on function private.venue_adult_only(text) from public, anon, authenticated;

create or replace function private.plans_no_minor_adult() returns trigger
 language plpgsql security definer set search_path to ''
as $$
begin
 if new.venue_id is not null and coalesce(private.age(new.owner_id), 99) < 18 and private.venue_adult_only(new.venue_id) then
  raise exception 'Locul ăsta e doar pentru adulți (18+).' using errcode='check_violation';
 end if;
 return new;
end $$;
drop trigger if exists plans_no_minor_adult on public.plans;
create trigger plans_no_minor_adult before insert or update of venue_id on public.plans for each row execute function private.plans_no_minor_adult();

-- 6. „Datele mele” include și intrările la localuri (localul, ziua, masa, totalul), nu doar bonurile.
create or replace function public.privacy_export_my_data()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare me uuid:=private.privacy_require_user();begin
 return jsonb_build_object('format','cefaci-personal-core-v1','generated_at',now(),'user_id',me,
 'coverage','Copie a profilului, preferințelor, activității din aplicație (prieteni, gășci, planuri, voturi, XP, notificări, FreeNow, bilete, intrări la localuri, bonuri, semnalări; cel mult 500 de rânduri pe fiecare) și a celor mai recente 100 de cereri privind datele personale. Nu este răspunsul integral la o cerere de acces sau portabilitate: pentru înregistrările care nu apar aici (de exemplu jurnale tehnice sau date ținute de localuri), trimite o cerere separată.',
 'profile',(select jsonb_build_object('username',p.username,'first_name',p.first_name,'created_at',p.created_at)from public.profiles p where p.id=me),
 'preferences',(select jsonb_build_object('birth_date',p.birth_date,'zone',p.prefs->'zone','likes',p.prefs->'likes','budget',p.prefs->'budget','updated_at',p.updated_at)from public.profile_private p where p.id=me),
 'friends',coalesce((select jsonb_agg(to_jsonb(x)-'requester'-'addressee'||jsonb_build_object('with',p.username,'sent_by_me',x.requester=me)) from (select * from public.friendships where requester=me or addressee=me limit 500)x left join public.profiles p on p.id=case when x.requester=me then x.addressee else x.requester end),'[]'),
 'crews',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.crew_members where user_id=me limit 500)x),'[]'),
 'plans',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.plan_members where user_id=me limit 500)x),'[]'),
 'ballots',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ballots where user_id=me limit 500)x),'[]'),
 'outing_votes',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.outing_votes where user_id=me limit 500)x),'[]'),
 'xp',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.xp_log where user_id=me limit 500)x),'[]'),
 'notifications',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.notifications where user_id=me order by created_at desc limit 500)x),'[]'),
 'free_now',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.free_now where user_id=me limit 500)x),'[]'),
 'ticket_orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ticket_orders where user_id=me limit 500)x),'[]'),
 'tickets',coalesce((select jsonb_agg(to_jsonb(x)-'used_by') from (select * from public.tickets where holder=me limit 500)x),'[]'),
 'visits',coalesce((select jsonb_agg(jsonb_build_object('venue',x.venue_id,'work_day',x.work_day,'scanned_at',x.scanned_at,'table',x.table_no,'bill',x.bill,'outcome',x.outcome)) from (select * from public.visits where user_id=me order by scanned_at desc limit 500)x),'[]'),
 'bills',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.bills where user_id=me limit 500)x),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.reports where user_id=me limit 500)x),'[]'),
 'push_devices',coalesce((select jsonb_agg(to_jsonb(x)-'token') from (select * from public.push_tokens where user_id=me limit 50)x),'[]'),
 'requests',public.privacy_my_requests(null,100,0),
 'requests_count',(select count(*)from private.privacy_requests where user_id=me),
 'requests_truncated',(select count(*)>100 from private.privacy_requests where user_id=me));
end $function$;

-- 7. O semnalare deja închisă nu se rescrie (alt om a rezolvat-o între timp: clientul vedea „respins” după „rezolvat”).
create or replace function public.admin_report_close(p_id uuid, p_status text, p_answer text default null::text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare rev integer; cur text;
begin perform private.require_secure_scope('admin');
 if not private.can('reports.close') then raise exception 'Nu ai voie să închizi semnalări.'; end if;
 if p_status is null or p_status not in('rezolvat','respins') then raise exception 'Stare necunoscută.'; end if;
 select revision, status into rev, cur from public.reports where id=p_id for update;
 if rev is null then raise exception 'Semnalarea nu este disponibilă.'; end if;
 if cur<>'nou' then raise exception 'Semnalarea a fost deja închisă de altcineva. Reîncarcă lista.'; end if;
 perform public.admin_legacy_report_update(p_id,case when p_status='rezolvat' then 'resolved' else 'rejected' end,coalesce(nullif(trim(p_answer),''),'Verificată de echipa CeFaci.'),rev);
end $function$;

-- 8. Id-urile locurilor de la Google: doar serverul (ca place_day și place_hours).
revoke all on public.venue_google from anon, authenticated;
