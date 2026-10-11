import {useState} from 'react';
import {Modal, Pressable, ScrollView, Text, View} from 'react-native';
import type {Theme} from './theme';
import {LegalReaderNative} from './LegalReaderNative';

/** Terms are contractual; privacy information is acknowledged, not blanket consent. */
export function AccountLegalNotice({audience, theme, creating = true, dark = false}: {
  audience: 'client'|'business'; theme: Theme; creating?: boolean; dark?: boolean;
}) {
  const [document, open] = useState('');
  const ink = dark ? '#C9CEE6' : theme.ink2;
  const link = dark ? '#C9D6FF' : theme.blueInk;
  return <View style={{gap: 2}}>
    <Text style={{fontFamily: 'InstrumentSans_400Regular', fontSize: 13, lineHeight: 19, color: ink}}>
      {creating ? 'Prin crearea contului accepți Termenii de utilizare și confirmi că ai citit Politica de confidențialitate.' : 'Folosirea aplicației este guvernată de Termenii de utilizare. Citește Politica de confidențialitate pentru informații despre datele tale.'}
    </Text>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', columnGap: 14}}>
      {[[audience === 'client' ? 'clientTerms' : 'businessTerms', 'Termenii de utilizare'], ['privacy', 'Politica de confidențialitate']].map(([id, label]) =>
        <Pressable key={id} accessibilityRole="link" onPress={() => open(id)} style={{minHeight: 44, justifyContent: 'center'}}>
          <Text style={{fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13, color: link, textDecorationLine: 'underline'}}>{label}</Text>
        </Pressable>)}
    </View>
    <Modal visible={!!document} animationType="slide" onRequestClose={() => open('')}>
      <View style={{flex: 1, backgroundColor: theme.bg, paddingTop: 48}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide documentele contului" onPress={() => open('')} style={{minHeight: 48, paddingHorizontal: 20, justifyContent: 'center'}}><Text style={{fontFamily: 'InstrumentSans_600SemiBold', color: theme.blueInk}}>Înapoi la cont</Text></Pressable>
        <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 48}}><LegalReaderNative key={document} audience={audience} theme={theme} initialDocument={document}/></ScrollView>
      </View>
    </Modal>
  </View>;
}
