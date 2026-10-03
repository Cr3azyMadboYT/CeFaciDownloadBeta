// "Biletul serii": the plan as a yellow ticket, then what's left to do (book a table directly with the place),
// directions, calendar, sending it to friends.
import { useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP, useApp } from '../../lib/session';
import { fmtDur } from '../../lib/filters';
import { removePlan, updPlan, type Plan } from '../../lib/plans';
import { toast } from '../../lib/toast';
import { Avatar } from '../../ui/Avatar';
import { Icon } from '../../ui/Icon';
import { Big, H1, Muted, Press, Quiet, Sheet, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';

const MONTHS = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
function dayOf(when: string) {
  const d = new Date();
  if (when === 'tom') d.setDate(d.getDate() + 1);
  if (when === 'we') d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d;
}
const dateText = (when: string) => { const d = dayOf(when); return (when === 'tom' ? 'Mâine, ' : when === 'we' ? 'Sâmbătă, ' : when === 'now' ? 'Azi, acum' : 'Azi, ') + (when === 'now' ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()]); };
const dayLong: Record<string, string> = { now: 'azi', eve: 'azi', tom: 'mâine', we: 'sâmbătă' };
const pad = (n: number) => String(n).padStart(2, '0');

export default function Bilet() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const pl = useApp((s) => ((s.board.plans as Plan[] | undefined) ?? []).find((x) => String(x.pid) === String(pid)));
  const name = useApp((s) => s.prefs.name);
  const [ext, setExt] = useState<'closed' | 'pick' | 'back'>('closed');
  const [via, setVia] = useState('telefon');
  const p = pl ? APP.byId(pl.placeId) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));

  if (!pl || !p) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>Planul nu mai e aici.</H1>
        <Big label="Înapoi" onPress={close} />
      </View>
    );
  }
  const needsRes = p.res !== 'none';
  const noted = pl.res === 'noted';
  const ct = p.contact;
  const atSlot = pl.slot === 'acum' ? 'acum' : dayLong[pl.when] + ' la ' + pl.slot;
  const people = pl.people + (pl.people === 1 ? ' persoană' : ' persoane');
  const script = 'Bună ziua! Aș vrea ' + (ct?.unit ?? 'o masă') + ' pentru ' + people + ', ' + atSlot + ', pe numele ' + (name || 'meu') + '.';
  const open = APP.openLabel(p.id, pl.when);
  const go = (url: string, how: string) => { setVia(how); setExt('back'); Linking.openURL(url).catch(() => toast('Nu am putut deschide ' + how + '.')); };
  const navUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.real.lat + ',' + p.real.lon);
  const calendar = () => {
    const d = dayOf(pl.when);
    const [h, m] = pl.slot === 'acum' ? [new Date().getHours(), new Date().getMinutes()] : pl.slot.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    const end = new Date(d.getTime() + Math.max(1, p.dur) * 3600e3);
    const z = (x: Date) => x.getUTCFullYear() + pad(x.getUTCMonth() + 1) + pad(x.getUTCDate()) + 'T' + pad(x.getUTCHours()) + pad(x.getUTCMinutes()) + '00Z';
    Linking.openURL('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(p.name) + '&dates=' + z(d) + '/' + z(end) + '&details=' + encodeURIComponent('Plan făcut în CeFaci') + '&location=' + encodeURIComponent(p.real.lat + ',' + p.real.lon)).catch(() => {});
  };
  const send = () => Share.share({ message: 'Hai la ' + p.name + ' (' + p.title.toLowerCase() + '), ' + atSlot + '. ' + navUrl }).catch(() => {});

  const Row = ({ icon, bg, title, sub, btn, onPress, ink }: { icon: string; bg: string; ink: string; title: string; sub: string; btn?: string; onPress?: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, borderRadius: 18, backgroundColor: bg }}>
      <Icon d={icon} color={ink} />
      <View style={{ flex: 1, gap: 3 }}>
        <T style={{ fontFamily: F.b, fontSize: 14, lineHeight: 18 }}>{title}</T>
        <T style={{ fontFamily: F.m, fontSize: 13, lineHeight: 17, color: t.ink2 }}>{sub}</T>
      </View>
      {btn ? (
        <Press onPress={onPress} style={{ height: 44, paddingHorizontal: btn === 'Anulează' ? 12 : 16, borderRadius: 14, backgroundColor: btn === 'Anulează' ? 'transparent' : t.blue, justifyContent: 'center' }}>
          <T style={{ fontFamily: F.sb, fontSize: 15, color: btn === 'Anulează' ? t.ink2 : '#FFFFFF' }}>{btn}</T>
        </Press>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, height: ins.top + 52 }}>
        <Press onPress={close} accessibilityLabel="Închide" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={t.ink} /></Press>
        <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15, color: t.ink2 }}>Plan confirmat</T>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(ins.bottom, 12) + 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginHorizontal: 10, height: 12, borderRadius: 99, backgroundColor: t.dark ? '#000000' : '#0E1440', zIndex: 2 }} />
        <View style={{ marginTop: -6, marginHorizontal: 20, borderRadius: 22, backgroundColor: '#FFD43B' }}>
          <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T style={{ fontFamily: F.b, fontSize: 13, color: '#3A4270' }}>Biletul serii</T>
              <Icon name="ticket" color="#3A4270" />
            </View>
            <T style={{ marginTop: 10, fontFamily: F.display, fontSize: 58, lineHeight: 54, letterSpacing: -2.3, color: '#0E1440' }}>Asta facem.</T>
            <View style={{ marginTop: 18, flexDirection: 'row', gap: 12 }}>
              <Cell label="Când" value={dateText(pl.when)} />
              <Cell label="Cu cine" value={pl.people === 1 ? 'Doar tu' : pl.people + ' persoane'} />
            </View>
            <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: '#0E1440' }} />
              <T style={{ width: 48, fontFamily: F.display, fontSize: 16, color: '#0E1440' }}>{pl.slot}</T>
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 16, lineHeight: 21, color: '#0E1440' }}>{p.title + ', ' + p.name}</T>
            </View>
            <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar size={30} />
              <T style={{ fontFamily: F.b, fontSize: 16, color: '#0E1440' }}>{pl.people === 1 ? 'Doar tu' : 'Veniți ' + pl.people}</T>
            </View>
          </View>
          <View style={{ height: 24 }}>
            <View style={{ position: 'absolute', left: -12, top: 0, width: 24, height: 24, borderRadius: 99, backgroundColor: t.bg }} />
            <View style={{ position: 'absolute', right: -12, top: 0, width: 24, height: 24, borderRadius: 99, backgroundColor: t.bg }} />
            <View style={{ position: 'absolute', left: 20, right: 20, top: 11, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(14,20,64,0.35)' }} />
          </View>
          <View style={{ paddingTop: 10, paddingLeft: 20, paddingRight: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 }}>
            <Cell label="Cost de persoană" value={p.price === 0 ? 'Gratuit' : '~' + p.price + ' lei'} />
            <Cell label={needsRes ? 'Rezervare' : 'Durată'} value={needsRes ? (noted ? 'Prin ' + (pl.resVia ?? 'telefon') : 'Încă nefăcută') : fmtDur(p.dur)} dot={needsRes ? (noted ? '#2F5BFF' : '#D93A1C') : undefined} />
          </View>
        </View>

        <View style={{ marginTop: 12, marginHorizontal: 20, gap: 10 }}>
          {needsRes && !noted ? (
            <Row icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 8v4M12 16h.01" bg={p.res === 'required' ? t.coralSoft : t.yellowSoft} ink={p.res === 'required' ? t.coralInk : t.yellowInk}
              title={p.res === 'required' ? p.name + ' cere rezervare' : 'Se umple repede la ' + p.name} sub="Faceți o rezervare ca să vă asigurați locul." btn="Rezervă" onPress={() => setExt('pick')} />
          ) : null}
          {noted ? (
            <Row icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M9 12l2 2 4-4" bg={t.blueSoft} ink={t.blueInk} title={'Rezervat prin ' + (pl.resVia ?? 'telefon') + ' la ' + p.name}
              sub={dayLong[pl.when].charAt(0).toUpperCase() + dayLong[pl.when].slice(1) + ', ' + pl.slot + ', ' + people + ', pe numele ' + (name || 'tău') + '.'} btn="Anulează"
              onPress={() => { updPlan(pl.pid, { res: 'none', resVia: undefined }); toast('Am scos rezervarea de pe bilet. Anunță-i și pe ei' + (ct?.phone ? ': ' + ct.phone : '') + '.'); }} />
          ) : null}
          {open ? <Muted style={{ paddingHorizontal: 4 }}>{open + (p.real.street ? ' · ' + p.real.street : '')}</Muted> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Action icon="M3 11 22 2l-9 19-2-8z" label="Navighează" primary onPress={() => Linking.openURL(navUrl).catch(() => {})} />
            <Action icon="M8 2v4M16 2v4M3 10h18M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M19 16v6M16 19h6" label="În calendar" onPress={calendar} />
            <Action icon="M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" label="Trimite gășcii" onPress={send} />
          </View>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <Quiet label="Renunț la plan" color={t.ink2} onPress={() => { removePlan(pl.pid); toast('Ai renunțat la ' + p.name + '.'); close(); }} />
          </View>
        </View>
      </ScrollView>

      <Sheet open={ext !== 'closed'} onClose={() => setExt('closed')}>
        {ext === 'pick' ? (
          <View style={{ gap: 10 }}>
            <H1 style={{ fontSize: 26 }}>Rezervă la {p.name}</H1>
            <Muted style={{ fontSize: 15, lineHeight: 21 }}>{p.name} nu primește încă rezervări prin CeFaci. Rezervi direct la ei, apoi o notezi aici.</Muted>
            {ct?.phone ? <Big label={'Sună · ' + ct.phone} icon={<Icon name="phone" color="#FFFFFF" />} onPress={() => go('tel:' + ct.phone.replace(/[^\d+]/g, ''), 'telefon')} /> : null}
            {ct?.site ? <Big label="Rezervă pe site-ul lor" color={t.violet} ink="#0E1440" icon={<Icon name="globe" color="#0E1440" />} onPress={() => go(/^https?:/.test(ct.site) ? ct.site : 'https://' + ct.site, 'site')} /> : null}
            {!ct?.phone && !ct?.site ? <Muted>Nu avem încă telefonul sau site-ul lor. Treceți pe acolo sau încercați fără rezervare.</Muted> : null}
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: t.s2 }}>
              <T style={{ fontFamily: F.m, fontSize: 14, lineHeight: 20 }}>{script}</T>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <H1 style={{ fontSize: 26 }}>Ai rezervat?</H1>
            <Muted style={{ fontSize: 15, lineHeight: 21 }}>O notăm pe bilet, ca s-o vadă și cine vine cu tine.</Muted>
            <Big label="Da, notează rezervarea" onPress={() => { updPlan(pl.pid, { res: 'noted', resVia: via }); setExt('closed'); toast('Am notat rezervarea pe bilet.'); }} />
            <Big label="Nu mai au loc" color={t.s2} ink={t.ink} onPress={() => { setExt('closed'); removePlan(pl.pid); toast('Am scos ' + p.name + ' din planuri. Uite ce se mai potrivește.'); router.replace('/rezultate'); }} />
            <Quiet label="Mai târziu" onPress={() => setExt('closed')} />
          </View>
        )}
      </Sheet>
    </View>
  );
}

function Cell({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <T style={{ fontFamily: F.sb, fontSize: 12, color: '#3A4270' }}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {dot ? <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: dot }} /> : null}
        <T style={{ fontFamily: F.b, fontSize: 17, lineHeight: 20, color: '#0E1440' }}>{value}</T>
      </View>
    </View>
  );
}

function Action({ icon, label, onPress, primary }: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} style={{ flex: 1, height: 62, borderRadius: 16, borderWidth: primary ? 0 : 1, borderColor: t.line, backgroundColor: primary ? t.blue : t.s1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Icon d={icon} color={primary ? '#FFFFFF' : t.ink} />
      <T style={{ fontFamily: F.sb, fontSize: 13, color: primary ? '#FFFFFF' : t.ink }}>{label}</T>
    </Press>
  );
}
