-- Additive manifest. Existing single-proof requests and older applications keep working.
alter table private.partner_requests add column proof_files jsonb not null default '[]'
 check(jsonb_typeof(proof_files)='array' and jsonb_array_length(proof_files)<=5);

create function public.biz_partner_request_files(p_id uuid,p_files jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.partner_requests; f jsonb; files jsonb:='[]'; i int:=0; mime text; ext text; fname text; size bigint; total bigint:=0;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 perform private.require_v2();
 select * into r from private.partner_requests where id=p_id and user_id=auth.uid() for update;
 if r.id is null or r.status<>'draft' or r.created_at<=now()-interval '1 day' then raise exception 'Ciorna nu mai poate primi fișiere.'; end if;
 if p_files is null or jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 5 then raise exception 'Atașează între 1 și 5 fișiere.'; end if;
 for f in select value from jsonb_array_elements(p_files) loop
  i:=i+1;
  if jsonb_typeof(f)<>'object' or (select count(*) from jsonb_object_keys(f))<>3 or not(f ?& array['name','content_type','size']) then raise exception 'Fișier invalid.'; end if;
  fname:=trim(f->>'name'); mime:=f->>'content_type';
  if jsonb_typeof(f->'name')<>'string' or coalesce(length(fname),0) not between 1 and 150 or fname ~ '[[:cntrl:]]' then raise exception 'Numele fișierului nu este valid.'; end if;
  ext:=case mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' end;
  if ext is null or jsonb_typeof(f->'size')<>'number' or coalesce(f->>'size','') !~ '^[0-9]{1,8}$' then raise exception 'Alege PDF, JPEG sau PNG, cel mult 8 MB per fișier.'; end if;
  size:=(f->>'size')::bigint;total:=total+size;
  if size not between 1 and 8388608 or total>20971520 then raise exception 'Maximum 8 MB per fișier și 20 MB în total.'; end if;
  files:=files||jsonb_build_array(jsonb_build_object('index',i,'name',fname,'content_type',mime,'size',size,
   'path',r.user_id::text||'/'||r.id::text||'/proof'||case when i=1 then '' else '-'||i::text end||'.'||ext));
 end loop;
 if jsonb_array_length(r.proof_files)>0 and r.proof_files<>files then raise exception 'Fișierele sunt păstrate pentru reîncercare. Renunță la ciornă pentru alte fișiere.'; end if;
 update private.partner_requests set proof_files=files,updated_at=now() where id=r.id;
 return files;
end $$;

create or replace function private.business_proof_upload_allowed(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return private.business_authenticated() and exists(select 1 from private.partner_requests r
 where r.user_id=auth.uid() and r.status='draft' and r.created_at>now()-interval '1 day'
 and ((jsonb_array_length(r.proof_files)=0 and p_path ~ ('^'||r.user_id::text||'/'||r.id::text||'/proof[.](pdf|jpg|png)$'))
 or exists(select 1 from jsonb_array_elements(r.proof_files) f where f->>'path'=p_path)));
end $$;

create or replace function private.business_proof_read_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.business_authenticated() and exists(select 1 from private.partner_requests r join private.partner_proof_access a on a.request_id=r.id
 where (r.proof_path=p_path or exists(select 1 from jsonb_array_elements(r.proof_files) f where f->>'path'=p_path))
 and r.proof_path is not null and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days'
 and a.user_id=auth.uid() and a.expires_at>now() and (r.user_id=auth.uid() or private.can('partners')))
$$;

create function private.require_partner_files(r private.partner_requests,p_path text) returns void
language plpgsql set search_path='' as $$
declare f jsonb; m jsonb;
begin
 if jsonb_array_length(r.proof_files)=0 then return; end if;
 if r.proof_files->0->>'path' is distinct from p_path then raise exception 'Documentul principal nu corespunde dosarului.'; end if;
 for f in select value from jsonb_array_elements(r.proof_files) loop
  select metadata into m from storage.objects where bucket_id='business-proofs' and name=f->>'path';
  if m is null then raise exception 'Încarcă toate fișierele înainte de a trimite dosarul.'; end if;
  if m->>'mimetype' is distinct from f->>'content_type' or m->>'size' is distinct from f->>'size' then raise exception 'Conținutul încărcat nu corespunde fișierului declarat.'; end if;
 end loop;
end $$;
revoke all on function private.require_partner_files(private.partner_requests,text) from public,anon,authenticated;

-- Preserve the complete existing submit implementation and all security guards.
do $$ declare src text; needle text:='if r.status=''pending'' and r.proof_path=p_path then'; begin
 select pg_get_functiondef('public.biz_partner_request_submit(uuid,text)'::regprocedure) into src;
 if position(needle in src)=0 then raise exception 'Unexpected submit definition; migration aborted.'; end if;
 src:=replace(src,needle,'perform private.require_partner_files(r,p_path); '||needle);
 execute src;
end $$;

create function public.biz_partner_proof_files(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r private.partner_requests;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.partner_requests where id=p_id and(user_id=auth.uid() or private.can('partners'));
 if r.id is null or r.proof_path is null or r.proof_deleted_at is not null or r.proof_uploaded_at<=now()-interval '90 days' then raise exception 'Documentele nu sunt disponibile.'; end if;
 if jsonb_array_length(r.proof_files)=0 then return jsonb_build_array(jsonb_build_object('index',1,'name','Document justificativ','content_type',case substring(r.proof_path from '[.]([a-z]+)$') when 'pdf' then 'application/pdf' when 'png' then 'image/png' else 'image/jpeg' end)); end if;
 return (select jsonb_agg(f-'path' order by (f->>'index')::int) from jsonb_array_elements(r.proof_files) f);
end $$;

create function public.biz_partner_proof_file_access(p_id uuid,p_index int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.partner_requests; path text;
begin
 if not private.business_authenticated() then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 select * into r from private.partner_requests where id=p_id and(user_id=auth.uid() or private.can('partners'));
 if r.id is null or r.proof_path is null or r.proof_deleted_at is not null or r.proof_uploaded_at<=now()-interval '90 days' then raise exception 'Documentul nu este disponibil.'; end if;
 if p_index is null or p_index<1 or p_index>greatest(1,jsonb_array_length(r.proof_files)) then raise exception 'Fișierul nu este disponibil.'; end if;
 path:=case when jsonb_array_length(r.proof_files)=0 then r.proof_path else r.proof_files->(p_index-1)->>'path' end;
 if not exists(select 1 from storage.objects where bucket_id='business-proofs' and name=path) then raise exception 'Fișierul nu mai este disponibil.'; end if;
 insert into private.partner_proof_access values(r.id,auth.uid(),now()+interval '5 minutes') on conflict(request_id,user_id) do update set expires_at=excluded.expires_at;
 insert into private.partner_request_log(request_id,by_user,action,data) values(r.id,auth.uid(),'proof_access_authorized',jsonb_build_object('index',p_index,'path',path));
 return jsonb_build_object('bucket','business-proofs','path',path,'expires_in',300);
end $$;

-- Old files are physically deleted via the existing Storage worker, then acknowledged.
create or replace function public.business_proof_deleted(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r private.partner_requests;
begin
 select * into r from private.partner_requests where id=p_id for update;
 if r.id is null or (r.proof_path is not null and r.proof_uploaded_at>now()-interval '90 days') or (r.proof_path is null and r.created_at>now()-interval '90 days') then raise exception 'Documentul nu a ajuns la termenul de ștergere.'; end if;
 if exists(select 1 from storage.objects where bucket_id='business-proofs' and split_part(name,'/',2)=r.id::text) then raise exception 'Șterge mai întâi toate fișierele prin API-ul Storage.'; end if;
 if r.proof_deleted_at is null then
  update private.partner_requests set proof_deleted_at=now(),updated_at=now() where id=r.id;
  delete from private.partner_proof_access where request_id=r.id;
  insert into private.partner_request_log(request_id,action) values(r.id,'proof_deleted_after_90_days');
 end if;
end $$;

revoke all on function public.biz_partner_request_files(uuid,jsonb),public.biz_partner_proof_files(uuid),public.biz_partner_proof_file_access(uuid,int) from public,anon,authenticated;
grant execute on function public.biz_partner_request_files(uuid,jsonb),public.biz_partner_proof_files(uuid),public.biz_partner_proof_file_access(uuid,int) to authenticated;
