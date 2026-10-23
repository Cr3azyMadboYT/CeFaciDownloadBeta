-- De lipit în Supabase → SQL Editor → Run (23.10). Curățenia zilnică din politica de confidențialitate:
-- notificările 180 de zile, deschiderile linkurilor de bilete 13 luni, contoarele FreeNow 30 de zile.
-- E partea din migrarea 20261023020000_cefaci_legal_retentie.sql pe care nu o pot aplica eu (are delete).

/** The deadlines written in the privacy policy (§8), run once a day. */
create function private.retention_daily() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n1 int; n2 int; n3 int; n4 int;
begin
 delete from public.notifications where created_at < now() - interval '180 days'; get diagnostics n1 = row_count;
 delete from private.event_clicks where day < (now() at time zone 'Europe/Bucharest')::date - 395; get diagnostics n2 = row_count;
 delete from private.free_starts where day < (now() at time zone 'Europe/Bucharest')::date - 30; get diagnostics n3 = row_count;
 delete from private.free_pushes where day < (now() at time zone 'Europe/Bucharest')::date - 30; get diagnostics n4 = row_count;
 return jsonb_build_object('notifications', n1, 'event_clicks', n2, 'free_starts', n3, 'free_pushes', n4, 'at', now());
end $$;
revoke all on function private.retention_daily() from public, anon, authenticated;

do $job$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $sql$select cron.schedule('cefaci-retention','40 3 * * *','select private.retention_daily()')$sql$;
 end if;
end $job$;
