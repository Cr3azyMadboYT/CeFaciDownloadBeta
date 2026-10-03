-- ONE-TIME: wipes everything the earlier attempts left in the "CeFaci 2.0" project (tables, functions, cron, triggers),
-- keeping auth users and the Google sign-in settings. Run it once in Supabase → SQL Editor, then apply the migration in
-- supabase/migrations. It does not touch "CeFaci 1.0".
do $$
declare r record;
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'cefaci-client-maintenance';
  drop trigger if exists on_auth_user_created on auth.users;
  drop policy if exists cf_avatar_delete on storage.objects;
  drop policy if exists cf_avatar_insert on storage.objects;
  drop policy if exists cf_avatar_read on storage.objects;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('drop function if exists %s cascade', r.f);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype in ('e', 'd') loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
  drop schema if exists private cascade;
  drop schema if exists cf_private cascade;
  delete from supabase_migrations.schema_migrations;
end $$;
-- the empty avatar bucket "cf-avatars" can be removed from Storage in the dashboard (Supabase blocks deleting it from SQL)
