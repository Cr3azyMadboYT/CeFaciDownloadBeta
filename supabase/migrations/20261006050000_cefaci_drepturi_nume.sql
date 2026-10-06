-- 1) Drepturi (verificarea din 06.10): pe Supabase, orice funcție nouă din `public` primește automat drept de rulare
--    pentru `anon` (oricine are cheia publică din APK) și `authenticated`; „revoke … from public” nu le scoate.
--    `import_places` (doar pentru urcarea locurilor, cu cheia de serviciu) rămăsese deschisă: cu cheia publică se
--    puteau marca toate locurile „gone”. Acum: închisă pentru aplicație + verificare în funcție.
-- 2) Numele urâte (decizie Cornel, 06.10): prenume, username și numele gășcii nu pot fi vulgare, nici scrise „pe ocolite”.
--    Aceeași regulă ca în aplicație (src/app/names.ts); testele compară listele.

-- ---------- 1. drepturi ----------
create or replace function public.import_places(p_rows jsonb, p_at timestamptz, p_full boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n_new int := 0; n_upd int := 0; n_gone int := 0; r jsonb;
begin
  -- doar cheia de serviciu (workflow-urile de pe GitHub) sau cineva din SQL Editor
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Doar serverul poate urca locurile.' using errcode = '42501';
  end if;
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
revoke all on function public.import_places(jsonb, timestamptz, boolean) from public, anon, authenticated;

-- funcțiile pentru cei intrați în cont nu sunt pentru `anon` (aveau doar „revoke from public”)
revoke all on function public.staff_set(uuid, text), public.staff_remove(uuid), public.admin_place_save(text, jsonb, text),
  public.admin_place_add(jsonb, text), public.admin_place_status(text, boolean, text), public.admin_report_close(uuid, text, text),
  public.crew_has_minor(uuid) from anon;

-- de acum, o funcție nouă nu mai poate fi rulată din aplicație până nu primește drept explicit
-- (toate migrările dau deja „grant execute … to authenticated” unde trebuie; ATENȚIE: și funcțiile noi din `private`
-- folosite în reguli au nevoie de „grant execute … to authenticated”). Dreptul pentru `public` (toată lumea) se
-- scoate doar global, nu pe schemă (așa merge Postgres).
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- ---------- 2. nume urâte ----------
create or replace function private.rude(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  anywhere text[] := array['pizd', 'cacat', 'muist', 'futut', 'futai', 'futui', 'labagi', 'bulangi', 'poponar', 'sloboz', 'fucboi', 'fucer', 'fucing', 'fucof', 'bitch', 'hitler', 'pulamea'];
  edge text[] := array['pula', 'pule', 'muie', 'pisat', 'coaie', 'curva', 'shit', 'cunt', 'porno', 'dildo', 'penis', 'vagin'];
  exact text[] := array['sula', 'cur', 'curu', 'fut', 'fute', 'futu', 'puli', 'plm', 'pzd', 'pzda', 'fm', 'fuc', 'fucu', 'mue', 'muje', 'suge', 'sugi', 'coi', 'sex', 'porn', 'nazi', 'niga', 'naiba', 'dracu', 'jeg', 'jegos', 'bou', 'prost', 'idiot', 'retard', 'handicapat', 'tampit', 'morti', 'pis', 'pisu'];
  base text; leet text; s text; w text; r text; words text[]; glued text;
begin
  if p is null or p = '' then return false; end if;
  base := translate(lower(p), 'ăâîșşțţáàäãéèëêíìïóòöôõúùüûýykqw', 'aaissttaaaaeeeeiiiooooouuuuiiccu');
  leet := translate(base, '03457@$!', 'oeastasi');
  foreach s in array array[translate(leet, '1|', 'ii'), translate(leet, '1|', 'll'), base] loop
    select coalesce(array_agg(regexp_replace(x, '(.)\1+', '\1', 'g')), '{}') into words
      from regexp_split_to_table(s, '[^a-z]+') x where x <> '';
    foreach w in array words loop
      if w = any(exact) then return true; end if;
      foreach r in array edge loop
        if left(w, length(r)) = r or right(w, length(r)) = r then return true; end if;
      end loop;
      foreach r in array anywhere loop
        if position(r in w) > 0 then return true; end if;
      end loop;
    end loop;
    if cardinality(words) > 1 then
      glued := regexp_replace(array_to_string(words, ''), '(.)\1+', '\1', 'g');
      if glued = any(exact) or glued = any(edge) then return true; end if;
      foreach r in array anywhere loop
        if position(r in glued) > 0 then return true; end if;
      end loop;
    end if;
  end loop;
  return false;
end $$;
revoke all on function private.rude(text) from public;
grant execute on function private.rude(text) to authenticated;

create or replace function private.names_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'profiles' then
    if (tg_op = 'INSERT' or new.first_name is distinct from old.first_name) and private.rude(new.first_name)
       or (tg_op = 'INSERT' or new.username is distinct from old.username) and private.rude(new.username) then
      raise exception 'Te rog alege alt nume, acesta nu prea pare potrivit.' using errcode = 'check_violation';
    end if;
  elsif (tg_op = 'INSERT' or new.name is distinct from old.name) and private.rude(new.name) then
    raise exception 'Te rog alege alt nume pentru gașcă, acesta nu prea pare potrivit.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function private.names_guard() from public;

drop trigger if exists profiles_names_guard on public.profiles;
create trigger profiles_names_guard before insert or update of first_name, username on public.profiles
  for each row execute function private.names_guard();
drop trigger if exists crews_names_guard on public.crews;
create trigger crews_names_guard before insert or update of name on public.crews
  for each row execute function private.names_guard();
