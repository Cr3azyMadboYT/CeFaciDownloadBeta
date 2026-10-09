-- Emergency pause on CeFaci2.0 only. Preserves requests, files, answers and immutable audit.
-- Does not revoke Business operational APIs or Client reservations/visits.
do $$ declare fn record; begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and(p.proname like 'admin\_%' escape '\' or p.proname in('support_report_create','support_report_submit','support_report_cancel'))
 loop execute format('revoke all on function %s from public,anon,authenticated',fn.signature); end loop;
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists support_photos_insert on storage.objects';
  execute 'create policy support_photos_insert on storage.objects for insert to authenticated with check(false)';
 end if;
end $$;
-- Resume only after review: re-grant the explicit function list from the Admin migrations and
-- recreate support_photos_insert WITH CHECK(bucket_id='support-photos' AND private.support_photo_upload_allowed(name)).
-- Never replay table-creating migrations, drop the inbox or restore legacy unaudited staff grants.
