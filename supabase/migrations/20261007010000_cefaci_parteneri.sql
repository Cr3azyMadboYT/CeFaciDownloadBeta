-- Partenerii (decizie Cornel, 06.10: „Gata, așa rămâne”): localul plătește 10% din nota meselor aduse prin
-- rezervare CeFaci sau Live Drop (fondatorii 8%), cel mult 100 lei pe masă, doar după lunile gratuite; nota vine din
-- poza bonului pusă de client, altfel din „Închide seara”. Vizitele din planuri și cele doar cu Plus: 0 lei.
-- Același om: cel mult 3 vizite cu comision pe an la același local. La fiecare 2 bonuri de la parteneri: o zi de Plus
-- (cel mult 4 pe lună). Logica pe larg: docs/logica-business-admin.md.
--
-- Trei feluri de oameni scriu aici, toți doar prin funcții:
--   clientul (aplicația): rezervă, ia o ofertă, scanează codul de la bar, pune bonul (prin funcția citeste-bon);
--   echipa localului (CeFaci Business): confirmă rezervări, pune Live Drops, închide seara;
--   echipa CeFaci (Admin): face partenerii, fondatorii, echipa localului.

-- ---------- ajutoare ----------
-- ziua de lucru se schimbă la 05:00, ora României (o vizită la 01:30 ține de seara dinainte)
create or replace function private.work_day(t timestamptz) returns date
language sql immutable set search_path = '' as $$
  select ((t at time zone 'Europe/Bucharest') - interval '5 hours')::date
$$;



-- ---------- partenerii ----------
create table public.partners (
  venue_id text primary key check (char_length(venue_id) <= 80),
  firm text not null check (char_length(firm) between 2 and 120),
  cui text not null check (cui ~ '^[0-9]{2,10}$'),
  founder boolean not null default false,
  rate numeric(4, 3) not null check (rate in (0.08, 0.10)),
  status text not null default 'activ' check (status in ('activ', 'pauza', 'iesit')),
  activated_at date not null,
  free_until date not null,                       -- exclusiv: de la ziua asta se plătește
  reservations_on boolean not null default true,
  auto_confirm_max int not null default 6 check (auto_confirm_max between 0 and 20),
  plus_pct int check (plus_pct in (10, 15, 20)),  -- reducerea Plus a localului (opțional)
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
-- ce e public la un partener (aplicația arată „Rezervă prin CeFaci”, „−15% cu Plus”): doar aceste coloane, nu firma,
-- CUI-ul, procentul sau lunile gratuite (07.10)
create policy partners_read on public.partners for select to authenticated using (true);
revoke all on public.partners from anon, authenticated;
grant select (venue_id, status, reservations_on, plus_pct) on public.partners to authenticated;

create table public.partner_members (
  venue_id text not null references public.partners (venue_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('proprietar', 'manager', 'receptie', 'scanare')),
  active boolean not null default true,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);
alter table public.partner_members enable row level security;
create policy partner_members_own on public.partner_members for select to authenticated using (user_id = (select auth.uid()));

create table public.venue_codes (
  venue_id text primary key references public.partners (venue_id) on delete cascade,
  token text not null unique check (char_length(token) between 8 and 40),
  created_at timestamptz not null default now()
);
alter table public.venue_codes enable row level security; -- codul îl citesc doar funcțiile și echipa localului (prin biz_today)

-- „Cuvântul serii”: două cuvinte noi în fiecare zi pentru fiecare local; clientul le vede doar după o scanare adevărată.
-- Pornesc din codul secret al localului (venue_codes), nu din date publice: nu se pot calcula de acasă (07.10).
create or replace function private.day_word(v text, d date) returns text
language sql stable security definer set search_path = '' as $$
  with k as (select coalesce((select token from public.venue_codes where venue_id = v), '') || v as s)
  select (array['Lămâie','Pisică','Cireașă','Chitară','Lună','Stea','Umbrelă','Gutuie','Portocală','Bicicletă','Rachetă',
                'Pălărie','Ciocolată','Căpșună','Balenă','Vioară','Lalea','Comoară','Corabie','Furtună','Ghindă','Brioșă',
                'Busolă','Cometă','Vulpe','Bufniță','Zebră','Caramea','Lanternă','Vacanță'])[1 + ('x' || substr(md5(k.s || d::text), 1, 6))::bit(24)::int % 30]
    || ' ' ||
    (array['albastră','veselă','rapidă','aurie','verde','roșie','mică','uriașă','dulce','cuminte','zburdalnică','fermecată',
           'curajoasă','somnoroasă','pufoasă','rotundă','sclipitoare','grăbită','liniștită','năzdrăvană','violetă',
           'portocalie','argintie','vrăjită','fericită','zâmbitoare','misterioasă','jucăușă','strălucitoare','norocoasă'])[1 + ('x' || substr(md5(d::text || k.s), 1, 6))::bit(24)::int % 30]
  from k
$$;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.partners (venue_id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  people int not null check (people between 1 and 20),
  kids int not null default 0 check (kids between 0 and 10),
  at timestamptz not null,
  status text not null default 'cerută' check (status in ('cerută', 'confirmată', 'refuzată', 'anulată')),
  note text check (char_length(note) <= 200),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index reservations_venue_at on public.reservations (venue_id, at);
create index reservations_user on public.reservations (user_id, at);
alter table public.reservations enable row level security;
create policy reservations_own on public.reservations for select to authenticated using (user_id = (select auth.uid()));

create table public.drops (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.partners (venue_id) on delete cascade,
  title text not null check (char_length(title) between 3 and 60),
  pct_all int not null check (pct_all between 10 and 15),
  pct_plus int not null,
  seats int not null check (seats between 4 and 40),
  min_group int not null default 1 check (min_group between 1 and 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  stopped_at timestamptz,
  adult boolean not null default false,          -- pomenește alcool: doar 18+, nu pentru o gașcă cu un minor
  new_only boolean not null default false,       -- doar „noi prin CeFaci” (fără vizită acolo în 12 luni)
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint drops_plus check (pct_plus between pct_all + 5 and 30),
  constraint drops_len check (ends_at > starts_at and ends_at <= starts_at + interval '4 hours')
);
create index drops_venue on public.drops (venue_id, starts_at);
alter table public.drops enable row level security;
-- drop-urile care țin acum sau încep în următoarele ore se văd în aplicație
create policy drops_read on public.drops for select to authenticated
  using (stopped_at is null and ends_at > now() and starts_at < now() + interval '12 hours');

create table public.drop_claims (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  seats int not null check (seats between 1 and 6),
  status text not null default 'activ' check (status in ('activ', 'folosit', 'anulat')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index drop_claims_drop on public.drop_claims (drop_id);
create index drop_claims_user on public.drop_claims (user_id, created_at desc);
alter table public.drop_claims enable row level security;
create policy drop_claims_own on public.drop_claims for select to authenticated using (user_id = (select auth.uid()));

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.partners (venue_id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('rezervare', 'drop', 'plus', 'plan')),
  reservation_id uuid unique references public.reservations (id) on delete set null,
  claim_id uuid unique references public.drop_claims (id) on delete set null,
  people int not null default 1 check (people between 1 and 30),
  table_no text check (char_length(table_no) <= 8),
  discount_pct int not null default 0 check (discount_pct between 0 and 30),
  plus boolean not null default false,
  scanned_at timestamptz not null default now(),
  work_day date not null,
  outcome text not null default 'deschis' check (outcome in ('deschis', 'a venit', 'n-a venit')),
  bill numeric(10, 2) check (bill >= 0 and bill < 100000),
  bill_source text check (bill_source in ('bon', 'local')),
  declared numeric(10, 2) check (declared >= 0 and declared < 100000), -- ce a scris localul (rămâne și când bate bonul)
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz
);
create unique index visits_one_a_day on public.visits (user_id, venue_id, work_day);
create index visits_venue_day on public.visits (venue_id, work_day);
alter table public.visits enable row level security;
create policy visits_own on public.visits for select to authenticated using (user_id = (select auth.uid()));

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  venue_id text not null,
  user_id uuid references public.profiles (id) on delete set null,
  total numeric(10, 2) not null check (total > 0 and total < 100000),
  discount numeric(10, 2) check (discount >= 0),
  issued_at timestamptz,
  plus_day boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index receipts_once on public.receipts (venue_id, total, issued_at) where issued_at is not null;
create unique index receipts_one_per_visit on public.receipts (visit_id);
alter table public.receipts enable row level security;
create policy receipts_own on public.receipts for select to authenticated using (user_id = (select auth.uid()));

-- o zi de Plus câștigată cu bonuri: doar serverul o schimbă
alter table public.profile_private add column if not exists plus_until timestamptz;
create or replace function private.profile_private_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.birth_date := old.birth_date;
  new.plus_trial_started_at := coalesce(old.plus_trial_started_at, new.plus_trial_started_at);
  if coalesce(current_setting('cefaci.plus', true), '') <> 'on' then new.plus_until := old.plus_until; end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function private.plus_active(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (p.plus_trial_started_at > now() - interval '7 days') or (p.plus_until > now())
                   from public.profile_private p where p.id = u), false)
$$;

create or replace function private.member_role(v text) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.partner_members where venue_id = v and user_id = (select auth.uid()) and active
$$;

-- ---------- banii: comisionul fiecărei vizite (10% / 8% din notă, cel mult 100 lei) ----------
-- se plătește: rezervare sau Live Drop, au venit (localul a confirmat sau clientul a pus bonul), nota știută;
-- același om: doar primele 3 astfel de vizite într-un an la același local; în lunile gratuite: „ai fi plătit”
create or replace function private.visit_fees(v text, d0 date, d1 date)
returns table (visit_id uuid, work_day date, kind text, bill numeric, bill_source text, fee numeric, free boolean)
language sql stable security definer set search_path = '' as $$
  with p as (select * from public.partners where venue_id = v),
  eligible as (
    select x.*, row_number() over (partition by x.user_id order by x.scanned_at) as nth
    from public.visits x
    where x.venue_id = v and x.kind in ('rezervare', 'drop') and x.bill is not null
      and (x.bill_source = 'bon' or x.outcome = 'a venit')   -- bonul clientului bate „n-a venit” pus de local
      and x.work_day > d1 - 366
  )
  select e.id, e.work_day, e.kind, e.bill, e.bill_source,
         case when e.user_id is not null and e.nth > 3 and e.work_day >= d1 - 365 then 0
              else least(100, round(e.bill * p.rate, 2)) end,
         e.work_day < p.free_until
  from eligible e cross join p
  where e.work_day between d0 and d1
$$;

-- ---------- clientul ----------
create or replace function public.reservation_request(p_venue text, p_at timestamptz, p_people int, p_kids int default 0, p_note text default null)
returns public.reservations
language plpgsql security definer set search_path = '' as $$
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
                    and ((select created_at from public.profiles where id = me) < now() - interval '7 days'
                         or exists (select 1 from public.visits where user_id = me and outcome = 'a venit'))
               then 'confirmată' else 'cerută' end)
  returning * into r;
  return r;
end $$;

create or replace function public.reservation_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.reservations set status = 'anulată'
  where id = p_id and user_id = auth.uid() and status in ('cerută', 'confirmată')
    and not exists (select 1 from public.visits where reservation_id = p_id);
  if not found then raise exception 'Rezervarea nu mai poate fi anulată.'; end if;
end $$;

create or replace function public.drop_claim(p_drop uuid, p_seats int) returns public.drop_claims
language plpgsql security definer set search_path = '' as $$
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
  if p_seats not between greatest(1, d.min_group) and 6 then raise exception 'Oferta e pentru cel puțin % și cel mult 6 oameni.', greatest(1, d.min_group); end if;
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
end $$;

-- „Am ajuns”: clientul scanează codul de la bar; o vizită pe zi la un local (scanările repetate o întorc pe aceeași)
-- Codul e lipit la bar, deci se poate fotografia: scanarea cere și poziția telefonului, la cel mult 300 m de local (07.10).
create or replace function public.visit_scan(p_token text, p_lat double precision, p_lon double precision, p_table text default null, p_people int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v text; pr public.partners; today date := private.work_day(now());
        x public.visits; r public.reservations; c public.drop_claims; d public.drops; plus boolean; vname text; pos public.venues;
begin
  if me is null then raise exception 'Intră în cont ca să scanezi.'; end if;
  select venue_id into v from public.venue_codes where token = trim(p_token);
  if v is null then raise exception 'Codul nu e al unui local CeFaci.'; end if;
  select * into pos from public.venues where id = v;
  if p_lat is null or p_lon is null or pos.id is null or private.km(p_lat, p_lon, pos.lat, pos.lon) > 0.3 then
    raise exception 'Scanează codul când ești la local (pornește locația).'; end if;
  select * into pr from public.partners where venue_id = v;
  if pr.status = 'iesit' then raise exception 'Localul nu mai e partener CeFaci.'; end if;
  plus := private.plus_active(me);
  select * into x from public.visits where user_id = me and venue_id = v and work_day = today;
  if x.id is null then
    select * into r from public.reservations where user_id = me and venue_id = v and status = 'confirmată'
      and now() between at - interval '90 minutes' and at + interval '3 hours' order by at limit 1;
    if r.id is null then
      select c2.* into c from public.drop_claims c2 join public.drops d2 on d2.id = c2.drop_id
      where c2.user_id = me and d2.venue_id = v and c2.status = 'activ' and c2.expires_at > now() limit 1;
    end if;
    if c.id is not null then
      select * into d from public.drops where id = c.drop_id;
      update public.drop_claims set status = 'folosit' where id = c.id;
    end if;
    insert into public.visits (venue_id, user_id, kind, reservation_id, claim_id, people, table_no, discount_pct, plus, work_day)
    values (v, me,
            case when r.id is not null then 'rezervare' when c.id is not null then 'drop' when plus and pr.plus_pct is not null then 'plus' else 'plan' end,
            r.id, c.id,
            greatest(1, least(30, coalesce(p_people, r.people, c.seats, 1))), nullif(trim(p_table), ''),
            case when c.id is not null then case when plus then d.pct_plus else d.pct_all end
                 when plus and pr.plus_pct is not null then pr.plus_pct else 0 end,
            plus, today)
    returning * into x;
  elsif p_table is not null or p_people is not null then
    update public.visits set table_no = coalesce(nullif(trim(p_table), ''), table_no), people = greatest(1, least(30, coalesce(p_people, people)))
    where id = x.id returning * into x;
  end if;
  select coalesce(edit->>'name', name) into vname from public.venues where id = v;
  return jsonb_build_object('visit', x.id, 'venue', v, 'name', vname, 'word', private.day_word(v, today), 'kind', x.kind,
    'discount', x.discount_pct, 'plus', x.plus, 'people', x.people, 'table', x.table_no,
    'offer', case when x.kind = 'drop' then (select title from public.drops where id = (select drop_id from public.drop_claims where id = x.claim_id)) end);
end $$;

-- bonul citit de funcția citeste-bon (doar serverul, cu cheia de serviciu): leagă bonul de vizită și pune nota
create or replace function public.visit_receipt(p_user uuid, p_visit uuid, p_cui text, p_total numeric, p_discount numeric, p_issued timestamptz)
returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  -- o zi de Plus la fiecare al doilea bon de la parteneri, cel mult 4 pe lună
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
end $$;

-- ---------- CeFaci Business (echipa localului) ----------
create or replace function public.biz_my_venues() returns table (venue_id text, name text, role text, status text, founder boolean, rate numeric, free_until date)
language sql stable security definer set search_path = '' as $$
  select m.venue_id, coalesce(v.edit->>'name', v.name), m.role, p.status, p.founder, p.rate, p.free_until
  from public.partner_members m join public.partners p on p.venue_id = m.venue_id left join public.venues v on v.id = m.venue_id
  where m.user_id = (select auth.uid()) and m.active order by 2
$$;

create or replace function public.biz_today(p_venue text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text := private.member_role(p_venue); today date := private.work_day(now());
begin
  if role is null then raise exception 'Nu ești în echipa localului.'; end if;
  return jsonb_build_object(
    'role', role, 'day', today, 'word', private.day_word(p_venue, today),
    'token', case when role in ('proprietar', 'manager') then (select token from public.venue_codes where venue_id = p_venue) end,
    'partner', (select to_jsonb(p) - 'created_by' from public.partners p where venue_id = p_venue),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', pr.first_name, 'people', r.people, 'kids', r.kids, 'at', r.at, 'status', r.status, 'note', r.note) order by r.at)
       from public.reservations r left join public.profiles pr on pr.id = r.user_id
       where r.venue_id = p_venue and r.at > now() - interval '3 hours' and r.at < now() + interval '30 days' and r.status in ('cerută', 'confirmată')), '[]'),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', pr.first_name, 'kind', x.kind, 'people', x.people, 'table', x.table_no,
         'discount', x.discount_pct, 'plus', x.plus, 'at', x.scanned_at, 'outcome', x.outcome, 'bill', x.bill, 'source', x.bill_source, 'day', x.work_day) order by x.scanned_at)
       from public.visits x left join public.profiles pr on pr.id = x.user_id
       where x.venue_id = p_venue and x.work_day between today - 1 and today), '[]'),
    'noshow', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', pr.first_name, 'people', r.people, 'at', r.at))
       from public.reservations r left join public.profiles pr on pr.id = r.user_id
       where r.venue_id = p_venue and r.status = 'confirmată' and r.at between now() - interval '30 hours' and now() - interval '3 hours'
         and not exists (select 1 from public.visits x where x.reservation_id = r.id)), '[]'),
    'drops', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'pct_all', d.pct_all, 'pct_plus', d.pct_plus, 'seats', d.seats,
         'taken', (select coalesce(sum(seats), 0) from public.drop_claims c where c.drop_id = d.id and (c.status = 'folosit' or (c.status = 'activ' and c.expires_at > now()))),
         'starts_at', d.starts_at, 'ends_at', d.ends_at, 'adult', d.adult, 'new_only', d.new_only) order by d.starts_at)
       from public.drops d where d.venue_id = p_venue and d.stopped_at is null and d.ends_at > now()), '[]')
  );
end $$;

create or replace function public.reservation_decide(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  select venue_id into v from public.reservations where id = p_id for update;
  if coalesce(private.member_role(v), '') not in ('proprietar', 'manager', 'receptie') then raise exception 'Nu ai voie să confirmi rezervări.'; end if;
  update public.reservations set status = case when p_ok then 'confirmată' else 'refuzată' end, decided_by = auth.uid(), decided_at = now()
  where id = p_id and status = 'cerută' and at > now();
  if not found then raise exception 'Cererea nu mai așteaptă răspuns.'; end if;
end $$;

create or replace function public.drop_create(p_venue text, p_title text, p_pct_all int, p_pct_plus int, p_seats int, p_minutes int,
  p_starts timestamptz default null, p_min_group int default 1, p_adult boolean default true, p_new_only boolean default false) returns public.drops
language plpgsql security definer set search_path = '' as $$
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
end $$;

create or replace function public.drop_stop(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  select venue_id into v from public.drops where id = p_id;
  if coalesce(private.member_role(v), '') not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
  update public.drops set stopped_at = now() where id = p_id and stopped_at is null; -- cine a luat-o deja rămâne cu ea
end $$;

-- textul fără diacritice și fără cifre puse în loc de litere (c0cktail, b3re), pentru filtrele de mai sus
create or replace function private.plain(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(t, '')), 'ăâîșşțţ0134578@$', 'aaisstto1eastbas'), '\s+', ' ', 'g')
$$;

-- „Închide seara”: localul confirmă fiecare masă CeFaci și scrie nota (bonul clientului bate ce scrie localul)
create or replace function public.visit_close(p_visit uuid, p_came boolean, p_bill numeric default null) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- luna: ce s-a adus și cât se plătește (sau „ai fi plătit” în lunile gratuite)
create or replace function public.biz_month(p_venue text, p_month date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m0 date := date_trunc('month', coalesce(p_month, (now() at time zone 'Europe/Bucharest')::date))::date; m1 date;
begin
  if coalesce(private.member_role(p_venue), '') not in ('proprietar', 'manager') and not private.can('money') then raise exception 'Nu ai voie.'; end if;
  m1 := (m0 + interval '1 month' - interval '1 day')::date;
  return (select jsonb_build_object(
    'month', m0,
    'visits', (select count(*) from public.visits where venue_id = p_venue and work_day between m0 and m1 and outcome <> 'n-a venit'),
    'people', (select coalesce(sum(people), 0) from public.visits where venue_id = p_venue and work_day between m0 and m1 and outcome <> 'n-a venit'),
    'bills', coalesce(sum(f.bill), 0),
    'fee', coalesce(sum(f.fee) filter (where not f.free), 0),
    'would_pay', coalesce(sum(f.fee) filter (where f.free), 0),
    'lines', coalesce(jsonb_agg(jsonb_build_object('day', f.work_day, 'kind', f.kind, 'bill', f.bill, 'source', f.bill_source, 'fee', f.fee, 'free', f.free) order by f.work_day) filter (where f.visit_id is not null), '[]'))
  from private.visit_fees(p_venue, m0, m1) f);
end $$;

create or replace function public.biz_settings_save(p_venue text, p_reservations_on boolean, p_auto_confirm_max int, p_plus_pct int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(private.member_role(p_venue), '') not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
  update public.partners set reservations_on = p_reservations_on, auto_confirm_max = greatest(0, least(20, p_auto_confirm_max)), plus_pct = p_plus_pct
  where venue_id = p_venue;
end $$;

create or replace function public.biz_team(p_venue text) returns table (user_id uuid, username text, first_name text, role text, active boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.username, p.first_name, m.role, m.active from public.partner_members m join public.profiles p on p.id = m.user_id
  where m.venue_id = p_venue and private.member_role(p_venue) in ('proprietar', 'manager') order by m.created_at
$$;

-- proprietarul adaugă pe oricine; managerul doar recepție și scanare. Omul își face cont în aplicație (username).
create or replace function public.biz_team_set(p_venue text, p_username text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare mine text := private.member_role(p_venue); who uuid;
begin
  if mine is null or mine not in ('proprietar', 'manager') then raise exception 'Nu ai voie.'; end if;
  if p_role not in ('proprietar', 'manager', 'receptie', 'scanare', 'scos') then raise exception 'Rol necunoscut.'; end if;
  if mine = 'manager' and p_role not in ('receptie', 'scanare', 'scos') then raise exception 'Managerul adaugă doar recepție și scanare.'; end if;
  select id into who from public.profiles where username = lower(trim(both '@ ' from p_username));
  if who is null then raise exception 'Nu găsesc @%. Omul își face întâi cont în aplicația CeFaci.', p_username; end if;
  if who = auth.uid() then raise exception 'Nu-ți poți schimba singur rolul.'; end if;
  if mine = 'manager' and exists (select 1 from public.partner_members where venue_id = p_venue and user_id = who and role in ('proprietar', 'manager')) then
    raise exception 'Nu ai voie.'; end if;
  if p_role = 'scos' then
    update public.partner_members set active = false where venue_id = p_venue and user_id = who;
  else
    insert into public.partner_members (venue_id, user_id, role, added_by) values (p_venue, who, p_role, auth.uid())
    on conflict (venue_id, user_id) do update set role = excluded.role, active = true;
  end if;
end $$;

-- ---------- Admin (echipa CeFaci) ----------
-- jurnalul locurilor ține minte și cine a făcut partenerul și cu ce condiții
alter table public.venue_log drop constraint if exists venue_log_action_check;
alter table public.venue_log add constraint venue_log_action_check check (action in ('edit', 'add', 'hide', 'show', 'undo', 'partener'));

create or replace function private.can(perm text) returns boolean
language sql stable security definer set search_path = '' as $$
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
$$;

create or replace function public.admin_partner_save(p_venue text, p_firm text, p_cui text, p_founder boolean, p_status text default 'activ', p_owner text default null)
returns public.partners
language plpgsql security definer set search_path = '' as $$
declare old public.partners; pr public.partners; today date := (now() at time zone 'Europe/Bucharest')::date; owner uuid;
begin
  if not private.can('partners') then raise exception 'Nu ai voie să faci parteneri.'; end if;
  if not exists (select 1 from public.venues where id = p_venue) then raise exception 'Locul nu există în CeFaci.'; end if;
  if p_status not in ('activ', 'pauza', 'iesit') then raise exception 'Stare necunoscută.'; end if;
  perform pg_advisory_xact_lock(hashtext('cefaci.founders'));    -- doi admini deodată nu pot face 21 de fondatori
  select * into old from public.partners where venue_id = p_venue for update;
  if p_founder and (old.venue_id is null or not old.founder) then
    if not private.can('founder') then raise exception 'Statutul de fondator îl dă doar fondatorul CeFaci.'; end if;
    if (select count(*) from public.partners where founder) >= 20 then raise exception 'Sunt deja 20 de fondatori.'; end if;
  end if;
  if old.venue_id is not null and old.founder and not p_founder and not private.can('founder') then raise exception 'Doar fondatorul CeFaci scoate statutul de fondator.'; end if;
  insert into public.partners (venue_id, firm, cui, founder, rate, status, activated_at, free_until, created_by)
  values (p_venue, trim(p_firm), regexp_replace(p_cui, '\D', '', 'g'), p_founder, case when p_founder then 0.08 else 0.10 end, p_status,
          today, (today + case when p_founder then interval '3 months' else interval '1 month' end)::date, auth.uid())
  on conflict (venue_id) do update set firm = excluded.firm, cui = excluded.cui, founder = excluded.founder,
    rate = case when excluded.founder then 0.08 else 0.10 end, status = excluded.status
  returning * into pr;
  insert into public.venue_codes (venue_id, token) values (p_venue, private.new_code(12)) on conflict (venue_id) do nothing;
  if nullif(trim(p_owner), '') is not null then
    select id into owner from public.profiles where username = lower(trim(both '@ ' from p_owner));
    if owner is null then raise exception 'Nu găsesc @%. Proprietarul își face întâi cont în aplicația CeFaci.', p_owner; end if;
    if private.staff_role(owner) is not null then raise exception 'Cineva din echipa CeFaci nu poate fi proprietarul unui local partener.'; end if;
    insert into public.partner_members (venue_id, user_id, role, added_by) values (p_venue, owner, 'proprietar', auth.uid())
    on conflict (venue_id, user_id) do update set role = 'proprietar', active = true;
  end if;
  insert into public.venue_log (venue_id, by_user, action, before, after)
  values (p_venue, auth.uid(), 'partener', to_jsonb(old), to_jsonb(pr));
  return pr;
end $$;

create or replace function public.admin_partners() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m0 date := date_trunc('month', (now() at time zone 'Europe/Bucharest')::date)::date;
begin
  if not private.can('partners.read') then raise exception 'Nu ai voie.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'venue_id', p.venue_id, 'name', coalesce(v.edit->>'name', v.name), 'firm', p.firm, 'cui', p.cui, 'founder', p.founder, 'rate', p.rate,
      'status', p.status, 'activated_at', p.activated_at, 'free_until', p.free_until,
      'team', (select jsonb_agg(jsonb_build_object('username', pr.username, 'role', m.role)) from public.partner_members m join public.profiles pr on pr.id = m.user_id where m.venue_id = p.venue_id and m.active),
      'month', case when private.can('partners') or private.can('money') then (select jsonb_build_object('bills', coalesce(sum(f.bill), 0), 'fee', coalesce(sum(f.fee) filter (where not f.free), 0), 'would_pay', coalesce(sum(f.fee) filter (where f.free), 0), 'visits', count(*))
                from private.visit_fees(p.venue_id, m0, (m0 + interval '1 month' - interval '1 day')::date) f) end,
      -- de verificat: nota scrisă de local mult sub bon; mese scanate trecute „n-a venit”; seri neînchise
      'flags', (select count(*) from public.visits x join public.receipts r on r.visit_id = x.id where x.venue_id = p.venue_id and x.declared is not null and x.declared < r.total * 0.9 and x.work_day >= m0),
      'noshow', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'n-a venit' and x.work_day >= m0),
      'unclosed', (select count(*) from public.visits x where x.venue_id = p.venue_id and x.kind in ('rezervare', 'drop') and x.outcome = 'deschis' and x.bill is null and x.work_day < private.work_day(now()) - 1)
    ) order by p.created_at) from public.partners p left join public.venues v on v.id = p.venue_id), '[]');
end $$;

-- ---------- drepturile ----------
revoke all on function private.work_day(timestamptz), private.day_word(text, date), private.plus_active(uuid), private.member_role(text),
  private.visit_fees(text, date, date), private.plain(text) from public;
grant execute on function private.work_day(timestamptz), private.day_word(text, date), private.plus_active(uuid), private.member_role(text) to authenticated;
revoke all on function public.reservation_request(text, timestamptz, int, int, text), public.reservation_cancel(uuid), public.drop_claim(uuid, int),
  public.visit_scan(text, double precision, double precision, text, int), public.biz_my_venues(), public.biz_today(text), public.reservation_decide(uuid, boolean),
  public.drop_create(text, text, int, int, int, int, timestamptz, int, boolean, boolean), public.drop_stop(uuid), public.visit_close(uuid, boolean, numeric),
  public.biz_month(text, date), public.biz_settings_save(text, boolean, int, int), public.biz_team(text), public.biz_team_set(text, text, text),
  public.admin_partner_save(text, text, text, boolean, text, text), public.admin_partners() from public, anon;
grant execute on function public.reservation_request(text, timestamptz, int, int, text), public.reservation_cancel(uuid), public.drop_claim(uuid, int),
  public.visit_scan(text, double precision, double precision, text, int), public.biz_my_venues(), public.biz_today(text), public.reservation_decide(uuid, boolean),
  public.drop_create(text, text, int, int, int, int, timestamptz, int, boolean, boolean), public.drop_stop(uuid), public.visit_close(uuid, boolean, numeric),
  public.biz_month(text, date), public.biz_settings_save(text, boolean, int, int), public.biz_team(text), public.biz_team_set(text, text, text),
  public.admin_partner_save(text, text, text, boolean, text, text), public.admin_partners() to authenticated;
revoke all on function public.visit_receipt(uuid, uuid, text, numeric, numeric, timestamptz) from public, anon, authenticated;

-- rezervările și sosirile apar live în Business
do $$ begin alter publication supabase_realtime add table public.reservations, public.visits; exception when others then null; end $$;
