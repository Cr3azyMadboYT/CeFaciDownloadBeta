// Simularea lansării (31.10): tot drumul din spatele aplicației, pe o copie locală a bazei (PGlite, toate migrările în ordine),
// cum l-ar folosi Admin, Business și Clienții adevărați. Un singur fișier, o singură bază, pași numerotați.
// Verificările sunt „moi”: o greșeală nu ascunde restul; fiecare `it` pică dacă măcar o verificare din el pică.
// Raportul scris de mână: release/simulare-lansare-31-10.md. Rezumatul se tipărește la final (și în SIM_OUT, dacă e setat).
// Nu atinge Supabase-ul adevărat: nicio rețea, doar PGlite.
import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { ticketQr } from '../src/events/tickets';

let db: PGlite;
const NAMES = ['founder', 'admin', 'admin2', 'editor', 'moderator', 'suport', 'contabil', 'nomfa',
  'biz', 'biz2', 'waiter', 'manager', 'biz3',
  'ana', 'bob', 'cris', 'dan', 'eva', 'kid17', 'kid15', 'plusa', 'plusb', 'stranger', 'gone'] as const;
type Who = (typeof NAMES)[number];
const U = Object.fromEntries(NAMES.map((n, i) => [n, '00000000-0000-0000-0000-' + (0x5100 + i).toString(16).padStart(12, '0')])) as Record<Who, string>;
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function as(who: Who, sql: string, args: unknown[] = [], scopes = true) {
  await db.exec('reset role');
  await authenticateFixture(db, U[who], { scopes });
  await db.exec('set role authenticated');
  try { return await q(sql, args); } finally { await db.exec('reset role'); }
}
/** valoarea primului rând/coloană a unui `select <expr>` */
async function rpc(who: Who, expr: string, args: unknown[] = [], scopes = true) {
  return (await as(who, `select ${expr} result`, args, scopes)).rows[0]?.result;
}
/** apel de server (cheia de serviciu), ca funcția Edge `citeste-bon` */
async function svc(sql: string, args: unknown[] = []) {
  await db.exec("reset role; grant usage on schema public to service_role; select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false); set role service_role");
  try { return await q(sql, args); } finally { await db.exec("reset role; select set_config('request.jwt.claims','',false)"); }
}
async function anon(sql: string, args: unknown[] = []) {
  await db.exec('reset role; set role anon');
  try { return await q(sql, args); } finally { await db.exec('reset role'); }
}

// ---------- colectorul de verificări ----------
type Res = { stage: number; name: string; ok: boolean; detail?: string };
const results: Res[] = [];
const missing: string[] = [];          // pași fără RPC („lipsește”)
const notes: string[] = [];            // ambiguități
let stage = 0;
const stageNames: Record<number, string> = {};
async function chk(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); results.push({ stage, name, ok: true }); }
  catch (e: any) { results.push({ stage, name, ok: false, detail: String(e?.message ?? e).split('\n').slice(0, 4).join(' | ').slice(0, 600) }); }
}
const lipseste = (what: string) => { missing.push(`etapa ${stage}: ${what}`); };
const nota = (what: string) => { notes.push(`etapa ${stage}: ${what}`); };
function begin(n: number, name: string) { stage = n; stageNames[n] = name; }
function endStage() {
  const bad = results.filter((r) => r.stage === stage && !r.ok);
  expect(bad.map((b) => `${b.name} => ${b.detail}`), `etapa ${stage}: ${stageNames[stage]}`).toEqual([]);
}
const PERM = /Nu ai (voie|acces)|Doar echipa|Doar proprietarul|Sesiunea securizat|rezervat|permission denied|echipa|Nu ești|Nu participi|Intră întâi/i;
const denied = (p: Promise<unknown>, re: RegExp = PERM) => expect(p).rejects.toThrow(re);
const eq = (a: unknown, b: unknown) => expect(a).toEqual(b);
const money = (x: unknown) => Math.round(Number(x) * 100);

const OPEN_HOURS = JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ day: i + 1, from: '00:00', to: '23:59' })));
const when = (days: number) => new Date(Date.now() + days * 86400e3).toISOString();

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;create schema storage;create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec('grant usage on schema public to anon,authenticated');
  for (const [name, id] of Object.entries(U)) {
    // biz2 și stranger își fac profil abia când intră în Business / nu-l fac deloc (vezi etapa 3)
    await q("insert into auth.users(id,created_at) values($1,now()-interval '40 days')", [id]);
    await seedAuthFixture(db, id);
    if (name === 'kid15' || name === 'biz' || name === 'biz2') continue;
    const birth = name === 'kid17' ? new Date(Date.now() - 17.5 * 365.25 * 864e5).toISOString().slice(0, 10) : '1995-05-05';
    await as(name as Who, 'select complete_signup($1,$2,$3)', [name, name[0].toUpperCase() + name.slice(1), birth], false);
  }
}, 120000);


// =====================================================================================================
it('1. Echipa CeFaci: fondatorul devine admin, adaugă roluri, fiecare rol face doar ce are voie', async () => {
  begin(1, 'Echipa CeFaci');
  // prima instalare: fondatorul se pune în tabel de proprietarul bazei (nu există alt drum)
  await q("insert into staff(user_id,role) values($1,'fondator')", [U.founder]);
  await chk('fondatorul vede admin_me cu toate drepturile', async () => {
    const me = await rpc('founder', 'admin_me()');
    eq(me.role, 'fondator');
    for (const p of ['staff.manage', 'partners', 'money', 'money.read', 'founder', 'places.edit', 'operations.decide']) expect(me.permissions).toContain(p);
  });
  await chk('un client normal nu vede nicio permisiune (admin_me)', async () => {
    const r = await rpc('ana', 'admin_me()').catch((e) => e.message);
    if (typeof r === 'object') eq(r.permissions ?? [], []); else expect(String(r)).toMatch(PERM);
  });
  await chk('căutarea echipei cere @username exact (3-30), nu face căutare parțială', async () => {
    await denied(rpc('founder', "admin_staff_search('ad')"), /username/);
    eq(await rpc('founder', "admin_staff_search('@admin')"), [{ user_id: U.admin, username: 'admin' }]);
  });
  const add = (who: Who, target: Who, role: string | null, expected: string | null = null, note = 'Motiv de test pentru echipă') =>
    rpc(who, 'admin_staff_change($1,$2,$3,$4)', [U[target], role, note, expected]);
  await chk('fondatorul adaugă un admin (cu jurnal)', async () => {
    const r = await add('founder', 'admin', 'admin');
    eq(r.role, 'admin');
    eq((await q("select count(*)::int n from private.admin_staff_log where target_user=$1 and next_role='admin' and by_user=$2", [U.admin, U.founder])).rows[0].n, 1);
  });
  await chk('motivul e obligatoriu (5-300 caractere)', async () => { await denied(add('founder', 'editor', 'editor', null, 'x'), /motivul/); });
  await chk('adminul adaugă editor, moderator, suport', async () => {
    for (const [w, r] of [['editor', 'editor'], ['moderator', 'moderator'], ['suport', 'suport']] as const) eq((await add('admin', w, r)).role, r);
  });
  await chk('adminul NU poate adăuga contabil, admin sau fondator (doar fondatorul)', async () => {
    await denied(add('admin', 'contabil', 'contabil'), /doar editori|Un admin adaugă/);
    await denied(add('admin', 'admin2', 'admin'), /doar editori|Un admin adaugă/);
    await denied(add('admin', 'admin2', 'fondator'), /doar editori|Un admin adaugă/);
  });
  await chk('fondatorul adaugă contabil și al doilea admin', async () => {
    eq((await add('founder', 'contabil', 'contabil')).role, 'contabil');
    eq((await add('founder', 'admin2', 'admin')).role, 'admin');
  });
  await chk('nimeni nu-și schimbă singur rolul; adminul nu atinge fondatorul sau alt admin', async () => {
    await denied(add('founder', 'founder', 'admin', 'fondator'), /singur/);
    await denied(add('admin', 'founder', 'editor', 'fondator'), /doar editori|Un admin adaugă|Nu ai voie/);
    await denied(add('admin', 'admin2', 'editor', 'admin'), /doar editori|Un admin adaugă|Nu ai voie/);
  });
  await chk('versiunea veche a rolului e refuzată (expected_role stale)', async () => {
    await denied(add('founder', 'editor', 'moderator', 'suport'), /între timp/);
  });
  await chk('suport / editor / moderator / contabil nu pot schimba echipa', async () => {
    for (const w of ['suport', 'editor', 'moderator', 'contabil'] as Who[]) await denied(add(w, 'stranger', 'editor', null));
  });
  await chk('lista echipei: toți cei 7 apar cu rolul corect, cititorii echipei o văd', async () => {
    const l = await rpc('suport', 'admin_staff_list()');
    const m = Object.fromEntries(l.map((x: any) => [x.username, x.role]));
    eq(m, { founder: 'fondator', admin: 'admin', admin2: 'admin', editor: 'editor', moderator: 'moderator', suport: 'suport', contabil: 'contabil' });
  });
  // --- matricea de permisiuni (private.can) ---
  const perms: Record<string, string[]> = {
    admin: ['places.edit', 'places.hide', 'reports.close', 'partners', 'staff.manage', 'operations.read', 'operations.decide', 'plus.manage'],
    editor: ['places.edit', 'places.hide', 'reports.close', 'suggestions.read'],
    moderator: ['places.hide', 'reports.close', 'users.read'],
    suport: ['reports.read', 'support.manage', 'plus.manage', 'operations.read', 'users.read'],
    contabil: ['money', 'money.read', 'partners.read'],
  };
  const notPerms: Record<string, string[]> = {
    admin: ['money', 'money.read', 'founder'],
    editor: ['money', 'partners', 'staff.manage', 'operations.read', 'plus.manage'],
    moderator: ['places.edit', 'money', 'partners', 'staff.manage'],
    suport: ['places.edit', 'places.hide', 'reports.close', 'money', 'partners', 'operations.decide'],
    contabil: ['places.edit', 'places.hide', 'reports.close', 'partners', 'staff.manage', 'operations.read'],
  };
  for (const role of Object.keys(perms)) {
    await chk(`rolul ${role}: admin_me listează exact ce poate / nu poate`, async () => {
      const me = await rpc(role as Who, 'admin_me()');
      eq(me.role, role);
      for (const p of perms[role]) expect(me.permissions, `${role} ar trebui să aibă ${p}`).toContain(p);
      for (const p of notPerms[role]) expect(me.permissions, `${role} NU ar trebui să aibă ${p}`).not.toContain(p);
    });
  }
  await chk('contabilul vede banii (admin_finance), ceilalți nu', async () => {
    const f = await rpc('contabil', 'admin_finance(current_date,current_date)');
    expect(f).toHaveProperty('fee');
    for (const w of ['editor', 'moderator', 'suport', 'admin'] as Who[]) await denied(rpc(w, 'admin_finance(current_date,current_date)'));
  });
  await chk('contabilul NU modifică locuri; editorul NU face parteneri / nu setează treapta', async () => {
    await denied(rpc('contabil', "admin_place_save('x','{}'::jsonb)"), /modifici|Nu ai voie|Sesiunea/);
    await denied(rpc('editor', "admin_partner_save('x','F','18547290',false)"), /parteneri|Nu ai voie|Sesiunea/);
    await denied(rpc('editor', "admin_partner_tier_set('x',2)"));
  });
  // --- un client normal nu poate apela NICIO funcție admin_* ---
  await chk('un client normal e refuzat la fiecare funcție admin_* (apelate cu argumente nule)', async () => {
    const fns = (await q(`select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin\\_%' order by 2`)).rows;
    expect(fns.length).toBeGreaterThan(30);
    const wrong: string[] = [];
    for (const f of fns) {
      const types: string[] = (await q("select coalesce(array_agg(t::oid::regtype::text order by ord),'{}') ts from pg_proc, unnest(string_to_array(proargtypes::text,' ')) with ordinality x(t,ord) where oid=$1", [f.oid])).rows[0]?.ts ?? [];
      const call = `select public.${f.proname}(${types.map((t: string) => `null::${t}`).join(',')}) r`;
      try { await as('ana', call); wrong.push(`${f.proname}: a rulat fără eroare pentru un client`); }
      catch (e: any) { if (!PERM.test(e.message)) wrong.push(`${f.proname}: eroare neașteptată "${String(e.message).slice(0, 90)}"`); }
    }
    if (wrong.length) throw new Error(wrong.length + ' funcții: ' + wrong.join('; '));
  });
  await chk('anon nu poate rula nicio funcție admin_*', async () => {
    const fns = (await q(`select p.proname,p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin\\_%'`)).rows;
    const open = (await Promise.all(fns.map(async (f: any) => ((await q("select has_function_privilege('anon',$1,'execute') a", [f.oid])).rows[0].a ? f.proname : null)))).filter(Boolean);
    expect(open).toEqual([]);
  });
  // --- fără MFA (aal1) ---
  await chk('staff fără MFA (aal1, fără sesiune securizată) e refuzat unde MFA e cerut; cu MFA poate', async () => {
    await add('founder', 'nomfa', 'admin');
    const me = await rpc('nomfa', 'admin_me()', [], false);
    eq(me.permissions, []);
    await denied(rpc('nomfa', "admin_place_save('x','{}'::jsonb)", [], false), /Sesiunea securizat|Nu ai voie/);
    await denied(rpc('nomfa', 'admin_staff_list()', [], false), /Sesiunea securizat|Nu ai voie/);
    await denied(rpc('nomfa', 'admin_finance(current_date,current_date)', [], false));
    const ok = await rpc('nomfa', 'admin_me()', [], true);
    expect(ok.permissions).toContain('places.edit');
  });
  await chk('retrogradare: admin2 devine moderator, apoi e scos; jurnalul le ține; după scoatere nu mai are acces', async () => {
    eq((await add('founder', 'admin2', 'moderator', 'admin')).role, 'moderator');
    await denied(rpc('admin2', "admin_partner_save('x','F','18547290',false)"));
    const r = await add('founder', 'admin2', null, 'moderator');
    eq(r.removed, true);
    eq((await q('select count(*)::int n from staff where user_id=$1', [U.admin2])).rows[0].n, 0);
    await denied(rpc('admin2', "admin_place_status('inexistent',true)"));
    const log = (await q('select previous_role,next_role from private.admin_staff_log where target_user=$1 order by id', [U.admin2])).rows;
    eq(log, [{ previous_role: null, next_role: 'admin' }, { previous_role: 'admin', next_role: 'moderator' }, { previous_role: 'moderator', next_role: null }]);
    await denied(add('founder', 'admin2', null, null), /nu este în echipă/);
  });
  await chk('jurnalul echipei nu se poate rescrie și apare în admin_activity (doar pentru audit.read)', async () => {
    await expect(q("update private.admin_staff_log set note='rescris'")).rejects.toThrow(/nu poate fi modificat|nu se poate modifica/);
    const act = await rpc('founder', 'admin_activity(50,0)');
    expect(act.some((a: any) => a.origin === 'staff')).toBe(true);
    await denied(rpc('editor', 'admin_activity(50,0)'));
  });
  endStage();
}, 120000);

// =====================================================================================================
let placeId = '';
it('2. Locurile: adăugare, modificare cu story_en, ascundere, jurnal, „Lipsește un loc?”', async () => {
  begin(2, 'Locuri');
  await chk('editorul adaugă un loc nou (admin_place_add): id a-…, sursă admin, jurnal „add”', async () => {
    placeId = await rpc('editor', 'admin_place_add($1::jsonb,$2)', [JSON.stringify({ name: 'Cafeneaua Nouă', k: 'cafenea', cat: 'cafenea', lat: 44.43, lon: 26.1, street: 'Strada Nouă 10', city: 'București' }), 'Cerere de la client']);
    expect(placeId).toMatch(/^a-/);
    const v = (await q('select source,status,name from venues where id=$1', [placeId])).rows[0];
    eq(v, { source: 'admin', status: 'on', name: 'Cafeneaua Nouă' });
  });
  await chk('un loc fără nume/poziție e refuzat', async () => {
    await denied(rpc('editor', "admin_place_add('{\"name\":\"X\"}'::jsonb)"), /nevoie de nume/);
  });
  await chk('moderatorul / suportul / contabilul / clientul NU pot adăuga sau modifica locuri', async () => {
    for (const w of ['moderator', 'suport', 'contabil', 'ana'] as Who[]) {
      await denied(rpc(w, "admin_place_add('{\"name\":\"X\",\"k\":\"a\",\"cat\":\"a\",\"lat\":1,\"lon\":1}'::jsonb)"));
      await denied(rpc(w, "admin_place_save($1,'{\"price\":2}'::jsonb)", [placeId]));
    }
  });
  await chk('admin_place_save: schimbă povestea + story_en, numele nou ajunge în coloana name, câmpurile străine sunt aruncate', async () => {
    await rpc('editor', 'admin_place_save($1,$2::jsonb,$3)', [placeId, JSON.stringify({ story: 'Cafea de specialitate.', story_en: 'Specialty coffee.', name: 'Cafeneaua Nouă 2', evil: 'x', source: 'osm' }), 'Poveste nouă']);
    const v = (await q('select name,edit,source from venues where id=$1', [placeId])).rows[0];
    eq(v.name, 'Cafeneaua Nouă 2'); eq(v.edit.story_en, 'Specialty coffee.'); expect(v.edit.evil).toBeUndefined(); eq(v.source, 'admin');
  });
  await chk('un loc inexistent nu se salvează', async () => { await denied(rpc('editor', "admin_place_save('nu-exista','{}'::jsonb)"), /nu există/); });
  await chk('moderatorul ascunde locul; clientul nu mai poate face plan acolo; apoi îl arată din nou', async () => {
    await rpc('moderator', 'admin_place_status($1,true,$2)', [placeId, 'Semnalat']);
    eq((await q('select status from venues where id=$1', [placeId])).rows[0].status, 'hidden');
    await denied(rpc('ana', "plan_share_v2('ascuns',$1,now()+interval '1 hour',1)", [placeId]), /nu mai este disponibil/);
    await rpc('moderator', 'admin_place_status($1,false,$2)', [placeId, 'Reverificat']);
    eq((await q('select status from venues where id=$1', [placeId])).rows[0].status, 'on');
  });
  await chk('suportul nu ascunde locuri', async () => { await denied(rpc('suport', 'admin_place_status($1,true)', [placeId])); });
  await chk('admin_place_log: istoric complet add → edit → hide → show, în ordine descrescătoare; suportul/contabilul nu-l văd', async () => {
    const log = await rpc('editor', 'admin_place_log($1)', [placeId]);
    eq(log.map((x: any) => x.action), ['show', 'hide', 'edit', 'add']);
    await denied(rpc('suport', 'admin_place_log($1)', [placeId]));
    await denied(rpc('contabil', 'admin_place_log($1)', [placeId]));
  });
  await chk('admin_places: caută după nume', async () => {
    const l = await rpc('editor', "admin_places('Nouă 2')");
    eq(l.map((x: any) => x.id), [placeId]);
  });
  let reportId = '';
  await chk('clientul trimite „Lipsește un loc?” (reports, venue_id nou) și apare la Admin; clientul vede doar ale lui', async () => {
    await as('ana', "insert into reports(venue_id,kind,note) values('nou','altceva','LOC NOU: Ceainăria Roz · Buftea')");
    reportId = (await q("select id from reports where note like 'LOC NOU: Ceainăria%'")).rows[0].id;
    const queue = await rpc('suport', "admin_support_reports('new','missing_place')");
    expect(queue.some((x: any) => x.origin === 'legacy' && String(x.description).includes('Ceainăria'))).toBe(true);
    expect((await rpc('bob', 'support_reports()')).length).toBe(0);
    expect((await rpc('ana', 'support_reports()')).length).toBeGreaterThan(0);
  });
  await chk('moderatorul închide semnalarea (admin_report_close), suportul și clientul nu; starea invalidă e refuzată', async () => {
    await denied(rpc('suport', "admin_report_close($1,'rezolvat','ok')", [reportId]));
    await denied(rpc('ana', "admin_report_close($1,'rezolvat','ok')", [reportId]));
    await denied(rpc('moderator', "admin_report_close($1,'altceva')", [reportId]), /Stare/);
    await rpc('moderator', "admin_report_close($1,'rezolvat','Locul a fost adăugat.')", [reportId]);
    const r = (await q('select status,answer,handled_by from reports where id=$1', [reportId])).rows[0];
    eq(r.status, 'rezolvat'); eq(r.handled_by, U.moderator);
  });
  await chk('clientul vede răspunsul Admin la semnalarea lui', async () => {
    const own = await rpc('ana', 'support_reports()');
    const mine = own.filter((x: any) => x.origin === 'legacy');
    if (!mine.some((x: any) => /adăugat/i.test(JSON.stringify(x)))) throw new Error('nu apare răspunsul: ' + JSON.stringify(mine));
  });
  await chk('o semnalare deja rezolvată nu mai poate fi rescrisă cu „respins” de alt om', async () => {
    await denied(rpc('editor', "admin_report_close($1,'respins','Rescris')", [reportId]), /între timp|deja|Stare|disponibil/);
  });
  lipseste('nicio legătură între o semnalare „Lipsește un loc?” și locul creat cu admin_place_add (două lucruri separate; Admin le închide de mână)');
  await chk('importul de locuri (OSM) e închis pentru clienți; importul complet nu ascunde un loc de mână', async () => {
    await denied(rpc('ana', "import_places('[]'::jsonb,now(),true)"), /permission denied/);
    await svc("select import_places('[{\"id\":\"osm-1\",\"name\":\"Din OSM\",\"cat\":\"mancare\",\"lat\":44.4,\"lon\":26.1}]'::jsonb,now(),true) r");
    eq((await q('select status from venues where id=$1', [placeId])).rows[0].status, 'on');
  });
  endStage();
}, 120000);

// =====================================================================================================
// ajutoare comune pentru Business
const cuiOf = (base: string) => { // CUI românesc valid: cifră de control cu cheia 753217532
  const key = [7, 5, 3, 2, 1, 7, 5, 3, 2], d = base.split('').map(Number), k = key.slice(key.length - d.length);
  const s = d.reduce((a, x, i) => a + x * k[i], 0) * 10 % 11;
  return base + (s === 10 ? 0 : s);
};
const CUI = { A: cuiOf('1854729'), B: cuiOf('4372618'), C: cuiOf('3190552') };
const VEN = { A: 'bistro-alfa', B: 'bar-beta', C: 'club-gama' } as const;
type VK = keyof typeof VEN;
const details = (firm: string, cui: string) => ({ requester_name: 'Patron Test', requester_role: 'Administrator', firm, cui, phone: '+40721000111' });
async function request(who: Who, key: string, kind: string, venue: string, firm: string, cui: string) {
  const r = await rpc(who, 'biz_partner_request_create($1,$2,$3,$4::jsonb)', [key, kind, venue, JSON.stringify(details(firm, cui))]);
  const path = `${U[who]}/${r.id}/proof.pdf`;
  await as(who, "insert into storage.objects(bucket_id,name,metadata) values('business-proofs',$1,$2)", [path, { size: 1000, mimetype: 'application/pdf', eTag: 'e-' + r.id }]);
  const s = await rpc(who, 'biz_partner_request_submit($1,$2)', [r.id, path]);
  return { id: r.id as string, status: s.status as string, deadline: s.owner_response_deadline };
}
const tokenOf = async (v: string) => (await q('select token from venue_codes where venue_id=$1', [v])).rows[0]?.token as string;

// =====================================================================================================
it('3. Business: identitate, căutare local, cerere de parteneriat, verificare Admin, dispută, fondatori, echipă', async () => {
  begin(3, 'Business: onboarding, revendicare, echipă');
  await db.exec(`insert into venues(id,name,cat,lat,lon,data) values
    ('${VEN.A}','Bistro Alfa','mancare',44.4300,26.1000,'{"street":"Strada Alfa 1","city":"București"}'),
    ('${VEN.B}','Bar Beta','bar',44.4400,26.1100,'{"street":"Strada Beta 2","city":"București"}'),
    ('${VEN.C}','Club Gama','club',44.4500,26.1200,'{"street":"Strada Gama 3","city":"București"}'),
    ('ascuns-biz','Bistro Ascuns','mancare',44.4,26.1,'{}');
    update venues set status='hidden' where id='ascuns-biz';`);

  await chk('biz_identity_status: fără profil; sub 16 refuzat; cu data corectă se creează profilul', async () => {
    eq(await rpc('biz', 'biz_identity_status()'), { has_profile: false, username: null, first_name: null });
    await denied(rpc('biz', "biz_identity_complete('bizowner','Patron','2015-01-01')"), /16/);
    eq(await rpc('biz', "biz_identity_complete('bizowner','Patron','1985-03-03')"), { has_profile: true, username: 'bizowner', first_name: 'Patron' });
    await rpc('biz2', "biz_identity_complete('biztwo','Concurent','1988-08-08')");
  });
  await chk('biz_venue_search: găsește Bistro Alfa ca nerevendicat, ascunde locurile ascunse, nu scoate firma/proprietarul', async () => {
    const r = await rpc('biz', "biz_venue_search('Bistro')");
    eq(r.map((x: any) => x.id), [VEN.A]);
    eq(r[0].claimed, false);
    eq(Object.keys(r[0]).sort(), ['address', 'city', 'claimed', 'id', 'name']);
  });
  await chk('cerere cu CUI greșit e refuzată pe server', async () => {
    await denied(rpc('biz', 'biz_partner_request_create($1,$2,$3,$4::jsonb)', ['k-bad', 'claim', VEN.A, JSON.stringify(details('Alfa SRL', '18547291'))]), /CUI invalid/);
  });
  let reqA = { id: '' };
  await chk('biz depune cererea pentru Bistro Alfa (create + document + submit); retrimiterea e idempotentă', async () => {
    const r = await request('biz', 'req-A', 'claim', VEN.A, 'Alfa SRL', CUI.A);
    eq(r.status, 'pending'); reqA = r;
    eq((await rpc('biz', 'biz_partner_request_submit($1,$2)', [r.id, `${U.biz}/${r.id}/proof.pdf`])).id, r.id);
    // ownership nu s-a acordat singur
    eq((await q('select count(*)::int n from partner_members where user_id=$1', [U.biz])).rows[0].n, 0);
  });
  await chk('Admin vede cererea; suport/editor/moderator/contabil nu o văd; clientul nu o vede', async () => {
    const qd = await rpc('admin', "admin_partner_requests('pending')");
    expect(qd.some((x: any) => x.id === reqA.id)).toBe(true);
    for (const w of ['suport', 'editor', 'moderator', 'ana'] as Who[]) await denied(rpc(w, "admin_partner_requests('pending')"));
  });
  await chk('aprobare: refuzată fără confirmarea ANAF, fără deschiderea documentului, de suport; apoi acceptată', async () => {
    await denied(rpc('admin', "admin_partner_request_decide($1,'verified','Am verificat documentele.',false)", [reqA.id]), /ANAF/);
    await denied(rpc('admin', "admin_partner_request_decide($1,'verified','Am verificat documentele.',true)", [reqA.id]), /documentul/);
    await denied(rpc('suport', "admin_partner_request_decide($1,'verified','Am verificat documentele.',true)", [reqA.id]));
    await rpc('admin', 'biz_partner_proof_access($1)', [reqA.id]);
    const d = await rpc('admin', "admin_partner_request_decide($1,'verified','Firma verificată manual la ANAF; document verificat.',true)", [reqA.id]);
    eq(d.status, 'verified'); eq(d.activation_pending, true);
    // încă nu e partener / membru
    eq((await q('select count(*)::int n from partners where venue_id=$1', [VEN.A])).rows[0].n, 0);
    await denied(rpc('admin', "admin_partner_request_decide($1,'rejected','Încă o decizie după prima.',false)", [reqA.id]), /nu mai așteaptă/);
  });
  await chk('Admin NU poate da statut de fondator (doar fondatorul); fondatorul poate: al 20-lea fondator', async () => {
    // 19 fondatori deja (localuri de umplutură)
    for (let i = 1; i <= 19; i++) {
      await q("insert into venues(id,name,cat,lat,lon,data) values($1,$2,'mancare',44.4,26.1,'{}')", ['fill-' + i, 'Umplutură ' + i]);
      await q("insert into partners(venue_id,firm,cui,founder,rate,activated_at,free_until) values($1,'Fill SRL',$2,true,.08,current_date-90,current_date-60)", ['fill-' + i, CUI.A]);
    }
    await denied(rpc('admin', "admin_partner_save($1,'Alfa SRL',$2,true,'activ','@bizowner')", [VEN.A, CUI.A]), /doar fondatorul/i);
    const p = await rpc('founder', "to_jsonb(admin_partner_save($1,'Alfa SRL',$2,true,'activ','@bizowner'))", [VEN.A, CUI.A]);
    eq(p.founder, true);
  });
  await chk('fondator: lună gratis de la activare (28-31 zile); al 21-lea fondator e refuzat', async () => {
    const r = (await q('select free_until-activated_at d,activated_at=current_date td from partners where venue_id=$1', [VEN.A])).rows[0];
    expect(r.d).toBeGreaterThanOrEqual(28); expect(r.d).toBeLessThanOrEqual(31);
    await denied(rpc('founder', "admin_partner_save($1,'Gama SRL',$2,true)", [VEN.C, CUI.C]), /deja 20/);
  });
  await chk('biz_my_venues: proprietarul vede Bistro Alfa cu rolul și statutul de fondator', async () => {
    const m = await as('biz', 'select * from biz_my_venues()');
    eq(m.rows.map((r: any) => [r.venue_id, r.role, r.founder, r.status]), [[VEN.A, 'proprietar', true, 'activ']]);
  });
  await chk('al doilea utilizator încearcă să revendice același local: claim refuzat, dispută acceptată', async () => {
    await denied(rpc('biz2', 'biz_partner_request_create($1,$2,$3,$4::jsonb)', ['k-claim2', 'claim', VEN.A, JSON.stringify(details('Concurent SRL', CUI.B))]), /revendicat/);
    const d = await request('biz2', 'req-dispute', 'dispute', VEN.A, 'Concurent SRL', CUI.B);
    eq(d.status, 'pending');
    // proprietarul vede disputa (dar nu detaliile solicitantului) și răspunde o singură dată
    const inbox = await rpc('biz', 'biz_ownership_disputes($1)', [VEN.A]);
    eq(inbox.length, 1); eq(inbox[0].details, undefined); eq(inbox[0].applicant_id, undefined);
    await denied(rpc('biz2', 'biz_ownership_disputes($1)', [VEN.A]), /proprietarul/);
    await rpc('biz', 'biz_ownership_dispute_reply($1,$2)', [d.id, 'Firma Alfa SRL e proprietarul; pot prezenta actele.']);
    await denied(rpc('biz', 'biz_ownership_dispute_reply($1,$2)', [d.id, 'Un al doilea răspuns trimis aici.']), /deja trimis/);
    // Admin: nu înainte de 3 zile
    await rpc('admin', 'biz_partner_proof_access($1)', [d.id]);
    await denied(rpc('admin', "admin_partner_request_decide($1,'verified','Disputa verificată cu actele.',true)", [d.id]), /3 zile/);
    await q("update private.partner_requests set owner_response_deadline=now()-interval '1 minute' where id=$1", [d.id]);
    const ok = await rpc('admin', "admin_partner_request_decide($1,'verified','Disputa verificată cu actele.',true)", [d.id]);
    eq(ok.status, 'verified');
    // niciun transfer automat: proprietarul rămâne
    eq((await q("select user_id from partner_members where venue_id=$1 and role='proprietar' and active", [VEN.A])).rows.map((r: any) => r.user_id), [U.biz]);
    // cererea respinsă a altcuiva: biz3 pe Club Gama
    const rj = await request('biz3', 'req-C-rej', 'claim', VEN.C, 'Gama SRL', CUI.C);
    await rpc('admin', 'biz_partner_proof_access($1)', [rj.id]);
    eq((await rpc('admin', "admin_partner_request_decide($1,'rejected','Documentul nu corespunde firmei.',false)", [rj.id])).status, 'rejected');
  });
  lipseste('mutarea proprietății după o dispută câștigată: nu există RPC care să înlocuiască proprietarul (admin_partner_save adaugă un al doilea proprietar, cel vechi rămâne; biz_team_set refuză „proprietar”)');
  await chk('verificarea disputei NU a schimbat nimic singură (biz2 nu e membru)', async () => {
    eq((await q('select count(*)::int n from partner_members where user_id=$1', [U.biz2])).rows[0].n, 0);
    await denied(rpc('biz2', "biz_finance_v2($1,current_date,current_date)", [VEN.A]), /Nu ai voie|Sesiunea/);
    await denied(rpc('biz2', "biz_entries_v3($1,null)", [VEN.A]), /echipa|Sesiunea/);
  });
  await chk('biz2 își revendică propriul local (Bar Beta): partener ne-fondator, FĂRĂ lună gratis (free_until = activare)', async () => {
    const r = await request('biz2', 'req-B', 'claim', VEN.B, 'Beta SRL', CUI.B);
    await rpc('admin', 'biz_partner_proof_access($1)', [r.id]);
    await rpc('admin', "admin_partner_request_decide($1,'verified','Firma verificată manual la ANAF; document verificat.',true)", [r.id]);
    await rpc('admin', "admin_partner_save($1,'Beta SRL',$2,false,'activ','@biztwo')", [VEN.B, CUI.B]);
    const p = (await q('select founder,free_until-activated_at d from partners where venue_id=$1', [VEN.B])).rows[0];
    eq(p, { founder: false, d: 0 });
    eq((await as('biz2', 'select venue_id,role,founder from biz_my_venues()')).rows, [{ venue_id: VEN.B, role: 'proprietar', founder: false }]);
  });
  await chk('Club Gama devine partener (ne-fondator) pentru etapa cu evenimente; biz3 e proprietar', async () => {
    await rpc('admin', "admin_partner_save($1,'Gama SRL',$2,false,'activ','@biz3')", [VEN.C, CUI.C]);
    eq((await as('biz3', 'select venue_id,role from biz_my_venues()')).rows, [{ venue_id: VEN.C, role: 'proprietar' }]);
  });
  await chk('cineva din echipa CeFaci nu poate fi proprietar de local; Admin nu poate scoate statutul de fondator', async () => {
    await denied(rpc('admin', "admin_partner_save($1,'Alfa SRL',$2,false,'activ')", [VEN.A, CUI.A]), /Doar fondatorul/);
    await denied(rpc('founder', "admin_partner_save($1,'Alfa SRL',$2,false,'activ','@admin')", [VEN.B, CUI.B]), /echipa CeFaci/);
    await denied(rpc('admin', "admin_partner_save($1,'Alfa SRL',$2,false,'activ','@nimeni-nu')", [VEN.B, CUI.B]), /Nu găsesc/);
  });
  await chk('pauză / ieșire și revenire a unui partener nu dă o a doua lună gratis (data activării și free_until rămân)', async () => {
    const d0 = (await q('select activated_at::text a,free_until::text f from partners where venue_id=$1', [VEN.A])).rows[0];
    await rpc('admin', "admin_partner_save($1,'Alfa SRL',$2,true,'iesit')", [VEN.A, CUI.A]);
    await rpc('admin', "admin_partner_save($1,'Alfa SRL',$2,true,'activ')", [VEN.A, CUI.A]);
    eq((await q('select activated_at::text a,free_until::text f from partners where venue_id=$1', [VEN.A])).rows[0], d0);
    await denied(rpc('admin', "admin_partner_save($1,'Alfa SRL',$2,true,'altceva')", [VEN.A, CUI.A]), /Stare necunoscută/);
  });
  nota('„lunile gratuite o dată pe loc fizic” (docs/logica-business-admin.md): serverul ține o lună gratis per venue_id; dacă un local fizic apare cu alt id (alt id OSM / loc adăugat de mână) i se poate da a doua lună gratis, nu există verificare pe adresă/CUI; același CUI poate fi fondator pe mai multe venue_id (limita e 20 de rânduri, nu 20 de firme)');
  await chk('treapta contractuală: contabilul o setează, adminul nu; schimbarea cere versiune nouă de contract', async () => {
    await denied(rpc('admin', 'admin_partner_tier_set($1,2)', [VEN.A]));
    for (const v of [VEN.A, VEN.B, VEN.C]) await rpc('contabil', 'admin_partner_tier_set($1,2)', [v]);
    await denied(rpc('contabil', 'admin_partner_tier_set($1,3)', [VEN.A]), /versiune nouă/);
    await denied(rpc('contabil', 'admin_partner_tier_set($1,9)', [VEN.A]), /Treapta/);
  });
  // ---------- echipa localului ----------
  await chk('proprietarul adaugă un ospătar (scanare) și un manager; nu poate face alt proprietar', async () => {
    await rpc('biz', "biz_team_set($1,'@waiter','scanare')", [VEN.A]);
    await rpc('biz', "biz_team_set($1,'@manager','manager')", [VEN.A]);
    await denied(rpc('biz', "biz_team_set($1,'@ana','proprietar')", [VEN.A]), /doar prin CeFaci/);
    const t = await as('biz', 'select username,role,active from biz_team($1) order by 1', [VEN.A]);
    eq(t.rows.map((r: any) => [r.username, r.role, r.active]), [['bizowner', 'proprietar', true], ['manager', 'manager', true], ['waiter', 'scanare', true]]);
  });
  await chk('rolurile sunt limitate: ospătarul nu vede echipa / setările / banii; managerul adaugă doar recepție și scanare', async () => {
    await denied(rpc('waiter', "biz_team_set($1,'@eva','scanare')", [VEN.A]), /Nu ai voie|Sesiunea/);
    const wt = await as('waiter', 'select * from biz_team($1)', [VEN.A]).catch(() => ({ rows: ['err'] }));
    eq(wt.rows.length === 0 || wt.rows[0] === 'err', true);
    await denied(rpc('waiter', 'biz_finance_v2($1,current_date,current_date)', [VEN.A]), /Nu ai voie|Sesiunea/);
    await denied(rpc('waiter', "biz_settings_v2($1,'none',true,false,10,60,1,'[]'::jsonb)", [VEN.A]), /Nu ai voie|Sesiunea/);
    await rpc('manager', "biz_team_set($1,'@eva','receptie')", [VEN.A]);
    await denied(rpc('manager', "biz_team_set($1,'@ana','manager')", [VEN.A]), /doar recepție/);
    await denied(rpc('manager', "biz_team_set($1,'@bizowner','scos')", [VEN.A]), /doar prin CeFaci/);
    await denied(rpc('manager', "biz_team_set($1,'@waiter','manager')", [VEN.A]), /doar recepție/);
  });
  await chk('oamenii CeFaci și un om fără cont nu intră în echipă; nu te poți schimba singur', async () => {
    await denied(rpc('biz', "biz_team_set($1,'@editor','scanare')", [VEN.A]), /echipei CeFaci/);
    await denied(rpc('biz', "biz_team_set($1,'@fantoma','scanare')", [VEN.A]), /Nu găsesc/);
    await denied(rpc('manager', "biz_team_set($1,'@manager','scos')", [VEN.A]), /singur/);
  });
  await chk('un membru al unui local nu intră în alt local; scoaterea unui membru îi taie accesul și rămâne în jurnal', async () => {
    await denied(rpc('waiter', "biz_entries_v3($1,null)", [VEN.B]), /echipa|Sesiunea/);
    await rpc('biz', "biz_team_set($1,'@eva','scos')", [VEN.A]);  // eva fusese pusă de manager
    eq((await q("select active from partner_members where venue_id=$1 and user_id=$2", [VEN.A, U.eva])).rows[0].active, false);
    await denied(rpc('eva', "biz_entries_v3($1,null)", [VEN.A]), /echipa|Sesiunea/);
    expect((await q('select count(*)::int n from private.team_log where venue_id=$1', [VEN.A])).rows[0].n).toBeGreaterThanOrEqual(4);
    // revenirea: același om poate fi pus iar
    await rpc('manager', "biz_team_set($1,'@eva','scanare')", [VEN.A]);
    eq((await q("select active from partner_members where venue_id=$1 and user_id=$2", [VEN.A, U.eva])).rows[0].active, true);
  });
  endStage();
}, 120000);

// =====================================================================================================
let dropA = '';
it('4. Business: setări, Plus, Live Drop (10–15% / Plus ≥ +5), procentele nu se adună', async () => {
  begin(4, 'Business: setări, Plus, Drops');
  await chk('biz_settings_v2: salvează capacitatea, rezervările și programul; valori invalide refuzate; biz_settings_save e dezactivată', async () => {
    await rpc('biz', "biz_settings_v2($1,'recommended',true,false,40,90,2,$2::jsonb)", [VEN.A, OPEN_HOURS]);
    const p = (await q('select reservation_mode,capacity,duration_minutes,auto_confirm_max from partners where venue_id=$1', [VEN.A])).rows[0];
    eq(p, { reservation_mode: 'recommended', capacity: 40, duration_minutes: 90, auto_confirm_max: 2 });
    await denied(rpc('biz', "biz_settings_v2($1,'recommended',true,false,9999,90,2,'[]'::jsonb)", [VEN.A]), /invalid/);
    await denied(rpc('biz', "biz_settings_v2($1,'oricum',true,false,10,90,2,'[]'::jsonb)", [VEN.A]), /invalide/);
    await denied(rpc('biz', "biz_settings_v2($1,'none',true,false,10,90,2,'[{\"day\":9,\"from\":\"10:00\",\"to\":\"12:00\"}]'::jsonb)", [VEN.A]), /Interval invalid/);
    await denied(rpc('biz2', "biz_settings_v2($1,'none',true,false,10,90,2,'[]'::jsonb)", [VEN.A]), /Nu ai voie|Sesiunea/);
    await denied(rpc('biz', 'biz_settings_save($1,true,2,10)', [VEN.A]), /Actualizează/);
    await rpc('biz2', "biz_settings_v2($1,'recommended',true,false,30,90,2,$2::jsonb)", [VEN.B, OPEN_HOURS]);
    await rpc('biz3', "biz_settings_v2($1,'recommended',true,false,300,90,2,$2::jsonb)", [VEN.C, OPEN_HOURS]);
  });
  await chk('biz_plus_v2: procent 10/15/20 din mâine; procent greșit sau program greșit refuzate; ospătarul nu poate', async () => {
    const eff = await rpc('biz', "biz_plus_v2($1,10,'[]'::jsonb)::text", [VEN.A]);
    const tomorrow = (await q("select ((now() at time zone 'Europe/Bucharest')::date+1)::text d")).rows[0].d;
    eq(String(eff).slice(0, 10), tomorrow);
    await denied(rpc('biz', "biz_plus_v2($1,12,'[]'::jsonb)", [VEN.A]), /Program Plus invalid/);
    await denied(rpc('biz', `biz_plus_v2($1,10,'[{"day":2,"from":"10:00","to":"12:00","pct":17}]'::jsonb)`, [VEN.A]), /Interval Plus invalid/);
    await denied(rpc('waiter', "biz_plus_v2($1,10,'[]'::jsonb)", [VEN.A]), /Nu ai voie|Sesiunea/);
    await denied(rpc('manager', "biz_plus_v2($1,10,'[]'::jsonb)", [VEN.B]), /Nu ai voie|Sesiunea/);
    // simulare: setarea de ieri (efectivă de azi), ca să avem Plus 10% azi pentru etapa 6
    await q("insert into private.plus_versions(venue_id,effective_date,pct,schedule,by_user) values($1,current_date-1,10,'[]',$2) on conflict do nothing", [VEN.A, U.biz]);
  });
  await chk('biz_plus_off_today: înainte de 16:00 reușește (idempotent), după 16:00 e refuzat; limita de 4 zile/lună', async () => {
    const hour = Number((await q("select extract(hour from (now() at time zone 'Europe/Bucharest'))::int h")).rows[0].h);
    if (hour < 16) {
      await rpc('biz2', 'biz_plus_off_today($1)', [VEN.B]);
      await rpc('biz2', 'biz_plus_off_today($1)', [VEN.B]);
      eq((await q("select count(*)::int n from private.plus_off_days where venue_id=$1", [VEN.B])).rows[0].n, 1);
      await q("delete from private.plus_off_days where venue_id=$1", [VEN.B]); // curățăm: nu vrem Plus oprit pe B
    } else {
      await denied(rpc('biz2', 'biz_plus_off_today($1)', [VEN.B]), /16:00/);
    }
    await denied(rpc('waiter', 'biz_plus_off_today($1)', [VEN.A]), /Nu ai voie|Sesiunea/);
  });
  await chk('programul Plus pe ore: o fereastră de 20% mâine 10:00–14:00 (restul zilei 10%); un Drop Plus sub programul Plus e refuzat, unul egal/mai mare se acceptă', async () => {
    const dow = (await q("select extract(isodow from ((now() at time zone 'Europe/Bucharest')::date+1))::int d")).rows[0].d;
    await rpc('biz', "biz_plus_v2($1,10,$2::jsonb)", [VEN.A, JSON.stringify([{ day: dow, from: '10:00', to: '14:00', pct: 20 }])]);
    const pct = async (h: string) => (await q("select private.plus_pct_at($1, ((((now() at time zone 'Europe/Bucharest')::date+1)::timestamp + $2::time) at time zone 'Europe/Bucharest')) p", [VEN.A, h])).rows[0].p;
    eq([await pct('12:00'), await pct('09:59'), await pct('14:00'), await pct('18:00')], [20, 10, 10, 10]);
    const tomorrowNoon = (await q("select ((((now() at time zone 'Europe/Bucharest')::date+1)::timestamp + time '12:00') at time zone 'Europe/Bucharest')::text t")).rows[0].t;
    await denied(rpc('biz', "drop_create_v2($1,'Prânz',10,15,5,60,1,$2::timestamptz,false,false,'plus-sub')", [VEN.A, tomorrowNoon]), /sub programul Plus/);
    const d = await rpc('biz', "to_jsonb(drop_create_v2($1,'Prânz bun',10,20,5,60,1,$2::timestamptz,false,false,'plus-egal'))", [VEN.A, tomorrowNoon]);
    eq([d.pct_all, d.pct_plus], [10, 20]);
    await rpc('manager', 'drop_stop($1)', [d.id]);
    await rpc('biz', "biz_plus_v2($1,10,'[]'::jsonb)", [VEN.A]);   // înapoi la 10% fără ferestre
    eq(await pct('12:00'), 10);
  });
  await chk('drop_create_v2: 10–15% pentru toți, Plus între +5 și 30; valori în afara intervalului refuzate', async () => {
    const d = await rpc('biz', "to_jsonb(drop_create_v2($1,'Desert la jumătate',10,15,20,60,1,null,false,false,'d-1'))", [VEN.A]);
    dropA = d.id; eq([d.pct_all, d.pct_plus, d.seats], [10, 15, 20]);
    eq((await rpc('biz', "to_jsonb(drop_create_v2($1,'Desert la jumătate',10,15,20,60,1,null,false,false,'d-1'))", [VEN.A])).id, dropA); // idempotent pe cheie
    for (const [a, p] of [[9, 15], [16, 25], [10, 14], [12, 16], [10, 31], [15, 30 + 1]]) {
      await expect(rpc('biz', "to_jsonb(drop_create_v2($1,'Alt desert',$2,$3,10,30,1,now()+interval '40 hours',false,false,$4))", [VEN.A, a, p, `bad-${a}-${p}`]), `drop ${a}/${p}`).rejects.toThrow();
    }
    // limita maximă permisă
    await rpc('biz', "to_jsonb(drop_create_v2($1,'Ofertă maximă',15,30,10,30,1,now()+interval '30 hours',false,false,'d-max'))", [VEN.A]);
  });
  await chk('drop: ospătarul nu creează, managerul da; două oferte la <2 ore refuzate; tutunul interzis; alcoolul devine 18+', async () => {
    await denied(rpc('waiter', "drop_create_v2($1,'Ceva',10,15,5,30,1)", [VEN.A]), /Doar proprietarul/);
    await denied(rpc('biz', "drop_create_v2($1,'Altă ofertă',10,15,5,30,1)", [VEN.A]), /două ore/);
    await denied(rpc('biz', "drop_create_v2($1,'Narghilea gratis',10,15,5,30,1,now()+interval '60 hours',false,false,'tut')", [VEN.A]), /Tutunul/);
    const d = await rpc('manager', "to_jsonb(drop_create_v2($1,'Happy hour bere',10,15,5,30,1,now()+interval '80 hours',false,false,'alc'))", [VEN.A]);
    eq(d.adult, true);
  });
  await chk('drop: maxim 12 ore pe săptămână', async () => {
    let n = 0, last = '';
    for (let i = 0; i < 5; i++) {
      try { await rpc('biz2', "drop_create_v2($1,'Ora fericită',10,15,5,240,1,$2::timestamptz,false,false,$3)", [VEN.B, new Date(Date.now() + (200 + i * 5) * 3600e3).toISOString(), 'h' + i]); n++; }
      catch (e: any) { last = e.message; break; }
    }
    expect(n).toBeGreaterThan(0); expect(last).toMatch(/12 ore|două ore/);
  });
  await chk('drop_stop: ospătarul nu oprește, managerul oprește (oferta oprită nu mai apare)', async () => {
    const d2 = await rpc('biz', "to_jsonb(drop_create_v2($1,'Ofertă de oprit',10,15,5,30,1,now()+interval '120 hours',false,false,'d-stop'))", [VEN.A]);
    await denied(rpc('waiter', 'drop_stop($1)', [d2.id]), /Nu ai voie|Sesiunea/);
    await rpc('manager', 'drop_stop($1)', [d2.id]);
    expect((await q('select stopped_at is not null s from drops where id=$1', [d2.id])).rows[0].s).toBe(true);
  });
  lipseste('Plus/Drop: biz_plus_v2 se aplică abia de mâine (corect), dar nu există o RPC care să arate programul Plus efectiv de azi (testul scrie direct în private.plus_versions pentru „setarea de ieri”)');
  endStage();
}, 120000);

// =====================================================================================================
let crewId = '', crewPlan = '', voteId = '';
async function befriend(a: Who, b: Who) {
  const ex = (await q('select 1 from friendships where (requester=$1 and addressee=$2) or (requester=$2 and addressee=$1)', [U[a], U[b]])).rows.length;
  if (ex) return;
  await as(a, 'insert into friendships(requester,addressee) values($1,$2)', [U[a], U[b]]);
  await as(b, "update friendships set status='accepted' where requester=$1 and addressee=$2", [U[a], U[b]]);
}
it('5. Clientul: cont, 16 ani, prieteni, gașcă, plan trimis gășcii, Vin/Nu pot, vot, plan din vot', async () => {
  begin(5, 'Client: cont, prieteni, gașcă, vot');
  await chk('sub 16 ani nu intră (complete_signup); 17 ani intră; data nașterii se fixează o singură dată', async () => {
    await q("select 1");
    const kid15 = new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10);
    await denied(rpc('kid15', "complete_signup('kid15','Kid',$1)", [kid15]), /16 ani/);
    eq((await q('select count(*)::int n from profiles where id=$1', [U.kid15])).rows[0].n, 0);
    eq((await q("select date_part('year',age(birth_date))::int a from profile_private where id=$1", [U.kid17])).rows[0].a, 17);
    await rpc('ana', "complete_signup('ana','Ana','1980-01-01')");
    eq((await q("select birth_date::text b from profile_private where id=$1", [U.ana])).rows[0].b, '1995-05-05');
  });
  await chk('nume urâte sunt refuzate la cont (p.u.l.a, kakat)', async () => {
    await denied(rpc('stranger', "complete_signup('p.u.l.a','Ion','1990-01-01')"), /alt nume/);
    await denied(rpc('stranger', "complete_signup('stranger','Kakat','1990-01-01')"), /alt nume/);
  });
  await chk('clientul vede doar profilul lui; nu vede data nașterii altora; minorii nu sunt căutabili', async () => {
    eq((await as('stranger', 'select count(*)::int n from profiles')).rows[0].n, 1);
    eq((await as('stranger', 'select count(*)::int n from profile_private')).rows[0].n, 1);
    eq((await as('ana', "select username from find_user('BOB')")).rows.length, 1);
    eq((await as('ana', "select username from find_user('kid17')")).rows.length, 0);
    eq((await as('ana', "select username from find_user('bo')")).rows.length, 0);
  });
  await chk('prietenie reală: cerere, nu poate fi acceptată de cel care o trimite, acceptare; cerere în numele altcuiva refuzată', async () => {
    await as('ana', 'insert into friendships(requester,addressee) values($1,$2)', [U.ana, U.bob]);
    await denied(as('ana', "update friendships set status='accepted' where addressee=$1 returning 1", [U.bob]).then((r) => { if (!r.rows.length) throw new Error('niciun rând'); }), /niciun rând|Nu se poate/);
    await denied(as('ana', 'insert into friendships(requester,addressee) values($1,$2)', [U.cris, U.bob]), /row-level|violates|permission/);
    await as('bob', "update friendships set status='accepted' where requester=$1", [U.ana]);
    eq((await q('select status from friendships where requester=$1 and addressee=$2', [U.ana, U.bob])).rows[0].status, 'accepted');
    await denied(as('bob', 'insert into friendships(requester,addressee) values($1,$2)', [U.bob, U.ana]), /duplicate|unique|violates/);
  });
  await chk('prietenie prin cod (și cu un minor de 17 ani)', async () => {
    const code = (await as('kid17', 'select friend_code from profiles where id=$1', [U.kid17])).rows[0].friend_code;
    await as('ana', 'select add_friend_by_code($1)', [code]);
    await as('kid17', "update friendships set status='accepted' where requester=$1", [U.ana]);
    for (const [a, b] of [['ana', 'cris'], ['ana', 'dan'], ['bob', 'cris'], ['bob', 'dan'], ['cris', 'dan'], ['bob', 'plusa'], ['ana', 'plusa'], ['ana', 'eva'], ['plusa', 'plusb']] as [Who, Who][]) await befriend(a, b);
    const fr = (await q("select p.username,f.status from friendships f join profiles p on p.id=f.addressee where f.requester=$1", [U.ana])).rows;
    if ((await as('ana', "select count(*)::int n from friendships where status='accepted'")).rows[0].n < 6) throw new Error('prietenii lui ana: ' + JSON.stringify(fr));
  });
  await chk('gașcă: are nevoie de cel puțin 2 prieteni; doar cu prieteni; cu un minor, crew_has_minor = true doar pentru membri', async () => {
    await denied(rpc('ana', "create_crew('Gașca', 'pizza', '#FF6A4D', array[$1]::uuid[])", [U.bob]), /cel puțin 2/);
    await denied(rpc('bob', "create_crew('X', 'star', '#FFD43B', array[$1, $2]::uuid[])", [U.ana, U.stranger]), /doar prieteni/);
    crewId = await rpc('ana', "create_crew('Gașca de vineri', 'pizza', '#FF6A4D', array[$1,$2,$3]::uuid[])", [U.bob, U.cris, U.kid17]);
    for (const w of ['bob', 'cris', 'kid17'] as Who[]) await as(w, "update crew_members set status='member',joined_at=now() where crew_id=$1 and user_id=$2", [crewId, U[w]]);
    eq(await rpc('bob', 'crew_has_minor($1)', [crewId]), true);
    eq(await rpc('stranger', 'crew_has_minor($1)', [crewId]), null);
    eq((await as('stranger', 'select count(*)::int n from crews')).rows[0].n, 0);
    await denied(rpc('bob', 'reset_crew_link($1)', [crewId]), /adminul/);
  });
  await chk('intrare în gașcă cu linkul de invitație (join_crew)', async () => {
    const tok = (await as('ana', 'select invite_token from crews where id=$1', [crewId])).rows[0].invite_token;
    await rpc('dan', 'join_crew($1)', [tok]);
    eq((await q("select status from crew_members where crew_id=$1 and user_id=$2", [crewId, U.dan])).rows[0].status, 'member');
    await denied(rpc('stranger', "join_crew('token-gresit-123')"), /./);
  });
  await chk('planul trimis gășcii (plan_share_v2): doar membrii îl primesc; un străin nu trimite într-o gașcă străină', async () => {
    await denied(rpc('stranger', "plan_share_v2('x',$1,now()+interval '1 hour',3,'{}',$2)", [VEN.A, crewId]), /Nu ești în gașca/);
    crewPlan = await rpc('ana', "plan_share_v2('crew-plan',$1,now()+interval '1 hour',5,'{}',$2)", [VEN.A, crewPlan ? null : crewId]);
    eq(await rpc('ana', "plan_share_v2('crew-plan',$1,now()+interval '1 hour',5,'{}',$2)", [VEN.A, crewId]), crewPlan); // idempotent
    const m = (await q('select user_id from plan_members where plan_id=$1', [crewPlan])).rows.map((r: any) => r.user_id).sort();
    eq(m, [U.bob, U.cris, U.dan, U.kid17].sort());
    eq((await as('stranger', 'select count(*)::int n from plans where id=$1', [crewPlan])).rows[0].n, 0);
  });
  await chk('Vin / Nu pot: răspunsul fiecăruia; organizatorul nu răspunde pentru alții; după termen, absenții sunt „timed_out” și nu se numără', async () => {
    eq((await rpc('ana', 'plan_attendance($1)', [crewPlan])).ready, false);
    await rpc('bob', "plan_answer_v2($1,'vin')", [crewPlan]);
    await rpc('cris', "plan_answer_v2($1,'nu_pot')", [crewPlan]);
    await denied(rpc('stranger', "plan_answer_v2($1,'vin')", [crewPlan]), /acces/);
    await denied(rpc('bob', "plan_answer_v2($1,'poate')", [crewPlan]), /invalid/);
    await q("update plans set attendance_deadline=now()-interval '1 minute' where id=$1", [crewPlan]);
    const a = await rpc('ana', 'plan_attendance($1)', [crewPlan]);
    eq(a.ready, true);
    // ana + bob = 2 (cris a zis nu pot; dan și kid17 n-au răspuns)
    eq(a.people, 2);
    await denied(rpc('dan', "plan_answer_v2($1,'vin')", [crewPlan]), /închis|închide|Participarea/);
  });
  await chk('votul gășcii: pornire, un singur „super”, rezultate, străinul nu votează', async () => {
    const opts = JSON.stringify([{ venue_id: VEN.A, venue_name: 'Bistro Alfa', details: {} }, { venue_id: VEN.B, venue_name: 'Bar Beta', details: {} }]);
    voteId = await rpc('bob', "start_vote($1,null,$2::jsonb,now()+interval '1 hour')", [crewId, opts]);
    const o = (await q('select id from vote_options where session_id=$1 order by position', [voteId])).rows.map((r: any) => r.id);
    await as('bob', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'super')", [voteId, o[0], U.bob]);
    await denied(as('bob', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'super')", [voteId, o[1], U.bob]), /./);
    await as('cris', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'da')", [voteId, o[1], U.cris]);
    await denied(as('stranger', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'da')", [voteId, o[1], U.stranger]), /row-level|violates|permission/);
    await denied(as('bob', "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'da')", [voteId, o[1], U.cris]), /row-level|violates|permission/); // vot în numele altuia
    const rs = (await as('dan', 'select venue_name,score from vote_results($1)', [voteId])).rows.map((r: any) => r.venue_name + r.score);
    eq(rs, ['Bistro Alfa2', 'Bar Beta1']);
    eq((await as('stranger', 'select count(*)::int n from vote_results($1)', [voteId])).rows[0].n, 0);
  });
  await chk('vote_close_now: doar cine l-a pornit, doar după ce a votat cineva; nu se poate al doilea vot deschis cu aceiași oameni; „restul Nu”', async () => {
    await denied(rpc('cris', 'vote_close_now($1)', [voteId]), /Doar cine a pornit/);
    // restul: dan și kid17 n-au votat -> „Gata, la restul Nu”
    const o = (await q('select id from vote_options where session_id=$1', [voteId])).rows.map((r: any) => r.id);
    for (const w of ['dan', 'kid17', 'ana'] as Who[]) for (const oid of o) await as(w, "insert into ballots(session_id,option_id,user_id,value) values($1,$2,$3,'nu') on conflict do nothing", [voteId, oid, U[w]]);
    await rpc('bob', 'vote_close_now($1)', [voteId]);
    eq((await q('select closes_at<=now() c from vote_sessions where id=$1', [voteId])).rows[0].c, true);
    const opts = JSON.stringify([{ venue_id: VEN.A, venue_name: 'A', details: {} }, { venue_id: VEN.B, venue_name: 'B', details: {} }]);
    const second = await rpc('bob', "start_vote($1,null,$2::jsonb,now()+interval '1 hour')", [crewId, opts]);
    await denied(rpc('bob', "start_vote($1,null,$2::jsonb,now()+interval '1 hour')", [crewId, opts]), /Ai deja un vot deschis/);
    await q('delete from vote_voters where session_id=$1', [second]).catch(() => {});
  });
  await chk('plan_from_vote: planul câștigătorului pentru cei care au votat; același plan la a doua cerere; un străin nu', async () => {
    const p = await rpc('cris', 'plan_from_vote($1)', [voteId]);
    eq(await rpc('bob', 'plan_from_vote($1)', [voteId]), p);
    eq((await q('select venue_id from plans where id=$1', [p])).rows[0].venue_id, VEN.A);
    await denied(rpc('stranger', 'plan_from_vote($1)', [voteId]), /Nu ești în votul/);
  });
  await chk('minor de 17 ani: serverul nu-l lasă să facă plan la un club (cat=club), nici într-o gașcă cu el (CLAUDE.md: „16–17 nu văd cluburi” — verificat doar în aplicație?)', async () => {
    let created = true;
    try { await rpc('kid17', "plan_share_v2('kid-club',$1,now()+interval '2 hours',1)", [VEN.C]); } catch { created = false; }
    if (created) throw new Error('un utilizator de 17 ani a creat un plan la Club Gama (cat=club) direct prin plan_share_v2; filtrul „minori” există doar în aplicație (adultOnly/ctx.minor), serverul nu verifică categoria localului');
  });
  endStage();
}, 120000);

// =====================================================================================================
// Etapa 6: banii. Intrarea (vizita grupului), bonurile, 10%, luna gratis a fondatorului.
const geo = { A: [44.43, 26.1], B: [44.44, 26.11] } as const;
let WD = '';                                 // ziua de lucru de azi (ora României, schimbare la 05:00)
const E: Record<string, string> = {};        // intrările: visit ids
async function mkPlan(owner: Who, key: string, venue: string, friends: Who[] = [], people = 2) {
  const n = friends.length ? 1 + friends.length : people;
  const p = await rpc(owner, "plan_share_v2($1,$2,now()+interval '5 minutes',$3,$4::uuid[])", [key, venue, n, friends.map((f) => U[f])]);
  for (const f of friends) await rpc(f, "plan_answer_v2($1,'vin')", [p]);
  return p as string;
}
async function arriveAt(who: Who, plan: string, venue: VK, loc = true) {
  const token = await tokenOf(VEN[venue]);
  const [la, lo] = geo[venue === 'A' ? 'A' : 'B'];
  return rpc(who, 'to_jsonb(visit_client_arrive_v2($1,$2,$3,$4))', [plan, token, loc ? la : null, loc ? lo : null]);
}
/** bonul citit de funcția Edge (cheie de serviciu) */
async function bill(visit: string, user: Who, total: number, number: string | null, o: { staff?: boolean; cui?: string; discount?: number } = {}) {
  const loc = (await q("select (scanned_at at time zone 'Europe/Bucharest')::date d,(scanned_at at time zone 'Europe/Bucharest')::time t,venue_id from visits where id=$1", [visit])).rows[0];
  const cui = o.cui ?? (loc.venue_id === VEN.A ? CUI.A : loc.venue_id === VEN.B ? CUI.B : CUI.C);
  return (await svc('select visit_receipt_v3($1,$2,$3,$4,$5,$6,$7,$8,$9) r', [U[user], visit, cui, total, o.discount ?? 0, loc.d, loc.t, number, o.staff ?? false])).rows[0].r;
}
const entry = async (visit: string) => (await svc('select entry_of_v3($1) e', [visit])).rows[0].e;
const finance = (who: Who, v: string, d0 = 'WD', d1 = 'WD') => rpc(who, 'biz_finance_v2($1,$2::date,$3::date)', [v, d0 === 'WD' ? WD : d0, d1 === 'WD' ? WD : d1]);

it('6. Banii: sosire, masă, bonuri, 10%, o singură reducere pe notă, luna gratis a fondatorului, finanțe', async () => {
  begin(6, 'Intrare, bonuri, 10%, finanțe');
  WD = (await q("select private.work_day(now())::text d")).rows[0].d;

  // ---- reduceri: Plus pentru stranger (suport) și proba Plus pentru plusa ----
  await chk('suportul oferă o zi de Plus (admin_plus_grant) lui stranger; plusa pornește proba gratuită', async () => {
    const g = await rpc('suport', "admin_plus_grant($1,1,'Problemă confirmată la suport','sim-grant-1')", [U.stranger]);
    eq(g.days, 1);
    expect((await q('select plus_until>now() p from profile_private where id=$1', [U.stranger])).rows[0].p).toBe(true);
    await rpc('plusa', 'start_plus_trial($1)', ['a'.repeat(64)]);
    expect((await q('select plus_trial_started_at is not null t from profile_private where id=$1', [U.plusa])).rows[0].t).toBe(true);
  });

  // ---- E1: ana + bob la Bistro Alfa (fondator, luna gratis) ----
  await chk('sosire: cu locația departe e refuzată, cu cod greșit refuzată, cu codul mesei și locația ok; al doilea om din gașcă intră în aceeași intrare', async () => {
    const p = await mkPlan('ana', 'e1', VEN.A, ['bob']);
    await denied(rpc('ana', 'visit_client_arrive_v2($1,$2,44.9,26.9)', [p, await tokenOf(VEN.A)]), /la local/);
    await denied(rpc('ana', 'visit_client_arrive_v2($1,$2,44.43,null)', [p, await tokenOf(VEN.A)]), /la local/);
    await denied(rpc('ana', "visit_client_arrive_v2($1,'cod-gresit',null,null)", [p]), /Codul/);
    await denied(rpc('ana', 'visit_client_arrive_v2($1,$2,null,null)', [p, await tokenOf(VEN.B)]), /Codul/);
    const v = await arriveAt('ana', p, 'A');
    E.e1 = v.id; eq(v.kind, 'plan'); eq(v.group_visit, true); eq(v.venue_id, VEN.A);
    eq((await arriveAt('bob', p, 'A')).id, v.id);
    await denied(rpc('stranger', 'visit_client_arrive_v2($1,$2,null,null)', [p, await tokenOf(VEN.A)]), /participi/);
  });
  await chk('masa (opțională): cifre/nume scurt; mai lungă de 12 caractere refuzată; un străin nu o schimbă', async () => {
    await rpc('ana', "visit_table_v3($1,' 7 ')", [E.e1]);
    await denied(rpc('ana', "visit_table_v3($1,'masa foarte lungă de tot')", [E.e1]), /Masa/);
    await denied(rpc('stranger', "visit_table_v3($1,'3')", [E.e1]), /participi/);
    eq((await q('select table_no from visits where id=$1', [E.e1])).rows[0].table_no, '7');
  });
  await chk('bonul: de la altă firmă refuzat; din altă seară refuzat; cel din altă intrare nu se mută', async () => {
    await expect(bill(E.e1, 'ana', 240, '187', { cui: CUI.B })).rejects.toThrow(/firma/);
    const old = (await q("select to_char(now()-interval '3 days','YYYY-MM-DD') d")).rows[0].d;
    await expect(svc('select visit_receipt_v3($1,$2,$3,240,0,$4,$5,$6,false)', [U.ana, E.e1, CUI.A, old, '10:00', '187'])).rejects.toThrow(/seara asta/);
    await expect(bill(E.e1, 'stranger', 240, '187')).rejects.toThrow(/participi/);
  });
  await chk('bon client 240 (nr 0187): intrarea 240, fee 24; același bon scanat de bob nu se adună („scanat de 2”)', async () => {
    const a = await bill(E.e1, 'ana', 240, '0187'); eq([a.ok, a.duplicate], [true, false]);
    const b = await bill(E.e1, 'bob', 240, '187'); eq([b.ok, b.duplicate], [true, true]);
    const e = await entry(E.e1);
    eq([e.total, e.fee, e.scanned_by, e.state, e.free], [240, 24, 2, 'closed', true]);
    eq(e.receipts.length, 1); eq(e.receipts[0].scanners, 2);
  });
  await chk('bonul altei intrări nu se poate pune pe a doua intrare (același CUI + număr + zi)', async () => {
    const p2 = await mkPlan('stranger', 'e5-prep', VEN.A);
    const v2 = await arriveAt('stranger', p2, 'A', false);
    E.e5 = v2.id;
    await expect(bill(E.e5, 'stranger', 240, '187')).rejects.toThrow(/altă intrare/);
  });
  await chk('ospătarul pune o notă separată de 86 (staff): se adună (326); un om din afara echipei nu poate', async () => {
    const s = await bill(E.e1, 'waiter', 86, '188', { staff: true }); eq([s.ok, s.duplicate], [true, false]);
    await expect(bill(E.e1, 'stranger', 86, '189', { staff: true })).rejects.toThrow(/localul tău/);
    const e = await entry(E.e1); eq([e.total, e.fee], [326, 32.6]);
  });
  await chk('„Nu e al lor”: ospătarul nu poate contesta, proprietarul cu motiv de 5+ litere da; bonul iese din total', async () => {
    const r86 = (await q('select id from bills where visit_id=$1 and total=86', [E.e1])).rows[0].id;
    await denied(rpc('waiter', "biz_receipt_dispute_v3($1,'nu e masa lor')", [r86]), /Nu ai voie|echipa|Sesiunea/);
    await denied(rpc('biz', "biz_receipt_dispute_v3($1,'nu')", [r86]), /motivul/);
    await denied(rpc('biz2', "biz_receipt_dispute_v3($1,'nu e masa lor')", [r86]), /Nu ai voie|Sesiunea/);
    await rpc('biz', "biz_receipt_dispute_v3($1,'nu e masa lor')", [r86]);
    const e = await entry(E.e1); eq([e.total, e.fee], [240, 24]);
    eq(e.receipts.find((x: any) => x.total === 86).disputed, true);
  });
  lipseste('rezolvarea contestației „Nu e al lor” (private.receipt_disputes.state pending → upheld/dismissed): nu există nicio RPC în Admin; contestația rămâne „pending” și blochează „remaining”/„billing_ready” pentru localul respectiv');

  // ---- E2: cris, scanat de ospătar ----
  await chk('ospătarul scanează biletul grupului (biz_scan_v2): creează intrarea; cod pentru alt local refuzat', async () => {
    const p = await mkPlan('cris', 'e2', VEN.A);
    const t = await rpc('cris', 'plan_ticket_v2($1)', [p]);
    await denied(rpc('biz2', 'biz_scan_v2($1,$2)', [VEN.B, t.token]), /Cod greșit|alt local/);
    await denied(rpc('waiter', 'biz_scan_v2($1,$2)', [VEN.B, t.token]), /echipa|Sesiunea/);
    const s = await rpc('waiter', "biz_scan_v2($1,$2,'T9')", [VEN.A, t.token]);
    E.e2 = s.visit; eq(s.table, 'T9'); expect(s.word).toBeTruthy(); eq(s.entry.state, 'open');
    // clientul care scanează după ospătar primește aceeași intrare
    eq((await arriveAt('cris', p, 'A', false)).id, E.e2);
    eq((await q('select proof from visits where id=$1', [E.e2])).rows[0].proof, 'staff_ticket');
  });
  await chk('biz_entry_total_v3: scrie totalul 123.45 (rotunjire 12.345 → 12.35); ospătarul (scanare) nu poate; fără motiv/total 0 refuzat', async () => {
    await denied(rpc('waiter', "biz_entry_total_v3($1,123.45,'poza neclară')", [E.e2]), /Nu ai voie|Sesiunea/);
    await denied(rpc('manager', "biz_entry_total_v3($1,0,'poza neclară')", [E.e2]), /totalul/);
    await denied(rpc('manager', "biz_entry_total_v3($1,123.45,'')", [E.e2]), /de ce/);
    const e = await rpc('manager', "biz_entry_total_v3($1,123.45,'poza neclară')", [E.e2]);
    eq([e.total, e.fee, e.state], [123.45, 12.35, 'closed']); eq(e.receipts[0].by, 'local');
  });

  // ---- E3: fără bon ----
  await chk('fără bon până a doua zi la 12:00 → „no_bill”, 0 lei, nu intră în calculul banilor, localul nu mai poate scrie totalul', async () => {
    const p = await mkPlan('dan', 'e3', VEN.A);
    const v = await arriveAt('dan', p, 'A', false); E.e3 = v.id;
    eq((await entry(E.e3)).state, 'open');
    await q('update visits set work_day=work_day-2 where id=$1', [E.e3]);
    eq((await entry(E.e3)).state, 'no_bill');
    eq((await q("select count(*)::int n from private.visit_fees($1,current_date-10,current_date+2) where visit_id=$2", [VEN.A, E.e3])).rows[0].n, 0);
    await denied(rpc('manager', "biz_entry_total_v3($1,50,'prea târziu')", [E.e3]), /12:00/);
    await q('update visits set work_day=work_day+2 where id=$1', [E.e3]);
    await q('update visits set work_day=work_day-2 where id=$1', [E.e3]);
  });

  // ---- E4: Plus + Drop pe aceeași notă ----
  await chk('Drop-ul în feed: grup obișnuit 10%, grup Plus 15% (drop_feed_v2); Plus vede oferta imediat, ceilalți după 10 minute', async () => {
    const pPlus = await mkPlan('plusa', 'e4', VEN.A);
    E.p4 = pPlus;
    const plusFeed = await rpc('plusa', 'drop_feed_v2($1)', [pPlus]);
    eq(plusFeed.map((d: any) => [d.id, d.pct, d.plus]), [[dropA, 15, true]]);
    const pAna = await mkPlan('kid17', 'e-kid-feed', VEN.A);
    eq(await rpc('kid17', 'drop_feed_v2($1)', [pAna]), []);           // în primele 10 minute nu o vede
    await q("update drops set starts_at=starts_at-interval '11 minutes' where id=$1", [dropA]);
    const feed = await rpc('kid17', 'drop_feed_v2($1)', [pAna]);
    eq(feed.map((d: any) => [d.pct, d.plus]), [[10, false]]);
    await rpc('kid17', 'plan_cancel_v2($1)', [pAna]);
  });
  await chk('Drop + Plus pe aceeași notă: o singură reducere (max, nu suma); intrarea e „drop”, 15% (nu 25%)', async () => {
    const c = await rpc('plusa', "to_jsonb(drop_claim_v2($1,$2,2,44.45,26.1,'claim-e4'))", [dropA, E.p4]);
    eq([c.claimed_pct, c.plus_at_claim, c.seats], [15, true, 2]);
    await denied(rpc('plusa', 'visit_client_arrive_v2($1,$2,44.43,26.1)', [E.p4, await tokenOf(VEN.A)]), /10 minute/);
    await q("update drop_claims set created_at=now()-interval '11 minutes' where id=$1", [c.id]);
    const v = await arriveAt('plusa', E.p4, 'A'); E.e4 = v.id;
    eq([v.kind, v.discount_pct, v.plus, v.discount_scope], ['drop', 15, true, 'bill']);
    expect(v.discount_pct).toBeLessThan(25);
  });
  await chk('bon cu reducere: 300 lei pe notă (după reducere), fee 30 = 10% din notă, nu din valoarea fără reducere', async () => {
    await bill(E.e4, 'plusa', 300, '2001', { discount: 45 });
    const e = await entry(E.e4);
    eq([e.total, e.fee], [300, 30]);
    eq(money((await q('select discount_amount from visits where id=$1', [E.e4])).rows[0].discount_amount), 4500);
  });
  // ---- E5: Plus fără drop ----
  await chk('Plus fără Drop: reducerea e programul Plus al localului (10%); bon 80.40 → fee 8.04', async () => {
    const v = (await q('select kind,discount_pct,plus from visits where id=$1', [E.e5])).rows[0];
    eq([v.kind, v.discount_pct, v.plus], ['plus', 10, true]);
    await bill(E.e5, 'stranger', 80.4, '3001', { discount: 8.93 });
    const e = await entry(E.e5); eq([e.total, e.fee], [80.4, 8.04]);
  });

  // ---- Bar Beta: ne-fondator, plătește din prima zi ----
  await chk('Bar Beta (ne-fondator): bon 100.00 + 33.33 (staff) → intrarea 133.33, fee 13.33, NU e gratuit', async () => {
    const p = await mkPlan('bob', 'e6', VEN.B);
    const v = await arriveAt('bob', p, 'B'); E.e6 = v.id;
    await bill(E.e6, 'bob', 100, '55');
    await bill(E.e6, 'biz2', 33.33, '56', { staff: true });
    const e = await entry(E.e6);
    eq([e.total, e.fee, e.free], [133.33, 13.33, false]);
  });

  // ---- lista Business ----
  await chk('biz_entries_v3: azi apar toate intrările localului cu numerotare, nume și masă; ospătarul o vede; un străin nu; ieri e separat', async () => {
    const day = await rpc('manager', 'biz_entries_v3($1,$2::date)', [VEN.A, WD]);
    const ids = day.entries.map((x: any) => x.id).sort();
    for (const id of [E.e1, E.e2, E.e4, E.e5]) expect(ids).toContain(id);
    eq(day.entries.find((x: any) => x.id === E.e1).table, '7');
    eq(day.entries.map((x: any) => x.no), [...day.entries.map((x: any) => x.no)].sort((a, b) => a - b));
    expect((await rpc('waiter', 'biz_entries_v3($1,null)', [VEN.A])).entries.length).toBeGreaterThan(0);
    await denied(rpc('stranger', 'biz_entries_v3($1,null)', [VEN.A]), /echipa|Sesiunea/);
    await denied(rpc('biz2', 'biz_entries_v3($1,null)', [VEN.A]), /echipa|Sesiunea/);
    // E3 (backdatat cu 2 zile) apare în ziua lui, ca „no_bill”
    const old = await rpc('manager', "biz_entries_v3($1,($2::date-2))", [VEN.A, WD]);
    eq(old.entries.map((x: any) => [x.id, x.state]), [[E.e3, 'no_bill']]);
    await denied(rpc('manager', "biz_entries_v3($1,($2::date-500))", [VEN.A, WD]), /Zi invalidă/);
  });

  // ---- banii: biz_finance_v2 ----
  await chk('Bistro Alfa (fondator, luna gratis): încasat 743.85, fee de plătit 0, „ai fi plătit” 74.39, o linie pe intrare, contestația blochează „remaining”', async () => {
    const f = await finance('biz', VEN.A);
    eq([money(f.revenue), money(f.fee), money(f.would_pay)], [74385, 0, 7439]);
    eq([f.blocked, f.partial, f.remaining, f.billing_ready, f.estimate], [1, true, null, false, true]);
    eq(f.lines.length, 4);                                               // E3 fără bon nu are linie
    eq(f.lines.every((l: any) => l.free === true && l.fee === 0), true);
    eq(money(f.lines.reduce((a: number, l: any) => a + l.would_pay, 0)), 7439);
    eq(money(f.discounts) >= 4500 + 893, true);
  });
  await chk('Bar Beta (ne-fondator): fee 13.33 de plătit, would_pay 0', async () => {
    const f = await finance('biz2', VEN.B);
    eq([money(f.revenue), money(f.fee), money(f.would_pay)], [13333, 1333, 0]);
    eq([f.lines.length, f.lines[0].free], [1, false]);
  });
  await chk('suma pe intrări (biz_entries_v3) = totalul lunii (biz_finance_v2) = admin_finance, exact până la ban', async () => {
    const day = await rpc('biz', 'biz_entries_v3($1,$2::date)', [VEN.A, WD]);
    const sum = day.entries.reduce((a: number, e: any) => a + money(e.fee), 0);
    const fa = await finance('biz', VEN.A);
    eq(sum, money(fa.would_pay));
    const fb = await finance('biz2', VEN.B);
    const af = await rpc('contabil', 'admin_finance($1::date,$1::date)', [WD]);
    eq(money(af.revenue), money(fa.revenue) + money(fb.revenue));
    eq(money(af.fee), money(fa.fee) + money(fb.fee));
    eq(money(af.would_pay), money(fa.would_pay) + money(fb.would_pay));
    eq([af.billing_ready, af.estimate], [false, true]);
    const month = await rpc('biz', "biz_month($1)", [VEN.A]);
    eq(money(month.fee), money(fa.fee));
  });
  await chk('Admin vede aceleași cifre pe localuri (admin_partners: luna doar pentru cine are „money”)', async () => {
    const withMoney = await rpc('contabil', 'admin_partners()');
    const a = withMoney.find((p: any) => p.venue_id === VEN.A), b = withMoney.find((p: any) => p.venue_id === VEN.B);
    eq(money(b.month.fee), 1333); eq(money(a.month.would_pay), 7439);
    expect((await rpc('admin', 'admin_partners()')).every((p: any) => p.month === null)).toBe(true);
  });
  await chk('banii nu se văd din afară: ospătarul și proprietarul altui local nu citesc finanțele; contabilul poate', async () => {
    await denied(rpc('waiter', 'biz_finance_v2($1,$2::date,$2::date)', [VEN.A, WD]), /Nu ai voie|Sesiunea/);
    await denied(rpc('biz2', 'biz_finance_v2($1,$2::date,$2::date)', [VEN.A, WD]), /Nu ai voie|Sesiunea/);
    await denied(rpc('biz', 'biz_finance_v2($1,$2::date,$3::date)', [VEN.A, '2020-01-01', WD]), /Perioad/);
    const f = await rpc('contabil', 'biz_finance_v2($1,$2::date,$2::date)', [VEN.A, WD]);
    expect(f.revenue).toBeDefined();
  });
  await chk('bonurile din tabel nu se pot citi/scrie direct de clienți sau de local (RLS + revoke)', async () => {
    for (const w of ['ana', 'biz', 'waiter'] as Who[]) {
      await denied(as(w, 'select * from bills'), /permission denied/);
      await denied(as(w, "insert into bills(visit_id,venue_id,total,issued_at) values($1,'bistro-alfa',1,now())", [E.e1]), /permission denied/);
      await denied(as(w, 'select * from private.visit_fees($1,current_date,current_date)', [VEN.A]), /permission denied/);
    }
    await denied(rpc('ana', 'visit_receipt_v3($1,$2,$3,1,0,current_date,now()::time,\'1\',false)', [U.ana, E.e1, CUI.A]), /permission denied/);
  });
  await chk('visits: clientul își vede doar vizitele, localul doar ale lui', async () => {
    eq((await as('stranger', 'select count(*)::int n from visits')).rows[0].n, 1);
    const own = (await as('biz', 'select distinct venue_id from visits')).rows.map((r: any) => r.venue_id);
    expect(own.every((x: string) => x === VEN.A)).toBe(true);
  });

  // ---- Admin: decizii pe vizite vechi (număr / beneficiu), cu versiuni ----
  await chk('admin_count_resolve_v2 / admin_benefit_decide_v2: versiune lipsă sau veche refuzată, suportul nu poate, a doua aplicare cu aceeași versiune refuzată', async () => {
    const vid = (await q(`insert into visits(venue_id,user_id,kind,people,group_visit,work_day,outcome,bill,bill_source,discount_amount,closed_at,proof)
       values($1,$2,'rezervare',6,true,$3,'a venit',200,'local',30,now(),'staff_ticket') returning id`, [VEN.A, U.ana, WD])).rows[0].id;
    await q('update private.visit_pricing set reservation_unit=5,drop_unit=7,reservation_limit=2,drop_limit=4 where visit_id=$1', [vid]); // limitele „vechi”, încă verificate de Admin
    await q('insert into private.visit_counts(visit_id,people,adults,drop_adults,state) values($1,6,6,4,$2)', [vid, 'disputed']);
    await q("insert into private.benefit_cases(visit_id,reason,reporter) values($1,'Reducere refuzată',$2)", [vid, U.eva]);
    await denied(rpc('suport', "admin_count_resolve_v2($1,1,6,6,4,'Număr verificat')", [vid]), /echipa|Sesiunea|Nu ai voie/);
    await denied(rpc('admin', "admin_count_resolve_v2($1,null,6,6,4,'Număr verificat')", [vid]), /versiune/);
    await rpc('admin', "admin_count_resolve_v2($1,1,6,6,4,'Număr verificat')", [vid]);
    await denied(rpc('admin', "admin_count_resolve_v2($1,1,6,6,4,'Număr verificat')", [vid]), /versiune/);
    await denied(rpc('suport', "admin_benefit_decide_v2($1,1,true,'Refuz verificat')", [vid]), /echipa|Sesiunea|Nu ai voie/);
    await denied(rpc('admin', "admin_benefit_decide_v2($1,null,true,'Refuz verificat')", [vid]), /ersiune/);
    await rpc('admin', "admin_benefit_decide_v2($1,1,true,'Refuz verificat')", [vid]);
    await denied(rpc('admin', "admin_benefit_decide_v2($1,1,true,'Refuz verificat')", [vid]), /ersiune|deja/);
    eq((await q('select state,version from private.benefit_cases where visit_id=$1', [vid])).rows[0], { state: 'upheld', version: 2 });
    eq((await q('select count(*)::int n from private.review_log where visit_id=$1', [vid])).rows[0].n, 2);
    // vizita veche (fără intrare în noul model) nu a schimbat banii din noul model
    const f = await finance('biz', VEN.A);
    eq(money(f.would_pay), 7439 + 0);
  });
  await chk('admin_operations (Client+Business într-o singură coadă): suportul vede fără bani; contabilul nu are acces', async () => {
    const ops = await rpc('suport', 'admin_operations($1::date,$1::date,null,\'all\',100,0)', [WD]);
    expect(ops.total_visits).toBeGreaterThanOrEqual(5);
    for (const v of ops.visits) { expect(v.bill).toBeNull(); expect(v.user_id).toBeUndefined(); }
    await denied(rpc('contabil', 'admin_operations_summary()'));
    eq((await rpc('suport', 'admin_operations_summary()')).day_boundary, '05:00');
  });
  await chk('abuz: localul nu poate șterge din bani un bon scris chiar de el (biz_receipt_dispute_v3 pe un bon by_role=local) și nu fără știrea CeFaci', async () => {
    const p = await mkPlan('cris', 'e-abuz', VEN.B);
    const v = await arriveAt('cris', p, 'B');
    const e = await rpc('biz2', "biz_entry_total_v3($1,500,'poza nu merge')", [v.id]);
    eq([e.total, e.fee], [500, 50]);
    const rid = (await q('select id from bills where visit_id=$1', [v.id])).rows[0].id;
    let after: any;
    try { await rpc('biz2', "biz_receipt_dispute_v3($1,'nu e al nostru')", [rid]); after = await entry(v.id); } catch { after = null; }
    // așteptat: refuzat. Actual: reușește și intrarea ajunge la 0 lei, fără nicio aprobare
    if (after) throw new Error('proprietarul a contestat propriul total (500 lei, by=local) și fee-ul intrării a devenit ' + after.fee + ' lei imediat, fără aprobarea nimănui');
  });
  await chk('contestațiile bonurilor ajung la Admin: există măcar o funcție admin_* care citește private.receipt_disputes (docs/flux-intrare-bon.md: „echipa CeFaci verifică”)', async () => {
    const n = (await q("select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'admin\_%' and p.prosrc ilike '%receipt_disputes%'")).rows[0].n;
    if (n === 0) throw new Error('nicio funcție admin_* nu citește private.receipt_disputes: un bon contestat de local iese imediat din total (receipt_counts) și rămâne „pending” pentru totdeauna; Admin nu le vede și nu le poate hotărî');
  });
  lipseste('„Sugestii de localuri partenere” cu bon mediu și ce s-a consumat (CLAUDE.md, 06.10): admin_partner_suggestions arată doar persoane/bonuri numărate; `citeste-bon` nu păstrează liniile bonului (doar total/CUI/număr), deci „ce s-a consumat” nu se poate calcula');
  endStage();
}, 180000);

// =====================================================================================================
// Etapa 7: evenimente (legături către vânzători) și bilete vândute în CeFaci (DOAR TEST: private.ticket_config.live = false)
let linkEvent = '', tkEvent = '', tGen = '', tVip = '';
const evPayload = (over: Record<string, unknown> = {}) => JSON.stringify({ title: 'Concert de test', kind: 'concert', starts_at: when(3), place_name: 'Arenele Romane', lat: 44.42, lon: 26.1, price_from: 80, ticket_url: 'https://www.iabilet.ro/bilete-concert-test-123/', status: 'published', ...over });
it('7. Evenimente și bilete (doar în modul TEST): vânzători permiși, comandă, plată de test, transfer, scanare, anulare, 8% / 2 lei', async () => {
  begin(7, 'Evenimente și bilete (test)');
  await chk('plățile reale sunt oprite în configurare (ticket_config.live = false) și nu pot fi pornite din aplicație', async () => {
    eq((await q('select live from private.ticket_config')).rows[0].live, false);
    await denied(as('founder', 'update private.ticket_config set live=true'), /permission denied/);
    await denied(as('ana', 'select * from private.ticket_config'), /permission denied/);
  });
  await chk('vânzătorii permiși: doar https și doar din listă; linkuri false/lookalike refuzate (admin_event_save)', async () => {
    for (const bad of ['http://www.iabilet.ro/x', 'https://iabilet.ro.evil.com/x', 'https://iabilet.ro@evil.com/x', 'https://evil.com/?r=iabilet.ro', 'javascript:alert(1)', 'https://fake-iabilet.ro/x'])
      await denied(rpc('editor', 'admin_event_save(null,$1::jsonb)', [evPayload({ ticket_url: bad })]), /vânzător oficial/);
    await denied(rpc('editor', 'admin_event_save(null,$1::jsonb)', [evPayload({ ticket_url: '' })]), /linkul vânzătorului/);
    for (const w of ['client', 'suport', 'contabil', 'moderator', 'ana'] as const) if (w !== 'client') await denied(rpc(w as Who, 'admin_event_save(null,$1::jsonb)', [evPayload()]));
  });
  await chk('editorul publică un eveniment cu link oficial; jurnalul se scrie; vânzătorul e recunoscut', async () => {
    const e = (await as('editor', 'select * from admin_event_save(null,$1::jsonb)', [evPayload()])).rows[0];
    linkEvent = e.id; eq(e.seller, 'iaBilet');
    expect((await q('select count(*)::int n from private.event_log')).rows[0].n).toBeGreaterThanOrEqual(1);
    await as('editor', 'select admin_event_save(null,$1::jsonb)', [evPayload({ title: 'Ciornă', status: 'draft', ticket_url: '' })]);
    await q("insert into events(title,kind,starts_at,place_name,lat,lon,status) values('Vechi','concert',now()-interval '5 days','Undeva',44.4,26.1,'published')");
  });
  await chk('clientul cu cont vede doar evenimentele publicate și viitoare; fără cont nu vede nimic; nu poate modifica linkul', async () => {
    const seen = (await as('ana', 'select title from events order by title')).rows.map((r: any) => r.title);
    expect(seen).toContain('Concert de test'); expect(seen).not.toContain('Ciornă'); expect(seen).not.toContain('Vechi');
    await denied(anon('select * from events'), /permission denied/);
    await denied(as('ana', "update events set ticket_url='https://evil.com' where title='Concert de test'"), /permission denied/);
    await denied(as('ana', 'select * from private.event_clicks'), /permission denied/);
  });
  await chk('„Cumpără bilete”: linkul verificat, un click numărat pe zi; link schimbat de mână spre alt site e refuzat la ușă; ciorna nu', async () => {
    eq(await rpc('ana', 'event_ticket_url($1)', [linkEvent]), { url: 'https://www.iabilet.ro/bilete-concert-test-123/', seller: 'iaBilet' });
    await rpc('ana', 'event_ticket_url($1)', [linkEvent]);
    eq((await q('select count(*)::int n from private.event_clicks where event_id=$1', [linkEvent])).rows[0].n, 1);
    const draft = (await q("select id from events where title='Ciornă'")).rows[0].id;
    await denied(rpc('ana', 'event_ticket_url($1)', [draft]), /nu sunt disponibile/);
    await q("update events set ticket_url='https://evil.com/x' where id=$1", [linkEvent]);
    await denied(rpc('ana', 'event_ticket_url($1)', [linkEvent]), /nu sunt disponibile/);
    await q("update events set ticket_url='https://www.iabilet.ro/bilete-concert-test-123/' where id=$1", [linkEvent]);
    expect((await rpc('editor', 'admin_events()')).find((x: any) => x.title === 'Concert de test').clicks).toBe(1);
  });

  // ---- bilete vândute în CeFaci, la Club Gama ----
  const door = 'eva' as Who;
  await chk('echipa clubului: ușierul (eva) e „scanare”; testerii (ana, plusa, kid17) intră în echipă ca să cumpere în modul test', async () => {
    await rpc('biz3', "biz_team_set($1,'@eva','scanare')", [VEN.C]);
    for (const w of ['ana', 'plusa', 'dan'] as Who[]) await rpc('biz3', 'biz_team_set($1,$2,\'scanare\')', [VEN.C, '@' + w]);
    await q("insert into partner_members(venue_id,user_id,role) values($1,$2,'scanare') on conflict do nothing", [VEN.C, U.kid17]);
  });
  await chk('clubul nu vinde până nu e aprobat contul de încasare (test); doar proprietarul cere; Admin nu poate activa „activ” cât plățile reale sunt oprite', async () => {
    const base = { title: 'Noaptea de test', kind: 'party', starts_at: when(2), min_age: 18, types: [{ name: 'General', price: 50, qty: 100 }, { name: 'VIP', price: 150, qty: 2, max_per_order: 2 }] };
    const save = (who: Who, p: object, id: string | null = null) => rpc(who, 'biz_ticket_event_save($1,$2,$3::jsonb)', [VEN.C, id, JSON.stringify(p)]);
    await denied(save('biz3', { ...base, status: 'published' }), /contul de încasare/);
    await denied(rpc(door, 'biz_ticket_payout_request($1,$2::jsonb)', [VEN.C, '{}']), /proprietarul/);
    await rpc('biz3', 'biz_ticket_payout_request($1,$2::jsonb)', [VEN.C, JSON.stringify({ legal_name: 'Gama SRL', cui: 'RO' + CUI.C, iban: 'RO49 AAAA 1B31 0075 9384 0000' })]);
    eq((await q('select status,cui,iban_tail from private.ticket_payouts where venue_id=$1', [VEN.C])).rows[0], { status: 'cerut', cui: CUI.C, iban_tail: '0000' });
    await denied(rpc('admin', "admin_ticket_payout_set($1,'activ','abc','')", [VEN.C]), /Plățile reale nu sunt pornite/);
    await denied(rpc('biz3', "admin_ticket_payout_set($1,'test','','')", [VEN.C]), PERM);
    await denied(rpc('contabil', "admin_ticket_payout_set($1,'test','','')", [VEN.C]), PERM);
    await rpc('admin', "admin_ticket_payout_set($1,'test','','cont de probă')", [VEN.C]);
    tkEvent = await save('biz3', { ...base, status: 'published' });
    const ts = (await q('select id,name from ticket_types where event_id=$1 order by sort', [tkEvent])).rows; tGen = ts[0].id; tVip = ts[1].id;
    const e = (await q('select price_from,price_to,sale_mode from events where id=$1', [tkEvent])).rows[0];
    eq([e.price_from, e.price_to, e.sale_mode], ['50.00', '150.00', 'cefaci']);
  });
  await chk('eveniment de test: îl văd echipa clubului și echipa CeFaci; un client obișnuit nu și nu poate cumpăra', async () => {
    eq((await as('bob', 'select id from events where id=$1', [tkEvent])).rows.length, 0);
    eq((await as(door, 'select id from events where id=$1', [tkEvent])).rows.length, 1);
    eq((await as('admin', 'select id from events where id=$1', [tkEvent])).rows.length, 1);
    await denied(rpc('bob', "ticket_order_start($1,$2::jsonb)", [tkEvent, JSON.stringify([{ type: tGen, qty: 1 }])]), /nu sunt disponibile/);
    // Admin nu rescrie un eveniment cu bilete cu editorul de linkuri
    await denied(rpc('admin', 'admin_event_save($1,$2::jsonb)', [tkEvent, evPayload({ place_name: 'x' })]), /îl schimbă localul|Nu ai voie/);
  });
  let ordAna = '', ordPlus = '';
  await chk('comandă: 2 General + 1 VIP = 250; taxa 2 lei × 3 bilete = 6; total 256; CeFaci păstrează 8% din bilete = 20', async () => {
    const o = await rpc('ana', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tGen, qty: 2 }, { type: tVip, qty: 1 }])]);
    eq([o.tickets, o.subtotal, o.fee, o.total, o.plus, o.test], [3, 250, 6, 256, false, true]); ordAna = o.order;
    eq((await q('select commission from ticket_orders where id=$1', [o.order])).rows[0].commission, '20.00');
  });
  await chk('Plus: fără taxa de 2 lei; o comandă nouă anulează comanda veche în așteptare (biletele revin)', async () => {
    const p = await rpc('plusa', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tVip, qty: 1 }])]);
    eq([p.subtotal, p.fee, p.total, p.plus], [150, 0, 150, true]); ordPlus = p.order;
    eq((await q('select commission from ticket_orders where id=$1', [p.order])).rows[0].commission, '12.00');
    // Ana mai face o comandă: cea veche se anulează
    const o2 = await rpc('ana', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tGen, qty: 2 }])]);
    eq((await q('select status from ticket_orders where id=$1', [ordAna])).rows[0].status, 'anulat');
    ordAna = o2.order; eq([o2.subtotal, o2.fee, o2.total], [100, 4, 104]);
    eq((await q('select sold from ticket_types where id=$1', [tVip])).rows[0].sold, 1);
  });
  await chk('limite: stoc (VIP epuizat după al doilea), max pe comandă, 18+; nu plătești/anulezi comanda altuia', async () => {
    await denied(rpc('dan', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tVip, qty: 2 }])]), /Mai sunt doar|Cel mult/);
    await denied(rpc('dan', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tGen, qty: 7 }])]), /Cel mult 6/);
    await denied(rpc('kid17', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tGen, qty: 1 }])]), /de la 18 ani/);
    await denied(rpc('dan', 'ticket_order_test_pay($1)', [ordAna]), /nu există/);
    await rpc('dan', 'ticket_order_cancel($1)', [ordAna]);
    eq((await q('select status from ticket_orders where id=$1', [ordAna])).rows[0].status, 'asteapta');
    await denied(as('ana', 'select * from ticket_orders'), /permission denied/);
    await denied(rpc('ana', "ticket_order_paid($1,'x',104)", [ordAna]), /permission denied/);
  });
  await chk('plata de test: biletele apar; a doua plată refuzată; comanda neplătită 15 minute dă biletele înapoi', async () => {
    await rpc('ana', 'ticket_order_test_pay($1)', [ordAna]);
    await rpc('plusa', 'ticket_order_test_pay($1)', [ordPlus]);
    await denied(rpc('ana', 'ticket_order_test_pay($1)', [ordAna]), /nu mai așteaptă/);
    eq((await rpc('ana', 'my_tickets()')).length, 2);
    const d = await rpc('dan', 'ticket_order_start($1,$2::jsonb)', [tkEvent, JSON.stringify([{ type: tGen, qty: 4 }])]);
    await q("update ticket_orders set expires_at=now()-interval '1 minute' where id=$1", [d.order]);
    await denied(rpc('dan', 'ticket_order_test_pay($1)', [d.order]), /15 minute/);
    await rpc('biz3', 'biz_ticket_events($1)', [VEN.C]);
    eq((await q('select sold from ticket_types where id=$1', [tGen])).rows[0].sold, 2);
  });
  await chk('QR-ul se schimbă la 30 s și coincide cu codul serverului; ușierul din alt local sau fără drept nu intră; înainte de start „nu pentru acum”', async () => {
    const mine = await rpc('plusa', 'my_tickets()');
    const t = mine[0], w = Math.floor(Date.now() / 30000);
    eq(mine.length, 1); expect(t.secret).toMatch(/^[0-9a-f]{32}$/);
    const scan = (who: Who, qr: string, venue = VEN.C) => rpc(who, 'biz_ticket_scan($1,$2)', [venue, qr]);
    await denied(scan(door, ticketQr(t.id, t.secret, w - 20, sha)), /nu mai e valabil/);
    await denied(scan(door, 'https://evil.com'), /Nu e un bilet CeFaci/);
    await denied(scan('biz', ticketQr(t.id, t.secret, w, sha), VEN.A), /Nu ai voie|echipa|Sesiunea|nu e pentru/);
    await denied(scan('biz2', ticketQr(t.id, t.secret, w, sha), VEN.B), /nu e pentru un eveniment de aici/);
    await denied(scan(door, ticketQr(t.id, t.secret, w, sha)), /nu pentru acum/);
    await q("update events set starts_at=now()-interval '1 hour' where id=$1", [tkEvent]);
    const ok = await scan(door, ticketQr(t.id, t.secret, w, sha));
    eq([ok.ok, ok.type, ok.name, ok.test], [true, 'VIP', 'Plusa', true]);
    const again = await scan(door, ticketQr(t.id, t.secret, w, sha));
    eq([again.ok, again.already], [false, true]);
    await denied(scan('bob', ticketQr(t.id, t.secret, w, sha)), PERM);
  });
  await chk('transfer: doar către un prieten adult, bilet nou (secret nou); biletul vechi nu mai intră; cel folosit nu se poate da', async () => {
    const mine = await rpc('ana', 'my_tickets()');
    const w = Math.floor(Date.now() / 30000);
    await denied(rpc('ana', 'ticket_transfer($1,$2)', [mine[0].id, U.stranger]), /doar unui prieten/);
    await denied(rpc('ana', 'ticket_transfer($1,$2)', [mine[0].id, U.kid17]), /vârsta|18/);
    await rpc('ana', 'ticket_transfer($1,$2)', [mine[0].id, U.dan]);
    const dans = await rpc('dan', 'my_tickets()');
    eq(dans.length, 1); expect(dans[0].secret).not.toBe(mine[0].secret);
    await denied(rpc(door, 'biz_ticket_scan($1,$2)', [VEN.C, ticketQr(mine[0].id, mine[0].secret, w, sha)]), /nu mai e valabil/);
    eq((await rpc(door, 'biz_ticket_scan($1,$2)', [VEN.C, ticketQr(dans[0].id, dans[0].secret, w, sha)])).name, 'Dan');
    await denied(rpc('dan', 'ticket_transfer($1,$2)', [dans[0].id, U.ana]), /nu mai e valabil/);
  });
  await chk('clubul vede ce a vândut și cât păstrează CeFaci; ușierul nu vede banii; plata de încasare e în „test”', async () => {
    const page = await rpc('biz3', 'biz_ticket_events($1)', [VEN.C]);
    eq([page.live, Number(page.commission), Number(page.fee), page.payout.status], [false, 0.08, 2, 'test']);
    const e = page.events[0];
    // 2 General (Ana) + 1 VIP (plusa) vândute; 2 bilete folosite (VIP + General transferat)
    eq([e.sold, e.scanned], [3, 2]);
    eq([Number(e.gross), Number(e.commission_lei)], [250, 20]);
    await denied(rpc(door, 'biz_ticket_events($1)', [VEN.C]), /Nu ai voie/);
    const pl = await rpc('admin', 'admin_ticket_payouts()'); eq(pl.live, false); expect(pl.list.some((p: any) => p.venue_id === VEN.C)).toBe(true);
    await denied(rpc('editor', 'admin_ticket_payouts()'), PERM);
  });
  await chk('rotunjire: 3 × 33.33 = 99.99 → comision 8% = 8.00 (7.9992), taxa 6.00; stocul nu poate scădea sub vândut; prețul cu vânzări nu se schimbă', async () => {
    const p = { title: 'Serată', kind: 'party', starts_at: when(5), min_age: 16, status: 'published', types: [{ name: 'Mic', price: 33.33, qty: 50 }] };
    const ev2 = await rpc('biz3', 'biz_ticket_event_save($1,null,$2::jsonb)', [VEN.C, JSON.stringify(p)]);
    const tid = (await q('select id from ticket_types where event_id=$1', [ev2])).rows[0].id;
    const o = await rpc('plusb', 'ticket_order_start($1,$2::jsonb)', [ev2, JSON.stringify([{ type: tid, qty: 3 }])]).catch(async (e) => {
      // plusb nu e în echipa clubului: în modul test nu poate cumpăra — se adaugă ca tester
      await q("insert into partner_members(venue_id,user_id,role) values($1,$2,'scanare') on conflict do nothing", [VEN.C, U.plusb]);
      return rpc('plusb', 'ticket_order_start($1,$2::jsonb)', [ev2, JSON.stringify([{ type: tid, qty: 3 }])]);
    });
    eq([o.subtotal, o.fee, o.total], [99.99, 6, 105.99]);
    eq(money((await q('select commission from ticket_orders where id=$1', [o.order])).rows[0].commission), 800);
    await rpc('plusb', 'ticket_order_test_pay($1)', [o.order]);
    const types = [{ id: tid, name: 'Mic', price: 40, qty: 50, max_per_order: 6 }];
    await denied(rpc('biz3', 'biz_ticket_event_save($1,$2,$3::jsonb)', [VEN.C, ev2, JSON.stringify({ ...p, types })]), /nu se mai schimbă/);
    await denied(rpc('biz3', 'biz_ticket_event_save($1,$2,$3::jsonb)', [VEN.C, ev2, JSON.stringify({ ...p, types: [{ ...types[0], price: 33.33, qty: 2 }] })]), /s-au vândut deja 3/);
    // anulare: banii se întorc (comandă „rambursat”), biletele nefolosite devin „rambursat”
    await rpc('biz3', 'biz_ticket_event_save($1,$2,$3::jsonb)', [VEN.C, ev2, JSON.stringify({ ...p, status: 'cancelled', types: [{ ...types[0], price: 33.33 }] })]);
    eq((await q("select status from ticket_orders where event_id=$1", [ev2])).rows[0].status, 'rambursat');
    eq((await q("select status from tickets where event_id=$1 group by status", [ev2])).rows.map((r: any) => r.status), ['rambursat']);
    await denied(rpc('biz3', 'biz_ticket_event_save($1,$2,$3::jsonb)', [VEN.C, ev2, JSON.stringify({ ...p, types: [{ ...types[0], price: 33.33 }] })]), /anulat/);
    eq((await rpc('plusb', 'my_tickets()')).filter((x: any) => x.event_id === ev2 && x.status === 'valid').length, 0);
  });
  await chk('anulare după start: biletele folosite rămân „folosit”, cel nefolosit devine „rambursat”', async () => {
    const p = { title: 'Noaptea de test', kind: 'party', min_age: 18, status: 'cancelled' };
    const page = await rpc('biz3', 'biz_ticket_events($1)', [VEN.C]);
    const e = page.events.find((x: any) => x.id === tkEvent);
    const types = e.types.map((t: any) => ({ id: t.id, name: t.name, price: Number(t.price), qty: t.qty, max_per_order: t.max_per_order }));
    await rpc('biz3', 'biz_ticket_event_save($1,$2,$3::jsonb)', [VEN.C, tkEvent, JSON.stringify({ ...p, starts_at: e.starts_at, types })]);
    const ts = (await q('select status,count(*)::int n from tickets where event_id=$1 group by status order by 1', [tkEvent])).rows;
    eq(ts, [{ status: 'folosit', n: 2 }, { status: 'rambursat', n: 1 }]);
    const orders = (await q('select status,count(*)::int n from ticket_orders where event_id=$1 group by status order by 1', [tkEvent])).rows;
    if (orders.some((o: any) => o.status === 'rambursat')) nota('anularea unui eveniment DUPĂ ce a început marchează comanda „rambursat” chiar dacă TOATE biletele ei au fost scanate la intrare (banii pentru bilete folosite s-ar returna); vezi și tests/tickets.test.ts');
  });
  lipseste('rambursare reală: nu există RPC/flux pentru banii înapoi prin Netopia (faza 3 e doar test); statusul „de_rambursat” se citește la ștergerea contului dar nu există ecran/RPC care să-l proceseze');
  endStage();
}, 180000);

// =====================================================================================================
const DEV1 = 'a'.repeat(64), DEV2 = 'b'.repeat(64), DEV3 = 'c'.repeat(64);
const snap = async (sql: string, a: unknown[] = []) => JSON.stringify((await q(sql, a)).rows);
/** o scriere interzisă: ori e refuzată, ori nu atinge niciun rând */
const blocked = async (p: Promise<any>) => {
  try { const r = await p; if ((r.affectedRows ?? 0) !== 0) throw new Error('MODIFICAREA A REUȘIT (' + r.affectedRows + ' rânduri)'); }
  catch (e: any) { if (/MODIFICAREA A REUȘIT/.test(e.message)) throw e; }
};
it('8. Plus: proba pe telefon (comutatorul), o zi de Plus de la suport', async () => {
  begin(8, 'Plus');
  await chk('comutatorul proba_pe_telefon este oprit acum (decizie 31.10) și nu se citește / scrie din aplicație', async () => {
    eq((await q("select enabled from private.switches where key='proba_pe_telefon'")).rows[0].enabled, false);
    await denied(as('ana', 'select * from private.switches'), /permission denied/);
    await denied(as('founder', "update private.switches set enabled=true where key='proba_pe_telefon'"), /permission denied/);
  });
  await chk('comutator OPRIT: al doilea cont pe același telefon primește proba (permis acum); același cont pe alt telefon păstrează data', async () => {
    const t1 = await rpc('plusb', 'start_plus_trial($1)', [DEV1]);
    expect(t1).toBeTruthy();
    eq(String(await rpc('plusb', 'start_plus_trial($1)', [DEV2])), String(t1));
  });
  await chk('comutator PORNIT: al treilea cont pe telefonul folosit e refuzat cu hint „proba-folosita”; alt telefon merge', async () => {
    await q("update private.switches set enabled=true where key='proba_pe_telefon'");
    try {
      let err: any;
      try { await rpc('bob', 'start_plus_trial($1)', [DEV1]); } catch (e) { err = e; }
      expect(err?.message).toMatch(/folosit deja/);
      eq(err?.hint, 'proba-folosita');
      await rpc('bob', 'start_plus_trial($1)', ['d'.repeat(64)]);
    } finally { await q("update private.switches set enabled=false where key='proba_pe_telefon'"); }
  });
  await chk('codul telefonului nu se păstrează în clar; aplicația veche (fără cod valid) e refuzată; proba și Plus nu se scriu de mână', async () => {
    eq((await q('select count(*)::int n from private.trial_devices where device in ($1,$2)', [DEV1, DEV2])).rows[0].n, 0);
    await denied(rpc('dan', 'start_plus_trial()'), /Actualizează/);
    await denied(rpc('dan', "start_plus_trial('xyz')"), /Actualizează/);
    await as('dan', 'update profile_private set plus_trial_started_at=now() where id=$1', [U.dan]).catch(() => {});
    eq((await q('select plus_trial_started_at t from profile_private where id=$1', [U.dan])).rows[0].t, null);
    await as('dan', "update profile_private set plus_until=now()+interval '1 year' where id=$1", [U.dan]).catch(() => {});
    eq((await q('select plus_until t from profile_private where id=$1', [U.dan])).rows[0].t, null);
    await denied(as('dan', 'select count(*) from private.trial_devices'), /permission denied/);
  });
  await chk('admin_plus_grant: o zi, cheie idempotentă, aceeași cheie cu alt conținut refuzată, 7 zile refuzate, echipa (staff și membri de local) nu primește, moderatorul/contabilul nu pot', async () => {
    const g = await rpc('suport', "admin_plus_grant($1,1,'Problemă confirmată la suport','sim-grant-cris')", [U.cris]);
    eq(g.days, 1);
    eq((await rpc('suport', "admin_plus_grant($1,1,'Problemă confirmată la suport','sim-grant-cris')", [U.cris])).id, g.id);
    await denied(rpc('suport', "admin_plus_grant($1,1,'Problemă confirmată la suport','sim-grant-cris')", [U.dan]), /altă cerere/);
    await denied(rpc('admin', "admin_plus_grant($1,7,'Problemă verificată','sim-seven')", [U.dan]), /singură zi/);
    await denied(rpc('suport', "admin_plus_grant($1,1,'Cadou pentru echipă','sim-staff')", [U.admin]), /echipe/);
    await denied(rpc('suport', "admin_plus_grant($1,1,'Eva e ospătar la un local','sim-eva')", [U.eva]), /echipe/);
    await denied(rpc('moderator', "admin_plus_grant($1,1,'Alt rol interzis','sim-mod')", [U.dan]), PERM);
    await denied(rpc('contabil', "admin_plus_grant($1,1,'Contabil nu are voie','sim-acc')", [U.dan]), PERM);
    await denied(rpc('suport', "admin_plus_grant($1,1,'Al doilea suport în 60 de zile','sim-grant-cris-2')", [U.cris]), /60 de zile/);
  });
  await chk('compensarea de Plus din decizia pe beneficiu (admin_benefit_decide_v2 → +7 zile) apare pe contul reclamantului', async () => {
    const r = (await q('select plus_until from profile_private where id=$1', [U.eva])).rows[0].plus_until;
    expect(new Date(r).getTime()).toBeGreaterThan(Date.now() + 6 * 864e5);
  });
  endStage();
}, 120000);

// =====================================================================================================
it('9. Notificări, clopoțel și limitele zilnice', async () => {
  begin(9, 'Notificări și limite');
  await chk('declanșatorul push_friend există pe friendships; o cerere de prietenie nu pică din cauza notificării', async () => {
    eq((await q("select count(*)::int n from pg_trigger where tgname='push_friend' and not tgisinternal")).rows[0].n, 1);
    await as('stranger', 'insert into friendships(requester,addressee) values($1,$2)', [U.stranger, U.cris]);
    eq((await q('select status from friendships where requester=$1 and addressee=$2', [U.stranger, U.cris])).rows[0].status, 'pending');
  });
  nota('rândurile din public.notifications sunt scrise doar de funcția Edge „trimite-notificare” (cheia de serviciu): într-o bază locală cererea de prietenie NU produce un rând în clopoțel; am testat doar citirea/marcarea (rândurile sunt puse din owner, ca funcția Edge)');
  lipseste('creare notificare în clopoțel din trigger-ul push_friend: se face prin HTTP către funcția Edge, nu în SQL; nu poate fi verificată într-o bază locală');
  await chk('clopoțelul: fiecare vede doar ale lui; notifications_seen marchează doar linkul deschis; notifications_read le marchează pe toate; nimeni nu scrie', async () => {
    await q("insert into notifications(user_id,kind,ref,title,body,url) values($1,'friend',$2,'Cerere','x','/prieteni'),($1,'vote',$2,'Vot','y','/vot/x'),($2,'friend_ok',$1,'Alta','z','/prieteni')", [U.cris, U.stranger]);
    eq((await as('cris', 'select count(*)::int n from notifications')).rows[0].n, 2);
    eq((await as('stranger', 'select count(*)::int n from notifications')).rows[0].n, 1);
    await rpc('cris', "notifications_seen('/vot/x')");
    eq((await q('select url from notifications where user_id=$1 and read_at is null', [U.cris])).rows.map((r: any) => r.url), ['/prieteni']);
    await rpc('stranger', "notifications_seen('/prieteni')");
    eq((await q('select count(*)::int n from notifications where user_id=$1 and read_at is null', [U.cris])).rows[0].n, 1);
    await rpc('cris', 'notifications_read()');
    eq((await q('select count(*)::int n from notifications where user_id=$1 and read_at is null', [U.cris])).rows[0].n, 0);
    await denied(as('cris', "insert into notifications(user_id,kind,ref,title,body,url) values($1,'friend',$1,'x','x','/')", [U.cris]), /permission denied/);
    await denied(as('cris', 'update notifications set user_id=$1', [U.ana]), /permission denied/);
    await denied(anon('select * from notifications'), /permission denied/);
    await expect(q("insert into notifications(user_id,kind,ref,title,body,url) values($1,'friend',$1,'x','x','https://evil.com')", [U.cris])).rejects.toThrow(/check/);
  });
  await chk('prieteni: a 31-a cerere în așteptare / a 41-a pe zi e refuzată', async () => {
    for (let i = 0; i < 32; i++) {
      const id = '00000000-0000-0000-0000-' + (0xA000 + i).toString(16).padStart(12, '0');
      await q('insert into auth.users(id) values($1)', [id]);
      await q('insert into profiles(id,username,first_name) values($1,$2,$3)', [id, 'lim' + i, 'Lim']);
      await q("insert into profile_private(id,birth_date) values($1,'1990-01-01')", [id]);
    }
    let ok = 0, err = '';
    for (let i = 0; i < 32; i++) {
      const id = '00000000-0000-0000-0000-' + (0xA000 + i).toString(16).padStart(12, '0');
      try { await as('kid17', 'insert into friendships(requester,addressee) values($1,$2)', [U.kid17, id]); ok++; } catch (e: any) { err = e.message; break; }
    }
    expect(ok).toBeGreaterThan(20); expect(ok).toBeLessThanOrEqual(31);
    expect(err).toMatch(/destule cereri/);
  });
  await chk('semnalări: a 21-a pe zi e refuzată (reports + support_reports)', async () => {
    let ok = 0, err = '';
    for (let i = 0; i < 25; i++) {
      try { await as('dan', "insert into reports(venue_id,kind,note) values('nou','altceva','x')"); ok++; } catch (e: any) { err = e.message; break; }
    }
    eq(ok, 20); expect(err).toMatch(/destule semnalări/);
  });
  await chk('voturi: a 31-a pornire de vot pe zi e refuzată', async () => {
    for (let i = 0; i < 30; i++) await q("insert into vote_sessions(created_by,title,closes_at,created_at) values($1,'t',now()+interval '1 hour',now())", [U.dan]);
    const opts = JSON.stringify([{ venue_id: VEN.A, venue_name: 'A', details: {} }, { venue_id: VEN.B, venue_name: 'B', details: {} }]);
    await denied(rpc('dan', "start_vote(null,null,$1::jsonb,now()+interval '1 hour')", [opts]), /destule voturi/);
  });
  await chk('gășci: a 11-a gașcă pe zi a aceluiași admin e refuzată', async () => {
    let n = 0, err = '';
    for (let i = 0; i < 12; i++) {
      try { await rpc('ana', "create_crew($1,'pizza','#FF6A4D',array[$2,$3]::uuid[])", ['Gașca ' + i, U.bob, U.cris]); n++; } catch (e: any) { err = e.message; break; }
    }
    expect(n).toBeGreaterThanOrEqual(8); expect(n).toBeLessThanOrEqual(10);
    expect(err).toMatch(/destule gășci/);
  });
  await chk('planuri: al 31-lea plan nou pe zi e refuzat', async () => {
    for (let i = 0; i < 30; i++) await q("insert into plans(owner_id,venue_id,venue_name,starts_at,client_key) values($1,$2,'Bistro Alfa',now()+interval '1 day',$3)", [U.eva, VEN.A, 'lim-' + i]);
    await denied(rpc('eva', "plan_share_v2('lim-nou',$1,now()+interval '2 hours',1)", [VEN.A]), /destule planuri/);
  });
  endStage();
}, 180000);

// =====================================================================================================
it('10. Securitate: rândurile nu se mută, nu se citește ce nu e al tău, RLS peste tot, anon nu rulează nimic', async () => {
  begin(10, 'Securitate');
  await chk('nu poți muta un rând pe alt om / altă gașcă / alt plan / alt vot (freeze_keys): modificarea e refuzată sau nu atinge niciun rând, iar datele rămân neschimbate', async () => {
    const other = (await q('select id from crews where id<>$1 limit 1', [crewId])).rows[0].id;
    const tables: [string, string][] = [
      ['friendships', 'select * from friendships order by requester,addressee'],
      ['crew_members', 'select * from crew_members where crew_id<>$1 order by crew_id,user_id'],
      ['plan_members', 'select * from plan_members order by plan_id,user_id'],
      ['ballots', 'select * from ballots order by session_id,option_id,user_id'],
      ['plans', 'select id,owner_id,venue_id,created_at from plans order by id'],
      ['crews', 'select id,admin_id,invite_token from crews where id<>$1 order by id'],
    ];
    const run = async (s: string) => snap(s, s.includes('$1') ? [other] : []);
    const before = Object.fromEntries(await Promise.all(tables.map(async ([n, s]) => [n, await run(s)])));
    await blocked(as('ana', 'update friendships set addressee=$1 where requester=$2 and addressee=$3', [U.kid17, U.ana, U.bob]));
    await blocked(as('bob', 'update friendships set requester=$1 where requester=$2 and addressee=$3', [U.dan, U.ana, U.bob]));
    await blocked(as('bob', 'update crew_members set crew_id=$1 where crew_id=$2 and user_id=$3', [other, crewId, U.bob]));
    await blocked(as('bob', 'update crew_members set user_id=$1 where crew_id=$2 and user_id=$3', [U.stranger, crewId, U.bob]));
    await blocked(as('bob', 'update plan_members set user_id=$1 where plan_id=$2 and user_id=$3', [U.stranger, crewPlan, U.bob]));
    await blocked(as('ana', 'update plans set owner_id=$1 where id=$2', [U.bob, crewPlan]));
    await blocked(as('bob', 'update ballots set user_id=$1 where session_id=$2 and user_id=$3', [U.cris, voteId, U.bob]));
    await blocked(as('bob', 'update crews set admin_id=$1 where id=$2', [U.stranger, crewId]));
    await blocked(as('bob', 'update crews set invite_token=$1 where id=$2', ['hack-token-1234567890', crewId]));
    await blocked(as('bob', 'insert into crew_members(crew_id,user_id,invited_by) values($1,$2,$3)', [crewId, U.stranger, U.bob]));
    await blocked(as('stranger', 'insert into plan_members(plan_id,user_id) values($1,$2)', [crewPlan, U.stranger]));
    const after = Object.fromEntries(await Promise.all(tables.map(async ([n, s]) => [n, await run(s)])));
    for (const [n] of tables) expect(after[n], `${n} s-a schimbat`).toBe(before[n]);
    eq((await q('select count(*)::int n from crew_members where crew_id=$1 and user_id=$2', [crewId, U.stranger])).rows[0].n, 0);
  });
  await chk('nu citești profile_private / push_tokens / friendships / crew_members ale altora', async () => {
    eq((await as('ana', 'select count(*)::int n from profile_private where id<>$1', [U.ana])).rows[0].n, 0);
    eq((await as('ana', 'select count(*)::int n from push_tokens where user_id<>$1', [U.ana])).rows[0].n, 0);
    eq((await as('stranger', 'select count(*)::int n from friendships where requester<>$1 and addressee<>$1', [U.stranger])).rows[0].n, 0);
    eq((await as('stranger', 'select count(*)::int n from crew_members')).rows[0].n, 0);
  });
  await chk('XP, ștampile, Plus și nivelul nu se scriu din aplicație', async () => {
    const b = await snap('select id,xp,stamps from profiles order by id'), pb = await snap('select id,plus_until,plus_trial_started_at from profile_private order by id');
    await blocked(as('ana', "insert into xp_log(user_id,kind,amount) values($1,'carry',5000)", [U.ana]));
    await as('ana', 'update profiles set xp=999999,stamps=999 where id=$1', [U.ana]).catch(() => {});
    await as('ana', "update profile_private set plus_until=now()+interval '10 years' where id=$1", [U.ana]).catch(() => {});
    await as('ana', 'update profile_private set plus_trial_started_at=now() where id=$1', [U.ana]).catch(() => {});
    eq(await snap('select id,xp,stamps from profiles order by id'), b);
    eq(await snap('select id,plus_until,plus_trial_started_at from profile_private order by id'), pb);
  });
  await chk('codurile localurilor, biletele de grup, bonurile și datele firmei (CUI) nu se citesc de clienți sau de alt local', async () => {
    for (const tb of ['venue_codes', 'bills', 'private.group_tickets', 'private.visit_pricing', 'private.receipt_disputes', 'private.partner_requests', 'private.ticket_payouts']) {
      for (const w of ['ana', 'biz2'] as Who[]) {
        const r = await as(w, `select * from ${tb}`).then((x) => x.rows.length, (e) => (/permission denied/.test(e.message) ? 0 : Promise.reject(e)));
        if (r !== 0) throw new Error(`${w} citește ${tb} (${r} rânduri)`);
      }
    }
    await denied(as('ana', 'select firm from partners'), /permission denied/);
    await denied(as('biz2', 'select cui from partners'), /permission denied/);
    const cat = await rpc('ana', 'partner_catalog()');
    expect(cat.length).toBeGreaterThan(0); expect(cat[0].cui).toBeUndefined(); expect(cat[0].firm).toBeUndefined();
  });
  await chk('anon nu poate executa nicio funcție din public în afară de formularul de pre-lansare și catalogul public', async () => {
    const open = (await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in('f','p') and has_function_privilege('anon',p.oid,'execute') order by 1`)).rows.map((r: any) => r.proname);
    eq(open, ['launch_interest_submit', 'launch_interest_withdraw', 'partner_catalog']);
  });
  await chk('funcțiile de server (bon, import, quota, retenție, plată reală) NU sunt executabile de clienți autentificați', async () => {
    const names = ['visit_receipt_v3', 'visit_receipt_ready_v2', 'visit_receipt_staff_ready_v3', 'entry_of_v3', 'import_places', 'api_quota', 'ticket_order_paid', 'xp_bill', 'xp_bill_ready', 'weather_turn', 'push_hook_secret', 'google_key', 'business_proof_deleted', 'business_proofs_retention_candidates', 'support_photo_deleted', 'support_photos_retention_candidates'];
    const open = (await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1) and has_function_privilege('authenticated',p.oid,'execute')`, [names])).rows.map((r: any) => r.proname);
    expect(open).toEqual([]);
    const priv = (await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in('retention_daily','entry_json','visit_fees','price_visit') and has_function_privilege('authenticated',p.oid,'execute')`)).rows;
    expect(priv).toEqual([]);
  });
  await chk('RLS pornit pe FIECARE tabel din public și private', async () => {
    const t = (await q(`select n.nspname||'.'||c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind in('r','p') and not c.relrowsecurity order by 1`)).rows.map((r: any) => r.t);
    expect(t).toEqual([]);
  });
  const insertProbe: Record<string, string> = {
    'private.switches': "insert into private.switches(key,enabled) values('x-test',false)",
    'public.venue_google': "insert into public.venue_google(venue_id,place_id) values('x','y')",
    'public.place_day': "insert into public.place_day(venue_id,day) values('x',current_date)",
    'public.place_hours': "insert into public.place_hours(venue_id) values('x')",
  };
  for (const tb of Object.keys(insertProbe)) {
    await chk(`${tb}: nici anon, nici authenticated nu au vreun GRANT (select/insert/update/delete) și un client nu citește/șterge nimic`, async () => {
      const probs: string[] = [];
      for (const role of ['anon', 'authenticated']) {
        const g = (await q(`select has_table_privilege($1,$2,'select') s,has_table_privilege($1,$2,'insert') i,has_table_privilege($1,$2,'update') u,has_table_privilege($1,$2,'delete') d`, [role, tb])).rows[0];
        if (g.s || g.i || g.u || g.d) probs.push(`${role} are GRANT ${JSON.stringify(g)} (apărarea e doar RLS fără politici; lipsește REVOKE explicit, ca la place_day/place_hours)`);
      }
      const base = (await q(`select count(*)::int n from ${tb}`)).rows[0].n;
      await q(insertProbe[tb]);
      const rows = await as('ana', `select * from ${tb}`).then((x) => x.rows.length, () => 0);
      if (rows) probs.push(`un client citește ${rows} rânduri`);
      await blocked(as('ana', `delete from ${tb}`));
      const left = (await q(`select count(*)::int n from ${tb}`)).rows[0].n;
      if (left !== base + 1) probs.push(`clientul a șters rânduri (${left} rămase din ${base + 1})`);
      await q(`delete from ${tb} where ${tb === 'private.switches' ? "key='x-test'" : "venue_id='x'"}`);
      if (probs.length) throw new Error(probs.join('; '));
    });
  }
  await chk('tabelele din schema private nu au drepturi pentru anon/authenticated', async () => {
    const bad = (await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'
      and (has_table_privilege('anon',c.oid,'select,insert,update,delete') or has_table_privilege('authenticated',c.oid,'select,insert,update,delete')) order by 1`)).rows.map((r: any) => r.relname);
    expect(bad).toEqual([]);
  });
  await chk('scriere directă interzisă pe tabelele cu bani, locuri, echipă, evenimente și bilete (insert/update/delete de client nu schimbă nimic)', async () => {
    const tbs = ['bills', 'visits', 'partners', 'partner_members', 'ticket_orders', 'tickets', 'ticket_types', 'events', 'staff', 'venues', 'notifications', 'xp_log', 'venue_codes', 'receipts', 'drops', 'reservations', 'drop_claims', 'venue_log'];
    const probs: string[] = [];
    for (const tb of tbs) {
      const cols = (await q("select attname from pg_attribute where attrelid=('public.'||$1)::regclass and attnum>0 and not attisdropped order by attnum", [tb])).rows.map((r: any) => r.attname);
      const hash = async () => (await q(`select count(*)::int n,coalesce(md5(string_agg(x::text,'|' order by x::text)),'') h from public.${tb} x`)).rows[0];
      const b = await hash();
      for (const who of ['ana', 'biz2'] as Who[]) for (const sql of [`delete from public.${tb}`, `update public.${tb} set ${cols[0]}=${cols[0]}`]) { try { await as(who, sql); } catch { /* refuzat: bine */ } }
      const a = await hash();
      if (a.n !== b.n || a.h !== b.h) probs.push(`${tb}: s-a schimbat (${b.n} → ${a.n})`);
    }
    await blocked(as('ana', "insert into staff(user_id,role) values($1,'fondator')", [U.ana]));
    await blocked(as('ana', "insert into partner_members(venue_id,user_id,role) values($1,$2,'proprietar')", [VEN.B, U.ana]));
    await blocked(as('biz2', "update partners set status='iesit',founder=true where venue_id=$1", [VEN.B]));
    await blocked(as('biz', 'update visits set bill=1 where venue_id=$1', [VEN.A]));
    await blocked(as('ana', 'update visits set bill=1,discount_amount=0 where user_id=$1', [U.ana]));
    await blocked(as('ana', "update venues set name='hack' where id=$1", [VEN.A]));
    await blocked(as('ana', "update events set ticket_url='https://evil.com/x' where true"));
    expect(probs).toEqual([]);
    eq((await q('select count(*)::int n from staff where user_id=$1', [U.ana])).rows[0].n, 0);
  });
  nota('programul de la Google: public.place_hours (migrarea 20261031020000_cefaci_program_30_zile.sql, numele spune „30 zile”) e păstrat de funcția e-deschis 3 zile (keptSince = 3 × 24 h), pe lângă public.place_day (doar ziua curentă). CLAUDE.md din sesiune spune că suportul Google a confirmat păstrarea DOAR pentru ziua curentă și că „programul NU se păstrează mai mult de o zi”; schema/ funcția nu se pot verifica din SQL aici, dar cele două reguli se contrazic');
  endStage();
}, 180000);

// =====================================================================================================
it('11. Confidențialitate: „Datele mele”, cereri către Admin, ștergerea contului, retenția', async () => {
  begin(11, 'Confidențialitate și ștergere');
  await chk('„Datele mele” (privacy_export_my_data): doar datele omului; fără token de notificări, fără alți utilizatori', async () => {
    await q("insert into push_tokens(user_id,token) values($1,'secret-token-ana') on conflict do nothing", [U.ana]).catch(() => {});
    const d = await rpc('ana', 'privacy_export_my_data()');
    eq(d.format, 'cefaci-personal-core-v1'); eq(d.user_id, U.ana); eq(d.profile.username, 'ana');
    const json = JSON.stringify(d);
    expect(json).not.toContain('secret-token-ana');
    expect(json).not.toContain(U.stranger);
    expect(d.bills).toBeDefined(); expect(d.tickets).toBeDefined(); expect(d.ticket_orders).toBeDefined(); expect(d.notifications).toBeDefined();
    expect(d.coverage).toContain('100');
  });
  await chk('„Datele mele” include și intrările (visits) la localuri ale omului, nu doar bonurile', async () => {
    const d = await rpc('ana', 'privacy_export_my_data()');
    if (d.visits === undefined) throw new Error('privacy_export_my_data nu are cheia „visits”: intrările lui ana (local, oră, masă, total, reducere) nu sunt în copie, deși bonurile (bills) sunt');
  });
  let reqId = '';
  await chk('cerere GDPR către Admin: ana trimite (idempotent pe cheie); Admin/fondatorul o văd, suport/editor nu; răspuns cu versiune', async () => {
    const key = crypto.randomUUID();
    const r = await rpc('ana', 'privacy_request_submit($1,$2,$3,$4)', ['client', 'access', 'Doresc acces la datele mele personale.', key]);
    eq(r.status, 'new'); reqId = r.id;
    eq((await rpc('ana', 'privacy_request_submit($1,$2,$3,$4)', ['client', 'access', 'Doresc acces la datele mele personale.', key])).id, reqId);
    await denied(rpc('ana', 'privacy_request_submit($1,$2,$3,$4)', ['client', 'erasure', 'Alt text pentru aceeași cheie.', key]), /cheie/);
    expect((await rpc('admin', 'admin_privacy_requests()')).some((x: any) => x.id === reqId)).toBe(true);
    for (const w of ['suport', 'editor', 'moderator', 'contabil', 'bob'] as Who[]) await denied(rpc(w, 'admin_privacy_requests()'), PERM);
    const inw = await rpc('admin', "admin_privacy_request_respond($1,1,'in_progress','Verificăm datele și temeiurile aplicabile.')", [reqId]);
    eq(inw.version, 2);
    await denied(rpc('founder', "admin_privacy_request_respond($1,1,'answered','Un răspuns trimis cu versiunea veche.')", [reqId]), /s-a schimbat/);
    const fin = await rpc('founder', "admin_privacy_request_respond($1,2,'answered','Acesta este răspunsul nostru înregistrat, nu o comandă automată.')", [reqId]);
    eq(fin.status, 'answered');
    await denied(rpc('admin', "admin_privacy_request_respond($1,3,'refused','Un refuz după răspunsul final transmis.')", [reqId]), /deja/);
    eq((await rpc('ana', 'privacy_my_requests(null)'))[0].response, fin.response);
    eq((await rpc('admin', 'admin_privacy_request_detail($1)', [reqId])).history.length, 3);
  });
  await chk('ștergerea contului e refuzată pentru echipă / proprietari de local / cine a organizat intrări (visits): trebuie cerere către Admin', async () => {
    for (const w of ['founder', 'admin', 'biz', 'waiter'] as Who[]) await denied(rpc(w, 'delete_my_account()'), /verificare/);
    await denied(rpc('ana', 'delete_my_account()'), /verificare/);
  });
  nota('delete_my_account refuză orice om care a fost vreodată pe `visits` (organizator de intrare) sau în partner_members (chiar „scos”, active=false): un client obișnuit care a mers măcar o dată la un local partener nu-și poate șterge contul din aplicație, doar printr-o cerere către Admin, și nu există RPC care să execute ștergerea după cerere (Admin doar răspunde); confirmați dacă e intenționat');
  lipseste('executarea ștergerii contului după o cerere de ștergere aprobată (privacy request kind=erasure): admin_privacy_request_respond doar scrie răspunsul, nu există RPC/flux care să șteargă sau să anonimizeze contul cu vizite/bonuri');
  let evGone = '', tyGone = '';
  await chk('ștergerea contului cu bilet valabil sau rambursare în curs e refuzată; cu bilet folosit/rambursat e permisă', async () => {
    evGone = (await q("insert into events(title,kind,starts_at,venue_id,place_name,lat,lon,status,sale_mode) values('Concert viitor','concert',now()+interval '3 days',$1,'Club Gama',44.45,26.12,'published','cefaci') returning id", [VEN.C])).rows[0].id;
    tyGone = (await q("insert into ticket_types(event_id,name,price,qty) values($1,'Intrare',50,100) returning id", [evGone])).rows[0].id;
    const mk = async (ts: string, os: string) => {
      const o = (await q("insert into ticket_orders(event_id,venue_id,user_id,status,tickets,subtotal,fee,total,commission,test,expires_at) values($1,$2,$3,$4,1,50,2,52,4,false,now()+interval '15 minutes') returning id", [evGone, VEN.C, U.gone, os])).rows[0].id;
      await q('insert into tickets(order_id,event_id,type_id,holder,status,test) values($1,$2,$3,$4,$5,false)', [o, evGone, tyGone, U.gone, ts]);
    };
    await mk('valid', 'platit');
    await denied(rpc('gone', 'delete_my_account()'), /Ai bilete valabile sau o rambursare/);
    await q("update tickets set status='folosit' where holder=$1", [U.gone]);
    await mk('rambursat', 'de_rambursat');
    await denied(rpc('gone', 'delete_my_account()'), /Ai bilete valabile sau o rambursare/);
    await q("update ticket_orders set status='rambursat' where user_id=$1 and status='de_rambursat'", [U.gone]);
  });
  await chk('contul „gone” ia proba pe telefonul 3 și își șterge contul: sesiunile, profilul dispar, comenzile plătite rămân fără cont, telefonul rămâne însemnat fără cont', async () => {
    await rpc('gone', 'start_plus_trial($1)', [DEV3]);
    await rpc('gone', 'delete_my_account()');
    eq((await q('select count(*)::int n from auth.users where id=$1', [U.gone])).rows[0].n, 0);
    eq((await q('select count(*)::int n from profiles where id=$1', [U.gone])).rows[0].n, 0);
    eq((await q('select count(*)::int n from auth.sessions where user_id=$1', [U.gone])).rows[0].n, 0);
    eq((await q('select count(*)::int n,count(user_id)::int who from ticket_orders where event_id=$1', [evGone])).rows[0], { n: 2, who: 0 });
    const dev = (await q('select user_id from private.trial_devices')).rows;
    expect(dev.length).toBeGreaterThanOrEqual(1);
    eq(dev.filter((d: any) => d.user_id === U.gone).length, 0);
  });
  await chk('un cont NOU pe telefonul cu cont șters: cu comutatorul PORNIT e refuzat (telefonul a rămas în private.trial_devices); cu el oprit e permis', async () => {
    const nid = '00000000-0000-0000-0000-00000000f0f0';
    await q('insert into auth.users(id) values($1)', [nid]);
    await seedAuthFixture(db, nid);
    (U as any).late = nid;
    await as('late' as Who, "select complete_signup('late','Late','1990-01-01')", [], false);
    await q("update private.switches set enabled=true where key='proba_pe_telefon'");
    try { await denied(rpc('late' as Who, 'start_plus_trial($1)', [DEV3], false), /folosit deja/); }
    finally { await q("update private.switches set enabled=false where key='proba_pe_telefon'"); }
    expect(await rpc('late' as Who, 'start_plus_trial($1)', [DEV3], false)).toBeTruthy();
  });
  await chk('retenția zilnică: notificări > 180 zile, clickuri pe bilete > 13 luni, FreeNow > 30 zile se șterg; restul rămâne; clienții și echipa nu o pot rula', async () => {
    const add = (days: number) => q("insert into notifications(user_id,kind,ref,title,body,url,created_at) values($1,'friend',gen_random_uuid(),'t','b','/prieteni',now()-make_interval(days=>$2))", [U.bob, days]);
    const before = (await q('select count(*)::int n from notifications where user_id=$1', [U.bob])).rows[0].n;
    await add(10); await add(179); await add(181); await add(400);
    await q('insert into private.event_clicks(event_id,user_id,day) values($1,$2,current_date-10),($1,$2,current_date-394),($1,$2,current_date-400)', [linkEvent, U.bob]);
    await q('insert into private.free_starts(user_id,day,n) values($1,current_date-1,1),($1,current_date-29,1),($1,current_date-31,1),($1,current_date-40,1)', [U.bob]);
    const r = (await q('select private.retention_daily() r')).rows[0].r;
    eq([r.notifications, r.event_clicks, r.free_starts], [2, 1, 2]);
    eq((await q('select count(*)::int n from notifications where user_id=$1', [U.bob])).rows[0].n, before + 2);
    await denied(as('bob', 'select private.retention_daily()'), /permission denied/);
    await denied(rpc('founder', 'private.retention_daily()'), /permission denied|nu există|does not exist/);
  });
  lipseste('programarea automată a private.retention_daily(): nu există pg_cron / job în migrări (CLAUDE.md: „de rulat din SQL Editor”), deci termenele din politică (180 zile, 13 luni, 30 zile) nu se aplică singure');
  endStage();
}, 180000);

// =====================================================================================================
// Etapa 12: încărcare. 300 de intrări cu bonuri aleatoare pe 5 localuri și 30 de zile; banii trebuie să iasă din funcțiile reale.
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const isoAdd = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const feeCents = (c: number) => Math.floor((c + 5) / 10);          // 10% rotunjit la ban în sus (jumătățile în sus, ca numeric(…,2) din Postgres)

it('12. Încărcare: 300 de intrări, 5 localuri, 30 de zile; totalurile lunare = 10% din bonurile necontestate, fondatorii în luna gratis exclusi', async () => {
  begin(12, 'Încărcare (300 de intrări)');
  const WDL = (await q('select private.work_day(now())::text d')).rows[0].d as string;
  type Spec = { id: string; founder: boolean; act: number; free: number; from: number; to: number; n: number };
  const specs: Spec[] = [
    { id: 'load-1', founder: true, act: -10, free: +20, from: 0, to: 10, n: 40 },   // fondator în luna gratis: toate intrările gratuite
    { id: 'load-2', founder: true, act: -60, free: -30, from: 0, to: 29, n: 60 },   // fondator, luna gratis a trecut: plătește
    { id: 'load-3', founder: false, act: -40, free: -40, from: 0, to: 29, n: 60 },  // ne-fondator: plătește din prima zi
    { id: 'load-4', founder: true, act: -45, free: -15, from: 0, to: 29, n: 60 },   // luna gratis se termină în mijlocul ferestrei (granița)
    { id: 'load-5', founder: false, act: -100, free: -100, from: 0, to: 29, n: 80 }, // volum mare
  ];
  const rnd = mulberry32(31102026);
  const users = [U.ana, U.bob, U.cris, U.dan, U.kid17, U.plusb];
  type Bill = { c: number; state: string | null };
  type Ent = { venue: string; day: string; bills: Bill[]; free: boolean; id?: string };
  const ents: Ent[] = [];
  await chk('pregătire: 5 localuri partenere cu feluri diferite de lună gratis', async () => {
    for (const s of specs) {
      await q("insert into venues(id,name,cat,lat,lon,data) values($1,$2,'mancare',44.4,26.1,'{}')", [s.id, 'Încărcare ' + s.id]);
      await q('insert into partners(venue_id,firm,cui,founder,rate,status,activated_at,free_until) values($1,$2,$3,$4,$5,\'activ\',$6::date,$7::date)',
        [s.id, 'Load SRL ' + s.id, CUI.A, s.founder, s.founder ? 0.08 : 0.10, isoAdd(WDL, s.act), isoAdd(WDL, s.free)]);
    }
  });
  await chk('generare: 300 de intrări (inclusiv granița lunii gratis la load-4) cu 0-3 bonuri, unele contestate (pending / upheld / dismissed)', async () => {
    for (const s of specs) {
      for (let i = 0; i < s.n; i++) {
        const off = s.from + Math.floor(rnd() * (s.to - s.from + 1));
        const nb = off <= 1 ? 1 + Math.floor(rnd() * 3) : (() => { const x = rnd(); return x < 0.1 ? 0 : x < 0.6 ? 1 : x < 0.9 ? 2 : 3; })();
        const bills: Bill[] = Array.from({ length: nb }, () => {
          const x = rnd();
          return { c: 500 + Math.floor(rnd() * 89500), state: x < 0.85 ? null : x < 0.9 ? 'pending' : x < 0.95 ? 'upheld' : 'dismissed' };
        });
        const day = isoAdd(WDL, -off);
        ents.push({ venue: s.id, day, bills, free: day < isoAdd(WDL, s.free) });
      }
    }
    // granița lunii gratis a localului load-4 (free_until = WD-15): ziua WD-16 e gratuită, WD-15 și WD-14 se plătesc
    for (const o of [16, 15, 14]) ents.push({ venue: 'load-4', day: isoAdd(WDL, -o), bills: [{ c: 12345, state: null }], free: isoAdd(WDL, -o) < isoAdd(WDL, -15) });
    eq(ents.length, 303);
    let k = 0;
    for (const e of ents) {
      const v = (await q(`insert into visits(venue_id,user_id,kind,people,group_visit,work_day,scanned_at,outcome,closed_at,proof)
        values($1,$2,'plan',3,true,$3::date,(($3::date)::timestamp + time '20:00') at time zone 'Europe/Bucharest','a venit',now(),'client_location') returning id`, [e.venue, users[k++ % users.length], e.day])).rows[0].id;
      e.id = v;
      let j = 0;
      for (const b of e.bills) {
        const bid = (await q(`insert into bills(visit_id,venue_id,user_id,total,issued_at,number,by_role)
          values($1,$2,$3,$4,(($5::date)::timestamp + time '21:00') at time zone 'Europe/Bucharest',$6,'client') returning id`, [e.id, e.venue, users[0], (b.c / 100).toFixed(2), e.day, String(1000 + (j++))])).rows[0].id;
        if (b.state) await q('insert into private.receipt_disputes(receipt_id,reason,by_user,state) values($1,$2,$3,$4)', [bid, 'contestat în simulare', U.biz, b.state]);
      }
    }
    eq((await q("select count(*)::int n from visits where venue_id like 'load-%'")).rows[0].n, 303);
  });
  const counted = (e: Ent) => e.bills.filter((b) => b.state === null || b.state === 'dismissed').reduce((a, b) => a + b.c, 0);
  const agg = (venue: string) => {
    const es = ents.filter((e) => e.venue === venue);
    const lines = es.filter((e) => counted(e) > 0);
    const rev = lines.reduce((a, e) => a + counted(e), 0);
    const charged = lines.filter((e) => !e.free).reduce((a, e) => a + feeCents(counted(e)), 0);
    const would = lines.filter((e) => e.free).reduce((a, e) => a + feeCents(counted(e)), 0);
    const pend = es.reduce((a, e) => a + e.bills.filter((b) => b.state === 'pending').length, 0);
    return { lines: lines.length, rev, charged, would, pend, naive: Math.round(rev * 0.1), entries: es.length };
  };
  const from = isoAdd(WDL, -29);
  let t0 = Date.now();
  for (const s of specs) {
    await chk(`${s.id} (${s.founder ? 'fondator' : 'ne-fondator'}, lună gratis ${s.free > 0 ? 'în curs' : s.free === s.act ? 'niciuna' : 'terminată'}): venit, de plătit, „ai fi plătit”, linii, contestații = calculul independent, la ban`, async () => {
      const x = agg(s.id);
      const f = await rpc('contabil', 'biz_finance_v2($1,$2::date,$3::date)', [s.id, from, WDL]);
      const got = { rev: money(f.revenue), charged: money(f.fee), would: money(f.would_pay), lines: f.lines.length, blocked: f.blocked, visits: f.visits };
      eq(got, { rev: x.rev, charged: x.charged, would: x.would, lines: x.lines, blocked: x.pend, visits: x.entries });
      eq(money(f.lines.reduce((a: number, l: any) => a + l.fee, 0)), x.charged);
      eq(money(f.lines.reduce((a: number, l: any) => a + l.would_pay, 0)), x.would);
      eq(f.partial, x.pend > 0); eq(f.billing_ready, false);
      if (x.pend === 0) eq(money(f.remaining), x.rev - x.charged); else eq(f.remaining, null);
      // fiecare linie: fee = 10% din bonurile intrării, rotunjit la ban
      for (const l of f.lines) {
        const e = ents.find((z) => z.id === l.visit)!;
        eq(money(l.bill), counted(e));
        eq(money(l.free ? l.would_pay : l.fee), feeCents(counted(e)));
        eq(l.free, e.free);
      }
    });
  }
  await chk('niciun fondator în luna gratis nu plătește nimic (load-1: fee 0, would_pay > 0); granița: ziua cu work_day = free_until se plătește', async () => {
    const f1 = await rpc('contabil', 'biz_finance_v2($1,$2::date,$3::date)', ['load-1', from, WDL]);
    eq(money(f1.fee), 0); expect(money(f1.would_pay)).toBeGreaterThan(0);
    const f4 = await rpc('contabil', 'biz_finance_v2($1,$2::date,$3::date)', ['load-4', isoAdd(WDL, -16), isoAdd(WDL, -14)]);
    const byDay = Object.fromEntries(f4.lines.filter((l: any) => [12345].includes(money(l.bill))).map((l: any) => [String(l.day).slice(0, 10), l.free]));
    eq(byDay[isoAdd(WDL, -16)], true); eq(byDay[isoAdd(WDL, -15)], false); eq(byDay[isoAdd(WDL, -14)], false);
  });
  await chk('admin_finance (contabil) pe toate localurile = suma biz_finance_v2 pe fiecare local, exact; durata e rezonabilă', async () => {
    const venues = (await q('select venue_id from partners')).rows.map((r: any) => r.venue_id as string);
    t0 = Date.now();
    const af = await rpc('contabil', 'admin_finance($1::date,$2::date)', [from, WDL]);
    const ms = Date.now() - t0;
    let rev = 0, fee = 0, would = 0, blocked = 0, visits = 0;
    for (const v of venues) {
      const f = await rpc('contabil', 'biz_finance_v2($1,$2::date,$3::date)', [v, from, WDL]);
      rev += money(f.revenue); fee += money(f.fee); would += money(f.would_pay); blocked += f.blocked; visits += Number(f.visits);
    }
    eq([money(af.revenue), money(af.fee), money(af.would_pay), af.blocked], [rev, fee, would, blocked]);
    expect(ms, 'admin_finance pe 30 de zile a durat ' + ms + ' ms').toBeLessThan(15000);
    nota(`admin_finance pe 30 de zile și ${venues.length} localuri, ~${visits} intrări: ${ms} ms (PGlite, într-un singur proces)`);
  });
  await chk('rotunjire: suma pe intrări (10% rotunjit pe fiecare intrare) vs 10% din suma lunii; diferența max pe local e notată', async () => {
    let worst = 0; const rows: string[] = [];
    for (const s of specs) {
      const x = agg(s.id); const total = x.charged + x.would;
      const naive = Math.round(((x.rev) * 0.1)); const d = total - naive;
      worst = Math.max(worst, Math.abs(d)); rows.push(`${s.id}: ${d} bani`);
    }
    nota('diferența dintre suma comisioanelor rotunjite pe intrare și 10% din totalul lunii (în bani): ' + rows.join(', ') + `; maxim ${worst} bani. Regula „10% din bonurile fiecărei intrări” rotunjește pe intrare, nu pe lună; contractul/factura trebuie să spună asta`);
    expect(worst).toBeLessThanOrEqual(150);   // 303 de intrări × max 0,5 ban
  });
  await chk('lunile se pot cere pe intervale mai mici (o zi, o săptămână) și se adună la total', async () => {
    const venue = 'load-5'; let sumFee = 0, sumRev = 0;
    for (let w = 0; w < 6; w++) {
      const a = isoAdd(WDL, -29 + w * 5), b = isoAdd(WDL, -29 + w * 5 + 4);
      const f = await rpc('contabil', 'biz_finance_v2($1,$2::date,$3::date)', [venue, a, b]);
      sumFee += money(f.fee); sumRev += money(f.revenue);
    }
    const all = await rpc('contabil', 'biz_finance_v2($1,$2::date,$3::date)', [venue, from, WDL]);
    eq([sumFee, sumRev], [money(all.fee), money(all.revenue)]);
  });
  await chk('biz_month (luna calendaristică) = biz_finance_v2 pe aceeași lună, pentru proprietarul unui local din încărcare', async () => {
    await q("insert into partner_members(venue_id,user_id,role) values('load-3',$1,'proprietar')", [U.biz3]);
    const m = await rpc('biz3', "biz_month('load-3')");
    const m0 = (await q("select date_trunc('month',(now() at time zone 'Europe/Bucharest')::date)::date::text d")).rows[0].d;
    const f = await rpc('contabil', "biz_finance_v2('load-3',$1::date,($1::date+interval '1 month'-interval '1 day')::date)", [m0]);
    eq([money(m.fee), money(m.revenue)], [money(f.fee), money(f.revenue)]);
  });

  // ---- bonuri rele / limite pe o intrare nouă ----
  let vx = '';
  await chk('bonuri invalide: total 0 / negativ / ≥ 100000, reducere negativă, fără oră, din viitor — toate refuzate', async () => {
    const p = await mkPlan('dan', 'e-limits', VEN.B);
    vx = (await arriveAt('dan', p, 'B')).id;
    const loc = (await q("select (scanned_at at time zone 'Europe/Bucharest')::date d,(scanned_at at time zone 'Europe/Bucharest')::time t from visits where id=$1", [vx])).rows[0];
    const call = (total: number, disc: number, d: any, t: any, nr: string | null) => svc('select visit_receipt_v3($1,$2,$3,$4,$5,$6,$7,$8,false) r', [U.dan, vx, CUI.B, total, disc, d, t, nr]);
    for (const [tot, disc] of [[0, 0], [-5, 0], [100000, 0], [50, -1]]) await expect(call(tot as number, disc as number, loc.d, loc.t, '777'), `total ${tot} reducere ${disc}`).rejects.toThrow(/totalul|data și ora/);
    await expect(call(50, 0, loc.d, null, '777')).rejects.toThrow(/totalul|data și ora/);
    await expect(svc('select visit_receipt_v3($1,$2,$3,50,0,$4,$5,$6,false)', [U.dan, vx, CUI.B, loc.d, new Date(Date.now() + 3600e3).toLocaleTimeString('en-GB', { timeZone: 'Europe/Bucharest' }), '777'])).rejects.toThrow(/seara asta/);
  });
  await chk('maxim 20 de bonuri pe intrare: funcția „ready” (apelată de funcția Edge) refuză al 21-lea; biz_entry_total_v3 la fel', async () => {
    for (let i = 0; i < 20; i++) await bill(vx, 'dan', 10 + i, String(2000 + i));
    eq((await svc('select visit_receipt_ready_v2($1,$2) r', [U.dan, vx])).rows[0].r.ok, false);
    await denied(rpc('biz2', "biz_entry_total_v3($1,10,'prea multe')", [vx]), /prea multe bonuri/);
    const e = await entry(vx); eq(e.receipts.length, 20);
  });
  await chk('al 21-lea bon trimis direct la visit_receipt_v3 (fără trecerea prin „ready”) este refuzat și de funcția de scriere', async () => {
    await expect(bill(vx, 'dan', 99, '2999')).rejects.toThrow(/prea multe|20 de bonuri/);
  });
  // decis 31.10 (Claude): un bon fără număr, cu aceeași sumă în același minut la același local, se tratează ca același bon
  // (la dubiu nu facturăm de două ori); OCR-ul citește numărul la aproape toate bonurile
  await chk('același bon FĂRĂ număr (total + minut identice) la DOUĂ intrări ale aceluiași local se numără o singură dată', async () => {
    const p1 = await mkPlan('cris', 'e-nonr-1', VEN.B), p2 = await mkPlan('plusb', 'e-nonr-2', VEN.B);
    const v1 = (await arriveAt('cris', p1, 'B')).id, v2 = (await arriveAt('plusb', p2, 'B')).id;
    const a = (await q("select (scanned_at at time zone 'Europe/Bucharest')::date d,(scanned_at at time zone 'Europe/Bucharest')::time t from visits where id=$1", [v1])).rows[0];
    const mk = (u: Who, v: string) => svc('select visit_receipt_v3($1,$2,$3,50,0,$4,$5,null,false) r', [U[u], v, CUI.B, a.d, a.t]);
    await mk('cris', v1);
    await expect(mk('plusb', v2)).rejects.toThrow(/deja la altă intrare/);
  });
  nota('bonurile fără număr (OCR l-a ratat) se identifică prin firmă + dată + oră (minut) + total: două mese diferite, aceeași sumă rotundă, același minut → al doilea bon e respins ca „deja la altă intrare” (protecție împotriva dublării, dar și fals pozitiv)');

  await chk('același număr de bon, aceeași zi, la două LOCURI ale aceleiași firme (același CUI) — bonul celui de-al doilea nu trebuie respins ca „deja la altă intrare”', async () => {
    await q("insert into venue_codes(venue_id,token) values('load-5','tok-load-5') on conflict do nothing");
    const p1 = await mkPlan('cris', 'e-chain-1', VEN.A), p2 = await mkPlan('plusb', 'e-chain-2', 'load-5');
    const v1 = (await arriveAt('cris', p1, 'A', false)).id;
    const v2 = (await rpc('plusb', 'to_jsonb(visit_client_arrive_v2($1,$2,null,null))', [p2, 'tok-load-5'])).id;
    eq((await q('select cui from private.visit_pricing where visit_id in($1,$2) group by cui', [v1, v2])).rows.length, 1);   // aceeași firmă
    await bill(v1, 'cris', 70, '4444');
    await bill(v2, 'plusb', 90, '4444', { cui: CUI.A });  // alt local al firmei, aceeași zi, același număr de bon
  });
  // ---- starea finală a banilor ----
  await chk('integritate finală: nicio intrare nu are fee negativ; suma fee-urilor din visit_fees = suma liniilor din biz_finance_v2 pe tot sistemul', async () => {
    const neg = (await q("select count(*)::int n from private.visit_fees('load-5',current_date-400,current_date+2) where fee<0 or bill<=0")).rows[0].n;
    eq(neg, 0);
    const direct = (await q(`select coalesce(sum(case when free then 0 else fee end),0) c,coalesce(sum(case when free then fee else 0 end),0) w from (
      select f.* from partners p cross join lateral private.visit_fees(p.venue_id,current_date-300,current_date+2) f) z`)).rows[0];
    const af = await rpc('contabil', 'admin_finance(current_date-300,current_date)');
    eq([money(af.fee), money(af.would_pay)], [money(direct.c), money(direct.w)]);
  });
  lipseste('facturarea: private.visit_fees/biz_finance_v2 sunt doar estimare (billing_ready = false mereu); nu există tabel de facturi, listă „pe 3 ale lunii”, e-Factura, perioadă de 5 zile lucrătoare pentru contestații, închiderea lunii (blocarea cifrelor) sau export pentru contabil (admin_finance doar citește live)');
  endStage();
}, 300000);
afterAll(() => {
  const ok = results.filter((r) => r.ok).length, bad = results.filter((r) => !r.ok);
  const lines = [`\n===== SIMULARE LANSARE: ${results.length} verificări, ${ok} trecute, ${bad.length} picate =====`];
  for (const s of Object.keys(stageNames).map(Number)) {
    const rs = results.filter((r) => r.stage === s);
    lines.push(`etapa ${s} (${stageNames[s]}): ${rs.filter((r) => r.ok).length}/${rs.length}`);
    for (const r of rs.filter((x) => !x.ok)) lines.push(`   PICAT: ${r.name}\n          ${r.detail}`);
  }
  if (missing.length) lines.push('LIPSEȘTE:', ...missing.map((m) => '   ' + m));
  if (notes.length) lines.push('AMBIGUITĂȚI:', ...notes.map((m) => '   ' + m));
  const out = lines.join('\n');
  console.log(out);
  if (process.env.SIM_OUT) fs.writeFileSync(process.env.SIM_OUT, out + '\n' + JSON.stringify(results, null, 1));
  db?.close();
});
