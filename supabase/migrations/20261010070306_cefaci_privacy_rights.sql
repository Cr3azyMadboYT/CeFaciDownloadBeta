-- Personal data-rights inbox. No endpoint accepts a requester ID or grants dashboard access.
-- An answered erasure request is a recorded response, never a pretend deletion operation.
create table private.privacy_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 request_key uuid not null,
 scope text not null check(scope in('client','business','admin')),
 kind text not null check(kind in('access','rectification','erasure','restriction','objection','portability')),
 description text not null check(length(description) between 10 and 4000),
 status text not null default 'new' check(status in('new','in_progress','extended','answered','refused')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 original_due_at timestamptz not null default (((now() at time zone 'Europe/Bucharest')+interval '1 month') at time zone 'Europe/Bucharest'),
 due_at timestamptz not null default (((now() at time zone 'Europe/Bucharest')+interval '1 month') at time zone 'Europe/Bucharest'),
 response text check(length(response)<=8000),
 extension_reason text check(length(extension_reason)<=8000), extension_months integer not null default 0 check(extension_months between 0 and 2),
 handled_by uuid references auth.users(id) on delete set null,
 unique(user_id,request_key)
);
create index privacy_requests_queue on private.privacy_requests(status,due_at,id);
create index privacy_requests_own on private.privacy_requests(user_id,created_at desc,id);
create index privacy_requests_handler on private.privacy_requests(handled_by) where handled_by is not null;
create table private.privacy_request_log (
 id bigint generated always as identity primary key,
 request_id uuid not null references private.privacy_requests(id) on delete restrict,
 by_user uuid references auth.users(id) on delete set null,
 action text not null, status text not null, response text, version integer not null,
 at timestamptz not null default now()
);
create index privacy_request_log_request on private.privacy_request_log(request_id,at,id);
create index privacy_request_log_actor on private.privacy_request_log(by_user) where by_user is not null;
create trigger privacy_request_log_immutable before update or delete on private.privacy_request_log
 for each row execute function private.partner_request_log_immutable();
alter table private.privacy_requests enable row level security;
alter table private.privacy_request_log enable row level security;
revoke all on private.privacy_requests,private.privacy_request_log from public,anon,authenticated;

create function private.privacy_require_user() returns uuid
language plpgsql stable security definer set search_path='' as $$begin
 if private.live_auth_session() is null then raise exception 'Intră întâi în cont pentru a solicita datele tale.' using errcode='28000'; end if;
 return auth.uid();
end $$;
create function private.privacy_require_admin() returns void
language plpgsql stable security definer set search_path='' as $$begin
 perform private.privacy_require_user();
 if private.staff_role(auth.uid()) is null or private.staff_role(auth.uid()) not in('fondator','admin') then
  raise exception 'Nu ai voie să gestionezi cereri privind datele personale.' using errcode='42501'; end if;
 perform private.require_secure_scope('admin');
end $$;
create function private.privacy_request_public(r private.privacy_requests) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',r.id,'scope',r.scope,'kind',r.kind,'description',r.description,
 'status',r.status,'version',r.version,'created_at',r.created_at,'updated_at',r.updated_at,
 'original_due_at',r.original_due_at,'due_at',r.due_at,'response',r.response,
 'extension_reason',r.extension_reason,'extension_months',r.extension_months)
$$;
revoke all on function private.privacy_require_user(),private.privacy_require_admin(),private.privacy_request_public(private.privacy_requests) from public,anon,authenticated;

create function public.privacy_request_submit(p_scope text,p_kind text,p_description text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=private.privacy_require_user(); r private.privacy_requests; body text:=trim(p_description);
begin
 if p_scope is null or p_scope not in('client','business','admin') or p_kind is null or p_kind not in('access','rectification','erasure','restriction','objection','portability') or p_request_key is null then raise exception 'Cererea nu este validă.'; end if;
 if body is null or length(body) not between 10 and 4000 or body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'Descrie cererea în 10–4000 de caractere.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy:'||me::text,0));
 select * into r from private.privacy_requests where user_id=me and request_key=p_request_key;
 if r.id is not null then
  if r.scope<>p_scope or r.kind<>p_kind or r.description<>body then raise exception 'Această cheie aparține altei cereri. Reia formularul pentru o cerere diferită.'; end if;
  return private.privacy_request_public(r);
 end if;
 -- Technical anti-abuse limit is not a legal finding that a request is excessive.
 if(select count(*) from private.privacy_requests where user_id=me and created_at>now()-interval '1 day')>=20 then
  raise exception 'Ai trimis multe cereri astăzi. Poți exercita drepturile și prin contact@cornacidev.ro.'; end if;
 insert into private.privacy_requests(user_id,request_key,scope,kind,description) values(me,p_request_key,p_scope,p_kind,body) returning * into r;
 insert into private.privacy_request_log(request_id,by_user,action,status,version)values(r.id,me,'submitted',r.status,r.version);
 return private.privacy_request_public(r);
end $$;
create function public.privacy_my_requests(p_scope text default null,p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=private.privacy_require_user();begin
 if p_scope is not null and p_scope not in('client','business','admin') then raise exception 'Sferă invalidă.'; end if;
 if p_limit is null or p_limit not between 1 and 200 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Paginare invalidă.'; end if;
 return coalesce((select jsonb_agg(x.item order by x.created_at desc,x.id)from(
 select r.created_at,r.id,private.privacy_request_public(r)item from private.privacy_requests r
 where r.user_id=me and(p_scope is null or r.scope=p_scope)order by r.created_at desc,r.id limit p_limit offset p_offset)x),'[]');
end $$;
create function public.privacy_export_my_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=private.privacy_require_user();begin
 return jsonb_build_object('format','cefaci-personal-core-v1','generated_at',now(),'user_id',me,
 'coverage','Copie a profilului, preferințelor de bază și celor mai recente 100 de cereri privind datele personale. Nu este răspunsul integral la o cerere de acces sau portabilitate; solicită separat înregistrările suplimentare aplicabile.',
 'profile',(select jsonb_build_object('username',p.username,'first_name',p.first_name,'created_at',p.created_at)from public.profiles p where p.id=me),
 'preferences',(select jsonb_build_object('birth_date',p.birth_date,'zone',p.prefs->'zone','likes',p.prefs->'likes','budget',p.prefs->'budget','updated_at',p.updated_at)from public.profile_private p where p.id=me),
 'requests',public.privacy_my_requests(null,100,0),
 'requests_count',(select count(*)from private.privacy_requests where user_id=me),
 'requests_truncated',(select count(*)>100 from private.privacy_requests where user_id=me));
end $$;

create function public.admin_privacy_requests(p_status text default null,p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 perform private.privacy_require_admin();
 if p_status is not null and p_status not in('new','in_progress','extended','answered','refused') then raise exception 'Stare invalidă.'; end if;
 if p_limit is null or p_limit not between 1 and 200 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Paginare invalidă.'; end if;
 return coalesce((select jsonb_agg(x.item order by x.due_at,x.id)from(
 select r.id,r.due_at,private.privacy_request_public(r)||jsonb_build_object('requester_id',r.user_id,'username',p.username) item
 from private.privacy_requests r left join public.profiles p on p.id=r.user_id
 where p_status is null or r.status=p_status order by r.due_at,r.id limit p_limit offset p_offset)x),'[]');
end $$;
create function public.admin_privacy_request_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r private.privacy_requests;begin
 perform private.privacy_require_admin(); select * into r from private.privacy_requests where id=p_id;
 if r.id is null then raise exception 'Cererea nu mai este disponibilă.'; end if;
 return private.privacy_request_public(r)||jsonb_build_object('requester_id',r.user_id,'username',(select username from public.profiles where id=r.user_id),
 'history',coalesce((select jsonb_agg(jsonb_build_object('action',l.action,'status',l.status,'response',l.response,'at',l.at,'version',l.version)order by l.at,l.id)
 from private.privacy_request_log l where l.request_id=r.id),'[]'));
end $$;
create function public.admin_privacy_request_respond(p_id uuid,p_expected_version integer,p_status text,p_response text,p_extension_months integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.privacy_requests; body text:=trim(p_response);begin
 perform private.privacy_require_admin();
 if p_status is null or p_status not in('in_progress','answered','refused','extended') or p_extension_months is null or p_extension_months not between 0 and 2 then raise exception 'Răspuns invalid.'; end if;
 if body is null or length(body) not between 20 and 8000 or body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'Explică răspunsul în 20–8000 de caractere. Nu include datele altor persoane.'; end if;
 select * into r from private.privacy_requests where id=p_id for update;
 if r.id is null then raise exception 'Cererea nu mai este disponibilă.'; end if;
 if p_expected_version is null or r.version<>p_expected_version then raise exception 'Cererea s-a schimbat. Reîncarcă înainte de a răspunde.' using errcode='40001'; end if;
 if r.status in('answered','refused') then raise exception 'Cererea a primit deja un răspuns final.'; end if;
 if p_status='extended' then
  if p_extension_months=0 or r.extension_months<>0 or now()>r.original_due_at then raise exception 'Prelungirea trebuie motivată și comunicată în prima lună, o singură dată, cu cel mult două luni.'; end if;
 else
  if p_extension_months<>0 then raise exception 'Prelungirea este disponibilă doar pentru starea de termen prelungit.'; end if;
 end if;
 update private.privacy_requests set status=p_status,response=body,version=version+1,updated_at=now(),handled_by=auth.uid(),
 extension_reason=case when p_status='extended' then body else extension_reason end,
 extension_months=case when p_status='extended' then p_extension_months else extension_months end,
 due_at=case when p_status='extended' then((original_due_at at time zone 'Europe/Bucharest')+make_interval(months=>p_extension_months))at time zone 'Europe/Bucharest' else due_at end
 where id=r.id returning * into r;
 insert into private.privacy_request_log(request_id,by_user,action,status,response,version)values(r.id,auth.uid(),'responded',r.status,body,r.version);
 return private.privacy_request_public(r);
end $$;
revoke all on function public.privacy_request_submit(text,text,text,uuid),public.privacy_my_requests(text,integer,integer),public.privacy_export_my_data(),public.admin_privacy_requests(text,integer,integer),public.admin_privacy_request_detail(uuid),public.admin_privacy_request_respond(uuid,integer,text,text,integer) from public,anon,authenticated;
grant execute on function public.privacy_request_submit(text,text,text,uuid),public.privacy_my_requests(text,integer,integer),public.privacy_export_my_data(),public.admin_privacy_requests(text,integer,integer),public.admin_privacy_request_detail(uuid),public.admin_privacy_request_respond(uuid,integer,text,text,integer) to authenticated;

-- Preserve immediate deletion for uncomplicated Client accounts; retained operational/proof records need review.
-- Never execute an Auth cascade with a token whose session has already been revoked.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=private.privacy_require_user();begin
 if exists(select 1 from public.staff where user_id=me)
 or exists(select 1 from public.partner_members where user_id=me)
 or exists(select 1 from public.reservations where user_id=me)
 or exists(select 1 from public.drop_claims where user_id=me)
 or exists(select 1 from private.claim_members where user_id=me)
 or exists(select 1 from public.visits where user_id=me)
 or exists(select 1 from public.receipts where user_id=me)
 or exists(select 1 from private.partner_requests where user_id=me)
 or exists(select 1 from public.profiles where id=me and avatar_path is not null)
 or exists(select 1 from private.support_reports where user_id=me)
 or exists(select 1 from private.privacy_requests where user_id=me and status not in('answered','refused')) then
  raise exception 'Contul are documente sau operațiuni care necesită verificare. Trimite o cerere de ștergere din Datele mele; contul nu a fost șters.'; end if;
 delete from auth.sessions where user_id=me;
 delete from auth.users where id=me;
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
notify pgrst,'reload schema';
