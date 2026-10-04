// Pieces of a plan shown on more screens: the ✓ / ⚠ checks and one step (hour, place, what it is for).
import { View } from 'react-native';
import type { Shown } from '../lib/planAsk';
import { Icon } from './Icon';
import { T } from './kit';
import { F, useTheme } from './theme';

/** The ✓ / ⚠ chips of a plan. */
export function Checks({ plan }: { plan: Shown }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {plan.checks.map((c) => (
        <View key={c.text} style={{ minHeight: 26, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: c.ok ? t.greenSoft : t.coralSoft, justifyContent: 'center' }}>
          <T style={{ fontFamily: F.sb, fontSize: 12, color: c.ok ? t.greenInk : t.coralInk }}>{(c.ok ? '✓ ' : '⚠ ') + c.text}</T>
        </View>
      ))}
    </View>
  );
}

/** One step: the hour, the place's colour and icon, the name and what it is for. */
export function StepRow({ s }: { s: Shown['steps'][number] }) {
  const { t } = useTheme();
  const city = s.place.real.city || s.place.zone;
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <T style={{ width: 46, fontFamily: F.b, fontSize: 15 }}>{s.slot}</T>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: s.place.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={s.place.icon as never} size={22} color={s.place.fg} /></View>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} style={{ fontFamily: F.b, fontSize: 15 }}>{s.place.name}</T>
        <T numberOfLines={1} style={{ fontFamily: F.m, fontSize: 12.5, color: t.ink2 }}>{s.why + ' · ' + city + ' · ~' + s.place.price + ' lei' + (/până la/.test(s.open) ? ' · ' + s.open.replace('Deschis ', '') : '')}</T>
      </View>
    </View>
  );
}

