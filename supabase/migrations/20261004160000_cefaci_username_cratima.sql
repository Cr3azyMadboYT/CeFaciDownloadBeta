-- Username (decision Cornel, 04.10): letters, digits and only the signs . - _ (3–20 characters).
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username ~ '^[a-z0-9._-]{3,20}$');

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(p_username) ~ '^[a-z0-9._-]{3,20}$' and not exists (select 1 from public.profiles where username = lower(p_username))
$$;
