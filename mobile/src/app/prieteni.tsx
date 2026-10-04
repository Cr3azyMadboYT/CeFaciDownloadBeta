// Prieteni: your code and @username, find friends by exact @username or by their code, requests, your list.
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { useApp } from '../lib/session';
import { accept, addByCode, ask, findUser, listFriends, myCode, remove, type FriendRow, type Person } from '../lib/friends';
import { toast } from '../lib/toast';
import { Icon } from '../ui/Icon';
import { SignIn } from '../ui/SignIn';
import { Big, Field, H1, Lbl, Muted, Note, Press, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

const COLORS = ['#8C6CFF', '#FF6A4D', '#FFD43B', '#5FD39A', '#8EA6FF', '#FF8A73'];
const colorOf = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

function Row({ p, right }: { p: Person; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
      <View style={{ width: 38, height: 38, borderRadius: 99, backgroundColor: colorOf(p.username), alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontFamily: F.b, fontSize: 14, color: '#0E1440' }}>{p.first_name.charAt(0).toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: F.sb, fontSize: 15 }}>{p.first_name}</T>
        <Muted>{'@' + p.username}</Muted>
      </View>
      {right}
    </View>
  );
}

export default function Prieteni() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const user = useApp((s) => s.prefs.user);
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Person | null | 'none'>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(false);

  const load = useCallback(async () => {
    if (!who) return;
    const [c, r] = await Promise.all([myCode(who.id), listFriends(who.id)]);
    setCode(c); setRows(r);
  }, [who]);
  useEffect(() => { void load(); }, [load]);

  const search = async () => {
    const x = q.trim().replace(/^@+/, '');
    if (x.length < 3) return;
    setBusy(true);
    if (/^[a-z0-9]{8}$/i.test(x) && !x.includes('.')) {
      const err = await addByCode(x);
      if (!err) { setBusy(false); setQ(''); toast('Cererea a plecat. Vă vedeți după ce o acceptă.'); void load(); return; }
    }
    const p = await findUser(x);
    setBusy(false);
    setFound(p ?? 'none');
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profil'));
  const incoming = rows.filter((r) => r.status === 'pending' && r.incoming);
  const sent = rows.filter((r) => r.status === 'pending' && !r.incoming);
  const friends = rows.filter((r) => r.status === 'accepted');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="padding">
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: Math.max(ins.bottom, 12) + 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
        <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
      </View>
      <H1 style={{ fontSize: 34, lineHeight: 35 }}>Prieteni</H1>
      {!who || !known ? (
        <View style={{ marginTop: 14, gap: 12 }}>
          <Muted style={{ fontSize: 15, lineHeight: 21 }}>Prietenii merg doar cu cont, ca să vă găsiți unii pe alții. Contul îl faci cu Google sau cu emailul, fără parolă, iar ce ai deja pe telefon (planuri, XP, ce-ți place) trece în cont.</Muted>
          {who && !known ? <Note kind="ok">Leg contul de profilul tău…</Note> : <SignIn />}
        </View>
      ) : (
        <View style={{ marginTop: 14, gap: 12 }}>
          <View style={{ padding: 14, borderRadius: 20, backgroundColor: t.blueSoft, gap: 6 }}>
            <Lbl>Te găsesc după</Lbl>
            <T style={{ fontFamily: F.display, fontSize: 22 }}>{'@' + (user ?? '')}</T>
            {code ? <Muted>{'sau cu codul tău: ' + code + ' (pentru cei de 16–17 ani, care nu apar la căutare)'}</Muted> : null}
            {code ? <Press onPress={() => Share.share({ message: 'Hai în CeFaci! Mă găsești după @' + user + ' sau cu codul ' + code + '.' })} style={{ alignSelf: 'flex-start', marginTop: 4, height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.blue, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="share" size={16} color="#FFFFFF" /><T style={{ fontFamily: F.sb, fontSize: 14, color: '#FFFFFF' }}>Trimite-le codul</T>
            </Press> : null}
          </View>
          <Lbl style={{ marginTop: 6 }}>Adaugă după @username sau cod</Lbl>
          <Field prefix="@" value={q} onChangeText={(x) => { setQ(x.slice(0, 24)); setFound(null); }} placeholder="username exact sau cod" autoCapitalize="none" autoCorrect={false}
            returnKeyType="search" onSubmitEditing={search} focused={focus} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} accessibilityLabel="Username sau cod" />
          <Big label={busy ? 'Caut…' : 'Caută'} disabled={busy || q.trim().replace(/^@+/, '').length < 3} onPress={search} />
          {found === 'none' ? <Muted>Nu găsim pe nimeni cu numele ăsta. Verifică scrierea, iar celor sub 18 ani cere-le codul.</Muted> : null}
          {found && found !== 'none' ? (
            <Row p={found} right={
              <Press onPress={async () => { const err = await ask(who.id, found.id); toast(err ?? 'Cererea a plecat la ' + found.first_name + '.'); setFound(null); setQ(''); void load(); }}
                style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: t.blue, justifyContent: 'center' }}>
                <T style={{ fontFamily: F.sb, fontSize: 14, color: '#FFFFFF' }}>Adaugă</T>
              </Press>
            } />
          ) : null}
          {incoming.length ? <Lbl style={{ marginTop: 10 }}>{'Cereri (' + incoming.length + ')'}</Lbl> : null}
          {incoming.map((r) => (
            <Row key={r.person.id} p={r.person} right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Press onPress={async () => { await remove(who.id, r.person.id); void load(); }} style={{ height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.s2, justifyContent: 'center' }}><T style={{ fontFamily: F.sb, fontSize: 14 }}>Nu</T></Press>
                <Press onPress={async () => { await accept(who.id, r.person.id); toast('Acum sunteți prieteni.'); void load(); }} style={{ height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.blue, justifyContent: 'center' }}><T style={{ fontFamily: F.sb, fontSize: 14, color: '#FFFFFF' }}>Acceptă</T></Press>
              </View>
            } />
          ))}
          <Lbl style={{ marginTop: 10 }}>{friends.length ? 'Prietenii tăi (' + friends.length + ')' : 'Prietenii tăi'}</Lbl>
          {friends.length ? friends.map((r) => <Press key={r.person.id} onPress={() => router.push({ pathname: '/prieten/[id]', params: { id: r.person.id } })} accessibilityLabel={'Profil: ' + r.person.first_name}><Row p={r.person} right={<Icon name="next" size={16} color={t.ink3} />} /></Press>) : <Muted>Încă n-ai prieteni în CeFaci. Caută-i mai sus sau trimite-le codul tău.</Muted>}
          {sent.length ? <Lbl style={{ marginTop: 10 }}>Așteaptă răspuns</Lbl> : null}
          {sent.map((r) => <Row key={r.person.id} p={r.person} right={<Muted>trimisă</Muted>} />)}
        </View>
      )}
    </ScrollView>
      <TopShade />
    </KeyboardAvoidingView>
  );
}
