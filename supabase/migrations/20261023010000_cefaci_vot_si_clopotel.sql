-- Votul și clopoțelul (Cornel, 23.10: „am putut crea 2 voturi, am votat amândoi și votul nu s-a terminat; după ce
-- văd notificarea … tot apare cu roșu clopoțelul”).
-- 1. Nu pornești un al doilea vot cu exact aceiași oameni cât timp primul e deschis: serverul spune care e (detail = id).
-- 2. Cine a pornit votul îl poate închide oricând (vote_close_now); câștigă ce are cele mai multe voturi până atunci.
-- 3. O notificare deschisă (din bara telefonului sau intrând pe ecranul ei) se marchează citită (notifications_seen).

do $$declare f record; body text;
begin
 select p.oid, p.prosrc into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'start_vote';
 body := replace(f.prosrc, '  for o in select * from jsonb_array_elements(p_options) loop', '  -- the same people already have an open vote of mine: that one, not a second (23.10)
  select x.id into dup from public.vote_sessions x
   where x.created_by = me and x.id <> s and x.closes_at > now() and x.plan_id is null
     and (select array_agg(user_id order by user_id) from public.vote_voters where session_id = x.id)
       = (select array_agg(user_id order by user_id) from public.vote_voters where session_id = s)
   order by x.created_at desc limit 1;
  if dup is not null then raise exception ''Ai deja un vot deschis cu ei. Termină-l întâi.'' using errcode = ''check_violation'', detail = dup::text; end if;
  for o in select * from jsonb_array_elements(p_options) loop');
 body := replace(body, 'declare me uuid := auth.uid(); s uuid;', 'declare me uuid := auth.uid(); s uuid; dup uuid;');
 if body = f.prosrc or body not like '%dup uuid%' then raise exception 'start_vote: nu am găsit locul pentru verificare'; end if;
 execute replace(pg_get_functiondef(f.oid), f.prosrc, body);
end $$;

/** The one who started the vote ends it now; the place with the most votes so far wins. */
create function public.vote_close_now(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.vote_sessions;
begin
 select * into s from public.vote_sessions where id = p_session for update;
 if s.id is null or s.created_by is distinct from auth.uid() then raise exception 'Doar cine a pornit votul îl poate închide.' using errcode = 'insufficient_privilege'; end if;
 if s.plan_id is not null or s.closes_at <= now() then return; end if;
 if not exists (select 1 from public.ballots where session_id = p_session) then raise exception 'Nimeni n-a votat încă.' using errcode = 'check_violation'; end if;
 update public.vote_sessions set closes_at = now() where id = p_session;
end $$;
revoke all on function public.vote_close_now(uuid) from public, anon, authenticated;
grant execute on function public.vote_close_now(uuid) to authenticated;

/** A notification was opened (its screen): it is read. */
create function public.notifications_seen(p_url text) returns void
language sql security definer set search_path = '' as $$
 update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null and url = p_url
$$;
revoke all on function public.notifications_seen(text) from public, anon, authenticated;
grant execute on function public.notifications_seen(text) to authenticated;
