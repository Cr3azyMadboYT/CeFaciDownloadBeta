-- Evenimente (Cornel, 22.10: „concertele pe Acasă și Explorează … gândit bine cu biletele, lucrăm cu banii altora”).
-- Faza 1: CeFaci arată evenimentele și trimite la vânzătorul oficial. Banii nu trec prin noi: nu vindem, nu încasăm,
-- nu rambursăm. Linkul de bilete poate fi doar https și doar la un vânzător din lista private.ticket_sellers (nu
-- poate fi un site oarecare, deci nici o pagină de phishing pusă din greșeală). Echipa adaugă evenimentele din Admin
-- (dreptul places.edit, sesiunea Admin cu 2FA). Clientul vede doar cele publicate, viitoare, cu contul deschis.
-- Scoaterea completă: docs/evenimente.md („Cum se scoate”).

create table private.ticket_sellers(
 host text primary key check(host ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
 name text not null check(length(name) between 2 and 40));
alter table private.ticket_sellers enable row level security;
revoke all on private.ticket_sellers from public,anon,authenticated;
insert into private.ticket_sellers(host,name) values
 ('iabilet.ro','iaBilet'),('eventbook.ro','Eventbook'),('entertix.ro','Entertix'),('livetickets.ro','LiveTickets'),
 ('myticket.ro','MyTicket'),('bilete.ro','Bilete.ro'),('ambilet.ro','AmBilet'),('oveit.com','Oveit'),('eventim.ro','Eventim'),
 ('ticketstore.ro','TicketStore'),('feverup.com','Fever');

/** The seller of an https link (its host or a subdomain of it), or null. */
create function private.ticket_seller(url text) returns text
language sql stable security definer set search_path='' as $$
 select s.name from private.ticket_sellers s
 where url ~ '^https://[^/?#@\s]+(/[^\s]*)?$'
 and (lower(substring(url from '^https://([^/?#:]+)')) = s.host or lower(substring(url from '^https://([^/?#:]+)')) like '%.' || s.host)
 limit 1
$$;
revoke all on function private.ticket_seller(text) from public,anon,authenticated;

create table public.events(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 120),
 kind text not null check(kind in('concert','party','standup','teatru','festival','expozitie','sport','altele')),
 starts_at timestamptz not null,
 ends_at timestamptz check(ends_at is null or ends_at > starts_at),
 venue_id text references public.venues(id) on delete set null,
 place_name text not null check(length(trim(place_name)) between 2 and 120),
 address text check(address is null or length(address) <= 200),
 lat double precision not null check(lat between 43 and 49),
 lon double precision not null check(lon between 20 and 30),
 price_from numeric(8,2) check(price_from is null or price_from >= 0),
 price_to numeric(8,2) check(price_to is null or (price_to >= coalesce(price_from,0))),
 ticket_url text check(ticket_url is null or length(ticket_url) <= 500),
 seller text,
 min_age int check(min_age is null or min_age between 0 and 21),
 about text check(about is null or length(about) <= 600),
 about_en text check(about_en is null or length(about_en) <= 600),
 status text not null default 'draft' check(status in('draft','published','sold_out','postponed','cancelled')),
 created_by uuid references public.profiles(id) on delete set null,
 updated_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
create index events_when on public.events(starts_at) where status <> 'draft';
alter table public.events enable row level security;
revoke all on public.events from public,anon,authenticated;
grant select on public.events to authenticated;
-- the client sees what is published (also sold out, postponed or cancelled, so a saved event still says what happened),
-- from 12 hours ago (a concert that started at 21:00 still shows at 23:00) to 60 days ahead
create policy events_read on public.events for select to authenticated
 using(status <> 'draft' and coalesce(ends_at, starts_at + interval '6 hours') > now() - interval '12 hours' and starts_at < now() + interval '60 days');

-- who opened the tickets: one row per person, event and day (interest for later talks with sellers; no money)
create table private.event_clicks(
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null default (now() at time zone 'Europe/Bucharest')::date,
 primary key(event_id,user_id,day));
alter table private.event_clicks enable row level security;
revoke all on private.event_clicks from public,anon,authenticated;

create table private.event_log(
 id bigint generated always as identity primary key,
 event_id uuid not null references public.events(id) on delete cascade,
 action text not null, by_user uuid references public.profiles(id) on delete set null,
 at timestamptz not null default now(), note text);
alter table private.event_log enable row level security;
revoke all on private.event_log from public,anon,authenticated;

/** "Cumpără bilete": the checked link to the official seller, and the click counted. */
create function public.event_ticket_url(p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.events; seller text;
begin
 if auth.uid() is null then raise exception 'Intră în cont ca să vezi biletele.'; end if;
 select * into e from public.events where id=p_event and status in('published','postponed');
 if e.id is null or e.ticket_url is null then raise exception 'Biletele nu sunt disponibile pentru acest eveniment.'; end if;
 seller:=private.ticket_seller(e.ticket_url);
 if seller is null then raise exception 'Biletele nu sunt disponibile pentru acest eveniment.'; end if;
 if coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then raise exception 'Evenimentul s-a terminat.'; end if;
 insert into private.event_clicks(event_id,user_id) values(e.id,auth.uid()) on conflict do nothing;
 return jsonb_build_object('url',e.ticket_url,'seller',seller);
end $$;
revoke all on function public.event_ticket_url(uuid) from public,anon,authenticated;
grant execute on function public.event_ticket_url(uuid) to authenticated;

/** Admin: the events from a day on (drafts too), with how many people opened the tickets. */
create function public.admin_events(p_from date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_secure_scope('admin');
 if not private.can('places.edit') then raise exception 'Nu ai voie să gestionezi evenimente.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('clicks',(select count(*) from private.event_clicks c where c.event_id=e.id)) order by e.starts_at)
  from public.events e where e.starts_at >= coalesce(p_from,(now() at time zone 'Europe/Bucharest')::date - 1)::timestamp at time zone 'Europe/Bucharest'),'[]');
end $$;
revoke all on function public.admin_events(date) from public,anon,authenticated;
grant execute on function public.admin_events(date) to authenticated;

/** Admin: a new event (p_id null) or a change; every save is logged. */
create function public.admin_event_save(p_id uuid,p jsonb) returns public.events
language plpgsql security definer set search_path='' as $$
declare e public.events; v public.venues; url text:=nullif(trim(p->>'ticket_url'),''); seller text; st text:=coalesce(p->>'status','draft');
begin
 perform private.require_secure_scope('admin');
 if not private.can('places.edit') then raise exception 'Nu ai voie să gestionezi evenimente.'; end if;
 if url is not null then
  seller:=private.ticket_seller(url);
  if seller is null then raise exception 'Linkul de bilete trebuie să fie https și de la un vânzător oficial din listă.'; end if;
 end if;
 if st in('published','postponed') and url is null then raise exception 'Un eveniment publicat are nevoie de linkul vânzătorului oficial.'; end if;
 if nullif(p->>'venue_id','') is not null then
  select * into v from public.venues where id=p->>'venue_id';
  if v.id is null then raise exception 'Locul nu există în CeFaci.'; end if;
 end if;
 if (p->>'starts_at')::timestamptz < now() - interval '1 day' and p_id is null then raise exception 'Data a trecut.'; end if;
 if p_id is null then
  insert into public.events(title,kind,starts_at,ends_at,venue_id,place_name,address,lat,lon,price_from,price_to,ticket_url,seller,min_age,about,about_en,status,created_by,updated_by)
  values(trim(p->>'title'),p->>'kind',(p->>'starts_at')::timestamptz,nullif(p->>'ends_at','')::timestamptz,v.id,
   coalesce(nullif(trim(p->>'place_name'),''),coalesce(v.edit->>'name',v.name)),nullif(trim(p->>'address'),''),
   coalesce(nullif(p->>'lat','')::float8,v.lat),coalesce(nullif(p->>'lon','')::float8,v.lon),
   nullif(p->>'price_from','')::numeric,nullif(p->>'price_to','')::numeric,url,seller,nullif(p->>'min_age','')::int,
   nullif(trim(p->>'about'),''),nullif(trim(p->>'about_en'),''),st,auth.uid(),auth.uid()) returning * into e;
  insert into private.event_log(event_id,action,by_user,note) values(e.id,'adăugat',auth.uid(),st);
 else
  update public.events set title=trim(p->>'title'),kind=p->>'kind',starts_at=(p->>'starts_at')::timestamptz,ends_at=nullif(p->>'ends_at','')::timestamptz,venue_id=v.id,
   place_name=coalesce(nullif(trim(p->>'place_name'),''),coalesce(v.edit->>'name',v.name),place_name),address=nullif(trim(p->>'address'),''),
   lat=coalesce(nullif(p->>'lat','')::float8,v.lat,lat),lon=coalesce(nullif(p->>'lon','')::float8,v.lon,lon),
   price_from=nullif(p->>'price_from','')::numeric,price_to=nullif(p->>'price_to','')::numeric,ticket_url=url,seller=seller,
   min_age=nullif(p->>'min_age','')::int,about=nullif(trim(p->>'about'),''),about_en=nullif(trim(p->>'about_en'),''),status=st,updated_by=auth.uid(),updated_at=now()
  where id=p_id returning * into e;
  if e.id is null then raise exception 'Evenimentul nu există.'; end if;
  insert into private.event_log(event_id,action,by_user,note) values(e.id,'modificat',auth.uid(),st);
 end if;
 return e;
end $$;
revoke all on function public.admin_event_save(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_event_save(uuid,jsonb) to authenticated;
