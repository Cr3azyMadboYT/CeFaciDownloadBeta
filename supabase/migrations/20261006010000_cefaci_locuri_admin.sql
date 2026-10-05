-- Locurile în Supabase, modificabile din Admin (decizie Cornel, 06.10: „să fie toate în Supabase și modificabile
-- din admin”; „admin cu roluri, să nu aibă viitorii angajați puteri de fondator”).
--
-- public.venues ține acum tot locul: `data` (cum vine de pe hartă și din cercetare, prin import) și `edit` (ce s-a
-- schimbat de mână din Admin, pus peste `data`; importul nu-l atinge niciodată). `status`: on (în aplicație), hidden
-- (ascuns din Admin), gone (a dispărut de pe hartă). Aplicația are în ea copia de la build și ia de aici doar ce s-a
-- schimbat după (`updated_at`).
--
-- Echipa: public.staff, cu rolurile fondator, admin, editor, moderator, suport, contabil. Tot ce schimbă locurile
-- trece prin funcții care verifică rolul și scriu în jurnal (public.venue_log): cine, ce, înainte, după.

alter table public.venues
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists edit jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'on',
  add column if not exists source text not null default 'osm',
  add column if not exists edited_by uuid,
  add column if not exists edited_at timestamptz;
alter table public.venues drop constraint if exists venues_status_ok;
alter table public.venues add constraint venues_status_ok check (status in ('on', 'hidden', 'gone'));
alter table public.venues drop constraint if exists venues_source_ok;
alter table public.venues add constraint venues_source_ok check (source in ('osm', 'cercetare', 'admin'));
create index if not exists venues_updated on public.venues (updated_at);

-- the places are public: the app reads them before and after sign-in
drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select to anon, authenticated using (true);
grant select on public.venues to anon;

-- ---------- the team ----------
create table if not exists public.staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('fondator', 'admin', 'editor', 'moderator', 'suport', 'contabil')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function private.staff_role(u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.staff where user_id = u
$$;
revoke all on function private.staff_role(uuid) from public;
grant execute on function private.staff_role(uuid) to authenticated;

-- what each role may do (one place to read and to change):
--   fondator  tot, inclusiv echipa și banii
--   admin     locuri, cereri, semnalări, localuri partenere, dispute; adaugă în echipă doar editori, moderatori, suport
--   editor    locuri: modifică, adaugă, ascunde; cererile de locuri noi
--   moderator semnalări și cereri; ascunde un loc, nu-l modifică
--   suport    vede tot ce e de văzut, nu schimbă nimic
--   contabil  deconturi și plăți (când vor exista)
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
      when 'money'         then s.role in ('fondator', 'contabil')
      else false end
    from public.staff s where s.user_id = (select auth.uid())), false)
$$;
revoke all on function private.can(text) from public;
grant execute on function private.can(text) to authenticated;

create policy staff_read on public.staff for select to authenticated using (user_id = (select auth.uid()) or private.can('staff.read'));

/** Adds someone to the team or changes their role. Only the founder makes founders or admins; an admin adds only
 *  editors, moderators and support, and cannot change a founder or another admin. Nobody changes their own role. */
create or replace function public.staff_set(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function public.staff_set(uuid, text) from public;
grant execute on function public.staff_set(uuid, text) to authenticated;

create or replace function public.staff_remove(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); mine text := private.staff_role(me); theirs text := private.staff_role(p_user);
begin
  if p_user = me then raise exception 'Nu te poți scoate singur din echipă.'; end if;
  if mine is distinct from 'fondator' and (mine is distinct from 'admin' or theirs in ('fondator', 'admin', 'contabil')) then
    raise exception 'Nu ai voie să scoți pe cineva cu acest rol.';
  end if;
  delete from public.staff where user_id = p_user;
end $$;
revoke all on function public.staff_remove(uuid) from public;
grant execute on function public.staff_remove(uuid) to authenticated;

-- ---------- the log of every change to a place ----------
create table if not exists public.venue_log (
  id bigint generated always as identity primary key,
  venue_id text not null,
  by_user uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('edit', 'add', 'hide', 'show', 'undo')),
  before jsonb,
  after jsonb,
  note text check (char_length(note) <= 300),
  at timestamptz not null default now()
);
create index if not exists venue_log_venue on public.venue_log (venue_id, at desc);
alter table public.venue_log enable row level security;
create policy venue_log_read on public.venue_log for select to authenticated using (private.can('staff.read'));

-- the fields a person may change by hand (everything else comes from the map and the research)
create or replace function private.clean_edit(e jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(coalesce(e, '{}'::jsonb))
  where key in ('name', 'k', 'cat', 'kind', 'cuisines', 'lat', 'lon', 'street', 'city', 'zone', 'hours', 'wk', 'phone', 'website',
                'price', 'story', 'crowd', 'vibes', 'outdoor', 'pick', 'rated', 'minAge', 'wifi', 'smoke', 'wheelchair', 'ac', 'famous')
$$;

/** Changes a place: the fields given replace the ones there (null removes a change and goes back to the map's value). */
create or replace function public.admin_place_save(p_id text, p_edit jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.venues; e jsonb; merged jsonb;
begin
  if not private.can('places.edit') then raise exception 'Nu ai voie să modifici locuri.'; end if;
  select * into v from public.venues where id = p_id for update;
  if not found then raise exception 'Locul nu există.'; end if;
  e := jsonb_strip_nulls(v.edit || private.clean_edit(p_edit));
  merged := v.data || e;
  update public.venues set edit = e, name = coalesce(merged->>'name', name), cat = coalesce(merged->>'cat', cat),
    lat = coalesce((merged->>'lat')::double precision, lat), lon = coalesce((merged->>'lon')::double precision, lon),
    edited_by = auth.uid(), edited_at = now(), updated_at = now() where id = p_id;
  insert into public.venue_log (venue_id, by_user, action, before, after, note) values (p_id, auth.uid(), 'edit', v.edit, e, p_note);
  return merged;
end $$;
revoke all on function public.admin_place_save(text, jsonb, text) from public;
grant execute on function public.admin_place_save(text, jsonb, text) to authenticated;

/** Adds a new place by hand (from a client's "Lipsește un loc?" or found by us): id "a-…", source admin. */
create or replace function public.admin_place_add(p_data jsonb, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare d jsonb := private.clean_edit(p_data); nid text := 'a-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
begin
  if not private.can('places.edit') then raise exception 'Nu ai voie să adaugi locuri.'; end if;
  if coalesce(d->>'name', '') = '' or d->>'k' is null or d->>'cat' is null or d->>'lat' is null or d->>'lon' is null then
    raise exception 'Un loc nou are nevoie de nume, fel, categorie și poziție.';
  end if;
  d := d || jsonb_build_object('id', nid, 'pick', true);
  insert into public.venues (id, name, cat, lat, lon, data, source, status, edited_by, edited_at, updated_at)
    values (nid, d->>'name', d->>'cat', (d->>'lat')::double precision, (d->>'lon')::double precision, d, 'admin', 'on', auth.uid(), now(), now());
  insert into public.venue_log (venue_id, by_user, action, after, note) values (nid, auth.uid(), 'add', d, p_note);
  return nid;
end $$;
revoke all on function public.admin_place_add(jsonb, text) from public;
grant execute on function public.admin_place_add(jsonb, text) to authenticated;

/** Hides a place from the app (or shows it again). */
create or replace function public.admin_place_status(p_id text, p_hidden boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.venues;
begin
  if not private.can('places.hide') then raise exception 'Nu ai voie să ascunzi locuri.'; end if;
  select * into v from public.venues where id = p_id for update;
  if not found then raise exception 'Locul nu există.'; end if;
  if v.status = 'gone' and not p_hidden then raise exception 'Locul a dispărut de pe hartă: adaugă-l din nou.'; end if;
  update public.venues set status = case when p_hidden then 'hidden' else 'on' end, edited_by = auth.uid(), edited_at = now(), updated_at = now() where id = p_id;
  insert into public.venue_log (venue_id, by_user, action, note) values (p_id, auth.uid(), case when p_hidden then 'hide' else 'show' end, p_note);
end $$;
revoke all on function public.admin_place_status(text, boolean, text) from public;
grant execute on function public.admin_place_status(text, boolean, text) to authenticated;

/** The map and research import (service role only, from the OSM and Google workflows): new places in, changed ones
 *  updated, the ones gone from the map marked gone. Never touches what was changed by hand (`edit`), a place hidden
 *  from Admin, or a place added from Admin. `p_at`: when the app's copy was made, so the app does not download again
 *  what it already has. */
create or replace function public.import_places(p_rows jsonb, p_at timestamptz, p_full boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_new int := 0; n_upd int := 0; n_gone int := 0; r jsonb;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into public.venues (id, name, cat, lat, lon, data, source, status, updated_at)
      values (r->>'id', r->>'name', r->>'cat', (r->>'lat')::double precision, (r->>'lon')::double precision, r,
              case when coalesce((r->>'pick')::boolean, false) then 'cercetare' else 'osm' end, 'on', p_at)
      on conflict (id) do update set
        data = excluded.data, source = excluded.source,
        name = coalesce(public.venues.edit->>'name', excluded.name), cat = coalesce(public.venues.edit->>'cat', excluded.cat),
        lat = coalesce((public.venues.edit->>'lat')::double precision, excluded.lat), lon = coalesce((public.venues.edit->>'lon')::double precision, excluded.lon),
        status = case when public.venues.status = 'gone' then 'on' else public.venues.status end,
        updated_at = case when public.venues.data is distinct from excluded.data or public.venues.status = 'gone' then greatest(p_at, now()) else public.venues.updated_at end
      where public.venues.source <> 'admin';
    if found then n_upd := n_upd + 1; end if;
  end loop;
  if p_full then
    update public.venues set status = 'gone', updated_at = greatest(p_at, now())
      where source <> 'admin' and status = 'on' and id not in (select value->>'id' from jsonb_array_elements(p_rows));
    get diagnostics n_gone = row_count;
  end if;
  return jsonb_build_object('rows', jsonb_array_length(p_rows), 'written', n_upd, 'gone', n_gone);
end $$;
revoke all on function public.import_places(jsonb, timestamptz, boolean) from public;

-- ---------- what clients send: staff can read it and close it ----------
alter table public.reports
  add column if not exists status text not null default 'nou',
  add column if not exists handled_by uuid references public.profiles (id) on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists answer text check (char_length(answer) <= 300);
alter table public.reports drop constraint if exists reports_status_ok;
alter table public.reports add constraint reports_status_ok check (status in ('nou', 'rezolvat', 'respins'));
drop policy if exists reports_staff_read on public.reports;
create policy reports_staff_read on public.reports for select to authenticated using (private.can('reports.read'));

create or replace function public.admin_report_close(p_id uuid, p_status text, p_answer text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can('reports.close') then raise exception 'Nu ai voie să închizi semnalări.'; end if;
  if p_status not in ('rezolvat', 'respins') then raise exception 'Stare necunoscută.'; end if;
  update public.reports set status = p_status, handled_by = auth.uid(), handled_at = now(), answer = p_answer where id = p_id;
end $$;
revoke all on function public.admin_report_close(uuid, text, text) from public;
grant execute on function public.admin_report_close(uuid, text, text) to authenticated;
