import {useEffect, useRef, useState} from 'react';
import {Platform, Pressable, Share, Text, TextInput, View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {privacyKinds, privacyStatuses, type PrivacyKind, type PrivacyScope} from './privacy';
import {usePrivacy, type PrivacyRpc} from './use-privacy';
import type {Theme} from './theme';

type Props = {identity: string; scope: PrivacyScope; call: PrivacyRpc; theme: Theme};
export function PrivacyPanelNative(props: Props) {return <PrivacyPanel key={props.identity + ':' + props.scope} {...props}/>;}
function PrivacyPanel({identity, scope, call, theme}: Props) {
  const [kind, Kind] = useState<PrivacyKind>('access'), [description, Description] = useState(''), [frozen, Frozen] = useState(false);
  const requestKey = useRef(randomUUID());
  const privacy = usePrivacy(identity, scope, call);
  useEffect(() => {Kind('access'); Description(''); Frozen(false); requestKey.current = randomUUID();}, [identity]);
  const text = {color: theme.ink, fontFamily: 'InstrumentSans_400Regular', fontSize: 15, lineHeight: 22};
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: theme.s2, opacity: disabled ? 0.5 : 1}}><Text style={{...text, fontFamily: 'InstrumentSans_600SemiBold'}}>{label}</Text></Pressable>;
  if (!identity) return <Text style={text}>Intră în cont pentru cereri și exportul datelor tale. Documentele de mai sus sunt disponibile tuturor.</Text>;
  return <View style={{gap: 14}}>
    <Text accessibilityRole="header" style={{...text, fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 24}}>Datele tale, alegerile tale</Text>
    <Text style={text}>Trimite o cerere echipei CeFaci. Nu trimite parole, coduri de autentificare, CNP sau copii de acte. Cererea de ștergere se analizează; trimiterea ei nu șterge automat contul.</Text>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{(Object.keys(privacyKinds) as PrivacyKind[]).map(k => <Pressable key={k} accessibilityRole="button" accessibilityLabel={privacyKinds[k]} accessibilityState={{selected: kind === k}} disabled={privacy.busy || frozen} onPress={() => Kind(k)} style={{minHeight: 44, padding: 10, borderRadius: 12, backgroundColor: kind === k ? theme.blueSoft : theme.s1, borderWidth: 1, borderColor: kind === k ? theme.blueInk : theme.line}}><Text style={text}>{privacyKinds[k]}</Text></Pressable>)}</View>
    <Text style={text}>Ce dorești să verificăm?</Text><TextInput accessibilityLabel="Detaliile cererii privind datele" value={description} onChangeText={Description} maxLength={4000} multiline editable={!privacy.busy && !frozen} style={{...text, minHeight: 120, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.s1, textAlignVertical: 'top'}} />
    {!!privacy.error && <Text accessibilityRole="alert" style={{...text, color: theme.coralInk}}>{privacy.error}</Text>}{!!privacy.message && <Text accessibilityLiveRegion="polite" style={text}>{privacy.message}</Text>}
    {frozen && <Text style={text}>Conținutul este păstrat pentru reîncercare, ca să evităm cererile duplicate.</Text>}
    {frozen && <><Text style={{...text, color: theme.ink2}}>Dacă vrei să schimbi cererea, verifică întâi istoricul: o cerere poate fi primită chiar dacă răspunsul rețelei s-a pierdut.</Text>{button('Pregătește o cerere nouă', () => {Frozen(false); requestKey.current = randomUUID(); void privacy.load();}, privacy.busy)}</>}
    {button(privacy.busy ? 'Se verifică…' : frozen ? 'Reîncearcă cererea' : 'Trimite cererea privind datele', () => {Frozen(true); void privacy.submit(kind, description, requestKey.current, () => {Description(''); Frozen(false); requestKey.current = randomUUID();});}, privacy.busy || description.trim().length < 10)}
    {button('Exportă datele mele de bază', () => void privacy.exportData(async (value, valid) => {
      const json = JSON.stringify(value, null, 2);
      if (!valid()) return false;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
        try {if (!valid()) return false; const a = document.createElement('a'); a.href = url; a.download = 'cefaci-datele-mele.json'; document.body.appendChild(a); a.click(); a.remove();}
        finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
        return true;
      }
      const result = await Share.share({title: 'Datele mele CeFaci', message: json});
      return valid() && result.action === Share.sharedAction;
    }), privacy.busy)}
    <Text style={{...text, color: theme.ink2}}>Exportul include datele de bază ale contului. Pentru o copie completă aplicabilă dreptului de acces sau portabilitate, trimite cererea de mai sus. Salvează exportul într-un loc sigur.</Text>
    <Text accessibilityRole="header" style={{...text, fontFamily: 'InstrumentSans_700Bold', fontSize: 19}}>Cererile mele privind datele</Text>
    {button('Actualizează cererile privind datele', () => void privacy.load(), privacy.busy)}
    {!!privacy.historyError && <Text accessibilityRole="alert" style={{...text, color: theme.coralInk}}>{privacy.historyError}</Text>}
    {!privacy.historyError && !privacy.loaded && <Text style={text}>Se încarcă cererile…</Text>}
    {privacy.loaded && !privacy.requests.length && <Text style={text}>Nu ai trimis încă o cerere privind datele.</Text>}
    {privacy.hasMore && button('Mai multe cereri privind datele', () => void privacy.loadMore(), privacy.historyBusy)}
    {privacy.requests.map(row => <View key={row.id} style={{padding: 16, borderRadius: 18, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.s1, gap: 8}}><Text style={{...text, fontFamily: 'InstrumentSans_700Bold'}}>{privacyKinds[row.kind]} · {privacyStatuses[row.status]}</Text><Text style={text}>{row.description}</Text><Text style={{...text, color: theme.ink2}}>Termen de răspuns: {new Date(row.due_at).toLocaleDateString('ro-RO')}</Text>{row.extension_reason && <Text style={text}>Motivul prelungirii: {row.extension_reason}</Text>}{row.response && <Text selectable style={text}>Răspuns CeFaci: {row.response}</Text>}</View>)}
  </View>;
}
