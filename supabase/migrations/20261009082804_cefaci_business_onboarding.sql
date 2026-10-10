-- Business entry and manual verification. A request never creates ownership, a public venue or an active partnership.
-- ANAF/telephone providers and contract activation remain separate, explicitly verified administrative steps.
create table private.partner_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 request_key text not null check(length(request_key) between 1 and 100),
 kind text not null check(kind in('claim','new','dispute')),
 venue_id text references public.venues(id),
 venue_name text not null,
 details jsonb not null,
 status text not null default 'draft' check(status in('draft','pending','verified','rejected','cancelled')),
 proof_path text unique,
 proof_fingerprint text,
 proof_uploaded_at timestamptz,
 proof_deleted_at timestamptz,
 submitted_at timestamptz,
 owner_notice_at timestamptz,
 owner_response_deadline timestamptz,
 owner_response text,
 owner_responded_by uuid references auth.users(id) on delete set null,
 owner_responded_at timestamptz,
 decision_note text,
 decided_by uuid references public.profiles(id) on delete set null,
 decided_at timestamptz,
 firm_verified_by uuid references public.profiles(id) on delete set null,
 firm_verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,request_key),
 check((kind='new') or venue_id is not null)
);
create index partner_requests_own on private.partner_requests(user_id,created_at desc);
create index partner_requests_queue on private.partner_requests(status,submitted_at) where status='pending';
create unique index partner_requests_one_open_venue on private.partner_requests(user_id,venue_id) where status in('draft','pending') and venue_id is not null;
create table private.partner_request_log (
 id bigint generated always as identity primary key,
 request_id uuid not null references private.partner_requests(id) on delete restrict,
 by_user uuid references auth.users(id) on delete set null,
 action text not null,
 data jsonb not null default '{}',
 at timestamptz not null default now()
);
create index partner_request_log_request on private.partner_request_log(request_id,at);
create table private.partner_proof_access (
 request_id uuid not null references private.partner_requests(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 primary key(request_id,user_id)
);
alter table private.partner_requests enable row level security;
alter table private.partner_request_log enable row level security;
alter table private.partner_proof_access enable row level security;
revoke all on private.partner_requests,private.partner_request_log,private.partner_proof_access from public,anon,authenticated;

create function private.business_authenticated() returns boolean
language sql stable set search_path='' as $$
 select auth.uid() is not null and not coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'is_anonymous')::boolean,false)
$$;
revoke all on function private.business_authenticated() from public,anon,authenticated;

create function private.business_cui_valid(p_cui text) returns boolean
language plpgsql immutable set search_path='' as $$
declare n text:=regexp_replace(upper(trim(p_cui)),'^RO','',''); padded text; weights text:='753217532'; total int:=0; i int; control int;
begin
 if n is null or n !~ '^[1-9][0-9]{1,9}$' then return false; end if;
 padded:=lpad(left(n,length(n)-1),9,'0');
 for i in 1..9 loop total:=total+substr(padded,i,1)::int*substr(weights,i,1)::int; end loop;
 control:=(total*10)%11; if control=10 then control:=0; end if;
 return control=right(n,1)::int;
end $$;
revoke all on function private.business_cui_valid(text) from public,anon,authenticated;

create function private.partner_request_public(r private.partner_requests) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',r.id,'kind',r.kind,'venue_id',r.venue_id,'venue_name',r.venue_name,'details',r.details,
 'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,'submitted_at',r.submitted_at,
 'owner_response_deadline',r.owner_response_deadline,'decision_note',r.decision_note,
 'proof_deleted_at',r.proof_deleted_at,'activation_pending',r.status='verified')
$$;
revoke all on function private.partner_request_public(private.partner_requests) from public,anon,authenticated;

create function public.biz_venue_search(p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
end $$;

create function public.biz_partner_request_create(p_key text,p_kind text,p_venue text,p_details jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

-- Immutable proofs: inserts only, into one draft belonging to the authenticated applicant.
create function private.business_proof_upload_allowed(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return private.business_authenticated() and exists(select 1 from private.partner_requests r where r.user_id=auth.uid() and r.status='draft' and r.created_at>now()-interval '1 day'
 and p_path ~ ('^'||r.user_id::text||'/'||r.id::text||'/proof\.(pdf|jpg|png)$'));
end $$;
create function private.business_proof_read_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.business_authenticated() and exists(select 1 from private.partner_requests r join private.partner_proof_access a on a.request_id=r.id
 where r.proof_path=p_path and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days'
 and a.user_id=auth.uid() and a.expires_at>now() and (r.user_id=auth.uid() or private.can('partners')))
$$;
revoke all on function private.business_proof_upload_allowed(text),private.business_proof_read_allowed(text) from public,anon,authenticated;
grant execute on function private.business_proof_upload_allowed(text),private.business_proof_read_allowed(text) to authenticated;
-- Test harnesses without Storage still load every migration; production always has storage.objects.
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  if exists(select 1 from storage.buckets where id='business-proofs' and public) then raise exception 'business-proofs must never be a public bucket'; end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-proofs','business-proofs',false,8388608,array['application/pdf','image/jpeg','image/png']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  execute 'create policy business_proofs_insert on storage.objects for insert to authenticated with check(bucket_id=''business-proofs'' and private.business_proof_upload_allowed(name))';
  execute 'create policy business_proofs_read on storage.objects for select to authenticated using(bucket_id=''business-proofs'' and private.business_proof_read_allowed(name))';
 end if;
end $$;

create function public.biz_partner_request_submit(p_id uuid,p_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

create function public.biz_partner_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 return coalesce((select jsonb_agg(private.partner_request_public(r) order by r.created_at desc) from private.partner_requests r where user_id=auth.uid()),'[]');
end $$;
create function public.biz_partner_request_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

-- Current owners see only the venue, deadline and response. The applicant's identity/company/document remain private.
create function public.biz_ownership_disputes(p_venue text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.business_authenticated() or coalesce(private.member_role(p_venue),'')<>'proprietar' then raise exception 'Doar proprietarul localului.'; end if;
 with noticed as (update private.partner_requests set owner_notice_at=now(),owner_response_deadline=now()+interval '3 days',updated_at=now() where venue_id=p_venue and kind='dispute' and status='pending' and owner_notice_at is null returning id) insert into private.partner_request_log(request_id,by_user,action) select id,auth.uid(),'owner_notice_displayed' from noticed;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'venue_id',venue_id,'venue_name',venue_name,'submitted_at',submitted_at,'deadline',owner_response_deadline,'response',owner_response,'status',status) order by submitted_at desc)
 from private.partner_requests where venue_id=p_venue and kind='dispute' and status='pending'),'[]');
end $$;
create function public.biz_ownership_dispute_reply(p_id uuid,p_reply text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.partner_requests;
begin
 select * into r from private.partner_requests where id=p_id for update;
 if not private.business_authenticated() or r.id is null or r.kind<>'dispute' or coalesce(private.member_role(r.venue_id),'')<>'proprietar' then raise exception 'Doar proprietarul localului.'; end if;
 if r.status<>'pending' or r.owner_response_deadline is null or now()>r.owner_response_deadline then raise exception 'Termenul de răspuns a expirat.'; end if;
 if p_reply is null or length(trim(p_reply)) not between 10 and 2000 then raise exception 'Descrie situația în 10–2000 de caractere.'; end if;
 if r.owner_responded_at is not null then raise exception 'Răspunsul a fost deja trimis.'; end if;
 update private.partner_requests set owner_response=trim(p_reply),owner_responded_by=auth.uid(),owner_responded_at=now(),updated_at=now() where id=r.id;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,auth.uid(),'owner_replied');
end $$;

create function public.admin_partner_requests(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('partners') then raise exception 'Doar echipa CeFaci care verifică partenerii.'; end if;
 if p_status is null or p_status not in('draft','pending','verified','rejected','cancelled') then raise exception 'Stare invalidă.'; end if;
 return coalesce((select jsonb_agg(private.partner_request_public(r)||jsonb_build_object('applicant_id',r.user_id,'owner_response',r.owner_response,'owner_responded_at',r.owner_responded_at,'firm_verified_at',r.firm_verified_at,'proof_available',r.proof_path is not null and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days') order by r.created_at)
 from (select * from private.partner_requests where status=p_status order by created_at limit 100) r),'[]');
end $$;

create function public.biz_partner_proof_access(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.partner_requests;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.partner_requests where id=p_id and(user_id=auth.uid() or private.can('partners'));
 if r.id is null or r.proof_path is null or r.proof_deleted_at is not null or r.proof_uploaded_at<=now()-interval '90 days' then raise exception 'Documentul nu este disponibil.'; end if;
 insert into private.partner_proof_access values(r.id,auth.uid(),now()+interval '5 minutes') on conflict(request_id,user_id) do update set expires_at=excluded.expires_at;
 insert into private.partner_request_log(request_id,by_user,action) values(r.id,auth.uid(),'proof_access_authorized');
 return jsonb_build_object('bucket','business-proofs','path',r.proof_path,'expires_in',300);
end $$;

create function public.admin_partner_request_decide(p_id uuid,p_decision text,p_note text,p_firm_verified boolean default false,p_venue text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

-- Service-only two-phase retention: Storage API remove first, then acknowledge. Never SQL-delete storage.objects.
create function public.business_proofs_retention_candidates() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('request_id',request_id,'path',path)),'[]') from (
 select * from (
  select r.id request_id,o.name path,o.created_at from storage.objects o left join private.partner_requests r on split_part(o.name,'/',2)=r.id::text where o.bucket_id='business-proofs' and o.created_at<=now()-interval '90 days'
  union all
  select r.id,r.proof_path,r.proof_uploaded_at from private.partner_requests r where r.proof_path is not null and r.proof_deleted_at is null and r.proof_uploaded_at<=now()-interval '90 days' and not exists(select 1 from storage.objects o where o.bucket_id='business-proofs' and o.name=r.proof_path)
 ) aged order by created_at limit 100
 ) candidates);
end $$;
create function public.business_proof_deleted(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.partner_requests;
begin
 select * into r from private.partner_requests where id=p_id for update;
 if r.id is null or (r.proof_path is not null and r.proof_uploaded_at>now()-interval '90 days') or (r.proof_path is null and r.created_at>now()-interval '90 days') then raise exception 'Documentul nu a ajuns la termenul de ștergere.'; end if;
 if exists(select 1 from storage.objects where bucket_id='business-proofs' and (name=r.proof_path or (r.proof_path is null and split_part(name,'/',2)=r.id::text))) then raise exception 'Șterge mai întâi fișierul prin API-ul Storage.'; end if;
 if r.proof_deleted_at is null then
  update private.partner_requests set proof_deleted_at=now(),updated_at=now() where id=r.id;
  delete from private.partner_proof_access where request_id=r.id;
  insert into private.partner_request_log(request_id,action) values(r.id,'proof_deleted_after_90_days');
 end if;
end $$;

revoke all on function public.biz_venue_search(text),public.biz_partner_request_create(text,text,text,jsonb),public.biz_partner_request_submit(uuid,text),public.biz_partner_requests(),public.biz_partner_request_cancel(uuid),public.biz_ownership_disputes(text),public.biz_ownership_dispute_reply(uuid,text),public.admin_partner_requests(text),public.biz_partner_proof_access(uuid),public.admin_partner_request_decide(uuid,text,text,boolean,text),public.business_proofs_retention_candidates(),public.business_proof_deleted(uuid) from public,anon,authenticated;
grant execute on function public.biz_venue_search(text),public.biz_partner_request_create(text,text,text,jsonb),public.biz_partner_request_submit(uuid,text),public.biz_partner_requests(),public.biz_partner_request_cancel(uuid),public.biz_ownership_disputes(text),public.biz_ownership_dispute_reply(uuid,text),public.admin_partner_requests(text),public.biz_partner_proof_access(uuid),public.admin_partner_request_decide(uuid,text,text,boolean,text) to authenticated;
grant execute on function public.business_proofs_retention_candidates(),public.business_proof_deleted(uuid) to service_role;

create function public.biz_identity_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into p from public.profiles where id=auth.uid();
 return jsonb_build_object('has_profile',p.id is not null,'username',p.username,'first_name',p.first_name);
end $$;
create function public.biz_identity_complete(p_username text,p_first_name text,p_birth_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.biz_identity_status(),public.biz_identity_complete(text,text,date) from public,anon,authenticated;
grant execute on function public.biz_identity_status(),public.biz_identity_complete(text,text,date) to authenticated;

create function private.partner_request_log_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.by_user is null and old.by_user is not null and to_jsonb(new)-'by_user'=to_jsonb(old)-'by_user' then return new; end if;
 raise exception 'Jurnalul de verificare nu se poate modifica sau șterge.';
end $$;
revoke all on function private.partner_request_log_immutable() from public,anon,authenticated;
create trigger partner_request_log_immutable before update or delete on private.partner_request_log for each row execute function private.partner_request_log_immutable();
