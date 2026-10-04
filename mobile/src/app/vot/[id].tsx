// The vote: each place with Da / Nu / Super (one Super), who voted, live results, the clock; at the end the winner
// becomes one plan for everyone (Planuri), and the ticket opens.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { APP, useApp } from '../../lib/session';
import { createPlanAt } from '../../lib/plans';
import { comeTo } from '../../lib/together';
import { toast } from '../../lib/toast';
import { cast, getVote, isOver, planFromVote, scores, votedAll, watchVote, winner, type Ballot, type VoteFull } from '../../lib/votes';
import { Icon } from '../../ui/Icon';
import { Big, H1, Lbl, Muted, Note, Press, Say, T, Tag } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';

function left(ms: number) {
  if (ms <= 0) return 'Votul s-a închis';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return 'Se închide în ' + m + ' min';
  const h = Math.floor(m / 60);
  return 'Se închide în ' + (h === 1 ? 'o oră' : h + ' ore') + (m % 60 ? ' și ' + (m % 60) + ' min' : '');
}

export default function Vot() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const who = useApp((s) => s.who);
  const [v, setV] = useState<VoteFull | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => { if (id) void getVote(id).then(setV); }, [id]);
  useEffect(() => { if (!id || !who) return; load(); return watchVote(id, load); }, [id, who, load]);
  useEffect(() => { const k = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(k); }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/planuri'));

  if (!who) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>Votul merge cu cont.</H1>
        <Muted>Intră din Profil → Prieteni, apoi deschide votul din Planuri.</Muted>
        <Big label="Înapoi" onPress={back} />
      </View>
    );
  }
  if (v === undefined) return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20 }}><Muted>Încarc votul…</Muted></View>;
  if (!v || !who) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: ins.top + 60, paddingHorizontal: 20, gap: 12 }}>
        <H1>Nu găsim votul.</H1>
        <Muted>Poate a fost șters sau nu ești în el.</Muted>
        <Big label="Înapoi" onPress={back} />
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
    setBusy('plan'); setErr('');
    const r = await planFromVote(v.id);
    setBusy('');
    if (r.err) { setErr(r.err); return; }
    if (!APP.byId(r.venueId!)) { toast('Planul e făcut, dar locul nu mai e în lista noastră.'); back(); return; }
    void comeTo(r.planId!, me);
    const pid = createPlanAt(r.venueId!, new Date(r.startsAt!), v.voters.length, { sid: r.planId, owner: r.ownerId === me });
    toast('Gata! Toți din vot au primit planul în Planuri.');
    router.replace({ pathname: '/bilet/[pid]', params: { pid: String(pid) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
          <View style={{ flex: 1 }} />
          <Tag big text={left(new Date(v.closesAt).getTime() - now)} bg={over ? t.s2 : t.yellowSoft} fg={over ? t.ink2 : t.yellowInk} />
        </View>
        <H1 style={{ marginTop: 8, fontSize: 36, lineHeight: 37 }}>{v.title}</H1>
        <Muted style={{ marginTop: 4, fontSize: 14 }}>{(v.crewName ? v.crewName + ' · ' : '') + done + ' din ' + v.voters.length + ' au votat tot'}</Muted>

        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {v.voters.map((p) => {
            const ok = votedAll(v, p.id);
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 999, backgroundColor: ok ? t.blueSoft : t.s2 }}>
                {ok ? <Icon name="check" size={14} color={t.blueInk} /> : <Icon name="clock" size={14} color={t.ink2} />}
                <T style={{ fontFamily: F.sb, fontSize: 13, color: ok ? t.blueInk : t.ink2 }}>{p.id === me ? 'Tu' : p.first_name}</T>
              </View>
            );
          })}
        </View>

        {over && win ? (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Say mood="yay" text={'Câștigă ' + win.name + '! ' + (v.planId ? 'Planul e deja făcut.' : 'Fă planul și îl primesc toți.')} />
          </View>
        ) : null}

        <View style={{ marginTop: 16, gap: 10 }}>
          {v.options.map((o, i) => {
            const s = sc[i];
            const mine = v.ballots.find((b) => b.userId === me && b.optionId === o.id)?.value;
            const isWin = win?.id === o.id;
            return (
              <View key={o.id} style={{ padding: 14, gap: 10, borderRadius: 20, borderWidth: isWin ? 2 : 1, borderColor: isWin ? t.yellowInk : t.line, backgroundColor: t.s1 }}>
                <View style={{ gap: 2 }}>
                  <T style={{ fontFamily: F.b, fontSize: 17 }}>{o.name}</T>
                  <Muted>{[o.details.title, o.details.price ? '~' + o.details.price + ' lei' : o.details.price === 0 ? 'gratuit' : '', o.details.slot ? 'la ' + o.details.slot : ''].filter(Boolean).join(' · ')}</Muted>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: t.s2, overflow: 'hidden' }}>
                  <View style={{ width: `${(Math.max(0, s.score) / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: isWin ? '#FFD43B' : t.blue }} />
                </View>
                <Muted>{s.da + ' Da · ' + s.super + ' Super · ' + s.nu + ' Nu'}</Muted>
                {!over ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {([['da', 'Da'], ['super', 'Super'], ['nu', 'Nu']] as [Ballot, string][]).map(([val, label]) => {
                      const on = mine === val;
                      const bg = on ? (val === 'nu' ? t.coralSoft : val === 'super' ? '#FFD43B' : t.blue) : t.s2;
                      const fg = on ? (val === 'nu' ? t.coralInk : val === 'super' ? '#0E1440' : '#FFFFFF') : t.ink;
                      return (
                        <Press key={val} onPress={() => press(o.id, val)} disabled={!!busy} accessibilityState={{ selected: on }} accessibilityLabel={label + ' pentru ' + o.name}
                          style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                          {val === 'super' ? <Icon name="star" size={16} color={fg} /> : null}
                          <T style={{ fontFamily: F.b, fontSize: 15, color: fg }}>{label}</T>
                        </Press>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        {!over ? <Lbl style={{ marginTop: 12 }}>Super poți da o singură dată. Apasă iar ca să-ți retragi votul.</Lbl> : null}
        {err ? <View style={{ marginTop: 12 }}><Note kind="err">{err}</Note></View> : null}
        {over && win ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <Big label={busy === 'plan' ? 'Fac planul…' : v.planId ? 'Deschide planul' : 'Facem planul'} disabled={busy === 'plan'} onPress={makePlan} />
            {!v.crewId && v.voters.length >= 3 ? (
              <Big label="Păstrați gașca? Faceți una din voi" color={t.s2} ink={t.ink}
                onPress={() => router.push({ pathname: '/gasca-noua', params: { pre: v.voters.filter((x) => x.id !== me).map((x) => x.id).join(',') } })} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <TopShade />
    </View>
  );
}
