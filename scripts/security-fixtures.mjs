// Synthetic browser fixture data only. Production roles and sessions are verified by RPCs.
export const fixtureSessionId = '00000000-0000-0000-0000-000000000f01';
export const fixtureFactorId = '00000000-0000-0000-0000-000000000f02';
export function fixtureClaims(userId) {
  const timestamp = Math.floor(Date.now() / 1000);
  return {sub: userId, exp: timestamp + 3600, iat: timestamp, role: 'authenticated',
    session_id: fixtureSessionId, aal: 'aal2', amr: [{method: 'totp', timestamp}]};
}
export function fixtureFactors() {
  const at = new Date().toISOString();
  return [{id: fixtureFactorId, friendly_name: 'Synthetic authenticator', factor_type: 'totp', status: 'verified', created_at: at, updated_at: at}];
}
export function fixtureSecureStatus(scope) {
  return {active: true, scope, idle_expires_at: new Date(Date.now() + 20 * 60000).toISOString(),
    expires_at: new Date(Date.now() + 8 * 3600000).toISOString(), reason: 'active', reauthentication_required: false};
}
// Mirrors the versioned completion-key contract. Markers contain no tokens or private data.
export function seedCompletedTutorials(entries) {
  for (const {app, userId, role, venueId = ''} of entries)
    localStorage.setItem(['cefaci', app, 'tutorial', '1', userId, role, venueId].map(encodeURIComponent).join(':'), 'done');
}
