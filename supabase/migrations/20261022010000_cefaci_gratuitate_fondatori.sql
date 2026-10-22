-- Gratuitatea (Cornel, 22.10): localurile fondatoare (primele 20) au o lună gratis de la activare; ceilalți parteneri
-- plătesc 10% din bon din prima zi, fără lună gratuită. Fără prelungire „până la primul om adus”.
-- admin_partner_save are deja garda 2FA pusă de 20261009213831, așa că schimbăm doar intervalul din corpul ei.
do $$declare f text; body text; fixed text;
begin
 select pg_get_functiondef(p.oid),p.prosrc into f,body from pg_proc p where p.oid='public.admin_partner_save(text,text,text,boolean,text,text)'::regprocedure;
 fixed:=replace(body,'case when p_founder then interval ''3 months'' else interval ''1 month'' end','case when p_founder then interval ''1 month'' else interval ''0 days'' end');
 if fixed=body then raise exception 'admin_partner_save: nu găsesc regula veche a lunilor gratuite.'; end if;
 execute replace(f,body,fixed);
end $$;
