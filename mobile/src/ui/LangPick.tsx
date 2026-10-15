// RO 🇷🇴 / EN 🇬🇧: o pastilă cu două jumătăți (Profil, ecranul de start, Setări). Schimbarea redesenează toată aplicația.
import { View } from 'react-native';
import { chooseLang, useLang, type Lang } from '../lib/i18n';
import { Press, T } from './kit';
import { F, useTheme } from './theme';

export function LangPick({ dark = false }: { dark?: boolean }) {
  const { t } = useTheme();
  const cur = useLang();
  const opt = (l: Lang, flag: string) => {
    const on = cur === l;
    return (
      <Press key={l} onPress={() => { if (!on) chooseLang(l); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
        accessibilityLabel={l === 'ro' ? 'Română' : 'English'}
        style={{ minWidth: 52, height: 36, paddingHorizontal: 8, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: on ? (dark ? '#FFFFFF' : t.ink) : 'transparent' }}>
        <T style={{ fontSize: 14 }}>{flag}</T>
        <T style={{ fontFamily: F.b, fontSize: 12, color: on ? (dark ? '#0E1440' : t.bg) : dark ? '#FFFFFF' : t.ink2 }}>{l.toUpperCase()}</T>
      </Press>
    );
  };
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 4, borderRadius: 99, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : t.s2 }}>
      {opt('ro', '🇷🇴')}
      {opt('en', '🇬🇧')}
    </View>
  );
}
