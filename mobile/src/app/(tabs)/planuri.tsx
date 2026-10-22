// Planuri: the tickets you made, soonest first, and your crews (Supabase).
import { ScrollView, View } from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP, useApp } from '../../lib/session';
import { NO_PLANS, dayShort, sortPlans, type Plan } from '../../lib/plans';
import { joinWithCode, listCrews, type Crew } from '../../lib/crews';
import { toast } from '../../lib/toast';
import { answer, listInvites, syncShared, watchPlans, type Invite } from '../../lib/together';
import { listVotes, type VoteRow } from '../../lib/votes';
import { CrewMark } from '../../ui/CrewMark';
import { Dashed } from '../../ui/Dashed';
import { Icon } from '../../ui/Icon';
import { Big, Field, H1, Lbl, Muted, Note, Press, Sheet, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';
import { Doodles } from '../../ui/Doodles';
import { tr, trServer, pick, locale } from '../../lib/i18n';
import { MyTicketsRow } from '../../features/events/MyTicketsRow'; // Evenimente (22.10): removable

/** "la 21:00", "mâine la 21:00", "vineri la 21:00": a vote may close another day (07.10). */
const WD = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function untilWords(d: Date, now = new Date()) {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 864e5);
  const hm = d.toTimeString().slice(0, 5);
  return pick((diff <= 0 ? '' : diff === 1 ? 'mâine ' : WD[d.getDay()] + ' ') + 'la ' + hm,
    'by ' + (diff <= 0 ? '' : (diff === 1 ? 'tomorrow' : WD_EN[d.getDay()]) + ' at ') + hm);
}


export default function Planuri() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const plans = sortPlans(useApp((s) => (s.board.plans as Plan[] | undefined) ?? NO_PLANS));
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState('');
  const scope=useRef(0);
  useEffect(()=>{scope.current++;setCrews(null);setVotes([]);setInvites([]);setBusy('');return()=>{scope.current++;};},[who?.id]);
  const refresh = useCallback(() => {
    if (!who || !known) { setCrews(null); setVotes([]); setInvites([]); return; }
    const n=++scope.current;const valid=()=>n===scope.current;
    void listCrews(who.id).then(v=>{if(valid())setCrews(v);}).catch(()=>{});
    void listVotes().then(v=>{if(valid())setVotes(v);}).catch(()=>{});
    void listInvites(who.id).then(v=>{if(valid())setInvites(v);}).catch(()=>{});
    void syncShared().then((gone) => { if (valid()&&gone.length) toast(tr('S-a anulat planul de la {who}.', { who: gone.join(', ') })); });
  }, [who, known]);
  useFocusEffect(refresh);
  useEffect(() => (who && known ? watchPlans(who.id, refresh) : undefined), [who, known, refresh]);
  const reply = async (inv: Invite, a: 'vin' | 'nu_pot') => {
    if (!who) return;
    setBusy(inv.planId + a);
    const e = await answer(inv, who.id, a);
    setBusy('');
    if (e) { toast(trServer(e)); return; }
    toast(a === 'vin' ? tr('Super! {name} vede că vii.', { name: inv.owner.first_name }) : tr('Am anunțat că nu poți.'));
    refresh();
  };
  const fresh = invites.filter((i) => i.answer === 'pending');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const join = async () => {
    setBusy('join'); setJoinErr('');
    const r = await joinWithCode(joinCode);
    setBusy('');
    if (r.err) { setJoinErr(trServer(r.err)); return; }
    setJoinOpen(false); setJoinCode('');
    toast(tr('Ai intrat în gașcă!'));
    router.push({ pathname: '/gasca/[id]', params: { id: r.id! } });
  };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }}>
      <View style={{ height: 44, justifyContent: 'center' }}><H1>{tr('Planuri')}</H1></View>
      <MyTicketsRow />
      {votes.length ? (
        <View>
          <Lbl style={{ marginTop: 16, marginBottom: 10 }}>{votes.length === 1 ? tr('Un vot') : tr('Voturi ({n})', { n: votes.length })}</Lbl>
          <View style={{ gap: 10 }}>
            {votes.map((v) => {
              const open = new Date(v.closesAt).getTime() > Date.now();
              return (
                <Press key={v.id} onPress={() => router.push({ pathname: '/vot/[id]', params: { id: v.id } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: open ? t.blue : t.s1, borderWidth: open ? 0 : 1, borderColor: t.line }}>
                  <Icon name="users" color={open ? '#FFFFFF' : t.ink} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontFamily: F.b, fontSize: 16, color: open ? '#FFFFFF' : t.ink }}>{v.title + (v.crewName ? ' · ' + v.crewName : '')}</T>
                    <T style={{ fontFamily: F.sb, fontSize: 13, color: open ? 'rgba(255,255,255,0.85)' : t.ink2 }}>{open ? tr('Votează până {when}', { when: untilWords(new Date(v.closesAt)) }) : tr('S-a închis. Vezi cine a câștigat.')}</T>
                  </View>
                  <Icon name="next" size={16} color={open ? '#FFFFFF' : t.ink3} />
                </Press>
              );
            })}
          </View>
        </View>
      ) : null}
      {fresh.length ? (
        <View>
          <Lbl style={{ marginTop: 16, marginBottom: 10 }}>{tr('Te-au chemat')}</Lbl>
          <View style={{ gap: 10 }}>
            {fresh.map((inv) => {
              const d = new Date(inv.startsAt);
              return (
                <View key={inv.planId} style={{ padding: 14, gap: 10, borderRadius: 20, borderWidth: 1.5, borderColor: t.yellowInk, backgroundColor: t.s1 }}>
                  <View style={{ gap: 2 }}>
                    <T style={{ fontFamily: F.b, fontSize: 16 }}>{inv.venueName}</T>
                    <Muted>{tr('{name} te cheamă · {date}, {t}', { name: inv.owner.first_name, date: d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }), t: d.toTimeString().slice(0, 5) })}</Muted>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Big style={{ flex: 1 }} label={busy === inv.planId + 'vin' ? '…' : tr('Vin')} disabled={!!busy} onPress={() => reply(inv, 'vin')} />
                    <Big style={{ flex: 1 }} label={busy === inv.planId + 'nu_pot' ? '…' : tr('Nu pot')} color={t.s2} ink={t.ink} disabled={!!busy} onPress={() => reply(inv, 'nu_pot')} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {plans.length ? (
        <View>
          <Lbl style={{ marginTop: 16, marginBottom: 10 }}>{tr('Urmează ({n})', { n: plans.length })}</Lbl>
          <View style={{ gap: 10 }}>
            {plans.map((x) => {
              const p = APP.byId(x.placeId);
              if (!p) return null;
              const bits = [p.name];
              if (p.res !== 'none') bits.push(x.res === 'noted' ? tr('rezervat prin {via}', { via: tr(x.resVia ?? 'telefon') }) : tr('fără rezervare încă'));
              return (
                <Press key={x.pid} onPress={() => router.push({ pathname: '/bilet/[pid]', params: { pid: String(x.pid) } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, borderRadius: 20, backgroundColor: '#FFD43B' }}>
                  <View style={{ position: 'absolute', left: -9, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 99, backgroundColor: t.bg }} />
                  <View style={{ position: 'absolute', right: -9, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 99, backgroundColor: t.bg }} />
                  <View style={{ width: 58, height: 58, borderRadius: 14, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <T style={{ fontFamily: F.b, fontSize: 11, color: '#FFD43B' }}>{dayShort(x)}</T>
                    <T style={{ fontFamily: F.display, fontSize: 18, color: '#FFD43B' }}>{x.slot}</T>
                  </View>
                  <Dashed vertical color="rgba(14,20,64,0.3)" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T style={{ fontFamily: F.b, fontSize: 16, lineHeight: 19, color: '#0E1440' }}>{p.title}</T>
                    <T style={{ fontFamily: F.sb, fontSize: 13, color: '#2C3363' }}>{bits.join(', ')}</T>
                  </View>
                  <Icon name="next" size={16} color="#0E1440" />
                </Press>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 18, padding: 18, paddingVertical: 22, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, alignItems: 'flex-start' }}>
          <T style={{ fontFamily: F.display, fontSize: 24, lineHeight: 25 }}>{tr('Niciun plan încă.')}</T>
          <Muted>{tr('Alege ceva de pe Acasă și biletul apare aici.')}</Muted>
          <Big style={{ marginTop: 6 }} label={tr('Ce facem?')} onPress={() => router.navigate('/acasa')} />
        </View>
      )}
      <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl style={{ flex: 1 }}>{tr('Gășcile tale')}</Lbl>
        {known ? <Press onPress={() => { setJoinErr(''); setJoinOpen(true); }} style={{ height: 40, paddingHorizontal: 12, marginRight: 6, borderRadius: 999, borderWidth: 1, borderColor: t.line, justifyContent: 'center' }}>
          <T style={{ fontFamily: F.sb, fontSize: 14 }}>{tr('Intră cu un cod')}</T>
        </Press> : null}
        <Press onPress={() => router.push('/gasca-noua')} style={{ height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 999, backgroundColor: t.blueSoft, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={16} color={t.blueInk} width={2.4} />
          <T style={{ fontFamily: F.sb, fontSize: 14, color: t.blueInk }}>{tr('Gașcă nouă')}</T>
        </Press>
      </View>
      {crews && crews.length ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {crews.map((c, k) => {
            const inN = c.members.filter((m) => m.status === 'member').length + 1;
            const pend = c.members.filter((m) => m.status === 'invited').length;
            return (
              <Press key={c.id} onPress={() => router.push({ pathname: '/gasca/[id]', params: { id: c.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 14, borderRadius: 20, borderWidth: 1, borderColor: c.mine === 'invited' ? t.yellowInk : t.line, backgroundColor: t.s1 }}>
                <CrewMark icon={c.icon} color={c.color === '#0E1440' && t.dark ? '#F4F4F6' : c.color} rot={['-6deg', '5deg', '-3deg', '7deg'][k % 4]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T style={{ fontFamily: F.sb, fontSize: 16 }}>{c.name}</T>
                  <Muted>{c.mine === 'invited' ? tr('Te-au invitat. Apasă ca să intri.') : tr('{n} în gașcă', { n: inN }) + (pend ? (pend === 1 ? tr(', o invitație în așteptare') : tr(', {n} invitații în așteptare', { n: pend })) : '')}</Muted>
                </View>
                <Icon name="next" size={16} color={t.ink3} />
              </Press>
            );
          })}
        </View>
      ) : (
        <View style={{ marginTop: 10, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
          <Muted style={{ fontSize: 14, lineHeight: 20 }}>{known ? tr('Încă n-ai nicio gașcă. Fă una cu cel puțin 2 prieteni, iar ei primesc invitația.') : tr('Gășcile merg cu cont. Intră din Profil → Prieteni.')}</Muted>
        </View>
      )}
    </ScrollView>
    <Sheet open={joinOpen} onClose={() => setJoinOpen(false)}>
      <H1 style={{ fontSize: 26 }}>{tr('Intră într-o gașcă')}</H1>
      <Muted style={{ marginTop: 6, marginBottom: 12, fontSize: 15, lineHeight: 21 }}>{tr('Scrie codul primit de la cineva din gașcă (12 caractere).')}</Muted>
      <Field value={joinCode} onChangeText={(x) => setJoinCode(x.replace(/\s/g, '').slice(0, 12))} placeholder={tr('ex: abcd2345efgh')} autoCapitalize="none" autoCorrect={false} />
      {joinErr ? <View style={{ marginTop: 10 }}><Note kind="err">{joinErr}</Note></View> : null}
      <Big style={{ marginTop: 14 }} label={busy === 'join' ? tr('Intru…') : tr('Intră')} disabled={joinCode.length < 12 || busy === 'join'} onPress={join} />
    </Sheet>
    <TopShade />
    </View>
  );
}
