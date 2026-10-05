// The Plus gift's effects, as in the design's Demo (decision Cornel, 05.10: "nu e nici blurul, nici animația"):
// - the Plus page and its tab are blurred while the gift is closed, and the blur melts away when it opens;
// - "Hocus… pocus!": a golden poof and 14 sparks bursting out where the gift is;
// - the gift: confetti falling over the screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';

export const CONF = ['#FFD43B', '#FF6A4D', '#2F5BFF', '#8C6CFF', '#FFFFFF', '#5FD39A'];

/** A number that moves to `target` over `ms` (eased), for styles the native driver cannot animate (a blur). */
export function useEased(target: number, ms: number): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  useEffect(() => {
    from.current = cur.current;
    if (from.current === target) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      cur.current = from.current + (target - from.current) * e;
      setV(cur.current);
      if (k >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [target, ms]);
  return v;
}

/** The blur style (Android 12+, web; elsewhere only the opacity shows the veil). */
export const blurStyle = (px: number) => (px > 0.3 ? { filter: 'blur(' + px.toFixed(1) + 'px)' } : {}) as object;

/** "Hocus… pocus!": a golden poof and sparks flying out from (x, y). */
export function Poof({ x, y }: { x: number; y: number }) {
  const poof = useRef(new Animated.Value(0)).current;
  const sparks = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const r = 90 + (i % 3) * 45;
    return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r), w: 6 + (i % 3) * 3, c: CONF[i % 5], d: 450 + (i % 4) * 60, v: new Animated.Value(0) };
  }), []);
  useEffect(() => {
    Animated.timing(poof, { toValue: 1, duration: 1100, delay: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    for (const s of sparks) Animated.timing(s.v, { toValue: 1, duration: 1200, delay: s.d, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }).start();
  }, [poof, sparks]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
      <Animated.View style={{
        position: 'absolute', left: -46, top: -46, width: 92, height: 92, borderRadius: 99, backgroundColor: 'rgba(255,212,59,0.75)',
        opacity: poof.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] }),
        transform: [{ scale: poof.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.9] }) }],
      }} />
      {sparks.map((s, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: -s.w / 2, top: -s.w / 2, width: s.w, height: s.w, borderRadius: 2, backgroundColor: s.c,
          opacity: s.v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateX: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
            { translateY: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, s.dy] }) },
            { rotate: s.v.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '225deg'] }) },
            { scale: s.v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          ],
        }} />
      ))}
    </View>
  );
}

/** Confetti falling over the whole screen, again and again, while it is shown. */
export function Confetti() {
  const { width: W, height: H } = useWindowDimensions();
  const bits = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    x: (((i * 23 + 7) % 96) + 2) / 100, w: 6 + (i % 3) * 3, h: 10 + (i % 4) * 3, bg: CONF[i % CONF.length], r: i % 3 === 0 ? 99 : 2,
    d: Math.round(((i * 0.37) % 2.6) * 1000), t: Math.round((2.6 + (i % 5) * 0.35) * 1000), v: new Animated.Value(0),
  })), []);
  useEffect(() => {
    const loops = bits.map((b) => Animated.loop(Animated.timing(b.v, { toValue: 1, duration: b.t, easing: Easing.bezier(0.3, 0.6, 0.6, 1), useNativeDriver: true })));
    const timers = bits.map((b, i) => setTimeout(() => loops[i].start(), b.d));
    return () => { timers.forEach(clearTimeout); loops.forEach((l) => l.stop()); };
  }, [bits]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {bits.map((b, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', top: -24, left: b.x * W, width: b.w, height: b.h, borderRadius: b.r, backgroundColor: b.bg,
          opacity: b.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, H + 40] }) },
            { rotate: b.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
          ],
        }} />
      ))}
    </View>
  );
}
