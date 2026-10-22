-- Notificările (Cornel, 22.10: „să primești notificare când cineva îți dă cerere… și un buton de notificări să vezi
-- tot ce ai primit”).
-- 1. Cererea de prietenie și „a acceptat” trimit notificare (până acum doar votul, planul, gașca și FreeNow).
-- 2. Tot ce trimite „trimite-notificare” rămâne și în public.notifications: lista din clopoțel. O scrie doar funcția
--    (cheia de serviciu); omul își vede doar rândurile lui și le poate marca citite. Nimic nu se șterge din aplicație.

create table public.notifications(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in('vote','plan','crew','free','free_join','free_left','friend','friend_ok')),
 ref uuid not null,
 title text not null check(length(title) <= 200),
 body text not null check(length(body) <= 300),
 title_en text check(title_en is null or length(title_en) <= 200),
 body_en text check(body_en is null or length(body_en) <= 300),
 url text not null check(url ~ '^/[A-Za-z0-9/_-]*$'),
 created_at timestamptz not null default now(),
 read_at timestamptz);
create index notifications_user on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));

/** The bell was opened: everything is read. */
create function public.notifications_read() returns void
language sql security definer set search_path = '' as $$
 update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;
revoke all on function public.notifications_read() from public, anon, authenticated;
grant execute on function public.notifications_read() to authenticated;

-- prieteniile: cererea (la cel care o primește) și „ați devenit prieteni” (la cel care a cerut, sau, prin cod, la cel
-- al cărui cod a fost folosit)
create function private.push_friend() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
  if new.status = 'pending' then perform private.push('friend', new.requester, new.addressee);
  else perform private.push('friend_ok', new.requester, new.addressee); end if;
 elsif old.status = 'pending' and new.status = 'accepted' then
  perform private.push('friend_ok', new.addressee, new.requester);
 end if;
 return new;
end $$;
revoke all on function private.push_friend() from public, anon, authenticated;
create trigger push_friend after insert or update of status on public.friendships for each row execute function private.push_friend();
