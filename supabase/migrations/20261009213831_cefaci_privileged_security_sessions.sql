-- Privileged capabilities are tied to a live Auth session and verified TOTP, never user metadata.
create table private.security_sessions(
 session_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null check(scope in('admin','business')), opened_at timestamptz not null,
 touched_at timestamptz not null, absolute_expires_at timestamptz not null,
 proof_at bigint not null, factor_id uuid not null, proof_cutoff bigint not null default 0, closed_at timestamptz,
 primary key(session_id,scope)
);
create index security_sessions_user on private.security_sessions(user_id);
alter table private.security_sessions enable row level security;
revoke all on private.security_sessions from public,anon,authenticated;

create function private.live_auth_session() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare j jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'); sid uuid;
begin
 if auth.uid() is null or j->>'sub' is distinct from auth.uid()::text or coalesce((j->>'is_anonymous')::boolean,false) then return null; end if;
 begin sid:=(j->>'session_id')::uuid; exception when invalid_text_representation then return null; end;
 if sid is null then return null; end if;
 if not exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and s.id=sid and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and (u.banned_until is null or u.banned_until<=now()) and(s.not_after is null or s.not_after>now())) then return null; end if;
 return sid;
end $$;
create or replace function private.business_authenticated() returns boolean
language sql stable security definer set search_path='' as $$select private.live_auth_session() is not null$$;

create function private.security_scope_eligible(p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_scope when 'admin' then private.staff_role(auth.uid()) is not null
 when 'business' then exists(select 1 from public.partner_members where user_id=auth.uid() and active)
 else false end
$$;
create function private.totp_proof() returns bigint
language plpgsql stable security definer set search_path='' as $$
declare j jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'); sid uuid:=private.live_auth_session(); proof bigint;
begin
 if sid is null or j->>'aal' is distinct from 'aal2' then return null; end if;
 if not exists(select 1 from auth.sessions s join auth.mfa_factors f on f.id=s.factor_id
  where s.id=sid and s.user_id=auth.uid() and s.aal::text='aal2' and f.user_id=auth.uid()
  and f.factor_type::text='totp' and f.status::text='verified') then return null; end if;
 if jsonb_typeof(j->'amr') is distinct from 'array' then return null; end if;
 select max((a->>'timestamp')::bigint) into proof from jsonb_array_elements(j->'amr') a
 where a->>'method'='totp' and a->>'timestamp' ~ '^[0-9]{1,11}$';
 if proof>extract(epoch from now())+30 then return null; end if;
 return proof;
end $$;
create function private.secure_scope_active(p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.live_auth_session() is not null and private.security_scope_eligible(p_scope)
 and private.totp_proof() is not null and exists(select 1 from private.security_sessions x
 where x.session_id=private.live_auth_session() and x.scope=p_scope and x.user_id=auth.uid()
 and x.closed_at is null and x.absolute_expires_at>now()
 and x.touched_at+case p_scope when 'admin' then interval '15 minutes' else interval '30 minutes' end>now()
 and x.factor_id=(select factor_id from auth.sessions where id=x.session_id)
 and private.totp_proof()>=x.proof_at and private.totp_proof()>x.proof_cutoff)
$$;
create function private.require_secure_scope(p_scope text) returns void
language plpgsql stable security definer set search_path='' as $$begin
 -- Preserve canonical nonstaff permission errors. Every entry point retains its own role check.
 if not private.security_scope_eligible(p_scope) then return; end if;
 if not private.secure_scope_active(p_scope) then raise exception 'Sesiunea securizată a expirat. Verifică din nou codul de autentificare.' using errcode='42501'; end if;
end $$;
create function private.require_secure_financial_scope() returns void
language plpgsql stable security definer set search_path='' as $$begin
 if not(private.security_scope_eligible('admin') or private.security_scope_eligible('business')) then return; end if;
 if not(private.secure_scope_active('admin') or private.secure_scope_active('business')) then
 raise exception 'Sesiunea securizată a expirat. Verifică din nou codul de autentificare.' using errcode='42501'; end if;
end $$;

-- Preserve the raw helper OIDs: Client eligibility checks must still recognize employees at aal1.
do $$declare definition text; begin
 select pg_get_functiondef('private.can(text)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION private.can(', 'FUNCTION private.can_raw(');
end $$;
create or replace function private.can(perm text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.secure_scope_active('admin') and private.can_raw(perm)
$$;
create function private.secured_member_role(v text) returns text
language sql stable security definer set search_path='' as $$
 select case when private.secure_scope_active('business') then private.member_role(v) end
$$;

create function public.secure_access_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if private.live_auth_session() is null then raise exception 'Intră întâi în cont.' using errcode='28000'; end if;
 return jsonb_build_object('admin_role',private.staff_role(auth.uid()),'business_access',private.security_scope_eligible('business'));
end $$;
create function public.secure_session_status(p_scope text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare x private.security_sessions; sid uuid:=private.live_auth_session(); reason text; idle int; absolute int; active boolean;
begin
 if p_scope is null or p_scope not in('admin','business') then raise exception 'Sferă de acces invalidă.'; end if;
 idle:=case p_scope when 'admin' then 900 else 1800 end; absolute:=case p_scope when 'admin' then 28800 else 43200 end;
 select * into x from private.security_sessions where session_id=sid and scope=p_scope and user_id=auth.uid();
 active:=private.secure_scope_active(p_scope);
 reason:=case when sid is null then 'session_revoked' when not private.security_scope_eligible(p_scope) then 'role_revoked'
 when x.closed_at is not null then 'closed' when x.session_id is not null and(x.absolute_expires_at<=now() or x.touched_at+make_interval(secs=>idle)<=now()) then 'expired'
 when private.totp_proof() is null then 'mfa_required' when not active then 'not_open' else null end;
 return jsonb_build_object('active',active,'scope',p_scope,'reason',reason,
 'reauthentication_required',reason in('closed','expired','not_open','mfa_required'),
 'idle_seconds',idle,'absolute_seconds',absolute,'idle_expires_at',x.touched_at+make_interval(secs=>idle),
 'absolute_expires_at',x.absolute_expires_at,'expires_at',least(x.absolute_expires_at,x.touched_at+make_interval(secs=>idle)));
end $$;
create function public.secure_session_open(p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.live_auth_session(); proof bigint:=private.totp_proof(); x private.security_sessions;
begin
 if p_scope is null or p_scope not in('admin','business') then raise exception 'Sferă de acces invalidă.'; end if;
 if sid is null or not private.security_scope_eligible(p_scope) then return public.secure_session_status(p_scope); end if;
 perform pg_advisory_xact_lock(hashtextextended('security:'||sid::text||':'||p_scope,0));
 select * into x from private.security_sessions where session_id=sid and scope=p_scope for update;
 if private.secure_scope_active(p_scope) then return public.secure_session_status(p_scope); end if;
 if proof is null or proof<extract(epoch from now())-300 or proof<=coalesce(greatest(x.proof_at,x.proof_cutoff),0)
 or(x.session_id is not null and least(x.absolute_expires_at,x.touched_at+case p_scope when 'admin' then interval '15 minutes' else interval '30 minutes' end)<=now()
 and proof<=floor(extract(epoch from least(x.absolute_expires_at,x.touched_at+case p_scope when 'admin' then interval '15 minutes' else interval '30 minutes' end)))) then
 return public.secure_session_status(p_scope)||jsonb_build_object('active',false,'reauthentication_required',true,'reason','fresh_mfa_required'); end if;
 insert into private.security_sessions(session_id,user_id,scope,opened_at,touched_at,absolute_expires_at,proof_at,factor_id)
 values(sid,auth.uid(),p_scope,now(),now(),now()+case p_scope when 'admin' then interval '8 hours' else interval '12 hours' end,proof,(select factor_id from auth.sessions where id=sid))
 on conflict(session_id,scope) do update set user_id=excluded.user_id,opened_at=excluded.opened_at,touched_at=excluded.touched_at,absolute_expires_at=excluded.absolute_expires_at,proof_at=excluded.proof_at,factor_id=excluded.factor_id,closed_at=null;
 return public.secure_session_status(p_scope);
end $$;
create function public.secure_session_touch(p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$begin
 if p_scope is null or p_scope not in('admin','business') then raise exception 'Sferă de acces invalidă.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('security:'||coalesce(private.live_auth_session()::text,'')||':'||p_scope,0));
 if private.secure_scope_active(p_scope) then update private.security_sessions set touched_at=now() where session_id=private.live_auth_session() and scope=p_scope and user_id=auth.uid(); end if;
 return public.secure_session_status(p_scope);
end $$;
create function public.secure_session_close(p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.live_auth_session(); cutoff bigint:=greatest(floor(extract(epoch from clock_timestamp())),coalesce(private.totp_proof(),0));
begin
 if p_scope is null or p_scope not in('admin','business') then raise exception 'Sferă de acces invalidă.'; end if;
 if sid is not null then
 perform pg_advisory_xact_lock(hashtextextended('security:'||sid::text||':'||p_scope,0));
 insert into private.security_sessions(session_id,user_id,scope,opened_at,touched_at,absolute_expires_at,proof_at,factor_id,proof_cutoff,closed_at)
 values(sid,auth.uid(),p_scope,now(),now(),now(),0,coalesce((select factor_id from auth.sessions where id=sid),'00000000-0000-0000-0000-000000000000'::uuid),cutoff,now()) on conflict(session_id,scope)
 do update set closed_at=now(),proof_cutoff=greatest(private.security_sessions.proof_cutoff,private.security_sessions.proof_at,cutoff);
 end if;
 return public.secure_session_status(p_scope);
end $$;

-- Bootstrap reveals only an existing staff role, not a usable capability.
create or replace function public.admin_me() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare role text:=private.staff_role(auth.uid()); perms jsonb;
begin
 if not private.business_authenticated() or role is null then raise exception 'Accesul în Admin este rezervat echipei CeFaci.' using errcode='42501'; end if;
 select jsonb_agg(p) into perms from unnest(array['staff.read','places.edit','places.hide','reports.read','reports.close','support.manage','staff.manage','partners','partners.read','founder','money','operations.read','operations.decide','money.read','users.read','plus.manage','suggestions.read','audit.read'])p where private.can(p);
 return jsonb_build_object('user_id',auth.uid(),'username',case when private.secure_scope_active('admin') then(select username from public.profiles where id=auth.uid())end,'role',role,'permissions',coalesce(perms,'[]'));
end $$;

-- Add explicit entry guards without changing signatures, defaults, return types or ownership.
-- SQL functions get a materialized guard CTE. Client self-benefit functions are deliberately excluded.
do $$declare f record; definition text; body text; guard text; scope text;
begin
 for f in select p.oid,p.proname,p.prosrc,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and(
 (p.proname like 'admin_%' and p.proname<>'admin_me') or
 (p.proname like 'biz_%' and p.proname not in('biz_identity_status','biz_identity_complete','biz_venue_search','biz_partner_request_create','biz_partner_request_submit','biz_partner_requests','biz_partner_request_cancel','biz_partner_proof_access')) or
 p.proname in('reservation_decide','reservation_decide_v2','drop_create','drop_create_v2','drop_stop','visit_close'))
 loop
  scope:=case when f.proname like 'admin_%' then 'admin' else 'business' end;
  guard:=case when f.proname in('biz_finance_v2','biz_month') then 'private.require_secure_financial_scope()' else format('private.require_secure_scope(%L)',scope) end;
  body:=replace(f.prosrc,'private.member_role(', 'private.secured_member_role(');
  if f.lanname='plpgsql' then body:=regexp_replace(body,'\mbegin\M','begin perform '||guard||';','i');
  elsif f.lanname='sql' then body:='with security_guard as materialized(select '||guard||') select result.* from security_guard cross join lateral ('||rtrim(trim(body),';')||')result';
  else raise exception 'Unexpected privileged language % for %',f.lanname,f.proname; end if;
  definition:=pg_get_functiondef(f.oid);definition:=replace(definition,f.prosrc,body);execute definition;
 end loop;
end $$;
-- Shared reports can be sent by pending Business accounts at aal1; attached venue context requires Business MFA.
do $$declare f text; body text; begin
 select pg_get_functiondef('public.support_report_create(text,text,text,text,text,text,text)'::regprocedure),prosrc into f,body from pg_proc where oid='public.support_report_create(text,text,text,text,text,text,text)'::regprocedure;
 execute replace(f,body,replace(body,'private.member_role(', 'private.secured_member_role('));
end $$;
drop policy if exists partner_members_own on public.partner_members;
create policy partner_members_own on public.partner_members for select to authenticated using(user_id=(select auth.uid()) and private.secure_scope_active('business'));
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using(private.secure_scope_active('admin') and(user_id=(select auth.uid()) or private.can('staff.read')));
drop policy if exists outing_events_read on public.outing_events;
create policy outing_events_read on public.outing_events for select to authenticated using(
 private.plan_access(plan_id,(select auth.uid())) or private.secured_member_role(venue_id) is not null
);

revoke all on function private.live_auth_session(),private.business_authenticated(),private.security_scope_eligible(text),private.totp_proof(),private.secure_scope_active(text),private.require_secure_scope(text),private.require_secure_financial_scope(),private.can_raw(text),private.secured_member_role(text) from public,anon,authenticated;
grant execute on function private.secure_scope_active(text),private.secured_member_role(text) to authenticated;
revoke all on function public.secure_access_status(),public.secure_session_open(text),public.secure_session_status(text),public.secure_session_touch(text),public.secure_session_close(text) from public,anon,authenticated;
grant execute on function public.secure_access_status(),public.secure_session_open(text),public.secure_session_status(text),public.secure_session_touch(text),public.secure_session_close(text) to authenticated;
notify pgrst,'reload schema';
