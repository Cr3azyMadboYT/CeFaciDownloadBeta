-- Read-only pre-V2 function definitions from CeFaci2.0, 2026-10-08. Reference snapshot; use pause-v2.sql for operational rollback.
CREATE OR REPLACE FUNCTION private.visit_fees(v text, d0 date, d1 date)
 RETURNS TABLE(visit_id uuid, work_day date, kind text, bill numeric, bill_source text, fee numeric, free boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select x.id,x.work_day,x.kind,x.bill,x.bill_source,
    s.unit_fee * least(s.eligible_limit, a.adults, case when x.kind='drop' then a.discounted else a.adults end),s.free
  from public.visits x join private.visit_pricing s on s.visit_id=x.id
  join private.visit_attendance a on a.visit_id=x.id
  where x.venue_id=v and x.work_day between d0 and d1 and x.kind in ('rezervare','drop')
    and s.tier is not null and x.outcome='a venit' and x.closed_at is not null
$function$
;

CREATE OR REPLACE FUNCTION public.biz_my_venues()
 RETURNS TABLE(venue_id text, name text, role text, status text, founder boolean, rate numeric, free_until date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.venue_id, coalesce(v.edit->>'name', v.name), m.role, p.status, case when m.role in ('proprietar','manager') then p.founder end, null::numeric, case when m.role in ('proprietar','manager') then p.free_until end
  from public.partner_members m join public.partners p on p.venue_id = m.venue_id left join public.venues v on v.id = m.venue_id
  where m.user_id = (select auth.uid()) and m.active order by 2
$function$
;

CREATE OR REPLACE FUNCTION public.drop_create(p_venue text, p_title text, p_pct_all integer, p_pct_plus integer, p_seats integer, p_minutes integer, p_starts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_min_group integer DEFAULT 1, p_adult boolean DEFAULT true, p_new_only boolean DEFAULT false)
 RETURNS drops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pr public.partners; s timestamptz := coalesce(p_starts, now()); d public.drops;
begin
if coalesce(private.member_role(p_venue), '') not in ('proprietar', 'manager') then raise exception 'Doar proprietarul sau managerul pun Live Drops.'; end if;
select * into pr from public.partners where venue_id = p_venue for update;
if pr.status <> 'activ' then raise exception 'Live Drops merg doar cu parteneriatul activ.'; end if;
if s < now() - interval '5 minutes' or s > now() + interval '7 days' then raise exception 'Începutul trebuie să fie acum sau în următoarele 7 zile.'; end if;
if p_minutes not between 30 and 240 then raise exception 'Un Live Drop ține între 30 de minute și 4 ore.'; end if;
if pr.plus_pct is not null and p_pct_plus < pr.plus_pct then raise exception 'Pentru Plus pune cel puțin reducerea ta Plus obișnuită (% la sută).', pr.plus_pct; end if;
if private.plain(p_title) ~ '(tutun|narghil|shisha|sisha|hookah|vape|vapat|tigar|tigari|iqos|glo)' then raise exception 'Fără tutun, narghilea sau vape în Live Drops.'; end if;
if exists (select 1 from public.drops where venue_id = p_venue and stopped_at is null
and tstzrange(starts_at, ends_at) && tstzrange(s, s + make_interval(mins => p_minutes))) then
raise exception 'Ai deja un Live Drop în intervalul ăsta.'; end if;
insert into public.drops (venue_id, title, pct_all, pct_plus, seats, min_group, starts_at, ends_at, adult, new_only, created_by)
values (p_venue, trim(p_title), p_pct_all, p_pct_plus, p_seats, greatest(1, p_min_group), s, s + make_interval(mins => p_minutes),
coalesce(p_adult, true) or private.plain(p_title) ~ '(cocktail|coctail|bere|beri|vin|shot|alcool|prosecco|spritz|whisk|vodka|votca|gin|rom|bar|tequila|lichior|palinc|tuica|aperol|happy hour|halba|pahar)',
p_new_only, auth.uid())
returning * into d;
return d;
end $function$
;

CREATE OR REPLACE FUNCTION public.biz_settings_save(p_venue text, p_reservations_on boolean, p_auto_confirm_max integer, p_plus_pct integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
if coalesce(private.member_role(p_venue), '') not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
update public.partners set reservations_on = p_reservations_on, auto_confirm_max = greatest(0, least(20, p_auto_confirm_max)), plus_pct = p_plus_pct
where venue_id = p_venue;
end $function$
;

CREATE OR REPLACE FUNCTION public.reservation_request(p_venue text, p_at timestamp with time zone, p_people integer, p_kids integer DEFAULT 0, p_note text DEFAULT NULL::text)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); pr public.partners; r public.reservations;
begin
  if me is null then raise exception 'Intră în cont ca să rezervi.'; end if;
  select * into pr from public.partners where venue_id = p_venue;
  if pr.venue_id is null or pr.status <> 'activ' or not pr.reservations_on then raise exception 'Localul nu primește acum rezervări prin CeFaci.'; end if;
  if p_at < now() + interval '15 minutes' or p_at > now() + interval '30 days' then raise exception 'Alege o oră de peste cel puțin 15 minute, în următoarele 30 de zile.'; end if;
  if p_people not between 1 and 20 or coalesce(p_kids, 0) not between 0 and 10 then raise exception 'Numărul de oameni nu e bun.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.res.' || me::text));   -- două cereri trimise deodată nu ocolesc limita
  if (select count(*) from public.reservations where user_id = me and created_at > now() - interval '1 day') >= 4 then
    raise exception 'Ai făcut destule rezervări azi. Mâine mai poți.'; end if;
  if (select count(*) from public.reservations where user_id = me and at > now() and status in ('cerută', 'confirmată')) >= 2 then
    raise exception 'Ai deja 2 rezervări care urmează. Anulează una ca să faci alta.'; end if;
  insert into public.reservations (venue_id, user_id, people, kids, at, note, status)
  values (p_venue, me, p_people, coalesce(p_kids, 0), p_at, nullif(trim(p_note), ''),
          -- confirmată singură doar pentru conturi cunoscute (de cel puțin 7 zile sau cu o vizită adevărată): conturile noi,
          -- făcute pe bandă, nu pot ocupa mesele fără ca localul să vadă cererea
          case when p_people + coalesce(p_kids, 0) <= pr.auto_confirm_max and p_people < 8
                    and ((select created_at from auth.users where id = me) < now() - interval '7 days'
                         or exists (select 1 from public.visits where user_id = me and outcome = 'a venit'))
               then 'confirmată' else 'cerută' end)
  returning * into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.reservation_cancel(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
update public.reservations set status = 'anulată'
where id = p_id and user_id = auth.uid() and status in ('cerută', 'confirmată')
and not exists (select 1 from public.visits where reservation_id = p_id);
if not found then raise exception 'Rezervarea nu mai poate fi anulată.'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.visit_scan(p_token text, p_lat double precision, p_lon double precision, p_table text DEFAULT NULL::text, p_people integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); v text; pr public.partners; today date := private.work_day(now());
        x public.visits; r public.reservations; c public.drop_claims; d public.drops; plus boolean; vname text; pos public.venues;
begin
  if me is null then raise exception 'Intră în cont ca să scanezi.'; end if;
  select venue_id into v from public.venue_codes where token = trim(p_token);
  if v is null then raise exception 'Codul nu e al unui local CeFaci.'; end if;
  select * into pos from public.venues where id = v;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 or pos.id is null or private.km(p_lat, p_lon, pos.lat, pos.lon) > 0.3 then
    raise exception 'Scanează codul când ești la local (pornește locația).'; end if;
  select * into pr from public.partners where venue_id = v;
  if pr.status = 'iesit' then raise exception 'Localul nu mai e partener CeFaci.'; end if;
  if p_people is not null and p_people not between 1 and 30 then raise exception 'Numărul de oameni nu e bun.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.scan.' || me::text || v));
  plus := private.plus_active(me);
  select * into x from public.visits where user_id = me and venue_id = v and work_day = today;
  if x.id is null then
    select * into r from public.reservations where user_id = me and venue_id = v and status = 'confirmată'
      and now() between at - interval '90 minutes' and at + interval '3 hours' order by at limit 1;
    if r.id is null then
      select c2.* into c from public.drop_claims c2 join public.drops d2 on d2.id = c2.drop_id
      where c2.user_id = me and d2.venue_id = v and c2.status = 'activ' and c2.expires_at > now() limit 1 for update of c2;
    end if;
    if c.id is not null then
      select * into d from public.drops where id = c.drop_id;
      if now() < c.created_at + interval '10 minutes' then raise exception 'Oferta se poate folosi după cel puțin 10 minute de la luare.'; end if;
      if coalesce(p_people, c.seats) < d.min_group then
        raise exception 'Grupul nu îndeplinește oferta. Revino când sunteți suficienți.';
      else
        update public.drop_claims set status = 'folosit', seats = least(seats, coalesce(p_people, seats)) where id = c.id returning * into c;
      end if;
    end if;
    insert into public.visits (venue_id, user_id, kind, reservation_id, claim_id, people, table_no, discount_pct, plus, work_day)
    values (v, me,
            case when r.id is not null then 'rezervare' when c.id is not null then 'drop' when plus and pr.plus_pct is not null then 'plus' else 'plan' end,
            r.id, c.id,
            greatest(1, least(30, coalesce(p_people, r.people, c.seats, 1))), nullif(trim(p_table), ''),
            case when c.id is not null then floor((case when plus then d.pct_plus else d.pct_all end) * least(c.seats, coalesce(p_people, c.seats))::numeric / coalesce(p_people, c.seats))::int
                 when plus and pr.plus_pct is not null then pr.plus_pct else 0 end,
            plus, today)
    returning * into x;
  elsif (p_table is not null or p_people is not null) and x.closed_at is null then
    if x.claim_id is not null then
      select * into c from public.drop_claims where id = x.claim_id;
      select * into d from public.drops where id = c.drop_id;
      if coalesce(p_people, x.people) < d.min_group then raise exception 'Grupul nu îndeplinește oferta.'; end if;
    end if;
    update public.visits set table_no = coalesce(nullif(trim(p_table), ''), table_no), people = greatest(1, least(30, coalesce(p_people, people))),
      discount_pct = case when x.claim_id is not null then floor((case when x.plus then d.pct_plus else d.pct_all end) * least(c.seats, coalesce(p_people, x.people))::numeric / coalesce(p_people, x.people))::int else discount_pct end
    where id = x.id returning * into x;
  end if;
  select coalesce(edit->>'name', name) into vname from public.venues where id = v;
  return jsonb_build_object('visit', x.id, 'venue', v, 'name', vname, 'word', private.day_word(v, today), 'kind', x.kind,
    'discount', x.discount_pct, 'plus', x.plus, 'people', x.people, 'table', x.table_no,
    'offer', case when x.kind = 'drop' then (select title from public.drops where id = (select drop_id from public.drop_claims where id = x.claim_id)) end);
end $function$
;

CREATE OR REPLACE FUNCTION public.reservation_decide(p_id uuid, p_ok boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v text;
begin
select venue_id into v from public.reservations where id = p_id for update;
if coalesce(private.member_role(v), '') not in ('proprietar', 'manager', 'receptie') then raise exception 'Nu ai voie să confirmi rezervări.'; end if;
update public.reservations set status = case when p_ok then 'confirmată' else 'refuzată' end, decided_by = auth.uid(), decided_at = now()
where id = p_id and status = 'cerută' and at > now();
if not found then raise exception 'Cererea nu mai așteaptă răspuns.'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.visit_close(p_visit uuid, p_came boolean, p_bill numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x public.visits;
begin
select * into x from public.visits where id = p_visit for update;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_partners()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m0 date := date_trunc('month', (now() at time zone 'Europe/Bucharest')::date)::date;
begin
  if not private.can('partners.read') then raise exception 'Nu ai voie.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'venue_id', p.venue_id, 'name', coalesce(v.edit->>'name', v.name), 'firm', p.firm, 'cui', p.cui, 'founder', p.founder, 'rate', null, 'price_tier', p.price_tier, 'pricing', 'per-person-v1',
      'status', p.status, 'activated_at', p.activated_at, 'free_until', p.free_until,
      'team', (select jsonb_agg(jsonb_build_object('username', pr.username, 'role', m.role)) from public.partner_members m join public.profiles pr on pr.id = m.user_id where m.venue_id = p.venue_id and m.active),
      'month', case when private.can('partners') or private.can('money') then (select jsonb_build_object('estimate',true,'billing_ready',false,'bills', coalesce(sum(f.bill), 0), 'fee', coalesce(sum(f.fee) filter (where not f.free), 0), 'would_pay', coalesce(sum(f.fee) filter (where f.free), 0), 'visits', count(*))
                from private.visit_fees(p.venue_id, m0, (m0 + interval '1 month' - interval '1 day')::date) f) end,
      -- de verificat: nota scrisă de local mult sub bon; mese scanate trecute „n-a venit”; seri neînchise
      'flags', (select count(*) from public.visits x join public.receipts r on r.visit_id = x.id where x.venue_id = p.venue_id and x.declared is not null and x.declared < r.total * 0.9 and x.work_day >= m0),
      'noshow', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'n-a venit' and x.work_day >= m0),
      'unclosed', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'deschis' and x.bill is null and x.work_day < private.work_day(now()) - 1)
    ) order by p.created_at) from public.partners p left join public.venues v on v.id = p.venue_id), '[]');
end $function$
;

CREATE OR REPLACE FUNCTION public.visit_receipt(p_user uuid, p_visit uuid, p_cui text, p_total numeric, p_discount numeric, p_issued timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x public.visits; pr public.partners; n int; days int; got boolean := false;
begin
if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
and session_user not in ('postgres', 'supabase_admin') then raise exception 'Doar serverul.' using errcode = '42501'; end if;
select * into x from public.visits where id = p_visit and user_id = p_user;
if x.id is null then return jsonb_build_object('ok', false, 'error', 'Nu găsesc vizita.'); end if;
select * into pr from public.partners where venue_id = x.venue_id;
if regexp_replace(coalesce(p_cui, ''), '\D', '', 'g') <> pr.cui then return jsonb_build_object('ok', false, 'error', 'Bonul nu e de la localul ăsta.'); end if;
if p_issued is null then return jsonb_build_object('ok', false, 'error', 'Nu se vede data și ora pe bon.'); end if;
if private.work_day(p_issued) not between x.work_day and x.work_day + 1 then
return jsonb_build_object('ok', false, 'error', 'Bonul e din altă zi.'); end if;
if exists (select 1 from public.receipts where visit_id = x.id) then return jsonb_build_object('ok', false, 'error', 'Bonul vizitei e deja pus.'); end if;
if exists (select 1 from public.receipts where venue_id = x.venue_id and total = p_total and issued_at = p_issued) then
return jsonb_build_object('ok', false, 'error', 'Bonul ăsta e deja pus.'); end if;
select count(*) into n from public.receipts where user_id = p_user and created_at >= date_trunc('month', now());
select count(*) into days from public.receipts where user_id = p_user and plus_day and created_at >= date_trunc('month', now());
if (n + 1) % 2 = 0 and days < 4 then
got := true;
perform set_config('cefaci.plus', 'on', true);
update public.profile_private set plus_until = greatest(coalesce(plus_until, now()), now()) + interval '1 day' where id = p_user;
perform set_config('cefaci.plus', 'off', true);
end if;
insert into public.receipts (visit_id, venue_id, user_id, total, discount, issued_at, plus_day)
values (x.id, x.venue_id, p_user, p_total, p_discount, p_issued, got);
update public.visits set bill = p_total, bill_source = 'bon', outcome = 'a venit' where id = x.id;
return jsonb_build_object('ok', true, 'bill', p_total, 'plus_day', got, 'receipts_this_month', n + 1);
end $function$
;

CREATE OR REPLACE FUNCTION public.biz_today(p_venue text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare role text := private.member_role(p_venue); today date := private.work_day(now());
begin
  if role is null then raise exception 'Nu ești în echipa localului.'; end if;
  return jsonb_build_object(
    'role', role, 'day', today, 'word', private.day_word(p_venue, today),
    'token', case when role in ('proprietar', 'manager') then (select token from public.venue_codes where venue_id = p_venue) end,
    'partner', (select jsonb_build_object('venue_id',p.venue_id,'status',p.status,'reservations_on',p.reservations_on,'auto_confirm_max',p.auto_confirm_max,'plus_pct',p.plus_pct)
      || case when role = 'proprietar' then jsonb_build_object('firm',p.firm,'cui',p.cui) else '{}'::jsonb end
      || case when role in ('proprietar','manager') then jsonb_build_object('founder',p.founder,'price_tier',p.price_tier,'pricing','per-person-v1','free_until',p.free_until) else '{}'::jsonb end from public.partners p where venue_id = p_venue),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', pr.first_name, 'people', r.people, 'kids', r.kids, 'at', r.at, 'status', r.status, 'note', r.note) order by r.at)
       from public.reservations r left join public.profiles pr on pr.id = r.user_id
       where role <> 'scanare' and r.venue_id = p_venue and r.at > now() - interval '3 hours' and r.at < now() + interval '30 days' and r.status in ('cerută', 'confirmată')), '[]'),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', pr.first_name, 'kind', x.kind, 'people', x.people, 'table', x.table_no,
         'discount', x.discount_pct, 'plus', x.plus, 'at', x.scanned_at, 'outcome', x.outcome, 'bill', case when role in ('proprietar','manager') then x.bill end, 'source', case when role in ('proprietar','manager') then x.bill_source end, 'day', x.work_day) order by x.scanned_at)
       from public.visits x left join public.profiles pr on pr.id = x.user_id
       where x.venue_id = p_venue and x.work_day between today - 1 and today), '[]'),
    'noshow', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', pr.first_name, 'people', r.people, 'at', r.at))
       from public.reservations r left join public.profiles pr on pr.id = r.user_id
       where role <> 'scanare' and r.venue_id = p_venue and r.status = 'confirmată' and r.at between now() - interval '30 hours' and now() - interval '3 hours'
         and not exists (select 1 from public.visits x where x.reservation_id = r.id)), '[]'),
    'drops', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'pct_all', d.pct_all, 'pct_plus', d.pct_plus, 'seats', d.seats,
         'taken', (select coalesce(sum(seats), 0) from public.drop_claims c where c.drop_id = d.id and (c.status = 'folosit' or (c.status = 'activ' and c.expires_at > now()))),
         'starts_at', d.starts_at, 'ends_at', d.ends_at, 'adult', d.adult, 'new_only', d.new_only) order by d.starts_at)
       from public.drops d where role in ('proprietar','manager') and d.venue_id = p_venue and d.stopped_at is null and d.ends_at > now()), '[]')
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.drop_claim(p_drop uuid, p_seats integer)
 RETURNS drop_claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := auth.uid(); d public.drops; taken int; c public.drop_claims; plus boolean := private.plus_active(me);
begin
  if me is null then raise exception 'Intră în cont ca să iei oferta.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.claim.' || me::text)); -- o singură ofertă odată, chiar trimisă deodată
  if (select count(*) from public.drop_claims c2 where c2.user_id = me and c2.status = 'activ' and c2.expires_at < now()
        and c2.created_at > now() - interval '7 days') >= 2 then
    raise exception 'Ai lăsat 2 oferte să expire săptămâna asta. Mai poți lua peste câteva zile.'; end if;
  select * into d from public.drops where id = p_drop for update;   -- un singur om ia ultimele locuri
  if d.id is null or d.stopped_at is not null or now() >= d.ends_at - interval '15 minutes' then raise exception 'Oferta s-a terminat.'; end if;
  if now() < d.starts_at - (case when plus then interval '10 minutes' else interval '0' end) then raise exception 'Oferta nu a început încă.'; end if;
  if now() < d.starts_at + interval '10 minutes' and d.starts_at > d.created_at + interval '1 minute' and not plus then
    raise exception 'Primele 10 minute oferta e doar pentru Plus.'; end if;
  if (select status from public.partners where venue_id = d.venue_id) <> 'activ' then raise exception 'Localul nu are oferte acum.'; end if;
  if exists (select 1 from public.partner_members where venue_id = d.venue_id and user_id = me and active) then raise exception 'Echipa localului nu poate lua propriile oferte.'; end if;
  if p_seats is null or p_seats not between greatest(1, d.min_group) and 6 then raise exception 'Oferta e pentru cel puțin % și cel mult 6 oameni.', greatest(1, d.min_group); end if;
  if d.adult and coalesce(private.age(me), 0) < 18 then raise exception 'Oferta e doar de la 18 ani.'; end if;
  if exists (select 1 from public.drop_claims c2 join public.drops d2 on d2.id = c2.drop_id
             where c2.user_id = me and c2.status = 'activ' and c2.expires_at > now()) then raise exception 'Ai deja o ofertă luată. Folosește-o sau las-o să expire.'; end if;
  if exists (select 1 from public.visits where user_id = me and venue_id = d.venue_id and work_day = private.work_day(now())) then
    raise exception 'Ești deja la local azi: oferta e pentru cei care vin.'; end if;
  if d.new_only and exists (select 1 from public.visits where user_id = me and venue_id = d.venue_id and scanned_at > now() - interval '12 months') then
    raise exception 'Oferta e doar pentru cei care vin prima dată prin CeFaci.'; end if;
  select coalesce(sum(seats), 0) into taken from public.drop_claims
  where drop_id = p_drop and (status = 'folosit' or (status = 'activ' and expires_at > now()));
  if taken + p_seats > d.seats then raise exception 'Mai sunt doar % locuri.', greatest(0, d.seats - taken); end if;
  insert into public.drop_claims (drop_id, user_id, seats, expires_at)
  values (p_drop, me, p_seats, least(now() + interval '45 minutes', d.ends_at + interval '15 minutes'))
  returning * into c;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION private.price_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.partners; n int; amount numeric := 0;
begin
  select * into p from public.partners where venue_id = new.venue_id;
  if new.kind = 'rezervare' then
    select people into n from public.reservations where id = new.reservation_id;
    amount := (array[2,5,8])[p.price_tier];
  elsif new.kind = 'drop' then
    select seats into n from public.drop_claims where id = new.claim_id;
    amount := (array[3,7,10])[p.price_tier];
  end if;
  if exists(select 1 from public.partner_members where venue_id=new.venue_id and user_id=new.user_id and active) then n := 0; end if;
  if p.founder and amount > 0 then amount := amount - 1; end if;
  insert into private.visit_pricing(visit_id,tier,founder,unit_fee,free,eligible_limit,firm,cui)
  values(new.id,p.price_tier,p.founder,coalesce(amount,0),new.work_day < p.free_until,
    least(10,coalesce(n,0)),p.firm,p.cui);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.biz_visit_attendance(p_visit uuid, p_adults integer, p_discounted integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x public.visits;
begin
  select * into x from public.visits where id = p_visit for update;
  if x.id is null or coalesce(private.member_role(x.venue_id),'') not in ('proprietar','manager','receptie') then raise exception 'Nu ai voie.'; end if;
  if p_adults is null or p_adults not between 0 and x.people
     or coalesce(p_discounted,p_adults) not between 0 and p_adults then raise exception 'Numărul de oameni nu e bun.'; end if;
  if now() > ((x.work_day + 1)::timestamp + time '12:00') at time zone 'Europe/Bucharest' then raise exception 'Seara asta s-a închis.'; end if;
  if x.outcome <> 'a venit' then raise exception 'Confirmă întâi sosirea.'; end if;
  insert into private.visit_attendance(visit_id,adults,discounted,confirmed_by)
  values(x.id,p_adults,coalesce(p_discounted,p_adults),auth.uid())
  on conflict(visit_id) do update set adults=excluded.adults,discounted=excluded.discounted,
    confirmed_by=excluded.confirmed_by,confirmed_at=now();
end $function$
;

CREATE OR REPLACE FUNCTION public.biz_month(p_venue text, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m0 date := date_trunc('month', coalesce(p_month, (now() at time zone 'Europe/Bucharest')::date))::date; m1 date;
begin
  if coalesce(private.member_role(p_venue), '') not in ('proprietar', 'manager') and not private.can('money') then raise exception 'Nu ai voie.'; end if;
  m1 := (m0 + interval '1 month' - interval '1 day')::date;
  return (select jsonb_build_object(
    'month', m0, 'estimate', true, 'billing_ready', false,
    'blocked', (select count(*) from public.visits x left join private.visit_pricing s on s.visit_id=x.id left join private.visit_attendance a on a.visit_id=x.id
      where x.venue_id=p_venue and x.work_day between m0 and m1 and x.kind in ('rezervare','drop') and x.outcome <> 'n-a venit'
      and (s.tier is null or a.visit_id is null or x.closed_at is null)),
    'visits', (select count(*) from public.visits where venue_id = p_venue and work_day between m0 and m1 and outcome <> 'n-a venit'),
    'people', (select coalesce(sum(people), 0) from public.visits where venue_id = p_venue and work_day between m0 and m1 and outcome <> 'n-a venit'),
    'bills', coalesce(sum(f.bill), 0),
    'fee', coalesce(sum(f.fee) filter (where not f.free), 0),
    'would_pay', coalesce(sum(f.fee) filter (where f.free), 0),
    'lines', coalesce(jsonb_agg(jsonb_build_object('day', f.work_day, 'kind', f.kind, 'bill', f.bill, 'source', f.bill_source, 'fee', f.fee, 'free', f.free) order by f.work_day) filter (where f.visit_id is not null), '[]'))
  from private.visit_fees(p_venue, m0, m1) f);
end $function$
;