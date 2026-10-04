import { Image, View } from 'react-native';
import { useApp } from '../lib/session';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/** Your photo (Profil → tap the portrait), or the design's placeholder portrait. */
export function Avatar({ size, ring = '#FFD43B' }: { size: number; ring?: string }) {
  const photo = useApp((s) => s.board.avatar as string | undefined);
  return (
    <View style={{ borderRadius: 999, borderWidth: 2.5, borderColor: ring }}>
      <View style={{ width: size, height: size, borderRadius: 999, overflow: 'hidden' }}>
        {photo ? <Image source={{ uri: photo }} style={{ width: size, height: size }} accessibilityLabel="Poza ta de profil" /> : (
        <Svg width={size} height={size} viewBox="18 26 64 64">
          <Rect width={100} height={125} fill="#FFD43B" />
          <Circle cx={82} cy={20} r={26} fill="#FFE58A" />
          <Path d="M8 125 C10 98 29 88 50 88 C71 88 90 98 92 125 Z" fill="#FF6A4D" />
          <Path d="M43 70 H57 V92 H43 Z" fill="#D9967A" />
          <Ellipse cx={50} cy={56} rx={18} ry={21} fill="#EDB08F" />
          <Path d="M31 60 C27 37 39 28 51 29 C64 30 72 40 69 57 C66 47 58 42 47 43 C39 44 34 50 33 61 Z" fill="#0E1440" />
        </Svg>
        )}
      </View>
    </View>
  );
}

/** The same portrait, uncropped, for the passport card on Profil (80×100). */
export function Portrait() {
  const photo = useApp((s) => s.board.avatar as string | undefined);
  if (photo) return <Image source={{ uri: photo }} style={{ width: 80, height: 100, borderRadius: 10 }} accessibilityLabel="Poza ta de profil" />;
  return (
    <View style={{ width: 80, height: 100, borderRadius: 10, overflow: 'hidden' }}>
      <Svg width={80} height={100} viewBox="0 0 100 125">
        <Rect width={100} height={125} fill="#FFD43B" />
        <Circle cx={82} cy={20} r={26} fill="#FFE58A" />
        <Path d="M8 125 C10 98 29 88 50 88 C71 88 90 98 92 125 Z" fill="#FF6A4D" />
        <Path d="M43 70 H57 V92 H43 Z" fill="#D9967A" />
        <Ellipse cx={50} cy={56} rx={18} ry={21} fill="#EDB08F" />
        <Path d="M31 60 C27 37 39 28 51 29 C64 30 72 40 69 57 C66 47 58 42 47 43 C39 44 34 50 33 61 Z" fill="#0E1440" />
      </Svg>
    </View>
  );
}
