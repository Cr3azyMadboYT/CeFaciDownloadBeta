// Bilu, the yellow ticket, with the poses from the design (rest, hi, up, down, left, wink, yay, oops, magic), dressed
// for the season (decision Cornel, 06.10, src/app/season.ts): flowers in spring, sunglasses and an ice cream in summer,
// a scarf and a leaf in autumn, a knitted hat in winter and Santa's hat from 1 December to 7 January.
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
const useCalm = () => true;
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { LOOKS, lookFor, type Look, type LookInfo } from './season';
const useLook = () => lookFor('auto');


export type Mood = 'rest' | 'hi' | 'up' | 'down' | 'left' | 'wink' | 'yay' | 'oops' | 'magic';
type Gaze = 'c' | 'up' | 'down' | 'left' | 'right' | 'ul' | 'ur' | 'dl' | 'dr';

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
const LOOK: Record<Gaze, [number, number]> = { c: [0, 0], up: [0, -3.5], down: [0, 3.5], left: [-3.5, 0], right: [3.5, 0], ul: [-2.6, -2.6], ur: [2.6, -2.6], dl: [-2.6, 2.6], dr: [2.6, 2.6] };

function pose(mood: Mood, look: Gaze) {
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
const GOLD = '#F2B323'; // Bilu with Plus ("Bilu auriu", the Plus page)

type Pose = ReturnType<typeof pose>;
const VB = '0 0 120 144';

// The still parts are drawn once per mood (memo), so blinking or waving never redraws them: on Android a redraw
// of an SVG layer can flash for a frame, which made the hands blink in and out.
const Legs = memo(function Legs({ W, H }: { W: number; H: number }) {
  return (
    <Svg width={W} height={H} viewBox={VB} style={{ position: 'absolute' }}>
      <Path d="M48 110L46 127M72 110L74 127" fill="none" stroke={N} strokeWidth={6} strokeLinecap="round" />
      <Ellipse cx={44} cy={130} rx={8} ry={4.5} fill={N} />
      <Ellipse cx={76} cy={130} rx={8} ry={4.5} fill={N} />
    </Svg>
  );
});
const ArmL = memo(function ArmL({ W, H, d, x, y, hand = Y }: { W: number; H: number; d: string; x: number; y: number; hand?: string }) {
  return (
    <Svg width={W} height={H} viewBox={VB}>
      <Path d={d} fill="none" stroke={N} strokeWidth={6} strokeLinecap="round" />
      <Circle cx={x} cy={y} r={6.5} fill={hand} stroke={N} strokeWidth={3.5} />
    </Svg>
  );
});
const ArmR = memo(function ArmR({ W, H, d, x, y, wand, hand = Y, cone }: { W: number; H: number; d: string; x: number; y: number; wand: number; hand?: string; cone?: boolean }) {
  return (
    <Svg width={W} height={H} viewBox={VB}>
      {cone ? (
        // summer: an ice cream in the raised hand
        <G transform={`translate(${x - 112} ${y - 56})`}>
          <Path d="M104 46l8 22 8-22z" fill="#E9B26A" stroke={N} strokeWidth={2.5} strokeLinejoin="round" />
          <Circle cx={108} cy={42} r={6} fill="#FF9EC4" stroke={N} strokeWidth={2.5} />
          <Circle cx={116} cy={42} r={6} fill="#9FE3C6" stroke={N} strokeWidth={2.5} />
          <Circle cx={112} cy={35} r={6} fill="#FFFFFF" stroke={N} strokeWidth={2.5} />
        </G>
      ) : null}
      {wand ? (
        <G>
          <Path d="M108 49L118 36" stroke={N} strokeWidth={4.5} strokeLinecap="round" />
          <Path d="M117 22L118.8 26.6L123.8 26.9L119.9 30.1L121.2 35L117 32.2L112.8 35L114.1 30.1L110.2 26.9L115.2 26.6Z" fill="#FFFFFF" stroke={N} strokeWidth={2.2} strokeLinejoin="round" />
        </G>
      ) : null}
      <Path d={d} fill="none" stroke={N} strokeWidth={6} strokeLinecap="round" />
      <Circle cx={x} cy={y} r={6.5} fill={hand} stroke={N} strokeWidth={3.5} />
    </Svg>
  );
});
const Body = memo(function Body({ W, H, p, wear, fill = Y }: { W: number; H: number; p: Pose; wear?: LookInfo; fill?: string }) {
  return (
    <Svg width={W} height={H} viewBox={VB} style={{ position: 'absolute' }}>
      <Path d="M38 14H82A16 16 0 0 1 98 30V61A9 9 0 0 0 98 79V98A16 16 0 0 1 82 114H38A16 16 0 0 1 22 98V79A9 9 0 0 0 22 61V30A16 16 0 0 1 38 14Z" fill={fill} stroke={N} strokeWidth={4} strokeLinejoin="round" />
      {fill !== Y ? <Path d="M88 20l1.6 3.6 3.8.4-2.9 2.5.9 3.8-3.4-2-3.4 2 .9-3.8-2.9-2.5 3.8-.4z" fill="#FFFFFF" opacity={0.9} /> : null}
      <Path d="M26 26Q30 18 40 17" fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
      <Path d="M33 70H87" stroke={N} strokeWidth={3} strokeLinecap="round" strokeDasharray="4 6" opacity={0.35} />
      <Path d="M52 92l3 3 7-7" fill="none" stroke={N} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} />
      <Ellipse cx={35} cy={55} rx={5.5} ry={3.2} fill="#FF6A4D" opacity={0.55} />
      <Ellipse cx={85} cy={55} rx={5.5} ry={3.2} fill="#FF6A4D" opacity={0.55} />
      {p.brow ? <Path d="M39 25Q46 20 53 25M67 25Q74 20 81 25" fill="none" stroke={N} strokeWidth={3} strokeLinecap="round" /> : null}
      {p.arcs ? <Path d={p.arcs} fill="none" stroke={N} strokeWidth={3.5} strokeLinecap="round" /> : null}
      <Path d={p.mouth} fill={N} />
      {p.tongue ? <Path d={p.tongue} fill="#FF6A4D" /> : null}
      {wear?.shades ? (
        <G>
          <Path d="M34 32h24v9a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9zM62 32h24v9a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9z" fill={N} />
          <Path d="M58 35h4" stroke={N} strokeWidth={3} />
          <Path d="M38 36h6M66 36h6" stroke="#5C7FFF" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      ) : null}
      {wear?.scarf ? (
        <G>
          <Path d="M74 72l4 30 11-2-3-28z" fill={wear.scarf} stroke={N} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="M77 84l10-2M78 92l10-2" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.7} />
          <Path d="M76 100l2 6M81 99l2 6M86 98l2 6" stroke={N} strokeWidth={2} strokeLinecap="round" />
          <Rect x={18} y={63} width={84} height={13} rx={6.5} fill={wear.scarf} stroke={N} strokeWidth={2.5} />
          <Path d="M34 63v13M50 63v13M66 63v13M82 63v13" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.6} />
        </G>
      ) : null}
    </Svg>
  );
});
// what Bilu wears on his head reaches above the drawing: its own layer, 36 units taller at the top
const HAT_VB = '0 -36 120 180';
function petals(x: number, y: number, c: string, r: number) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    out.push(<Circle key={i} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r} r={r * 0.8} fill={c} stroke={N} strokeWidth={2} />);
  }
  return <G key={x}>{out}<Circle cx={x} cy={y} r={r * 0.6} fill="#FF9F43" stroke={N} strokeWidth={2} /></G>;
}
const Hat = memo(function Hat({ W, H, hat }: { W: number; H: number; hat: NonNullable<LookInfo['hat']> }) {
  return (
    <Svg width={W} height={H * (180 / 144)} viewBox={HAT_VB} style={{ position: 'absolute', left: 0, top: -H * (36 / 144) }}>
      {hat === 'santa' ? (
        <G>
          <Path d="M28 18Q40 -26 86 -18Q106 -13 110 6L94 18Z" fill="#E23B3B" stroke={N} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M44 2Q58 -14 82 -12" fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.35} strokeLinecap="round" />
          <Circle cx={110} cy={8} r={9} fill="#FFFFFF" stroke={N} strokeWidth={3} />
          <Rect x={18} y={8} width={84} height={15} rx={7.5} fill="#FFFFFF" stroke={N} strokeWidth={3} />
        </G>
      ) : hat === 'beanie' ? (
        <G>
          <Path d="M24 20Q24 -16 60 -16Q96 -16 96 20Z" fill="#2F7BD9" stroke={N} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M42 -10V18M60 -14V18M78 -10V18" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.35} />
          <Circle cx={60} cy={-20} r={9} fill="#FFFFFF" stroke={N} strokeWidth={3} />
          <Rect x={18} y={8} width={84} height={15} rx={7.5} fill="#1E5FB0" stroke={N} strokeWidth={3} />
          <Path d="M28 15.5h64" stroke="#FFFFFF" strokeWidth={2.5} strokeDasharray="3 5" opacity={0.6} />
        </G>
      ) : hat === 'flowers' ? (
        <G>
          <Path d="M30 15q6-10 14-6M86 15q-6-10-14-6" fill="none" stroke="#3DAA6E" strokeWidth={3} strokeLinecap="round" />
          <Path d="M50 8q-6-8 2-12q4 6-2 12z" fill="#5FD39A" stroke={N} strokeWidth={2} />
          {petals(34, 12, '#FF9EC4', 5.5)}
          {petals(60, 6, '#FFFFFF', 6.5)}
          {petals(86, 12, '#B7A3FF', 5.5)}
        </G>
      ) : (
        <G transform="rotate(-25 82 8)">
          <Path d="M82 -6c10 4 14 14 8 24c-10-2-14-12-8-24z" fill="#F28C28" stroke={N} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="M84 0l3 16" stroke={N} strokeWidth={2} />
        </G>
      )}
    </Svg>
  );
});

/** The open eyes (or, with `shut`, the eyes mid-blink). */
const Eyes = memo(function Eyes({ W, H, p, shut }: { W: number; H: number; p: Pose; shut?: boolean }) {
  const eye = (cx: number, px: number, py: number, gx: number, gy: number) => (
    <G>
      <Ellipse cx={cx} cy={40} rx={9} ry={shut ? 1.5 : 11} fill="#FFFFFF" stroke={N} strokeWidth={3} />
      {!shut ? <Circle cx={px} cy={py} r={5} fill={N} /> : null}
      {!shut ? <Circle cx={gx} cy={gy} r={1.8} fill="#FFFFFF" /> : null}
    </G>
  );
  return (
    <Svg width={W} height={H} viewBox={VB}>
      {p.eL ? eye(46, p.pLx, p.pLy, p.gLx, p.gLy) : null}
      {p.eR ? eye(74, p.pRx, p.pRy, p.gRx, p.gRy) : null}
    </Svg>
  );
});

/** Bilu at `size` px wide (the drawing is 120×144). Moves a little: bobs, blinks, waves when saying hi. `dress`: the
 *  season's clothes (the app's by default; 'none' for none). */
export function Bilu({ size = 120, mood = 'rest', look = 'c', still: stillAsked = false, shadow = true, dress }: { size?: number; mood?: Mood; look?: Gaze; still?: boolean; shadow?: boolean; dress?: Look | 'none' }) {
  const p = useMemo(() => pose(mood, look), [mood, look]);
  const season = useLook();
  const plus = false;
  const skin = plus ? GOLD : Y;
  const wear = dress === 'none' ? undefined : LOOKS[dress ?? season];
  const still = useCalm() || stillAsked;
  const bob = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) { bob.setValue(0); return; }
    const fast = mood === 'yay';
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: fast ? 310 : 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(bob, { toValue: 0, duration: fast ? 310 : 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [mood, still, bob]);

  useEffect(() => {
    if (still || !(mood === 'hi' || mood === 'yay' || mood === 'up' || mood === 'wink' || mood === 'magic')) { wave.setValue(0); return; }
    const d = mood === 'hi' ? 500 : mood === 'yay' ? 310 : mood === 'magic' ? 320 : 1200;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(wave, { toValue: 0, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [mood, still, wave]);

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(3800),
      Animated.timing(blink, { toValue: 1, duration: 60, useNativeDriver: true, isInteraction: false }),
      Animated.delay(90),
      Animated.timing(blink, { toValue: 0, duration: 60, useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [still, blink]);

  const lift = bob.interpolate({ inputRange: [0, 1], outputRange: [0, mood === 'yay' ? -10 : -4] });
  // the arms are drawn with the body (separate turning arm layers flickered on some Android phones):
  // a wave rocks the whole of Bilu a little, around his feet
  const amp = mood === 'hi' || mood === 'yay' ? 5 : mood === 'magic' ? 4 : 2;
  const rock = wave.interpolate({ inputRange: [0, 1], outputRange: ['0deg', amp + 'deg'] });
  const W = size;
  const H = size * 1.2;
  const layer = { position: 'absolute' as const, left: 0, top: 0, width: W, height: H };
  const open = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  // "oops": hands on the cheeks, in front of the body; the other poses keep the arms behind it
  const front = mood === 'oops';
  const arms = (
    <>
      <View style={layer}><ArmL W={W} H={H} d={p.armL} x={p.hLx} y={p.hLy} hand={wear?.mittens ?? skin} /></View>
      <View style={layer}><ArmR W={W} H={H} d={p.armR} x={p.hRx} y={p.hRy} wand={p.wand} hand={wear?.mittens ?? skin} cone={!!wear?.cone && !p.wand && (mood === 'hi' || mood === 'up' || mood === 'wink')} /></View>
    </>
  );

  return (
    <View style={{ width: W, height: H }}>
      {shadow && (
        <Svg width={W} height={H} viewBox={VB} style={{ position: 'absolute' }}>
          <Ellipse cx={60} cy={137} rx={28} ry={5} fill="rgba(0,0,0,0.28)" />
        </Svg>
      )}
      <Animated.View style={[layer, { transformOrigin: '50% 92%', transform: [{ translateY: lift }, { rotate: rock }] }]}>
        <Legs W={W} H={H} />
        {front ? null : arms}
        <Body W={W} H={H} p={p} wear={wear} fill={skin} />
        {wear?.shades ? null : (
          <>
            <Animated.View style={[layer, { opacity: open }]}><Eyes W={W} H={H} p={p} /></Animated.View>
            <Animated.View style={[layer, { opacity: blink }]}><Eyes W={W} H={H} p={p} shut /></Animated.View>
          </>
        )}
        {wear?.hat ? <Hat W={W} H={H} hat={wear.hat} /> : null}
        {front ? arms : null}
      </Animated.View>
    </View>
  );
}
