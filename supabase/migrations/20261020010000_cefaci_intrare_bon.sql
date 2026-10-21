-- Intrarea și bonul (Cornel, 20.10): localul partener dă CeFaci 10% din bonurile fiecărei intrări CeFaci.
-- Intrarea = vizita grupului (public.visits, una pe plan). Bonurile se leagă de intrare: același bon (aceeași firmă,
-- același număr, aceeași zi) se numără o dată oricâți l-ar scana („scanat de 3/5”), notele separate se adună,
-- ospătarul poate pune și el bonul (biletul scanat sau intrarea aleasă din listă), localul poate scrie totalul.
-- Fără bon până a doua zi la 12:00: intrarea rămâne „fără bon” și nu se plătește nimic. Fluxul: docs/flux-intrare-bon.md.
-- Înlocuiește taxele pe om (per-person-v2) pentru vizitele noi; istoricul rămâne cum a fost calculat.

-- Bonurile intrărilor stau într-un tabel nou (mai multe pe intrare: note separate), cu numărul bonului și cine l-a adus.
-- Tabelul vechi public.bills (un bon pe vizită, modelul pe om) rămâne neatins pentru istoric.
-- (Fără ștergeri în migrare: serverul nu acceptă comenzi distructive din afara SQL Editorului.)
create table if not exists public.bills(
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null references public.visits(id),
 venue_id text not null references public.partners(venue_id),
 user_id uuid references public.profiles(id) on delete set null,
 total numeric(10,2) not null check(total>0 and total<100000),
 discount numeric(10,2) check(discount is null or (discount>=0 and discount<100000)),
 issued_at timestamptz not null,
 number text check(number is null or number ~ '^[0-9]{1,10}$'),
 by_role text not null default 'client' check(by_role in('client','staff','local')),
 note text check(note is null or length(note)<=200),
 created_at timestamptz not null default now());
create index if not exists bills_visit on public.bills(visit_id);
alter table public.bills enable row level security;
revoke all on public.bills from public,anon,authenticated;

-- Cine din gașcă a scanat fiecare bon (pentru „scanat de 3/5”) și contestațiile localului („Nu e al lor”).
create table if not exists private.receipt_scanners(receipt_id uuid not null references public.bills(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,at timestamptz not null default now(),primary key(receipt_id,user_id));
create table if not exists private.receipt_disputes(receipt_id uuid primary key references public.bills(id) on delete cascade,reason text not null check(length(reason) between 5 and 300),by_user uuid references public.profiles(id) on delete set null,at timestamptz not null default now(),state text not null default 'pending' check(state in('pending','upheld','dismissed')));
alter table private.receipt_scanners enable row level security;
alter table private.receipt_disputes enable row level security;
revoke all on private.receipt_scanners,private.receipt_disputes from public,anon,authenticated;

create or replace function private.entry_rate() returns numeric language sql immutable set search_path='' as $$ select 0.10::numeric $$;
revoke all on function private.entry_rate() from public,anon,authenticated;

-- Prețul vizitelor noi: 10% din bon (fără trepte). Firma și CUI-ul rămân înghețate pentru verificarea bonului.
create or replace function private.price_visit() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partners; nr int:=0; nd int:=0;
begin
 select * into p from public.partners where venue_id=new.venue_id;
 -- limitele de reducere (câte locuri Drop / câți la rezervare) rămân pentru reducerea de la masă, nu pentru bani
 if new.reservation_id is not null then select people into nr from public.reservations where id=new.reservation_id; end if;
 if new.claim_id is not null then select seats into nd from public.drop_claims where id=new.claim_id; end if;
 insert into private.visit_pricing(visit_id,version,tier,founder,unit_fee,free,eligible_limit,firm,cui,reservation_unit,drop_unit,reservation_limit,drop_limit)
 values(new.id,'bon-10-v3',p.price_tier,p.founder,0,new.work_day<p.free_until,least(10,greatest(coalesce(nr,0),coalesce(nd,0))),p.firm,p.cui,0,0,coalesce(nr,0),coalesce(nd,0));
 return new;
end $$;

-- Un bon contează dacă nu e contestat (sau contestația a fost respinsă).
create or replace function private.receipt_counts(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.receipt_disputes d where d.receipt_id=r and d.state in('pending','upheld'))
$$;
revoke all on function private.receipt_counts(uuid) from public,anon,authenticated;

-- Intrarea, cum o văd clientul și localul (forma Entry din shared/entries.ts).
create or replace function private.entry_json(p_visit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.visits; total numeric; free boolean; n int; rec jsonb;
begin
 select * into v from public.visits where id=p_visit;
 if v.id is null then return null; end if;
 select count(*) into n from public.visits w where w.venue_id=v.venue_id and w.work_day=v.work_day and (w.scanned_at<v.scanned_at or (w.scanned_at=v.scanned_at and w.id<=v.id));
 select coalesce(sum(r.total) filter(where private.receipt_counts(r.id)),0),
  coalesce(jsonb_agg(jsonb_build_object('id',r.id,'total',r.total,'at',r.issued_at,'number',r.number,'by',r.by_role,
   'scanners',(select count(*) from private.receipt_scanners s where s.receipt_id=r.id),'disputed',not private.receipt_counts(r.id)) order by r.issued_at),'[]')
  into total,rec from public.bills r where r.visit_id=v.id;
 select s.free into free from private.visit_pricing s where s.visit_id=v.id;
 return jsonb_build_object('id',v.id,'no',n,'venue_id',v.venue_id,'venue_name',(select coalesce(x.edit->>'name',x.name) from public.venues x where x.id=v.venue_id),
  'name',coalesce((select first_name from public.profiles where id=v.user_id),'Grup'),'people',v.people,'table',v.table_no,'arrived_at',v.scanned_at,'work_day',v.work_day,
  'receipts',rec,'scanned_by',(select count(distinct s.user_id) from private.receipt_scanners s join public.bills r on r.id=s.receipt_id where r.visit_id=v.id),
  'total',round(total,2),'fee',round(total*private.entry_rate(),2),'free',coalesce(free,false),
  'state',case when jsonb_array_length(rec)>0 then 'closed' when now()>((v.work_day+1)+time '12:00') at time zone 'Europe/Bucharest' then 'no_bill' else 'open' end);
end $$;
revoke all on function private.entry_json(uuid) from public,anon,authenticated;

-- Sosirea: codul localului de pe masă; locația e opțională (dacă e trimisă, trebuie să fie la cel mult 250 m).
-- Codul de pe masă e dovada; banii vin oricum doar din bon.
create or replace function public.visit_client_arrive_v2(p_plan uuid,p_token text,p_lat double precision,p_lon double precision) returns public.visits
language plpgsql security definer set search_path='' as $$
declare pos public.venues; venue text; v public.visits;
begin
 perform private.require_v2();
 select venue_id into venue from public.venue_codes where token=trim(p_token);
 if venue is null or venue is distinct from(select venue_id from public.plans where id=p_plan) then raise exception 'Codul nu este al localului din bilet.'; end if;
 select * into pos from public.venues where id=venue;
 if pos.id is null then raise exception 'Codul nu este al localului din bilet.'; end if;
 if (p_lat is null)<>(p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180 or private.km(p_lat,p_lon,pos.lat,pos.lon)>0.250)) then raise exception 'Scanează când ești la local.'; end if;
 v:=private.arrive(p_plan,false,null);
 return v;
end $$;
revoke all on function public.visit_client_arrive_v2(uuid,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.visit_client_arrive_v2(uuid,text,double precision,double precision) to authenticated;

-- Ospătarul scanează biletul grupului: primește și intrarea.
create or replace function public.biz_scan_v2(p_venue text,p_ticket text,p_table text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.group_tickets; v public.visits; name text;
begin
 perform private.require_v2();
 if auth.uid() is null or private.member_role(p_venue) is null then raise exception 'Nu ești în echipa localului.'; end if;
 if p_table is not null and length(trim(p_table))>12 then raise exception 'Masa: cel mult 12 caractere.'; end if;
 select * into t from private.group_tickets where token=trim(p_ticket);
 if t.plan_id is null or t.expires_at<=now() or not exists(select 1 from public.plans where id=t.plan_id and venue_id=p_venue and status='active') then raise exception 'Cod greșit, expirat sau pentru alt local.'; end if;
 v:=private.arrive(t.plan_id,true,nullif(trim(p_table),''));
 select first_name into name from public.profiles where id=v.user_id;
 return jsonb_build_object('visit',v.id,'name',name,'people',v.people,'discount',v.discount_pct,'scope',v.discount_scope,'discount_people',v.discount_people,'plus',v.plus,'table',v.table_no,'word',private.day_word(v.venue_id,v.work_day),'entry',private.entry_json(v.id));
end $$;
revoke all on function public.biz_scan_v2(text,text,text) from public,anon,authenticated;
grant execute on function public.biz_scan_v2(text,text,text) to authenticated;

-- Clientul: intrarea planului lui și masa (opțională).
create or replace function public.visit_entry_v3(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare id uuid;
begin
 if auth.uid() is null or not private.plan_access(p_plan,auth.uid(),false) then raise exception 'Nu participi la plan.'; end if;
 select v.id into id from public.visits v where v.plan_id=p_plan;
 return case when id is null then null else private.entry_json(id) end;
end $$;
revoke all on function public.visit_entry_v3(uuid) from public,anon,authenticated;
grant execute on function public.visit_entry_v3(uuid) to authenticated;

create or replace function public.visit_table_v3(p_visit uuid,p_table text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 perform private.require_v2();
 select * into v from public.visits where id=p_visit for update;
 if v.id is null or auth.uid() is null or not private.plan_access(v.plan_id,auth.uid(),true) then raise exception 'Nu participi la ieșire.'; end if;
 if p_table is not null and (length(trim(p_table))>12 or trim(p_table)!~'^[0-9A-Za-zĂÂÎȘȚăâîșț .\-]+$') then raise exception 'Masa: un număr sau un nume scurt.'; end if;
 if v.work_day<private.work_day(now())-1 then raise exception 'Ieșirea s-a încheiat.'; end if;
 update public.visits set table_no=nullif(trim(p_table),'') where id=v.id;
end $$;
revoke all on function public.visit_table_v3(uuid,text) from public,anon,authenticated;
grant execute on function public.visit_table_v3(uuid,text) to authenticated;

-- Bonul: verificarea dinainte de citire (fără să citim poza dacă omul n-are voie).
create or replace function public.visit_receipt_ready_v2(p_user uuid,p_visit uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 select * into v from public.visits where id=p_visit;
 if v.id is null or not private.plan_access(v.plan_id,p_user,true) or now()>((v.work_day+2)::timestamp at time zone 'Europe/Bucharest') then return jsonb_build_object('ok',false,'error','Vizita nu este disponibilă pentru bon.'); end if;
 if (select count(*) from public.bills where visit_id=p_visit)>=20 then return jsonb_build_object('ok',false,'error','Intrarea are deja prea multe bonuri.'); end if;
 if not public.api_quota(p_user,'bon',1) then return jsonb_build_object('ok',false,'error','Ai trimis destule bonuri azi.'); end if;
 return jsonb_build_object('ok',true,'venue',v.venue_id,'day',(v.scanned_at at time zone 'Europe/Bucharest')::date);
end $$;
revoke all on function public.visit_receipt_ready_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.visit_receipt_ready_v2(uuid,uuid) to service_role;

-- Ospătarul: poate pune bonul intrărilor localului lui până a doua zi la 12:00.
create or replace function public.visit_receipt_staff_ready_v3(p_user uuid,p_visit uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 select * into v from public.visits where id=p_visit;
 if v.id is null or not exists(select 1 from public.partner_members m where m.venue_id=v.venue_id and m.user_id=p_user and m.active) then return jsonb_build_object('ok',false,'error','Intrarea nu e la localul tău.'); end if;
 if now()>((v.work_day+1)+time '12:00') at time zone 'Europe/Bucharest' then return jsonb_build_object('ok',false,'error','Intrarea s-a închis a doua zi la 12:00.'); end if;
 if (select count(*) from public.bills where visit_id=p_visit)>=20 then return jsonb_build_object('ok',false,'error','Intrarea are deja prea multe bonuri.'); end if;
 if not public.api_quota(p_user,'bon_local',1) then return jsonb_build_object('ok',false,'error','Prea multe poze de bon azi. Scrie totalul.'); end if;
 return jsonb_build_object('ok',true,'venue',v.venue_id,'day',(v.scanned_at at time zone 'Europe/Bucharest')::date);
end $$;
revoke all on function public.visit_receipt_staff_ready_v3(uuid,uuid) from public,anon,authenticated;
grant execute on function public.visit_receipt_staff_ready_v3(uuid,uuid) to service_role;

-- Cotele pentru pozele de bon făcute de local (mai multe decât ale unui client; tot cu plafon pe toată aplicația).
create or replace function private.quota(kind text) returns int[]
language sql immutable set search_path = '' as $$
  select case kind
    when 'e-deschis' then array[12, 24, 30]   -- locuri verificate: pe oră de om, pe zi de om, pe zi în toată aplicația
    when 'bon'       then array[2, 3, 30]     -- poze de bon citite (clienți)
    when 'bon_local' then array[30, 100, 300] -- poze de notă făcute de ospătari
    else array[0, 0, 0] end
$$;
revoke all on function private.quota(text) from public;

-- Bonul legat de intrare. Același bon (firmă + număr + zi; fără număr: firmă + dată + oră + total) se numără o dată:
-- încă un om din gașcă îl scanează → doar „scanat de 2/5”. Alt bon (notă separată) se adună.
create or replace function public.visit_receipt_v3(p_user uuid,p_visit uuid,p_cui text,p_total numeric,p_discount numeric,p_date date,p_time time,p_number text,p_staff boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
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
 fp:=case when num is not null then expected_cui||'|nr|'||num||'|'||p_date else expected_cui||'|'||p_date||'|'||to_char(p_time,'HH24:MI')||'|'||round(p_total,2) end;
 select f.visit_id into oldv from private.receipt_fingerprints f where f.fingerprint=fp;
 if oldv is null then
  -- același bon citit fără număr de alt telefon (sau cu număr de unul și fără de altul)
  select r.visit_id,r.id into oldv,rid from public.bills r join private.visit_pricing s on s.visit_id=r.visit_id where s.cui=expected_cui and r.total=p_total and r.issued_at=issued limit 1;
 end if;
 if oldv is not null and oldv<>v.id then raise exception 'Bonul ăsta e deja la altă intrare.'; end if;
 if oldv is not null then
  if rid is null then select r.id into rid from public.bills r where r.visit_id=v.id and r.issued_at=issued and r.total=p_total limit 1; end if;
  if rid is null then select r.id into rid from public.bills r where r.visit_id=v.id and r.number=num limit 1; end if;
  if not p_staff and rid is not null then insert into private.receipt_scanners(receipt_id,user_id) values(rid,p_user) on conflict do nothing; end if;
  return jsonb_build_object('ok',true,'visit',v.id,'duplicate',true,'receipt',rid);
 end if;
 insert into private.receipt_fingerprints(fingerprint,visit_id) values(fp,v.id);
 insert into public.bills(visit_id,venue_id,user_id,total,discount,issued_at,number,by_role)
  values(v.id,v.venue_id,p_user,p_total,p_discount,issued,num,case when p_staff then 'staff' else 'client' end) returning id into rid;
 if not p_staff then insert into private.receipt_scanners(receipt_id,user_id) values(rid,p_user) on conflict do nothing; end if;
 update public.visits set bill=(select sum(total) from public.bills where visit_id=v.id),bill_source='bon',discount_amount=coalesce(p_discount,discount_amount),proof='receipt',outcome='a venit',closed_at=coalesce(closed_at,now()) where id=v.id;
 return jsonb_build_object('ok',true,'visit',v.id,'duplicate',false,'receipt',rid);
end $$;
revoke all on function public.visit_receipt_v3(uuid,uuid,text,numeric,numeric,date,time,text,boolean) from public,anon,authenticated;
grant execute on function public.visit_receipt_v3(uuid,uuid,text,numeric,numeric,date,time,text,boolean) to service_role;

create or replace function public.entry_of_v3(p_visit uuid) returns jsonb language sql stable security definer set search_path='' as $$ select private.entry_json(p_visit) $$;
revoke all on function public.entry_of_v3(uuid) from public,anon,authenticated;
grant execute on function public.entry_of_v3(uuid) to service_role;

-- Business: intrările unei zile de lucru (implicit azi), pentru orice om din echipă.
create or replace function public.biz_entries_v3(p_venue text,p_day date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d date:=coalesce(p_day,private.work_day(now()));
begin
 if auth.uid() is null or private.member_role(p_venue) is null then raise exception 'Nu ești în echipa localului.'; end if;
 if d<private.work_day(now())-400 or d>private.work_day(now())+1 then raise exception 'Zi invalidă.'; end if;
 return jsonb_build_object('day',d,'entries',coalesce((select jsonb_agg(private.entry_json(v.id) order by v.scanned_at,v.id) from public.visits v where v.venue_id=p_venue and v.work_day=d and v.group_visit),'[]'));
end $$;
revoke all on function public.biz_entries_v3(text,date) from public,anon,authenticated;
grant execute on function public.biz_entries_v3(text,date) to authenticated;

-- Localul scrie totalul când poza nu se poate citi (cu motiv), până a doua zi la 12:00.
create or replace function public.biz_entry_total_v3(p_visit uuid,p_total numeric,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.visits; k int;
begin
 perform private.require_v2();
 select * into v from public.visits where id=p_visit for update;
 if v.id is null or coalesce(private.member_role(v.venue_id),'') not in('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
 if now()>((v.work_day+1)+time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Intrarea s-a închis a doua zi la 12:00.'; end if;
 if p_total is null or p_total<=0 or p_total>=100000 then raise exception 'Scrie totalul de pe notă.'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Scrie de ce nu merge poza (cel puțin 3 litere).'; end if;
 select count(*) into k from public.bills where visit_id=v.id;
 if k>=20 then raise exception 'Intrarea are deja prea multe bonuri.'; end if;
 insert into private.receipt_fingerprints(fingerprint,visit_id) values('local|'||v.id||'|'||(k+1),v.id);
 insert into public.bills(visit_id,venue_id,user_id,total,discount,issued_at,by_role,note) values(v.id,v.venue_id,auth.uid(),round(p_total,2),null,now(),'local',left(trim(p_reason),200));
 update public.visits set bill=(select sum(total) from public.bills where visit_id=v.id),bill_source=case when bill_source='bon' then 'bon' else 'local' end,outcome='a venit',closed_by=auth.uid(),closed_at=coalesce(closed_at,now()) where id=v.id;
 return private.entry_json(v.id);
end $$;
revoke all on function public.biz_entry_total_v3(uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.biz_entry_total_v3(uuid,numeric,text) to authenticated;

-- „Nu e al lor”: localul contestă un bon (proprietar/manager), în 35 de zile; nu se plătește până nu verifică CeFaci.
create or replace function public.biz_receipt_dispute_v3(p_receipt uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.bills; v public.visits;
begin
 select * into r from public.bills where id=p_receipt;
 select * into v from public.visits where id=r.visit_id;
 if r.id is null or coalesce(private.member_role(r.venue_id),'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if v.work_day<private.work_day(now())-35 then raise exception 'Bonul e prea vechi pentru contestație.'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Scrie motivul (cel puțin 5 litere).'; end if;
 insert into private.receipt_disputes(receipt_id,reason,by_user) values(r.id,left(trim(p_reason),300),auth.uid()) on conflict(receipt_id) do nothing;
end $$;
revoke all on function public.biz_receipt_dispute_v3(uuid,text) from public,anon,authenticated;
grant execute on function public.biz_receipt_dispute_v3(uuid,text) to authenticated;

-- Banii: 10% din bonurile care contează, pe intrare (toate felurile: plan, Plus, rezervare, Drop).
-- Vizitele vechi (per-person-v2) păstrează calculul de atunci.
create or replace function private.visit_fees(v text,d0 date,d1 date)
returns table(visit_id uuid,work_day date,kind text,bill numeric,bill_source text,fee numeric,free boolean)
language sql stable security definer set search_path='' as $$
 select x.id,x.work_day,x.kind,t.total,x.bill_source,round(t.total*private.entry_rate(),2),s.free
 from public.visits x join private.visit_pricing s on s.visit_id=x.id
 join lateral(select sum(r.total) total from public.bills r where r.visit_id=x.id and private.receipt_counts(r.id)) t on t.total>0
 where x.venue_id=v and x.work_day between d0 and d1 and s.version='bon-10-v3'
 union all
 select x.id,x.work_day,x.kind,x.bill,x.bill_source,
  s.drop_unit*least(10,c.drop_adults,s.drop_limit) + s.reservation_unit*least(greatest(0,10-least(c.drop_adults,s.drop_limit)),greatest(0,c.adults-least(c.drop_adults,s.drop_limit)),s.reservation_limit),s.free
 from public.visits x join private.visit_pricing s on s.visit_id=x.id join private.visit_counts c on c.visit_id=x.id
 where x.venue_id=v and x.work_day between d0 and d1 and s.version='per-person-v2' and x.kind in('rezervare','drop') and s.tier is not null and x.outcome='a venit' and x.closed_at is not null and c.state='confirmed'
 and not exists(select 1 from private.benefit_cases b where b.visit_id=x.id and b.state='pending')
$$;
revoke all on function private.visit_fees(text,date,date) from public,anon,authenticated;

create or replace function public.biz_finance_v2(p_venue text,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare receipts numeric; reductions numeric; commission numeric; missing int; blocked int;
begin
 if coalesce(private.member_role(p_venue),'') not in('proprietar','manager') and not private.can('money') then raise exception 'Nu ai voie.'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Perioadă invalidă.'; end if;
 select coalesce(sum(bill),0) into receipts from private.visit_fees(p_venue,p_from,p_to);
 select coalesce(sum(discount_amount),0) into reductions from public.visits where venue_id=p_venue and work_day between p_from and p_to;
 select coalesce(sum(fee) filter(where not free),0) into commission from private.visit_fees(p_venue,p_from,p_to);
 -- intrări încă fără bon (azi sau ieri până la 12:00) și bonuri contestate în verificare
 select count(*) into missing from public.visits x where x.venue_id=p_venue and x.work_day between p_from and p_to and x.group_visit
  and not exists(select 1 from public.bills r where r.visit_id=x.id) and now()<=((x.work_day+1)+time '12:00') at time zone 'Europe/Bucharest';
 select count(*) into blocked from private.receipt_disputes d join public.bills r on r.id=d.receipt_id join public.visits x on x.id=r.visit_id where x.venue_id=p_venue and x.work_day between p_from and p_to and d.state='pending';
 return jsonb_build_object('billing_ready',false,'estimate',true,'partial',missing>0 or blocked>0,'missing',missing,'blocked',blocked,'revenue',receipts,'discounts',reductions,'fee',commission,
  'remaining',case when missing=0 and blocked=0 then receipts-commission end,
  'would_pay',(select coalesce(sum(fee) filter(where free),0) from private.visit_fees(p_venue,p_from,p_to)),
  'visits',(select count(*) from public.visits where venue_id=p_venue and work_day between p_from and p_to),
  'lines',coalesce((select jsonb_agg(jsonb_build_object('visit',f.visit_id,'no',(private.entry_json(f.visit_id)->>'no')::int,'day',f.work_day,'kind',f.kind,'bill',f.bill,
   'receipts',(select count(*) from public.bills r where r.visit_id=f.visit_id and private.receipt_counts(r.id)),
   'fee',case when f.free then 0 else f.fee end,'would_pay',case when f.free then f.fee else 0 end,'free',f.free,
   'calculation',jsonb_build_object('rate',private.entry_rate(),'total',f.bill)) order by f.work_day) from private.visit_fees(p_venue,p_from,p_to) f),'[]'));
end $$;
revoke all on function public.biz_finance_v2(text,date,date) from public,anon,authenticated;
grant execute on function public.biz_finance_v2(text,date,date) to authenticated;

-- Business 2FA (20261009213831): every biz_* entry point checks the secured Business session and uses
-- secured_member_role, finance uses the financial scope. The functions above are new or rewritten, so they get
-- the same guards here, exactly as the original migration added them (biz_team_set lost them in 20261013010000).
do $$declare f record; body text; guard text; definition text;
begin
 for f in select p.oid,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in('biz_scan_v2','biz_entries_v3','biz_entry_total_v3','biz_receipt_dispute_v3','biz_finance_v2','biz_team_set')
  and p.prosrc not like '%require_secure%'
 loop
  guard:=case when f.proname='biz_finance_v2' then 'private.require_secure_financial_scope()' else 'private.require_secure_scope(''business'')' end;
  body:=replace(f.prosrc,'private.member_role(','private.secured_member_role(');
  body:=regexp_replace(body,'\mbegin\M','begin perform '||guard||';','i');
  definition:=replace(pg_get_functiondef(f.oid),f.prosrc,body);execute definition;
 end loop;
end $$;
