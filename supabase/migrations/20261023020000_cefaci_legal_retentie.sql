-- Partea legală la zi (23.10, Cornel: „verifică pe partea legală / confidențialitate dacă totul e la zi”).
-- 1. Ștergerea contului nu mai pierde bilete plătite: cu bilete valabile la un eveniment care n-a avut loc sau cu o
--    rambursare în curs, contul nu se șterge din aplicație (politica: „Ce poate rămâne”).
-- 2. Termenele scrise în politică rulează zilnic: notificările 180 de zile, deschiderile linkurilor de bilete 13 luni,
--    contoarele zilnice FreeNow 30 de zile (private.retention_daily, pg_cron „cefaci-retention”).
-- 3. „Datele mele” (privacy_export_my_data) dă și activitatea: prieteni, gășci, planuri, voturi, XP, notificări,
--    FreeNow, bilete, bonuri, semnalări. Formatul rămâne același, ca aplicațiile instalate să-l citească în continuare.

do $$declare f record; body text;
begin
 select p.oid, p.prosrc into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'delete_my_account';
 body := replace(f.prosrc, ' if exists(select 1 from public.staff where user_id=me)', ' -- bilete plătite care încă folosesc la ceva (23.10)
 if exists(select 1 from public.tickets t join public.events e on e.id=t.event_id
   where t.holder=me and t.status=''valid'' and coalesce(e.ends_at,e.starts_at+interval ''6 hours'')>now())
 or exists(select 1 from public.ticket_orders where user_id=me and status=''de_rambursat'') then
  raise exception ''Ai bilete valabile sau o rambursare în curs. Folosește-le, dă-le unui prieten sau așteaptă banii înapoi, apoi șterge contul; contul nu a fost șters.'' using errcode=''check_violation''; end if;
 if exists(select 1 from public.staff where user_id=me)');
 if body = f.prosrc then raise exception 'delete_my_account: nu am găsit locul pentru verificarea biletelor'; end if;
 execute replace(pg_get_functiondef(f.oid), f.prosrc, body);
end $$;

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

create or replace function public.privacy_export_my_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=private.privacy_require_user();begin
 return jsonb_build_object('format','cefaci-personal-core-v1','generated_at',now(),'user_id',me,
 'coverage','Copie a profilului, preferințelor, activității din aplicație (prieteni, gășci, planuri, voturi, XP, notificări, FreeNow, bilete, bonuri, semnalări; cel mult 500 de rânduri pe fiecare) și a celor mai recente 100 de cereri privind datele personale. Nu este răspunsul integral la o cerere de acces sau portabilitate: pentru înregistrările care nu apar aici (de exemplu jurnale tehnice sau date ținute de localuri), trimite o cerere separată.',
 'profile',(select jsonb_build_object('username',p.username,'first_name',p.first_name,'created_at',p.created_at)from public.profiles p where p.id=me),
 'preferences',(select jsonb_build_object('birth_date',p.birth_date,'zone',p.prefs->'zone','likes',p.prefs->'likes','budget',p.prefs->'budget','updated_at',p.updated_at)from public.profile_private p where p.id=me),
 'friends',coalesce((select jsonb_agg(to_jsonb(x)-'requester'-'addressee'||jsonb_build_object('with',p.username,'sent_by_me',x.requester=me)) from (select * from public.friendships where requester=me or addressee=me limit 500)x left join public.profiles p on p.id=case when x.requester=me then x.addressee else x.requester end),'[]'),
 'crews',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.crew_members where user_id=me limit 500)x),'[]'),
 'plans',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.plan_members where user_id=me limit 500)x),'[]'),
 'ballots',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ballots where user_id=me limit 500)x),'[]'),
 'outing_votes',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.outing_votes where user_id=me limit 500)x),'[]'),
 'xp',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.xp_log where user_id=me limit 500)x),'[]'),
 'notifications',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.notifications where user_id=me order by created_at desc limit 500)x),'[]'),
 'free_now',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.free_now where user_id=me limit 500)x),'[]'),
 'ticket_orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.ticket_orders where user_id=me limit 500)x),'[]'),
 'tickets',coalesce((select jsonb_agg(to_jsonb(x)-'used_by') from (select * from public.tickets where holder=me limit 500)x),'[]'),
 'bills',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.bills where user_id=me limit 500)x),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.reports where user_id=me limit 500)x),'[]'),
 'push_devices',coalesce((select jsonb_agg(to_jsonb(x)-'token') from (select * from public.push_tokens where user_id=me limit 50)x),'[]'),
 'requests',public.privacy_my_requests(null,100,0),
 'requests_count',(select count(*)from private.privacy_requests where user_id=me),
 'requests_truncated',(select count(*)>100 from private.privacy_requests where user_id=me));
end $$;
revoke all on function public.privacy_export_my_data() from public,anon;
grant execute on function public.privacy_export_my_data() to authenticated;
