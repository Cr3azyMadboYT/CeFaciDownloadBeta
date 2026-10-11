-- V2 identity survives account/plan deletion; legacy writes must never bypass its evidence.
create or replace function public.visit_close(p_visit uuid, p_came boolean, p_bill numeric default null) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.plan_id is not null or x.group_visit or exists(select 1 from private.visit_pricing s where s.visit_id=x.id and s.version='per-person-v2') then raise exception 'Actualizează Business pentru închiderea grupului.'; end if;
  if x.id is null or private.member_role(x.venue_id) is null or private.member_role(x.venue_id) = 'scanare' then raise exception 'Nu ai voie.'; end if;
  if p_came is null then raise exception 'Spune dacă au venit sau nu.'; end if;
  if now() > ((x.work_day + 1)::timestamp + time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Seara asta s-a închis singură la 12:00.'; end if;
  if p_came is false and x.bill_source = 'bon' then raise exception 'Clientul a pus bonul de aici, deci a venit.'; end if;
  if p_bill is not null and (p_bill < 0 or p_bill >= 100000) then raise exception 'Nota nu pare bună.'; end if;
  update public.visits set outcome = case when p_came then 'a venit' else 'n-a venit' end,
    declared = coalesce(p_bill, declared),
    bill = case when bill_source = 'bon' then bill when p_came and p_bill is not null then p_bill when p_came then bill else null end,
    bill_source = case when bill_source = 'bon' then 'bon' when p_came and p_bill is not null then 'local' when p_came then bill_source else null end,
    closed_by = auth.uid(), closed_at = now()
  where id = p_visit;
end $$;

create or replace function public.biz_visit_attendance(p_visit uuid, p_adults int, p_discounted int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.plan_id is not null or x.group_visit or exists(select 1 from private.visit_pricing s where s.visit_id=x.id and s.version='per-person-v2') then raise exception 'Actualizează Business pentru închiderea grupului.'; end if;
  if x.id is null or coalesce(private.member_role(x.venue_id),'') not in ('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
  if p_adults is null or p_adults not between 0 and x.people
     or coalesce(p_discounted,p_adults) not between 0 and p_adults then raise exception 'Numărul de oameni nu e bun.'; end if;
  if now() > ((x.work_day + 1)::timestamp + time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Seara asta s-a închis.'; end if;
  if x.outcome <> 'a venit' then raise exception 'Confirmă întâi sosirea.'; end if;
  insert into private.visit_attendance(visit_id,adults,discounted,confirmed_by)
  values(x.id,p_adults,coalesce(p_discounted,p_adults),auth.uid())
  on conflict(visit_id) do update set adults=excluded.adults,discounted=excluded.discounted,
    confirmed_by=excluded.confirmed_by,confirmed_at=now();
end $$;

revoke all on function public.visit_close(uuid,boolean,numeric),public.biz_visit_attendance(uuid,int,int) from public,anon,authenticated;
grant execute on function public.visit_close(uuid,boolean,numeric),public.biz_visit_attendance(uuid,int,int) to authenticated;
notify pgrst,'reload schema';
