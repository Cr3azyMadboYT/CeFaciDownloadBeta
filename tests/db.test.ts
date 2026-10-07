// The Supabase schema (supabase/migrations) on a real Postgres (PGlite), with Supabase's auth stubbed:
// who can see and change what — friends, crews, plans, votes, minors, account deletion.
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
it('keeps every rule of the database', async () => {
  const db = new PGlite();
  const q = (s, p) => db.query(s, p);
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    -- like Supabase: everything new in public is granted to the API roles by name (RLS and revokes must hold anyway)
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(fs.readdirSync('supabase/migrations').sort().map((f) => fs.readFileSync('supabase/migrations/' + f, 'utf8')).join('\n'));
  await db.exec(`grant usage on schema public to anon, authenticated;`);
  const U = { ana: '00000000-0000-0000-0000-00000000000a', bob: '00000000-0000-0000-0000-00000000000b', cris: '00000000-0000-0000-0000-00000000000c', teen: '00000000-0000-0000-0000-00000000000d', eve: '00000000-0000-0000-0000-00000000000e' };
  for (const id of Object.values(U)) await q('insert into auth.users values ($1)', [id]);
  let ok = 0, bad = 0;
  const as = async (who, sql, params) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[who]}', false); set role authenticated;`);
    try { return await q(sql, params); } finally { await db.exec('reset role'); }
  };
  const expectOk = async (label, fn) => { try { const r = await fn(); ok++; return r; } catch (e) { bad++; console.log('FAIL (threw)', label, e.message); } };
  const expectFail = async (label, fn, re) => { try { await fn(); bad++; console.log('FAIL (allowed)', label); } catch (e) { if (re && !re.test(e.message)) { bad++; console.log('FAIL (wrong error)', label, e.message); } else ok++; } };
  const eq = (label, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { bad++; console.log('FAIL', label, JSON.stringify(a), '!=', JSON.stringify(b)); } };
  
  await expectOk('signup ana', () => as('ana', `select * from complete_signup('Ana.P', 'Ana', '2000-01-01')`));
  await expectOk('signup bob', () => as('bob', `select * from complete_signup('bob', 'Bob', '1999-05-05')`));
  await expectOk('signup cris', () => as('cris', `select * from complete_signup('cris', 'Cris', '1998-05-05')`));
  await expectOk('signup teen (17)', () => as('teen', `select * from complete_signup('teen', 'Teo', (current_date - interval '17 years')::date)`));
  await expectFail('under 16 refused', () => as('eve', `select * from complete_signup('eve', 'Eva', (current_date - interval '15 years')::date)`), /16 ani/);
  await expectFail('bad username', () => as('eve', `select * from complete_signup('E V!', 'Eva', '2000-01-01')`));
  await expectFail('taken username', () => as('eve', `select * from complete_signup('bob', 'Eva', '2000-01-01')`));
  eq('username stored lower', (await as('ana', `select username from profiles where id = $1`, [U.ana])).rows[0].username, 'ana.p');
  eq('available', (await as('ana', `select username_available('bob') a`)).rows[0].a, false);
  eq('dash allowed', (await as('ana', `select username_available('ana-maria_1.x') a`)).rows[0].a, true);
  eq('other signs refused', (await as('ana', `select username_available('ana+maria') a`)).rows[0].a, false);
  
  // privacy
  eq('cannot see strangers', (await as('ana', `select count(*)::int n from profiles`)).rows[0].n, 1);
  eq('cannot read others birth date', (await as('ana', `select count(*)::int n from profile_private`)).rows[0].n, 1);
  eq('find adult by exact username', (await as('ana', `select username from find_user('BOB')`)).rows.length, 1);
  eq('teen not searchable', (await as('ana', `select username from find_user('teen')`)).rows.length, 0);
  eq('no partial matches', (await as('ana', `select username from find_user('bo')`)).rows.length, 0);
  
  // friends
  await expectOk('ana asks bob', () => as('ana', `insert into friendships (requester, addressee) values ($1, $2)`, [U.ana, U.bob]));
  await expectFail('ana cannot accept for bob', () => as('ana', `update friendships set status = 'accepted' where addressee = $1 returning 1`, [U.bob]).then((r) => { if (!r.rows.length) throw new Error('no rows'); }));
  await expectFail('cannot ask on behalf of others', () => as('ana', `insert into friendships (requester, addressee) values ($1, $2)`, [U.cris, U.bob]));
  eq('bob sees ana pending', (await as('bob', `select count(*)::int n from profiles where id = $1`, [U.ana])).rows[0].n, 1);
  await expectOk('bob accepts', () => as('bob', `update friendships set status = 'accepted', accepted_at = now() where requester = $1`, [U.ana]));
  await expectFail('duplicate reverse request', () => as('bob', `insert into friendships (requester, addressee) values ($1, $2)`, [U.bob, U.ana]));
  const code = (await as('teen', `select friend_code from profiles where id = $1`, [U.teen])).rows[0].friend_code;
  await expectOk('ana adds teen by code', () => as('ana', `select add_friend_by_code($1)`, [code]));
  await expectOk('teen accepts', () => as('teen', `update friendships set status = 'accepted' where requester = $1`, [U.ana]));
  await expectOk('ana asks cris', () => as('ana', `insert into friendships (requester, addressee) values ($1, $2)`, [U.ana, U.cris]));
  await expectOk('cris accepts', () => as('cris', `update friendships set status = 'accepted' where requester = $1`, [U.ana]));
  eq('no mutual friends shown about a stranger', (await as('bob', `select username from mutual_friends($1)`, [U.teen])).rows.map((r) => r.username), []);
  eq('mutual friends with a friend', (await as('teen', `select username from mutual_friends($1)`, [U.ana])).rows.map((r) => r.username), []);
  
  // crews
  await expectFail('crew needs 2 friends', () => as('ana', `select create_crew('Gașca', 'pizza', '#FF6A4D', array[$1]::uuid[])`, [U.bob]), /cel puțin 2/);
  await expectFail('crew only with friends', () => as('bob', `select create_crew('X', 'star', '#FFD43B', array[$1, $2]::uuid[])`, [U.ana, U.cris]), /doar prieteni/);
  const crew = (await as('ana', `select create_crew('Gașca de vineri', 'pizza', '#FF6A4D', array[$1, $2]::uuid[]) id`, [U.bob, U.teen])).rows[0].id;
  eq('bob sees crew as invited', (await as('bob', `select status from crew_members where crew_id = $1 and user_id = $2`, [crew, U.bob])).rows[0].status, 'invited');
  await expectOk('bob accepts crew', () => as('bob', `update crew_members set status = 'member', joined_at = now() where crew_id = $1 and user_id = $2`, [crew, U.bob]));
  eq('cris (not in crew) sees nothing', (await as('cris', `select count(*)::int n from crews`)).rows[0].n, 0);
  eq('the crew has someone under 18 (teen invited)', (await as('bob', `select crew_has_minor($1) m`, [crew])).rows[0].m, true);
  eq('a stranger is not told', (await as('cris', `select crew_has_minor($1) m`, [crew])).rows[0].m, null);
  await expectFail('teen (invited) cannot invite', () => as('teen', `insert into crew_members (crew_id, user_id, invited_by) values ($1, $2, $3)`, [crew, U.cris, U.teen]));
  const tok = (await as('ana', `select invite_token from crews where id = $1`, [crew])).rows[0].invite_token;
  await expectOk('cris joins by link', () => as('cris', `select join_crew($1)`, [tok]));
  await expectFail('reset link only admin', () => as('bob', `select reset_crew_link($1)`, [crew]), /adminul/);
  await expectOk('admin ana leaves', () => as('ana', `delete from crew_members where crew_id = $1 and user_id = $2`, [crew, U.ana]));
  eq('admin passes to oldest member', (await as('bob', `select admin_id from crews where id = $1`, [crew])).rows[0].admin_id, U.bob);
  
  // plans
  const plan = (await as('ana', `insert into plans (owner_id, venue_id, venue_name, starts_at) values ($1, 'n1', 'Caru'' cu Bere', now() + interval '3 hours') returning id`, [U.ana])).rows[0].id;
  await expectOk('invite friend to plan', () => as('ana', `insert into plan_members (plan_id, user_id) values ($1, $2)`, [plan, U.bob]));
  await expectFail('cannot invite a stranger', () => as('bob', `insert into plan_members (plan_id, user_id) values ($1, $2)`, [plan, U.cris]));
  await expectOk('bob answers vin', () => as('bob', `update plan_members set answer = 'vin', answered_at = now() where plan_id = $1 and user_id = $2`, [plan, U.bob]));
  await expectFail('bob cannot answer for others', () => as('bob', `update plan_members set answer = 'nu_pot' where plan_id = $1 and user_id = $2 returning 1`, [plan, U.ana]).then((r) => { if (!r.rows.length) throw new Error('none'); }));
  eq('cris cannot see plan', (await as('cris', `select count(*)::int n from plans`)).rows[0].n, 0);
  
  // voting
  const opts = JSON.stringify([{ venue_id: 'n1', venue_name: 'A' }, { venue_id: 'n2', venue_name: 'B' }]);
  const vs = (await as('bob', `select start_vote($1, null, $2::jsonb, now() + interval '1 hour') id`, [crew, opts])).rows[0].id;
  const o = (await as('bob', `select id from vote_options where session_id = $1 order by position`, [vs])).rows.map((r) => r.id);
  await expectOk('bob super A', () => as('bob', `insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'super')`, [vs, o[0], U.bob]));
  await expectFail('second super refused', () => as('bob', `insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'super')`, [vs, o[1], U.bob]));
  await expectOk('cris da B', () => as('cris', `insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'da')`, [vs, o[1], U.cris]));
  await expectFail('ana (left crew) cannot vote', () => as('ana', `insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'da')`, [vs, o[1], U.ana]));
  eq('results', (await as('cris', `select venue_name, score from vote_results($1)`, [vs])).rows.map((r) => r.venue_name + r.score), ['A2', 'B1']);
  await db.exec(`update vote_sessions set closes_at = now() - interval '1 minute', created_at = now() - interval '2 hours' where id = '${vs}'`);
  await expectFail('vote closed at deadline', () => as('teen', `insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'da')`, [vs, o[0], U.teen]));
  eq('closed flag', (await as('cris', `select closed from vote_results($1) limit 1`, [vs])).rows[0].closed, true);
  // a vote still open, where not everyone answered, cannot become a plan yet
  const vs2 = (await as('bob', `select start_vote($1, null, $2::jsonb, now() + interval '1 hour') id`, [crew, opts])).rows[0].id;
  await expectFail('no plan while the vote is open', () => as('bob', `select plan_from_vote($1)`, [vs2]), /nu s-a terminat/);
  // the vote becomes one plan for everyone who voted
  const pv = (await as('cris', `select plan_from_vote($1) id`, [vs])).rows[0].id;
  eq('vote plan made once', (await as('bob', `select plan_from_vote($1) id`, [vs])).rows[0].id, pv);
  eq('winner is the plan', (await as('bob', `select venue_name from plans where id = $1`, [pv])).rows[0]?.venue_name, 'A');
  eq('bob asked to the plan', (await as('bob', `select answer from plan_members where plan_id = $1 and user_id = $2`, [pv, U.bob])).rows[0]?.answer, 'pending');
  await expectFail('a non-voter cannot make the plan', () => as('ana', `select plan_from_vote($1)`, [vs]));
  eq('voters see each other', (await as('teen', `select count(*)::int n from profiles where id = $1`, [U.cris])).rows[0].n, 1);
  // the crew learns: votes after the outing (and the votes before it) make the crew's taste
  await expectFail('no vote before the outing', () => as('bob', `insert into outing_votes (plan_id, vote) values ($1, 1)`, [pv]));
  await db.exec(`update plans set starts_at = now() - interval '3 hours' where id = '${pv}'`);
  await expectOk('bob: mi-a plăcut', () => as('bob', `insert into outing_votes (plan_id, vote) values ($1, 1)`, [pv]));
  await expectOk('bob changes to super', () => as('bob', `update outing_votes set vote = 2 where plan_id = $1`, [pv]));
  await expectFail('a vote for someone else', () => as('bob', `insert into outing_votes (plan_id, user_id, vote) values ($1, $2, 1)`, [pv, U.cris]));
  await expectFail('ana was not at the outing', () => as('ana', `insert into outing_votes (plan_id, vote) values ($1, 1)`, [pv]));
  await expectFail('a vote outside the scale', () => as('cris', `insert into outing_votes (plan_id, vote) values ($1, 5)`, [pv]));
  eq('crew taste for a member', (await as('bob', `select venue_id, score, outings from crew_taste($1) order by venue_id`, [crew])).rows.map((r) => r.venue_id + ':' + r.score + '/' + r.outings), ['n1:2/1', 'n2:1/0']);
  eq('crew taste hidden from others', (await as('ana', `select count(*)::int n from crew_taste($1)`, [crew])).rows[0].n, 0);
  eq('votes are private', (await as('cris', `select count(*)::int n from outing_votes`)).rows[0].n, 0);
  const one = (r) => { if (!r.rows.length) throw new Error('none'); };
  await expectFail('a vote cannot move to another plan', () => as('bob', `update outing_votes set plan_id = $1 where plan_id = $2 returning 1`, [plan, pv]).then(one));
  const p3 = (await as('ana', `insert into plans (owner_id, venue_id, venue_name, starts_at) values ($1, 'n3', 'Bistro', now() - interval '2 hours') returning id`, [U.ana])).rows[0].id;
  await expectOk('ana invites bob to p3', () => as('ana', `insert into plan_members (plan_id, user_id) values ($1, $2)`, [p3, U.bob]));
  await expectOk('bob: nu pot', () => as('bob', `update plan_members set answer = 'nu_pot' where plan_id = $1 and user_id = $2`, [p3, U.bob]));
  await expectFail('no vote for an outing you skipped', () => as('bob', `insert into outing_votes (plan_id, vote) values ($1, 1)`, [p3]));
  await expectFail('no moving a vote onto an outing you skipped', () => as('bob', `update outing_votes set plan_id = $1 where plan_id = $2 returning 1`, [p3, pv]).then(one));
  await expectOk('the organiser votes', () => as('ana', `insert into outing_votes (plan_id, vote) values ($1, -1)`, [p3]));
  await expectFail('a plan cannot be sent to a crew you are not in', () => as('ana', `update plans set crew_id = $1 where id = $2 returning 1`, [crew, p3]).then(one), /găști din care faci parte/);
  await expectOk('the organiser can still cancel', () => as('ana', `update plans set status = 'cancelled' where id = $1`, [p3]));
  eq('crew taste unchanged by outsiders', (await as('bob', `select venue_id, score, outings from crew_taste($1) order by venue_id`, [crew])).rows.map((r) => r.venue_id + ':' + r.score + '/' + r.outings), ['n1:2/1', 'n2:1/0']);
  await expectOk('report a closed place', () => as('bob', `insert into reports (venue_id, kind) values ('n1', 'inchis')`));
  await as('bob', `insert into reports (user_id, venue_id, kind, status, answer) values ($1, 'n1', 'inchis', 'rezolvat', 'gata')`, [U.cris]);
  eq('a report is always the sender\'s and new', (await q(`select user_id, status, answer from reports where venue_id = 'n1' order by created_at desc limit 1`)).rows[0], { user_id: U.bob, status: 'nou', answer: null });
  eq('reports are not readable', (await as('bob', `select count(*)::int n from reports`)).rows[0].n, 0);
  // XP on the server
  await q(`insert into venues (id, name, cat, lat, lon) values ('n1', 'Caru', 'mancare', 44.4312, 26.1010), ('n2', 'Muzeu', 'cultura', 44.4320, 26.1020), ('n3', 'Bistro', 'mancare', 44.4330, 26.1030)`);
  await as('bob', `update profiles set xp = 99999, stamps = 999 where id = $1`, [U.bob]);
  eq('xp cannot be set by hand', (await as('bob', `select xp, stamps from profiles where id = $1`, [U.bob])).rows[0], { xp: 0, stamps: 0 });
  eq('welcome +150', (await as('bob', `select xp_welcome() x`)).rows[0].x, 150);
  eq('welcome only once', (await as('bob', `select xp_welcome() x`)).rows[0].x, 150);
  await expectFail('check-in from far away', () => as('bob', `select xp_check_in('n1', 44.50, 26.10, 20)`), /departe/);
  const c1 = (await as('bob', `select xp_check_in('n1', 44.4313, 26.1011, 20) r`)).rows[0].r;
  eq('first check-in: +100 +50 new place +75 new kind', [c1.gain, c1.total], [225, 375]);
  eq('same place same day: nothing more', (await as('bob', `select xp_check_in('n1', 44.4313, 26.1011, 20) r`)).rows[0].r.gain, 0);
  await expectFail('two places within 20 minutes', () => as('bob', `select xp_check_in('n2', 44.4320, 26.1020, 10)`), /câteva minute/);
  await q(`update xp_log set created_at = now() - interval '1 hour' where user_id = $1`, [U.bob]);
  eq('new place, same kind: +150', (await as('bob', `select xp_check_in('n3', 44.4330, 26.1030, 10) r`)).rows[0].r.gain, 150);
  eq('stamps follow', (await as('bob', `select stamps from profiles where id = $1`, [U.bob])).rows[0].stamps, 2);
  await expectFail('the app cannot give itself the receipt XP', () => as('bob', `select xp_bill($1, 'n1', current_date, 'x')`, [U.bob]));
  const bday = `(now() at time zone 'Europe/Bucharest')::date`;
  eq('before reading the photo: ready', (await q(`select xp_bill_ready($1, 'n1', ${bday}) r`, [U.bob])).rows[0].r.ok, true);
  eq('before reading the photo: no check-in, no Google', (await q(`select xp_bill_ready($1, 'n2', ${bday}) r`, [U.bob])).rows[0].r.ok, false);
  eq('before reading the photo: not a day in the future', (await q(`select xp_bill_ready($1, 'n1', ${bday} + 1) r`, [U.bob])).rows[0].r.ok, false);
  eq('receipt after check-in (as the service)', (await q(`select xp_bill($1, 'n1', ${bday}, '12345678|2026-10-06|21:30|120.00') r`, [U.bob])).rows[0].r.gain, 25);
  eq('receipt only once', (await q(`select xp_bill($1, 'n1', ${bday}, '12345678|2026-10-06|21:31|99.00') r`, [U.bob])).rows[0].r.gain, 0);
  eq('one check-in, not two receipts (the next day)', (await q(`select xp_bill($1, 'n1', ${bday} + 1, '12345678|2026-10-07|00:30|50.00') r`, [U.bob])).rows[0].r.gain, 0);
  eq('no receipt without check-in', (await q(`select xp_bill($1, 'n2', current_date, '1|2|3|4') r`, [U.bob])).rows[0].r.gain, 0);
  await q(`insert into xp_log (user_id, kind, venue_id, cat, amount) values ($1, 'checkin', 'n1', 'bar', 100)`, [U.ana]);
  eq('the same receipt photo from another account', (await q(`select xp_bill($1, 'n1', ${bday}, '12345678|2026-10-06|21:30|120.00') r`, [U.ana])).rows[0].r.error, 'Bonul ăsta a fost deja pus.');
  await expectFail('a check-in at a place that is not in the list', () => as('cris', `select xp_check_in('x-inventat', 44.4313, 26.1011, 5, 'k1', 44.4313, 26.1011)`), /Nu știm/);
  await expectFail('the app cannot read the Google key', () => as('bob', `select google_key()`));
  eq('weather is readable', (await as('bob', `select count(*)::int n from weather`)).rows[0].n, 0);
  await expectFail('the app cannot write the weather', () => as('bob', `insert into weather (data) values ('{}')`));
  await expectOk('save my phone token', () => as('bob', `insert into push_tokens (token) values ('tok-bob')`));
  await expectFail('a token for someone else', () => as('bob', `insert into push_tokens (token, user_id) values ('tok-x', $1)`, [U.cris]));
  eq('tokens are private', (await as('cris', `select count(*)::int n from push_tokens`)).rows[0].n, 0);
  await expectFail('nobody writes the log directly', () => as('bob', `insert into xp_log (user_id, kind, amount) values ($1, 'carry', 5000)`, [U.bob]));
  
  // saved state and the Plus week
  await expectOk('save app state', () => as('bob', `update profile_private set app_state = '{"xp":150}'::jsonb where id = $1`, [U.bob]));
  eq('state saved', (await as('bob', `select app_state->>'xp' x from profile_private`)).rows[0].x, '150');
  const t1 = (await as('bob', `select start_plus_trial($1) t`, ['d'.repeat(64)])).rows[0].t;
  await db.exec(`select pg_sleep(0.01)`);
  eq('trial cannot restart', String((await as('bob', `select start_plus_trial() t`)).rows[0].t), String(t1));
  await as('bob', `update profile_private set plus_trial_started_at = now() + interval '30 days', birth_date = '2015-01-01' where id = $1`, [U.bob]);
  const bobPriv = (await as('bob', `select birth_date::text b, plus_trial_started_at t from profile_private`)).rows[0];
  eq('birth date locked', bobPriv.b, '1999-05-05'); eq('trial date locked', String(bobPriv.t), String(t1));

  // places in Supabase, changed from Admin, with roles (decision Cornel, 06.10)
  await q(`insert into public.staff (user_id, role) values ($1, 'fondator')`, [U.ana]);
  await q(`select import_places($1::jsonb, now() - interval '1 day')`, [JSON.stringify([
    { id: 'n1', name: 'Bar Unu', cat: 'bar', k: 'bar', lat: 44.43, lon: 26.1, pick: true, story: 'De ce merită.' },
    { id: 'n2', name: 'Cafe Doi', cat: 'cafea', k: 'cafe', lat: 44.44, lon: 26.11, rated: true },
  ])]);
  eq('everyone reads places', (await as('bob', `select count(*)::int n from venues where status = 'on'`)).rows[0].n >= 2, true);
  await expectFail('a client cannot change a place', () => as('bob', `select admin_place_save('n1', '{"name":"Hack"}')`), /Nu ai voie/);
  await expectFail('a client cannot write the table', () => as('bob', `update venues set name = 'Hack' where id = 'n1' returning 1`).then((r) => { if (!r.rows.length) throw new Error('no rows'); }));
  await expectFail('a client cannot make himself staff', () => as('bob', `select staff_set($1, 'fondator')`, [U.bob]), /Nu-ți poți|Nu ai voie/);
  await expectOk('the founder makes bob an editor', () => as('ana', `select staff_set($1, 'editor')`, [U.bob]));
  await expectFail('an editor cannot add staff', () => as('bob', `select staff_set($1, 'admin')`, [U.teen]), /Nu ai voie/);
  await expectOk('the editor changes the story and the hours', () => as('bob', `select admin_place_save('n1', '{"story":"Altă poveste.","hours":"Mo-Su 18:00-02:00","secret":"x"}', 'corectat după telefon')`));
  const n1 = (await q(`select data || edit m, edit from venues where id = 'n1'`)).rows[0];
  eq('the change sits over the map data', [n1.m.story, n1.m.hours, n1.m.name], ['Altă poveste.', 'Mo-Su 18:00-02:00', 'Bar Unu']);
  eq('only known fields are kept', n1.edit.secret, undefined);
  eq('every change is logged', (await as('ana', `select count(*)::int n from venue_log where venue_id = 'n1'`)).rows[0].n, 1);
  await q(`select import_places($1::jsonb, now())`, [JSON.stringify([{ id: 'n1', name: 'Bar Unu Nou', cat: 'bar', k: 'bar', lat: 44.43, lon: 26.1, pick: true, story: 'De ce merită.' }])]);
  const after = (await q(`select (data || edit)->>'story' s, (data || edit)->>'name' nm, status from venues where id = 'n1'`)).rows[0];
  eq('a new import keeps the change by hand', [after.s, after.nm], ['Altă poveste.', 'Bar Unu Nou']);
  eq('a place gone from the map is marked gone', (await q(`select status from venues where id = 'n2'`)).rows[0].status, 'gone');
  const nid = (await as('bob', `select admin_place_add('{"name":"Calul Bălan","k":"promenade","cat":"natura","lat":44.5657,"lon":25.9261,"story":"Pe malul lacului."}', 'din Lipsește un loc') id`)).rows[0].id;
  eq('a place added by hand', (await q(`select source, status from venues where id = $1`, [nid])).rows[0], { source: 'admin', status: 'on' });
  await q(`select import_places('[]'::jsonb, now())`);
  eq('the import never removes a place added by hand', (await q(`select status from venues where id = $1`, [nid])).rows[0].status, 'on');
  await expectOk('the founder makes cris a moderator', () => as('ana', `select staff_set($1, 'moderator')`, [U.cris]));
  await expectFail('a moderator cannot change a place', () => as('cris', `select admin_place_save('n1', '{"name":"X"}')`), /Nu ai voie/);
  await expectOk('a moderator hides a place', () => as('cris', `select admin_place_status('n1', true, 'închis definitiv')`));
  eq('hidden', (await q(`select status from venues where id = 'n1'`)).rows[0].status, 'hidden');
  await q(`select import_places($1::jsonb, now())`, [JSON.stringify([{ id: 'n1', name: 'Bar Unu Nou', cat: 'bar', k: 'bar', lat: 44.43, lon: 26.1 }])]);
  eq('a new import keeps it hidden', (await q(`select status from venues where id = 'n1'`)).rows[0].status, 'hidden');
  await expectOk('bob reports a missing place', () => as('bob', `insert into reports (venue_id, kind, note) values ('nou', 'altceva', 'LOC NOU: X · Buftea')`));
  eq('a client does not see the reports', (await as('teen', `select count(*)::int n from reports`)).rows[0].n, 0);
  eq('the moderator sees them', (await as('cris', `select count(*)::int n from reports`)).rows[0].n >= 1, true);
  await expectFail('an admin cannot touch the founder', () => (async () => { await q(`update staff set role = 'admin' where user_id = $1`, [U.bob]); return as('bob', `select staff_remove($1)`, [U.ana]); })(), /Nu ai voie/);
  await expectFail('nobody changes their own role', () => as('ana', `select staff_set($1, 'suport')`, [U.ana]), /singur/);
  await q(`delete from staff where user_id in ($1, $2)`, [U.bob, U.cris]);

  // what the public key (anon) and a signed-in phone can call
  eq('anon can run no function', (await q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`)).rows.map((r) => r.proname), []);
  eq('server-only functions are closed to the app', (await q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('import_places', 'xp_bill', 'google_key', 'visit_receipt') and has_function_privilege('authenticated', p.oid, 'execute')`)).rows, []);
  eq('every table has row security', (await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows, []);
  await expectFail('the public key cannot import places', async () => { await db.exec(`reset role; set role anon;`); try { await q(`select import_places('[]'::jsonb, now())`); } finally { await db.exec('reset role'); } }, /permission denied/);
  await expectFail('a phone cannot import places', () => as('bob', `select import_places('[]'::jsonb, now())`), /permission denied/);
  await expectFail('a phone cannot give itself XP for a bill', () => as('bob', `select xp_bill($1, 'n1', current_date, 'x')`, [U.bob]), /permission denied/);

  // rude names (decision Cornel, 06.10)
  await expectFail('rude username', () => as('eve', `select * from complete_signup('pu1a_mea', 'Eva', '2000-01-01')`), /alt nume/);
  await expectFail('rude first name', () => as('eve', `select * from complete_signup('eva.m', 'Muie', '2000-01-01')`), /alt nume/);
  await expectFail('rude name, spelled out', () => as('ana', `update profiles set first_name = 'P.u.l.a' where id = $1`, [U.ana]), /alt nume/);
  await expectOk('a normal name change', () => as('ana', `update profiles set first_name = 'Ursula' where id = $1`, [U.ana]));
  await expectFail('rude crew name', () => as('ana', `select create_crew('Gașca de p1zda', 'pizza', '#FF6A4D', array[$1, $2]::uuid[])`, [U.bob, U.teen]), /alt nume/);
  await expectFail('rude crew rename', () => as('bob', `update crews set name = 'cacaturi' where id = $1`, [crew]), /alt nume/);

  // the attacks found on 07.10: nobody moves their row onto someone else
  const one2 = (r) => { if (!r.rows.length) throw new Error('none'); };
  await expectOk('eve signs up', () => as('eve', `select * from complete_signup('eve.x', 'Eva', '1995-01-01')`));
  await expectOk('eve asks cris', () => as('eve', `insert into friendships (requester, addressee) values ($1, $2)`, [U.eve, U.cris]));
  await expectFail('cris turns eve\'s request into a friendship with bob', () => as('cris', `update friendships set requester = $1, status = 'accepted' where requester = $2 and addressee = $3 returning 1`, [U.bob, U.eve, U.cris]).then(one2), /Nu se poate/);
  await expectFail('a friend request to a minor by id', () => as('eve', `insert into friendships (requester, addressee) values ($1, $2)`, [U.eve, U.teen]));
  const other = (await as('ana', `select create_crew('Doar noi', 'star', '#FFD43B', array[$1]::uuid[], true) id`, [U.teen])).rows[0].id;
  await expectFail('moving into a crew you were not invited to', () => as('cris', `update crew_members set crew_id = $1, status = 'member' where crew_id = $2 and user_id = $3 returning 1`, [other, crew, U.cris]).then(one2), /Nu se poate/);
  await expectFail('moving onto a plan you were not called to', () => as('bob', `update plan_members set plan_id = $1 where plan_id = $2 and user_id = $3 returning 1`, [p3, pv, U.bob]).then(one2));
  const solo = (await as('cris', `select start_vote(null, null, $1::jsonb, now() + interval '1 hour') id`, [opts])).rows[0].id;
  const soloOpt = (await as('cris', `select id from vote_options where session_id = $1 limit 1`, [solo])).rows[0].id;
  await expectOk('cris votes in a vote of her own', () => as('cris', `insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'super')`, [solo, soloOpt, U.cris]));
  await expectFail('and cannot move that vote into another vote', () => as('cris', `update ballots set session_id = $1 where session_id = $2 returning 1`, [vs2, solo]).then(one2));
  await expectFail('a ballot must be for an option of its vote', () => q(`insert into ballots (session_id, option_id, user_id, value) values ($1, $2, $3, 'da')`, [vs2, soloOpt, U.bob]));
  await expectFail('a vote with 11 options', () => as('cris', `select start_vote(null, null, $1::jsonb, now() + interval '1 hour')`, [JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ venue_id: 'v' + i, venue_name: 'V' + i })))]), /cel mult 10/);
  await expectFail('the crew link cannot be set by hand', () => as('bob', `update crews set invite_token = 'parola123456', invite_expires_at = now() + interval '10 years' where id = $1 returning 1`, [crew]).then(one2));
  await expectFail('a plan in the past (to fill the crew taste)', () => as('bob', `insert into plans (owner_id, crew_id, venue_id, venue_name, starts_at) values ($1, $2, 'n1', 'X', '2000-01-01')`, [U.bob, crew]));
  eq('a plan takes the real name of the place', (await as('bob', `insert into plans (owner_id, venue_id, venue_name, starts_at) values ($1, 'n3', 'Ceva urât', now() + interval '1 hour') returning venue_name`, [U.bob])).rows[0].venue_name, 'Bistro');
  await expectFail('no rude name for a place not in the list', () => as('bob', `insert into plans (owner_id, venue_id, venue_name, starts_at) values ($1, 'x1', 'La muie', now() + interval '1 hour')`, [U.bob]), /alt nume/);
  // without an account: only the places, and not who changed them
  const anon = async (sql) => { await db.exec('reset role; set role anon;'); try { return await q(sql); } finally { await db.exec('reset role'); } };
  eq('the public key reads the places', (await anon(`select count(*)::int n from venues`)).rows[0].n > 0, true);
  eq('but not who edited them', await anon(`select edited_by from venues limit 1`).then(() => 'read', () => 'denied'), 'denied');
  eq('nor the profiles', await anon(`select count(*) from profiles`).then(() => 'read', () => 'denied'), 'denied');
  eq('nor the weather', await anon(`select count(*) from weather`).then(() => 'read', () => 'denied'), 'denied');
  // the notifications of a phone follow the account on it
  await expectOk('bob registers his phone', () => as('bob', `select push_token_save('tok-telefon-1')`));
  await expectOk('cris signs in on the same phone', () => as('cris', `select push_token_save('tok-telefon-1')`));
  eq('the phone is now cris\'s', (await q(`select user_id from push_tokens where token = 'tok-telefon-1'`)).rows[0].user_id, U.cris);
  // Google: quotas, and the weather asked once
  const quota = async (who, n) => (await q(`select api_quota($1, 'e-deschis', $2) ok`, [U[who], n])).rows[0].ok;
  eq('places checked: within the hour quota', [await quota('bob', 6), await quota('bob', 6), await quota('bob', 1)], [true, true, false]);
  eq('another person has their own quota', await quota('cris', 12), true);
  eq('the whole app stays in Google\'s free part (30 a day)', [await quota('ana', 6), await quota('teen', 1)], [true, false]);
  await expectFail('a phone cannot use the quota', () => as('bob', `select api_quota($1, 'e-deschis', 1)`, [U.bob]), /permission denied/);
  eq('the weather: the first caller takes the turn', (await q(`select weather_turn() t`)).rows[0].t, true);
  eq('the others do not go to Google', (await q(`select weather_turn() t`)).rows[0].t, false);

  // the free Plus week: once per phone, not per account (Cornel, 06.10)
  const dev1 = 'a'.repeat(64), dev2 = 'b'.repeat(64), dev3 = 'c'.repeat(64);
  const trial1 = (await as('ana', `select start_plus_trial($1) t`, [dev1])).rows[0].t;
  eq('the first account on a phone gets the week', !!trial1, true);
  await expectFail('a second account on the same phone does not', () => as('cris', `select start_plus_trial($1)`, [dev1]), /folosit deja/);
  eq('the same account on another phone keeps its week', String((await as('ana', `select start_plus_trial($1) t`, [dev2])).rows[0].t), String(trial1));
  await expectFail('an old app without the phone code', () => as('teen', `select start_plus_trial()`), /Actualizează/);
  await as('teen', `update profile_private set plus_trial_started_at = now() where id = $1`, [U.teen]);
  eq('the week cannot be written by hand', (await q(`select plus_trial_started_at t from profile_private where id = $1`, [U.teen])).rows[0].t, null);
  await as('bob', `update profile_private set plus_until = now() + interval '1 year' where id = $1`, [U.bob]);
  eq('nor the Plus days', (await q(`select plus_until t from profile_private where id = $1`, [U.bob])).rows[0].t, null);
  eq('the phone code is not kept as sent', (await q(`select count(*)::int n from private.trial_devices where device in ($1, $2)`, [dev1, dev2])).rows[0].n, 0);
  eq('a phone cannot read the phones', await as('bob', `select count(*) from private.trial_devices`).then(() => 'read', () => 'denied'), 'denied');

  // partners (06.10): reservations, Live Drops, "Am ajuns", the receipt, "Închide seara", 10% / 8% of the bill
  await expectFail('a client cannot make a partner', () => as('bob', `select admin_partner_save($1, 'Firma SRL', 'RO123456', true, 'activ', 'bob')`, [nid]), /Nu ai voie/);
  await expectFail('the place must exist', () => as('ana', `select admin_partner_save('nu-exista', 'Firma SRL', '123456', false)`), /nu există/);
  const P = (await as('ana', `select * from admin_partner_save($1, 'Calul SRL', 'RO 12345678', true, 'activ', '@bob')`, [nid])).rows[0];
  eq('a founder pays 8%, from 3 months on', [P.rate, P.cui, P.free_until > P.activated_at], ['0.080', '12345678', true]);
  eq('the owner is on the team', (await as('bob', `select role from biz_my_venues()`)).rows.map((r) => r.role), ['proprietar']);
  eq('the partner is logged', (await q(`select count(*)::int n from venue_log where venue_id = $1 and action = 'partener'`, [nid])).rows[0].n, 1);
  for (let i = 0; i < 19; i++) await q(`insert into partners (venue_id, firm, cui, founder, rate, activated_at, free_until) values ($1, 'F SRL', '1234', true, 0.08, current_date, current_date)`, ['f' + i]);
  await expectFail('20 founders at most', () => as('ana', `select admin_partner_save('n1', 'Bar SRL', '4321', true)`), /20 de fondatori/);
  await q(`delete from partners where venue_id like 'f%'`);
  const today = (await as('bob', `select biz_today($1) t`, [nid])).rows[0].t;
  eq('the team sees the word of the day and the code', [!!today.word, !!today.token, today.role], [true, true, 'proprietar']);
  await expectFail('a stranger does not', () => as('cris', `select biz_today($1)`, [nid]), /Nu ești/);
  eq('a stranger does not see the code', (await as('cris', `select count(*)::int n from venue_codes`)).rows[0].n, 0);

  const fresh = (await as('eve', `select * from reservation_request($1, now() + interval '2 days', 2)`, [nid])).rows[0];
  eq('a brand-new account waits for the place to confirm', fresh.status, 'cerută');
  await q(`update profiles set created_at = now() - interval '30 days' where id = $1`, [U.ana]);
  const resv = (await as('ana', `select * from reservation_request($1, now() + interval '30 minutes', 2)`, [nid])).rows[0];
  eq('a small table is confirmed by itself', resv.status, 'confirmată');
  const big = (await as('teen', `select * from reservation_request($1, now() + interval '1 day', 9)`, [nid])).rows[0];
  eq('a big one waits for the place', big.status, 'cerută');
  await expectFail('a client cannot confirm', () => as('teen', `select reservation_decide($1, true)`, [big.id]), /Nu ai voie/);
  await expectOk('the place confirms', () => as('bob', `select reservation_decide($1, true)`, [big.id]));
  await expectFail('too soon', () => as('cris', `select reservation_request($1, now() + interval '5 minutes', 2)`, [nid]), /15 minute/);
  const scan = (await as('ana', `select visit_scan($1, 44.5657, 25.9261, '7', 2) s`, [today.token])).rows[0].s;
  eq('"Am ajuns" with a reservation: the word of the day', [scan.kind, scan.word, scan.table], ['rezervare', today.word, '7']);
  eq('scanning again is the same visit', (await as('ana', `select visit_scan($1, 44.5657, 25.9261) s`, [today.token])).rows[0].s.visit, scan.visit);
  await expectFail('a wrong code', () => as('ana', `select visit_scan('XXXXXXXXXX', 44.5657, 25.9261)`), /nu e al unui local/);
  await expectFail('a photo of the code, scanned from home', () => as('eve', `select visit_scan($1, 44.43, 26.10)`, [today.token]), /când ești la local/);
  eq('the app does not see the firm, the CUI or the percent', await as('eve', `select cui from partners`).then(() => 'read', () => 'denied'), 'denied');
  eq('only what the app needs', (await as('eve', `select venue_id, reservations_on from partners`)).rows.length, 1);

  await expectFail('no tobacco in a Live Drop', () => as('bob', `select drop_create($1, 'Narghilea -15%', 15, 20, 10, 60)`, [nid]), /tutun/);
  await expectFail('Plus gets at least 5 points more', () => as('bob', `select drop_create($1, 'Desert -15%', 15, 16, 10, 60)`, [nid]));
  await expectFail('only the owner or the manager', () => as('ana', `select drop_create($1, 'Desert -15%', 15, 20, 10, 60)`, [nid]), /proprietarul/);
  await expectFail('tobacco written with a zero', () => as('bob', `select drop_create($1, 'N4rghilea -15%', 15, 20, 10, 60)`, [nid]), /tutun/);
  const drop = (await as('bob', `select * from drop_create($1, 'Cocktailuri -15%', 15, 20, 4, 60)`, [nid])).rows[0];
  eq('alcohol means 18+', drop.adult, true);
  await expectFail('not twice at the same time', () => as('bob', `select drop_create($1, 'Desert -15%', 15, 20, 10, 60)`, [nid]), /deja un Live Drop/);
  await expectFail('a minor cannot take it', () => as('teen', `select drop_claim($1, 2)`, [drop.id]), /18 ani/);
  await expectFail('someone already there today cannot', () => as('ana', `select drop_claim($1, 2)`, [drop.id]), /deja la local/);
  await expectOk('cris takes 3 seats', () => as('cris', `select drop_claim($1, 3)`, [drop.id]));
  await expectFail('one offer at a time', () => as('cris', `select drop_claim($1, 1)`, [drop.id]), /deja o ofertă/);
  const dropScan = (await as('cris', `select visit_scan($1, 44.5657, 25.9261) s`, [today.token])).rows[0].s;
  eq('"Am ajuns" with the offer', [dropScan.kind, dropScan.discount, dropScan.people], ['drop', 15, 3]);
  const teenScan = (await as('teen', `select visit_scan($1, 44.5657, 25.9261) s`, [today.token])).rows[0].s;
  eq('without a reservation or an offer: a visit from a plan', [teenScan.kind, teenScan.discount], ['plan', 0]);

  await expectFail('a phone cannot put a receipt', () => as('ana', `select visit_receipt($1, $2, '12345678', 200, 20, now())`, [U.ana, scan.visit]), /permission denied/);
  eq('a receipt from another firm', (await q(`select visit_receipt($1, $2, '999', 200, 20, now()) r`, [U.ana, scan.visit])).rows[0].r.ok, false);
  eq('the receipt sets the bill', (await q(`select visit_receipt($1, $2, 'RO12345678', 200, 20, now()) r`, [U.ana, scan.visit])).rows[0].r, { ok: true, bill: 200, plus_day: false, receipts_this_month: 1 });
  eq('the same receipt twice', (await q(`select visit_receipt($1, $2, '12345678', 200, 20, now()) r`, [U.ana, scan.visit])).rows[0].r.ok, false);
  await expectOk('bob adds teen to scan codes', () => as('bob', `select biz_team_set($1, '@teen', 'scanare')`, [nid]));
  await expectFail('the one who scans does not close the evening', () => as('teen', `select visit_close($1, true, 100)`, [scan.visit]), /Nu ai voie/);
  await expectFail('a receipt means they came', () => as('bob', `select visit_close($1, false)`, [scan.visit]), /a venit/);
  await expectFail('closing without saying if they came', () => as('bob', `select visit_close($1, null, 150)`, [scan.visit]), /au venit/);
  await expectOk('the place closes the evening', () => as('bob', `select visit_close($1, true, 150)`, [scan.visit]));
  await expectOk('and the table from the offer', () => as('bob', `select visit_close($1, true, 300)`, [dropScan.visit]));
  await expectOk('and the visit from a plan', () => as('bob', `select visit_close($1, true, 500)`, [teenScan.visit]));
  eq('the receipt beats the place', (await q(`select bill, declared, bill_source from visits where id = $1`, [scan.visit])).rows[0], { bill: '200.00', declared: '150.00', bill_source: 'bon' });
  const month = (await as('bob', `select biz_month($1) m`, [nid])).rows[0].m;
  eq('free months: "you would have paid" 8% (plans pay nothing)', [month.fee, month.would_pay, month.lines.length], [0, 40, 2]);
  await expectFail('someone who only scans does not see the month', () => as('teen', `select biz_month($1)`, [nid]), /Nu ai voie/);
  await q(`update partners set free_until = current_date - 400 where venue_id = $1`, [nid]);
  eq('after them, 8% of the bill', (await as('bob', `select biz_month($1) m`, [nid])).rows[0].m.fee, 40);
  await q(`update visits set bill = 2000 where id = $1`, [dropScan.visit]);
  eq('at most 100 lei a table', (await as('bob', `select biz_month($1) m`, [nid])).rows[0].m.fee, 116);
  for (const d of [1, 2, 3]) await q(`insert into visits (venue_id, user_id, kind, work_day, scanned_at, outcome, bill, bill_source) values ($1, $2, 'rezervare', private.work_day(now()) - $3::int, now() - make_interval(days => $3::int), 'a venit', 100, 'local')`, [nid, U.ana, d]);
  const fees = (await q(`select fee from private.visit_fees($1, private.work_day(now()) - 10, private.work_day(now())) where visit_id in (select id from visits where user_id = $2) order by work_day`, [nid, U.ana])).rows.map((r) => Number(r.fee));
  eq('the same person: 3 tables a year at the same place', fees, [8, 8, 8, 0]);
  const before = (await q(`select id from visits where user_id = $1 and work_day = private.work_day(now()) - 1`, [U.ana])).rows[0].id;
  eq('every 2nd receipt: a Plus day', (await q(`select visit_receipt($1, $2, '12345678', 90, 0, now() - interval '1 day') r`, [U.ana, before])).rows[0].r.plus_day, true);
  eq('Plus day lands on the account', (await q(`select plus_until > now() p from profile_private where id = $1`, [U.ana])).rows[0].p, true);
  eq('a client sees only their own visits', (await as('cris', `select count(*)::int n from visits`)).rows[0].n, 1);
  eq('the admin sees the partner and the month', (await as('ana', `select admin_partners() a`)).rows[0].a[0].month.fee, (await as('bob', `select biz_month($1) m`, [nid])).rows[0].m.fee);
  await expectFail('a client does not see the partners', () => as('cris', `select admin_partners()`), /Nu ai voie/);
  await q(`update partners set free_until = current_date + 30 where venue_id = $1`, [nid]);

    // account deletion
  await expectOk('cris takes the week on a third phone', () => as('cris', `select start_plus_trial($1)`, [dev3]));
  await expectOk('delete account', () => as('cris', `select delete_my_account()`));
  eq('cris gone', (await q(`select count(*)::int n from profiles where id = $1`, [U.cris])).rows[0].n, 0);
  await q('insert into auth.users values ($1) on conflict do nothing', [U.cris]);
  await expectOk('cris comes back with a new account', () => as('cris', `select * from complete_signup('cris2', 'Cris', '1998-05-05')`));
  await expectFail('a deleted account does not free the phone', () => as('cris', `select start_plus_trial($1)`, [dev3]), /folosit deja/);
  expect(bad, 'failed checks').toBe(0);
    expect(ok).toBeGreaterThan(40);
  
}, 60000);
