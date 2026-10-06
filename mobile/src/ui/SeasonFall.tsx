// What falls over the top of Acasă in each season (decision Cornel, 06.10): petals in spring, a sun and sparkles in
// summer, leaves in autumn, snow in winter (with snow on the ground). Slow, behind the text, never on a tap; with
// "Mai puține animații" it stays still. SeasonCta: the small thing on the "Creează plan" button.
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useCalm } from '../lib/motion';
import type { LookInfo } from '../lib/season';

const N = '#0E1440';
function rnd(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

type Bit = { x: number; y: number; size: number; spin: number; dur: number; delay: number; c: string; sway: number };

const LEAF = ['#F28C28', '#D9472B', '#FFC94A', '#B5452A'];
const PETAL = ['#FFB3D1', '#FFFFFF', '#FFD1E3', '#C9F0DA'];

function Piece({ kind, b }: { kind: LookInfo['fall']; b: Bit }) {
  if (kind === 'snow') return <View style={{ width: b.size, height: b.size, borderRadius: b.size, backgroundColor: '#FFFFFF', opacity: 0.85 }} />;
  if (kind === 'petals') return <View style={{ width: b.size * 1.8, height: b.size, borderRadius: b.size, backgroundColor: b.c, opacity: 0.9 }} />;
  if (kind === 'leaves') {
    return (
      <Svg width={b.size * 2} height={b.size * 2.4} viewBox="-12 -16 24 32">
        <Path d="M0 -14c10 4 14 14 0 28c-14-14-10-24 0-28z" fill={b.c} />
        <Path d="M0 -10v22" stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />
      </Svg>
    );
  }
  return (
    <Svg width={b.size * 2} height={b.size * 2} viewBox="-10 -10 20 20">
      <Path d="M0 -9L2.6 -2.6L9 0L2.6 2.6L0 9L-2.6 2.6L-9 0L-2.6 -2.6Z" fill="#FFE58A" />
    </Svg>
  );
}

const Falling = memo(function Falling({ kind, b, h, still }: { kind: LookInfo['fall']; b: Bit; h: number; still: boolean }) {
  const t = useRef(new Animated.Value(still ? b.y / h : 0)).current;
  useEffect(() => {
    if (still) return;
    if (kind === 'sun') {
      // the sparkles only twinkle
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(b.delay),
        Animated.timing(t, { toValue: 1, duration: b.dur / 4, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
        Animated.timing(t, { toValue: 0, duration: b.dur / 4, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    // starts where it is, then falls from the top again and again
    t.setValue(b.y / h);
    const first = Animated.timing(t, { toValue: 1, duration: b.dur * (1 - b.y / h), easing: Easing.linear, useNativeDriver: true, isInteraction: false });
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: b.dur, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    first.start(({ finished }) => { if (finished) { t.setValue(0); loop.start(); } });
    return () => { first.stop(); loop.stop(); };
  }, [kind, b, h, still, t]);
  if (kind === 'sun') {
    const op = still ? 0.6 : t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });
    return <Animated.View style={{ position: 'absolute', left: b.x, top: b.y, opacity: op }}><Piece kind={kind} b={b} /></Animated.View>;
  }
  const y = t.interpolate({ inputRange: [0, 1], outputRange: [-30, h + 10] });
  const x = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, b.sway, 0, -b.sway, 0] });
  const r = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', b.spin + 'deg'] });
  return (
    <Animated.View style={{ position: 'absolute', left: b.x, top: 0, transform: [{ translateY: y }, { translateX: x }, { rotate: r }] }}>
      <Piece kind={kind} b={b} />
    </Animated.View>
  );
});

/** Behind everything in Acasă's top: `w`×`h` is its size; `night` hides the summer sun (the sky has the moon). */
export function SeasonFall({ wear, w, h, night }: { wear: LookInfo; w: number; h: number; night?: boolean }) {
  const calm = useCalm();
  const kind = wear.fall;
  const bits = useMemo<Bit[]>(() => {
    if (!w || !h) return [];
    const r = rnd(kind.length * 97 + 13);
    const n = kind === 'snow' ? 26 : kind === 'sun' ? 9 : kind === 'leaves' ? 11 : 14;
    return Array.from({ length: n }, (_, i) => ({
      x: r() * (w - 16), y: r() * h,
      size: kind === 'snow' ? 3 + r() * 4 : kind === 'sun' ? 4 + r() * 4 : kind === 'leaves' ? 7 + r() * 5 : 6 + r() * 4,
      spin: (r() < 0.5 ? -1 : 1) * (120 + r() * 300),
      dur: (kind === 'snow' ? 9000 : 12000) + r() * 7000,
      delay: r() * 3000,
      c: kind === 'leaves' ? LEAF[i % 4] : PETAL[i % 4],
      sway: 8 + r() * 18,
    }));
  }, [kind, w, h]);
  if (!w || !h) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      {kind === 'sun' && !night ? (
        <Svg width={w} height={h} style={{ position: 'absolute' }}>
          <Circle cx={w * 0.82} cy={h * 0.2} r={w * 0.2} fill="#FFD43B" opacity={0.1} />
          <Circle cx={w * 0.82} cy={h * 0.2} r={w * 0.1} fill="#FFD43B" opacity={0.22} />
        </Svg>
      ) : null}
      {bits.map((b, i) => <Falling key={kind + i} kind={kind} b={b} h={h} still={calm} />)}
      {kind === 'snow' ? (
        <Svg width={w} height={34} viewBox={`0 0 ${w} 34`} style={{ position: 'absolute', left: 0, bottom: 0 }}>
          <Path d={`M0 18Q${w * 0.25} 2 ${w * 0.5} 14T${w} 10V34H0Z`} fill="#FFFFFF" opacity={0.95} />
        </Svg>
      ) : null}
    </View>
  );
}

/** The small thing on top of "Creează plan": snow on its edge, flowers, a leaf or a sun. */
export function SeasonCta({ wear, w }: { wear: LookInfo; w: number }) {
  if (wear.cta === 'snow') {
    if (!w) return null;
    return (
      <Svg pointerEvents="none" width={w} height={22} viewBox={`0 0 ${w} 22`} style={{ position: 'absolute', left: 0, top: -9 }}>
        <Path d={`M10 17Q${w * 0.1} 3 ${w * 0.22} 9T${w * 0.45} 6T${w * 0.7} 9T${w - 10} 12Q${w - 2} 17 ${w - 12} 21H12Q2 19 10 17Z`} fill="#FFFFFF" stroke="#DCE8F7" strokeWidth={1.5} />
      </Svg>
    );
  }
  const box = { position: 'absolute' as const, right: 14, top: -16 };
  if (wear.cta === 'leaf') {
    return (
      <Svg pointerEvents="none" width={40} height={40} viewBox="-20 -20 40 40" style={box}>
        <G rotation={30}>
          <Path d="M0 -16c12 5 16 16 0 32c-16-16-12-27 0-32z" fill="#F28C28" stroke={N} strokeWidth={2} />
          <Path d="M0 -10v22" stroke={N} strokeWidth={1.6} />
        </G>
      </Svg>
    );
  }
  if (wear.cta === 'sun') {
    return (
      <Svg pointerEvents="none" width={38} height={38} viewBox="-20 -20 40 40" style={box}>
        <Circle r={9} fill="#FFD43B" stroke={N} strokeWidth={2} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <Path key={a} rotation={a} d="M0 -13V-18" stroke={N} strokeWidth={2.4} strokeLinecap="round" />)}
      </Svg>
    );
  }
  const fl: [number, number, string][] = [[14, 22, '#FF9EC4'], [34, 14, '#FFFFFF'], [44, 28, '#B7A3FF']];
  return (
    <Svg pointerEvents="none" width={54} height={40} viewBox="0 0 54 40" style={box}>
      {fl.map(([x, y, c]) => (
        <G key={x}>
          {[0, 1, 2, 3, 4].map((i) => { const a = (i * 72 * Math.PI) / 180; return <Circle key={i} cx={x + Math.cos(a) * 6} cy={y + Math.sin(a) * 6} r={5} fill={c} stroke={N} strokeWidth={1.6} />; })}
          <Circle cx={x} cy={y} r={3.6} fill="#FF9F43" stroke={N} strokeWidth={1.6} />
        </G>
      ))}
    </Svg>
  );
}
