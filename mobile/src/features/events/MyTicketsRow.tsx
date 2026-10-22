// Planuri: „Biletele mele (n)” when the person has tickets bought in CeFaci (Bilete, faza 3). Nothing otherwise.
import { View } from 'react-native';
import { router } from 'expo-router';
import { tr } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { Press, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { EVENTS_ON } from './flag';
import { useMyTickets } from './tickets';

export function MyTicketsRow() {
  const { t } = useTheme();
  const n = useMyTickets().filter((x) => x.status === 'valid').length;
  if (!EVENTS_ON || !n) return null;
  return (
    <Press onPress={() => router.push('/bilete')} style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: t.navy }}>
      <Icon name="ticket" color="#FFD43B" />
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.b, fontSize: 16, color: '#FFFFFF' }}>{tr('Biletele mele ({n})', { n })}</T>
        <T style={{ fontFamily: F.sb, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{tr('Codul de intrare merge și fără internet')}</T>
      </View>
      <Icon name="next" size={16} color="#FFFFFF" />
    </Press>
  );
}
