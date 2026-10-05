-- Votul de după ieșire, mai sigur (05.10, după verificare):
-- - votezi doar pentru o ieșire la care ai fost: organizatorul sau cei invitați care n-au zis „Nu pot”
-- - un vot nu se poate muta pe alt plan (aceleași reguli și la schimbare ca la vot)
-- - un plan nu se poate trimite (după ce e făcut) unei găști din care nu faci parte: altfel voturile lui ar intra
--   în gusturile gășcii aceleia

create or replace function private.went_to(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plans pl where pl.id = p and pl.owner_id = u)
      or exists (select 1 from public.plan_members m where m.plan_id = p and m.user_id = u and m.answer <> 'nu_pot')
$$;
revoke all on function private.went_to(uuid, uuid) from public;
grant execute on function private.went_to(uuid, uuid) to authenticated;

drop policy if exists outing_votes_insert on public.outing_votes;
create policy outing_votes_insert on public.outing_votes for insert to authenticated with check (
  user_id = (select auth.uid())
  and private.went_to(plan_id, (select auth.uid()))
  and exists (select 1 from public.plans p where p.id = plan_id and p.starts_at <= now())
);
drop policy if exists outing_votes_change on public.outing_votes;
create policy outing_votes_change on public.outing_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and vote in (-1, 1, 2)
    and private.went_to(plan_id, (select auth.uid()))
    and exists (select 1 from public.plans p where p.id = plan_id and p.starts_at <= now())
  );

create or replace function private.plans_crew_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.crew_id is distinct from old.crew_id and new.crew_id is not null and (select auth.uid()) is not null
     and coalesce(private.crew_status(new.crew_id, (select auth.uid())), '') <> 'member' then
    raise exception 'Planul se poate trimite doar unei găști din care faci parte.';
  end if;
  return new;
end $$;
revoke all on function private.plans_crew_guard() from public;
drop trigger if exists plans_crew_guard on public.plans;
create trigger plans_crew_guard before update on public.plans for each row execute function private.plans_crew_guard();
