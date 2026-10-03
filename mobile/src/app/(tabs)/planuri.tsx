// Planuri: the tickets you made, soonest first, and your crews (they arrive with friends).
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP, useApp } from '../../lib/session';
import { NO_PLANS, DAYKEY, sortPlans, type Plan } from '../../lib/plans';
import { Icon } from '../../ui/Icon';
import { Big, H1, Lbl, Muted, Press, T } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';

const DAY: Record<string, string> = { now: 'azi', eve: 'azi', tom: 'mâine', we: 'sâm.' };

export default function Planuri() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const plans = sortPlans(useApp((s) => (s.board.plans as Plan[] | undefined) ?? NO_PLANS));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24 }}>
      <View style={{ height: 44, justifyContent: 'center' }}><H1>Planuri</H1></View>
      {plans.length ? (
        <View>
          <Lbl style={{ marginTop: 16, marginBottom: 10 }}>{'Urmează (' + plans.length + ')'}</Lbl>
          <View style={{ gap: 10 }}>
            {plans.map((x) => {
              const p = APP.byId(x.placeId);
              if (!p) return null;
              const bits = [p.name];
              if (p.res !== 'none') bits.push(x.res === 'noted' ? 'rezervat prin ' + (x.resVia ?? 'telefon') : 'fără rezervare încă');
              return (
                <Press key={x.pid} onPress={() => router.push({ pathname: '/bilet/[pid]', params: { pid: String(x.pid) } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, borderRadius: 20, backgroundColor: '#FFD43B' }}>
                  <View style={{ position: 'absolute', left: -9, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 99, backgroundColor: t.bg }} />
                  <View style={{ position: 'absolute', right: -9, top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 99, backgroundColor: t.bg }} />
                  <View style={{ width: 58, height: 58, borderRadius: 14, backgroundColor: '#0E1440', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <T style={{ fontFamily: F.b, fontSize: 11, color: '#FFD43B' }}>{DAY[x.when] ?? DAYKEY[x.when]}</T>
                    <T style={{ fontFamily: F.display, fontSize: 18, color: '#FFD43B' }}>{x.slot}</T>
                  </View>
                  <View style={{ alignSelf: 'stretch', borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(14,20,64,0.3)' }} />
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
          <T style={{ fontFamily: F.display, fontSize: 24, lineHeight: 25 }}>Niciun plan încă.</T>
          <Muted>Alege ceva de pe Acasă și biletul apare aici.</Muted>
          <Big style={{ marginTop: 6 }} label="Ce facem?" onPress={() => router.navigate('/acasa')} />
        </View>
      )}
      <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl>Gășcile tale</Lbl>
        <Press onPress={() => router.push('/prieteni')} style={{ height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 999, backgroundColor: t.blueSoft, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={16} color={t.blueInk} width={2.4} />
          <T style={{ fontFamily: F.sb, fontSize: 14, color: t.blueInk }}>Gașcă nouă</T>
        </Press>
      </View>
      <View style={{ marginTop: 10, padding: 14, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
        <Muted style={{ fontSize: 14, lineHeight: 20 }}>Încă n-ai nicio gașcă. Adaugă-ți prietenii, apoi faceți gașca și votați împreună unde ieșiți.</Muted>
      </View>
    </ScrollView>
  );
}
