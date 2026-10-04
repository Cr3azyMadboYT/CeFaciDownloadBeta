// A bar with two dots, dragged left and right: "de la – până la" (the budget, decision Cornel, 04.10).
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { tap } from './kit';
import { useTheme } from './theme';

const THUMB = 34;

export function RangeSlider({ min, max, step, value, onChange, label }: { min: number; max: number; step: number; value: [number, number]; onChange: (v: [number, number]) => void; label: (v: number) => string }) {
  const { t } = useTheme();
  const [w, setW] = useState(0);
  const val = useRef(value); val.current = value;
  const cb = useRef(onChange); cb.current = onChange;
  const width = useRef(0); width.current = w;
  const pos = (v: number) => ((v - min) / (max - min)) * Math.max(0, w - THUMB);
  const valueAt = (x: number) => {
    const usable = Math.max(1, width.current - THUMB);
    const raw = min + (Math.min(Math.max(0, x - THUMB / 2), usable) / usable) * (max - min);
    return Math.round(raw / step) * step;
  };
  const responder = useMemo(() => {
    let which: 0 | 1 = 0;
    const move = (x: number) => {
      const [a, b] = val.current;
      const v = valueAt(x);
      const next: [number, number] = which === 0 ? [Math.min(v, b - step), b] : [a, Math.max(v, a + step)];
      if (next[0] !== a || next[1] !== b) { cb.current(next); if (next[which] % (step * 5) === 0) tap(); }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const [a, b] = val.current;
        // the dot closer to the finger moves
        const pa = ((a - min) / (max - min)) * Math.max(0, width.current - THUMB) + THUMB / 2;
        const pb = ((b - min) / (max - min)) * Math.max(0, width.current - THUMB) + THUMB / 2;
        which = Math.abs(x - pa) <= Math.abs(x - pb) && !(a === b - step && x > pb) ? 0 : 1;
        move(x);
      },
      onPanResponderMove: (e) => move(e.nativeEvent.locationX),
    });
  }, [min, max, step]); // eslint-disable-line react-hooks/exhaustive-deps
  const [a, b] = value;
  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={'Buget de la ' + label(a) + ' până la ' + label(b)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange([a, Math.min(max, Math.max(a + step, b + (e.nativeEvent.actionName === 'increment' ? step : -step)))])}
      onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 56, justifyContent: 'center' }} {...responder.panHandlers}>
      <View pointerEvents="none" style={{ position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 10, borderRadius: 99, backgroundColor: t.s3 }} />
      {w ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', left: pos(a) + THUMB / 2, width: pos(b) - pos(a), height: 10, borderRadius: 99, backgroundColor: t.blue }} />
          {[a, b].map((v, i) => (
            <View key={i} pointerEvents="none" style={{ position: 'absolute', left: pos(v), width: THUMB, height: THUMB, borderRadius: 99, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: t.blue, elevation: 4, shadowColor: '#0E1440', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }} />
          ))}
        </>
      ) : null}
    </View>
  );
}
