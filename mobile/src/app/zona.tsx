// "De unde pleci?" from Acasă (decision Cornel, 04.10): the same choices as at sign-up — the phone's location, or
// București / Ilfov and the sector or the town — and how far, on the map. Saved in the account at once: every plan,
// list and idea counts from here.
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { APP, savePrefs, useApp } from '../lib/session';
import { resetFilters } from '../lib/filters';
import { toast } from '../lib/toast';
import { nearestZone } from '../../../src/engine/core';
import type { Home, Prefs } from '../../../src/app/bridge';
import { Icon } from '../ui/Icon';
import { Big, H1, Muted, Press } from '../ui/kit';
import { RadiusChooser, WhereChooser } from '../ui/WherePick';
import { useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

export default function Zona() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const prefs = useApp((s) => s.prefs) as Prefs;
  const start = useMemo<Home>(() => (APP.hasHere() && prefs.here ? APP.homeAt(prefs.here) : prefs.home ?? APP.homeAt(APP.origin())), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [home, setHome] = useState<Home>(start);
  const [live, setLive] = useState(!!prefs.live && APP.hasHere());
  const [km, setKm] = useState(APP.radiusKm());
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));
  const save = () => {
    savePrefs({ home, radiusKm: km, live, zone: nearestZone(home).id, here: live ? { lat: home.lat, lon: home.lon, at: Date.now() } : undefined } as Partial<Prefs>);
    resetFilters();
    toast('Pleci din ' + home.name + ', până la ' + km + ' km. Am refăcut recomandările.');
    back();
  };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <H1 style={{ fontSize: 34, lineHeight: 35 }}>De unde pleci?</H1>
        <Muted>Toate planurile și locurile se socotesc de aici.</Muted>
        <WhereChooser value={home} live={live} onPick={(h, l) => { setHome(h); setLive(l); }} />
        <H1 style={{ marginTop: 8, fontSize: 26, lineHeight: 28 }}>Cât de departe?</H1>
        <RadiusChooser home={home} km={km} moves={prefs.moves} onKm={setKm} onMove={(h) => { setHome(h); setLive(false); }} />
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(ins.bottom, 12) + 14, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.bg }}>
        <Big label={'Gata: ' + home.name + ', ' + km + ' km'} color="#0E1440" onPress={save} />
      </View>
      <TopShade />
    </View>
  );
}
