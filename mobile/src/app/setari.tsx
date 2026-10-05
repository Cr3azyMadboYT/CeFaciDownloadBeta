// Setări: theme (Zi / Noapte / Ca telefonul), fewer animations, the receipt reminders, the account and the legal bits.
import { Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { setBoard, useApp } from '../lib/session';
import { Icon } from '../ui/Icon';
import { H1, Lbl, Muted, Press, Seg, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ padding: 16, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
      <T style={{ fontFamily: F.sb, fontSize: 16 }}>{title}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>
      {note ? <Muted>{note}</Muted> : null}
    </View>
  );
}

export default function Setari() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const theme = useApp((s) => s.board.theme ?? 'zi');
  const calm = useApp((s) => !!s.board.calm);
  const remind = useApp((s) => s.board.billRemind !== false);
  const who = useApp((s) => s.who);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profil'));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: ins.bottom + 32, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <H1 style={{ fontSize: 34, lineHeight: 35 }}>Setări</H1>
        <Group title="Temă" note={theme === 'auto' ? 'Urmează tema telefonului: ziua luminoasă, noaptea întunecată.' : undefined}>
          <Seg label="Zi" on={theme === 'zi'} onPress={() => setBoard({ theme: 'zi' })} />
          <Seg label="Noapte" on={theme === 'noapte'} onPress={() => setBoard({ theme: 'noapte' })} />
          <Seg label="Ca telefonul" on={theme === 'auto'} onPress={() => setBoard({ theme: 'auto' })} />
        </Group>
        <Group title="Animații" note="Cu „Mai puține”, Bilu stă cuminte și ecranele nu mai sar. Se pornește singur dacă telefonul are setarea de reducere a mișcării.">
          <Seg label="Normale" on={!calm} onPress={() => setBoard({ calm: false })} />
          <Seg label="Mai puține" on={calm} onPress={() => setBoard({ calm: true })} />
        </Group>
        <Group title="Amintirea pentru bon" note="La 40 de minute după check-in și, dacă tot n-ai pus bonul, a doua zi la prânz. Niciodată mai mult de două.">
          <Seg label="Da" on={remind} onPress={() => setBoard({ billRemind: true })} />
          <Seg label="Nu" on={!remind} onPress={() => setBoard({ billRemind: false })} />
        </Group>
        <Lbl style={{ marginTop: 8 }}>Contul</Lbl>
        <Muted style={{ fontSize: 14 }}>{who ? 'Contul: ' + (who.email ?? 'Google') + '. Ieșirea din cont și ștergerea sunt jos în Profil.' : 'Nu ești în cont.'}</Muted>
        <Lbl style={{ marginTop: 8 }}>Despre</Lbl>
        <Muted style={{ fontSize: 14 }}>
          {'Datele localurilor: © contribuitorii '}
          <T style={{ fontFamily: F.m, fontSize: 14, color: t.ink2, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>OpenStreetMap</T>
          {', licența ODbL. Prețurile sunt estimate.'}
        </Muted>
      </ScrollView>
      <TopShade />
    </View>
  );
}
