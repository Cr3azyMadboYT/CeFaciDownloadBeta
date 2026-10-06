// CeFaci Plus: a closed gift from Bilu at first (7 free days, no card), then the trial, then "oprit".
// Paying is not live yet (it goes through Google Play); nothing is charged.
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from '../../ui/insets';
import { setBoard, useApp } from '../../lib/session';
import { Bilu } from '../../ui/Bilu';
import { Icon } from '../../ui/Icon';
import { Big, H1, Muted, T, Tag } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';
import { blurStyle, useEased } from '../../ui/Magic';
import { useTour } from '../../lib/tour';

const PERKS: [string, string, string][] = [
  ['M19 5 5 19M6.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5M17.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5', 'Reducere de 10–20% la partenerii CeFaci', 'La partenerii care o oferă, în zilele alese de ei. La Live Drops, mereu cu cel puțin 5% mai mult decât ceilalți.'],
  ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', 'Și pentru gașca ta', 'Până la 4 oameni la aceeași masă, cu codul tău.'],
  ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z', 'Live Drops cu 10 minute mai devreme', 'Prinzi reducerile fulger înaintea tuturor.'],
  ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2', 'Fără taxă de serviciu la bilete', 'Când pornesc biletele în CeFaci, plus evenimente doar pentru Plus.'],
  ['M12 2l2.9 6.9L22 9.3l-5.4 4.8L18.2 21 12 17.3 5.8 21l1.6-6.9L2 9.3l7.1-.4z', 'Bilu auriu și carnet auriu', 'Bilu se face auriu, iar carnetul din Profil primește rama aurie și insigna Plus.'],
];

export default function Plus() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const b = useApp((s) => s.board);
  const st = b.plus ?? 'locked';
  const day = b.plusDay ?? 1;
  const left = Math.max(1, 8 - day);
  const veiled = st === 'locked' || st === 'off';
  const tag: [string, string, string] = st === 'trial' ? ['Probă · ' + left + (left === 1 ? ' zi' : ' zile'), '#FFD43B', '#0E1440'] : st === 'active' ? ['Activ', t.blueSoft, t.blueInk] : st === 'off' ? ['Oprit', t.s2, t.ink2] : ['Cadou', '#FFD43B', '#0E1440'];
  const setModal = (m: string) => setBoard({ plusModal: m });
  const m = b.plusModal;
  const touring = useTour().on; // in Bilu's tour he opens the gift himself: no button to press meanwhile
  // closed gift: the page is blurred; when it opens (Bilu's "Hocus… pocus!") the blur melts away in a second and a half
  const blur = useEased(veiled ? 9 : 0, 1400);
  const fade = useEased(veiled ? 0.6 : 1, 1400);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }} style={[{ opacity: fade }, blurStyle(blur)]} scrollEnabled={!veiled} importantForAccessibility={veiled ? 'no-hide-descendants' : 'auto'}>
        <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <H1 style={{ fontSize: 28 }}>CeFaci Plus</H1>
          <Tag text={tag[0]} bg={tag[1]} fg={tag[2]} />
        </View>
        <View style={{ marginTop: 10, padding: 18, borderRadius: 22, backgroundColor: '#FFD43B' }}>
          <T style={{ fontFamily: F.b, fontSize: 13, color: '#3A4270' }}>{st === 'trial' || st === 'locked' ? 'Probă gratuită · ziua ' + (st === 'locked' ? 1 : day) + ' din 7' : st === 'active' ? 'Plus activ · 20 lei pe lună' : 'Plus e oprit'}</T>
          <T style={{ marginTop: 10, fontFamily: F.display, fontSize: 54, lineHeight: 52, letterSpacing: -1.6, color: '#0E1440' }}>0 lei</T>
          <T style={{ fontFamily: F.sb, fontSize: 14, color: '#0E1440' }}>{st === 'off' ? 'economisiți cât ai avut Plus' : 'economisiți cu Plus până acum'}</T>
          {st === 'trial' || st === 'locked' ? (
            <View style={{ marginTop: 14, flexDirection: 'row', gap: 5 }} accessibilityLabel={'Ziua ' + day + ' din 7 de probă'}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <View key={d} style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: d <= day ? '#0E1440' : 'rgba(14,20,64,0.18)' }} />)}
            </View>
          ) : null}
          <T style={{ marginTop: 12, fontFamily: F.m, fontSize: 13, lineHeight: 18, color: '#3A4270' }}>
            {st === 'off' ? 'Poți reveni oricând.' : 'Reducerile pornesc când intră primii parteneri. După probă, 20 lei pe lună; nu-ți cerem cardul și nu-ți luăm nimic automat.'}
          </T>
        </View>
        <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22 }}>Ce primești</T>
          <Tag text="cu primii parteneri" bg={t.yellowSoft} fg={t.yellowInk} />
        </View>
        <View style={{ marginTop: 10, gap: 8 }}>
          {PERKS.map(([icon, title, sub]) => (
            <View key={title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}><Icon d={icon} color="#0E1440" /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <T style={{ fontFamily: F.sb, fontSize: 15, lineHeight: 18 }}>{title}</T>
                <Muted>{sub}</Muted>
              </View>
            </View>
          ))}
        </View>
        <T accessibilityRole="header" style={{ marginTop: 22, fontFamily: F.display, fontSize: 22 }}>Reduceri Plus</T>
        <View style={{ marginTop: 10, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
          <Muted style={{ fontSize: 14, lineHeight: 20 }}>Primele localuri partenere intră curând. Reducerile lor apar aici.</Muted>
        </View>
      </ScrollView>

      {veiled && !m && !touring ? (
        <View style={{ position: 'absolute', left: 24, right: 24, top: ins.top + 120, padding: 20, paddingBottom: 22, borderRadius: 26, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line, alignItems: 'center', gap: 10, shadowColor: '#0E1440', shadowOpacity: 0.28, shadowRadius: 25, shadowOffset: { width: 0, height: 20 }, elevation: 12 }}>
          <Bilu size={st === 'off' ? 104 : 112} mood={st === 'off' ? 'hi' : 'wink'} />
          <T style={{ fontFamily: F.display, fontSize: 26, lineHeight: 27, textAlign: 'center' }}>{st === 'off' ? 'Plus s-a oprit' : 'Aici e ascuns un cadou'}</T>
          <Muted style={{ fontSize: 15, lineHeight: 21, textAlign: 'center' }}>{st === 'off' ? 'Poți reveni oricând, gratis până intră primii parteneri.' : 'Bilu îl păzește pentru tine. Apasă și vezi ce e.'}</Muted>
          <Big style={{ alignSelf: 'stretch', marginTop: 6 }} label={st === 'off' ? 'Reia Plus · 20 lei pe lună' : 'Deschide cadoul'}
            onPress={() => { if (st === 'off') { setModal('pay'); return; } setBoard({ plus: 'trial', plusDay: 1 }); setModal('gift'); }} />
          {st === 'off' ? <Muted>Poți reveni oricând, fără nicio penalizare.</Muted> : null}
        </View>
      ) : null}

      <TopShade />
    </View>
  );
}
