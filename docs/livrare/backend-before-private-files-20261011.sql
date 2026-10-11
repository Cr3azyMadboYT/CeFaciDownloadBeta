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


CREATE OR REPLACE FUNCTION public.business_proof_deleted(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


CREATE OR REPLACE FUNCTION private.business_proof_upload_allowed(p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return private.business_authenticated() and exists(select 1 from private.partner_requests r where r.user_id=auth.uid() and r.status='draft' and r.created_at>now()-interval '1 day'
 and p_path ~ ('^'||r.user_id::text||'/'||r.id::text||'/proof\.(pdf|jpg|png)$'));
end $function$


CREATE OR REPLACE FUNCTION private.business_proof_read_allowed(p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.business_authenticated() and exists(select 1 from private.partner_requests r join private.partner_proof_access a on a.request_id=r.id
 where r.proof_path=p_path and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days'
 and a.user_id=auth.uid() and a.expires_at>now() and (r.user_id=auth.uid() or private.can('partners')))
$function$
