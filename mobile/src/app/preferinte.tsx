// Profil → Ce-ți place: the sign-up answers, changeable any time. They start the Acasă filters and the ranking.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUDGETS, DISTS, LIKES, MOODS, MOVES, WHENS, WHOS } from '../lib/answers';
import { resetFilters } from '../lib/filters';
import { savePrefs, useApp } from '../lib/session';
import { toast } from '../lib/toast';
import { Icon } from '../ui/Icon';
import { Big, Chip, H1, Lbl, Muted, Press, Seg } from '../ui/kit';
import { useTheme } from '../ui/theme';
import { TopShade } from '../ui/TopShade';

export default function Preferinte() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const p = useApp((s) => s.prefs);
  const [likes, setLikes] = useState<string[]>(p.likes ?? []);
  const [budget, setBudget] = useState(p.budget ?? '100');
  const [who, setWho] = useState(p.who ?? 'group');
  const [when, setWhen] = useState<string[]>(p.when ?? ['eve', 'we']);
  const [mood, setMood] = useState(p.mood ?? 'mix');
  const [dist, setDist] = useState(p.dist ?? '20');
  const [moves, setMoves] = useState<string[]>(p.moves ?? ['walk', 'car']);
  const toggle = (list: string[], set: (x: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : list.concat([v]));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profil'));
  const ok = likes.length >= 1 && when.length >= 1 && moves.length >= 1;
  const save = () => {
    savePrefs({ likes, budget, who, when, mood, dist, moves });
    resetFilters();
    toast('Am salvat. Recomandările țin cont de ce ai ales.');
    back();
  };
  const row = (label: string, opts: [string, string][], on: (v: string) => boolean, pick: (v: string) => void) => (
    <View style={{ gap: 8 }}>
      <Lbl>{label}</Lbl>
      <View style={{ flexDirection: 'row', gap: 8 }}>{opts.map(([v, l]) => <Seg key={v} label={l} on={on(v)} onPress={() => pick(v)} />)}</View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        <H1 style={{ fontSize: 34, lineHeight: 35 }}>Ce-ți place</H1>
        <Muted style={{ marginTop: -8 }}>De aici pornesc filtrele de pe Acasă și ordinea recomandărilor.</Muted>
        <View style={{ gap: 8 }}>
          <Lbl>Ce-ți place</Lbl>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LIKES.map(([k, l]) => <Chip key={k} label={l} on={likes.includes(k)} onPress={() => toggle(likes, setLikes, k)} />)}
          </View>
        </View>
        {row('Cât cheltui de obicei, de persoană', BUDGETS, (v) => budget === v, setBudget)}
        {row('Cu cine ieși cel mai des', WHOS, (v) => who === v, setWho)}
        {row('Când ieși', WHENS, (v) => when.includes(v), (v) => toggle(when, setWhen, v))}
        {row('Mai degrabă', MOODS, (v) => mood === v, setMood)}
        {row('Cât de departe mergi', DISTS, (v) => dist === v, setDist)}
        <View style={{ gap: 8 }}>
          <Lbl>Cum ajungi</Lbl>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOVES.map(([k, l]) => <Chip key={k} label={l} on={moves.includes(k)} onPress={() => toggle(moves, setMoves, k)} />)}
          </View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(ins.bottom, 12) + 14, borderTopWidth: 1, borderTopColor: t.line }}>
        <Big label={ok ? 'Salvează' : 'Alege măcar câte unul'} disabled={!ok} onPress={save} />
      </View>
      <TopShade />
    </View>
  );
}
