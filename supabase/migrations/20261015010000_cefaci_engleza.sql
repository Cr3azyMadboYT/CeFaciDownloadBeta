-- Versiunea în engleză (15.10): povestea și „când e lume” se pot scrie și în engleză din Admin (story_en, crowd_en);
-- aplicația le arată când omul a ales EN și cade pe română când lipsesc.
create or replace function private.clean_edit(e jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(coalesce(e, '{}'::jsonb))
  where key in ('name', 'k', 'cat', 'kind', 'cuisines', 'lat', 'lon', 'street', 'city', 'zone', 'hours', 'wk', 'phone', 'website',
                'price', 'story', 'crowd', 'story_en', 'crowd_en', 'vibes', 'outdoor', 'pick', 'rated', 'minAge', 'wifi', 'smoke', 'wheelchair', 'ac', 'famous')
$$;

-- Notificările în limba telefonului: fiecare token ține limba aleasă în aplicație (trimite-notificare o citește).
alter table public.push_tokens add column if not exists lang text not null default 'ro' check (lang in ('ro', 'en'));

-- telefonul o scrie singur după push_token_save (politica push_tokens_own_change: doar rândul lui)
