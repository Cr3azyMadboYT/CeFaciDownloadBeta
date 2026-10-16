// FreeNow (Cornel, 12.10): intri, le dai de veste prietenilor (și prietenilor lor), cine vrea vine. Sus: tu (sau
// formularul de intrare), apoi ieșirea ta (cine vine, votul, planul), apoi cine mai e pe FreeNow acum.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { ask } from '../ui/Ask';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import { APP, useApp } from '../lib/session';
import { listFriends } from '../lib/friends';
import {
  AUDIENCES, MOODS, endFor, endVoteNow, extendFreeNow, joinFree, leaveOuting, loadLastStart, moodOf, moodWords, muteFree, myZone,
  refreshFreeNow, setOutingOpen, spanText, startFreeNow, startOutingVote, stopFreeNow, useFreeNow, watchOuting,
  type Audience, type Free, type Mood,
} from '../lib/freeNow';
import { hhmm } from '../lib/plans';
import { toast } from '../lib/toast';
import { tr } from '../lib/i18n';
import { Bilu } from '../ui/Bilu';
import { Icon } from '../ui/Icon';
import { SendTo, type Target } from '../ui/SendTo';
import { Big, Chip, H1, Lbl, Muted, Note, Press, Quiet, Seg, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

const COLORS = ['#8C6CFF', '#FF6A4D', '#FFD43B', '#5FD39A', '#8EA6FF', '#FF8A73'];
const colorOf = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
function Face({ name, user, size = 38 }: { name: string; user: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 99, backgroundColor: colorOf(user), alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontFamily: F.b, fontSize: size * 0.38, color: '#0E1440' }}>{name.charAt(0).toUpperCase()}</T>
    </View>
  );
}

/** Când poate începe: acum sau la următoarele ore pline (azi; noaptea ține până la 05:00). */
function startChoices(now = new Date(), minor = APP.isMinor()) {
  const out: { label: string; at: Date | null }[] = [{ label: 'Acum', at: null }];
  const d = new Date(now); d.setMinutes(0, 0, 0);
  for (let i = 1; out.length < 5; i++) {
    const x = new Date(d.getTime() + i * 3600e3);
    const h = x.getHours();
    if (h >= 5 && h < 9) break;   // ziua aplicației se termină la 05:00
    if (minor && (h >= 22 || h < 5)) break;   // sub 18: până la 23:00, deci cel târziu de la 22:00
    out.push({ label: hhmm(x), at: x });
  }
  return out;
}
const LENGTHS: { label: string; hours: number }[] = [{ label: '1 oră', hours: 1 }, { label: '2 ore', hours: 2 }, { label: '3 ore', hours: 3 }, { label: 'Toată seara', hours: 0 }];
function StartForm({ friends }: { friends: number | null }) {
  const { t } = useTheme();
  const last = useMemo(() => loadLastStart(), []);
  const [when, setWhen] = useState(0);
  const [hours, setHours] = useState(last.hours >= 1 && last.hours <= 3 ? last.hours : last.hours > 3 ? 0 : 2);
  const [moods, setMoods] = useState<Mood[]>(last.moods?.length ? last.moods : ['orice']);
  const [aud, setAud] = useState<Audience | 'some'>(last.audience === 'crew' || last.audience === 'pick' ? 'some' : last.audience);
  const [target, setTarget] = useState<Target | null>(null);
  const [zoneOn, setZoneOn] = useState(last.zone !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onTarget = useCallback((x: Target | null) => setTarget(x), []);
  // orele se refac la fiecare minut (altfel, cu ecranul lăsat deschis, „De la 21:00” rămânea și la 21:30)
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => { const id = setInterval(() => setTick(Math.floor(Date.now() / 60000)), 30000); return () => clearInterval(id); }, []);
  const choices = useMemo(() => startChoices(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const zone = myZone();
  const me = useApp((s) => s.prefs.name as string | undefined);
  const start = choices[when]?.at ?? null;
  const end = endFor(start ?? new Date(), hours);
  const toggleMood = (m: Mood) => setMoods((x) => (m === 'orice' ? ['orice'] : x.includes(m) ? (x.filter((y) => y !== m).length ? x.filter((y) => y !== m) : ['orice']) : [...x.filter((y) => y !== 'orice'), m].slice(-2)));
  const audience: Audience = aud === 'some' ? (target?.crewId ? 'crew' : 'pick') : aud;
  const preview = (me ? tr('{name} e pe FreeNow {span}', { name: me, span: spanText((start ?? new Date()).toISOString(), end.toISOString()) }) : tr('Tu e pe FreeNow {span}', { span: spanText((start ?? new Date()).toISOString(), end.toISOString()) })) + (moodWords(moods) ? ' · ' + moodWords(moods) : '') + (zoneOn && zone ? ' · ' + tr('prin {zone}', { zone }) : '');
  const go = async () => {
    if (aud === 'some' && !target) { setErr(tr('Alege gașca sau prietenii.')); return; }
    setBusy(true); setErr('');
    const r = await startFreeNow({ startsAt: start, endsAt: end, moods, audience, crewId: target?.crewId ?? null, picked: target?.friendIds ?? [], zone: zoneOn ? zone : null });
    setBusy(false);
    if (r.err) { setErr(r.err); return; }
    toast(r.notified ? (r.notified === 1 ? tr('Am anunțat 1 om.') : tr('Am anunțat {n} oameni.', { n: r.notified })) : tr('Ești pe FreeNow. Cine deschide aplicația te vede.'));
  };

  if (friends === 0) {
    return (
      <View style={{ marginTop: 14, padding: 16, gap: 12, borderRadius: 22, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Bilu size={44} mood="oops" shadow={false} still />
          <T style={{ flex: 1, fontFamily: F.b, fontSize: 16, lineHeight: 21 }}>{tr('Încă n-ai pe cine anunța. Adaugă-ți prietenii cu codul tău și data viitoare află toți.')}</T>
        </View>
        <Big label={tr('Adaugă prieteni')} onPress={() => router.push('/prieteni')} />
        <Big label={tr('Între timp, surprinde-mă tu')} color={t.s2} ink={t.ink} onPress={() => router.replace('/acasa')} />
      </View>
    );
  }
  return (
    <View style={{ marginTop: 14, gap: 4 }}>
      <Lbl style={{ marginTop: 6, marginBottom: 6 }}>{tr('Când ai timp?')}</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {choices.map((c, i) => <Seg key={c.label} label={i === 0 ? tr(c.label) : tr('De la {t}', { t: c.label })} on={when === i} onPress={() => setWhen(i)} />)}
      </View>
      <Lbl style={{ marginTop: 14, marginBottom: 6 }}>{tr('Cât timp?')}</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {LENGTHS.map((l) => <Seg key={l.label} label={tr(l.label)} on={hours === l.hours} onPress={() => setHours(l.hours)} />)}
      </View>
      <Lbl style={{ marginTop: 14, marginBottom: 6 }}>{tr('Chef de… (cel mult 2)')}</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MOODS.filter((m) => !(m.id === 'pahar' && APP.isMinor())).map((m) => <Chip key={m.id} label={m.emoji + ' ' + tr(m.label)} on={moods.includes(m.id)} onPress={() => toggleMood(m.id)} />)}
      </View>
      <Lbl style={{ marginTop: 14, marginBottom: 6 }}>{tr('Cine te vede?')}</Lbl>
      <View style={{ gap: 6 }}>
        {([...AUDIENCES.filter((a) => a.id === 'fof' || a.id === 'friends'), { id: 'some' as const, label: 'O gașcă sau câțiva prieteni', sub: 'Doar pe cine alegi' }]).map((a) => (
          <Press key={a.id} onPress={() => setAud(a.id)} accessibilityRole="radio" accessibilityState={{ selected: aud === a.id }} accessibilityLabel={tr(a.label)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: aud === a.id ? t.blue : t.line, backgroundColor: t.s1 }}>
            <View style={{ width: 20, height: 20, borderRadius: 99, borderWidth: 2, borderColor: aud === a.id ? t.blue : t.ink2, alignItems: 'center', justifyContent: 'center' }}>
              {aud === a.id ? <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: t.blue }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.sb, fontSize: 15 }}>{tr(a.label)}</T>
              <Muted>{tr(a.sub)}</Muted>
            </View>
          </Press>
        ))}
      </View>
      {aud === 'some' ? <View style={{ marginTop: 10 }}><SendTo onChange={onTarget} /></View> : null}
      {zone ? (
        <>
          <Lbl style={{ marginTop: 14, marginBottom: 6 }}>{tr('Arăt zona ta?')}</Lbl>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Seg label={tr('Da, prin {zone}', { zone })} on={zoneOn} onPress={() => setZoneOn(true)} />
            <Seg label={tr('Nu')} on={!zoneOn} onPress={() => setZoneOn(false)} />
          </View>
        </>
      ) : null}
      <View style={{ marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: t.s2 }}>
        <Muted>{tr('Așa te văd ceilalți:')}</Muted>
        <T style={{ marginTop: 4, fontFamily: F.sb, fontSize: 15, lineHeight: 21 }}>{preview}</T>
        <Muted style={{ marginTop: 6 }}>{tr('Locul tău exact nu-l vede nimeni. Se stinge singur la final.')}</Muted>
      </View>
      {err ? <View style={{ marginTop: 10 }}><Note kind="err">{err}</Note></View> : null}
      <Big style={{ marginTop: 14 }} label={busy ? tr('Îi anunț…') : tr('Intră pe FreeNow ⚡')} disabled={busy} onPress={go} />
    </View>
  );
}

/** „Vin și eu”: galben, ca biletul FreeNow de pe Acasă. */
function JoinBtn({ onPress }: { onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityLabel={tr('Vin și eu')} style={{ flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: '#FFD43B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <T style={{ fontSize: 17 }}>⚡</T><T style={{ fontFamily: F.b, fontSize: 16, color: '#0E1440' }}>{tr('Vin și eu')}</T>
    </Press>
  );
}

function Person({ p, onJoin, onMute }: { p: Free; onJoin: () => void; onMute: () => void }) {
  const { t } = useTheme();
  const o = p.outing;
  const sub = [spanText(p.starts_at, p.ends_at), moodWords(p.moods), p.zone ? tr('prin {zone}', { zone: p.zone }) : ''].filter(Boolean).join(' · ');
  return (
    <View style={{ padding: 14, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: o?.mine ? t.blue : t.line, backgroundColor: t.s1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Face name={p.first_name} user={p.username} />
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontFamily: F.b, fontSize: 16 }}>{p.first_name + ' ' + (p.moods.map((m) => moodOf(m)?.emoji ?? '').join('') || '⚡')}</T>
          <Muted>{sub}</Muted>
          {p.via ? <Muted style={{ color: t.blueInk }}>{tr('prieten cu {name}', { name: p.via })}</Muted> : null}
          {o?.plan ? <Muted style={{ fontFamily: F.sb }}>{tr('Merg la {place} la {t}', { place: o.plan.venue_name, t: hhmm(new Date(o.plan.starts_at)) })}</Muted>
            : o && o.count > 1 ? <Muted style={{ fontFamily: F.sb }}>{tr('Iese deja cu încă {n}', { n: o.count - 1 })}</Muted> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {o?.mine ? <Note kind="ok">{tr('Ieșiți împreună')}</Note>
          : o && !o.open ? <Muted style={{ flex: 1 }}>{tr('Ieșirea lor s-a închis.')}</Muted>
          : <JoinBtn onPress={onJoin} />}
        <Quiet label={p.muted ? tr('🔔 Pornește') : tr('🔕 Fără notificări')} color={t.ink2} onPress={onMute} />
      </View>
    </View>
  );
}

export default function FreeNowScreen() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const who = useApp((s) => s.who);
  const known = useApp((s) => s.known);
  const st = useFreeNow();
  const [friends, setFriends] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/acasa'));

  useFocusEffect(useCallback(() => {
    if (!who || !known) return undefined;
    void refreshFreeNow();
    void listFriends(who.id).then((r) => setFriends(r.filter((x) => x.status === 'accepted').length)).catch(() => {});
    const id = setInterval(() => { void refreshFreeNow(); }, 30000);
    return () => clearInterval(id);
  }, [who, known]));
  useEffect(() => { watchOuting(st.outing?.id ?? null); }, [st.outing?.id]);

  const me = st.me;
  const out = st.outing;
  const host = out && who ? out.host === who.id : false;
  const now = Date.now();
  const myMoods = me?.moods ?? st.people.find((p) => p.id === out?.host)?.moods ?? [];
  const voteOpen = !!(out?.vote_id && !out.plan && out.vote_closes_at && new Date(out.vote_closes_at).getTime() > now);
  const halfGone = me && !out && now > (new Date(me.starts_at).getTime() + new Date(me.ends_at).getTime()) / 2;

  const run = async (key: string, f: () => Promise<string | null | undefined>) => { setBusy(key); const e = await f(); setBusy(''); if (e) toast(e); };
  const join = async (p: Free) => {
    setBusy('j' + p.id);
    const r = await joinFree(p.id);
    setBusy('');
    if (r.ask) {
      if (await ask({ title: tr('Ești deja într-o ieșire'), text: tr('Ieși din ea și vii cu {name}?', { name: p.first_name }), ok: tr('Da, vin cu {name}', { name: p.first_name }) })) {
        const x = await joinFree(p.id, true); if (x.err) toast(x.err);
      }
    } else if (r.err) toast(r.err);
    else toast(tr('Ești în ieșire cu {name}. Bilu alege locurile.', { name: p.first_name }));
  };
  const vote = async () => {
    if (!out) return;
    setBusy('vote');
    const r = await startOutingVote(out, myMoods);
    setBusy('');
    if (r.err) { toast(r.err); return; }
    router.push({ pathname: '/vot/[id]', params: { id: r.id! } });
  };
  const whatsapp = () => {
    if (!out) return;
    const names = out.members.filter((m) => m.id !== who?.id).map((m) => m.first_name).join(', ');
    void Share.share({ message: out.plan ? tr('Ne vedem la {place} la {t} (CeFaci · FreeNow)', { place: out.plan.venue_name, t: hhmm(new Date(out.plan.starts_at)) }) : tr('Ieșim acum? {names} — votăm locul în CeFaci (FreeNow).', { names }) }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: ins.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <H1 style={{ fontSize: 34, lineHeight: 35 }}>FreeNow ⚡</H1>
            <Muted style={{ marginTop: 6, fontSize: 15, lineHeight: 21 }}>{tr('Ai timp de ieșit? Dă-le de veste. Cine are chef vine cu tine, iar Bilu alege locul.')}</Muted>
          </View>
          <Bilu size={58} mood="wink" shadow={false} />
        </View>

        {!who || !known ? (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Muted style={{ fontSize: 15 }}>{tr('FreeNow merge cu cont și cu prieteni în CeFaci.')}</Muted>
            <Big label={tr('Mergi la Prieteni')} onPress={() => router.push('/prieteni')} />
          </View>
        ) : !st.loaded ? (
          <Muted style={{ marginTop: 18 }}>{tr('Mă uit cine mai e pe FreeNow…')}</Muted>
        ) : (
          <>
            {me ? (
              <View style={{ marginTop: 16, padding: 16, gap: 10, borderRadius: 22, backgroundColor: '#FFD43B' }}>
                <T style={{ fontFamily: F.display, fontSize: 22, color: '#0E1440' }}>{tr('Ești pe FreeNow {span}', { span: spanText(me.starts_at, me.ends_at) })}</T>
                <T style={{ fontFamily: F.sb, fontSize: 14, color: '#0E1440' }}>
                  {[moodWords(me.moods), tr('te văd: {who}', { who: tr(AUDIENCES.find((a) => a.id === me.audience)?.label ?? '').toLowerCase() }), me.zone ? tr('prin {zone}', { zone: me.zone }) : ''].filter(Boolean).join(' · ')}
                </T>
                {halfGone ? <T style={{ fontFamily: F.m, fontSize: 14, color: '#0E1440' }}>{tr('Nimeni n-a intrat încă. Vrei între timp un plan doar pentru tine? „Surprinde-mă” de pe Acasă.')}</T> : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Press onPress={() => run('ext', () => extendFreeNow(1))} accessibilityLabel={tr('Încă o oră')} style={{ flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontFamily: F.b, color: '#FFD43B' }}>{busy === 'ext' ? '…' : tr('+1 oră')}</T>
                  </Press>
                  <Press onPress={async () => { if (await ask({ title: tr('Ieși de pe FreeNow?'), text: out ? tr('Ieși și din ieșirea cu ceilalți.') : tr('Nu te mai vede nimeni pe FreeNow.'), ok: tr('Ies'), danger: true })) void run('stop', stopFreeNow); }}
                    accessibilityLabel={tr('Ieși de pe FreeNow')} style={{ flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 2, borderColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontFamily: F.b, color: '#0E1440' }}>{tr('Ieși de pe FreeNow')}</T>
                  </Press>
                </View>
              </View>
            ) : !out ? <StartForm friends={friends === 0 && st.people.length ? null : friends} /> : null}

            {out ? (
              <View style={{ marginTop: 16, padding: 16, gap: 12, borderRadius: 22, backgroundColor: t.s1, borderWidth: 2, borderColor: t.blue }}>
                <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>{out.plan ? tr('Mergeți la {place}', { place: out.plan.venue_name }) : tr('Ieșirea voastră')}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {out.members.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRadius: 99, backgroundColor: t.s2 }}>
                      <Face name={m.first_name} user={m.username} size={30} />
                      <T style={{ fontFamily: F.sb, fontSize: 14 }}>{m.id === who?.id ? tr('Tu') : m.first_name}{m.id === out.host ? ' ⭐' : ''}</T>
                    </View>
                  ))}
                </View>
                {out.has_minor ? <Muted>{tr('În ieșire e cineva sub 18 ani: Bilu alege doar locuri potrivite pentru toți.')}</Muted> : null}
                {out.plan ? (
                  <>
                    <Muted style={{ fontSize: 15 }}>{tr('La {t}. E pe biletul fiecăruia, cu drumul și rezervarea.', { t: hhmm(new Date(out.plan.starts_at)) })}</Muted>
                    <Big label={tr('Vezi biletul')} onPress={() => router.push('/planuri')} />
                  </>
                ) : out.members.length < 2 ? (
                  <Muted style={{ fontSize: 15 }}>{tr('Aștepți să mai vină cineva.')}</Muted>
                ) : voteOpen ? (
                  <>
                    <Muted style={{ fontSize: 15 }}>{tr('Votați până la {t}. Câștigă locul cu cele mai multe voturi.', { t: hhmm(new Date(out.vote_closes_at!)) })}</Muted>
                    <Big label={tr('Votează')} onPress={() => router.push({ pathname: '/vot/[id]', params: { id: out.vote_id! } })} />
                    {host ? <Big label={busy === 'end' ? '…' : tr('Alegem acum')} color={t.s2} ink={t.ink} onPress={() => run('end', endVoteNow)} /> : null}
                  </>
                ) : out.vote_id ? (
                  <Big label={tr('Vezi ce a câștigat')} onPress={() => router.push({ pathname: '/vot/[id]', params: { id: out.vote_id! } })} />
                ) : (
                  <>
                    <Muted style={{ fontSize: 15 }}>{tr('Bilu alege 3 locuri deschise acum pentru voi toți, apoi votați 15 minute.')}</Muted>
                    <Big label={busy === 'vote' ? tr('Bilu caută…') : tr('Bilu, alege 3 locuri')} disabled={busy === 'vote'} onPress={vote} />
                  </>
                )}
                {host ? (
                  <View style={{ gap: 6 }}>
                    <Lbl>{tr('Mai poate veni lume?')}</Lbl>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Seg label={tr('Da')} on={out.open} onPress={() => { if (!out.open) void run('open', () => setOutingOpen(true)); }} />
                      <Seg label={tr('Nu, suntem destui')} on={!out.open} onPress={() => { if (out.open) void run('open', () => setOutingOpen(false)); }} />
                    </View>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Quiet label={tr('Scrie-le pe WhatsApp')} onPress={whatsapp} />
                  <Quiet label={tr('Nu mai vin')} onPress={async () => { if (await ask({ title: tr('Nu mai vii?'), text: tr('Ceilalți află că nu mai poți.'), ok: tr('Nu mai vin'), danger: true })) void run('leave', leaveOuting); }} />
                </View>
              </View>
            ) : null}

            <T accessibilityRole="header" style={{ marginTop: 24, fontFamily: F.display, fontSize: 22 }}>{tr('Cine mai e pe FreeNow')}</T>
            <View style={{ marginTop: 10, gap: 10 }}>
              {st.people.length ? st.people.map((p) => (
                <Person key={p.id} p={p} onJoin={() => { if (!busy) void join(p); }} onMute={() => run('m' + p.id, () => muteFree(p.id, !p.muted))} />
              )) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
                  <Bilu size={36} mood="hi" shadow={false} still />
                  <Muted style={{ flex: 1, fontSize: 14 }}>{tr('Nimeni pe FreeNow acum. Când intră un prieten (sau un prieten de-al lor), afli pe loc.')}</Muted>
                </View>
              )}
            </View>
            {st.quiet ? <Muted style={{ marginTop: 12 }}>{tr('Notificările FreeNow sunt oprite (Setări).')}</Muted> : null}
          </>
        )}
      </ScrollView>
      <TopShade />
    </View>
  );
}
