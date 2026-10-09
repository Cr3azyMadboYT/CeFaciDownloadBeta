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
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${U[u]}',false);set role authenticated`,
  );
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
let shared: string;
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
  for (const f of fs.readdirSync("supabase/migrations").sort())
    await db.exec(fs.readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec("grant usage on schema public to anon,authenticated");
  for (const [name, id] of Object.entries(U)) {
    await q("insert into auth.users values($1,now()-interval '30 days')", [id]);
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
it("has explicit grants, RLS and a public whitelist", async () => {
  expect(
    (
      await q(
        "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind='r' and not relrowsecurity",
      )
    ).rows,
  ).toEqual([]);
  await db.exec("set role anon");
  try {
    const c = (await q("select partner_catalog() c")).rows[0].c;
    expect(c[0].cui).toBeUndefined();
    await expect(
      q("select plan_attendance(gen_random_uuid())"),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.exec("reset role");
  }
});
it("shares one idempotent group and waits for attendance, distinct from votes", async () => {
  shared = await value(
    "owner",
    "select plan_share_v2('shared','v',now()+interval '2 hours',6,$1,null,4)",
    [[U.guest]],
  );
  expect(
    await value(
      "owner",
      "select plan_share_v2('shared','v',now()+interval '2 hours',6,$1,null,4)",
      [[U.guest]],
    ),
  ).toBe(shared);
  await expect(
    as("owner", "select reservation_request_v2($1,'shared-r')", [shared]),
  ).rejects.toThrow(/30 de minute/);
  expect(
    (await value("guest", "select plan_attendance($1)", [shared])).ready,
  ).toBe(false);
  expect(
    await value("guest", "select plan_answer_v2($1,'vin')", [shared]),
  ).toBe(6);
  expect(
    (await value("guest", "select plan_attendance($1)", [shared])).people,
  ).toBe(6);
  await expect(
    as("guest", "select reservation_request_v2($1,'wrong')", [shared]),
  ).rejects.toThrow(/organizatorul/);
});
it("times out missing guests without no-show and protects direct editing", async () => {
  const p = await value(
    "owner",
    "select plan_share_v2('timeout','v',now()+interval '1 day',2,$1)",
    [[U.guest]],
  );
  await q(
    "update plans set attendance_deadline=now()-interval '1 minute' where id=$1",
    [p],
  );
  expect((await value("owner", "select plan_attendance($1)", [p])).people).toBe(
    1,
  );
  expect(
    (await q("select answer from plan_members where plan_id=$1", [p])).rows[0]
      .answer,
  ).toBe("timed_out");
  await expect(
    as("guest", "select plan_answer_v2($1,'vin')", [p]),
  ).rejects.toThrow(/închis/);
  await expect(
    as("owner", "update plans set people=500 where id=$1", [p]),
  ).rejects.toThrow(/permission denied/);
});
it("reserves once and serializes the last available capacity", async () => {
  const r = await value("owner", "select reservation_request_v2($1,'r-key')", [
    shared,
  ]);
  expect(r.people).toBe(6);
  expect(r.status).toBe("confirmată");
  expect(
    (
      await value("owner", "select reservation_request_v2($1,'r-key')", [
        shared,
      ])
    ).id,
  ).toBe(r.id);
  const p = await plan("capacity", 5);
  await expect(
    as("owner", "select reservation_request_v2($1,'other-key')", [p]),
  ).rejects.toThrow(/locuri/);
  await value("owner", "select plan_cancel_v2($1)", [shared]);
  expect(
    (await q("select status from reservations where id=$1", [r.id])).rows[0]
      .status,
  ).toBe("anulată");
});
it("groups of eight wait for manual confirmation, and expired proposals release capacity", async () => {
  // A fixed future local noon keeps this capacity test independent of the time of the test run.
  const p = await value("owner", "select plan_share_v2('big','v',(((now() at time zone 'Europe/Bucharest')::date+1)+time '12:00') at time zone 'Europe/Bucharest',8)");
  const r = await value(
    "owner",
    "select reservation_request_v2($1,'big-key')",
    [p],
  );
  expect(r.status).toBe("cerută");
  const proposedAt = (await q("select starts_at+interval '3 hours' proposed_at from plans where id=$1", [p])).rows[0].proposed_at;
  await as(
    "biz",
    "select reservation_decide_v2($1,'propose',$2)",
    [r.id, proposedAt],
  );
  expect(
    (await q("select status from reservations where id=$1", [r.id])).rows[0]
      .status,
  ).toBe("propusă");
  await q(
    "update reservations set proposal_expires_at=now()-interval '1 minute' where id=$1",
    [r.id],
  );
  await expect(
    as("owner", "select reservation_proposal_answer($1,true)", [r.id]),
  ).rejects.toThrow(/expirat/);
  const next = await value(
    "owner",
    "select reservation_request_v2($1,'big-new')",
    [p],
  );
  expect(next.id).not.toBe(r.id);
  await as("owner", "select plan_cancel_v2($1)", [p]);
});
it("keeps public discovery separate from history and reservation settings", async () => {
  await q(
    "update partners set reservation_mode='required',reservations_on=false where venue_id='v'",
  );
  expect(
    (await value("owner", "select partner_catalog()")).find(
      (p: any) => p.venue_id === "v",
    ).discoverable,
  ).toBe(false);
  expect(
    await value("owner", "select plan_state_v2($1)", [shared]),
  ).toHaveProperty("reservation");
  await q(
    "update partners set reservation_mode='recommended' where venue_id='v'",
  );
  expect(
    (await value("owner", "select partner_catalog()")).find(
      (p: any) => p.venue_id === "v",
    ).discoverable,
  ).toBe(true);
  await q("update partners set reservations_on=true where venue_id='v'");
});
it("free immediate Drops wait ten minutes; invitation Plus covers the group", async () => {
  const p = await value(
    "owner",
    "select plan_share_v2('plus-guest','v',now()+interval '20 minutes',6,$1,null,4)",
    [[U.guest]],
  );
  await as("guest", "select plan_answer_v2($1,'vin')", [p]);
  const d = await value(
    "biz",
    "select drop_create_v2('v','Desert pentru grup',10,20,4,120,1)",
  );
  expect(await value("owner", "select drop_feed_v2($1)", [p])).toEqual([]);
  await expect(
    as("owner", "select drop_claim_v2($1,$2,4,44.45,26.1,'first')", [d.id, p]),
  ).rejects.toThrow(/început/);
  await db.exec("select set_config('cefaci.plus','on',false)");
  await q(
    "update profile_private set plus_until=now()+interval '1 day' where id=$1",
    [U.guest],
  );
  await db.exec("select set_config('cefaci.plus','off',false)");
  expect((await value("owner", "select drop_feed_v2($1)", [p]))[0].pct).toBe(
    20,
  );
  const c = await value(
    "owner",
    "select drop_claim_v2($1,$2,4,44.45,26.1,'first')",
    [d.id, p],
  );
  expect(c.plus_at_claim).toBe(true);
  await expect(
    as(
      "owner",
      "select visit_client_arrive_v2($1,'venue-token-v',44.43,26.1)",
      [p],
    ),
  ).rejects.toThrow(/10 minute/);
  await q(
    "update drop_claims set created_at=now()-interval '11 minutes' where id=$1",
    [c.id],
  );
  const r = await value(
    "owner",
    "select reservation_request_v2($1,'mixed-r')",
    [p],
  );
  expect(r.status).toBe("confirmată");
  await as("biz", "select drop_stop($1)", [d.id]);
  const v = await value(
    "owner",
    "select visit_client_arrive_v2($1,'venue-token-v',44.43,26.1)",
    [p],
  );
  expect(v.discount_pct).toBe(20);
  expect(v.discount_scope).toBe("bill");
  expect(v.people).toBe(6);
  expect(
    (
      await value(
        "guest",
        "select visit_client_arrive_v2($1,'venue-token-v',44.43,26.1)",
        [p],
      )
    ).id,
  ).toBe(v.id);
  const ticket = await value("guest", "select plan_ticket_v2($1)", [p]);
  await expect(
    as("biz", "select biz_scan_v2('w',$1)", [ticket.token]),
  ).rejects.toThrow(/echipa/);
  const scanned = await value("biz", "select biz_scan_v2('v',$1)", [
    ticket.token,
  ]);
  expect(scanned.visit).toBe(v.id);
  await as("biz", "select biz_close_v2($1,6,6,4,200,50)", [v.id]);
  const finance = await value(
    "biz",
    "select biz_finance_v2('v',current_date-1,current_date+1)",
  );
  expect(finance.fee).toBe(38);
  expect(finance.revenue).toBe(200);
  expect(finance.remaining).toBe(162);
  expect(finance.billing_ready).toBe(false);
  await as("owner", "select plan_cancel_v2($1)", [p]);
  expect(
    (await q("select count(*) n from visits where id=$1", [v.id])).rows[0].n,
  ).toBe(1);
});
it("validates minimum, GPS, stock and legacy bypasses", async () => {
  await expect(
    as("biz", "select drop_create_v2('v','Oferta',10,20,4,60,8)"),
  ).rejects.toThrow(/1–6/);
  for (const sql of [
    "select drop_claim(gen_random_uuid(),1)",
    "select reservation_request('v',now()+interval '1 day',2)",
    "select visit_scan('venue-token-v',44.43,26.1)",
    "select biz_settings_save('v',true,6,15)",
    "select drop_create('v','Desert',10,20,4,60)",
  ]) {
    await expect(as("owner", sql)).rejects.toThrow(/Actualizează/);
  }
});
it("keeps receipt canonical and versioned count disputes blocked", async () => {
  const row = (
    await q("select id from visits where plan_id is not null limit 1")
  ).rows[0];
  const id = row.id;
  await as(
    "biz",
    "select biz_close_v2($1,4,4,3,100,20,'Au venit mai puțini')",
    [id],
  );
  const state = (
    await q("select * from private.visit_counts where visit_id=$1", [id])
  ).rows[0];
  expect(state.state).toBe("awaiting");
  expect(
    (
      await value(
        "biz",
        "select biz_finance_v2('v',current_date-1,current_date+1)",
      )
    ).remaining,
  ).toBeNull();
  await expect(
    as("owner", "select visit_count_answer_v2($1,$2,true)", [
      id,
      state.version - 1,
    ]),
  ).rejects.toThrow(/actuală/);
  // Cancelled plan remains a participant-authorized historical visit.
  await as("owner", "select visit_count_answer_v2($1,$2,false)", [
    id,
    state.version,
  ]);
  expect(
    (await q("select state from private.visit_counts where visit_id=$1", [id]))
      .rows[0].state,
  ).toBe("disputed");
});
it("uses the source financial day through 05:00 and DST", async () => {
  for (const [stamp, day] of [
    ["2026-10-25T02:50:00+03:00", "2026-10-24"],
    ["2026-10-25T04:50:00+02:00", "2026-10-24"],
    ["2026-10-25T05:00:00+02:00", "2026-10-25"],
    ["2027-03-28T04:50:00+03:00", "2027-03-27"],
  ])
    expect(
      (await q("select private.work_day($1::timestamptz)::text d", [stamp]))
        .rows[0].d,
    ).toBe(day);
});
it("roles limit financial data and revocation applies to a still-valid auth session", async () => {
  const data = await value("scanner", "select biz_dashboard_v2('v')");
  expect(data.requests).toEqual([]);
  expect(data.visits[0].bill).toBeNull();
  expect(data.partner.cui).toBeUndefined();
  await expect(
    as("scanner", "select biz_finance_v2('v',current_date,current_date)"),
  ).rejects.toThrow(/Nu ai voie/);
  await q("update partner_members set active=false where user_id=$1", [
    U.scanner,
  ]);
  await expect(as("scanner", "select biz_dashboard_v2('v')")).rejects.toThrow(
    /echipa/,
  );
});
it("saves a participant receipt without XP and keeps both receipt amounts canonical", async () => {
  const v = (await q("select id,scanned_at from visits limit 1")).rows[0];
  await db.exec(
    "grant usage on schema public to service_role;select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false);set role service_role",
  );
  try {
    const ready = (
      await q("select visit_receipt_ready_v2($1,$2) r", [U.guest, v.id])
    ).rows[0].r;
    expect(ready.ok).toBe(true);
    const local = (
      await q(
        "select (scanned_at at time zone 'Europe/Bucharest')::date d,(scanned_at at time zone 'Europe/Bucharest')::time t from visits where id=$1",
        [v.id],
      )
    ).rows[0];
    await expect(
      q("select visit_receipt_v2($1,$2,$3,240,60,$4,$5)", [
        U.other,
        v.id,
        "1234567",
        local.d,
        local.t,
      ]),
    ).rejects.toThrow(/participi/);
    await expect(
      q("select visit_receipt_v2($1,$2,$3,240,60,$4,$5)", [
        U.guest,
        v.id,
        "7654321",
        local.d,
        local.t,
      ]),
    ).rejects.toThrow(/firma/);
    await expect(
      q(
        "select visit_receipt_v2($1,$2,'1234567',240,60,current_date-3,'10:00')",
        [U.guest, v.id],
      ),
    ).rejects.toThrow(/Ora/);
    expect(
      (
        await q("select visit_receipt_v2($1,$2,$3,240,60,$4,$5) r", [
          U.guest,
          v.id,
          "1234567",
          local.d,
          local.t,
        ])
      ).rows[0].r.ok,
    ).toBe(true);
    await expect(
      q("select visit_receipt_v2($1,$2,$3,240,60,$4,$5)", [
        U.owner,
        v.id,
        "1234567",
        local.d,
        local.t,
      ]),
    ).rejects.toThrow(/deja/);
  } finally {
    await db.exec(
      "reset role;select set_config('request.jwt.claims','',false)",
    );
  }
  await as(
    "biz",
    "select biz_close_v2($1,6,6,4,99,1,'Corecție după bonul grupului')",
    [v.id],
  );
  const cnt = (
    await q("select version from private.visit_counts where visit_id=$1", [
      v.id,
    ])
  ).rows[0];
  await as("guest", "select visit_count_answer_v2($1,$2,true)", [
    v.id,
    cnt.version,
  ]);
  const saved = (
    await q("select bill,discount_amount,proof from visits where id=$1", [v.id])
  ).rows[0];
  expect(saved).toMatchObject({
    bill: "240.00",
    discount_amount: "60.00",
    proof: "receipt",
  });
  for (const sql of [
    "select visit_close($1,false,0)",
    "select biz_visit_attendance($1,0,0)",
  ])
    await expect(as("biz", sql, [v.id])).rejects.toThrow(/Actualizează/);
});
it("prices V2 tiers, founders, free contracts, mixed children and the ten-person cap from frozen terms", async () => {
  for (const tier of [1, 2, 3])
    for (const founder of [false, true])
      for (const free of [false, true]) {
        const venue = `fee-${tier}-${founder}-${free}`;
        await q(
          "insert into venues(id,name,cat,lat,lon,data) values($1,$1,'mancare',44.43,26.1,'{}')",
          [venue],
        );
        await q(
          "insert into partners(venue_id,firm,cui,rate,activated_at,free_until,price_tier,founder) values($1,'Test','1234567',.1,current_date-60,current_date+case when $4 then 30 else -30 end,$2,$3)",
          [venue, tier, founder, free],
        );
        await q(
          "insert into partner_members(venue_id,user_id,role) values($1,$2,'proprietar')",
          [venue, U.biz],
        );
        const p = await value("owner", "select plan_share_v2($1,$2,now(),12)", [
          venue,
          venue,
        ]);
        const res = (
          await q(
            "insert into reservations(venue_id,user_id,plan_id,people,kids,at,status) values($1,$2,$3,12,2,now(),'confirmată') returning id",
            [venue, U.owner, p],
          )
        ).rows[0].id;
        const d = (
          await q(
            "insert into drops(venue_id,title,pct_all,pct_plus,seats,min_group,starts_at,ends_at) values($1,'Desert',10,20,12,1,now(),now()+interval '2 hours') returning id",
            [venue],
          )
        ).rows[0].id;
        const claim = (
          await q(
            "insert into drop_claims(drop_id,user_id,plan_id,seats,status,expires_at) values($1,$2,$3,4,'folosit',now()+interval '1 hour') returning id",
            [d, U.owner, p],
          )
        ).rows[0].id;
        const visit = (
          await q(
            "insert into visits(venue_id,user_id,plan_id,kind,reservation_id,claim_id,people,discount_pct,work_day) values($1,$2,$3,'drop',$4,$5,12,20,private.work_day(now())) returning id",
            [venue, U.owner, p, res, claim],
          )
        ).rows[0].id;
        await as("biz", "select biz_close_v2($1,12,10,4,300,75)", [visit]);
        // Contract changes must never reprice a past visit.
        await q(
          "update partners set price_tier=null,founder=not founder,free_until=current_date-100 where venue_id=$1",
          [venue],
        );
        const unitR = [0, 2, 5, 8][tier] - (founder ? 1 : 0),
          unitD = [0, 3, 7, 10][tier] - (founder ? 1 : 0),
          expected = 4 * unitD + 6 * unitR;
        const finance = await value(
          "biz",
          "select biz_finance_v2($1,current_date-1,current_date+1)",
          [venue],
        );
        expect(Number(finance.fee)).toBe(free ? 0 : expected);
        expect(Number(finance.would_pay)).toBe(free ? expected : 0);
        expect(finance.remaining).toBe(300 - (free ? 0 : expected));
      }
});
it("allows zero commission revenue from distinct same-day plans and detects a repeated fiscal receipt globally", async () => {
  await q("update partners set capacity=20 where venue_id='v'");
  const p = await plan("second-same-day", 3, 10);
  const first = (await q("select id from visits where venue_id='v' limit 1"))
    .rows[0].id;
  const v = await value(
    "owner",
    "select visit_client_arrive_v2($1,'venue-token-v',44.43,26.1)",
    [p],
  );
  expect(v.id).not.toBe(first);
  expect(v.kind).toBe("plan");
  await as("biz", "select biz_close_v2($1,3,3,0,100,0)", [v.id]);
  expect(
    (
      await q(
        "select * from private.visit_fees('v',current_date-1,current_date+1) where visit_id=$1",
        [v.id],
      )
    ).rows,
  ).toEqual([]);
  const old = (
    await q(
      "select (issued_at at time zone 'Europe/Bucharest')::date d,(issued_at at time zone 'Europe/Bucharest')::time t from receipts where visit_id=$1",
      [first],
    )
  ).rows[0];
  await expect(
    q("select visit_receipt_v2($1,$2,'1234567',240,60,$3,$4)", [
      U.owner,
      v.id,
      old.d,
      old.t,
    ]),
  ).rejects.toThrow(/deja folosit/);
});
it("enforces Plus tomorrow, off-day idempotence and no retroactive visit discounts", async () => {
  const prev = (await q("select discount_pct from visits limit 1")).rows[0]
    .discount_pct;
  await as(
    "biz",
    'select biz_plus_v2(\'v\',15,\'[{"day":4,"from":"10:00","to":"12:00","pct":20}]\')',
  );
  const row = (
    await q(
      "select effective_date::text as outing_day from private.plus_versions where venue_id='v'",
    )
  ).rows[0];
  expect(row.outing_day).toBe(
    (
      await q(
        "select ((now() at time zone 'Europe/Bucharest')::date+1)::text as outing_day",
      )
    ).rows[0].outing_day,
  );
  expect(
    (await q("select discount_pct from visits limit 1")).rows[0].discount_pct,
  ).toBe(prev);
  await expect(as("biz", "select biz_plus_v2('v',12)")).rejects.toThrow();
  const hour = Number(
    (
      await q(
        "select extract(hour from now() at time zone 'Europe/Bucharest') h",
      )
    ).rows[0].h,
  );
  if (hour < 16) {
    await as("biz", "select biz_plus_off_today('v')");
    await as("biz", "select biz_plus_off_today('v')");
    expect(
      (
        await q(
          "select count(*) n from private.plus_off_days where venue_id='v'",
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (await q("select private.plus_pct_at('v',now()) pct")).rows[0].pct,
    ).toBe(0);
  } else
    await expect(as("biz", "select biz_plus_off_today('v')")).rejects.toThrow(
      /16/,
    );
});
it("blocks new plans in hidden partners while preserving the historical identities", async () => {
  await q(
    "update partners set reservation_mode='required',reservations_on=false where venue_id='v'",
  );
  await expect(plan("hidden")).rejects.toThrow(/disponibil/);
  expect(
    await value("owner", "select plan_state_v2($1)", [shared]),
  ).toHaveProperty("reservation");
  await q(
    "update partners set reservation_mode='recommended',reservations_on=true where venue_id='v'",
  );
});
it("keeps refused discounts separate from eligibility, audits resolution and applies compensation once per group", async () => {
  const v = (
    await q("select id from visits where venue_id='v' and kind='drop' limit 1")
  ).rows[0].id;
  await q("insert into staff(user_id,role) values($1,'fondator')", [U.other]);
  await as(
    "owner",
    "select visit_benefit_report_v2($1,'Reducerea eligibilă a fost refuzată')",
    [v],
  );
  const expiry = (
    await q("select plus_until from profile_private where id=$1", [U.owner])
  ).rows[0].plus_until;
  await as(
    "guest",
    "select visit_benefit_report_v2($1,'Aceeași masă, aceeași sesizare')",
    [v],
  );
  expect(
    (await q("select plus_until from profile_private where id=$1", [U.owner]))
      .rows[0].plus_until,
  ).toEqual(expiry);
  expect(
    (
      await value(
        "biz",
        "select biz_finance_v2('v',current_date-1,current_date+1)",
      )
    ).remaining,
  ).toBeNull();
  await as(
    "biz",
    "select biz_benefit_reply_v2($1,'Am verificat situația de la masă')",
    [v],
  );
  await expect(
    as("biz", "select admin_benefit_decide_v2($1,1,true,'Probe verificate')", [
      v,
    ]),
  ).rejects.toThrow(/echipa/);
  await as(
    "other",
    "select admin_benefit_decide_v2($1,1,true,'Probe verificate: client eligibil')",
    [v],
  );
  expect(
    (
      await q(
        "select drop_adults from private.visit_counts where visit_id=$1",
        [v],
      )
    ).rows[0].drop_adults,
  ).toBe(4);
  expect(
    (
      await q(
        "select fee from private.visit_fees('v',current_date-1,current_date+1) where visit_id=$1",
        [v],
      )
    ).rows[0].fee,
  ).toBe("38");
  expect(
    (
      await q("select count(*) n from private.review_log where visit_id=$1", [
        v,
      ])
    ).rows[0].n,
  ).toBe(1);
  await expect(
    as(
      "other",
      "select admin_benefit_decide_v2($1,1,true,'Probe verificate')",
      [v],
    ),
  ).rejects.toThrow(/Versiune/);
});
it("idempotently creates and edits scheduled Drops while protecting claimed offers", async () => {
  await q(
    "insert into partner_members(venue_id,user_id,role) values('w',$1,'proprietar')",
    [U.biz],
  );
  const d = await value(
    "biz",
    "select drop_create_v2('w','Desert',10,20,8,120,2,now()+interval '1 day',false,false,'create-once')",
  );
  expect(
    (
      await value(
        "biz",
        "select drop_create_v2('w','Desert',10,20,8,120,2,now()+interval '1 day',false,false,'create-once')",
      )
    ).id,
  ).toBe(d.id);
  const edit = await value(
    "biz",
    "select drop_create_v2('w','Desert nou',10,25,10,120,2,now()+interval '1 day',false,false,null,$1)",
    [d.id],
  );
  expect(edit.id).toBe(d.id);
  expect(edit.title).toBe("Desert nou");
  const used = (await q("select id from drops where venue_id='v' limit 1"))
    .rows[0].id;
  await expect(
    as(
      "biz",
      "select drop_create_v2('v','Altceva',10,20,8,120,1,now()+interval '1 day',false,false,null,$1)",
      [used],
    ),
  ).rejects.toThrow(/oferte viitoare/);
});
it("supports overnight reservation and Plus intervals on the local calendar", async () => {
  await q(
    'update partners set reservation_hours=\'[{"day":6,"from":"22:00","to":"04:00"}]\',capacity=20 where venue_id=\'w\'',
  );
  expect(
    (
      await q(
        "select private.capacity_ok('w','2026-10-25T02:00:00+03:00',6,120) ok",
      )
    ).rows[0].ok,
  ).toBe(true);
  expect(
    (
      await q(
        "select private.capacity_ok('w','2026-10-25T03:30:00+02:00',6,120) ok",
      )
    ).rows[0].ok,
  ).toBe(false);
  await q(
    'insert into private.plus_versions(venue_id,effective_date,pct,schedule) values(\'w\',\'2026-10-24\',10,\'[{"day":6,"from":"22:00","to":"04:00","pct":20}]\')',
  );
  expect(
    (await q("select private.plus_pct_at('w','2026-10-25T03:30:00+02:00') pct"))
      .rows[0].pct,
  ).toBe(20);
});
it("pauses operations reversibly without losing read-only history", async () => {
  await q("update private.v2_release set writes_on=false");
  await expect(plan("pause")).rejects.toThrow(/mentenanță/);
  expect(
    await value("owner", "select plan_state_v2($1)", [shared]),
  ).toHaveProperty("visit");
  await q("update private.v2_release set writes_on=true");
});
it("requires explicit eligibility for anonymous guests, including declared unshared groups", async () => {
  const p = await value(
    "owner",
    "select plan_share_v2('guest-age-check','w',now()+interval '30 minutes',2)",
  );
  expect((await value("owner", "select plan_attendance($1)", [p])).guests).toBe(
    1,
  );
  const d = await value(
    "biz",
    "select drop_create_v2('w','Coctail',10,20,4,60,1,now()+interval '5 days',false,false,'age-drop')",
  );
  expect(d.adult).toBe(true);
  await q(
    "update drops set starts_at=now()-interval '11 minutes',ends_at=now()+interval '1 hour',immediate=true where id=$1",
    [d.id],
  );
  await expect(
    as("owner", "select drop_claim_v2($1,$2,2,44.45,26.1,'age-claim')", [
      d.id,
      p,
    ]),
  ).rejects.toThrow(/18 ani/);
  await as("owner", "select plan_guest_ages_v2($1,ARRAY[17])", [p]);
  await expect(
    as("owner", "select drop_claim_v2($1,$2,2,44.45,26.1,'age-claim')", [
      d.id,
      p,
    ]),
  ).rejects.toThrow(/18 ani/);
  await as("owner", "select plan_guest_ages_v2($1,ARRAY[25])", [p]);
  await q("update drops set new_only=true where id=$1", [d.id]);
  await expect(
    as("owner", "select drop_claim_v2($1,$2,2,44.45,26.1,'age-claim')", [
      d.id,
      p,
    ]),
  ).rejects.toThrow(/grupuri noi/);
  await q("update drops set new_only=false where id=$1", [d.id]);
  expect(
    (
      await value(
        "owner",
        "select drop_claim_v2($1,$2,2,44.45,26.1,'age-claim')",
        [d.id, p],
      )
    ).seats,
  ).toBe(2);
  await expect(
    as("owner", "select plan_guest_ages_v2($1,ARRAY[30])", [p]),
  ).rejects.toThrow(/deja salvată/);
});
it("preserves financial visits and snapshots when a participant deletes their account", async () => {
  const before = (await q("select count(*) n from visits")).rows[0].n;
  const prices = (await q("select count(*) n from private.visit_pricing"))
    .rows[0].n;
  await q("delete from auth.users where id=$1", [U.owner]);
  expect((await q("select count(*) n from visits")).rows[0].n).toBe(before);
  expect(
    (await q("select count(*) n from private.visit_pricing")).rows[0].n,
  ).toBe(prices);
  expect(
    (await q("select count(*) n from visits where venue_id='v'")).rows[0].n,
  ).toBe(2);
  const ids=(await q("select id from visits where venue_id='v'")).rows.map(r=>r.id);
  for(const id of ids){
    await expect(as('biz','select visit_close($1,true,100)',[id])).rejects.toThrow(/Actualizează/);
    await expect(as('biz','select biz_visit_attendance($1,1,1)',[id])).rejects.toThrow(/Actualizează/);
  }
});
