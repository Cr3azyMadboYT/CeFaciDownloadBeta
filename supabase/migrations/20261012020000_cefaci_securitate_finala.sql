-- Închiderea punctelor rămase din verificarea de securitate (12.10, Cornel: „închide-le pe toate”):
-- 1. un om poate face cel mult 30 de planuri pe zi; a doua sosire în aceeași zi la același local nu mai primește reducerea Plus;
-- 2. taxa pe rezervare nu mai depinde de numărul de copii declarat de client: contează adulții confirmați de local;
-- 3. quiz-ul de lansare: cel mult 6 trimiteri/retrageri pe oră de pe aceeași rețea. Adresa nu se păstrează:
--    doar o amprentă care se schimbă în fiecare zi (sha256 din IP + zi), deci nu poate fi legată de la o zi la alta.
create table if not exists private.launch_ip(fp text primary key, hour timestamptz not null, n int not null);
alter table private.launch_ip enable row level security;
revoke all on private.launch_ip from public,anon,authenticated;
create or replace function private.launch_ip_ok() returns boolean language plpgsql security definer set search_path='' as $$
declare h jsonb; ip text; v_fp text; hr timestamptz:=date_trunc('hour',now()); r private.launch_ip;
begin
 begin h:=nullif(current_setting('request.headers',true),'')::jsonb; exception when others then h:=null; end;
 ip:=coalesce(h->>'cf-connecting-ip',split_part(h->>'x-forwarded-for',',',1),h->>'x-real-ip');
 if ip is null or btrim(ip)='' then return true; end if;
 v_fp:=encode(sha256(convert_to('cefaci.quiz:'||btrim(ip)||':'||current_date::text,'UTF8')),'hex');
 select * into r from private.launch_ip where launch_ip.fp=v_fp for update;
 if r.fp is null then insert into private.launch_ip values(v_fp,hr,1) on conflict (fp) do update set n=private.launch_ip.n+1; return true; end if;
 if r.hour<hr then update private.launch_ip set hour=hr,n=1 where launch_ip.fp=r.fp; return true; end if;
 if r.n>=6 then return false; end if;
 update private.launch_ip set n=n+1 where launch_ip.fp=r.fp; return true;
end $$;
revoke all on function private.launch_ip_ok() from public,anon,authenticated;

create or replace function private.price_visit() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partners; nr int:=0; nd int:=0; r numeric:=0; d numeric:=0;
begin
 select * into p from public.partners where venue_id=new.venue_id;
 if new.reservation_id is not null then select people into nr from public.reservations where id=new.reservation_id; end if;
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
 -- a doua sosire de grup în aceeași zi, la același local, a aceluiași om se înregistrează, dar fără reducerea Plus
 -- (altfel planuri solo repetate dau reduceri și zile de Plus la nesfârșit)
 if plus and c.id is null and not p_staff and exists(select 1 from public.visits w where w.venue_id=x.venue_id and w.group_visit and w.plan_id<>p_plan and w.plus
  and w.work_day=private.work_day(now()) and (w.user_id=auth.uid() or exists(select 1 from private.visit_scanners s where s.visit_id=w.id and s.user_id=auth.uid()))) then plus:=false; end if;
 if plus and exists(select 1 from public.partners where venue_id=x.venue_id and status='activ') then pct:=private.plus_pct_at(x.venue_id,x.starts_at); end if;
 if c.id is not null then pct:=greatest(pct,coalesce(c.claimed_pct,0)); end if;
 insert into public.visits(venue_id,user_id,plan_id,group_visit,kind,reservation_id,claim_id,people,table_no,discount_pct,plus,discount_scope,discount_people,work_day,proof)
 values(x.venue_id,x.owner_id,p_plan,true,case when c.id is not null then 'drop' when r.id is not null then 'rezervare' when plus and pct>0 then 'plus' else 'plan' end,r.id,c.id,n,p_table,pct,plus,
 case when c.id is not null and not plus then 'eligible_consumption' else 'bill' end,case when plus then n else coalesce(c.seats,0) end,private.work_day(coalesce(r.at,c.created_at,x.starts_at)),case when p_staff then 'staff_ticket' else 'client_location' end) returning * into v;
 if not p_staff then insert into private.visit_scanners values(v.id,auth.uid()) on conflict do nothing; end if;
 return v;
end $$;
revoke all on function private.arrive(uuid,boolean,text) from public,anon,authenticated;

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
 if x.id is null and (select count(*) from public.plans where owner_id=me and created_at>now()-interval '1 day')>=30 then
  raise exception 'Ai creat destule planuri azi. Mâine mai poți.'; end if;
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

create or replace function public.launch_interest_submit(p_receipt uuid,p_nonce text,p_vote text,p_name text,p_email text default null,p_email_consent boolean default false,p_feedback_consent boolean default false,p_website text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare normalized_name text:=btrim(p_name); normalized_email text:=nullif(lower(btrim(p_email)),'');
 receipt bytea:=sha256(convert_to(p_receipt::text,'UTF8')); old private.launch_interests; minute timestamptz:=date_trunc('minute',now());
begin
 if p_receipt is null or substring(p_receipt::text,15,1)<>'4' or p_nonce is null or char_length(p_nonce)>12 or p_nonce!~'^[0-9]+$'
 or left(encode(sha256(convert_to(p_receipt::text||':'||p_nonce,'UTF8')),'hex'),3)<>'000' then
  raise exception 'Verificarea trimiterii a eșuat.' using errcode='22023'; end if;
 if p_vote is null or p_vote not in('yes','maybe','no') or normalized_name is null or char_length(normalized_name) not between 2 and 60
 or normalized_name~'[[:cntrl:]<>]' or p_feedback_consent is distinct from true or coalesce(p_website,'')<>'' then
  raise exception 'Verifică numele, votul și acordul pentru participare.' using errcode='22023'; end if;
 if (normalized_email is not null and (char_length(normalized_email)>254 or normalized_email!~'^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or p_email_consent is distinct from true))
 or (normalized_email is null and p_email_consent is true) then
  raise exception 'Emailul este opțional; completează-l și bifează acordul doar dacă dorești anunțul lansării.' using errcode='22023'; end if;
 -- Serializes new writes and withdrawals; expiry/quotas remain atomic under concurrency.
 perform pg_advisory_xact_lock(631042101425::bigint);
 if exists(select 1 from private.launch_withdrawals where receipt_hash=receipt)then raise exception 'Această trimitere a fost retrasă.' using errcode='22023'; end if;
 select * into old from private.launch_interests where receipt_hash=receipt;
 if found then
  if old.vote<>p_vote or old.name<>normalized_name or old.email is distinct from normalized_email then raise exception 'Trimiterea inițială este deja înregistrată. Nu reutiliza cheia pentru alt răspuns.' using errcode='22023'; end if;
  return jsonb_build_object('saved',true,'email_requested',old.email is not null);
 end if;
 if not private.launch_ip_ok() then raise exception 'Sunt prea multe trimiteri de pe această rețea. Încearcă mai târziu.' using errcode='P0001'; end if;
 if coalesce((select submissions from private.launch_quotas where bucket=minute),0)>=100
 or coalesce((select sum(submissions)from private.launch_quotas where bucket>=now()-interval '1 day'),0)>=5000 then
  raise exception 'Sunt prea multe trimiteri acum. Încearcă mai târziu.' using errcode='P0001'; end if;
 delete from private.launch_quotas where bucket<now()-interval '2 days';
 insert into private.launch_quotas values(minute,1)on conflict(bucket)do update set submissions=private.launch_quotas.submissions+1;
 insert into private.launch_interests(receipt_hash,vote,name,email,email_consent_at,consent_text)
 values(receipt,p_vote,normalized_name,normalized_email,case when normalized_email is not null then now()end,
 'Am cel puțin 16 ani și sunt de acord ca CeFaci să păstreze votul și numele ales pentru evaluarea interesului pentru lansare.'||
 case when normalized_email is not null then ' Vreau să primesc un email de la CeFaci când se lansează aplicația. Îmi pot retrage acordul oricând.' else '' end);
 return jsonb_build_object('saved',true,'email_requested',normalized_email is not null);
end $$;

create or replace function public.launch_interest_withdraw(p_receipt uuid,p_nonce text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt bytea:=sha256(convert_to(p_receipt::text,'UTF8')); minute timestamptz:=date_trunc('minute',now());begin
 if p_receipt is null or p_nonce is null or char_length(p_nonce)>12 or p_nonce!~'^[0-9]+$' or left(encode(sha256(convert_to(p_receipt::text||':'||p_nonce,'UTF8')),'hex'),3)<>'000' then raise exception 'Verificarea retragerii a eșuat.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(631042101425::bigint);
 if not exists(select 1 from private.launch_withdrawals where receipt_hash=receipt) and not exists(select 1 from private.launch_interests where receipt_hash=receipt)then
  if not private.launch_ip_ok() then raise exception 'Sunt prea multe trimiteri de pe această rețea. Încearcă mai târziu.' using errcode='P0001'; end if;
  if coalesce((select submissions from private.launch_quotas where bucket=minute),0)>=100 or coalesce((select sum(submissions)from private.launch_quotas where bucket>=now()-interval '1 day'),0)>=5000 then raise exception 'Sunt prea multe trimiteri acum. Încearcă mai târziu.' using errcode='P0001'; end if;
  insert into private.launch_quotas values(minute,1)on conflict(bucket)do update set submissions=private.launch_quotas.submissions+1;
 end if;
 insert into private.launch_withdrawals(receipt_hash)values(receipt)on conflict do nothing;
 delete from private.launch_interests where receipt_hash=receipt;
 return jsonb_build_object('withdrawn',true);
end $$;
