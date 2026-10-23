// The vote: each place with Da / Nu / Super (one Super), who voted, live results, the clock; at the end the winner
// becomes one plan for everyone (Planuri), and the ticket opens.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP, captureAccount, useApp } from '../../lib/session';
import { createPlanAt } from '../../lib/plans';
import { stateOf } from '../../lib/partner';
import { toast } from '../../lib/toast';
import { tr, trServer } from '../../lib/i18n';
import { cast, closeNow, finishRest, getVote, isOver, planFromVote, scores, votedAll, watchVote, winner, type Ballot, type VoteFull } from '../../lib/votes';
import { Icon } from '../../ui/Icon';
import { Big, H1, Muted, Note, Press, T } from '../../ui/kit';
import { Bilu } from '../../ui/Bilu';
import { Doodles } from '../../ui/Doodles';
import { SkyHeader } from '../../ui/SkyHeader';
import { F, useTheme } from '../../ui/theme';

function left(ms: number) {
  if (ms <= 0) return tr('Votul s-a închis');
  const m = Math.ceil(ms / 60000);
  if (m < 60) return tr('Se închide în {m} min', { m });
  const h = Math.floor(m / 60);
  const hrs = h === 1 ? tr('o oră') : tr('{h} ore', { h });
  return m % 60 ? tr('Se închide în {h} și {m} min', { h: hrs, m: m % 60 }) : tr('Se închide în {h}', { h: hrs });
}

export default function Vot() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const who = useApp((s) => s.who);
  const hasAccount = useApp((s) => s.account); // opened from a notification: the session is still loading
  const [v, setV] = useState<VoteFull | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => { const valid = captureAccount(); if (id) void getVote(id).then((next) => { if (valid()) setV(next); }).catch(() => { if (valid()) setErr(tr('Nu pot încărca votul. Verifică internetul.')); }); }, [id, who?.id]);
  useEffect(() => { if (!id || !who) return; load(); return watchVote(id, load); }, [id, who, load]);
  useEffect(() => { const k = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(k); }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/planuri'));

  if (!who && hasAccount) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20 }}><Muted>{tr('Încarc votul…')}</Muted></View>;
  if (!who) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>{tr('Votul merge cu cont.')}</H1>
        <Muted>{tr('Intră în cont, apoi deschide votul din Planuri.')}</Muted>
        <Big label={tr('Înapoi')} onPress={back} />
      </View>
    );
  }
  if (v === undefined) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20 }}><Muted>{tr('Încarc votul…')}</Muted></View>;
  if (!v || !who) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>{tr('Nu găsim votul.')}</H1>
        <Muted>{tr('Poate a fost șters sau nu ești în el.')}</Muted>
        <Big label={tr('Înapoi')} onPress={back} />
      </View>
    );
  }
  const me = who.id;
  const over = isOver(v, now);
  const sc = scores(v);
  const max = Math.max(1, ...sc.map((s) => Math.abs(s.score)));
  const win = over ? winner(v) : null;
  const done = v.voters.filter((p) => votedAll(v, p.id)).length;

  const press = async (optionId: string, value: Ballot) => {
    if (over) return;
    const mine = v.ballots.find((b) => b.userId === me && b.optionId === optionId)?.value;
    setBusy(optionId + value); setErr('');
    const e = await cast(v, me, optionId, mine === value ? null : value);
    setBusy('');
    if (e) setErr(e);
    load();
  };
  const makePlan = async () => {
    if (!win) return;
    const valid = captureAccount();
    setBusy('plan'); setErr('');
    const r = await planFromVote(v.id);
    if (!valid()) return;
    setBusy('');
    if (r.err) { setErr(r.err); return; }
    if (!APP.byId(r.venueId!)) { toast(tr('Planul e făcut, dar locul nu mai e în lista noastră.')); back(); return; }
    // A vote selects an activity; invited people answer Vin / Nu pot separately.
    if (r.ownerId !== me) {
      toast(tr('Planul este în Planuri. Confirmă separat cu Vin sau Nu pot.'));
      router.replace('/planuri');
      return;
    }
    let people: number;
    try {
      const state = await stateOf(r.planId!);
      if (!valid()) return;
      if (!state.attendance) throw new Error(tr('Numărul grupului nu este disponibil. Reîncearcă.'));
      people = state.attendance.people;
    } catch (e) { if (valid()) setErr(trServer((e as Error).message)); return; }
    // two evenings can start at the same restaurant: the winner is the option this vote picked
    const opt = win.venueId === r.venueId ? win : v.options.find((o) => o.venueId === r.venueId) ?? win;
    const route = opt.details.route;
    if (route && route.length > 1) {
      // a whole evening won: a ticket for every step, the first one is the shared plan
      route.forEach((s, i) => { if (APP.byId(s.id)) createPlanAt(s.id, new Date(s.starts_at), people, { route: r.planId, ...(i === 0 ? { sid: r.planId, owner: r.ownerId === me } : {}) }); });
      toast(tr('Gata! Seara e în Planuri, pas cu pas.'));
      router.replace('/planuri');
      return;
    }
    const pid = createPlanAt(r.venueId!, new Date(r.startsAt!), people, { sid: r.planId, owner: r.ownerId === me });
    toast(tr('Gata! Invitații confirmă separat participarea în Planuri.'));
    router.replace({ pathname: '/bilet/[pid]', params: { pid: String(pid) } });
  };

  const mineLeft = v.options.filter((o) => !v.ballots.some((b) => b.userId === me && b.optionId === o.id));
  const votedSome = mineLeft.length < v.options.length;
  const waiting = v.voters.filter((p) => p.id !== me && !votedAll(v, p.id));
  const starter = v.createdBy === me;
  const anyBallot = v.ballots.length > 0;
  const rest = async () => {
    setBusy('rest'); setErr('');
    const e = await finishRest(v, me);
    setBusy('');
    if (e) setErr(e);
    load();
  };
  const closeVote = async () => {
    setBusy('close'); setErr('');
    const e = await closeNow(v.id);
    setBusy('');
    if (e) setErr(e);
    load();
  };
  const names = (list: { first_name: string }[]) => list.map((p) => p.first_name).join(', ');

  // 23.10 (Cornel: „ecranele mai frumoase, pe tematica aplicației”): the sky of Acasă on top, each place as a ticket,
  // what is still missing said plainly (votul se termină când fiecare a răspuns la toate locurile)
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Doodles />
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <SkyHeader title={trServer(v.title)} onBack={back} mood={over ? 'yay' : votedSome ? 'wink' : 'up'}
          sub={(v.crewName ? v.crewName + ' · ' : '') + (over ? tr('Votul s-a încheiat') : tr('{done} din {n} au votat tot', { done, n: v.voters.length }))}
          right={<View style={{ paddingHorizontal: 12, height: 32, borderRadius: 99, backgroundColor: over ? 'rgba(255,255,255,0.16)' : '#FFD43B', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={14} color={over ? '#FFFFFF' : '#0E1440'} />
            <T style={{ fontFamily: F.b, fontSize: 13, color: over ? '#FFFFFF' : '#0E1440' }}>{left(new Date(v.closesAt).getTime() - now)}</T>
          </View>}>
          <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {v.voters.map((p) => {
              const ok = votedAll(v, p.id);
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 3, paddingRight: 12, height: 34, borderRadius: 999, backgroundColor: ok ? 'rgba(95,211,154,0.25)' : 'rgba(255,255,255,0.14)' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 99, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontFamily: F.b, fontSize: 13, color: '#0E1440' }}>{(p.id === me ? tr('Tu') : p.first_name).charAt(0).toUpperCase()}</T>
                  </View>
                  <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>{p.id === me ? tr('Tu') : p.first_name}</T>
                  <Icon name={ok ? 'check' : 'clock'} size={14} color={ok ? '#5FD39A' : 'rgba(255,255,255,0.7)'} />
                </View>
              );
            })}
          </View>
        </SkyHeader>

        <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 12 }}>
          {/* what happens now, in one sentence */}
          {!over ? (
            <View style={{ padding: 14, borderRadius: 20, backgroundColor: t.yellowSoft, gap: 10 }}>
              <T style={{ fontFamily: F.b, fontSize: 15 }}>
                {mineLeft.length
                  ? (mineLeft.length === 1 ? tr('Mai ai de votat la {place}.', { place: mineLeft[0].name }) : tr('Mai ai de votat la {n} locuri.', { n: mineLeft.length }))
                  : waiting.length ? tr('Ai votat tot. Așteptăm pe {names}.', { names: names(waiting) }) : tr('Toți au votat!')}
              </T>
              <Muted>{tr('Votul se încheie când fiecare a răspuns la toate locurile, sau la ora de închidere.')}</Muted>
              {mineLeft.length && votedSome ? (
                <Big label={busy === 'rest' ? tr('Trimit…') : tr('Gata, la restul Nu')} color="#0E1440" disabled={!!busy} onPress={() => void rest()} />
              ) : null}
              {starter && anyBallot && !mineLeft.length && waiting.length ? (
                <Big label={busy === 'close' ? tr('Închid…') : tr('Închide votul acum')} color="#0E1440" disabled={!!busy} onPress={() => void closeVote()} />
              ) : null}
            </View>
          ) : null}

          {over && win ? (
            <View style={{ borderRadius: 24, backgroundColor: '#FFD43B', padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: -10, top: '50%', width: 20, height: 20, borderRadius: 99, backgroundColor: t.bg }} />
              <View style={{ position: 'absolute', right: -10, top: '50%', width: 20, height: 20, borderRadius: 99, backgroundColor: t.bg }} />
              <View style={{ flex: 1, gap: 4 }}>
                <T style={{ fontFamily: F.b, fontSize: 12, letterSpacing: 1.5, color: '#7A5E00' }}>{tr('CÂȘTIGĂ')}</T>
                <T style={{ fontFamily: F.display, fontSize: 28, lineHeight: 30, color: '#0E1440' }}>{win.name}</T>
                <T style={{ fontFamily: F.sb, fontSize: 14, color: '#2C3363' }}>{v.planId ? tr('Planul e deja făcut.') : tr('Fă planul și îl primesc toți.')}</T>
              </View>
              <Bilu size={78} mood="yay" />
            </View>
          ) : null}

          {v.options.map((o, i) => {
            const s = sc[i];
            const mine = v.ballots.find((b) => b.userId === me && b.optionId === o.id)?.value;
            const isWin = win?.id === o.id;
            const total = Math.max(1, s.da + s.super + s.nu);
            const todo = !over && !mine;
            return (
              <View key={o.id} style={{ flexDirection: 'row', borderRadius: 22, backgroundColor: t.s1, borderWidth: isWin ? 2.5 : todo ? 2 : 1, borderColor: isWin ? '#FFD43B' : todo ? t.yellowInk : t.line, overflow: 'hidden' }}>
                {/* the ticket's stub: the letter of the place and its score */}
                <View style={{ width: 64, backgroundColor: isWin ? '#FFD43B' : t.blue, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 14 }}>
                  <T style={{ fontFamily: F.display, fontSize: 30, lineHeight: 32, color: isWin ? '#0E1440' : '#FFFFFF' }}>{String.fromCharCode(65 + i)}</T>
                  <T style={{ fontFamily: F.b, fontSize: 12, color: isWin ? '#0E1440' : 'rgba(255,255,255,0.85)' }}>{(s.score > 0 ? '+' : '') + s.score}</T>
                </View>
                <View style={{ width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: t.bg }} />
                <View style={{ flex: 1, padding: 14, gap: 10 }}>
                  <View style={{ gap: 2 }}>
                    <T style={{ fontFamily: F.b, fontSize: 17 }}>{o.name}</T>
                    <Muted>{[o.details.title, o.details.price ? '~' + o.details.price + ' lei' : o.details.price === 0 ? tr('gratuit') : '', o.details.slot ? tr('la {t}', { t: o.details.slot }) : ''].filter(Boolean).join(' · ')}</Muted>
                    {o.details.route ? o.details.route.map((st) => <Muted key={st.id + st.slot}>{st.slot + '  ' + st.name}</Muted>) : null}
                  </View>
                  {/* Super, Da and Nu side by side in one bar */}
                  <View style={{ height: 10, borderRadius: 99, backgroundColor: t.s2, overflow: 'hidden', flexDirection: 'row' }}>
                    <View style={{ width: `${(s.super / total) * 100}%`, backgroundColor: '#FFD43B' }} />
                    <View style={{ width: `${(s.da / total) * 100}%`, backgroundColor: t.blue }} />
                    <View style={{ width: `${(s.nu / total) * 100}%`, backgroundColor: t.coral }} />
                  </View>
                  <Muted>{tr('{da} Da · {sup} Super · {nu} Nu', { da: s.da, sup: s.super, nu: s.nu })}</Muted>
                  {!over ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {([['da', 'Da', 'check'], ['super', 'Super', 'star'], ['nu', 'Nu', 'close']] as [Ballot, string, 'check' | 'star' | 'close'][]).map(([val, label, icon]) => {
                        const on = mine === val;
                        const bg = on ? (val === 'nu' ? t.coral : val === 'super' ? '#FFD43B' : t.blue) : t.s2;
                        const fg = on ? (val === 'super' ? '#0E1440' : '#FFFFFF') : t.ink;
                        return (
                          <Press key={val} onPress={() => press(o.id, val)} disabled={!!busy} accessibilityState={{ selected: on }} accessibilityLabel={tr('{vote} pentru {place}', { vote: tr(label), place: o.name })}
                            style={{ flex: 1, height: 44, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}>
                            <Icon name={icon} size={15} color={fg} />
                            <T style={{ fontFamily: F.b, fontSize: 14, color: fg }}>{tr(label)}</T>
                          </Press>
                        );
                      })}
                    </View>
                  ) : null}
                  {todo ? <T style={{ fontFamily: F.sb, fontSize: 12, color: t.yellowInk }}>{tr('Încă n-ai votat aici')}</T> : null}
                </View>
              </View>
            );
          })}
          {!over ? <Muted>{tr('Super poți da o singură dată. Apasă iar ca să-ți retragi votul.')}</Muted> : null}
          {err ? <Note kind="err">{err}</Note> : null}
          {over && win ? (
            <View style={{ gap: 8 }}>
              <Big label={busy === 'plan' ? tr('Fac planul…') : v.planId ? tr('Deschide planul') : tr('Facem planul')} color="#FFD43B" ink="#0E1440" disabled={busy === 'plan'} onPress={makePlan} />
              {!v.crewId && v.voters.length >= 3 ? (
                <Big label={tr('Păstrați gașca? Faceți una din voi')} color={t.s2} ink={t.ink}
                  onPress={() => router.push({ pathname: '/gasca-noua', params: { pre: v.voters.filter((x) => x.id !== me).map((x) => x.id).join(',') } })} />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
