-- De lipit în Supabase → SQL Editor → Run, ÎN ZIUA în care aplicația apare pe Google Play (Cornel, 31.10:
-- „trb scoasă limita aia când aplicația apare pe Google Play, la 1000 de persoane vor fi mai mult de 30 de bonuri pe zi”).
-- Nu scoatem limitele de tot (fără ele, oricine cu cont gratuit poate umfla factura Google, docs/securitate.md #1):
-- le ridicăm pe cele ieftine. Limitele pe om rămân.
--
-- Cost maxim, dacă cotele ar fi folosite până la capăt (Google Vision: ~1,5 $ la 1.000 de poze, primele 1.000 pe lună gratuite):
--   bon (clienți)    300 pe zi → ~9.000 pe lună → ~12 $
--   bon_local (ospătari) 1.000 pe zi → ~30.000 pe lună → ~44 $, doar dacă ai suficienți parteneri care scanează
-- „e-deschis” (Places, ~20 $ la 1.000 de verificări) rămâne la 30 pe zi (în cota gratuită) până trecem verificarea pe „doar planul ales”
-- (~40 $ pe lună la 1.200 de oameni) sau până sunt bani de la parteneri; apoi se mărește tot aici.
create or replace function private.quota(kind text) returns int[]
language sql immutable set search_path = '' as $$
  select case kind
    when 'e-deschis' then array[12, 24, 30]     -- locuri verificate: pe oră de om, pe zi de om, pe zi în toată aplicația
    when 'bon'       then array[2, 3, 300]      -- poze de bon citite (clienți): pe oră de om, pe zi de om, pe zi în toată aplicația
    when 'bon_local' then array[30, 100, 1000]  -- poze de notă făcute de ospătari
    else array[0, 0, 0] end
$$;
revoke all on function private.quota(text) from public;
