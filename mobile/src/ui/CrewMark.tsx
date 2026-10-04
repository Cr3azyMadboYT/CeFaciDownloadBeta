import { View } from 'react-native';
import { iconOf } from '../lib/crews';
import { Icon } from './Icon';

/** A crew's stamp: a round mark with a dashed inner ring, in the crew's colour, slightly turned. */
export function CrewMark({ icon, color, size = 50, rot = '-6deg' }: { icon: string; color: string; size?: number; rot?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 999, borderWidth: 2.5, borderColor: color, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rot }] }}>
      <View style={{ position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color, opacity: 0.55 }} />
      <Icon name={iconOf(icon) as never} size={size * 0.44} color={color} />
    </View>
  );
}
