-- V2 keeps existing social plans; all attendance changes serialize on their plan row.
alter table public.plans add column people int not null default 1 check (people between 1 and 500),
 add column guests int not null default 0 check (guests between 0 and 499),
 add column guest_ages int[] not null default '{}',
 add column client_key text,
 add column shared_at timestamptz,
 add column attendance_deadline timestamptz,
 add column attendance_closed_at timestamptz;
create unique index plans_client_key on public.plans(owner_id,client_key) where client_key is not null;
alter table public.plan_members drop constraint plan_members_answer_check;
alter table public.plan_members add constraint plan_members_answer_check check(answer in ('pending','vin','nu_pot','timed_out'));

create or replace function private.plan_access(p uuid, u uuid, confirmed boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select u is not null and exists(select 1 from public.plans x where x.id=p and
 (x.owner_id=u or exists(select 1 from public.plan_members m where m.plan_id=p and m.user_id=u and (not confirmed or m.answer='vin'))))
$$;
revoke all on function private.plan_access(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.plan_access(uuid,uuid,boolean) to authenticated;

create or replace function private.attendance(p uuid) returns int
language plpgsql security definer set search_path='' as $$
declare x public.plans; n int;
begin
 select * into x from public.plans where id=p for update;
 if x.id is null or x.status<>'active' then raise exception 'Planul nu mai este activ.'; end if;
 if x.shared_at is null then return x.people; end if;
 if x.attendance_deadline<=now() then
  update public.plan_members set answer='timed_out',answered_at=now() where plan_id=p and answer='pending';
 end if;
 if exists(select 1 from public.plan_members where plan_id=p and answer='pending') then return null; end if;
 select 1+x.guests+count(*) into n from public.plan_members where plan_id=p and answer='vin';
 update public.plans set people=n,attendance_closed_at=coalesce(attendance_closed_at,now()) where id=p and (attendance_closed_at is null or people is distinct from n);
 return n;
end $$;
revoke all on function private.attendance(uuid) from public,anon,authenticated;

create or replace function public.plan_share_v2(p_key text,p_venue text,p_at timestamptz,p_people int,
 p_friends uuid[] default '{}',p_crew uuid default null,p_guests int default 0,p_guest_ages int[] default '{}',p_existing uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); x public.plans; ids uuid[]; title text;
begin
 perform private.require_v2();
 if me is null then raise exception 'Intră în cont.'; end if;
 if p_key is null or length(p_key) not between 1 and 100 or p_people is null or p_people not between 1 and 500
 or p_guests is null or p_guests not between 0 and 499 or cardinality(p_guest_ages)>p_guests
 or exists(select 1 from unnest(p_guest_ages) a where a is null or a not between 0 and 120)
 or p_at is null or p_at<now()-interval '6 hours' or p_at>now()+interval '1 year' then raise exception 'Datele planului nu sunt valide.'; end if;
 perform pg_advisory_xact_lock(hashtext('plan-key.'||me||p_key));
 if p_crew is not null and not exists(select 1 from public.crew_members where crew_id=p_crew and user_id=me and status='member') then raise exception 'Nu ești în gașca asta.'; end if;
 select coalesce(array_agg(distinct id),'{}') into ids from (
 select unnest(coalesce(p_friends,'{}')) id union select user_id from public.crew_members where crew_id=p_crew and status='member') s where id<>me;
 -- Declared groups without account invitations still contain explicit anonymous guests.
 if cardinality(ids)=0 then p_guests:=p_people-1; end if;
 if cardinality(p_guest_ages)>p_guests then raise exception 'Vârstele nu corespund invitaților fără cont.'; end if;
 if cardinality(ids)>499 or 1+cardinality(ids)+p_guests>500 then raise exception 'Grupul este prea mare.'; end if;
 if exists(select 1 from unnest(coalesce(p_friends,'{}')) f where f<>me and not exists(select 1 from public.friendships where status='accepted' and ((requester=me and addressee=f) or (requester=f and addressee=me)))) then raise exception 'Poți invita doar prieteni.'; end if;
 select * into x from public.plans where owner_id=me and client_key=p_key for update;
 if x.id is not null and p_existing is not null and x.id<>p_existing then raise exception 'Cheia aparține altui plan.';end if;
 if x.id is null and p_existing is not null then
  select * into x from public.plans where id=p_existing and owner_id=me for update;
  if x.id is null then raise exception 'Planul nu îți aparține.';end if;
  update public.plans set client_key=coalesce(client_key,p_key) where id=x.id;
 end if;
 if x.id is null then
  select coalesce(edit->>'name',name) into title from public.venues where id=p_venue and status='on';
  if title is null or exists(select 1 from public.partners where venue_id=p_venue and(venue_paused or(reservation_mode='required' and not reservations_on))) then raise exception 'Localul nu mai este disponibil.'; end if;
  insert into public.plans(owner_id,crew_id,venue_id,venue_name,starts_at,people,guests,guest_ages,client_key)
   values(me,p_crew,p_venue,title,p_at,p_people,p_guests,p_guest_ages,p_key) returning * into x;
 end if;
 if x.status<>'active' or x.venue_id<>p_venue then raise exception 'Planul nu mai este disponibil.'; end if;
 if cardinality(ids)>0 and x.shared_at is null then
  update public.plans set shared_at=now(),attendance_deadline=now()+interval '30 minutes',guests=p_guests,guest_ages=p_guest_ages,people=greatest(p_people,1+cardinality(ids)+p_guests) where id=x.id;
  insert into public.plan_members(plan_id,user_id) select x.id,id from unnest(ids) id on conflict do nothing;
 elsif cardinality(ids)>0 and exists(select 1 from unnest(ids) id where not exists(select 1 from public.plan_members where plan_id=x.id and user_id=id)) then
  raise exception 'Invitațiile sunt deja trimise. Creează un plan nou pentru alt grup.';
 end if;
 return x.id;
end $$;
revoke all on function public.plan_share_v2(text,text,timestamptz,int,uuid[],uuid,int,int[],uuid) from public,anon,authenticated;
grant execute on function public.plan_share_v2(text,text,timestamptz,int,uuid[],uuid,int,int[],uuid) to authenticated;

create or replace function public.plan_answer_v2(p_plan uuid,p_answer text) returns int
language plpgsql security definer set search_path='' as $$
declare x public.plans;
begin
 perform private.require_v2();
 select * into x from public.plans where id=p_plan for update;
 if auth.uid() is null or not private.plan_access(p_plan,auth.uid()) then raise exception 'Nu ai acces la plan.'; end if;
 if p_answer is null or p_answer not in ('vin','nu_pot') then raise exception 'Răspuns invalid.'; end if;
 if x.status<>'active' then raise exception 'Planul a fost anulat.'; end if;
 if x.owner_id=auth.uid() then return private.attendance(p_plan); end if;
 if x.attendance_closed_at is not null or x.attendance_deadline<=now() then
  if exists(select 1 from public.plan_members where plan_id=p_plan and user_id=auth.uid() and answer=p_answer) then return private.attendance(p_plan); end if;
  raise exception 'Participarea s-a închis. Cere organizatorului un plan nou.';
 end if;
 update public.plan_members set answer=p_answer,answered_at=now() where plan_id=p_plan and user_id=auth.uid();
 return private.attendance(p_plan);
end $$;
revoke all on function public.plan_answer_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.plan_answer_v2(uuid,text) to authenticated;

create or replace function public.plan_attendance(p_plan uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n int; x public.plans;
begin
 if not private.plan_access(p_plan,auth.uid()) then raise exception 'Nu ai acces la plan.'; end if;
 n:=private.attendance(p_plan); select * into x from public.plans where id=p_plan;
 return jsonb_build_object('plan',p_plan,'people',coalesce(n,x.people),'ready',n is not null,'deadline',x.attendance_deadline,'guests',x.guests);
end $$;
revoke all on function public.plan_attendance(uuid) from public,anon,authenticated;
grant execute on function public.plan_attendance(uuid) to authenticated;

create or replace function public.plan_guest_ages_v2(p_plan uuid,p_ages int[]) returns void
language plpgsql security definer set search_path='' as $$
declare x public.plans;
begin
 perform private.require_v2();
 select * into x from public.plans where id=p_plan for update;
 if auth.uid() is null or x.owner_id is distinct from auth.uid() or x.status<>'active' then raise exception 'Doar organizatorul completează invitații.'; end if;
 if p_ages is null or cardinality(p_ages)<>x.guests or exists(select 1 from unnest(p_ages) a where a is null or a not between 0 and 120) then raise exception 'Completează o vârstă validă pentru fiecare invitat fără cont.'; end if;
 if exists(select 1 from public.drop_claims where plan_id=p_plan and status in('activ','folosit')) or exists(select 1 from public.visits where plan_id=p_plan) then raise exception 'Eligibilitatea este deja salvată.'; end if;
 update public.plans set guest_ages=p_ages where id=p_plan;
end $$;
revoke all on function public.plan_guest_ages_v2(uuid,int[]) from public,anon,authenticated;
grant execute on function public.plan_guest_ages_v2(uuid,int[]) to authenticated;

-- No direct writes can forge a deadline, finalized group or answer after locking.
revoke insert,update,delete on public.plans,public.plan_members from authenticated;
