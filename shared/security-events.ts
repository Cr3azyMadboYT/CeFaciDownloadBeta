type Scope = 'admin' | 'business';
const listeners = new Map<Scope, Set<() => void>>();
export function publishSecurityFailure(scope: Scope) {
  for (const listener of listeners.get(scope) ?? []) listener();
}
export function subscribeSecurityFailure(scope: Scope, callback: () => void) {
  const group = listeners.get(scope) ?? new Set<() => void>();
  listeners.set(scope, group); group.add(callback);
  return () => {group.delete(callback);};
}
