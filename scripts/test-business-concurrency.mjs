// Real, independent PostgreSQL connections. Only an isolated localhost database may be used.
import pg from "pg";
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const url = process.env.CEFACI_TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "Setează CEFACI_TEST_DATABASE_URL către PostgreSQL 17 local de test.",
  );
const target = new URL(url);
if (!["127.0.0.1", "localhost"].includes(target.hostname))
  throw new Error("Testele concurente sunt limitate la localhost.");
const master = new pg.Client({ connectionString: url });
await master.connect();
const dbname = "cefaci_test_" + process.pid + "_" + Date.now();
let pool;
let closing = false;
try {
  await master.query(`CREATE DATABASE ${dbname}`);
  target.pathname = "/" + dbname;
  pool = new pg.Pool({ connectionString: target.toString(), max: 12 });
  pool.on("error", (e) => {
    if (!closing || e.code !== "57P01") throw e;
  });
  await pool.query(`DO $$ BEGIN IF NOT EXISTS(select 1 from pg_roles where rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(select 1 from pg_roles where rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(select 1 from pg_roles where rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
 create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`);
  for (const file of fs.readdirSync("supabase/migrations").sort())
    await pool.query(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  const run = async (user, sql, args = []) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await c.query("set local role authenticated");
      const r = await c.query(sql, args);
      await c.query("commit");
      return r.rows;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  const owner = async (name) => {
    const id = crypto.randomUUID();
    await pool.query(
      "insert into auth.users values($1,now()-interval '30 days')",
      [id],
    );
    await run(id, "select complete_signup($1,$1,'2000-01-01')", [name]);
    await pool.query("select set_config('cefaci.plus','on',false)");
    const c = await pool.connect();
    try {
      await c.query("select set_config('cefaci.plus','on',false)");
      await c.query(
        "update profile_private set plus_until=now()+interval '1 day' where id=$1",
        [id],
      );
      await c.query("select set_config('cefaci.plus','off',false)");
    } finally {
      c.release();
    }
    return id;
  };
  // Client creates an uncommitted profile while Business sees no profile yet.
  // Business must wait for the unique key and preserve Client's real identity.
  const identity = crypto.randomUUID();
  await pool.query("insert into auth.users(id) values($1)", [identity]);
  const clientIdentity = await pool.connect();
  try {
    await clientIdentity.query("begin");
    await clientIdentity.query("select set_config('request.jwt.claim.sub',$1,true)", [identity]);
    await clientIdentity.query("set local role authenticated");
    await clientIdentity.query("select complete_signup('clientrace','Client','1990-01-01')");
    const businessIdentity = run(identity, "select biz_identity_complete('businessrace','Business','1991-01-01') p");
    const deadline = Date.now() + 5000;
    let blocked = false;
    while (Date.now() < deadline) {
      blocked = (await pool.query("select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%select biz_identity_complete(%') b")).rows[0].b;
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert(blocked, "Business must actually overlap the uncommitted Client signup");
    await clientIdentity.query("commit");
    assert.deepEqual((await businessIdentity)[0].p, {has_profile:true,username:"clientrace",first_name:"Client"});
    assert.equal((await pool.query("select birth_date::text d from profile_private where id=$1", [identity])).rows[0].d, "1990-01-01");
    console.log("PASS: profil Client creat simultan cu Business — identitatea existentă nu este suprascrisă");
  } finally {
    await clientIdentity.query("rollback");
    clientIdentity.release();
  }
  const biz = await owner("racebiz");
  const venue = async (id, capacity = 2) => {
    await pool.query(
      "insert into venues(id,name,cat,lat,lon,data) values($1,$1,'mancare',44.43,26.1,'{}')",
      [id],
    );
    await pool.query(
      "insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier,capacity,reservation_hours) values($1,'Test','1234567',.1,current_date-60,current_date-30,2,$2,$3)",
      [
        id,
        capacity,
        JSON.stringify(
          Array.from({ length: 7 }, (_, i) => ({
            day: i + 1,
            from: "00:00",
            to: "23:59",
          })),
        ),
      ],
    );
    await pool.query(
      "insert into partner_members(venue_id,user_id,role) values($1,$2,'proprietar')",
      [id, biz],
    );
    await pool.query("insert into venue_codes values($1,$2)", [
      id,
      "local-" + id,
    ]);
  };
  const plan = async (user, v, people, key) =>
    (
      await run(
        user,
        "select plan_share_v2($1,$2,now()+interval '20 minutes',$3) id",
        [key, v, people],
      )
    )[0].id;
  await venue("last-capacity");
  const a = await owner("raceaaa"),
    b = await owner("racebbb");
  const pa = await plan(a, "last-capacity", 2, "a"),
    pb = await plan(b, "last-capacity", 2, "b");
  const cap = await Promise.allSettled([
    run(a, "select to_jsonb(reservation_request_v2($1,'cap-a')) r", [pa]),
    run(b, "select to_jsonb(reservation_request_v2($1,'cap-b')) r", [pb]),
  ]);
  assert.equal(cap.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (
      await pool.query(
        "select sum(people)::int n from reservations where status='confirmată'",
      )
    ).rows[0].n,
    2,
  );
  console.log(
    "PASS: ultima capacitate — o singură rezervare, fără supraocupare",
  );
  await venue("retry", 10);
  const user = await owner("raceretry"),
    p = await plan(user, "retry", 2, "retry");
  const retries = await Promise.all(
    Array.from({ length: 8 }, () =>
      run(user, "select to_jsonb(reservation_request_v2($1,'same-key')) r", [
        p,
      ]),
    ),
  );
  assert.equal(new Set(retries.map((x) => x[0].r.id)).size, 1);
  console.log(
    "PASS: opt cereri simultane cu aceeași identitate — un singur rând",
  );
  await venue("attendance", 10);
  const organizer = await owner("raceorg"),
    guest = await owner("raceguest");
  await run(
    organizer,
    "insert into friendships(requester,addressee) values($1,$2)",
    [organizer, guest],
  );
  await run(
    guest,
    "update friendships set status='accepted' where requester=$1",
    [organizer],
  );
  const grouped = (
    await run(
      organizer,
      "select plan_share_v2('shared','attendance',now()+interval '20 minutes',2,$1) id",
      [[guest]],
    )
  )[0].id;
  const both = await Promise.allSettled([
    run(guest, "select plan_answer_v2($1,'vin') n", [grouped]),
    run(organizer, "select to_jsonb(reservation_request_v2($1,'final')) r", [
      grouped,
    ]),
  ]);
  assert.equal(both[0].status, "fulfilled");
  const final = (
    await run(
      organizer,
      "select to_jsonb(reservation_request_v2($1,'final')) r",
      [grouped],
    )
  )[0].r;
  assert.equal(final.people, 2);
  console.log(
    "PASS: ultimul răspuns concurent cu rezervarea — număr comun, retry sigur",
  );
  await venue("groupfreeze", 10);
  const frozenPlan = await plan(organizer, "groupfreeze", 2, "freeze");
  const invitationRace = await Promise.allSettled([
    run(organizer,
      "select plan_share_v2('freeze','groupfreeze',now()+interval '20 minutes',2,$1,null,0,'{}',$2) id",
      [[guest], frozenPlan]),
    run(organizer, "select to_jsonb(reservation_request_v2($1,'freeze-book')) r", [frozenPlan]),
  ]);
  assert.equal(invitationRace.filter((r) => r.status === "fulfilled").length, 1);
  const frozenState = (await pool.query(
    "select (select count(*)::int from plan_members where plan_id=$1) members,(select count(*)::int from reservations where plan_id=$1) bookings",
    [frozenPlan],
  )).rows[0];
  assert.ok((frozenState.members === 1 && frozenState.bookings === 0) ||
    (frozenState.members === 0 && frozenState.bookings === 1));
  console.log("PASS: invitație simultană cu rezervarea — grupul rezervat nu se schimbă");
  await venue("stock", 10);
  const x = await owner("racestocka"),
    y = await owner("racestockb"),
    px = await plan(x, "stock", 3, "sx"),
    py = await plan(y, "stock", 3, "sy");
  const drop = (
    await run(
      biz,
      "select to_jsonb(drop_create_v2('stock','Desert',10,20,4,120)) d",
    )
  )[0].d;
  const claims = await Promise.allSettled([
    run(x, "select to_jsonb(drop_claim_v2($1,$2,3,44.45,26.1,'sx')) c", [
      drop.id,
      px,
    ]),
    run(y, "select to_jsonb(drop_claim_v2($1,$2,3,44.45,26.1,'sy')) c", [
      drop.id,
      py,
    ]),
  ]);
  assert.equal(claims.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (
      await pool.query(
        "select sum(seats)::int n from drop_claims where drop_id=$1",
        [drop.id],
      )
    ).rows[0].n,
    3,
  );
  console.log("PASS: ultimele locuri Drop — revendicare atomică");
  await pool.query(
    "update drop_claims set created_at=now()-interval '11 minutes' where drop_id=$1",
    [drop.id],
  );
  const winner =
    claims[0].status === "fulfilled" ? { u: x, p: px } : { u: y, p: py };
  const ticket = (
    await run(winner.u, "select plan_ticket_v2($1) t", [winner.p])
  )[0].t.token;
  const scans = await Promise.all([
    run(
      winner.u,
      "select to_jsonb(visit_client_arrive_v2($1,'local-stock',44.43,26.1)) v",
      [winner.p],
    ),
    run(biz, "select biz_scan_v2('stock',$1) v", [ticket]),
    run(biz, "select biz_scan_v2('stock',$1) v", [ticket]),
  ]);
  assert.equal(new Set(scans.map((x) => x[0].v.id ?? x[0].v.visit)).size, 1);
  assert.equal(
    (
      await pool.query("select count(*)::int n from visits where plan_id=$1", [
        winner.p,
      ])
    ).rows[0].n,
    1,
  );
  console.log(
    "PASS: Client + două scannere Business simultane — o singură sosire",
  );
} finally {
  closing = true;
  await pool?.end();
  await master.query(`DROP DATABASE IF EXISTS ${dbname} WITH (FORCE)`);
  await master.end();
}
