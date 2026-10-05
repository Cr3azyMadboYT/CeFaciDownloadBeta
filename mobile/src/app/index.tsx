import { Redirect } from 'expo-router';
import { useApp } from '../lib/session';
import { E2E } from '../lib/e2e';

// Acasă only with an account; otherwise the first screen (sign in, or sign up). The test build has no account.
export default function Start() {
  const onboarded = useApp((s) => s.onboarded);
  const account = useApp((s) => s.account);
  return <Redirect href={onboarded && (account || E2E) ? '/acasa' : '/cont'} />;
}
