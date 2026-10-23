// The empty state of the inner screens (23.10, Cornel: „ecranele mai frumoase … pe tematica aplicației”): a yellow
// ticket with the two punched holes, what will appear here, an optional button and Bilu.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Bilu, type Mood } from './Bilu';
import { Big, T } from './kit';
import { F, useTheme } from './theme';

export function EmptyTicket({ title, text, action, onAction, mood = 'wink', children }: {
  title: string; text: string; action?: string; onAction?: () => void; mood?: Mood; children?: ReactNode;
}) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 18, borderRadius: 24, backgroundColor: '#FFD43B', padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: -10, top: '50%', width: 20, height: 20, borderRadius: 99, backgroundColor: t.bg }} />
      <View style={{ position: 'absolute', right: -10, top: '50%', width: 20, height: 20, borderRadius: 99, backgroundColor: t.bg }} />
      <View style={{ flex: 1, gap: 8 }}>
        <T style={{ fontFamily: F.display, fontSize: 24, lineHeight: 25, color: '#0E1440' }}>{title}</T>
        <T style={{ fontFamily: F.m, fontSize: 14, lineHeight: 19, color: '#2C3363' }}>{text}</T>
        {action && onAction ? <Big style={{ marginTop: 4 }} label={action} color="#0E1440" onPress={onAction} /> : null}
        {children}
      </View>
      <Bilu size={86} mood={mood} />
    </View>
  );
}
