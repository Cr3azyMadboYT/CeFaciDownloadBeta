-- Cotele Google doar în partea gratuită (Cornel, 07.10: „de unde o să-mi permit 220 de dolari?”). Google dă gratis
-- cam 1.000 de verificări de program pe lună și 1.000 de bonuri citite: pe zi, pentru toată aplicația, 30 din fiecare.
-- Peste ele, planul rămâne cum l-a făcut Bilu (fără „Verificat acum pe Google”) și bonul nu se citește până a doua zi.
-- Când vin banii (parteneri, Plus), se mărește aici, într-un singur loc.
create or replace function private.quota(kind text) returns int[]
language sql immutable set search_path = '' as $$
  select case kind
    when 'e-deschis' then array[12, 24, 30]   -- locuri verificate: pe oră de om, pe zi de om, pe zi în toată aplicația
    when 'bon'       then array[2, 3, 30]     -- poze de bon citite
    else array[0, 0, 0] end
$$;
revoke all on function private.quota(text) from public;
