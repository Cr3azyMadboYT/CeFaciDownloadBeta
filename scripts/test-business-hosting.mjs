// Run against an Apache/LiteSpeed instance serving the packaged Expo export.
// X-Forwarded-Proto simulates the hosting TLS terminator; it does not test a certificate.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const root = process.env.CEFACI_TEST_HOSTING_URL ?? "http://127.0.0.1:4174";
if (!["127.0.0.1", "localhost"].includes(new URL(root).hostname))
  throw new Error("Use an isolated localhost hosting fixture.");
const headers = { "X-Forwarded-Proto": "https" };
const redirect = await fetch(root, { redirect: "manual" });
assert.equal(redirect.status, 301);
assert.ok(redirect.headers.get("location").startsWith("https://"));
const response = await fetch(root + "/a/deep/link", { headers });
assert.equal(response.status, 200);
const policy = response.headers.get("content-security-policy");
assert.match(policy, /script-src 'self';/);
assert.match(policy, /frame-ancestors 'none'/);
assert.match(response.headers.get("strict-transport-security"), /max-age=31536000/);
assert.match(response.headers.get("cache-control"), /no-store/);
const html = await response.text();
assert.match(html, /<html lang="ro">/);
const script = html.match(/<script src="([^"]+)"/)[1];
const asset = await fetch(root + script, { headers });
assert.equal(asset.status, 200);
assert.match(asset.headers.get("cache-control"), /immutable/);
assert.match((await fetch(root + "/manifest.webmanifest", { headers })).headers.get("content-type"), /application\/manifest\+json/);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ extraHTTPHeaders: headers });
  await context.route("**/*.supabase.co/**", route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(root);
  await page.getByRole("button", { name: "Ai deja cont? Intră", exact: true }).click();
  await page.getByRole("button", { name: "Trimite codul", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(errors, []);
  // A malicious inline script must not execute even though RN Web uses inline styles.
  await page.evaluate(() => {
    globalThis.__unsafeInlineExecuted = false;
    const script = document.createElement("script");
    script.textContent = "globalThis.__unsafeInlineExecuted = true";
    document.body.appendChild(script);
  });
  assert.equal(await page.evaluate(() => globalThis.__unsafeInlineExecuted), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("PASS: Apache redirect/fallback/cache/MIME, CSP/HSTS, real Expo login and fonts, inline script blocked, phone width.");
} finally {
  await browser.close();
}
