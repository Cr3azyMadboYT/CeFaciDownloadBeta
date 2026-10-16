import {useState, type ReactNode} from 'react';
import {Modal, Pressable, ScrollView, Text, View} from 'react-native';
import type {Theme} from './theme';
import {LegalReaderNative} from './LegalReaderNative';

/** Terms are contractual; privacy information is acknowledged, not blanket consent. */
/** `small`: o notă mică, centrată, jos pe ecranul de start (Cornel, 13.10: „prea evidentă și prea sus”); `extra` = alte linkuri pe același rând. */
export function AccountLegalNotice({audience, theme, creating = true, dark = false, small = false, extra, tr = (x: string) => x}: {
  audience: 'client'|'business'; theme: Theme; creating?: boolean; dark?: boolean; small?: boolean; extra?: ReactNode;
  /** traducerea (aplicația Client în engleză); Business rămâne în română */
  tr?: (ro: string) => string;
}) {
  const [document, open] = useState('');
  const ink = dark ? (small ? 'rgba(201,206,230,0.62)' : '#C9CEE6') : theme.ink2;
  const link = dark ? (small ? 'rgba(201,214,255,0.85)' : '#C9D6FF') : theme.blueInk;
  const size = small ? 11.5 : 13;
  return <View style={{gap: small ? 0 : 2}}>
    <Text style={{fontFamily: 'InstrumentSans_400Regular', fontSize: size, lineHeight: small ? 16 : 19, color: ink, textAlign: small ? 'center' : 'left'}}>
      {tr(creating ? 'Prin crearea contului accepți Termenii de utilizare și confirmi că ai citit Politica de confidențialitate.' : 'Folosirea aplicației este guvernată de Termenii de utilizare. Citește Politica de confidențialitate pentru informații despre datele tale.')}
    </Text>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', columnGap: small ? 12 : 14, justifyContent: small ? 'center' : 'flex-start'}}>
      {[[audience === 'client' ? 'clientTerms' : 'businessTerms', 'Termenii de utilizare'], ['privacy', 'Politica de confidențialitate']].map(([id, label]) =>
        <Pressable key={id} accessibilityRole="link" onPress={() => open(id)} style={{minHeight: small ? 36 : 44, justifyContent: 'center'}}>
          <Text style={{fontFamily: 'InstrumentSans_600SemiBold', fontSize: size, color: link, textDecorationLine: 'underline'}}>{tr(label)}</Text>
        </Pressable>)}
      {extra}
    </View>
    <Modal visible={!!document} animationType="slide" onRequestClose={() => open('')}>
      <View style={{flex: 1, backgroundColor: theme.bg, paddingTop: 48}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide documentele contului" onPress={() => open('')} style={{minHeight: 48, paddingHorizontal: 20, justifyContent: 'center'}}><Text style={{fontFamily: 'InstrumentSans_600SemiBold', color: theme.blueInk}}>{tr('Înapoi la cont')}</Text></Pressable>
        <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 48}}><LegalReaderNative key={document} audience={audience} theme={theme} initialDocument={document}/></ScrollView>
      </View>
    </Modal>
  </View>;
}
