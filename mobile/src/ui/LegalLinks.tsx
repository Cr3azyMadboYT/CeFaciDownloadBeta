import {View} from 'react-native';
import {router} from 'expo-router';
import {Muted, Press, T} from './kit';
import {F, useTheme} from './theme';
import {tr} from '../lib/i18n';
export function LegalLinks({dark = false, compact = false, tiny = false}: {dark?: boolean; compact?: boolean; tiny?: boolean}) {
  const {t} = useTheme();
  // pe ecranul de start: doar „Datele mele”, mic, lângă termeni
  if (tiny) return <Press accessibilityLabel={tr('Termeni și confidențialitate')} onPress={() => router.push('/confidentialitate')} style={{minHeight: 36, justifyContent: 'center'}}><T style={{fontFamily: F.sb, fontSize: 11.5, color: dark ? 'rgba(201,214,255,0.85)' : t.blueInk, textDecorationLine: 'underline'}}>{tr('Datele mele')}</T></Press>;
  return <View style={{gap: 6}}>{!compact && <Muted style={dark ? {color: '#C9CEE6'} : undefined}>{tr('Consultă termenii, confidențialitatea și informațiile despre stocarea locală înainte să continui.')}</Muted>}<Press accessibilityLabel={tr('Termeni și confidențialitate')} onPress={() => router.push('/confidentialitate')} style={{minHeight: 44, justifyContent: 'center'}}><T style={{fontFamily: F.sb, fontSize: 14, color: dark ? '#C9D6FF' : t.blueInk}}>{tr('Termeni · Confidențialitate · Datele mele')}</T></Press></View>;
}
