-- Proba gratuită de Plus: o dată pe telefon, nu pe cont (Cornel, 06.10: „să nu facă 4–5 conturi ca să ia pe fiecare o
-- săptămână de Plus”). Telefonul trimite un cod al lui, deja amestecat (sha256 din ANDROID_ID, care rămâne la fel și
-- după reinstalare); aici se amestecă încă o dată și se păstrează doar rezultatul, fără legătură cu contul (rămâne și
-- după ștergerea contului, altfel ștergi contul și o iei de la capăt).

create table private.trial_devices (
  device text primary key,                 -- sha256 hex, nu codul telefonului
  user_id uuid,                            -- primul cont care a luat proba pe telefonul ăsta (doar pentru același cont pe alt telefon)
  started_at timestamptz not null default now()
);
alter table private.trial_devices enable row level security;

-- proba se pornește doar prin start_plus_trial (nici dintr-un update direct, nici la crearea contului)
create or replace function private.profile_private_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.birth_date := old.birth_date;
  if coalesce(current_setting('cefaci.trial', true), '') <> 'on' then new.plus_trial_started_at := old.plus_trial_started_at;
  else new.plus_trial_started_at := coalesce(old.plus_trial_started_at, new.plus_trial_started_at); end if;
  if coalesce(current_setting('cefaci.plus', true), '') <> 'on' then new.plus_until := old.plus_until; end if;
  new.updated_at := now();
  return new;
end $$;

drop function if exists public.start_plus_trial();
-- pornește săptămâna gratuită prima dată; după aceea spune doar când a început.
-- Același cont pe alt telefon: rămâne proba lui. Alt cont pe un telefon care a avut deja proba: nu.
create or replace function public.start_plus_trial(p_device text default null) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); started timestamptz; dev text; owner uuid;
begin
  if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
  select plus_trial_started_at into started from public.profile_private where id = me;
  if started is not null then return started; end if;
  if coalesce(p_device, '') !~ '^[0-9a-f]{64}$' then raise exception 'Actualizează aplicația ca să pornești proba gratuită.'; end if;
  dev := encode(sha256(convert_to('cefaci.proba:' || p_device, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtext(dev));
  select user_id into owner from private.trial_devices where device = dev;
  if found and owner is distinct from me then
    raise exception 'Săptămâna gratuită de Plus s-a folosit deja pe telefonul ăsta.' using errcode = 'P0001', hint = 'proba-folosita'; end if;
  insert into private.trial_devices (device, user_id) values (dev, me) on conflict (device) do nothing;
  perform set_config('cefaci.trial', 'on', true);
  update public.profile_private set plus_trial_started_at = now() where id = me returning plus_trial_started_at into started;
  perform set_config('cefaci.trial', 'off', true);
  return started;
end $$;
revoke all on function public.start_plus_trial(text) from public, anon;
grant execute on function public.start_plus_trial(text) to authenticated;

-- la ștergerea contului, telefonul rămâne însemnat, dar fără cont
create or replace function private.trial_devices_forget() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.trial_devices set user_id = null where user_id = old.id;
  return old;
end $$;
revoke all on function private.trial_devices_forget() from public;
drop trigger if exists trial_devices_forget on public.profiles;
create trigger trial_devices_forget after delete on public.profiles for each row execute function private.trial_devices_forget();
