import { prepareAuthSchema, authenticateFixture, seedAuthFixture } from './fixtures/auth.mjs';
import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
let db: PGlite;
const U = {
  owner: "00000000-0000-0000-0000-00000000000a",
  guest: "00000000-0000-0000-0000-00000000000b",
  biz: "00000000-0000-0000-0000-00000000000c",
  other: "00000000-0000-0000-0000-00000000000d",
  scanner: "00000000-0000-0000-0000-00000000000e",
};
const q = (sql: string, args: unknown[] = []) => db.query<any>(sql, args);
async function as(u: keyof typeof U, sql: string, args: unknown[] = []) {
  await db.exec('reset role'); await authenticateFixture(db, U[u]); await db.exec('set role authenticated');
  try {
    return await q(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
const value = async (u: keyof typeof U, sql: string, args: unknown[] = []) =>
  Object.values(
    (await as(u, `select to_jsonb(v) result from (${sql}) x(v)`, args)).rows[0],
  )[0] as any;
async function plan(key: string, people = 6, minutes = 120) {
  return value(
    "owner",
    `select plan_share_v2($1,'v',now()+make_interval(mins=>$2),$3)`,
    [key, minutes, people],
  ) as Promise<string>;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant all on functions to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;`,
  );
  await prepareAuthSchema(db);
  for (const f of fs.readdirSync("supabase/migrations").sort())
    await db.exec(fs.readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec("grant usage on schema public to anon,authenticated");
  for (const [name, id] of Object.entries(U)) {
    await q("insert into auth.users(id,created_at) values($1,now()-interval '30 days')", [id]);
    await seedAuthFixture(db,id);
    await as(
      name as keyof typeof U,
      "select complete_signup($1,$1,'2000-01-01')",
      [name],
    );
  }
  await db.exec(
    `insert into venues(id,name,cat,lat,lon,data) values('v','Local test','mancare',44.43,26.1,'{}'),('w','Alt local','mancare',44.44,26.1,'{}');insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier,capacity,reservation_hours) values('v','Test SRL','1234567',.1,current_date-60,current_date-30,2,10,'[{"day":1,"from":"00:00","to":"23:59"},{"day":2,"from":"00:00","to":"23:59"},{"day":3,"from":"00:00","to":"23:59"},{"day":4,"from":"00:00","to":"23:59"},{"day":5,"from":"00:00","to":"23:59"},{"day":6,"from":"00:00","to":"23:59"},{"day":7,"from":"00:00","to":"23:59"}]'),('w','Test SRL','1234567',.1,current_date-60,current_date-30,2,10,'[]');insert into venue_codes(venue_id,token) values('v','venue-token-v');`,
  );
  await q(
    "insert into partner_members(venue_id,user_id,role) values('v',$1,'proprietar'),('v',$2,'scanare')",
    [U.biz, U.scanner],
  );
  await q(
    "insert into friendships(requester,addressee,status) values($1,$2,'accepted')",
    [U.owner, U.guest],
  );
  await as(
    "guest",
    "update friendships set status='accepted' where requester=$1 and addressee=$2",
    [U.owner, U.guest],
  );
}, 60000);
afterAll(() => db?.close());

async function inviteExisting(p: string, key: string) {
  return as("owner", "select plan_share_v2($1,'v',now(),2,$2,null,0,'{}',$3)", [key, [U.guest], p]);
}
async function arrived(key: string) {
  const p = await plan(key, 2, 0);
  const visit = await value("owner", "select visit_client_arrive_v2($1,'venue-token-v',44.43,26.1)", [p]);
  return { p, visit };
}
async function closedVote(details: any = {}, venue = "v") {
  const vote = await value("owner", "select start_vote(null,$1,$2::jsonb,now()+interval '1 hour')", [[U.guest], JSON.stringify([{ venue_id: venue, venue_name: "Local", details }, { venue_id: "w", venue_name: "Altul" }])]);
  await q("update vote_sessions set closes_at=now()-interval '1 minute',created_at=now()-interval '2 hours' where id=$1", [vote]);
  return vote;
}
it("permits first invitations before any operational snapshot and keeps retries idempotent", async () => {
  const p = await plan("fresh-group", 2, 0);
  await inviteExisting(p, "fresh-group");
  expect((await value("owner", "select plan_attendance($1)", [p])).ready).toBe(false);
  await value("guest", "select plan_answer_v2($1,'vin')", [p]);
  const visit = await value("owner", "select visit_client_arrive_v2($1,'venue-token-v',44.43,26.1)", [p]);
  await inviteExisting(p, "fresh-group");
  expect(visit.people).toBe(2);
  expect((await q("select count(*)::int n from plan_members where plan_id=$1", [p])).rows[0].n).toBe(1);
});
it("refuses adding participants after a reservation and preserves the capacity snapshot", async () => {
  const p = await plan("frozen-reservation", 2, 120);
  const reservation = await value("owner", "select reservation_request_v2($1,'frozen-res')", [p]);
  await expect(inviteExisting(p, "frozen-reservation")).rejects.toThrow(/Grupul are deja/);
  expect((await q("select people,shared_at from plans where id=$1", [p])).rows[0]).toMatchObject({people: 2,shared_at:null});
  expect((await q("select people from reservations where id=$1", [reservation.id])).rows[0].people).toBe(2);
  await as("owner", "select plan_cancel_v2($1)", [p]);
});
it("refuses adding participants after a claimed Drop, including previously cancelled claims", async () => {
  // An independent synthetic account avoids the deliberate same-day arrival prohibition.
  const p = await value("guest", "select plan_share_v2('frozen-drop','v',now(),1)");
  const drop = await value("biz", "select drop_create_v2('v','Oferta audit',10,20,4,120,1,null,false,false,'audit-drop')");
  await q("update drops set starts_at=now()-interval '11 minutes' where id=$1", [drop.id]);
  const claim = await value("guest", "select drop_claim_v2($1,$2,1,44.45,26.1,'audit-claim')", [drop.id,p]);
  for (const state of ['activ','anulat']) {
    await q("update drop_claims set status=$2 where id=$1", [claim.id,state]);
    await expect(as("guest", "select plan_share_v2('frozen-drop','v',now(),2,$1,null,0,'{}',$2)", [[U.owner],p])).rejects.toThrow(/Grupul are deja/);
  }
});
it("refuses retroactive participation after arrival, preserving receipt access boundaries", async () => {
  const { p, visit } = await arrived("frozen-arrival");
  await expect(inviteExisting(p, "frozen-arrival")).rejects.toThrow(/Grupul are deja/);
  await expect(as("guest", "select plan_state_v2($1)", [p])).rejects.toThrow(/acces/);
  expect((await q("select private.plan_access($1,$2,true) allowed", [p,U.guest])).rows[0].allowed).toBe(false);
  expect((await q("select people from visits where id=$1", [visit.id])).rows[0].people).toBe(2);
});
it("requires the exact non-null count version and refuses responses without a count case", async () => {
  const { visit } = await arrived("versioned-count");
  await expect(as("owner", "select visit_count_answer_v2($1,null,true)", [visit.id])).rejects.toThrow(/actuală/);
  const version = await value("biz", "select biz_close_v2($1,1,1,0,100,0,'A venit o persoană')", [visit.id]);
  for (const invalid of [null,version-1,version+1]) {
    await expect(as("owner", "select visit_count_answer_v2($1,$2,true)", [visit.id,invalid])).rejects.toThrow(/actuală/);
  }
  expect((await q("select state from private.visit_counts where visit_id=$1", [visit.id])).rows[0].state).toBe('awaiting');
  await as("owner", "select visit_count_answer_v2($1,$2,true)", [visit.id,version]);
  await expect(as("owner", "select visit_count_answer_v2($1,$2,true)", [visit.id,version])).rejects.toThrow(/actuală/);
});
it("uses null-safe optimistic versions for both admin dispute decisions", async () => {
  const { visit } = await arrived("admin-version");
  await q("insert into staff(user_id,role) values($1,'fondator') on conflict do nothing", [U.other]);
  const version = await value("biz", "select biz_close_v2($1,1,1,0,100,0,'A venit o persoană')", [visit.id]);
  await q("insert into private.benefit_cases(visit_id,reason,reporter) values($1,'Reducere refuzată',$2)", [visit.id,U.owner]);
  await expect(as("other", "select admin_count_resolve_v2($1,null,1,1,0,'Confirmat din dovezi')", [visit.id])).rejects.toThrow(/versiune/);
  await expect(as("other", "select admin_benefit_decide_v2($1,null,false,'Confirmat din dovezi')", [visit.id])).rejects.toThrow(/Versiune/);
  await as("other", "select admin_count_resolve_v2($1,$2,1,1,0,'Confirmat din dovezi')", [visit.id,version]);
  await as("other", "select admin_benefit_decide_v2($1,1,false,'Confirmat din dovezi')", [visit.id]);
  expect((await q("select count(*)::int n from private.review_log where visit_id=$1", [visit.id])).rows[0].n).toBe(2);
});
it("blocks vote conversion while V2 writes are paused", async () => {
  const vote = await closedVote();
  await q("update private.v2_release set writes_on=false");
  try { await expect(as("owner", "select plan_from_vote($1)", [vote])).rejects.toThrow(/mentenanță/); }
  finally { await q("update private.v2_release set writes_on=true"); }
});
it("revalidates hidden, paused and required-reservations-off winners at vote conversion", async () => {
  for (const [on,mode,paused] of [[false,'required',false],[true,'recommended',true]] as const) {
    const vote = await closedVote();
    await q("update partners set reservations_on=$1,reservation_mode=$2,venue_paused=$3 where venue_id='v'", [on,mode,paused]);
    try { await expect(as("owner", "select plan_from_vote($1)", [vote])).rejects.toThrow(/disponibil/); }
    finally { await q("update partners set reservations_on=true,reservation_mode='recommended',venue_paused=false where venue_id='v'"); }
  }
  const vote = await closedVote();
  await q("update venues set status='hidden' where id='v'");
  try { await expect(as("owner", "select plan_from_vote($1)", [vote])).rejects.toThrow(/disponibil/); }
  finally { await q("update venues set status='on' where id='v'"); }
});
it("rejects past, far-future and unknown-venue vote plans", async () => {
  for (const stamp of ['2000-01-01T12:00:00Z','2100-01-01T12:00:00Z']) {
    const vote = await closedVote({starts_at:stamp});
    await expect(as("owner", "select plan_from_vote($1)", [vote])).rejects.toThrow(/Data planului/);
  }
  const vote = await closedVote({},'unknown');
  await expect(as("owner", "select plan_from_vote($1)", [vote])).rejects.toThrow(/disponibil/);
});
it("keeps completed vote plans readable after hiding and separates voting from attendance", async () => {
  const vote = await closedVote();
  const p = await value("owner", "select plan_from_vote($1)", [vote]);
  const attendance = await value("owner", "select plan_attendance($1)", [p]);
  expect(attendance).toMatchObject({people:2,ready:false,guests:0});
  expect(attendance.deadline).not.toBeNull();
  await q("update partners set venue_paused=true where venue_id='v'");
  try { expect(await value("guest", "select plan_from_vote($1)", [vote])).toBe(p); }
  finally { await q("update partners set venue_paused=false where venue_id='v'"); }
  await expect(as("scanner", "select plan_from_vote($1)", [vote])).rejects.toThrow(/votul/);
  await as("guest", "select plan_answer_v2($1,'vin')", [p]);
  expect((await value("owner", "select plan_attendance($1)", [p])).people).toBe(2);
});
it("returns the persisted Plus base and schedule even while today's effective percentage is zero", async () => {
  const schedule = [{day:1,from:'18:00',to:'22:00',pct:20}];
  await q("insert into private.plus_versions(venue_id,effective_date,pct,schedule) values('v',(now() at time zone 'Europe/Bucharest')::date,15,$1)", [JSON.stringify(schedule)]);
  await q("insert into private.plus_off_days(venue_id,day) values('v',(now() at time zone 'Europe/Bucharest')::date)");
  const program = (await value("biz", "select biz_dashboard_v2('v')")).plus_program;
  expect(program).toMatchObject({base_pct:15,current_schedule:schedule,current_pct:0,today_off:true});
  expect((await value("scanner", "select biz_dashboard_v2('v')")).plus_program).toBeNull();
  await q("update private.plus_versions set pct=null where venue_id='v'");
  expect((await value("biz", "select biz_dashboard_v2('v')")).plus_program.base_pct).toBeNull();
});
