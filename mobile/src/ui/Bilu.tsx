// Bilu, the yellow ticket, with the poses from the design (rest, hi, up, down, left, wink, yay, oops, magic).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

export type Mood = 'rest' | 'hi' | 'up' | 'down' | 'left' | 'wink' | 'yay' | 'oops' | 'magic';
type Look = 'c' | 'up' | 'down' | 'left' | 'right' | 'ul' | 'ur' | 'dl' | 'dr';

const ARMS: Record<Mood, [string, number, number, string, number, number]> = {
  rest: ['M24 88Q12 94 13 106', 13, 107, 'M96 88Q108 94 107 106', 107, 107],
  hi: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q112 76 112 58', 112, 56],
  up: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q110 72 108 50', 108, 48],
  down: ['M24 88Q12 94 13 106', 13, 107, 'M96 90Q110 98 116 112', 117, 114],
  left: ['M24 86Q8 80 2 66', 1, 64, 'M96 88Q108 94 107 106', 107, 107],
  wink: ['M24 88Q12 94 13 106', 13, 107, 'M96 88Q112 84 110 68', 110, 66],
  yay: ['M24 86Q8 74 10 54', 10, 52, 'M96 86Q112 74 110 54', 110, 52],
  oops: ['M24 90Q10 76 30 60', 31, 58, 'M96 90Q110 76 90 60', 89, 58],
  magic: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q110 72 108 50', 108, 48],
};
const LOOK: Record<Look, [number, number]> = { c: [0, 0], up: [0, -3.5], down: [0, 3.5], left: [-3.5, 0], right: [3.5, 0], ul: [-2.6, -2.6], ur: [2.6, -2.6], dl: [-2.6, 2.6], dr: [2.6, 2.6] };

function pose(mood: Mood, look: Look) {
  const a = ARMS[mood] ?? ARMS.rest;
  const l = LOOK[look] ?? LOOK.c;
  const p = {
    armL: a[0], hLx: a[1], hLy: a[2], armR: a[3], hRx: a[4], hRy: a[5],
    pLx: 46 + l[0], pLy: 41 + l[1], pRx: 74 + l[0], pRy: 41 + l[1], gLx: 47.6 + l[0], gLy: 38.6 + l[1], gRx: 75.6 + l[0], gRy: 38.6 + l[1],
    eL: 1, eR: 1, arcs: '', brow: 0, wand: 0, mouth: 'M50 54Q60 64 70 54Q60 59 50 54Z', tongue: '',
  };
  if (mood === 'hi') { p.mouth = 'M48 52Q60 70 72 52Z'; p.tongue = 'M53 60Q60 67 67 60Q60 57 53 60Z'; }
  if (mood === 'wink' || mood === 'magic') { p.eL = 0; p.arcs = 'M39 42Q46 35 53 42'; p.mouth = 'M49 53Q60 67 71 53Z'; p.tongue = 'M54 60Q60 64 66 60Q60 58 54 60Z'; }
  if (mood === 'magic') p.wand = 1;
  if (mood === 'yay') { p.eL = 0; p.eR = 0; p.arcs = 'M39 43Q46 32 53 43M67 43Q74 32 81 43'; p.mouth = 'M46 50Q60 76 74 50Z'; p.tongue = 'M52 62Q60 71 68 62Q60 58 52 62Z'; }
  if (mood === 'oops') { p.brow = 1; p.mouth = 'M55 58A5 6 0 1 0 65 58A5 6 0 1 0 55 58Z'; p.tongue = ''; }
  return p;
}

const N = '#0E1440';
const Y = '#FFD43B';
const AG = Animated.createAnimatedComponent(G);

/** Bilu at `size` px wide (the drawing is 120×144). Moves a little: bobs, blinks, waves when saying hi. */
export function Bilu({ size = 120, mood = 'rest', look = 'c', still = false, shadow = true }: { size?: number; mood?: Mood; look?: Look; still?: boolean; shadow?: boolean }) {
  const p = pose(mood, look);
  const bob = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (still) return;
    const fast = mood === 'yay';
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: fast ? 310 : 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: fast ? 310 : 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [mood, still, bob]);

  useEffect(() => {
    if (still || !(mood === 'hi' || mood === 'yay' || mood === 'up' || mood === 'wink' || mood === 'magic')) { wave.setValue(0); return; }
    const d = mood === 'hi' ? 500 : mood === 'yay' ? 310 : mood === 'magic' ? 320 : 1200;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(wave, { toValue: 0, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [mood, still, wave]);

  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => { setBlink(true); t = setTimeout(() => { setBlink(false); t = setTimeout(tick, 3800 + Math.random() * 1600); }, 140); };
    t = setTimeout(tick, 2400);
    return () => clearTimeout(t);
  }, [still]);

  const lift = bob.interpolate({ inputRange: [0, 1], outputRange: [0, mood === 'yay' ? -10 : -4] });
  const amp = mood === 'hi' || mood === 'yay' ? 14 : mood === 'magic' ? 10 : 6;
  const rot = wave.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] });
  const rotL = wave.interpolate({ inputRange: [0, 1], outputRange: [0, mood === 'yay' ? amp : 0] });
  const eyeH = blink ? 1.5 : 11;

  return (
    <View style={{ width: size, height: size * 1.2 }}>
      {shadow && (
        <Svg width={size} height={size * 1.2} viewBox="0 0 120 144" style={{ position: 'absolute' }}>
          <Ellipse cx={60} cy={137} rx={28} ry={5} fill="rgba(0,0,0,0.28)" />
        </Svg>
      )}
      <Animated.View style={{ position: 'absolute', width: size, height: size * 1.2, transform: [{ translateY: lift }] }}>
        <Svg width={size} height={size * 1.2} viewBox="0 0 120 144" style={{ overflow: 'visible' }}>
          <Path d="M48 110L46 127M72 110L74 127" fill="none" stroke={N} strokeWidth={6} strokeLinecap="round" />
          <Ellipse cx={44} cy={130} rx={8} ry={4.5} fill={N} />
          <Ellipse cx={76} cy={130} rx={8} ry={4.5} fill={N} />
          <AG rotation={rotL as unknown as number} origin="24, 88">
            <Path d={p.armL} fill="none" stroke={N} strokeWidth={6} strokeLinecap="round" />
            <Circle cx={p.hLx} cy={p.hLy} r={6.5} fill={Y} stroke={N} strokeWidth={3.5} />
          </AG>
          <AG rotation={rot as unknown as number} origin="96, 88">
            {p.wand ? (
              <G>
                <Path d="M108 49L122 30" stroke={N} strokeWidth={4.5} strokeLinecap="round" />
                <Path d="M125.0 15.0L127.0 20.2L132.6 20.5L128.2 24.1L129.7 29.5L125.0 26.4L120.3 29.5L121.8 24.1L117.4 20.5L123.0 20.2Z" fill="#FFFFFF" stroke={N} strokeWidth={2.2} strokeLinejoin="round" />
              </G>
            ) : null}
            <Path d={p.armR} fill="none" stroke={N} strokeWidth={6} strokeLinecap="round" />
            <Circle cx={p.hRx} cy={p.hRy} r={6.5} fill={Y} stroke={N} strokeWidth={3.5} />
          </AG>
          <Path d="M38 14H82A16 16 0 0 1 98 30V61A9 9 0 0 0 98 79V98A16 16 0 0 1 82 114H38A16 16 0 0 1 22 98V79A9 9 0 0 0 22 61V30A16 16 0 0 1 38 14Z" fill={Y} stroke={N} strokeWidth={4} strokeLinejoin="round" />
          <Path d="M26 26Q30 18 40 17" fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
          <Path d="M33 70H87" stroke={N} strokeWidth={3} strokeLinecap="round" strokeDasharray="4 6" opacity={0.35} />
          <Path d="M52 92l3 3 7-7" fill="none" stroke={N} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} />
          <Ellipse cx={35} cy={55} rx={5.5} ry={3.2} fill="#FF6A4D" opacity={0.55} />
          <Ellipse cx={85} cy={55} rx={5.5} ry={3.2} fill="#FF6A4D" opacity={0.55} />
          {p.brow ? <Path d="M39 25Q46 20 53 25M67 25Q74 20 81 25" fill="none" stroke={N} strokeWidth={3} strokeLinecap="round" /> : null}
          {p.eL ? (
            <G>
              <Ellipse cx={46} cy={40} rx={9} ry={eyeH} fill="#FFFFFF" stroke={N} strokeWidth={3} />
              {!blink && <Circle cx={p.pLx} cy={p.pLy} r={5} fill={N} />}
              {!blink && <Circle cx={p.gLx} cy={p.gLy} r={1.8} fill="#FFFFFF" />}
            </G>
          ) : null}
          {p.eR ? (
            <G>
              <Ellipse cx={74} cy={40} rx={9} ry={eyeH} fill="#FFFFFF" stroke={N} strokeWidth={3} />
              {!blink && <Circle cx={p.pRx} cy={p.pRy} r={5} fill={N} />}
              {!blink && <Circle cx={p.gRx} cy={p.gRy} r={1.8} fill="#FFFFFF" />}
            </G>
          ) : null}
          {p.arcs ? <Path d={p.arcs} fill="none" stroke={N} strokeWidth={3.5} strokeLinecap="round" /> : null}
          <Path d={p.mouth} fill={N} />
          {p.tongue ? <Path d={p.tongue} fill="#FF6A4D" /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
}
