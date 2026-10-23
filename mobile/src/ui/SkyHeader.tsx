// The sky header for the inner screens (23.10, Cornel: „ecranele mai frumoase … pe tematica aplicației”): the same
// sky as on Acasă (colour of the hour, stars, the city with lit windows), the title in white and Bilu on the right.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { phaseOfHour } from '../lib/filters';
import { tr } from '../lib/i18n';
import { Bilu, type Mood } from './Bilu';
import { Icon } from './Icon';
import { useSafeAreaInsets } from './insets';
import { Press, T } from './kit';
import { Sky, SKY_BG } from './Sky';
import { F } from './theme';

export function SkyHeader({ title, sub, onBack, right, mood = 'wink', children, bilu = true }: {
  title: string; sub?: string; onBack?: () => void; right?: ReactNode; mood?: Mood; children?: ReactNode; bilu?: boolean;
}) {
  const ins = useSafeAreaInsets();
  const phase = phaseOfHour(new Date().getHours());
  return (
    <View style={{ backgroundColor: SKY_BG[phase], paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' }}>
      <Sky phase={phase} />
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
        {onBack ? (
          <Press onPress={onBack} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, marginLeft: -6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" color="#FFFFFF" />
          </Press>
        ) : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 38, lineHeight: 39, letterSpacing: -1, color: '#FFFFFF' }}>{title}</T>
          {sub ? <T style={{ fontFamily: F.sb, fontSize: 15, color: 'rgba(255,255,255,0.86)' }}>{sub}</T> : null}
        </View>
        {bilu ? <View style={{ marginBottom: -6 }}><Bilu size={84} mood={mood} /></View> : null}
      </View>
      {children}
    </View>
  );
}
