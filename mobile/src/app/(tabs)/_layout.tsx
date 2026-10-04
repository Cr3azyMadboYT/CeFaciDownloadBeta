// The bottom bar from the design: Acasă, Explorează, Planuri, Profil, Plus (blurred while Plus is a closed gift).
import { Tabs, router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { useApp } from '../../lib/session';
import { Icon } from '../../ui/Icon';
import { PlusNotice } from '../../ui/PlusNotice';
import { Tour } from '../../ui/Tour';
import { TourTarget } from '../../ui/TourTarget';
import { Press, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';

const TAB_ICON: Record<string, string> = {
  acasa: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  exploreaza: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265zM2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
  planuri: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2',
  profil: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
  plus: 'M12 2l2.9 6.9L22 9.3l-5.4 4.8L18.2 21 12 17.3 5.8 21l1.6-6.9L2 9.3l7.1-.4z',
};
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
const LABEL: Record<string, string> = { acasa: 'Acasă', exploreaza: 'Explorează', planuri: 'Planuri', profil: 'Profil', plus: 'Plus' };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const plus = useApp((s) => s.board.plus);
  const veiled = !plus || plus === 'locked' || plus === 'off';
  return (
    <View style={{ flexDirection: 'row', paddingTop: 8, paddingHorizontal: 12, paddingBottom: Math.max(ins.bottom, 8) + 8, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line }}>
      {state.routes.map((r, i) => {
        const on = state.index === i && r.name !== 'exploreaza';
        const isPlus = r.name === 'plus';
        const color = isPlus ? '#E0A800' : on ? t.blueInk : t.ink3;
        return (
          <TourTarget key={r.key} id={'tab-' + r.name} style={{ flex: 1 }}>
          <Press style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: isPlus && veiled ? 0.55 : 1 }}
            accessibilityLabel={isPlus ? (veiled ? (plus === 'off' ? 'CeFaci Plus, oprit' : 'Plus: un cadou de la Bilu') : 'CeFaci Plus') : LABEL[r.name]}
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (r.name === 'exploreaza') { router.push('/rezultate'); return; }
              const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
              if (!ev.defaultPrevented) navigation.navigate(r.name);
            }}>
            <Icon d={TAB_ICON[r.name]} color={color} />
            <T style={{ fontFamily: F.sb, fontSize: 12, color: on ? t.ink : t.ink3 }}>{LABEL[r.name]}</T>
          </Press>
          </TourTarget>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTheme();
  return (
    <>
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg }, animation: 'fade' }}>
      <Tabs.Screen name="acasa" />
      <Tabs.Screen name="exploreaza" />
      <Tabs.Screen name="planuri" />
      <Tabs.Screen name="profil" />
      <Tabs.Screen name="plus" />
    </Tabs>
    <PlusNotice />
    <Tour />
    </>
  );
}
