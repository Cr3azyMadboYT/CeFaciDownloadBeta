-- Comutator pentru regula „proba Plus o dată pe telefon” (31.10, Cornel: „scoate acum chestia cu plus odată pe device ca
-- să pot face cont nou”, cât testăm). Oprită acum; la lansare se pornește din SQL Editor:
--   update private.switches set enabled = true where key = 'proba_pe_telefon';
-- Telefoanele rămân notate în private.trial_devices și cât e oprită, deci regula prinde din nou imediat ce e pornită.
create table if not exists private.switches (
  key text primary key check (char_length(key) <= 60),
  enabled boolean not null,
  changed_at timestamptz not null default now()
);
alter table private.switches enable row level security;
revoke all on private.switches from anon, authenticated;
insert into private.switches (key, enabled) values ('proba_pe_telefon', false) on conflict (key) do nothing;

create or replace function public.start_plus_trial(p_device text)
 returns timestamp with time zone
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); started timestamptz; dev text; owner uuid;
begin
if me is null then raise exception 'Intră întâi în cont.' using errcode = '28000'; end if;
select plus_trial_started_at into started from public.profile_private where id = me;
if started is not null then return started; end if;
if coalesce(p_device, '') !~ '^[0-9a-f]{64}$' then raise exception 'Actualizează aplicația ca să pornești proba gratuită.'; end if;
dev := encode(sha256(convert_to('cefaci.proba:' || p_device, 'UTF8')), 'hex');
perform pg_advisory_xact_lock(hashtext(dev));
select user_id into owner from private.trial_devices where device = dev;
if found and owner is distinct from me
   and coalesce((select enabled from private.switches where key = 'proba_pe_telefon'), true) then
raise exception 'Săptămâna gratuită de Plus s-a folosit deja pe telefonul ăsta.' using errcode = 'P0001', hint = 'proba-folosita'; end if;
insert into private.trial_devices (device, user_id) values (dev, me) on conflict (device) do nothing;
perform set_config('cefaci.trial', 'on', true);
update public.profile_private set plus_trial_started_at = now() where id = me returning plus_trial_started_at into started;
perform set_config('cefaci.trial', 'off', true);
return started;
end $function$;
