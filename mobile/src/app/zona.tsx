// "De unde pleci?": the zone distances count from, or the phone's location (asked only when tapped).
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { APP, savePrefs, useApp } from '../lib/session';
import { toast } from '../lib/toast';
import { Icon } from '../ui/Icon';
import { Chip, H1, Lbl, Muted, Press, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

export default function Zona() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const prefs = useApp((s) => s.prefs);
  const [busy, setBusy] = useState(false);
  const here = APP.hasHere();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: Math.max(ins.bottom, 12) + 24, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
        <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
      </View>
      <H1 style={{ fontSize: 34, lineHeight: 35 }}>De unde pleci?</H1>
      <Muted>Distanțele și recomandările se socotesc de aici.</Muted>
      <Press onPress={async () => { if (busy) return; setBusy(true); const err = await APP.useHere(); setBusy(false); toast(err || 'Pleci de lângă tine. Am refăcut recomandările.'); if (!err) back(); }}
        accessibilityState={{ selected: here }}
        style={{ alignSelf: 'flex-start', height: 42, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: here ? t.ink : t.line, backgroundColor: here ? t.ink : t.s1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="locate" size={16} color={here ? t.bg : t.ink} />
        <T style={{ fontFamily: F.sb, fontSize: 14, color: here ? t.bg : t.ink }}>{busy ? 'Caut locația…' : here ? 'Folosesc locația ta' : 'Folosește locația mea'}</T>
      </Press>
      {['București', 'Ilfov'].map((area) => (
        <View key={area} style={{ gap: 8 }}>
          <Lbl style={{ marginTop: 6 }}>{area}</Lbl>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {APP.zones().filter((z) => z.area === area).map((z) => (
              <Chip key={z.id} label={z.name} on={!here && prefs.zone === z.id} onPress={() => { savePrefs({ zone: z.id, here: undefined }); toast('Pleci din ' + z.name + '. Am refăcut recomandările.'); back(); }} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
    <TopShade />
    </View>
  );
}
