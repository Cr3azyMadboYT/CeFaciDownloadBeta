-- Notifications from other people (decision Cornel, 04.10): someone starts a vote with you, calls you to a plan,
-- or invites you into a crew. The phone saves its Firebase token here; a database trigger tells the Edge Function
-- "trimite-notificare", which reads the row itself (so a forged call can only repeat a real one, and push_log
-- makes each notification go once) and sends it through Firebase Cloud Messaging.

do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net lipsește (teste locale)'; end $$;

create table public.push_tokens (
  token text primary key check (char_length(token) <= 4096),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy push_tokens_own_read on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy push_tokens_own_add on public.push_tokens for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_tokens_own_change on public.push_tokens for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_tokens_own_remove on public.push_tokens for delete to authenticated using (user_id = (select auth.uid()));

-- what was already sent (only the Edge Function writes here, as the service)
create table public.push_log (
  kind text not null,
  ref uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (kind, ref, user_id)
);
alter table public.push_log enable row level security;

create or replace function private.push(p_kind text, p_ref uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://vqrmwuarjjntusfbqprx.supabase.co/functions/v1/trimite-notificare',
    body := jsonb_build_object('kind', p_kind, 'ref', p_ref, 'user', p_user),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  null; -- never block a vote, a plan or an invitation because a notification could not leave
end $$;

create or replace function private.push_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from (select created_by from public.vote_sessions where id = new.session_id) then
    perform private.push('vote', new.session_id, new.user_id);
  end if;
  return new;
end $$;
create trigger push_vote after insert on public.vote_voters for each row execute function private.push_vote();

create or replace function private.push_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.push('plan', new.plan_id, new.user_id);
  return new;
end $$;
create trigger push_plan after insert on public.plan_members for each row execute function private.push_plan();

create or replace function private.push_crew() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'invited' then perform private.push('crew', new.crew_id, new.user_id); end if;
  return new;
end $$;
create trigger push_crew after insert on public.crew_members for each row execute function private.push_crew();
