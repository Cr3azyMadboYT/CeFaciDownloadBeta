import { Redirect } from 'expo-router';
import { useApp } from '../lib/session';

export default function Start() {
  const onboarded = useApp((s) => s.onboarded);
  return <Redirect href={onboarded ? '/acasa' : '/cont'} />;
}
