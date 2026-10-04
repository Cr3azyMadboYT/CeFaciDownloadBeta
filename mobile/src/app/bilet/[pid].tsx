// "Biletul serii": the plan as a yellow ticket, then what's left to do (book a table directly with the place),
// directions, calendar, sending it to friends.
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP, useApp } from '../../lib/session';
import { fmtDur } from '../../lib/filters';
import { clashWith, createPlanAt, dateText, dayWord, planDay, removePlan, startsAt, updPlan, type Plan } from '../../lib/plans';
import { dropShared, going, moveShared, sharePlan, watchPlans, type Going } from '../../lib/together';
import { SendTo, type Target } from '../../ui/SendTo';
import { checkIn, sendBill } from '../../lib/outing';
import { cancelReminders } from '../../lib/remind';
import { km } from '../../../../src/engine/core';
import { toast } from '../../lib/toast';
import { Avatar } from '../../ui/Avatar';
import { Dashed } from '../../ui/Dashed';
import { Icon } from '../../ui/Icon';
import { Big, Chip, H1, Muted, Press, Quiet, Sheet, T } from '../../ui/kit';
import { savePrefs } from '../../lib/session';
import { sb } from '../../lib/auth';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';

const pad = (n: number) => String(n).padStart(2, '0');
/** The chosen time and the half hours around it, for the booking. */
function slotsAround(slot: string) {
  const [h, m] = slot.split(':').map(Number);
  const base = (h < 5 ? h + 24 : h) * 60 + m; // 00:30 is the same night, after 23:30
  return [-60, -30, 0, 30, 60, 90].map((d) => base + d).filter((x) => x >= 8 * 60 && x <= 28 * 60).map((x) => pad(Math.floor(x / 60) % 24) + ':' + pad(x % 60));
}
/** A Romanian mobile number in the international form WhatsApp wants (4074…), or null for landlines. */
function waNumber(phone: string) {
  const d = phone.replace(/[^\d]/g, '').replace(/^00/, '');
  const n = d.startsWith('40') ? d : d.startsWith('0') ? '4' + d : d;
  return /^407\d{8}$/.test(n) ? n : null;
}
const REPORTS: [string, string][] = [['inchis', 'S-a închis definitiv'], ['program', 'Programul e greșit'], ['telefon', 'Telefonul sau site-ul e greșit'], ['pret', 'Prețul e mult diferit'], ['altceva', 'Altceva']];

export default function Bilet() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const pl = useApp((s) => ((s.board.plans as Plan[] | undefined) ?? []).find((x) => String(x.pid) === String(pid)));
  const name = useApp((s) => s.prefs.name);
  const [ext, setExt] = useState<'closed' | 'pick' | 'back'>('closed');
  const [busyIn, setBusyIn] = useState<'' | 'in' | 'bon'>('');
  const [bonPick, setBonPick] = useState(false);
  const [via, setVia] = useState('telefon');
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [to, setTo] = useState<Target | null>(null);
  const [sending, setSending] = useState(false);
  const [who, setWho] = useState<Going[]>([]);
  const me = useApp((s) => s.who);
  const all = useApp((s) => (s.board.plans as Plan[] | undefined));
  const onTo = useCallback((x: Target | null) => setTo(x), []);
  const sid = pl?.sid;
  const loadWho = useCallback(() => { if (sid) void going(sid).then(setWho); }, [sid]);
  useEffect(() => { loadWho(); if (!sid || !me) return; return watchPlans(me.id + '-' + sid, loadWho); }, [sid, me, loadWho]);
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
  const day = dayWord(pl);
  const atSlot = pl.slot === 'acum' ? 'acum' : day + ' la ' + pl.slot;
  const people = pl.people + (pl.people === 1 ? ' persoană' : ' persoane');
  const script = 'Bună ziua! Aș vrea ' + (ct?.unit ?? 'o masă') + ' pentru ' + people + ', ' + atSlot + ', pe numele ' + (name || 'meu') + '.';
  const open = APP.openLabel(p.id, pl.when, pl.slot === 'acum' ? undefined : startsAt(pl));
  const go = (url: string, how: string) => { setVia(how); setExt('back'); Linking.openURL(url).catch(() => toast('Nu am putut deschide ' + how + '.')); };
  const navUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.real.lat + ',' + p.real.lon);
  const calendar = () => {
    const d = planDay(pl);
    const [h, m] = pl.slot === 'acum' ? [new Date().getHours(), new Date().getMinutes()] : pl.slot.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    const end = new Date(d.getTime() + Math.max(1, p.dur) * 3600e3);
    const z = (x: Date) => x.getUTCFullYear() + pad(x.getUTCMonth() + 1) + pad(x.getUTCDate()) + 'T' + pad(x.getUTCHours()) + pad(x.getUTCMinutes()) + '00Z';
    Linking.openURL('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(p.name) + '&dates=' + z(d) + '/' + z(end) + '&details=' + encodeURIComponent('Plan făcut în CeFaci') + '&location=' + encodeURIComponent(p.real.lat + ',' + p.real.lon)).catch(() => {});
  };
  const clash = all ? clashWith(pl, all) : null;
  // Plan B: the nearest place of the same kind, a short walk away, in case this one is full
  const planB = (() => {
    let best: { id: string; name: string; m: number } | null = null;
    for (const x of APP.places) {
      if (x.id === p.id || x.real.cat !== p.real.cat) continue;
      const m = km(p.real, x.real) * 1000;
      if (m < 1500 && (!best || m < best.m)) best = { id: x.id, name: x.name, m };
    }
    return best;
  })();
  const clashP = clash ? APP.byId(clash.placeId) : undefined;
  const drop = () => { void cancelReminders(pl.remind); if (pl.sid && me) void dropShared(pl, me.id); removePlan(pl.pid); toast('Ai renunțat la ' + p.name + (pl.sid ? '. I-am anunțat și pe ceilalți.' : '.')); close(); };
  const shareToCrew = async () => {
    if (!to || !me) return;
    setSending(true);
    const e = await sharePlan(pl, me.id, { crewId: to.crewId, friendIds: to.friendIds });
    setSending(false);
    if (e) { toast(e); return; }
    setShareOpen(false);
    toast('Trimis! ' + to.label + ' răspund cu Vin sau Nu pot.');
    loadWho();
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
        <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15, color: t.ink2 }}>Planul tău</T>
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
              <Cell label="Când" value={pl.slot === 'acum' ? 'Azi, acum' : dateText(pl)} />
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
            <Dashed color="rgba(14,20,64,0.35)" style={{ position: 'absolute', left: 20, right: 20, top: 11 }} />
          </View>
          <View style={{ paddingTop: 10, paddingLeft: 20, paddingRight: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 }}>
            <Cell label="Cost de persoană" value={p.price === 0 ? 'Gratuit' : '~' + p.price + ' lei'} />
            <Cell label={needsRes ? 'Rezervare' : 'Durată'} value={needsRes ? (noted ? 'Prin ' + (pl.resVia ?? 'telefon') : 'Încă nefăcută') : fmtDur(p.dur)} dot={needsRes ? (noted ? '#2F5BFF' : '#D93A1C') : undefined} />
          </View>
        </View>

        <View style={{ marginTop: 12, marginHorizontal: 20, gap: 10 }}>
          {needsRes && !noted && !pl.inAt ? (
            <Row icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 8v4M12 16h.01" bg={p.res === 'required' ? t.coralSoft : t.yellowSoft} ink={p.res === 'required' ? t.coralInk : t.yellowInk}
              title={p.res === 'required' ? p.name + ' cere rezervare' : 'Se umple repede la ' + p.name} sub="Faceți o rezervare ca să vă asigurați locul." btn="Rezervă" onPress={() => setExt('pick')} />
          ) : null}
          {noted ? (
            <Row icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M9 12l2 2 4-4" bg={t.blueSoft} ink={t.blueInk} title={'Rezervat prin ' + (pl.resVia ?? 'telefon') + ' la ' + p.name}
              sub={day.charAt(0).toUpperCase() + day.slice(1) + ', ' + pl.slot + ', ' + people + ', pe numele ' + (name || 'tău') + '.'} btn="Anulează"
              onPress={() => { updPlan(pl.pid, { res: 'none', resVia: undefined }); toast('Am scos rezervarea de pe bilet. Anunță-i și pe ei' + (ct?.phone ? ': ' + ct.phone : '') + '.'); }} />
          ) : null}
          {(() => {
            // check-in at the place (today only), then the receipt photo
            const today = planDay(pl).toDateString() === new Date().toDateString();
            const SCAN = 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10';
            const BON = 'M5 2v20l2-1.5L9 22l2-1.5L13 22l2-1.5L17 22l2-1.5V2l-2 1.5L15 2l-2 1.5L11 2 9 3.5 7 2 5 3.5ZM9 8h6M9 12h6M9 16h4';
            const OK = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8.5 12l2.5 2.5 4.5-5';
            if (!pl.inAt) {
              if (!today) return null;
              return <Row icon={SCAN} bg={t.yellowSoft} ink={t.yellowInk} title={'Ai ajuns la ' + p.name + '?'} sub="Fă check-in când ești acolo: primești ștampila și XP."
                btn={busyIn === 'in' ? 'Caut…' : 'Sunt aici'} onPress={async () => { if (busyIn) return; setBusyIn('in'); const r = await checkIn(pl); setBusyIn(''); toast(r.msg); }} />;
            }
            if (!pl.bonDone) {
              return <Row icon={BON} bg={t.blueSoft} ink={t.blueInk} title={'Ești la ' + p.name + ' din ' + pl.inAt} sub="La plecare, pune poza bonului fiscal: +25 XP."
                btn={busyIn === 'bon' ? 'Citesc…' : 'Pune bonul'} onPress={() => { if (!busyIn) setBonPick(true); }} />;
            }
            return <Row icon={OK} bg={t.blueSoft} ink={t.blueInk} title="Ieșire confirmată cu bonul" sub="+25 XP în carnet. Mersi că ții CeFaci corect." />;
          })()}
          {p.real.gone ? (
            <Row icon="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" bg={t.coralSoft} ink={t.coralInk}
              title={p.name + ' pare închis'} sub="A dispărut de pe hartă la ultima actualizare. Sună înainte sau alege altceva." btn="Altceva" onPress={() => router.push('/rezultate')} />
          ) : null}
          {pl.inAt && !pl.rated ? (
            <View style={{ padding: 14, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
              <T style={{ fontFamily: F.b, fontSize: 15 }}>{'Cum a fost la ' + p.name + '?'}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([['yes', 'Mi-a plăcut'], ['no', 'Nu prea']] as const).map(([k, label]) => (
                  <Big key={k} style={{ flex: 1 }} label={label} color={k === 'yes' ? t.blue : t.s2} ink={k === 'yes' ? '#FFFFFF' : t.ink} onPress={() => {
                    const liked = ((APP.prefs.liked as string[] | undefined) ?? []).filter((x) => x !== p.id);
                    const disliked = ((APP.prefs.disliked as string[] | undefined) ?? []).filter((x) => x !== p.id);
                    savePrefs(k === 'yes' ? { liked: [...liked, p.id], disliked } : { liked, disliked: [...disliked, p.id] });
                    updPlan(pl.pid, { rated: k });
                    toast(k === 'yes' ? 'Notat! Îți arătăm mai des locuri ca ăsta.' : 'Notat. Îți arătăm altceva data viitoare.');
                  }} />
                ))}
              </View>
            </View>
          ) : null}
          {clash && clashP ? (
            <Row icon="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" bg={t.coralSoft} ink={t.coralInk}
              title={'Se suprapune cu ' + clashP.name} sub={'Ai și planul ăla ' + dayWord(clash) + ' la ' + clash.slot + '. Păstrezi amândouă?'} btn="Vezi" onPress={() => router.push({ pathname: '/bilet/[pid]', params: { pid: String(clash.pid) } })} />
          ) : null}
          {who.length ? (
            <View style={{ padding: 14, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
              <T style={{ fontFamily: F.b, fontSize: 15 }}>{'Cine vine (' + who.filter((g) => g.answer === 'vin').length + ' din ' + who.length + ')'}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {who.map((g) => (
                  <View key={g.person.id} style={{ height: 30, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', backgroundColor: g.answer === 'vin' ? t.blueSoft : g.answer === 'nu_pot' ? t.coralSoft : t.s2 }}>
                    <T style={{ fontFamily: F.sb, fontSize: 13, color: g.answer === 'vin' ? t.blueInk : g.answer === 'nu_pot' ? t.coralInk : t.ink2 }}>
                      {(g.person.id === me?.id ? 'Tu' : g.person.first_name) + (g.answer === 'vin' ? ' · vine' : g.answer === 'nu_pot' ? ' · nu poate' : ' · n-a zis')}
                    </T>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {planB && !pl.inAt ? (
            <Press onPress={() => { const pid = createPlanAt(planB.id, startsAt(pl), pl.people); router.push({ pathname: '/bilet/[pid]', params: { pid: String(pid) } }); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
              <T style={{ fontFamily: F.b, fontSize: 13, color: t.ink2 }}>PLAN B</T>
              <T numberOfLines={1} style={{ flex: 1, fontFamily: F.sb, fontSize: 14 }}>{planB.name + ' · la ' + (planB.m < 1000 ? Math.round(planB.m / 10) * 10 + ' m' : (planB.m / 1000).toFixed(1).replace('.', ',') + ' km')}</T>
              <Icon name="next" size={16} color={t.ink3} />
            </Press>
          ) : null}
          {open ? <Muted style={{ paddingHorizontal: 4 }}>{open + (p.real.street ? ' · ' + p.real.street : '')}</Muted> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Action icon="M3 11 22 2l-9 19-2-8z" label="Navighează" primary onPress={() => Linking.openURL(navUrl).catch(() => {})} />
            <Action icon="M8 2v4M16 2v4M3 10h18M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M19 16v6M16 19h6" label="În calendar" onPress={calendar} />
            <Action icon="M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" label="Trimite gășcii" onPress={() => setShareOpen(true)} />
          </View>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <Quiet label="Renunț la plan" color={t.ink2} onPress={drop} />
            <Quiet label="Ceva nu e bun la locul ăsta?" color={t.ink3} onPress={() => setReportOpen(true)} />
          </View>
        </View>
      </ScrollView>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)}>
        <H1 style={{ fontSize: 26 }}>Trimite planul</H1>
        <Muted style={{ marginTop: 6, marginBottom: 14, fontSize: 15, lineHeight: 21 }}>Îl primesc în Planuri și răspund cu Vin sau Nu pot. Tu vezi pe bilet cine vine.</Muted>
        {pl.owner === false ? <Muted style={{ fontSize: 15, lineHeight: 21 }}>Planul ăsta l-a făcut altcineva, așa că doar cine l-a făcut cheamă oameni în CeFaci. Tu îl poți trimite pe WhatsApp.</Muted> : shareOpen ? <SendTo onChange={onTo} /> : null}
        <View style={{ marginTop: 16, gap: 8 }}>
          {pl.owner !== false ? <Big label={sending ? 'Trimit…' : to ? 'Trimite la ' + to.label : 'Alege pe cine chemi'} disabled={!to || sending} onPress={shareToCrew} /> : null}
          <Big label="Trimite pe WhatsApp sau altundeva" color={t.s2} ink={t.ink} onPress={() => { setShareOpen(false); send(); }} />
        </View>
      </Sheet>
      <Sheet open={reportOpen} onClose={() => setReportOpen(false)}>
        <H1 style={{ fontSize: 26 }}>Ce nu e bun?</H1>
        <Muted style={{ marginTop: 6, marginBottom: 12, fontSize: 15, lineHeight: 21 }}>{'Ne ajuți să ținem harta corectă. Verificăm și reparăm la următoarea actualizare.'}</Muted>
        <View style={{ gap: 8 }}>
          {REPORTS.map(([k, label]) => (
            <Big key={k} label={label} color={t.s2} ink={t.ink} onPress={async () => {
              setReportOpen(false);
              if (k === 'inchis') { const d = (APP.prefs.disliked as string[] | undefined) ?? []; if (!d.includes(p.id)) savePrefs({ disliked: [...d, p.id] }); }
              if (!me) { toast(k === 'inchis' ? 'Notat: nu ți-l mai arătăm.' : 'Ca să ne trimiți asta, intră în cont din Profil → Prieteni.'); return; }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error } = await (sb() as any).from('reports').insert({ venue_id: p.id, kind: k });
              toast(error ? 'Nu am putut trimite acum. Încearcă mai târziu.' : 'Mersi! Am notat.' + (k === 'inchis' ? ' Nu ți-l mai arătăm.' : ''));
            }} />
          ))}
        </View>
      </Sheet>
      <Sheet open={bonPick} onClose={() => setBonPick(false)}>
        <View style={{ gap: 10 }}>
          <H1 style={{ fontSize: 26 }}>Poza bonului</H1>
          <Muted style={{ fontSize: 15, lineHeight: 21 }}>Citim doar localul, ora și totalul. Poza nu se păstrează.</Muted>
          {(['camera', 'gallery'] as const).map((from) => (
            <Big key={from} label={from === 'camera' ? 'Fă poza acum' : 'Alege din galerie'} color={from === 'camera' ? t.blue : t.s2} ink={from === 'camera' ? '#FFFFFF' : t.ink}
              onPress={async () => { setBonPick(false); setBusyIn('bon'); const r = await sendBill(pl, from); setBusyIn(''); if (r) toast(r.msg); }} />
          ))}
        </View>
      </Sheet>
      <Sheet open={ext !== 'closed'} onClose={() => setExt('closed')}>
        {ext === 'pick' ? (
          <View style={{ gap: 10 }}>
            <H1 style={{ fontSize: 26 }}>Rezervă la {p.name}</H1>
            <Muted style={{ fontSize: 15, lineHeight: 21 }}>{p.name} nu primește încă rezervări prin CeFaci. Rezervi direct la ei, apoi o notezi aici.</Muted>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T style={{ flex: 1, fontFamily: F.sb, fontSize: 15 }}>Câte persoane</T>
              <Press onPress={() => updPlan(pl.pid, { people: Math.max(1, pl.people - 1) })} accessibilityLabel="Mai puține persoane" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.s2, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 20 }}>−</T></Press>
              <T style={{ minWidth: 28, textAlign: 'center', fontFamily: F.display, fontSize: 22 }}>{pl.people}</T>
              <Press onPress={() => updPlan(pl.pid, { people: Math.min(30, pl.people + 1) })} accessibilityLabel="Mai multe persoane" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.s2, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontFamily: F.b, fontSize: 20 }}>+</T></Press>
            </View>
            {pl.slot !== 'acum' ? (
              <View style={{ gap: 8 }}>
                <T style={{ fontFamily: F.sb, fontSize: 15 }}>La ce oră</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {slotsAround(pl.slot).map((s) => <Chip key={s} small label={s} on={s === pl.slot} onPress={() => { updPlan(pl.pid, { slot: s }); void moveShared(pl, s); }} />)}
                </View>
              </View>
            ) : null}
            {ct?.phone ? <Big label={'Sună · ' + ct.phone} icon={<Icon name="phone" color="#FFFFFF" />} onPress={() => go('tel:' + ct.phone.replace(/[^\d+]/g, ''), 'telefon')} /> : null}
            {ct?.phone && waNumber(ct.phone) ? <Big label="Scrie-le pe WhatsApp" color="#25D366" ink="#0E1440" icon={<Icon d="M3 21l1.65-4.8A9 9 0 1 1 8 20.2zM9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" color="#0E1440" />}
              onPress={() => go('https://wa.me/' + waNumber(ct.phone) + '?text=' + encodeURIComponent(script), 'WhatsApp')} /> : null}
            {ct?.site ? <Big label="Rezervă pe site-ul lor" color={t.violet} ink="#0E1440" icon={<Icon name="globe" color="#0E1440" />} onPress={() => go(/^https?:/.test(ct.site) ? ct.site : 'https://' + ct.site, 'site')} /> : null}
            {!ct?.phone && !ct?.site ? <Muted>Nu avem încă telefonul sau site-ul lor. Treceți pe acolo sau încercați fără rezervare.</Muted> : null}
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: t.s2 }}>
              <T style={{ fontFamily: F.m, fontSize: 14, lineHeight: 20 }}>{script}</T>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <H1 style={{ fontSize: 26 }}>Ai rezervat?</H1>
            <Muted style={{ fontSize: 15, lineHeight: 21 }}>O notăm pe bilet, ca s-o ai la îndemână.</Muted>
            <Big label="Da, notează rezervarea" onPress={() => { updPlan(pl.pid, { res: 'noted', resVia: via }); setExt('closed'); toast('Am notat rezervarea pe bilet.'); }} />
            <Big label="Nu mai au loc" color={t.s2} ink={t.ink} onPress={() => { setExt('closed'); removePlan(pl.pid); toast('Am scos ' + p.name + ' din planuri. Uite ce se mai potrivește.'); router.replace('/rezultate'); }} />
            <Quiet label="Mai târziu" onPress={() => setExt('closed')} />
          </View>
        )}
      </Sheet>
      <TopShade />
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
