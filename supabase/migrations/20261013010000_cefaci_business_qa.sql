-- Verificarea Business din 13.10:
-- 1. Echipa localului: proprietarul nu mai poate face pe altcineva proprietar și nici nu poate scoate alt proprietar
--    (asta se face doar prin CeFaci, cu actele firmei); oamenii echipei CeFaci nu pot intra în echipa unui local;
--    fiecare schimbare de rol rămâne în jurnal (cine, cui, ce rol, când).
-- 2. Corectarea numărului de persoane din Admin: doar pentru numerele încă neconfirmate sau contestate.

create table if not exists private.team_log (
  venue_id text not null,
  by_user uuid,
  target uuid not null,
  role text not null,
  at timestamptz not null default now()
);
alter table private.team_log enable row level security;
create index if not exists team_log_venue on private.team_log (venue_id, at desc);

create or replace function public.biz_team_set(p_venue text, p_username text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare mine text := private.member_role(p_venue); who uuid; theirs text;
begin
  if mine is null or mine not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
  if p_role not in ('proprietar', 'manager', 'receptie', 'scanare', 'scos') then raise exception 'Rol necunoscut.'; end if;
  if p_role = 'proprietar' then
    raise exception 'Un proprietar nou se adaugă doar prin CeFaci, cu actele firmei. Scrie-ne din Business → Ajutor.'; end if;
  if mine = 'manager' and p_role not in ('receptie', 'scanare', 'scos') then raise exception 'Managerul adaugă doar recepție și scanare.'; end if;
  select id into who from public.profiles where username = lower(trim(both '@ ' from p_username));
  if who is null then raise exception 'Nu găsesc @%. Omul își face întâi cont în aplicația CeFaci.', p_username; end if;
  if who = auth.uid() then raise exception 'Nu-ți poți schimba singur rolul.'; end if;
  if exists (select 1 from public.staff where user_id = who) then
    raise exception 'Oamenii echipei CeFaci nu pot fi în echipa unui local.'; end if;
  select role into theirs from public.partner_members where venue_id = p_venue and user_id = who and active;
  if theirs = 'proprietar' then
    raise exception 'Un proprietar se schimbă doar prin CeFaci, cu actele firmei.'; end if;
  if mine = 'manager' and theirs = 'manager' then raise exception 'Nu ai voie.'; end if;
  if p_role = 'scos' then
    update public.partner_members set active = false where venue_id = p_venue and user_id = who;
  else
    insert into public.partner_members (venue_id, user_id, role, added_by) values (p_venue, who, p_role, auth.uid())
    on conflict (venue_id, user_id) do update set role = excluded.role, active = true;
  end if;
  insert into private.team_log (venue_id, by_user, target, role) values (p_venue, auth.uid(), who, p_role);
end $$;
revoke all on function public.biz_team_set(text, text, text) from public, anon;
grant execute on function public.biz_team_set(text, text, text) to authenticated;

create or replace function public.admin_count_resolve_v2(p_visit uuid,p_version int,p_people int,p_adults int,p_drop_adults int,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits; c private.visit_counts; s private.visit_pricing;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.visit_counts where visit_id=p_visit for update;select * into s from private.visit_pricing where visit_id=p_visit;
 if c.visit_id is null or c.version is distinct from p_version or p_people is null or p_people not between 1 and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,s.drop_limit) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Număr, versiune sau motiv invalid.';end if;
 if c.visit_id is not null and c.state not in ('awaiting','disputed') then raise exception 'Numărul e deja confirmat; nu se mai corectează de aici.';end if;
 update private.visit_counts set version=version+1,people=p_people,adults=p_adults,drop_adults=p_drop_adults,state='confirmed',reason=p_reason,by_user=auth.uid() where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'count',to_jsonb(c),to_jsonb(n),p_reason from private.visit_counts n where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $$;
revoke all on function public.admin_count_resolve_v2(uuid,int,int,int,int,text) from public,anon,authenticated;
grant execute on function public.admin_count_resolve_v2(uuid,int,int,int,int,text) to authenticated;
