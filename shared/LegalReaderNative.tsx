import {useState} from 'react';
import {Text, View, Pressable} from 'react-native';
import {LEGAL_DOCUMENTS, LEGAL_VERSION, LEGAL_CONTACT_EMAIL} from './legal-content';
import type {Theme} from './theme';
export function LegalReaderNative({audience, theme, initialDocument = ''}: {audience: 'client'|'business'|'admin'; theme: Theme; initialDocument?: string}) {
  const [selected, select] = useState(initialDocument);
  const documents = LEGAL_DOCUMENTS.filter(d => d.audience.includes(audience));
  const doc = documents.find(d => d.id === selected);
  const text = {color: theme.ink, fontFamily: 'InstrumentSans_400Regular', fontSize: 15, lineHeight: 23};
  return <View style={{gap: 12}}>
    <Text style={{...text, color: theme.ink2}}>Documentele se pot citi și fără internet. Versiune {LEGAL_VERSION}. Contact: {LEGAL_CONTACT_EMAIL}.</Text>
    {documents.map(d => <Pressable accessibilityRole="button" accessibilityState={{expanded: selected === d.id}} key={d.id} onPress={() => select(selected === d.id ? '' : d.id)} style={{minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.s1}}><Text style={{...text, color: theme.blueInk, fontFamily: 'InstrumentSans_600SemiBold'}}>{d.title}</Text></Pressable>)}
    {doc && <View accessibilityLabel={doc.title} style={{gap: 12, padding: 16, borderRadius: 18, backgroundColor: theme.s1, borderWidth: 1, borderColor: theme.line}}><Text accessibilityRole="header" style={{...text, fontSize: 24, fontFamily: 'BricolageGrotesque_800ExtraBold'}}>{doc.title}</Text>{doc.sections.map((section, n) => <View key={n} style={{gap: 8}}><Text accessibilityRole="header" style={{...text, fontFamily: 'InstrumentSans_700Bold', fontSize: 17}}>{section.title}</Text>{section.paragraphs.map((paragraph, i) => <Text selectable key={i} style={text}>{paragraph}</Text>)}</View>)}<Pressable accessibilityRole="button" onPress={() => select('')} style={{minHeight: 44, justifyContent: 'center'}}><Text style={{...text, color: theme.blueInk}}>Închide documentul</Text></Pressable></View>}
  </View>;
}
