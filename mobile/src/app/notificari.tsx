// Notificări (22.10, Cornel: „un buton de notificări să vezi tot ce ai primit”): the bell on Acasă opens this list.
// Everything the server sent you (votes, plans, crews, friends, FreeNow), newest first; tap = where it leads.
// Opening the list marks everything read (lib/inbox.ts).
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { Icon, type IconName } from '../ui/Icon';
import { H1, Muted, Press, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { EmptyTicket } from '../ui/EmptyTicket';
import { SkyHeader } from '../ui/SkyHeader';
import { tr, pick, locale } from '../lib/i18n';
import { readAll, refreshInbox, useInbox, type Inbox } from '../lib/inbox';

const ICON: Record<string, IconName> = { vote: 'users', plan: 'ticket', crew: 'users', free: 'bolt', free_join: 'bolt', free_left: 'bolt', friend: 'userPlus', friend_ok: 'heart' };

/** „acum 5 min”, „azi, 21:04”, „ieri, 18:30”, „marți, 12 oct.” */
function when(iso: string, now = new Date()) {
  const d = new Date(iso);
  const min = Math.round((now.getTime() - d.getTime()) / 60000);
  const hm = d.toTimeString().slice(0, 5);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 864e5);
  if (min < 1) return tr('chiar acum');
  if (min < 60) return tr('acum {n} min', { n: min });
  if (days === 0) return tr('azi, {t}', { t: hm });
  if (days === 1) return tr('ieri, {t}', { t: hm });
  return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function Notificari() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const list = useInbox();
  const [unreadAtOpen] = useState(() => new Set(list.filter((x) => !x.read_at).map((x) => x.id)));
  const [pulling, setPulling] = useState(false);
  useEffect(() => { void refreshInbox().then(readAll); }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));
  const pull = async () => { setPulling(true); await refreshInbox(); readAll(); setPulling(false); };
  const open = (x: Inbox) => { try { router.push(x.url as never); } catch { /* an old link */ } };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}>
        <SkyHeader title={tr('Notificări')} onBack={back} bilu={!!list.length} mood={list.some((x) => !x.read_at) ? 'up' : 'wink'} sub={list.length ? tr('Tot ce ai primit') : undefined} />
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
        {!list.length ? (
          <EmptyTicket title={tr('Liniște deocamdată')} text={tr('Aici apar cererile de prietenie, invitațiile în gașcă, voturile și planurile la care te cheamă prietenii.')} />
        ) : null}
        {list.map((x) => {
          const fresh = unreadAtOpen.has(x.id);
          return (
            <Press key={x.id} onPress={() => open(x)} accessibilityLabel={pick(x.title, x.title_en || x.title)}
              style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: fresh ? t.blueSoft ?? t.s1 : t.s1, borderWidth: 1, borderColor: fresh ? t.blue : t.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: fresh ? t.blue : t.s2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ICON[x.kind] ?? 'bell'} size={19} color={fresh ? '#FFFFFF' : t.ink} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontFamily: F.b, fontSize: 15, lineHeight: 20 }}>{pick(x.title, x.title_en || x.title)}</T>
                <Muted>{pick(x.body, x.body_en || x.body)}</Muted>
                <T style={{ marginTop: 2, fontFamily: F.sb, fontSize: 12, color: t.ink3 }}>{when(x.created_at)}</T>
              </View>
              <View style={{ justifyContent: 'center' }}><Icon name="next" size={16} color={t.ink3} /></View>
            </Press>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}
