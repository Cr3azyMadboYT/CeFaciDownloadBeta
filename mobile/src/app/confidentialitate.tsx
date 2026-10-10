import {useEffect, useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {LegalReaderNative} from '../../../shared/LegalReaderNative';
import {PrivacyPanelNative} from '../../../shared/PrivacyPanelNative';
import {privacyCall, type PrivacyClient} from '../../../shared/privacy';
import {securitySessionKey} from '../../../shared/security-mfa';
import {sb} from '../lib/auth';
import {useSafeAreaInsets} from '../ui/insets';
import {Big, H1} from '../ui/kit';
import {useTheme} from '../ui/theme';
import {Bilu} from '../ui/Bilu';
const call = <T,>(name: string, args?: Record<string, unknown>) => privacyCall<T>(sb() as unknown as PrivacyClient, name, args);
export default function PrivacyScreen() {
  const {t} = useTheme(), ins = useSafeAreaInsets();
  const [session, set] = useState<Session|null>(null);
  useEffect(() => {let active = true, changed = false; const {data} = sb().auth.onAuthStateChange((_e, s) => {changed = true; if (active) set(s);}); void sb().auth.getSession().then(({data}) => {if (active && !changed) set(data.session);}); return () => {active = false; data.subscription.unsubscribe();};}, []);
  const identity = session ? securitySessionKey(session) : '';
  return <View style={{flex: 1, backgroundColor: t.bg}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingTop: ins.top + 12, paddingBottom: ins.bottom + 28, paddingHorizontal: 20, gap: 20}}><Big label="Înapoi" color={t.s1} ink={t.ink} onPress={() => router.back()}/><View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><Bilu size={60} mood="hi" still/><H1 style={{fontSize: 27, flex: 1}}>Confidențialitate și termeni</H1></View><LegalReaderNative audience="client" theme={t}/><PrivacyPanelNative identity={identity} scope="client" call={call} theme={t}/></ScrollView></View>;
}
