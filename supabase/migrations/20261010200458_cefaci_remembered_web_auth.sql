-- Opt-in browser login retention. This is not a remembered MFA proof or a dashboard capability.
create table private.remembered_web_sessions(
 session_id uuid primary key references auth.sessions(id)on delete cascade,
 user_id uuid not null references auth.users(id)on delete cascade,
 scope text not null check(scope in('admin','business')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index remembered_web_sessions_user on private.remembered_web_sessions(user_id);
alter table private.remembered_web_sessions enable row level security;
revoke all on private.remembered_web_sessions from public,anon,authenticated;

-- The deadline is fixed by the actual Auth session creation, not browser clocks or JWT metadata.
create or replace function private.live_auth_session() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare j jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'); sid uuid;
begin
 if auth.uid() is null or j->>'sub' is distinct from auth.uid()::text or coalesce((j->>'is_anonymous')::boolean,false) then return null; end if;
 begin sid:=(j->>'session_id')::uuid; exception when invalid_text_representation then return null; end;
 if sid is null then return null; end if;
 if not exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and s.id=sid and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and(u.banned_until is null or u.banned_until<=now())and(s.not_after is null or s.not_after>now())
  and not exists(select 1 from private.remembered_web_sessions r where r.session_id=s.id and r.expires_at<=now()))then return null; end if;
 return sid;
end $$;
create function public.remember_web_session(p_scope text)returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid:=private.live_auth_session(); deadline timestamptz;begin
 if sid is null then raise exception 'Intră din nou în cont.' using errcode='28000'; end if;
 if p_scope is null or p_scope not in('admin','business')then raise exception 'Aplicație invalidă.' using errcode='22023'; end if;
 select created_at+interval '15 days' into deadline from auth.sessions where id=sid and user_id=auth.uid();
 if deadline is null or deadline<=now()then raise exception 'Intră din nou în cont pentru memorarea acestui dispozitiv.' using errcode='28000'; end if;
 insert into private.remembered_web_sessions(session_id,user_id,scope,expires_at)values(sid,auth.uid(),p_scope,deadline)
 on conflict(session_id)do nothing;
 select expires_at into deadline from private.remembered_web_sessions where session_id=sid and user_id=auth.uid();
 return jsonb_build_object('expires_at',deadline);
end $$;
revoke all on function public.remember_web_session(text)from public,anon,authenticated;
grant execute on function public.remember_web_session(text)to authenticated;
-- Keep expired receipts until Auth removes the session; removing them early could revive a token.
