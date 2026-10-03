// The night-sky card behind the Acasă question: stars, moon or sun, the skyline with lit windows. Colours follow
// the time of day (morning, day, dusk, night), like the design.
import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { Phase } from '../lib/filters';

const STARS: [number, number, number][] = [[345.5, 289.8, 2.1], [219.2, 257.9, 1.6], [274.2, 277.7, 1.8], [289.1, 332.7, 2.2], [71.2, 64.5, 1.7], [63.7, 165.8, 1.2], [261.5, 33.4, 1.6], [168.9, 262.3, 1], [185.4, 78.3, 2], [132.9, 271.8, 1.2], [382.1, 81.1, 1.7], [119.3, 235.3, 0.9], [163.1, 278.1, 2], [190.8, 71, 2.1], [125.5, 196.7, 1.6], [222.2, 272.1, 2.2], [245.1, 122.1, 1.7], [73.9, 182.5, 0.8], [180.2, 143.9, 1.2], [25, 124.2, 1.4], [224.5, 82.8, 0.9], [297.1, 113.4, 1.4], [180.4, 297.5, 2.1], [57.3, 117.6, 1.5], [52.9, 70.8, 0.9], [191.4, 201.9, 1.9]];
const SKYLINE = ['M-6 600V543h39V600z', 'M33 600V530l20.5 -14l20.5 14V600z', 'M76 600V556h34V600z', 'M111 600V525l19.5 -14l19.5 14V600z', 'M151 600V531h49V600z', 'M202 600V531h24V600z', 'M213.0 531v-16h2v16z', 'M226 600V550h30V600z', 'M240.0 550v-16h2v16z', 'M258 600V543h39V600z', 'M299 600V540h38V600z', 'M338 600V555h49V600z', 'M387 600V548h28V600z'];
const WIN: [number, number][] = [[7, 550], [7, 561], [15, 583], [23, 583], [46, 537], [38, 548], [38, 559], [38, 570], [46, 570], [38, 581], [46, 581], [62, 581], [81, 574], [89, 574], [97, 574], [81, 585], [89, 585], [97, 585], [116, 532], [124, 532], [140, 532], [124, 543], [116, 554], [140, 565], [124, 576], [140, 576], [156, 538], [188, 538], [180, 549], [180, 560], [188, 560], [172, 571], [188, 571], [164, 582], [180, 582], [207, 538], [215, 538], [207, 560], [215, 571], [239, 557], [247, 557], [247, 568], [271, 550], [279, 550], [271, 561], [287, 561], [263, 572], [279, 572], [263, 583], [287, 583], [312, 547], [320, 547], [312, 558], [304, 569], [312, 569], [328, 569], [304, 580], [343, 562], [367, 562], [375, 562], [359, 573], [359, 584], [392, 555], [392, 577]];

export const SKY_BG: Record<Phase, string> = { morning: '#3A64F2', day: '#2F5BFF', dusk: '#2A216B', night: '#101747', late: '#101747' };
const LINE: Record<Phase, string> = { morning: '#1E3BB8', day: '#1B2A8C', dusk: '#140F3D', night: '#070B22', late: '#070B22' };

/** Fills its parent; draws from the bottom (the skyline sits on the card's lower edge). */
export const Sky = memo(function Sky({ phase }: { phase: Phase }) {
  const tw = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(tw, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(tw, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tw]);
  const dayish = phase === 'morning' || phase === 'day';
  const stars = phase === 'night' || phase === 'late' || phase === 'dusk';
  const win = phase === 'day' ? ['#8EA6FF', 0.55] : phase === 'morning' ? ['#B7C6FF', 0.5] : ['#FFD43B', 0.9];
  const half = (odd: boolean) => (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 600" preserveAspectRatio="xMidYMax slice">
      {stars ? <G opacity={phase === 'dusk' ? 0.55 : 1}>{STARS.filter((_, i) => i % 2 === (odd ? 1 : 0)).map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" />)}</G> : null}
    </Svg>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 600" preserveAspectRatio="xMidYMax slice">
        {(phase === 'night' || phase === 'late') ? <G><Circle cx={322} cy={118} r={30} fill="#FFD43B" /><Circle cx={336} cy={106} r={27} fill={SKY_BG[phase]} /></G> : null}
        {phase === 'day' ? <G><Circle cx={318} cy={112} r={34} fill="#FFD43B" /><Circle cx={318} cy={112} r={50} fill="none" stroke="#FFD43B" strokeWidth={2} strokeDasharray="3 9" opacity={0.7} /></G> : null}
        {phase === 'morning' ? <G><Circle cx={66} cy={205} r={38} fill="#FFD43B" opacity={0.25} /><Circle cx={66} cy={205} r={24} fill="#FFD43B" /></G> : null}
        {phase === 'dusk' ? <G><Circle cx={112} cy={548} r={92} fill="#FF6A4D" opacity={0.22} /><Circle cx={112} cy={548} r={62} fill="#FF6A4D" /><Circle cx={112} cy={548} r={44} fill="#FFB199" opacity={0.6} /></G> : null}
        {dayish ? <G fill="#FFFFFF"><Path d="M40 170a18 18 0 0 1 34-6 14 14 0 0 1 22 12H40z" opacity={0.5} /><Path d="M230 220a14 14 0 0 1 27-5 11 11 0 0 1 18 10h-45z" opacity={0.35} /></G> : null}
        <G fill={LINE[phase]}>{SKYLINE.map((d) => <Path key={d} d={d} />)}</G>
        <G fill={win[0] as string} opacity={win[1] as number}>{WIN.map(([x, y]) => <Rect key={x + '-' + y} x={x} y={y} width={4} height={5} rx={0.8} />)}</G>
      </Svg>
      {stars ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: tw.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]}>{half(false)}</Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: tw.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }]}>{half(true)}</Animated.View>
        </>
      ) : null}
    </View>
  );
});
