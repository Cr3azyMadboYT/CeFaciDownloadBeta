-- Optional emergency pause, exclusively on CeFaci2.0. Do not run during normal installation.
-- Keeps existing Client/Business operations, requests, documents and the audit trail intact.
begin;
revoke execute on function public.biz_partner_request_create(text,text,text,jsonb),
 public.biz_partner_request_submit(uuid,text), public.admin_partner_request_decide(uuid,text,text,boolean,text)
 from authenticated;
alter policy business_proofs_insert on storage.objects with check (false);
commit;

-- Re-enable only after a verified corrective migration:
-- begin;
-- grant execute on function public.biz_partner_request_create(text,text,text,jsonb),
--  public.biz_partner_request_submit(uuid,text), public.admin_partner_request_decide(uuid,text,text,boolean,text) to authenticated;
-- alter policy business_proofs_insert on storage.objects with check
--  (bucket_id='business-proofs' and private.business_proof_upload_allowed(name));
-- commit;
