import {View} from 'react-native';
import {router} from 'expo-router';
import {Muted, Press, T} from './kit';
import {F, useTheme} from './theme';
export function LegalLinks({dark = false}: {dark?: boolean}) {
  const {t} = useTheme();
  return <View style={{gap: 6}}><Muted style={dark ? {color: '#C9CEE6'} : undefined}>Consultă termenii, confidențialitatea și informațiile despre stocarea locală înainte să continui.</Muted><Press accessibilityLabel="Termeni și confidențialitate" onPress={() => router.push('/confidentialitate')} style={{minHeight: 44, justifyContent: 'center'}}><T style={{fontFamily: F.sb, fontSize: 14, color: dark ? '#C9D6FF' : t.blueInk}}>Termeni · Confidențialitate · Datele mele</T></Press></View>;
}
