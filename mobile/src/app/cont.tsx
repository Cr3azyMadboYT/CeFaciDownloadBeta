// Sign-up, as in design/canvas/client/Cont: start → (email code) → name, username, birth date → zone → likes →
// style → five real places → friends → done. An account is needed: Google or an email code (decision Cornel, 04.10: no "Continuă fără cont").
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Easing, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from '../ui/insets';
import Svg, { Path, Rect } from 'react-native-svg';
import { APP, finishSignup, getApp, lastSignIn, onSignedIn, onSyncTrouble, useApp, usernameFree } from '../lib/session';
import type { Home } from '../../../src/app/bridge';
import { nearestZone } from '../../../src/engine/core';
import { E2E } from '../lib/e2e';
import { RadiusChooser, WhereChooser } from '../ui/WherePick';
import type { Who } from '../lib/auth';
import { signOutEverywhere, googleSignInAvailable } from '../lib/auth';
import { LIKES } from '../lib/answers';
import { useLightBar } from '../ui/bar';
import { Bilu, type Mood } from '../ui/Bilu';
import { Icon } from '../ui/Icon';
import { Big, Chip, Field, H1, Lbl, Lead, Muted, Note, Press, Quiet, Say, Seg, Sheet, T } from '../ui/kit';
import { F, useTheme } from '../ui/theme';
import { Doodles } from '../ui/Doodles';
import {AccountLegalNotice} from '../../../shared/AccountLegalNotice';
import { LangPick } from '../ui/LangPick';
import { LegalLinks } from '../ui/LegalLinks';
import { isRudeName, RUDE_SAY } from '../../../src/app/names';
import { tr, trServer } from '../lib/i18n';

const STEPS = ['start', 'name', 'zone', 'radius', 'likes', 'style', 'picks', 'friends', 'done'] as const;
type Step = (typeof STEPS)[number] | 'email';
const clean = (x: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]/g, '').slice(0, 20);

/** Steps slide in from the right, like the design's `.scr`. */
function Slide({ k, children }: { k: string; children: ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { a.setValue(0); Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start(); }, [k, a]);
  return <Animated.View style={{ flex: 1, opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>{children}</Animated.View>;
}

/** The light step screens: back button, progress bar, scrolling body, button at the bottom. */
function StepScreen({ k, onBack, children, foot }: { k: number; onBack: () => void; children: ReactNode; foot?: ReactNode }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(w, { toValue: Math.max(0, k - 1) / 7, duration: 500, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: false }).start(); }, [k, w]);
  return (
    <View style={{ flex: 1, backgroundColor: t.bgCont }}>
      <Doodles />
      <View style={{ paddingTop: ins.top + 8, paddingHorizontal: 16, height: ins.top + 60, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Press onPress={onBack} accessibilityLabel={tr('Înapoi')} style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" color={t.ink} />
        </Press>
        <View style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: t.s3, overflow: 'hidden' }}>
          <Animated.View style={{ height: 6, borderRadius: 99, backgroundColor: t.blue, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
        </View>
        <Lbl style={{ fontFamily: F.b }}>{tr('{n} din 7', { n: Math.max(1, k) })}</Lbl>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: foot ? 20 : ins.bottom + 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {foot ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(ins.bottom, 12) + 18, backgroundColor: t.bgCont, borderTopWidth: 1, borderTopColor: t.line }}>{foot}</View> : null}
    </View>
  );
}

const GoogleG = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.34Z" fill="#4285F4" />
    <Path d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.5c-.9.6-2.05.95-3.4.95-2.6 0-4.82-1.76-5.6-4.13H3.06v2.58A10 10 0 0 0 12 22Z" fill="#34A853" />
    <Path d="M6.4 13.89a6 6 0 0 1 0-3.78V7.53H3.06a10 10 0 0 0 0 8.94l3.34-2.58Z" fill="#FBBC04" />
    <Path d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.53L6.4 10.1C7.18 7.74 9.4 5.98 12 5.98Z" fill="#EA4335" />
  </Svg>
);
const Logo = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24">
    <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" fill="#FFD43B" />
    <Path d="M13 5v2M13 11v2M13 17v2" stroke="#0E1440" strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);
const MailIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke="#FFFFFF" strokeWidth={1.8} />
    <Path d="m22 7-10 6L2 7" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** The first screen's background (decision Cornel, 04.10: „întrebările în background, ca pe WhatsApp”, no animation,
 *  nothing that eats battery): the questions every group chat asks before going out, faint behind the text. */
// doar sus, pe margini, în jurul lui Bilu (Cornel, 13.10: sub text și butoane se citea greu)
const CHAT: [string, 'l' | 'r', number][] = [
  ['Ieșim diseară?', 'l', 0.11], ['Ce facem? 🤔', 'r', 0.15], ['La cât?', 'l', 0.21], ['Și dacă plouă? ☔', 'r', 0.26],
  ['Cine mai vine?', 'l', 0.31], ['Vin și eu! 🙌', 'r', 0.36],
];
function ChatBg() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, right: 0, top: 0, height }}>
      {CHAT.filter(([, , y]) => height >= 760 || y <= 0.26).map(([text, side, y]) => (
        <View key={text} style={{ position: 'absolute', top: y * height, [side === 'l' ? 'left' : 'right']: 14, maxWidth: width * 0.34, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14,
          borderBottomLeftRadius: side === 'l' ? 4 : 14, borderBottomRightRadius: side === 'r' ? 4 : 14, backgroundColor: side === 'l' ? 'rgba(255,255,255,0.04)' : 'rgba(47,91,255,0.10)' }}>
          <T numberOfLines={1} style={{ fontFamily: F.sb, fontSize: 12.5, color: 'rgba(255,255,255,0.16)' }}>{tr(text)}</T>
        </View>
      ))}
    </View>
  );
}

/** The navy glow behind Bilu on the dark screens. */
const Glow = ({ top }: { top: number }) => (
  <View pointerEvents="none" style={{ position: 'absolute', top, alignSelf: 'center', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(47,91,255,0.06)' }} />
);

export default function Cont() {
  const { t, name: themeName, set: setTheme } = useTheme();
  const ins = useSafeAreaInsets();
  const winH = useWindowDimensions().height;
  const short = winH < 760; // small phones: a smaller Bilu, so the buttons stay on screen
  const prefs = useApp((s) => s.prefs);
  const [step, setStep] = useState<Step>('start');
  const [authErr, setAuthErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [codeBad, setCodeBad] = useState(false);
  const [first, setFirst] = useState('');
  const [user, setUser] = useState('');
  const [birth, setBirth] = useState('');
  const [ageAsk, setAgeAsk] = useState(false);
  const [birthIso, setBirthIso] = useState('');
  const [home, setHome] = useState<Home | undefined>(prefs.home);
  const [live, setLive] = useState(!!prefs.live);
  const [radius, setRadius] = useState<number | null>(prefs.radiusKm ?? null);
  const dist = '20';
  const zoneId = home ? nearestZone(home).id : prefs.zone || 'centru';
  const [moves, setMoves] = useState<string[]>(['walk', 'car']);
  // Bilu's radius until they pick one: follows "Cum ajungi?" (on foot: at most 5 km), like the badge on the map
  const km = radius ?? (home ? APP.bestRadius(home, moves) : 20);
  const [likes, setLikes] = useState<string[]>([]);
  const [budget, setBudget] = useState('100');
  const [who, setWho] = useState(''); // asked, not guessed: alone, in two or with the crew changes every plan
  const [when, setWhen] = useState<string[]>(['eve', 'we']);
  const [mood, setMood] = useState('mix');
  const [votes, setVotes] = useState<[string | undefined, string][]>([]);
  const [focus, setFocus] = useState('');
  const [saveErr, setSaveErr] = useState('');

  useLightBar(step === 'start' || step === 'done');
  const k = STEPS.indexOf(step as (typeof STEPS)[number]);
  const go = (s: Step) => setStep(s);
  const back = () => { if (step === 'email') go('start'); else go(STEPS[Math.max(0, k - 1)]); };

  // the Android back button walks the steps backwards
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { if (step === 'start') return false; back(); return true; });
    return () => h.remove();
  });

  // Google / email worked: an existing account goes straight in, a new one continues with the name step
  // (also when the sign-in happened before this screen opened, e.g. the app was closed at the name step)
  const signedInDone = (w: Who, known: boolean) => {
    setBusy(false);
    if (known) { router.replace('/acasa'); return; }
    setFirst((f) => f || w.first);
    setStep((s) => (s === 'start' || s === 'email' ? 'name' : s));
  };
  useEffect(() => onSignedIn(signedInDone), []);
  /** Google or the code worked; if it was the account already signed in, nothing new fires, so continue here. */
  const afterAuth = () => { const l = lastSignIn(); if (l) signedInDone(l.who, l.known); };
  const [netErr, setNetErr] = useState('');
  useEffect(() => onSyncTrouble(setNetErr), []);

  // ---------- name ----------
  const u = clean(user);
  // with an account the username is checked on the server as you type; without one it only has to look right
  const [free, setFree] = useState<Record<string, boolean>>({});
  const signedIn = useApp((s) => !!s.who);
  // set up on this phone before, but without an account (an older version): only signing in is left
  const returning = useApp((s) => s.onboarded && !s.account);
  useEffect(() => {
    if (!signedIn || u.length < 3 || free[u] !== undefined) return;
    const id = setTimeout(() => { void usernameFree(u).then((ok) => { if (ok !== null) setFree((f) => ({ ...f, [u]: ok })); }); }, 400);
    return () => clearTimeout(id);
  }, [u, signedIn, free]);
  const userTaken = u.length >= 3 && free[u] === false;
  const userOk = u.length >= 3 && !userTaken && (!signedIn || free[u] === true);
  const bM = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(birth);
  const bIso = bM ? bM[3] + '-' + bM[2] + '-' + bM[1] : '';
  const bDt = bM ? new Date(Number(bM[3]), Number(bM[2]) - 1, Number(bM[1])) : null;
  const bReal = !!bDt && !!bM && bDt.getDate() === Number(bM[1]) && bDt.getMonth() === Number(bM[2]) - 1 && bDt.getTime() <= Date.now();
  const age = bReal ? APP.age(bIso) : null;
  // 16–17 (the birth date they confirmed): the questions leave out clubs, party and nights out
  const minor = !!birthIso && (APP.age(birthIso) ?? 18) < 18;
  const bOk = age !== null && age <= 110;
  const ageNote = !birth ? tr('Ca să nu-ți arătăm locuri pentru care n-ai vârsta.') : !bM ? tr('Scrie data așa: 14.05.2004.') : !bOk ? tr('Data nu pare bună. Verifică ziua, luna și anul.') : age! < 16 ? tr('CeFaci e de la 16 ani în sus. Revino peste câțiva ani, te așteptăm!') : age! < 18 ? tr('Până la 18 ani îți arătăm doar locurile pentru oricine, fără baruri și cluburi.') : tr('Perfect, vezi toate locurile, inclusiv cele 18+.');
  // nume urâte (Cornel, 06.10): Bilu cere alt nume; serverul verifică la fel
  const rudeFirst = isRudeName(first), rudeUser = isRudeName(u);
  const nameOff = first.trim().length < 2 || !userOk || !bOk || age! < 16 || rudeFirst || rudeUser;
  const onBirth = (x: string) => { const dg = x.replace(/\D/g, '').slice(0, 8); setBirth(dg.length > 4 ? dg.slice(0, 2) + '.' + dg.slice(2, 4) + '.' + dg.slice(4) : dg.length > 2 ? dg.slice(0, 2) + '.' + dg.slice(2) : dg); setAgeAsk(false); };

  // ---------- email ----------
  const mailN = mail.trim().toLowerCase();
  const mailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(mailN);
  const sendOrVerify = async () => {
    setBusy(true); setAuthErr('');
    if (!sent) { const err = await APP.emailStart(mailN); setBusy(false); if (err) setAuthErr(err); else setSent(true); return; }
    const err = await APP.emailVerify(mailN, code);
    if (err) { setBusy(false); setCodeBad(true); return; }
    afterAuth(); // otherwise it continues in onSignedIn
  };

  // ---------- picks: five real places near the chosen zone ----------
  const real = useMemo(() => (step === 'picks' ? APP.picksFor(likes, zoneId, { budget, when, who, birth: birthIso, at: home }) : []), [step, likes, zoneId, budget, when, who, birthIso]);
  const pick = votes.length;
  const card = real[Math.min(pick, real.length - 1)];
  const yes = votes.filter(([, v]) => v === 'yes').length;
  const vote = (v: string) => {
    if (card) APP.notePick(card.id, v);
    const next = votes.concat([[card?.id, v]]);
    setVotes(next);
    if (next.length >= Math.min(5, real.length || 5)) setTimeout(() => go('friends'), 450);
  };

  const say: Partial<Record<Step, [Mood, string]>> = {
    email: ['hi', sent ? tr('Ți-am trimis un cod pe email. Scrie-l aici.') : tr('Scrie-mi emailul. Îți trimit un cod, ca să știu că ești tu.')],
    name: rudeFirst || rudeUser ? ['oops', tr(RUDE_SAY)] : ageAsk ? ['oops', tr('Stai puțin! Verific o dată cu tine data nașterii.')] : ['wink', tr('Salut! Cum să-ți zic? Prietenii te găsesc după username.')],
    zone: ['up', tr('De unde pleci de obicei? Cel mai simplu: folosește locația ta. Sau alege tu orașul ori sectorul.')],
    radius: ['wink', tr('Cât de departe ai merge pentru o seară bună? Ți-am pus raza în care ai destule locuri. O schimbi oricând de pe Acasă.')],
    likes: ['hi', likes.length >= 3 ? tr('Bun gust! Mai alege dacă vrei, sau mergi mai departe.') : first.trim() ? tr('Alege măcar 3 lucruri care îți plac, {name}. Așa știu de unde să încep.', { name: first.trim() }) : tr('Alege măcar 3 lucruri care îți plac. Așa știu de unde să încep.')],
    style: ['wink', !who ? tr('Întâi: ieși mai mult singur, în doi sau cu gașca? Îți fac alte planuri pentru fiecare.') : tr('Încă puțin: cât cheltui de obicei și când ieși. Nu te judec, promit.')],
    picks: ['up', pick === 0 ? tr('Aproape gata: {n} locuri reale din zona ta. Zi-mi repede dacă ai merge.', { n: real.length || 5 }) : votes[votes.length - 1][1] === 'yes' ? tr('Notat! Îmi place cum gândești.') : votes[votes.length - 1][1] === 'no' ? tr('Ok, pe ăsta nu ți-l mai arăt des.') : tr('Hmm, bine. Îl las pe „poate”.')],
    friends: who === 'solo' ? ['wink', tr('Îți fac planuri pentru tine: cafenele, muzee, filme, plimbări. Când ai chef de companie, adaugi prieteni.')]
      : who === 'duo' ? ['hi', tr('Adaugă-l pe cel cu care ieși și vă trimit planurile amândurora.')]
      : ['hi', tr('Cu gașca e mai distractiv: votați împreună unde mergeți.')],
  };
  const sayNow = say[step];

  const toggle = (list: string[], set: (x: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : list.concat([v]));
  const startPicks = () => { setVotes([]); go('picks'); };
  const enter = async () => {
    setBusy(true);
    const err = await finishSignup({ first, user: u, birthIso, zoneId, dist, moves, likes: minor ? likes.filter((x) => x !== 'party') : likes, budget, who, when: minor ? when.filter((x) => x !== 'late') : when, mood: minor && mood === 'party' ? 'mix' : mood, votes, home, radiusKm: km, live });
    setBusy(false);
    if (err) { setSaveErr(err); go('name'); return; }
    router.replace('/acasa');
  };
  const restart = () => {
    if (getApp().who) void signOutEverywhere(); // from the very beginning: sign in again, with any account
    setStep('start'); setFirst(''); setUser(''); setBirth(''); setBirthIso(''); setLikes([]); setVotes([]); setSent(false); setCode(''); setMail('');
  };

  // ---------- screens ----------
  if (step === 'start') {
    // fără scroll (Cornel, 13.10): totul încape pe ecran; termenii mici, jos de tot
    const tiny = winH < 680;
    return (
      <Slide k="start">
        <View style={{ flex: 1, backgroundColor: '#0E1440', paddingTop: ins.top, overflow: 'hidden' }}>
          <ChatBg />
          <Glow top={ins.top + 70} />
          <View style={{ paddingTop: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Logo />
            <T style={{ fontFamily: F.display, fontSize: 25, letterSpacing: -0.5, color: '#FFFFFF' }}>CeFaci</T>
            <View style={{ flex: 1 }} />
            <LangPick dark />
            <Press onPress={() => setTheme(themeName === 'noapte' ? 'zi' : 'noapte')} accessibilityLabel={themeName === 'noapte' ? tr('Treci pe tema de zi') : tr('Treci pe tema de noapte')}
              style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={themeName === 'noapte' ? 'sun' : 'moon'} size={16} color="#FFFFFF" />
            </Press>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center' }}><Bilu size={tiny ? 96 : short ? 124 : 160} mood="hi" /></View>
            <T accessibilityRole="header" style={{ marginTop: tiny ? 10 : 18, marginHorizontal: 24, textAlign: 'center', fontFamily: F.display, fontSize: tiny ? 30 : 36, lineHeight: tiny ? 32 : 38, letterSpacing: -1, color: '#FFFFFF' }}>{tr('Nu mai stai acasă\nfără să vrei.')}</T>
            <T style={{ marginTop: 10, marginHorizontal: 32, textAlign: 'center', fontFamily: F.m, fontSize: tiny ? 14.5 : 16, lineHeight: tiny ? 20 : 23, color: '#C9CEE6' }}>{returning ? tr('Bine ai revenit! Intră în cont și tot ce ai pe telefon (planuri, XP, ce-ți place) merge mai departe, cu prieteni și vremea pe zile.') : tr('Eu sunt Bilu. Îți fac contul în două minute și aflu ce-ți place.')}</T>
          </View>
          <View style={{ marginHorizontal: 20, marginBottom: Math.max(ins.bottom, 12) + 6, gap: 10 }}>
            {googleSignInAvailable&&<Press disabled={busy} onPress={async () => { setAuthErr(''); setBusy(true); const err = await APP.google(); if (err) { setBusy(false); setAuthErr(err); } else { afterAuth(); setTimeout(() => setBusy(false), 8000); } }}
              style={{ height: 56, borderRadius: 18, backgroundColor: '#FFD43B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <GoogleG />
              <T style={{ fontFamily: F.sb, fontSize: 16, color: '#0E1440' }}>{busy ? tr('O clipă…') : tr('Continuă cu Google')}</T>
            </Press>}
            <Press disabled={busy} onPress={() => { setAuthErr(''); setSent(false); setCode(''); go(E2E ? 'name' : 'email'); }}
              style={{ height: 56, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <MailIcon />
              <T style={{ fontFamily: F.sb, fontSize: 16, color: '#FFFFFF' }}>{tr('Continuă cu email')}</T>
            </Press>
            {authErr || netErr ? <Note kind="err">{authErr || netErr}</Note> : null}
            <T style={{ marginTop: 2, textAlign: 'center', fontFamily: F.m, fontSize: 12.5, lineHeight: 17, color: '#A9B1DA' }}>{googleSignInAvailable?tr('Ai deja cont? Intră la fel, cu Google sau cu emailul.'):tr('Ai deja cont? Intră cu aceeași adresă de email.')}</T>
            <View style={{ marginTop: 4 }}><AccountLegalNotice audience="client" theme={t} dark small creating={!returning} extra={<LegalLinks dark tiny />} /></View>
          </View>
        </View>
      </Slide>
    );
  }

  if (step === 'done') {
    const BUDGET_TXT: Record<string, string> = { '0': tr('gratis'), '50': '≤ 50 lei', '100': '≤ 100 lei', any: tr('orice buget') };
    const summary = likes.slice(0, 3).map((key) => tr(LIKES.find((l) => l[0] === key)![1])).concat([(home ? home.name + ', ' : '') + tr('până la {km} km', { km }), BUDGET_TXT[budget], tr('{y} din {n} locuri pe listă', { y: yes, n: votes.length })]);
    return (
      <Slide k="done">
        <ScrollView style={{ flex: 1, backgroundColor: '#0E1440' }} contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top }} bounces={false} showsVerticalScrollIndicator={false}>
          <Glow top={ins.top + 40} />
          <View style={{ alignItems: 'center', marginTop: short ? 20 : 56 }}><Bilu size={short ? 110 : 150} mood="yay" /></View>
          <T accessibilityRole="header" style={{ marginTop: 16, marginHorizontal: 24, textAlign: 'center', fontFamily: F.display, fontSize: 34, lineHeight: 35, letterSpacing: -0.7, color: '#FFFFFF' }}>{first.trim() ? tr('Gata, {name}! Acum te cunosc puțin.', { name: first.trim() }) : tr('Gata! Acum te cunosc puțin.')}</T>
          <T style={{ marginTop: 10, marginHorizontal: 30, textAlign: 'center', fontFamily: F.m, fontSize: 15, lineHeight: 22, color: '#C9CEE6' }}>{tr('Cu cât ieși mai mult și îmi spui cum a fost, cu atât te nimeresc mai bine.')}</T>
          <View style={{ marginTop: 18, marginHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
            {summary.map((x) => (
              <View key={x} style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' }}>
                <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>{x}</T>
              </View>
            ))}
          </View>
          <T style={{ marginTop: 16, marginHorizontal: 30, textAlign: 'center', fontFamily: F.m, fontSize: 12, lineHeight: 17, color: '#A9B1DA' }}>{tr('Ce-mi spui folosesc doar ca să-ți recomand locuri. Nu vindem date și nu arătăm reclame. Schimbi oricând din Profil → Ce-ți place.')}</T>
          <View style={{ flex: 1 }} />
          <View style={{ marginHorizontal: 20, marginBottom: Math.max(ins.bottom, 12) + 20, gap: 8 }}>
            <Big label={busy ? tr('O clipă…') : tr('Intră în aplicație')} color="#FFD43B" ink="#0E1440" onPress={enter} disabled={busy} />
            <Quiet label={tr('Ia-o de la capăt')} color="#FFFFFF" onPress={restart} />
          </View>
        </ScrollView>
      </Slide>
    );
  }

  const bubble = sayNow ? <Say mood={sayNow[0]} text={sayNow[1]} /> : null;

  if (step === 'email') {
    // Supabase sends 6 to 10 digits, depending on the project setting: take whatever came
    const off = busy || (sent ? code.length < 6 : !mailOk);
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Slide k="email">
          <StepScreen k={1} onBack={back} foot={<View style={{gap: 8}}>{!sent && <AccountLegalNotice audience="client" theme={t} creating={!returning}/>}<Big label={busy ? tr('O clipă…') : sent ? tr('Confirmă codul') : tr('Trimite-mi codul')} disabled={off} onPress={sendOrVerify} /></View>}>
            {bubble}
            <H1>{tr('Emailul tău')}</H1>
            <View style={{ marginTop: 14, gap: 8 }}>
              <Field value={mail} onChangeText={(x) => { setMail(x.slice(0, 80)); setSent(false); setCode(''); setAuthErr(''); }} placeholder={tr('nume@exemplu.ro')} accessibilityLabel={tr('Adresa de email')}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} textContentType="emailAddress" returnKeyType="send"
                onSubmitEditing={() => { if (!off) sendOrVerify(); }} focused={focus === 'mail'} onFocus={() => setFocus('mail')} onBlur={() => setFocus('')} />
              {authErr || netErr ? <Note kind="err">{authErr || netErr}</Note> : null}
              {sent ? (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Lbl>{tr('Codul din email')}</Lbl>
                  <Field big value={code} onChangeText={(x) => { setCode(x.replace(/\D/g, '').slice(0, 10)); setCodeBad(false); }} placeholder={tr('cod')} accessibilityLabel={tr('Codul din email')}
                    keyboardType="number-pad" returnKeyType="done" onSubmitEditing={() => { if (!off) void sendOrVerify(); }} autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} autoFocus
                    focused={focus === 'code'} onFocus={() => setFocus('code')} onBlur={() => setFocus('')} />
                  {codeBad ? <Note kind="err">{tr('Codul nu e bun. Mai încearcă.')}</Note> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Muted style={{ flex: 1 }}>{tr('Nu l-ai primit? Uită-te și la Spam.')}</Muted>
                    <Quiet label={tr('Trimite din nou')} onPress={async () => { setAuthErr(''); setCode(''); const err = await APP.emailStart(mailN); setAuthErr(err || ''); }} />
                  </View>
                </View>
              ) : null}
            </View>
          </StepScreen>
        </Slide>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'name') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Slide k="name">
          <StepScreen k={1} onBack={back} foot={<Big label={tr('Mai departe')} disabled={nameOff} onPress={() => setAgeAsk(true)} />}>
            {bubble}
            <H1>{tr('Cum te cheamă?')}</H1>
            {saveErr ? <View style={{ marginTop: 10 }}><Note kind="err">{trServer(saveErr)}</Note></View> : null}
            <View style={{ marginTop: 14, gap: 8 }}>
              <Lbl>{tr('Prenumele')}</Lbl>
              <Field value={first} onChangeText={(x) => setFirst(x.slice(0, 24))} placeholder={tr('ex: Cornel')} accessibilityLabel={tr('Prenumele')} autoCapitalize="words" autoComplete="given-name" textContentType="givenName"
                focused={focus === 'fn'} onFocus={() => setFocus('fn')} onBlur={() => setFocus('')} />
              {rudeFirst ? <Note kind="err">{tr(RUDE_SAY)}</Note> : <Muted>{tr('Prietenii îți văd prenumele și inițiala numelui.')}</Muted>}
              <Lbl style={{ marginTop: 8 }}>Username</Lbl>
              <Field prefix="@" value={u} onChangeText={(x) => { setUser(clean(x)); setSaveErr(''); }} placeholder={tr('cum te găsesc prietenii')} accessibilityLabel="Username" autoCapitalize="none" autoCorrect={false}
                focused={focus === 'un'} onFocus={() => setFocus('un')} onBlur={() => setFocus('')} />
              {rudeUser ? <Note kind="err">{tr(RUDE_SAY)}</Note> : userTaken ? (
                <View style={{ gap: 8 }}>
                  <Note kind="err">{tr('@{u} e deja luat. Încearcă una din astea:', { u })}</Note>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[u + '.ies', u + '_cf', u + (bM ? bM[3].slice(2) : '23')].map((s) => <Chip key={s} small label={'@' + s} onPress={() => setUser(s)} />)}
                  </View>
                </View>
              ) : userOk && signedIn ? <Note kind="ok">{tr('@{u} e liber.', { u })}</Note> : signedIn && u.length >= 3 ? <Muted>{tr('Verific dacă e liber…')}</Muted> : null}
              <Lbl style={{ marginTop: 8 }}>{tr('Data nașterii')}</Lbl>
              <Field value={birth} onChangeText={onBirth} placeholder={tr('ZZ.LL.AAAA, ex: 14.05.2004')} accessibilityLabel={tr('Data nașterii')} keyboardType="number-pad" maxLength={10}
                focused={focus === 'bd'} onFocus={() => setFocus('bd')} onBlur={() => setFocus('')} />
              <Muted style={age !== null && age < 16 ? { color: t.coralInk, fontFamily: F.sb } : undefined}>{ageNote}</Muted>
            </View>
          </StepScreen>
        </Slide>
        <Sheet open={ageAsk && bOk} onClose={() => setAgeAsk(false)}>
          <H1 style={{ fontSize: 26 }}>{tr('Sigur e data corectă?')}</H1>
          <T style={{ marginTop: 8, fontFamily: F.sb, fontSize: 16 }}>{tr('{d} înseamnă că ai {n} ani.', { d: birth, n: age ?? '' })}</T>
          {age !== null && age < 18 ? <Muted style={{ marginTop: 8 }}>{tr('Până la 18 ani îți arătăm doar locurile pentru oricine: fără cluburi, baruri, pub-uri, narghilea și alte locuri 18+.')}</Muted> : null}
          <View style={{ marginTop: 18, gap: 8 }}>
            <Big label={tr('Da, e corectă')} onPress={() => { setAgeAsk(false); setBirthIso(bIso); go('zone'); }} />
            <Quiet label={tr('O corectez')} onPress={() => setAgeAsk(false)} />
          </View>
        </Sheet>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'zone') {
    return (
      <Slide k="zone">
        <StepScreen k={2} onBack={back} foot={<Big label={tr('Mai departe')} disabled={!home} onPress={() => go('radius')} />}>
          {bubble}
          <H1>{tr('De unde pleci?')}</H1>
          <View style={{ marginTop: 14 }}>
            <WhereChooser value={home} live={live} onPick={(h, l) => { setHome(h); setLive(l); setRadius(null); setTimeout(() => go('radius'), 350); }} />
          </View>
        </StepScreen>
      </Slide>
    );
  }

  if (step === 'radius' && home) {
    return (
      <Slide k="radius">
        <StepScreen k={3} onBack={back} foot={<Big label={tr('Mai departe')} disabled={moves.length === 0} onPress={() => go('likes')} />}>
          {bubble}
          <H1>{tr('Cât de departe?')}</H1>
          <Muted style={{ marginTop: 4 }}>{live ? tr('Pleci din {name} (locația ta).', { name: home.name }) : tr('Pleci din {name}.', { name: home.name })}</Muted>
          <View style={{ marginTop: 12 }}>
            <RadiusChooser home={home} km={km} moves={moves} onKm={setRadius} onMove={(h) => { setHome(h); setLive(false); }} />
          </View>
          <Lbl style={{ marginTop: 16, marginBottom: 8 }}>{tr('Cum ajungi?')} <T style={{ fontFamily: F.m, fontSize: 13, color: t.ink3 }}>{tr('Oricâte')}</T></Lbl>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[['walk', 'Pe jos'], ['car', 'Cu mașina'], ['bus', 'Cu autobuzul'], ['bike', 'Pe bicicletă']].map(([key, label]) => <Chip key={key} label={tr(label)} on={moves.includes(key)} onPress={() => toggle(moves, setMoves, key)} />)}
          </View>
        </StepScreen>
      </Slide>
    );
  }

  if (step === 'likes') {
    const n = likes.length;
    return (
      <Slide k="likes">
        <StepScreen k={4} onBack={back} foot={<Big label={n < 3 ? tr('Alege încă {n}', { n: 3 - n }) : tr('Mai departe')} disabled={n < 3} onPress={() => go('style')} />}>
          {bubble}
          <H1>{tr('Ce-ți place?')}</H1>
          <Lead style={{ marginTop: 6 }}>{n === 0 ? tr('Alege măcar 3. Poți schimba oricând.') : n < 3 ? tr('Mai alege {n}.', { n: 3 - n }) : tr('{n} alese. Bun început!', { n })}</Lead>
          <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {LIKES.filter(([key]) => !(minor && key === 'party')).map(([key, label, bg, icon]) => {
              const on = likes.includes(key);
              return (
                <View key={key} style={{ width: '48.5%', borderRadius: 23, borderWidth: 3, borderColor: on ? '#FFD43B' : 'transparent', margin: -3 }}>
                  <Press onPress={() => toggle(likes, setLikes, key)} accessibilityLabel={tr(label)} accessibilityState={{ selected: on }}
                    style={{ minHeight: 96, padding: 12, borderRadius: 20, backgroundColor: bg, borderWidth: 2, borderColor: on ? '#0E1440' : 'transparent', justifyContent: 'space-between' }}>
                    <Icon d={icon} size={28} color="#0E1440" />
                    <T style={{ marginTop: 14, fontFamily: F.b, fontSize: 15, lineHeight: 17, color: '#0E1440' }}>{tr(label)}</T>
                    {on ? (
                      <View style={{ position: 'absolute', right: 10, top: 10, width: 24, height: 24, borderRadius: 99, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={14} color="#FFD43B" width={3} />
                      </View>
                    ) : null}
                  </Press>
                </View>
              );
            })}
          </View>
        </StepScreen>
      </Slide>
    );
  }

  if (step === 'style') {
    const rows: [string, string, string[] | string, (v: string) => void, [string, string][], boolean][] = [
      ['st-w', 'Cu cine ieși cel mai des', who, setWho, [['solo', 'Singur'], ['duo', 'În doi'], ['group', 'Cu gașca']], false],
      ['st-b', 'Cât cheltui de obicei, de persoană', budget, setBudget, [['0', 'Gratis'], ['50', '≤ 50 lei'], ['100', '≤ 100'], ['any', 'Oricât']], false],
      // under 18: no nights out and no party (the app shows them none)
      ['st-t', 'Când ieși', when, (v) => toggle(when, setWhen, v), minor ? [['day', 'Ziua'], ['eve', 'Seara'], ['we', 'Weekend']] : [['day', 'Ziua'], ['eve', 'Seara'], ['late', 'Noaptea'], ['we', 'Weekend']], true],
      ['st-m', 'Mai degrabă', mood, setMood, minor ? [['chill', 'Liniște'], ['mix', 'Și-și'], ['fun', 'Distracție']] : [['chill', 'Chill'], ['mix', 'Și-și'], ['party', 'Party']], false],
    ];
    return (
      <Slide k="style">
        <StepScreen k={5} onBack={back} foot={<Big label={!who ? tr('Alege cu cine ieși') : tr('Mai departe')} disabled={when.length === 0 || !who} onPress={startPicks} />}>
          {bubble}
          <H1>{tr('Cum ieși tu?')}</H1>
          {rows.map(([id, label, val, set, opts, multi]) => (
            <View key={id} style={{ marginTop: 14 }}>
              <Lbl style={{ marginBottom: 8 }}>{tr(label)}</Lbl>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {opts.map(([v, text]) => <Seg key={v} label={tr(text)} on={multi ? (val as string[]).includes(v) : val === v} onPress={() => set(v)} />)}
              </View>
            </View>
          ))}
        </StepScreen>
      </Slide>
    );
  }

  if (step === 'picks') {
    const total = real.length || 5;
    const like = card ? LIKES.find((l) => l[0] === card.like) ?? LIKES[5] : LIKES[5];
    return (
      <Slide k="picks">
        <StepScreen k={6} onBack={back} foot={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Press onPress={() => vote('no')} disabled={!card || pick >= total} style={{ flex: 1, height: 60, borderRadius: 20, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="close" color={t.ink} /><T style={{ fontFamily: F.b, fontSize: 16 }}>{tr('Nu prea')}</T>
            </Press>
            <Press onPress={() => vote('maybe')} disabled={!card || pick >= total} style={{ flex: 1, height: 60, borderRadius: 20, backgroundColor: t.s2, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontFamily: F.b, fontSize: 16 }}>{tr('Poate')}</T>
            </Press>
            <Press onPress={() => vote('yes')} disabled={!card || pick >= total} style={{ flex: 1, height: 60, borderRadius: 20, backgroundColor: '#FFD43B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="check" color="#0E1440" /><T style={{ fontFamily: F.b, fontSize: 16, color: '#0E1440' }}>{tr('Da!')}</T>
            </Press>
          </View>
        }>
          {bubble}
          <H1 style={{ fontSize: 26, lineHeight: 28 }}>{tr('Ai merge aici?')}</H1>
          <Muted style={{ marginTop: 4, marginBottom: 12 }}>{tr('{i} din {n} · {y} „da” până acum', { i: Math.min(pick, total - 1) + 1, n: total, y: yes })}</Muted>
          {card ? <PickCard key={card.id + pick} odd={pick % 2 === 1} bg={card.bg} fg={card.fg} dot={card.dot} icon={like[3]} tag={card.tag} title={card.name} sub={card.sub} /> : (
            <Note kind="err">{tr('Nu am găsit locuri aproape de zona aleasă. Mergi mai departe, le vezi în aplicație.')}</Note>
          )}
          {!card || pick >= total ? <View style={{ marginTop: 12 }}><Big label={tr('Mai departe')} onPress={() => go('friends')} /></View> : null}
        </StepScreen>
      </Slide>
    );
  }

  // friends
  return (
    <Slide k="friends">
      <StepScreen k={7} onBack={back} foot={<Big label={tr('Gata')} onPress={() => go('done')} />}>
        {bubble}
        <H1>{who === 'solo' ? tr('Și când vrei companie') : who === 'duo' ? tr('Cu cine ieși în doi?') : tr('Gașca ta')}</H1>
        <Lead style={{ marginTop: 6 }}>{who === 'solo'
          ? tr('Planurile ți le fac pentru o persoană: fără escape room sau biliard, care cer companie. Prietenii îi adaugi oricând din Profil → Prieteni, după @username sau cu codul tău.')
          : who === 'duo'
            ? tr('Adaugă-l din Profil → Prieteni, după @username sau cu codul tău. Îi trimiți planul și răspunde cu „Vin” sau „Nu pot”.')
            : tr('Prietenii îi adaugi după @username sau le trimiți codul tău, din Profil → Prieteni. Gășcile le faci din Planuri și votați împreună unde mergeți.')}</Lead>
      </StepScreen>
    </Slide>
  );
}

/** The "Ai merge aici?" card: colour of the kind of place, a big soft dot, the icon, name and why. */
function PickCard({ odd, bg, fg, dot, icon, tag, title, sub }: { odd: boolean; bg: string; fg: string; dot: string; icon: string; tag: string; title: string; sub: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }).start(); }, [a]);
  return (
    <Animated.View style={{
      minHeight: 320, borderRadius: 26, overflow: 'hidden', backgroundColor: bg, padding: 20, justifyContent: 'flex-end',
      shadowColor: '#0E1440', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 16 }, elevation: 10,
      opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: [odd ? '2deg' : '-2deg', '0deg'] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
    }}>
      <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 99, backgroundColor: dot, opacity: 0.55 }} />
      <View style={{ position: 'absolute', left: 24, top: 26, width: 74, height: 74, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon d={icon} size={38} color={fg} />
      </View>
      <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(14,20,64,0.55)', justifyContent: 'center' }}>
        <T style={{ fontFamily: F.b, fontSize: 12, color: '#FFFFFF' }}>{tag}</T>
      </View>
      <T style={{ marginTop: 10, fontFamily: F.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, color: fg }}>{title}</T>
      <T style={{ marginTop: 6, fontFamily: F.m, fontSize: 15, lineHeight: 21, color: fg }}>{sub}</T>
    </Animated.View>
  );
}
