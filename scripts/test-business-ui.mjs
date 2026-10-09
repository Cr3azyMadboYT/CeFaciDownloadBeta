// Synthetic browser fixtures exist only in this test; all Supabase traffic is intercepted.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
const root = process.env.CEFACI_TEST_WEB_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
fs.mkdirSync("release/screenshots", { recursive: true });
const when = new Date().toISOString();
const base = {
  role: "proprietar",
  day: "2026-10-08",
  word: "Bilu",
  token: "synthetic-local-code",
  partner: { firm: "Local de test", cui: "1234567" },
  settings: {
    mode: "recommended",
    on: true,
    paused: false,
    capacity: 20,
    duration: 120,
    auto: 6,
    hours: [],
  },
  requests: [
    {
      id: "r",
      name: "Grup de test",
      people: 8,
      kids: 0,
      at: when,
      status: "cerută",
      response_due_at: when,
      note: "Scenariu de test",
    },
  ],
  visits: [
    {
      id: "v",
      name: "Grup de test",
      people: 6,
      kind: "drop",
      at: when,
      day: "2026-10-08",
      discount: 20,
      scope: "bill",
      discount_people: 6,
      plus: true,
      outcome: "deschis",
      bill: null,
      source: null,
      closed_at: null,
      drop_limit: 4,
      reservation_limit: 6,
    },
  ],
  drops: [],
  statistics: { visits: 1, people: 6, unclosed: 1, reservations: 1 },
  plus_program: {
    current_pct: 0,
    base_pct: 20,
    current_schedule: [
      { day: 1, from: "10:00", to: "12:00", pct: 10 },
      { day: 1, from: "17:00", to: "22:00", pct: 15 },
    ],
    today_off: false,
    off_days_this_month: 0,
    next: null,
  },
};
const finance = {
  billing_ready: false,
  partial: false,
  missing: 0,
  blocked: 0,
  revenue: 200,
  discounts: 50,
  fee: 38,
  remaining: 162,
  would_pay: 0,
  visits: 1,
  lines: [],
};
let calls = [],
  late = false;
let firstFinance = true, financeRemaining = 162, teamFailure = false, accessFailure = false;
async function ctx(viewport, auth = false) {
  const context = await browser.newContext({ viewport });
  await context.routeWebSocket(/supabase\.co/, (ws) => ws.close());
  await context.route(/supabase\.co/, async (route) => {
    const req = route.request();
    let data, status = 200;
    const name = new URL(req.url()).pathname.split("/").pop();
    let p = {};
    try {
      p = req.postDataJSON() ?? {};
    } catch {}
    calls.push({ name, p });
    if (name === "biz_my_venues" && accessFailure) {
      status = 503; data = {message: "Acces temporar indisponibil"};
    } else if (name === "biz_my_venues")
      data = [
        {
          venue_id: "one",
          name: "Local de test",
          role: "proprietar",
          status: "activ",
        },
        {
          venue_id: "two",
          name: "Al doilea local",
          role: "scanare",
          status: "activ",
        },
      ];
    else if (name === "biz_dashboard_v2") {
      if (late && p.p_venue === "one")
        await new Promise((r) => setTimeout(r, 1200));
      data =
        p.p_venue === "two"
          ? {
              ...base,
              role: "scanare",
              requests: [],
              partner: {},
              token: null,
              plus_program: null,
            }
          : base;
    } else if (name === "biz_finance_v2") {
      const outdated = firstFinance;
      firstFinance = false;
      if (outdated) await new Promise((r) => setTimeout(r, 1200));
      data = { ...finance, remaining: outdated ? 999 : financeRemaining };
    }
    else if (name === "biz_team") {
      status = teamFailure ? 503 : 200;
      data = teamFailure ? {message: "Echipa este temporar indisponibilă"} : [];
    }
    else if (name === "biz_scan_v2" && p.p_ticket === "invalid-ticket") {
      status = 400; data = {message: "Biletul este invalid sau expirat"};
    }
    else if (name === "biz_scan_v2")
      data = {
        visit: "v",
        name: "Grup de test",
        people: 6,
        discount: 20,
        scope: "bill",
        discount_people: 6,
        plus: true,
        word: "Bilu",
      };
    else data = null;
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      body: JSON.stringify(data),
    });
  });
  if (auth)
    await context.addInitScript(
      ({ when }) => {
        const user = {
          id: "00000000-0000-0000-0000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          email: "test@example.invalid",
          app_metadata: {},
          user_metadata: {},
          created_at: when,
        };
        const token =
          "eyJhbGciOiJIUzI1NiJ9." +
          btoa(
            JSON.stringify({
              sub: user.id,
              exp: Math.floor(Date.now() / 1000) + 3600,
              iat: Math.floor(Date.now() / 1000),
              role: "authenticated",
            }),
          ) +
          ".test";
        localStorage.setItem(
          "cefaci-business-auth",
          JSON.stringify({
            access_token: token,
            refresh_token: "synthetic",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        );
      },
      { when },
    );
  return context;
}
try {
  const login = await ctx({ width: 1440, height: 960 });
  const page = await login.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root);
  await page
    .getByRole("button", { name: "Trimite codul", exact: true })
    .waitFor();
  await page.screenshot({
    path: "release/screenshots/business-login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "release/screenshots/business-login-phone.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await login.close();
  const desktop = await ctx({ width: 1440, height: 1000 }, true);
  const app = await desktop.newPage();
  app.on("pageerror", (e) => errors.push(e.message));
  await app.goto(root);
  await app.getByRole("button", { name: "Financiar", exact: true }).waitFor();
  await app.screenshot({
    path: "release/screenshots/business-today-desktop.png",
    fullPage: true,
  });
  await app.getByRole("button", { name: "Închide vizita", exact: true }).click();
  await app.getByLabel("Încasare după reduceri (lei)").fill("abc");
  await app.getByRole("button", { name: "Salvează închiderea", exact: true }).click();
  await app.getByText("Scrie o sumă validă, de exemplu 123,45 lei.", {exact:true}).waitFor();
  assert.equal(calls.filter(x=>x.name==='biz_close_v2').length,0);
  await app.getByLabel("Încasare după reduceri (lei)").fill("47,50");
  await app.getByLabel("Reducere efectivă acordată (lei)").fill("2,25");
  await app.getByRole("button", { name: "Salvează închiderea", exact: true }).click();
  await app.getByText("Vizită salvată. Un număr neconfirmat rămâne în afara facturării.",{exact:true}).waitFor();
  assert(calls.some(x=>x.name==='biz_close_v2' && x.p.p_bill===47.5 && x.p.p_discount===2.25));
  // Saving a loaded Plus program preserves its base, including a current 0% interval,
  // and every interval for the same weekday.
  await app.getByRole("button", { name: "Oferte", exact: true }).click();
  assert.equal(await app.getByLabel("Luni interval 1 de la", {exact:true}).inputValue(), "10:00");
  assert.equal(await app.getByLabel("Luni interval 2 de la", {exact:true}).inputValue(), "17:00");
  await app.getByRole("button", { name: "Salvează pentru mâine", exact: true }).click();
  await app.getByText("Programul intră în vigoare mâine, în București.", {exact:true}).waitFor();
  const savedPlus = calls.filter(x=>x.name==='biz_plus_v2').at(-1).p;
  assert.equal(savedPlus.p_pct,20);
  assert.deepEqual(savedPlus.p_schedule,base.plus_program.current_schedule);
  await app.getByLabel("Luni interval 1 până la", {exact:true}).fill("13:00");
  await app.getByRole("button", { name: "Salvează pentru mâine", exact: true }).click();
  await app.waitForTimeout(200);
  assert.equal(calls.filter(x=>x.name==='biz_plus_v2').at(-1).p.p_schedule[1].from,"17:00");
  await app.getByRole("button", { name: "Financiar", exact: true }).click();
  await app.waitForTimeout(100);
  await app.getByRole("button", { name: "Vezi financiarul", exact: true }).click();
  await app.getByText("162,00").first().waitFor();
  await app.waitForTimeout(1400);
  assert.equal(await app.getByText("999,00", { exact: false }).count(), 0);
  await app.screenshot({
    path: "release/screenshots/business-finance-desktop.png",
    fullPage: true,
  });
  const text = await app.locator("body").innerText();
  assert(
    text.indexOf("Rămas localului") < text.indexOf("Încasări și reduceri"),
  );
  assert(
    text.indexOf("Încasări și reduceri") < text.indexOf("Comision CeFaci"),
  );
  // Refresh/realtime updates finance while preserving the selected period.
  const financeCalls = calls.filter(x=>x.name==='biz_finance_v2').length;
  financeRemaining = 163;
  await app.getByRole("button", { name: "Actualizează", exact: true }).click();
  await app.getByText("163,00").first().waitFor();
  assert(calls.filter(x=>x.name==='biz_finance_v2').length>financeCalls);
  const beforeInvalidPeriod = calls.filter(x=>x.name==='biz_finance_v2').length;
  await app.getByLabel("De la (AAAA-LL-ZZ)").fill("2026-02-29");
  await app.getByRole("button", { name: "Vezi financiarul", exact: true }).click();
  await app.getByText("Alege o perioadă validă:", {exact:false}).waitFor();
  assert.equal(calls.filter(x=>x.name==='biz_finance_v2').length,beforeInvalidPeriod);
  financeRemaining = 162;
  teamFailure = true;
  await app.getByRole("button", { name: "Echipă", exact: true }).click();
  await app.getByText("Echipa este temporar indisponibilă", {exact:true}).waitFor();
  teamFailure = false;
  await app.getByRole("button", { name: "Reîncarcă echipa", exact: true }).click();
  await app.waitForTimeout(200);
  assert.equal(await app.getByText("Echipa este temporar indisponibilă", {exact:true}).count(),0);
  await app.getByRole("button", { name: "Scanner", exact: true }).click();
  await app.getByLabel("Codul biletului").fill("synthetic-ticket");
  await app
    .getByRole("button", { name: "Verifică biletul", exact: true })
    .click();
  await app.getByText("Cuvânt: Bilu.", { exact: false }).waitFor();
  assert(calls.some((x) => x.name === "biz_scan_v2" && x.p.p_venue === "one"));
  await app.getByLabel("Codul biletului").fill("invalid-ticket");
  await app.getByRole("button", { name: "Verifică biletul", exact: true }).click();
  await app.getByText("Biletul este invalid sau expirat", {exact:true}).waitFor();
  assert.equal(await app.getByText("Cuvânt: Bilu.", {exact:false}).count(),0);
  // A delayed response from the former local must not restore its owner/finance view.
  late = true;
  await app.getByRole("button", { name: "Actualizează", exact: true }).click();
  await app
    .getByRole("button", { name: "Al doilea local · scanare", exact: true })
    .click();
  await app
    .getByText("Al doilea local · scanare", { exact: true })
    .first()
    .waitFor();
  await app.waitForTimeout(1500);
  assert.equal(
    await app.getByRole("button", { name: "Financiar", exact: true }).count(),
    0,
  );
  assert.equal(
    await app.getByRole("button", { name: "Rezervări", exact: true }).count(),
    0,
  );
  await desktop.close();
  const phone = await ctx({ width: 390, height: 844 }, true);
  const mobile = await phone.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(root);
  await mobile
    .getByRole("button", { name: "Financiar", exact: true })
    .waitFor();
  await mobile.screenshot({
    path: "release/screenshots/business-today-phone.png",
    fullPage: true,
  });
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobile.getByRole("button", { name: "Financiar", exact: true }).click();
  await mobile.getByText("162,00").first().waitFor();
  await mobile.getByRole("button", { name: "Mod noapte", exact: true }).click();
  await mobile.screenshot({
    path: "release/screenshots/business-finance-phone-night.png",
    fullPage: true,
  });
  await mobile
    .getByRole("button", { name: "Ieși din cont", exact: true })
    .click();
  await mobile
    .getByRole("button", { name: "Trimite codul", exact: true })
    .waitFor();
  assert.equal(
    await mobile.getByText("Rămas localului", { exact: true }).count(),
    0,
  );
  await phone.close();
  // A rejected initial access lookup is recoverable and does not leak an unhandled promise.
  accessFailure = true;
  const denied = await ctx({width:390,height:844},true);
  const retry = await denied.newPage();
  retry.on("pageerror",e=>errors.push(e.message));
  await retry.goto(root);
  await retry.getByText("Acces temporar indisponibil", {exact:true}).waitFor();
  accessFailure = false;
  await retry.getByRole("button",{name:"Verifică din nou",exact:true}).click();
  await retry.getByRole("button",{name:"Financiar",exact:true}).waitFor();
  await denied.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/telefon, zi/noapte, scanner, ordine/refresh financiar, program Plus păstrat, scan invalid, retry echipă/acces, validări, logout și răspuns întârziat după schimbarea localului; zero erori JS",
  );
} finally {
  await browser.close();
}
