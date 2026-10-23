// „Biletele mele” (Bilete, faza 3, 22.10): the tickets bought in CeFaci. Each one has its own QR, made on the phone
// without internet and changed every 30 seconds (a screenshot stops working); at the door the venue scans it once.
// A ticket can go to a friend from CeFaci: their QR is new, the old one stops. Part of the removable events feature.
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from '../ui/insets';
import { Icon } from '../ui/Icon';
import { SkyHeader } from '../ui/SkyHeader';
import { EmptyTicket } from '../ui/EmptyTicket';
import { Big, H1, Muted, Note, Press, Quiet, Sheet, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { tr, trServer } from '../lib/i18n';
import { useApp } from '../lib/session';
import { listFriends, type Person } from '../lib/friends';
import { giveTicket, useMyTickets, useTicketQr } from '../features/events/tickets';
import { whenOf } from '../features/events/EventsRail';
import type { MyTicket } from '../../../src/events/tickets';

export default function Bilete() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const list = useMyTickets();
  const [open, setOpen] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/planuri'));
  const valid = list.filter((x) => x.status === 'valid');
  const rest = list.filter((x) => x.status !== 'valid');
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 24 }}>
        <SkyHeader title={tr('Biletele mele')} onBack={back} bilu={!!list.length} mood={valid.length ? 'yay' : 'wink'} sub={valid.length ? tr('Codul de intrare merge și fără internet') : undefined} />
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
        {!list.length ? <EmptyTicket title={tr('Niciun bilet încă.')} text={tr('Biletele cumpărate în CeFaci apar aici, cu codul de la intrare. Merg și fără internet.')} /> : null}
        {valid.map((x) => <TicketCard key={x.id} x={x} open={open === x.id} onToggle={() => setOpen(open === x.id ? null : x.id)} />)}
        {rest.length ? <Muted style={{ marginTop: 8 }}>{tr('Folosite sau rambursate')}</Muted> : null}
        {rest.map((x) => <TicketCard key={x.id} x={x} open={false} onToggle={() => {}} />)}
      </View>
      </ScrollView>
    </View>
  );
}

function TicketCard({ x, open, onToggle }: { x: MyTicket; open: boolean; onToggle: () => void }) {
  const { t } = useTheme();
  const w = whenOf(x.event.starts_at);
  const qr = useTicketQr(x.id, open ? x.secret : null);
  const [give, setGive] = useState(false);
  const valid = x.status === 'valid';
  return (
    <View style={{ borderRadius: 22, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, overflow: 'hidden', opacity: valid ? 1 : 0.6 }}>
      <Press onPress={valid ? onToggle : undefined} accessibilityLabel={tr('{title}, {type}, {day} la {time}', { title: x.event.title, type: x.type, day: w.day, time: w.time })} style={{ padding: 16, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T style={{ flex: 1, fontFamily: F.sb, fontSize: 13, color: t.blueInk }}>{w.day + ' · ' + w.time + ' · ' + x.type}</T>
          {x.test ? <T style={{ fontFamily: F.b, fontSize: 12, color: t.coralInk }}>{tr('TEST')}</T> : null}
        </View>
        <T style={{ fontFamily: F.b, fontSize: 18 }}>{x.event.title}</T>
        <Muted>{x.event.place_name}</Muted>
        {x.status === 'folosit' ? <Muted>{tr('Folosit la intrare.')}</Muted> : null}
        {x.status === 'rambursat' ? <Muted>{tr('Evenimentul s-a anulat; banii se întorc pe card.')}</Muted> : null}
        {valid && !open ? <T style={{ marginTop: 6, fontFamily: F.b, fontSize: 14, color: t.blueInk }}>{tr('Arată codul de intrare')}</T> : null}
      </Press>
      {valid && open ? (
        <View style={{ alignItems: 'center', paddingBottom: 18, gap: 10 }}>
          <View style={{ padding: 14, backgroundColor: '#FFFFFF', borderRadius: 18 }}>
            {qr ? <QRCode value={qr} size={220} /> : <View style={{ width: 220, height: 220 }} />}
          </View>
          <Muted style={{ textAlign: 'center', paddingHorizontal: 20 }}>{tr('Codul se schimbă singur. Arată-l la intrare de pe telefon; o poză a lui nu merge.')}</Muted>
          {x.event.status === 'cancelled' ? <Note kind="err">{tr('Evenimentul a fost anulat.')}</Note> : null}
          {x.transfers < 3 ? <Quiet label={tr('Dă biletul unui prieten')} onPress={() => setGive(true)} /> : null}
        </View>
      ) : null}
      <GiveSheet open={give} x={x} onClose={() => setGive(false)} />
    </View>
  );
}

function GiveSheet({ open, x, onClose }: { open: boolean; x: MyTicket; onClose: () => void }) {
  const { t } = useTheme();
  const me = useApp((s) => s.who?.id);
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [pick, setPick] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open && !friends && me) void listFriends(me).then((r) => setFriends(r.filter((f) => f.status === 'accepted').map((f) => f.person)));
  }, [open, friends, me]);
  const send = async () => {
    if (!pick) return;
    setBusy(true); setErr('');
    const m = await giveTicket(x.id, pick.id);
    setBusy(false);
    if (m) { setErr(trServer(m)); return; }
    setPick(null); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 24 }}>{tr('Cui îi dai biletul?')}</T>
        <Muted>{tr('Prietenul îl vede în „Biletele mele”, cu un cod nou. Codul tău nu mai merge.')}</Muted>
        {friends && !friends.length ? <Muted>{tr('Încă nu ai prieteni în CeFaci.')}</Muted> : null}
        {(friends ?? []).map((f) => (
          <Press key={f.id} onPress={() => setPick(f)} style={{ padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: pick?.id === f.id ? t.blue : t.line, backgroundColor: t.s1 }}>
            <T style={{ fontFamily: F.b, fontSize: 16 }}>{f.first_name}</T>
            <Muted>{'@' + f.username}</Muted>
          </Press>
        ))}
        {err ? <Note kind="err">{err}</Note> : null}
        <Big label={busy ? tr('Trimit…') : pick ? tr('Trimite biletul către {name}', { name: pick.first_name }) : tr('Alege un prieten')} disabled={!pick || busy} onPress={() => void send()} />
      </View>
    </Sheet>
  );
}
