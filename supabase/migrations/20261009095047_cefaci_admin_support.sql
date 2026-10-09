-- Private support inbox, shared by Client and Business, and an authenticated staff web API.
-- Reports never publish a venue or change ownership. Existing public.reports stays compatible.
create or replace function private.can(perm text) returns boolean
language sql stable security definer set search_path='' as $$
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
$$;

create table private.support_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 request_key text not null check(length(request_key) between 1 and 100),
 kind text not null check(kind in('issue','missing_place')),
 source text not null check(source in('client','business')),
 title text not null check(length(title) between 3 and 120),
 description text not null check(length(description) between 2 and 4000),
 venue_id text references public.venues(id),
 status text not null default 'draft' check(status in('draft','new','in_progress','resolved','rejected','cancelled')),
 version integer not null default 1,
 photo_mime text check(photo_mime in('image/jpeg','image/png')),
 photo_path text unique,
 photo_fingerprint text,
 photo_uploaded_at timestamptz,
 photo_deleted_at timestamptz,
 answer text check(length(answer)<=2000),
 handled_by uuid references auth.users(id) on delete set null,
 submitted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index support_reports_own on private.support_reports(user_id,created_at desc);
create index support_reports_queue on private.support_reports(status,created_at,id) where status not in('draft','cancelled');
create index support_reports_venue on private.support_reports(venue_id) where venue_id is not null;
create index support_reports_handler on private.support_reports(handled_by) where handled_by is not null;
create table private.support_report_log (
 id bigint generated always as identity primary key,
 report_id uuid not null references private.support_reports(id),
 by_user uuid references auth.users(id) on delete set null,
 action text not null,
 data jsonb not null default '{}',
 at timestamptz not null default now()
);
create index support_report_log_report on private.support_report_log(report_id,at);
create index support_report_log_user on private.support_report_log(by_user) where by_user is not null;
create trigger support_report_log_immutable before update or delete on private.support_report_log for each row execute function private.partner_request_log_immutable();
create table private.support_photo_access (
 report_id uuid not null references private.support_reports(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 primary key(report_id,user_id)
);
create index support_photo_access_user on private.support_photo_access(user_id);
alter table private.support_reports enable row level security;
alter table private.support_report_log enable row level security;
alter table private.support_photo_access enable row level security;
revoke all on private.support_reports,private.support_report_log,private.support_photo_access from public,anon,authenticated;

create function private.support_report_public(r private.support_reports) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('origin','support','id',r.id,'kind',r.kind,'source',r.source,'title',r.title,
 'description',r.description,'venue_id',r.venue_id,'status',r.status,'version',r.version,'answer',r.answer,
 'created_at',r.created_at,'updated_at',r.updated_at,'submitted_at',r.submitted_at,
 'photo_path',case when r.status='draft' then r.photo_path end,
 'photo_available',r.photo_uploaded_at is not null and r.photo_deleted_at is null and r.photo_uploaded_at>now()-interval '90 days')
$$;
revoke all on function private.support_report_public(private.support_reports) from public,anon,authenticated;

create function public.support_report_create(p_key text,p_kind text,p_source text,p_title text,p_description text,p_venue text default null,p_photo_mime text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

create function private.support_photo_upload_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.business_authenticated() and exists(select 1 from private.support_reports r where r.user_id=auth.uid() and r.photo_path=p_path and r.status='draft' and r.created_at>now()-interval '1 day')
$$;
create function private.support_photo_read_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.business_authenticated() and exists(select 1 from private.support_reports r join private.support_photo_access a on a.report_id=r.id
 where r.photo_path=p_path and r.photo_deleted_at is null and coalesce(r.photo_uploaded_at,r.created_at)>now()-interval '90 days'
 and a.user_id=auth.uid() and a.expires_at>now() and (r.user_id=auth.uid() or (r.status not in('draft','cancelled') and private.can('reports.read'))))
$$;
revoke all on function private.support_photo_upload_allowed(text),private.support_photo_read_allowed(text) from public,anon,authenticated;
grant execute on function private.support_photo_upload_allowed(text),private.support_photo_read_allowed(text) to authenticated;
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  if exists(select 1 from storage.buckets where id='support-photos' and public) then raise exception 'support-photos must never be public'; end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('support-photos','support-photos',false,5242880,array['image/jpeg','image/png']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  execute 'create policy support_photos_insert on storage.objects for insert to authenticated with check(bucket_id=''support-photos'' and private.support_photo_upload_allowed(name))';
  execute 'create policy support_photos_read on storage.objects for select to authenticated using(bucket_id=''support-photos'' and private.support_photo_read_allowed(name))';
 end if;
end $$;

create function public.support_report_submit(p_id uuid,p_path text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.support_reports; meta jsonb;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.support_reports where id=p_id and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Raportarea nu este disponibilă.'; end if;
 if r.status not in('draft','cancelled') and r.photo_path is not distinct from p_path then return private.support_report_public(r); end if;
 if r.status<>'draft' or r.created_at<=now()-interval '1 day' then raise exception 'Raportarea nu mai poate fi trimisă. Deschide una nouă.'; end if;
 if r.photo_path is distinct from p_path then raise exception 'Poza nu aparține acestei raportări.'; end if;
 if p_path is not null then
  if to_regclass('storage.objects') is null then raise exception 'Încărcarea pozelor nu este configurată.'; end if;
  select metadata into meta from storage.objects where bucket_id='support-photos' and name=p_path;
  if meta is null then raise exception 'Încarcă poza înainte de a trimite raportarea.'; end if;
  if meta->>'mimetype' is distinct from r.photo_mime or coalesce(meta->>'size','') !~ '^[0-9]{1,10}$' or coalesce((meta->>'size')::bigint,0) not between 1 and 5242880 then raise exception 'Poza trebuie să fie JPEG sau PNG, cel mult 5 MB.'; end if;
 end if;
 update private.support_reports set status='new',version=version+1,photo_fingerprint=meta->>'eTag',photo_uploaded_at=case when p_path is not null then now() end,submitted_at=now(),updated_at=now() where id=r.id returning * into r;
 insert into private.support_report_log(report_id,by_user,action) values(r.id,auth.uid(),'submitted');
 return private.support_report_public(r);
end $$;

create function public.support_reports() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 return coalesce((select jsonb_agg(item order by created_at desc,id) from(
 select item,created_at,id from(
 select private.support_report_public(r) item,r.created_at,r.id from private.support_reports r where user_id=auth.uid() and status<>'cancelled'
 union all select private.legacy_report_public(r),r.created_at,r.id from public.reports r where user_id=auth.uid()
 )q order by created_at desc,id limit 100
 )list),'[]');
end $$;
create function public.support_report_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.support_reports;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.support_reports where id=p_id and user_id=auth.uid() for update;
 if r.id is null then raise exception 'Raportarea nu este disponibilă.'; end if;
 if r.status='cancelled' then return private.support_report_public(r); end if;
 if r.status<>'draft' then raise exception 'Raportarea a fost trimisă deja.'; end if;
 update private.support_reports set status='cancelled',version=version+1,updated_at=now() where id=r.id returning * into r;
 insert into private.support_report_log(report_id,by_user,action) values(r.id,auth.uid(),'cancelled');
 return private.support_report_public(r);
end $$;

create function public.support_report_photo_access(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.support_reports;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.support_reports where id=p_id and(user_id=auth.uid() or (status not in('draft','cancelled') and private.can('reports.read')));
 if r.id is null or r.photo_path is null or r.photo_deleted_at is not null or coalesce(r.photo_uploaded_at,r.created_at)<=now()-interval '90 days' then raise exception 'Poza nu este disponibilă.'; end if;
 if to_regclass('storage.objects') is null or not exists(select 1 from storage.objects where bucket_id='support-photos' and name=r.photo_path) then raise exception 'Poza nu este disponibilă.'; end if;
 insert into private.support_photo_access values(r.id,auth.uid(),now()+interval '5 minutes') on conflict(report_id,user_id) do update set expires_at=excluded.expires_at;
 insert into private.support_report_log(report_id,by_user,action) values(r.id,auth.uid(),'photo_access_authorized');
 return jsonb_build_object('bucket','support-photos','path',r.photo_path,'expires_in',300);
end $$;

-- Legacy reports retain their existing insert-only API and statuses. Revision protects staff edits.
alter table public.reports add column revision integer not null default 1;
create index reports_queue on public.reports(status,created_at,id);
create index reports_user on public.reports(user_id);
create index reports_handler on public.reports(handled_by) where handled_by is not null;
create table private.legacy_report_log (
 id bigint generated always as identity primary key,
 report_id uuid not null,
 by_user uuid references auth.users(id) on delete set null,
 action text not null,
 data jsonb not null default '{}',
 at timestamptz not null default now()
);
create index legacy_report_log_report on private.legacy_report_log(report_id,at);
create index legacy_report_log_user on private.legacy_report_log(by_user) where by_user is not null;
alter table private.legacy_report_log enable row level security;
revoke all on private.legacy_report_log from public,anon,authenticated;
create trigger legacy_report_log_immutable before update or delete on private.legacy_report_log for each row execute function private.partner_request_log_immutable();

create function private.legacy_report_public(r public.reports) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('origin','legacy','id',r.id,'kind',case when r.venue_id='nou' then 'missing_place' else 'venue_report' end,
 'source','client','title',case when r.venue_id='nou' then 'Lipsește un loc' else 'Semnalare: '||r.kind end,'description',coalesce(r.note,''),
 'venue_id',case when r.venue_id<>'nou' then r.venue_id end,'status',case r.status when 'nou' then 'new' when 'rezolvat' then 'resolved' else 'rejected' end,
 'version',r.revision,'answer',r.answer,'created_at',r.created_at,'updated_at',coalesce(r.handled_at,r.created_at),'photo_available',false)
$$;
revoke all on function private.legacy_report_public(public.reports) from public,anon,authenticated;

create function public.admin_me() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare role text:=private.staff_role(auth.uid()); perms jsonb;
begin
 if not private.business_authenticated() or role is null then raise exception 'Accesul în Admin este rezervat echipei CeFaci.' using errcode='42501'; end if;
 select jsonb_agg(p) into perms from unnest(array['staff.read','places.edit','places.hide','reports.read','reports.close','support.manage','staff.manage','partners','partners.read','founder','money','operations.read','operations.decide','money.read','users.read','plus.manage','suggestions.read','audit.read'])p where private.can(p);
 return jsonb_build_object('user_id',auth.uid(),'username',(select username from public.profiles where id=auth.uid()),'role',role,'permissions',coalesce(perms,'[]'));
end $$;

create function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.admin_me();
 return jsonb_build_object('support_new',case when private.can('reports.read') then(select count(*) from private.support_reports where status='new' and kind='issue')end,
 'support_in_progress',case when private.can('reports.read') then(select count(*) from private.support_reports where status='in_progress')end,
 'missing_place_new',case when private.can('reports.read') then(select count(*) from private.support_reports where status='new' and kind='missing_place')end,
 'legacy_new',case when private.can('reports.read') then(select count(*) from public.reports where status='nou')end,
 'partner_pending',case when private.can('partners') then(select count(*) from private.partner_requests where status='pending')end,
 'places',(select count(*) from public.venues),'partners',case when private.can('partners.read') then(select count(*) from public.partners)end);
end $$;

create function public.admin_support_reports(p_status text default 'new',p_kind text default null,p_source text default null,p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
end $$;

create function public.admin_support_report_update(p_id uuid,p_status text,p_answer text,p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

create function public.admin_legacy_report_update(p_id uuid,p_status text,p_answer text,p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
-- Compatibility callers use the same audited update, rather than bypassing revisions.
create or replace function public.admin_report_close(p_id uuid,p_status text,p_answer text default null) returns void
language plpgsql security definer set search_path='' as $$
declare rev integer;
begin
 if not private.can('reports.close') then raise exception 'Nu ai voie să închizi semnalări.'; end if;
 if p_status is null or p_status not in('rezolvat','respins') then raise exception 'Stare necunoscută.'; end if;
 select revision into rev from public.reports where id=p_id for update;
 if rev is null then raise exception 'Semnalarea nu este disponibilă.'; end if;
 perform public.admin_legacy_report_update(p_id,case when p_status='rezolvat' then 'resolved' else 'rejected' end,coalesce(nullif(trim(p_answer),''),'Verificată de echipa CeFaci.'),rev);
end $$;

create or replace function public.admin_partner_requests(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.business_authenticated() or not private.can('partners') then raise exception 'Doar echipa CeFaci care verifică partenerii.'; end if;
 if p_status is null or p_status not in('draft','pending','verified','rejected','cancelled') then raise exception 'Stare invalidă.'; end if;
 return coalesce((select jsonb_agg(private.partner_request_public(r)||jsonb_build_object('applicant_id',r.user_id,'applicant_username',(select username from public.profiles where id=r.user_id),
 'owner_username',(select p.username from public.partner_members m join public.profiles p on p.id=m.user_id where m.venue_id=r.venue_id and m.active and m.role='proprietar' order by m.user_id limit 1),
 'owner_response',r.owner_response,'owner_responded_at',r.owner_responded_at,'owner_notice_at',r.owner_notice_at,'firm_verified_at',r.firm_verified_at,
 'proof_available',r.proof_path is not null and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days') order by r.created_at)
 from(select * from private.partner_requests where status=p_status order by created_at limit 100)r),'[]');
end $$;

create function public.admin_places(p_query text default '',p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare term text:=trim(coalesce(p_query,''));
begin
 perform public.admin_me();
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 10000 or length(term)>100 then raise exception 'Filtre invalide.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(v) order by v.name,v.id) from(select * from public.venues where term='' or strpos(lower(coalesce(edit->>'name',name)),lower(term))>0 or id=term order by name,id limit p_limit offset p_offset)v),'[]');
end $$;
create function public.admin_place_log(p_venue text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.business_authenticated() or not(private.can('places.edit') or private.can('places.hide') or private.can('partners')) then raise exception 'Nu ai voie să citești jurnalul locului.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(l) order by at desc,id desc) from(select * from public.venue_log where venue_id=p_venue
 and((action='partener' and private.can('partners')) or(action<>'partener' and(private.can('places.edit') or private.can('places.hide')))) order by at desc,id desc limit 100)l),'[]');
end $$;

-- Service-only two-phase retention: remove the binary using Storage API, then acknowledge here.
create function public.support_photos_retention_candidates() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return coalesce((select jsonb_agg(jsonb_build_object('report_id',r.id,'path',r.photo_path)) from private.support_reports r
 left join storage.objects o on o.bucket_id='support-photos' and o.name=r.photo_path
 where r.photo_path is not null and r.photo_deleted_at is null and coalesce(r.photo_uploaded_at,r.created_at)<=now()-interval '90 days'
 and(o.id is null or o.created_at<=now()-interval '90 days')),'[]');
end $$;
create function public.support_photo_deleted(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.support_reports;
begin
 select * into r from private.support_reports where id=p_id for update;
 if r.id is null or coalesce(r.photo_uploaded_at,r.created_at)>now()-interval '90 days' then raise exception 'Poza nu este eligibilă pentru ștergere.'; end if;
 if exists(select 1 from storage.objects where bucket_id='support-photos' and name=r.photo_path) then raise exception 'Șterge fișierul folosind API-ul Storage înainte de confirmare.'; end if;
 if r.photo_deleted_at is null then
  update private.support_reports set photo_deleted_at=now() where id=r.id;
  insert into private.support_report_log(report_id,action) values(r.id,'photo_deleted_after_90_days');
 end if;
end $$;

revoke all on function public.support_report_create(text,text,text,text,text,text,text),public.support_report_submit(uuid,text),public.support_reports(),public.support_report_cancel(uuid),public.support_report_photo_access(uuid),
 public.admin_me(),public.admin_dashboard(),public.admin_support_reports(text,text,text,integer,integer),public.admin_support_report_update(uuid,text,text,integer),public.admin_legacy_report_update(uuid,text,text,integer),public.admin_places(text,integer,integer),public.admin_place_log(text) from public,anon,authenticated;
grant execute on function public.support_report_create(text,text,text,text,text,text,text),public.support_report_submit(uuid,text),public.support_reports(),public.support_report_cancel(uuid),public.support_report_photo_access(uuid),
 public.admin_me(),public.admin_dashboard(),public.admin_support_reports(text,text,text,integer,integer),public.admin_support_report_update(uuid,text,text,integer),public.admin_legacy_report_update(uuid,text,text,integer),public.admin_places(text,integer,integer),public.admin_place_log(text) to authenticated;
revoke all on function public.support_photos_retention_candidates(),public.support_photo_deleted(uuid) from public,anon,authenticated;
grant execute on function public.support_photos_retention_candidates(),public.support_photo_deleted(uuid) to service_role;

-- Staff mutation is reachable only through this optimistic, audited wrapper.
create table private.admin_staff_log (
 id bigint generated always as identity primary key,
 target_user uuid references auth.users(id) on delete set null,
 by_user uuid references auth.users(id) on delete set null,
 previous_role text,
 next_role text,
 note text not null,
 at timestamptz not null default now()
);
create index admin_staff_log_target on private.admin_staff_log(target_user) where target_user is not null;
create index admin_staff_log_actor on private.admin_staff_log(by_user) where by_user is not null;
alter table private.admin_staff_log enable row level security;
revoke all on private.admin_staff_log from public,anon,authenticated;
create function private.admin_staff_log_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 and to_jsonb(new)-array['by_user','target_user']=to_jsonb(old)-array['by_user','target_user']
 and(new.by_user is not distinct from old.by_user or(new.by_user is null and old.by_user is not null))
 and(new.target_user is not distinct from old.target_user or(new.target_user is null and old.target_user is not null)) then return new; end if;
 raise exception 'Jurnalul echipei nu se poate modifica sau șterge.';
end $$;
revoke all on function private.admin_staff_log_immutable() from public,anon,authenticated;
create trigger admin_staff_log_immutable before update or delete on private.admin_staff_log for each row execute function private.admin_staff_log_immutable();

create function public.admin_staff_list() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.business_authenticated() or not private.can('staff.read') then raise exception 'Nu ai voie să citești echipa.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',s.user_id,'username',p.username,'role',s.role,'added_by',s.added_by,'created_at',s.created_at) order by s.created_at,s.user_id)
 from public.staff s join public.profiles p on p.id=s.user_id),'[]');
end $$;
create function public.admin_staff_search(p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare term text:=lower(trim(both '@ ' from p_query));
begin
 if not private.business_authenticated() or not private.can('staff.manage') then raise exception 'Nu ai voie să cauți membri pentru echipă.' using errcode='42501'; end if;
 if term is null or length(term) not between 3 and 30 then raise exception 'Scrie @username-ul complet (3–30 caractere).'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',id,'username',username)) from public.profiles where username=term),'[]');
end $$;
create function public.admin_staff_change(p_user uuid,p_role text,p_note text,p_expected_role text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;
-- The old functions remain implementation helpers; no public API may bypass the audit wrapper.
revoke all on function public.staff_set(uuid,text),public.staff_remove(uuid) from public,anon,authenticated;

create function public.admin_activity(p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
end $$;
revoke all on function public.admin_staff_list(),public.admin_staff_search(text),public.admin_staff_change(uuid,text,text,text),public.admin_activity(integer,integer) from public,anon,authenticated;
grant execute on function public.admin_staff_list(),public.admin_staff_search(text),public.admin_staff_change(uuid,text,text,text),public.admin_activity(integer,integer) to authenticated;

-- The direct REST table route must obey the same action permissions as the RPC.
drop policy if exists venue_log_read on public.venue_log;
create policy venue_log_read on public.venue_log for select to authenticated using(
 (action='partener' and private.can('partners')) or
 (action<>'partener' and(private.can('places.edit') or private.can('places.hide')))
);

-- Preserve the legacy Client insert API, while setting all lifecycle fields on the server.
-- Both APIs share the lock and daily quota so changing endpoint cannot bypass rate limits.
create or replace function private.report_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
 if me is not null then
  if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.support.'||me::text));
  new.user_id:=me;new.status:='nou';new.handled_by:=null;new.handled_at:=null;new.answer:=null;new.created_at:=now();new.revision:=1;
  if ((select count(*) from public.reports where user_id=me and created_at>now()-interval '1 day')+(select count(*) from private.support_reports where user_id=me and created_at>now()-interval '1 day'))>=20 then
   raise exception 'Ai trimis destule semnalări azi. Mulțumim! Mâine mai poți.' using errcode='check_violation';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.report_guard() from public,anon,authenticated;

-- FK deletion may anonymize an actor; a manual UPDATE may never rewrite journal attribution.
create or replace function private.partner_request_log_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 and new.by_user is null and old.by_user is not null and to_jsonb(new)-'by_user'=to_jsonb(old)-'by_user' then return new; end if;
 raise exception 'Jurnalul de verificare nu se poate modifica sau șterge.';
end $$;
