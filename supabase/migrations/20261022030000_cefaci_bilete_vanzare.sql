-- Bilete, faza 3 (Cornel, 22.10: „Netopia, fără taxă pentru Plus, 2 lei restul”, procentul ales de noi: 8%).
-- Un local partener vinde bilete la evenimentele lui direct în CeFaci. Localul e vânzătorul (comerciantul): banii
-- merg prin Netopia (plăți împărțite) în contul lui, iar Netopia ne oprește partea noastră:
--  * comisionul CeFaci: 8% din prețul biletelor, totul inclus (costul plății cu cardul îl plătim noi din el);
--  * taxa de serviciu: 2 lei pe bilet, plătită de cumpărător; 0 lei cu Plus.
-- ACUM DOAR PE TEST: private.ticket_config.live = false. Fiecare comandă e „de test”, se plătește cu butonul
-- „Plată de test” (fără bani), iar evenimentele cu bilete de test le văd doar echipa localului și echipa CeFaci.
-- Plățile reale pornesc după SRL, contract, termeni și confirmarea Google Play (docs/evenimente.md, faza 3), cu
-- funcția Supabase „bilete-plata” (de scris atunci) care cheamă ticket_order_paid cu cheia de serviciu.
-- Biletul: un QR care se schimbă la 30 de secunde (sha256 din secretul biletului și minutul), făcut pe telefon și
-- fără internet; scanarea în Business îl verifică pe server și îl marchează folosit o singură dată.

create table private.ticket_config(
 id boolean primary key default true check(id),
 live boolean not null default false,
 commission numeric(5,4) not null default 0.08 check(commission between 0 and 0.3),
 fee numeric(6,2) not null default 2 check(fee between 0 and 20),
 hold_minutes int not null default 15 check(hold_minutes between 5 and 60));
alter table private.ticket_config enable row level security;
revoke all on private.ticket_config from public,anon,authenticated;
insert into private.ticket_config default values;

-- contul de încasare al localului la Netopia: cerut din Business, aprobat din Admin (test sau, mai târziu, activ)
create table private.ticket_payouts(
 venue_id text primary key references public.venues(id) on delete cascade,
 status text not null default 'cerut' check(status in('cerut','test','activ','oprit')),
 legal_name text not null check(length(trim(legal_name)) between 2 and 120),
 cui text not null check(cui ~ '^[0-9]{2,10}$'),
 iban_tail text not null check(iban_tail ~ '^[0-9A-Z]{4}$'),
 netopia_seller text check(netopia_seller is null or netopia_seller ~ '^[A-Za-z0-9_-]{3,60}$'),
 note text check(note is null or length(note)<=300),
 requested_by uuid references public.profiles(id) on delete set null,
 requested_at timestamptz not null default now(),
 decided_by uuid references public.profiles(id) on delete set null,
 decided_at timestamptz);
alter table private.ticket_payouts enable row level security;
revoke all on private.ticket_payouts from public,anon,authenticated;

-- 'link' = biletul la vânzătorul oficial (faza 1); 'cefaci' = vândut de localul partener în CeFaci
alter table public.events add column sale_mode text not null default 'link' check(sale_mode in('link','cefaci'));

/** Can the event's tickets be sold in CeFaci now: 'activ' (real money) or 'test', else null. */
create function private.ticket_sale(v text) returns text
language sql stable security definer set search_path='' as $$
 select case when p.status='activ' and c.live then 'activ' when p.status='test' and not c.live then 'test' end
 from private.ticket_payouts p, private.ticket_config c where p.venue_id=v
$$;
/** Test events are seen only by the venue's team and CeFaci's team. */
create function private.ticket_event_visible(v text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.ticket_sale(v)='activ' or (private.ticket_sale(v)='test' and (private.member_role(v) is not null or exists(select 1 from public.staff where user_id=auth.uid())))
$$;
revoke all on function private.ticket_sale(text),private.ticket_event_visible(text) from public,anon,authenticated;
grant execute on function private.ticket_event_visible(text) to authenticated;
alter policy events_read on public.events
 using(status <> 'draft' and coalesce(ends_at, starts_at + interval '6 hours') > now() - interval '12 hours' and starts_at < now() + interval '60 days'
  and (sale_mode='link' or private.ticket_event_visible(venue_id)));

create table public.ticket_types(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 40),
 price numeric(8,2) not null check(price between 1 and 5000),
 qty int not null check(qty between 1 and 20000),
 sold int not null default 0 check(sold >= 0 and sold <= qty),
 max_per_order int not null default 6 check(max_per_order between 1 and 10),
 on_sale boolean not null default true,
 sort int not null default 0,
 created_at timestamptz not null default now());
create index ticket_types_event on public.ticket_types(event_id);
alter table public.ticket_types enable row level security;
revoke all on public.ticket_types from public,anon,authenticated;
grant select on public.ticket_types to authenticated;
create policy ticket_types_read on public.ticket_types for select to authenticated using(exists(select 1 from public.events e where e.id=event_id));

create table public.ticket_orders(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 venue_id text not null,
 user_id uuid references public.profiles(id) on delete set null,
 status text not null default 'asteapta' check(status in('asteapta','platit','expirat','anulat','de_rambursat','rambursat')),
 tickets int not null check(tickets between 1 and 10),
 subtotal numeric(10,2) not null check(subtotal >= 0),
 fee numeric(8,2) not null check(fee >= 0),
 total numeric(10,2) not null check(total = subtotal + fee),
 commission numeric(10,2) not null check(commission >= 0),
 plus boolean not null default false,
 test boolean not null,
 provider_ref text check(provider_ref is null or length(provider_ref)<=120),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 paid_at timestamptz,
 refunded_at timestamptz);
create index ticket_orders_user on public.ticket_orders(user_id,created_at desc);
create index ticket_orders_event on public.ticket_orders(event_id,status);
create unique index ticket_orders_ref on public.ticket_orders(provider_ref) where provider_ref is not null;
alter table public.ticket_orders enable row level security;
revoke all on public.ticket_orders from public,anon,authenticated;

create table public.ticket_order_items(
 order_id uuid not null references public.ticket_orders(id) on delete cascade,
 type_id uuid not null references public.ticket_types(id) on delete restrict,
 qty int not null check(qty between 1 and 10),
 price numeric(8,2) not null,
 primary key(order_id,type_id));
alter table public.ticket_order_items enable row level security;
revoke all on public.ticket_order_items from public,anon,authenticated;

create table public.tickets(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.ticket_orders(id) on delete restrict,
 event_id uuid not null references public.events(id) on delete restrict,
 type_id uuid not null references public.ticket_types(id) on delete restrict,
 holder uuid references public.profiles(id) on delete set null,
 status text not null default 'valid' check(status in('valid','folosit','rambursat')),
 test boolean not null,
 transfers int not null default 0 check(transfers between 0 and 3),
 used_at timestamptz,
 used_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now());
create index tickets_holder on public.tickets(holder,status);
create index tickets_event on public.tickets(event_id,status);
alter table public.tickets enable row level security;
revoke all on public.tickets from public,anon,authenticated;

create table private.ticket_secrets(
 ticket_id uuid primary key references public.tickets(id) on delete cascade,
 secret text not null check(secret ~ '^[0-9a-f]{32}$'));
alter table private.ticket_secrets enable row level security;
revoke all on private.ticket_secrets from public,anon,authenticated;

create table private.ticket_log(
 id bigint generated always as identity primary key,
 ticket_id uuid references public.tickets(id) on delete cascade,
 order_id uuid references public.ticket_orders(id) on delete cascade,
 action text not null, by_user uuid references public.profiles(id) on delete set null,
 at timestamptz not null default now(), note text);
alter table private.ticket_log enable row level security;
revoke all on private.ticket_log from public,anon,authenticated;

/** Unpaid orders past their 15 minutes give their tickets back. */
create function private.ticket_expire() returns void
language plpgsql security definer set search_path='' as $$
declare o record;
begin
 for o in select id from public.ticket_orders where status='asteapta' and expires_at < now() for update skip locked loop
  update public.ticket_types t set sold=greatest(0,t.sold-i.qty) from public.ticket_order_items i where i.order_id=o.id and t.id=i.type_id;
  update public.ticket_orders set status='expirat' where id=o.id;
 end loop;
end $$;

/** The code on the QR for a ticket at a 30-second window: CFB1.<ticket>.<window>.<10 hex>. The phone makes the same. */
create function private.ticket_code(secret text,w bigint) returns text
language sql immutable set search_path='' as $$ select left(encode(sha256(convert_to(secret||'.'||w,'UTF8')),'hex'),10) $$;

/** A paid order: its tickets, each with its own secret. */
create function private.ticket_issue(p_order uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.ticket_orders; i record; k int; t uuid;
begin
 select * into o from public.ticket_orders where id=p_order;
 for i in select * from public.ticket_order_items where order_id=p_order loop
  for k in 1..i.qty loop
   insert into public.tickets(order_id,event_id,type_id,holder,test) values(o.id,o.event_id,i.type_id,o.user_id,o.test) returning id into t;
   insert into private.ticket_secrets(ticket_id,secret) values(t,replace(gen_random_uuid()::text,'-',''));
  end loop;
 end loop;
 insert into private.ticket_log(order_id,action,by_user,note) values(o.id,'plătit',o.user_id,case when o.test then 'test' end);
end $$;

/** Cancelled event: every paid order goes back (test: at once; real money: Netopia, through „bilete-plata”). */
create function private.ticket_refund_event(p_event uuid,p_by uuid) returns int
language plpgsql security definer set search_path='' as $$
declare n int;
begin
 update public.tickets set status='rambursat' where event_id=p_event and status='valid';
 with x as (update public.ticket_orders set status=case when test then 'rambursat' else 'de_rambursat' end,refunded_at=case when test then now() end
  where event_id=p_event and status='platit' returning id) select count(*) into n from x;
 update public.ticket_orders set status='anulat' where event_id=p_event and status='asteapta';
 insert into private.ticket_log(action,by_user,note) select 'eveniment anulat',p_by,p_event::text;
 return n;
end $$;
revoke all on function private.ticket_expire(),private.ticket_code(text,bigint),private.ticket_issue(uuid),private.ticket_refund_event(uuid,uuid) from public,anon,authenticated;

-- ===== client =====

/** „Cumpără”: holds the tickets 15 minutes and says what the person pays (2 lei per ticket, 0 with Plus). */
create function public.ticket_order_start(p_event uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); e public.events; c private.ticket_config; sale text; it jsonb; ty public.ticket_types;
 n int:=0; sub numeric:=0; already int; is_plus boolean; o public.ticket_orders; age int; q int;
begin
 if me is null then raise exception 'Intră în cont ca să cumperi bilete.'; end if;
 perform private.ticket_expire();
 select * into c from private.ticket_config;
 select * into e from public.events where id=p_event and sale_mode='cefaci' and status in('published','postponed') for update;
 if e.id is null then raise exception 'Biletele nu sunt disponibile pentru acest eveniment.'; end if;
 sale:=private.ticket_sale(e.venue_id);
 if sale is null or not private.ticket_event_visible(e.venue_id) then raise exception 'Biletele nu sunt disponibile pentru acest eveniment.'; end if;
 if coalesce(e.ends_at,e.starts_at+interval '6 hours') < now() then raise exception 'Evenimentul s-a terminat.'; end if;
 age:=coalesce(private.age(me),0);
 if age < coalesce(e.min_age,0) then raise exception 'Evenimentul e de la % ani.',e.min_age; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 5 then raise exception 'Alege biletele.'; end if;
 -- one order waiting at a time: a new „Cumpără” lets the old one go
 update public.ticket_types t set sold=greatest(0,t.sold-i.qty) from public.ticket_order_items i join public.ticket_orders x on x.id=i.order_id
  where x.user_id=me and x.status='asteapta' and t.id=i.type_id;
 update public.ticket_orders set status='anulat' where user_id=me and status='asteapta';
 select coalesce(sum(tickets),0) into already from public.ticket_orders where user_id=me and event_id=e.id and status='platit';
 if (select count(*) from public.ticket_orders where user_id=me and created_at > now()-interval '1 day') >= 20 then raise exception 'Prea multe încercări azi. Mai încearcă mâine.'; end if;
 insert into public.ticket_orders(event_id,venue_id,user_id,tickets,subtotal,fee,total,commission,test,expires_at)
  values(e.id,e.venue_id,me,1,0,0,0,0,sale='test',now()+make_interval(mins=>c.hold_minutes)) returning * into o;
 for it in select * from jsonb_array_elements(p_items) loop
  q:=coalesce((it->>'qty')::int,0);
  if q < 1 then continue; end if;
  select * into ty from public.ticket_types where id=(it->>'type')::uuid and event_id=e.id and on_sale for update;
  if ty.id is null then raise exception 'Felul de bilet nu mai e de vânzare.'; end if;
  if q > ty.max_per_order then raise exception 'Cel mult % bilete „%” pe comandă.',ty.max_per_order,ty.name; end if;
  if ty.sold+q > ty.qty then raise exception 'Mai sunt doar % bilete „%”.',ty.qty-ty.sold,ty.name; end if;
  update public.ticket_types set sold=sold+q where id=ty.id;
  insert into public.ticket_order_items(order_id,type_id,qty,price) values(o.id,ty.id,q,ty.price);
  n:=n+q; sub:=sub+q*ty.price;
 end loop;
 if n < 1 then raise exception 'Alege biletele.'; end if;
 if n > 10 then raise exception 'Cel mult 10 bilete pe comandă.'; end if;
 if already+n > 10 then raise exception 'Ai deja % bilete la eveniment; cel mult 10 de persoană.',already; end if;
 is_plus:=private.plus_active(me);
 update public.ticket_orders set tickets=n,subtotal=sub,fee=case when is_plus then 0 else c.fee*n end,total=sub+case when is_plus then 0 else c.fee*n end,
  commission=round(sub*c.commission,2),plus=is_plus where id=o.id returning * into o;
 return jsonb_build_object('order',o.id,'tickets',n,'subtotal',o.subtotal,'fee',o.fee,'total',o.total,'plus',is_plus,'test',o.test,'expires_at',o.expires_at);
end $$;

/** „Renunț” before paying: the tickets go back. */
create function public.ticket_order_cancel(p_order uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.ticket_types t set sold=greatest(0,t.sold-i.qty) from public.ticket_order_items i join public.ticket_orders o on o.id=i.order_id
  where o.id=p_order and o.user_id=auth.uid() and o.status='asteapta' and t.id=i.type_id;
 update public.ticket_orders set status='anulat' where id=p_order and user_id=auth.uid() and status='asteapta';
end $$;

/** „Plată de test”: only while real payments are off and only for a test order. No money moves. */
create function public.ticket_order_test_pay(p_order uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.ticket_orders;
begin
 if (select live from private.ticket_config) then raise exception 'Plățile de test sunt oprite.'; end if;
 perform private.ticket_expire();
 select * into o from public.ticket_orders where id=p_order and user_id=auth.uid() for update;
 if o.id is null or not o.test then raise exception 'Comanda nu există.'; end if;
 if o.status='expirat' then raise exception 'Au trecut cele 15 minute. Alege biletele din nou.'; end if;
 if o.status<>'asteapta' then raise exception 'Comanda nu mai așteaptă plata.'; end if;
 update public.ticket_orders set status='platit',paid_at=now(),provider_ref='test-'||o.id where id=o.id;
 perform private.ticket_issue(o.id);
 return jsonb_build_object('order',o.id,'tickets',o.tickets);
end $$;

/** Real payment confirmed by Netopia (only the „bilete-plata” function, with the service key): the amount must match. */
create function public.ticket_order_paid(p_order uuid,p_ref text,p_amount numeric) returns void
language plpgsql security definer set search_path='' as $$
declare o public.ticket_orders;
begin
 select * into o from public.ticket_orders where id=p_order for update;
 if o.id is null or o.test then raise exception 'Comanda nu există.'; end if;
 if o.status='platit' and o.provider_ref=p_ref then return; end if;
 if o.status<>'asteapta' then raise exception 'Comanda nu mai așteaptă plata (%).',o.status; end if;
 if p_amount is distinct from o.total then raise exception 'Suma plătită nu se potrivește.'; end if;
 update public.ticket_orders set status='platit',paid_at=now(),provider_ref=p_ref where id=o.id;
 perform private.ticket_issue(o.id);
end $$;

/** „Biletele mele”: the person's tickets, with the secret for the QR (only theirs, only the valid ones). */
create function public.my_tickets() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'test',t.test,'type',ty.name,'price',ty.price,'transfers',t.transfers,'used_at',t.used_at,
  'secret',case when t.status='valid' then s.secret end,
  'event',jsonb_build_object('id',e.id,'title',e.title,'kind',e.kind,'starts_at',e.starts_at,'ends_at',e.ends_at,'place_name',e.place_name,'address',e.address,'lat',e.lat,'lon',e.lon,'status',e.status,'min_age',e.min_age))
  order by e.starts_at,ty.sort,t.created_at),'[]')
 from public.tickets t join public.events e on e.id=t.event_id join public.ticket_types ty on ty.id=t.type_id left join private.ticket_secrets s on s.ticket_id=t.id
 where t.holder=auth.uid() and coalesce(e.ends_at,e.starts_at+interval '6 hours') > now()-interval '2 days'
$$;

/** Give a ticket to a friend: the old QR stops working, the friend sees it in „Biletele mele”. At most 3 times. */
create function public.ticket_transfer(p_ticket uuid,p_friend uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); t public.tickets; e public.events;
begin
 select * into t from public.tickets where id=p_ticket and holder=me for update;
 if t.id is null then raise exception 'Biletul nu e al tău.'; end if;
 if t.status<>'valid' then raise exception 'Biletul nu mai e valabil.'; end if;
 if t.transfers>=3 then raise exception 'Biletul a fost dat mai departe de prea multe ori.'; end if;
 if p_friend is null or p_friend=me or not exists(select 1 from private.friends_of(me) f where f.f=p_friend) then raise exception 'Poți da biletul doar unui prieten din CeFaci.'; end if;
 select * into e from public.events where id=t.event_id;
 if coalesce(e.ends_at,e.starts_at+interval '6 hours') < now() then raise exception 'Evenimentul s-a terminat.'; end if;
 if coalesce(private.age(p_friend),0) < coalesce(e.min_age,0) then raise exception 'Prietenul tău nu are vârsta pentru eveniment.'; end if;
 update public.tickets set holder=p_friend,transfers=transfers+1 where id=t.id;
 update private.ticket_secrets set secret=replace(gen_random_uuid()::text,'-','') where ticket_id=t.id;
 insert into private.ticket_log(ticket_id,action,by_user,note) values(t.id,'dat mai departe',me,p_friend::text);
end $$;

-- ===== Business =====

/** The venue's ticket page: the payout account, the money rule and the events with what was sold. */
create function public.biz_ticket_events(p_venue text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare role text; c private.ticket_config; p private.ticket_payouts;
begin
 perform private.require_secure_scope('business');
 role:=private.secured_member_role(p_venue);
 if coalesce(role,'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 perform private.ticket_expire();
 select * into c from private.ticket_config; select * into p from private.ticket_payouts where venue_id=p_venue;
 return jsonb_build_object('live',c.live,'commission',c.commission,'fee',c.fee,
  'payout',case when p.venue_id is null then null else jsonb_build_object('status',p.status,'legal_name',p.legal_name,'cui',p.cui,'iban_tail',p.iban_tail,'note',p.note,'requested_at',p.requested_at) end,
  'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object(
    'types',coalesce((select jsonb_agg(to_jsonb(t) order by t.sort,t.created_at) from public.ticket_types t where t.event_id=e.id),'[]'),
    'sold',(select count(*) from public.tickets t where t.event_id=e.id and t.status<>'rambursat'),
    'scanned',(select count(*) from public.tickets t where t.event_id=e.id and t.status='folosit'),
    'gross',(select coalesce(sum(subtotal),0) from public.ticket_orders o where o.event_id=e.id and o.status='platit'),
    'commission_lei',(select coalesce(sum(commission),0) from public.ticket_orders o where o.event_id=e.id and o.status='platit'),
    'test',p.status='test') order by e.starts_at desc)
   from public.events e where e.venue_id=p_venue and e.sale_mode='cefaci' and e.starts_at > now()-interval '120 days'),'[]'));
end $$;

/** The owner asks for the payout account (the firm that sells; checked by CeFaci before anything is sold). */
create function public.biz_ticket_payout_request(p_venue text,p jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare old private.ticket_payouts;
begin
 perform private.require_secure_scope('business');
 if coalesce(private.secured_member_role(p_venue),'')<>'proprietar' then raise exception 'Doar proprietarul cere contul de încasare.'; end if;
 if not exists(select 1 from public.partners where venue_id=p_venue and status='activ') then raise exception 'Biletele se vând doar de localurile partenere active.'; end if;
 select * into old from private.ticket_payouts where venue_id=p_venue;
 if old.status in('test','activ') then raise exception 'Contul de încasare e deja aprobat. Pentru schimbări scrie la Ajutor.'; end if;
 insert into private.ticket_payouts(venue_id,status,legal_name,cui,iban_tail,requested_by)
  values(p_venue,'cerut',trim(p->>'legal_name'),regexp_replace(coalesce(p->>'cui',''),'^RO','','i'),upper(right(regexp_replace(coalesce(p->>'iban',''),'\s','','g'),4)),auth.uid())
  on conflict(venue_id) do update set status='cerut',legal_name=excluded.legal_name,cui=excluded.cui,iban_tail=excluded.iban_tail,requested_by=excluded.requested_by,requested_at=now(),decided_by=null,decided_at=null;
end $$;

/** A ticketed event of the venue, with its ticket kinds. Prices of a kind with sales do not change; a cancel refunds. */
create function public.biz_ticket_event_save(p_venue text,p_id uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare role text; v public.venues; e public.events; st text:=coalesce(p->>'status','draft'); t jsonb; old public.ticket_types; tid uuid; keep uuid[]:='{}'; k int:=0;
begin
 perform private.require_secure_scope('business');
 role:=private.secured_member_role(p_venue);
 if coalesce(role,'') not in('proprietar','manager') then raise exception 'Nu ai voie.'; end if;
 if st not in('draft','published','sold_out','postponed','cancelled') then raise exception 'Stare invalidă.'; end if;
 select * into v from public.venues where id=p_venue;
 if st in('published','postponed','sold_out') and private.ticket_sale(p_venue) is null then raise exception 'Publici după ce CeFaci aprobă contul de încasare.'; end if;
 if p_id is not null then
  select * into e from public.events where id=p_id and venue_id=p_venue and sale_mode='cefaci' for update;
  if e.id is null then raise exception 'Evenimentul nu e al localului.'; end if;
  if e.status='cancelled' then raise exception 'Evenimentul a fost anulat și banii dați înapoi; fă unul nou.'; end if;
 end if;
 if (p->>'starts_at')::timestamptz < now() and (p_id is null or (p->>'starts_at')::timestamptz<>e.starts_at) then raise exception 'Data a trecut.'; end if;
 if p_id is null then
  insert into public.events(title,kind,starts_at,ends_at,venue_id,place_name,address,lat,lon,min_age,about,about_en,status,sale_mode,created_by,updated_by)
  values(trim(p->>'title'),p->>'kind',(p->>'starts_at')::timestamptz,nullif(p->>'ends_at','')::timestamptz,v.id,coalesce(v.edit->>'name',v.name),
   nullif(concat_ws(', ',coalesce(v.edit->>'street',v.data->>'street'),coalesce(v.edit->>'city',v.data->>'city')),''),v.lat,v.lon,nullif(p->>'min_age','')::int,nullif(trim(p->>'about'),''),nullif(trim(p->>'about_en'),''),'draft','cefaci',auth.uid(),auth.uid())
  returning * into e;
 else
  update public.events set title=trim(p->>'title'),kind=p->>'kind',starts_at=(p->>'starts_at')::timestamptz,ends_at=nullif(p->>'ends_at','')::timestamptz,
   min_age=nullif(p->>'min_age','')::int,about=nullif(trim(p->>'about'),''),about_en=nullif(trim(p->>'about_en'),''),updated_by=auth.uid(),updated_at=now()
  where id=e.id returning * into e;
 end if;
 if st<>'cancelled' then
  for t in select * from jsonb_array_elements(coalesce(p->'types','[]')) loop
   k:=k+1; if k>8 then raise exception 'Cel mult 8 feluri de bilete.'; end if;
   if nullif(t->>'id','') is not null then
    select * into old from public.ticket_types where id=(t->>'id')::uuid and event_id=e.id for update;
    if old.id is null then raise exception 'Felul de bilet nu e al evenimentului.'; end if;
    if old.sold>0 and (t->>'price')::numeric<>old.price then raise exception 'Prețul la „%” nu se mai schimbă: s-au vândut bilete.',old.name; end if;
    if (t->>'qty')::int < old.sold then raise exception 'La „%” s-au vândut deja % bilete.',old.name,old.sold; end if;
    update public.ticket_types set name=trim(t->>'name'),price=(t->>'price')::numeric,qty=(t->>'qty')::int,max_per_order=coalesce(nullif(t->>'max_per_order','')::int,6),
     on_sale=coalesce((t->>'on_sale')::boolean,true),sort=k where id=old.id;
    keep:=keep||old.id;
   else
    insert into public.ticket_types(event_id,name,price,qty,max_per_order,on_sale,sort) values(e.id,trim(t->>'name'),(t->>'price')::numeric,(t->>'qty')::int,
     coalesce(nullif(t->>'max_per_order','')::int,6),coalesce((t->>'on_sale')::boolean,true),k) returning id into tid;
    keep:=keep||tid;
   end if;
  end loop;
  -- a kind left out only stops selling (nothing is deleted: the orders keep pointing at it)
  update public.ticket_types set on_sale=false where event_id=e.id and not(id=any(keep));
 end if;
 if st in('published','postponed') and not exists(select 1 from public.ticket_types where event_id=e.id and on_sale) then raise exception 'Adaugă cel puțin un fel de bilet de vânzare.'; end if;
 select coalesce(min(price),null),max(price) into e.price_from,e.price_to from public.ticket_types where event_id=e.id and on_sale;
 update public.events set status=st,price_from=e.price_from,price_to=case when e.price_to>e.price_from then e.price_to end where id=e.id;
 if st='cancelled' then perform private.ticket_refund_event(e.id,auth.uid()); end if;
 insert into private.event_log(event_id,action,by_user,note) values(e.id,case when p_id is null then 'adăugat de local' else 'modificat de local' end,auth.uid(),st);
 return e.id;
end $$;

/** The door: the QR from „Biletele mele”. Each ticket goes in once; a screenshot older than ~5 minutes does not. */
create function public.biz_ticket_scan(p_venue text,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text[]; t public.tickets; e public.events; s text; w bigint; now_w bigint:=floor(extract(epoch from now())/30); ty public.ticket_types; who text;
begin
 perform private.require_secure_scope('business');
 if private.secured_member_role(p_venue) is null then raise exception 'Nu ești în echipa localului.'; end if;
 m:=regexp_match(trim(coalesce(p_code,'')),'^CFB1\.([0-9a-f-]{36})\.([0-9]{1,12})\.([0-9a-f]{10})$');
 if m is null then raise exception 'Nu e un bilet CeFaci.'; end if;
 select * into t from public.tickets where id=m[1]::uuid for update;
 select * into e from public.events where id=t.event_id;
 if t.id is null or e.venue_id is distinct from p_venue then raise exception 'Biletul nu e pentru un eveniment de aici.'; end if;
 select ss.secret into s from private.ticket_secrets ss where ss.ticket_id=t.id;
 w:=m[2]::bigint;
 if abs(w-now_w) > 10 or s is null or private.ticket_code(s,w)<>m[3] then raise exception 'Codul nu mai e valabil. Roagă omul să deschidă biletul în aplicație (nu o poză).'; end if;
 select * into ty from public.ticket_types where id=t.type_id;
 select coalesce(first_name,username) into who from public.profiles where id=t.holder;
 if t.status='rambursat' then raise exception 'Biletul a fost rambursat. Nu e valabil.'; end if;
 if t.status='folosit' then
  return jsonb_build_object('ok',false,'already',true,'used_at',t.used_at,'type',ty.name,'name',who,'event',e.title,'test',t.test);
 end if;
 if now() < e.starts_at-interval '6 hours' or now() > coalesce(e.ends_at,e.starts_at+interval '6 hours')+interval '6 hours' then raise exception 'Biletul e pentru „%”, nu pentru acum.',e.title; end if;
 update public.tickets set status='folosit',used_at=now(),used_by=auth.uid() where id=t.id;
 insert into private.ticket_log(ticket_id,action,by_user) values(t.id,'intrat',auth.uid());
 return jsonb_build_object('ok',true,'type',ty.name,'name',who,'event',e.title,'test',t.test,
  'inside',(select count(*) from public.tickets where event_id=e.id and status='folosit'),'sold',(select count(*) from public.tickets where event_id=e.id and status<>'rambursat'));
end $$;

-- ===== Admin =====

create function public.admin_ticket_payouts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_secure_scope('admin');
 if not private.can('partners') then raise exception 'Nu ai voie.'; end if;
 return jsonb_build_object('live',(select live from private.ticket_config),'list',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('venue_name',coalesce(v.edit->>'name',v.name)) order by p.requested_at desc)
  from private.ticket_payouts p left join public.venues v on v.id=p.venue_id),'[]'));
end $$;

/** CeFaci approves the payout account: 'test' now; 'activ' only once real payments are on (after the SRL). */
create function public.admin_ticket_payout_set(p_venue text,p_status text,p_seller text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_secure_scope('admin');
 if not private.can('partners') then raise exception 'Nu ai voie.'; end if;
 if p_status not in('cerut','test','activ','oprit') then raise exception 'Stare invalidă.'; end if;
 if p_status='activ' and not (select live from private.ticket_config) then raise exception 'Plățile reale nu sunt pornite (după SRL, contract și termeni).'; end if;
 if p_status='activ' and nullif(trim(p_seller),'') is null then raise exception 'Scrie codul localului la Netopia.'; end if;
 update private.ticket_payouts set status=p_status,netopia_seller=nullif(trim(p_seller),''),note=nullif(trim(p_note),''),decided_by=auth.uid(),decided_at=now() where venue_id=p_venue;
 if not found then raise exception 'Localul nu a cerut cont de încasare.'; end if;
end $$;

-- Admin's own event editor works on 'link' events only; a venue's ticketed event is changed from Business
do $$declare f record; body text;
begin
 select p.oid,p.prosrc into f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_event_save';
 body:=replace(f.prosrc,'evenimente.''; end if;','evenimente.''; end if;
 if p_id is not null and exists(select 1 from public.events where id=p_id and sale_mode=''cefaci'') then raise exception ''Evenimentul are bilete vândute prin CeFaci; îl schimbă localul din Business.''; end if;');
 if body=f.prosrc then raise exception 'admin_event_save: nu am găsit locul pentru verificare'; end if;
 execute replace(pg_get_functiondef(f.oid),f.prosrc,body);
end $$;

revoke all on function public.ticket_order_start(uuid,jsonb),public.ticket_order_cancel(uuid),public.ticket_order_test_pay(uuid),public.ticket_order_paid(uuid,text,numeric),
 public.my_tickets(),public.ticket_transfer(uuid,uuid),public.biz_ticket_events(text),public.biz_ticket_payout_request(text,jsonb),public.biz_ticket_event_save(text,uuid,jsonb),
 public.biz_ticket_scan(text,text),public.admin_ticket_payouts(),public.admin_ticket_payout_set(text,text,text,text) from public,anon,authenticated;
grant execute on function public.ticket_order_start(uuid,jsonb),public.ticket_order_cancel(uuid),public.ticket_order_test_pay(uuid),public.my_tickets(),public.ticket_transfer(uuid,uuid),
 public.biz_ticket_events(text),public.biz_ticket_payout_request(text,jsonb),public.biz_ticket_event_save(text,uuid,jsonb),public.biz_ticket_scan(text,text),
 public.admin_ticket_payouts(),public.admin_ticket_payout_set(text,text,text,text) to authenticated;
grant execute on function public.ticket_order_paid(uuid,text,numeric) to service_role;
notify pgrst,'reload schema';
