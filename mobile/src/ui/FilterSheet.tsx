// "Filtre": who, when, how long, how far, budget (chips or a typed range), vibe. Shows how many places match
// before applying.
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP } from '../../../src/app/bridge';
import { BUDGET, DIST, DUR, VIBES, WHEN, WHO, type Filters } from '../lib/filters';
import { Icon } from './Icon';
import { Big, H1, Lbl, Muted, Press, T, tap } from './kit';
import { F, useTheme } from './theme';

function Opt({ label, on, onPress, grow = true }: { label: string; on: boolean; onPress: () => void; grow?: boolean }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} accessibilityState={{ selected: on }}
      style={{ flexGrow: grow ? 1 : 0, flexBasis: grow ? 0 : 'auto', minHeight: 42, paddingVertical: 4, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontFamily: F.sb, fontSize: 14, color: on ? t.bg : t.ink }}>{label}</T>
    </Press>
  );
}

export function FilterSheet({ open, value, onClose, onApply }: { open: boolean; value: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const [d, setD] = useState<Filters>(value);
  useEffect(() => { if (open) setD(value); }, [open, value]);
  const set = (p: Partial<Filters>) => setD((x) => ({ ...x, ...p }));
  const count = useMemo(() => (open ? APP.matches(d).length : 0), [open, d]);
  const r = /^(\d*)-(\d*)$/.exec(d.budget);
  const [lo, hi] = r ? [r[1], r[2]] : ['', ''];
  const putRange = (a: string, b: string) => {
    a = a.replace(/\D/g, '').slice(0, 4); b = b.replace(/\D/g, '').slice(0, 4);
    set({ budget: !a && !b ? 'any' : a + '-' + b });
  };
  const rows: [string, keyof Filters, Record<string, { label: string }>, string[], boolean][] = [
    ['Cine vine?', 'who', WHO, ['1', '2', '34', '5'], true],
    ['Când?', 'when', WHEN, ['now', 'eve', 'tom', 'we'], true],
    ['Cât timp aveți?', 'dur', DUR, ['1', '23', '4'], true],
    ['Cât de departe?', 'dist', DIST, ['10', '20', '30'], true],
    ['Buget de persoană, în lei', 'budget', BUDGET, ['0', '50', '100', '200', 'any'], false],
  ];
  const field = (val: string, ph: string, label: string, onChange: (x: string) => void) => (
    <TextInput maxFontSizeMultiplier={1.15} value={val} onChangeText={onChange} placeholder={ph} accessibilityLabel={label} keyboardType="number-pad" maxLength={4} placeholderTextColor={t.ink3}
      style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 999, borderWidth: 1, borderColor: val ? t.ink : t.line, backgroundColor: val ? t.ink : t.s1, color: val ? t.bg : t.ink, textAlign: 'center', fontFamily: F.sb, fontSize: 14, padding: 0 }} />
  );
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Pressable style={{ height: ins.top + 40, backgroundColor: t.scrim }} onPress={onClose} accessibilityLabel="Închide filtrele" />
      <View style={{ flex: 1, backgroundColor: t.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: t.line }} />
        <View style={{ marginTop: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
          <H1 style={{ fontSize: 28 }}>Filtre</H1>
          <Press onPress={onClose} accessibilityLabel="Închide" style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: t.s2, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={t.ink} /></Press>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {rows.map(([label, key, list, order, grow]) => (
            <View key={key} style={{ gap: 8 }}>
              <Lbl>{label}</Lbl>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {order.map((k) => <Opt key={k} label={list[k].label} grow={grow} on={d[key] === k} onPress={() => set({ [key]: k } as Partial<Filters>)} />)}
              </View>
            </View>
          ))}
          <View style={{ gap: 8 }}>
            <Lbl>Sau scrie tu: de la – până la (lei)</Lbl>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {field(lo, 'de la', 'De la, în lei', (x) => putRange(x, hi))}
              <T style={{ color: t.ink2, fontFamily: F.b }}>–</T>
              {field(hi, 'până la', 'Până la, în lei', (x) => putRange(lo, x))}
            </View>
            <Muted>Atenție: prețurile sunt estimate, cam cât dai de persoană. Pot avea o marjă de eroare.</Muted>
          </View>
          <View style={{ gap: 8 }}>
            <Lbl>Ce vibe? <T style={{ fontFamily: F.m, fontSize: 13, color: t.ink3 }}>Oricâte</T></Lbl>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {VIBES.map((v) => { const on = d.vibes.includes(v); return <Opt key={v} label={v} grow={false} on={on} onPress={() => { tap(); set({ vibes: on ? d.vibes.filter((x) => x !== v) : d.vibes.concat([v]) }); }} />; })}
            </View>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(ins.bottom, 12) + 10 }}>
          <Big label={count ? 'Arată ' + count + (count === 1 ? ' variantă' : ' variante') : 'Nimic nu se potrivește'} onPress={() => onApply(d)} />
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
