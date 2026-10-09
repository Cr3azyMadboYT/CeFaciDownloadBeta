-- Snapshot of function definitions before additive Admin rollout on CeFaci2.0, 2026-10-09. No application data.
CREATE OR REPLACE FUNCTION private.can(perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select coalesce((
select case perm
when 'staff.read'    then s.role in ('fondator', 'admin', 'editor', 'moderator', 'suport', 'contabil')
when 'places.edit'   then s.role in ('fondator', 'admin', 'editor')
when 'places.hide'   then s.role in ('fondator', 'admin', 'editor', 'moderator')
when 'reports.read'  then s.role in ('fondator', 'admin', 'editor', 'moderator', 'suport')
when 'reports.close' then s.role in ('fondator', 'admin', 'editor', 'moderator')
when 'staff.manage'  then s.role in ('fondator', 'admin')
when 'partners'      then s.role in ('fondator', 'admin')
when 'partners.read' then s.role in ('fondator', 'admin', 'suport', 'contabil')
when 'founder'       then s.role = 'fondator'
when 'money'         then s.role in ('fondator', 'contabil')
else false end
from public.staff s where s.user_id = (select auth.uid())), false)
$function$


CREATE OR REPLACE FUNCTION public.admin_benefit_decide_v2(p_visit uuid, p_version integer, p_uphold boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.visits; c private.benefit_cases;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.benefit_cases where visit_id=p_visit for update;
 if c.visit_id is null or c.state<>'pending' or c.version is distinct from p_version or p_uphold is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Versiune sau motiv invalid.';end if;
 if p_uphold and c.reporter is not null then
  perform 1 from public.profile_private where id=c.reporter for update;
  if not exists(select 1 from private.benefit_cases where reporter=c.reporter and compensated and decided_at>now()-interval '60 days') then
   perform set_config('cefaci.plus','on',true);update public.profile_private set plus_until=greatest(coalesce(plus_until,now()),now())+interval '7 days' where id=c.reporter;perform set_config('cefaci.plus','off',true);update private.benefit_cases set compensated=true where visit_id=p_visit;
  end if;
 end if;
 update private.benefit_cases set state=case when p_uphold then 'upheld' else 'dismissed' end,decision_reason=p_reason,decided_by=auth.uid(),decided_at=now(),version=version+1 where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'benefit',to_jsonb(c),to_jsonb(n),p_reason from private.benefit_cases n where visit_id=p_visit;
 -- Count eligibility is retained; refusal cannot convert eligible Drop persons to zero.
 update public.visits set proof=proof where id=p_visit;
end $function$


CREATE OR REPLACE FUNCTION public.admin_count_resolve_v2(p_visit uuid, p_version integer, p_people integer, p_adults integer, p_drop_adults integer, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.visits; c private.visit_counts; s private.visit_pricing;
begin
 perform private.require_v2();if not private.can('partners') then raise exception 'Doar echipa CeFaci poate hotărî.';end if;
 select * into v from public.visits where id=p_visit for update;select * into c from private.visit_counts where visit_id=p_visit for update;select * into s from private.visit_pricing where visit_id=p_visit;
 if c.visit_id is null or c.version is distinct from p_version or p_people is null or p_people not between 1 and v.people or p_adults is null or p_adults not between 0 and p_people or p_drop_adults is null or p_drop_adults not between 0 and least(p_adults,s.drop_limit) or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Număr, versiune sau motiv invalid.';end if;
 update private.visit_counts set version=version+1,people=p_people,adults=p_adults,drop_adults=p_drop_adults,state='confirmed',reason=p_reason,by_user=auth.uid() where visit_id=p_visit;
 insert into private.review_log(visit_id,by_user,kind,before,after,reason) select p_visit,auth.uid(),'count',to_jsonb(c),to_jsonb(n),p_reason from private.visit_counts n where visit_id=p_visit;
 update public.visits set proof=proof where id=p_visit;
end $function$


CREATE OR REPLACE FUNCTION public.admin_partner_requests(p_status text DEFAULT 'pending'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.can('partners') then raise exception 'Doar echipa CeFaci care verifică partenerii.'; end if;
 if p_status is null or p_status not in('draft','pending','verified','rejected','cancelled') then raise exception 'Stare invalidă.'; end if;
 return coalesce((select jsonb_agg(private.partner_request_public(r)||jsonb_build_object('applicant_id',r.user_id,'owner_response',r.owner_response,'owner_responded_at',r.owner_responded_at,'firm_verified_at',r.firm_verified_at,'proof_available',r.proof_path is not null and r.proof_deleted_at is null and r.proof_uploaded_at>now()-interval '90 days') order by r.created_at)
 from (select * from private.partner_requests where status=p_status order by created_at limit 100) r),'[]');
end $function$


CREATE OR REPLACE FUNCTION public.admin_report_close(p_id uuid, p_status text, p_answer text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
                                                                                                                                                                                                                                                                                                                                  begin
                                                                                                                                                                                                                                                                                                                                    if not private.can('reports.close') then raise exception 'Nu ai voie să închizi semnalări.'; end if;
                                                                                                                                                                                                                                                                                                                                      if p_status not in ('rezolvat', 'respins') then raise exception 'Stare necunoscută.'; end if;
                                                                                                                                                                                                                                                                                                                                        update public.reports set status = p_status, handled_by = auth.uid(), handled_at = now(), answer = p_answer where id = p_id;
                                                                                                                                                                                                                                                                                                                                        end $function$


CREATE OR REPLACE FUNCTION public.staff_remove(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
                                                                                                     declare me uuid := auth.uid(); mine text := private.staff_role(me); theirs text := private.staff_role(p_user);
                                                                                                     begin
                                                                                                       if p_user = me then raise exception 'Nu te poți scoate singur din echipă.'; end if;
                                                                                                         if mine is distinct from 'fondator' and (mine is distinct from 'admin' or theirs in ('fondator', 'admin', 'contabil')) then
                                                                                                             raise exception 'Nu ai voie să scoți pe cineva cu acest rol.';
                                                                                                               end if;
                                                                                                                 delete from public.staff where user_id = p_user;
                                                                                                                 end $function$


CREATE OR REPLACE FUNCTION public.staff_set(p_user uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
                                                                                 declare me uuid := auth.uid(); mine text := private.staff_role(me); theirs text := private.staff_role(p_user);
                                                                                 begin
                                                                                   if p_user = me then raise exception 'Nu-ți poți schimba singur rolul.'; end if;
                                                                                     if mine is null or mine not in ('fondator', 'admin') then raise exception 'Nu ai voie să schimbi echipa.'; end if;
                                                                                       if mine = 'admin' and (p_role not in ('editor', 'moderator', 'suport') or theirs in ('fondator', 'admin', 'contabil')) then
                                                                                           raise exception 'Un admin adaugă doar editori, moderatori și suport.';
                                                                                             end if;
                                                                                               if p_role not in ('fondator', 'admin', 'editor', 'moderator', 'suport', 'contabil') then raise exception 'Rol necunoscut.'; end if;
                                                                                                 insert into public.staff (user_id, role, added_by) values (p_user, p_role, me)
                                                                                                     on conflict (user_id) do update set role = excluded.role, added_by = me;
                                                                                                     end $function$

