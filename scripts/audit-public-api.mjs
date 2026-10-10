// Read-only checks: no accounts, email, receipts, claims or visits are created.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const config = fs.readFileSync(new URL('../business/src/backend.ts', import.meta.url), 'utf8');
const base = config.match(/https:\/\/[a-z]+\.supabase\.co/)?.[0];
const key = config.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
assert.equal(base, 'https://vqrmwuarjjntusfbqprx.supabase.co');
assert.ok(key);
const checks = [
  { name: 'own privacy requests without session', path: '/rest/v1/rpc/privacy_my_requests', statuses: [401, 403] },
  { name: 'own curated data export without session', path: '/rest/v1/rpc/privacy_export_my_data', statuses: [401, 403] },
  { name: 'Admin privacy inbox without session', path: '/rest/v1/rpc/admin_privacy_requests', statuses: [401, 403] },
  { name: 'private privacy inbox schema hidden', path: '/rest/v1/privacy_requests?select=*&limit=0', schema: 'private', statuses: [406] },
  { name: 'private privacy log schema hidden', path: '/rest/v1/privacy_request_log?select=*&limit=0', schema: 'private', statuses: [406] },
  { name: 'privileged access bootstrap without session', path: '/rest/v1/rpc/secure_access_status', statuses: [401, 403] },
  { name: 'Admin scoped session status without session', path: '/rest/v1/rpc/secure_session_status?p_scope=admin', statuses: [401, 403] },
  { name: 'Business scoped session status without session', path: '/rest/v1/rpc/secure_session_status?p_scope=business', statuses: [401, 403] },
  { name: 'scoped sessions schema hidden', path: '/rest/v1/security_sessions?select=*&limit=0', schema: 'private', statuses: [406] },
  { name: 'public catalog', path: '/rest/v1/rpc/partner_catalog', statuses: [200], catalog: true },
  { name: 'Business without session', path: '/rest/v1/rpc/biz_dashboard_v2?p_venue=audit-nonexistent', statuses: [401, 403] },
  { name: 'Business onboarding search without session', path: '/rest/v1/rpc/biz_venue_search?p_query=audit-nonexistent', statuses: [401, 403] },
  { name: 'Business requests without session', path: '/rest/v1/rpc/biz_partner_requests', statuses: [401, 403] },
  { name: 'Business identity without session', path: '/rest/v1/rpc/biz_identity_status', statuses: [401, 403] },
  { name: 'proof retention service only', path: '/rest/v1/rpc/business_proofs_retention_candidates', statuses: [401, 403] },
  { name: 'Admin role without session', path: '/rest/v1/rpc/admin_me', statuses: [401, 403] },
  { name: 'Admin dashboard without session', path: '/rest/v1/rpc/admin_dashboard', statuses: [401, 403] },
  { name: 'Admin support queue without session', path: '/rest/v1/rpc/admin_support_reports', statuses: [401, 403] },
  { name: 'own reports without session', path: '/rest/v1/rpc/support_reports', statuses: [401, 403] },
  { name: 'support photo retention service only', path: '/rest/v1/rpc/support_photos_retention_candidates', statuses: [401, 403] },
  { name: 'private support schema hidden', path: '/rest/v1/support_reports?select=*&limit=0', schema: 'private', statuses: [406] },
  { name: 'partner request schema hidden', path: '/rest/v1/partner_requests?select=*&limit=0', schema: 'private', statuses: [406] },
  { name: 'group without session', path: '/rest/v1/rpc/plan_attendance?p_plan=00000000-0000-0000-0000-000000000000', statuses: [401, 403] },
  { name: 'receipt readiness service only', path: '/rest/v1/rpc/visit_receipt_ready_v2?p_user=00000000-0000-0000-0000-000000000000&p_visit=00000000-0000-0000-0000-000000000000', statuses: [401, 403] },
  { name: 'private schema hidden', path: '/rest/v1/group_tickets?select=*&limit=0', schema: 'private', statuses: [406] },
  { name: 'network queue schema hidden', path: '/rest/v1/http_request_queue?select=*&limit=0', schema: 'net', statuses: [406] },
  { name: 'OCR without session or image', path: '/functions/v1/citeste-bon', method: 'POST', statuses: [401] },
];
for (const check of checks) {
  const response = await fetch(base + check.path, {
    method: check.method ?? 'GET',
    headers: { apikey: key, ...(check.schema ? { 'Accept-Profile': check.schema } : {}) },
    signal: AbortSignal.timeout(20000),
  });
  assert.ok(check.statuses.includes(response.status), `${check.name}: unexpected HTTP ${response.status}`);
  if (check.catalog) {
    const catalog = await response.json();
    assert.ok(Array.isArray(catalog));
    for (const partner of catalog) {
      for (const field of ['cui', 'firm', 'contract', 'rate', 'free_until', 'user_id', 'owner'])
        assert.equal(partner[field], undefined, `Public catalog contains ${field}`);
    }
  }
  console.log(`PASS ${check.name}: HTTP ${response.status}`);
}
