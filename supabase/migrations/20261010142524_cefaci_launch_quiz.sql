-- Public, opt-in prelaunch feedback. No public read API, account, or email campaign.
create table private.launch_interests (
 id uuid primary key default gen_random_uuid(),
 receipt_hash bytea not null unique,
 vote text not null check(vote in ('yes','maybe','no')),
 name text not null check(char_length(name) between 2 and 60),
 email text check(char_length(email)<=254),
 consent_text text not null,
 email_consent_at timestamptz,
 notice_version text not null default 'launch-2026-10-10-v1',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '180 days',
 check((email is null and email_consent_at is null)or(email is not null and email_consent_at is not null))
);
create index launch_interests_created on private.launch_interests(created_at desc,id);
create index launch_interests_expiry on private.launch_interests(expires_at);
-- Separate short-lived quota counters: withdrawing a vote does not reset submission limits.
create table private.launch_quotas (bucket timestamptz primary key, submissions integer not null);
create table private.launch_withdrawals(receipt_hash bytea primary key,expires_at timestamptz not null default now()+interval '180 days');
alter table private.launch_withdrawals enable row level security;
revoke all on private.launch_withdrawals from public,anon,authenticated;
alter table private.launch_interests enable row level security;
alter table private.launch_quotas enable row level security;
revoke all on private.launch_interests,private.launch_quotas from public,anon,authenticated;

create function public.launch_interest_submit(p_receipt uuid,p_nonce text,p_vote text,p_name text,p_email text default null,p_email_consent boolean default false,p_feedback_consent boolean default false,p_website text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare normalized_name text:=btrim(p_name); normalized_email text:=nullif(lower(btrim(p_email)),'');
 receipt bytea:=sha256(convert_to(p_receipt::text,'UTF8')); old private.launch_interests; minute timestamptz:=date_trunc('minute',now());
begin
 if p_receipt is null or substring(p_receipt::text,15,1)<>'4' or p_nonce is null or char_length(p_nonce)>12 or p_nonce!~'^[0-9]+$'
 or left(encode(sha256(convert_to(p_receipt::text||':'||p_nonce,'UTF8')),'hex'),3)<>'000' then
  raise exception 'Verificarea trimiterii a eșuat.' using errcode='22023'; end if;
 if p_vote is null or p_vote not in('yes','maybe','no') or normalized_name is null or char_length(normalized_name) not between 2 and 60
 or normalized_name~'[[:cntrl:]<>]' or p_feedback_consent is distinct from true or coalesce(p_website,'')<>'' then
  raise exception 'Verifică numele, votul și acordul pentru participare.' using errcode='22023'; end if;
 if (normalized_email is not null and (char_length(normalized_email)>254 or normalized_email!~'^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or p_email_consent is distinct from true))
 or (normalized_email is null and p_email_consent is true) then
  raise exception 'Emailul este opțional; completează-l și bifează acordul doar dacă dorești anunțul lansării.' using errcode='22023'; end if;
 -- Serializes new writes and withdrawals; expiry/quotas remain atomic under concurrency.
 perform pg_advisory_xact_lock(631042101425::bigint);
 if exists(select 1 from private.launch_withdrawals where receipt_hash=receipt)then raise exception 'Această trimitere a fost retrasă.' using errcode='22023'; end if;
 select * into old from private.launch_interests where receipt_hash=receipt;
 if found then
  if old.vote<>p_vote or old.name<>normalized_name or old.email is distinct from normalized_email then raise exception 'Trimiterea inițială este deja înregistrată. Nu reutiliza cheia pentru alt răspuns.' using errcode='22023'; end if;
  return jsonb_build_object('saved',true,'email_requested',old.email is not null);
 end if;
 if coalesce((select submissions from private.launch_quotas where bucket=minute),0)>=100
 or coalesce((select sum(submissions)from private.launch_quotas where bucket>=now()-interval '1 day'),0)>=5000 then
  raise exception 'Sunt prea multe trimiteri acum. Încearcă mai târziu.' using errcode='P0001'; end if;
 delete from private.launch_quotas where bucket<now()-interval '2 days';
 insert into private.launch_quotas values(minute,1)on conflict(bucket)do update set submissions=private.launch_quotas.submissions+1;
 insert into private.launch_interests(receipt_hash,vote,name,email,email_consent_at,consent_text)
 values(receipt,p_vote,normalized_name,normalized_email,case when normalized_email is not null then now()end,
 'Am cel puțin 16 ani și sunt de acord ca CeFaci să păstreze votul și numele ales pentru evaluarea interesului pentru lansare.'||
 case when normalized_email is not null then ' Vreau să primesc un email de la CeFaci când se lansează aplicația. Îmi pot retrage acordul oricând.' else '' end);
 return jsonb_build_object('saved',true,'email_requested',normalized_email is not null);
end $$;

-- A private, unguessable receipt permits erasure, never reads. GET is disallowed.
create function public.launch_interest_withdraw(p_receipt uuid,p_nonce text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt bytea:=sha256(convert_to(p_receipt::text,'UTF8')); minute timestamptz:=date_trunc('minute',now());begin
 if p_receipt is null or p_nonce is null or char_length(p_nonce)>12 or p_nonce!~'^[0-9]+$' or left(encode(sha256(convert_to(p_receipt::text||':'||p_nonce,'UTF8')),'hex'),3)<>'000' then raise exception 'Verificarea retragerii a eșuat.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(631042101425::bigint);
 if not exists(select 1 from private.launch_withdrawals where receipt_hash=receipt) and not exists(select 1 from private.launch_interests where receipt_hash=receipt)then
  if coalesce((select submissions from private.launch_quotas where bucket=minute),0)>=100 or coalesce((select sum(submissions)from private.launch_quotas where bucket>=now()-interval '1 day'),0)>=5000 then raise exception 'Sunt prea multe trimiteri acum. Încearcă mai târziu.' using errcode='P0001'; end if;
  insert into private.launch_quotas values(minute,1)on conflict(bucket)do update set submissions=private.launch_quotas.submissions+1;
 end if;
 insert into private.launch_withdrawals(receipt_hash)values(receipt)on conflict do nothing;
 delete from private.launch_interests where receipt_hash=receipt;
 return jsonb_build_object('withdrawn',true);
end $$;
create function public.admin_launch_interests(p_vote text default null,p_query text default '',p_offset integer default 0)returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 perform private.privacy_require_admin();
 if p_vote is not null and p_vote not in('yes','maybe','no')or p_query is null or char_length(p_query)>100 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Filtru invalid.'; end if;
 return jsonb_build_object('summary',(select jsonb_build_object('total',count(*),'yes',count(*)filter(where vote='yes'),'maybe',count(*)filter(where vote='maybe'),'no',count(*)filter(where vote='no'),'email',count(email))from private.launch_interests where expires_at>now()),
 'rows',coalesce((select jsonb_agg(to_jsonb(r)order by r.created_at desc,r.id)from(
 select id,vote,name,email,created_at,email_consent_at,consent_text,notice_version,expires_at from private.launch_interests
 where expires_at>now()and(p_vote is null or vote=p_vote)and(p_query=''or strpos(lower(name),lower(p_query))>0 or strpos(coalesce(email,''),lower(p_query))>0)
 order by created_at desc,id limit 50 offset p_offset)r),'[]'::jsonb));
end $$;
create function public.admin_launch_interest_delete(p_id uuid)returns void
language plpgsql security definer set search_path='' as $$begin
 perform private.privacy_require_admin();
 perform pg_advisory_xact_lock(631042101425::bigint);
 insert into private.launch_withdrawals(receipt_hash)select receipt_hash from private.launch_interests where id=p_id on conflict do nothing;
 delete from private.launch_interests where id=p_id;
end $$;
revoke all on function public.launch_interest_submit(uuid,text,text,text,text,boolean,boolean,text),public.launch_interest_withdraw(uuid,text),public.admin_launch_interests(text,text,integer),public.admin_launch_interest_delete(uuid)from public,anon,authenticated;
grant execute on function public.launch_interest_submit(uuid,text,text,text,text,boolean,boolean,text),public.launch_interest_withdraw(uuid,text)to anon,authenticated;
grant execute on function public.admin_launch_interests(text,text,integer),public.admin_launch_interest_delete(uuid)to authenticated;
-- Daily expiry in production. Local test fixtures need no scheduler extension.
do $job$ begin
 if exists(select 1 from pg_extension where extname='pg_cron')then
 execute $sql$select cron.schedule('cefaci-launch-retention','25 3 * * *',$command$delete from private.launch_interests where expires_at<=now(); delete from private.launch_withdrawals where expires_at<=now(); delete from private.launch_quotas where bucket<now()-interval '2 days';$command$)$sql$;
 end if;
end $job$;
