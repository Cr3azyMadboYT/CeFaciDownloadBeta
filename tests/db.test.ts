// The Supabase schema (supabase/migrations) on a real Postgres (PGlite), with Supabase's auth stubbed:
// who can see and change what — friends, crews, plans, votes, minors, account deletion.
import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
it('keeps every rule of the database', async () => {
  const db = new PGlite();
  const q = (s, p) => db.query(s, p);
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(fs.readdirSync('supabase/migrations').sort().map((f) => fs.readFileSync('supabase/migrations/' + f, 'utf8')).join('\n'));
  await db.exec(`grant usage on schema public to authenticated; grant select, insert, update, delete on all tables in schema public to authenticated;`);
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
  eq('mutual friends bob-teen', (await as('bob', `select username from mutual_friends($1)`, [U.teen])).rows.map((r) => r.username), ['ana.p']);
  
  // crews
  await expectFail('crew needs 2 friends', () => as('ana', `select create_crew('Gașca', 'pizza', '#FF6A4D', array[$1]::uuid[])`, [U.bob]), /cel puțin 2/);
  await expectFail('crew only with friends', () => as('bob', `select create_crew('X', 'star', '#FFD43B', array[$1, $2]::uuid[])`, [U.ana, U.cris]), /doar prieteni/);
  const crew = (await as('ana', `select create_crew('Gașca de vineri', 'pizza', '#FF6A4D', array[$1, $2]::uuid[]) id`, [U.bob, U.teen])).rows[0].id;
  eq('bob sees crew as invited', (await as('bob', `select status from crew_members where crew_id = $1 and user_id = $2`, [crew, U.bob])).rows[0].status, 'invited');
  await expectOk('bob accepts crew', () => as('bob', `update crew_members set status = 'member', joined_at = now() where crew_id = $1 and user_id = $2`, [crew, U.bob]));
  eq('cris (not in crew) sees nothing', (await as('cris', `select count(*)::int n from crews`)).rows[0].n, 0);
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
  await expectOk('report a closed place', () => as('bob', `insert into reports (venue_id, kind) values ('n1', 'inchis')`));
  await expectFail('report as someone else', () => as('bob', `insert into reports (user_id, venue_id, kind) values ($1, 'n1', 'inchis')`, [U.cris]));
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
  await expectFail('the app cannot give itself the receipt XP', () => as('bob', `select xp_bill($1, 'n1', current_date)`, [U.bob]));
  eq('receipt after check-in (as the service)', (await q(`select xp_bill($1, 'n1', (now() at time zone 'Europe/Bucharest')::date) r`, [U.bob])).rows[0].r.gain, 25);
  eq('receipt only once', (await q(`select xp_bill($1, 'n1', (now() at time zone 'Europe/Bucharest')::date) r`, [U.bob])).rows[0].r.gain, 0);
  eq('no receipt without check-in', (await q(`select xp_bill($1, 'n2', current_date) r`, [U.bob])).rows[0].r.gain, 0);
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
  const t1 = (await as('bob', `select start_plus_trial() t`)).rows[0].t;
  await db.exec(`select pg_sleep(0.01)`);
  eq('trial cannot restart', String((await as('bob', `select start_plus_trial() t`)).rows[0].t), String(t1));
  await as('bob', `update profile_private set plus_trial_started_at = now() + interval '30 days', birth_date = '2015-01-01' where id = $1`, [U.bob]);
  const bobPriv = (await as('bob', `select birth_date::text b, plus_trial_started_at t from profile_private`)).rows[0];
  eq('birth date locked', bobPriv.b, '1999-05-05'); eq('trial date locked', String(bobPriv.t), String(t1));

    // account deletion
  await expectOk('delete account', () => as('cris', `select delete_my_account()`));
  eq('cris gone', (await q(`select count(*)::int n from profiles where id = $1`, [U.cris])).rows[0].n, 0);
  expect(bad, 'failed checks').toBe(0);
    expect(ok).toBeGreaterThan(40);
  
}, 60000);
