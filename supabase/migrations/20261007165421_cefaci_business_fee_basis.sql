-- Fee foundation, not invoicing. Unknown tier or unconfirmed headcount => no charge.
-- The legacy bill-percentage calculation is retired; customer bills remain receipt evidence only.
alter table public.partners add column price_tier smallint check (price_tier between 1 and 3);
create table private.visit_pricing (
  visit_id uuid primary key references public.visits(id) on delete cascade,
  version text not null default 'per-person-v1',
  tier smallint check (tier between 1 and 3),
  founder boolean not null,
  unit_fee numeric not null check (unit_fee >= 0),
  free boolean not null,
  eligible_limit int not null check (eligible_limit between 0 and 10),
  firm text not null,
  cui text not null,
  created_at timestamptz not null default now()
);
create table private.visit_attendance (
  visit_id uuid primary key references public.visits(id) on delete cascade,
  adults int not null check (adults between 0 and 30),
  discounted int not null check (discounted between 0 and adults),
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now()
);
alter table private.visit_pricing enable row level security;
alter table private.visit_attendance enable row level security;
revoke all on private.visit_pricing, private.visit_attendance from public, anon, authenticated;

create or replace function private.price_visit() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
create trigger price_visit after insert on public.visits for each row execute function private.price_visit();
revoke all on function private.price_visit() from public, anon, authenticated;

-- Initial contracted tier only. Later revisions require the future versioned contract workflow.
create or replace function public.admin_partner_tier_set(p_venue text, p_tier int) returns void
language plpgsql security definer set search_path = '' as $$
declare old_tier int;
begin
  if auth.uid() is null or not private.can('money') then raise exception 'Nu ai voie.'; end if;
  if p_tier is null or p_tier not between 1 and 3 then raise exception 'Treapta nu e bună.'; end if;
  select price_tier into old_tier from public.partners where venue_id = p_venue for update;
  if not found then raise exception 'Localul nu există.'; end if;
  if old_tier is not null and old_tier <> p_tier then raise exception 'Schimbarea treptei cere o versiune nouă de contract.'; end if;
  insert into public.venue_log(venue_id,by_user,action,before,after)
  values(p_venue,auth.uid(),'partener',jsonb_build_object('price_tier',old_tier),jsonb_build_object('price_tier',p_tier));
  update public.partners set price_tier = p_tier where venue_id = p_venue;
end $$;
revoke all on function public.admin_partner_tier_set(text,int) from public,anon,authenticated;
grant execute on function public.admin_partner_tier_set(text,int) to authenticated;

-- Existing visit_close remains backward-compatible, but cannot imply a billable headcount.
-- The Business UI must call this explicit headcount confirmation when closing an evening.
create or replace function public.biz_visit_attendance(p_visit uuid, p_adults int, p_discounted int default null) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function public.biz_visit_attendance(uuid,int,int) from public,anon,authenticated;
grant execute on function public.biz_visit_attendance(uuid,int,int) to authenticated;

create or replace function private.visit_fees(v text,d0 date,d1 date)
returns table(visit_id uuid,work_day date,kind text,bill numeric,bill_source text,fee numeric,free boolean)
language sql stable security definer set search_path = '' as $$
  select x.id,x.work_day,x.kind,x.bill,x.bill_source,
    s.unit_fee * least(s.eligible_limit, a.adults, case when x.kind='drop' then a.discounted else a.adults end),s.free
  from public.visits x join private.visit_pricing s on s.visit_id=x.id
  join private.visit_attendance a on a.visit_id=x.id
  where x.venue_id=v and x.work_day between d0 and d1 and x.kind in ('rezervare','drop')
    and s.tier is not null and x.outcome='a venit' and x.closed_at is not null
$$;
-- No historical backfill: legacy visits lack contracted tier/headcount evidence and must be reviewed before billing.
create or replace function public.biz_month(p_venue text, p_month date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
end $$;
create or replace function public.biz_today(p_venue text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
end $$;
create or replace function public.biz_my_venues() returns table (venue_id text, name text, role text, status text, founder boolean, rate numeric, free_until date)
language sql stable security definer set search_path = '' as $$
  select m.venue_id, coalesce(v.edit->>'name', v.name), m.role, p.status, case when m.role in ('proprietar','manager') then p.founder end, null::numeric, case when m.role in ('proprietar','manager') then p.free_until end
  from public.partner_members m join public.partners p on p.venue_id = m.venue_id left join public.venues v on v.id = m.venue_id
  where m.user_id = (select auth.uid()) and m.active order by 2
$$;

create or replace function public.admin_partners() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
end $$;
notify pgrst,'reload schema';
