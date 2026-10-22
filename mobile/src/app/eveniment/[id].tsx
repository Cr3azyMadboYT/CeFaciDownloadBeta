// An event (Evenimente, 22.10): when, where, how much, and "Cumpără bilete" at the official seller. CeFaci never sells,
// takes money or refunds; the screen says so before the button, in plain words (Cornel: „lucrăm cu banii altora”).
// Part of the removable feature mobile/src/features/events (docs/evenimente.md).
import { useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { Icon } from '../../ui/Icon';
import { Big, H1, Muted, Note, Press, T, Tag } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { tr, trServer, pick } from '../../lib/i18n';
import { APP } from '../../lib/session';
import { eventById, openTickets, useEvents } from '../../features/events/data';
import { KIND_LOOK, whenOf } from '../../features/events/EventsRail';
import { EVENTS_ON } from '../../features/events/flag';
import { TicketBuy } from '../../features/events/TicketBuy';
import { KIND_LABEL, priceText, sellerOf } from '../../../../src/events/events';

export default function Eveniment() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  useEvents(); // keeps the event fresh (a change from Admin: sold out, postponed, cancelled)
  const e = EVENTS_ON ? eventById(String(id)) : null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));

  if (!e) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 16, paddingHorizontal: 20, gap: 12 }}>
        <H1>{tr('Evenimentul nu mai e în listă.')}</H1>
        <Muted>{tr('S-a terminat sau organizatorul l-a scos.')}</Muted>
        <Big label={tr('Înapoi')} onPress={back} />
      </View>
    );
  }
  const look = KIND_LOOK[e.kind];
  const w = whenOf(e.starts_at);
  const end = e.ends_at ? whenOf(e.ends_at).time : null;
  const price = priceText(e, tr);
  const seller = sellerOf(e.ticket_url) ?? e.seller;
  const inApp = e.sale_mode === 'cefaci'; // sold by the venue in CeFaci (faza 3)
  const canBuy = !inApp && !!seller && (e.status === 'published' || e.status === 'postponed');
  const minorBlocked = APP.isMinor() && (e.min_age ?? 0) >= 18;
  const about = pick(e.about, e.about_en || e.about);
  const nav = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.lat + ',' + e.lon);
  const buy = async () => {
    setBusy(true); setErr('');
    const m = await openTickets(e);
    setBusy(false);
    if (m) setErr(trServer(m));
  };
  const share = () => {
    void Share.share({ message: e.title + ' · ' + w.day + ' ' + w.time + ' · ' + e.place_name + (e.ticket_url && canBuy ? '\n' + e.ticket_url : '') + '\n' + tr('Găsit pe CeFaci') }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: ins.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
          <View style={{ flex: 1 }} />
          <Press onPress={share} accessibilityLabel={tr('Trimite prietenilor')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="share" color={t.ink} /></Press>
        </View>

        <View style={{ marginTop: 6, borderRadius: 24, backgroundColor: look.bg(t), padding: 18, gap: 8, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.14)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={look.icon} size={18} color={look.fg} />
            <T style={{ fontFamily: F.sb, fontSize: 13, color: look.fg }}>{tr(KIND_LABEL[e.kind])}{(e.min_age ?? 0) >= 18 ? ' · 18+' : ''}</T>
          </View>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.5, color: look.fg }}>{e.title}</T>
          <T style={{ fontFamily: F.b, fontSize: 16, color: look.fg }}>{w.day + ' · ' + w.time + (end ? '–' + end : '')}</T>
        </View>

        {e.status === 'cancelled' ? <View style={{ marginTop: 12 }}><Note kind="err">{inApp ? tr('Evenimentul a fost anulat. Dacă ai bilet din CeFaci, banii se întorc singuri pe card.') : seller ? tr('Evenimentul a fost anulat. Dacă ai bilet, banii îi dă înapoi {seller}, de la care l-ai cumpărat.', { seller }) : tr('Evenimentul a fost anulat.')}</Note></View> : null}
        {e.status === 'postponed' ? <View style={{ marginTop: 12 }}><Note kind="err">{inApp ? tr('Evenimentul a fost amânat. Biletele rămân valabile la data nouă.') : tr('Evenimentul a fost amânat. Data nouă o anunță organizatorul; verifică la vânzător.')}</Note></View> : null}
        {e.status === 'sold_out' ? <View style={{ marginTop: 12 }}><Note kind="err">{inApp ? tr('Biletele s-au terminat.') : tr('Biletele s-au terminat la vânzătorul oficial.')}</Note></View> : null}

        <View style={{ marginTop: 14, gap: 10 }}>
          <Row icon="pin" title={e.place_name} sub={e.address ?? undefined} />
          {price ? <Row icon="wallet" title={price} sub={tr('Prețul final îl vezi la vânzător.')} /> : null}
          {seller ? <Row icon="ticket" title={tr('Bilete pe {seller}', { seller })} sub={tr('Vânzătorul oficial')} /> : null}
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {e.venue_id && APP.byId(e.venue_id) ? <Pill label={tr('Vezi locul')} onPress={() => router.push({ pathname: '/loc/[id]', params: { id: e.venue_id! } })} /> : null}
          <Pill label={tr('Drum')} onPress={() => void Linking.openURL(nav)} />
        </View>
        {about ? <T style={{ marginTop: 16, fontFamily: F.m, fontSize: 15, lineHeight: 22, color: t.ink2 }}>{about}</T> : null}

        {canBuy ? (
          <View style={{ marginTop: 20, gap: 10 }}>
            {/* the money, said before the button */}
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, gap: 4 }}>
              <T style={{ fontFamily: F.b, fontSize: 14 }}>{tr('Cum plătești')}</T>
              <Muted>{tr('Biletul îl cumperi direct de la {seller}. CeFaci nu încasează bani și nu vede datele cardului. Pentru schimburi sau bani înapoi vorbești cu {seller}.', { seller: seller! })}</Muted>
            </View>
            {err ? <Note kind="err">{err}</Note> : null}
            {minorBlocked
              ? <Note kind="err">{tr('Evenimentul e de la 18 ani.')}</Note>
              : <Big label={busy ? tr('Deschid…') : tr('Cumpără bilete pe {seller}', { seller: seller! })} disabled={busy} icon={<Icon name="ticket" color="#FFFFFF" />} onPress={() => void buy()} />}
          </View>
        ) : null}
        {inApp && (e.status === 'published' || e.status === 'postponed') ? <TicketBuy e={e} blocked={minorBlocked} /> : null}
      </ScrollView>
    </View>
  );
}

function Row({ icon, title, sub }: { icon: 'pin' | 'wallet' | 'ticket'; title: string; sub?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.s2, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color={t.ink} /></View>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.sb, fontSize: 15 }}>{title}</T>
        {sub ? <Muted>{sub}</Muted> : null}
      </View>
    </View>
  );
}
function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, justifyContent: 'center' }}>
      <T style={{ fontFamily: F.sb, fontSize: 14 }}>{label}</T>
    </Press>
  );
}
