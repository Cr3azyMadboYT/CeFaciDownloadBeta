// "Nivel nou": after an outing (check-in or receipt) crosses into a new level, the stamp flips in, with confetti
// and Bilu cheering. Fewer animations: it simply appears.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, View, useWindowDimensions } from 'react-native';
import { LEVELS, LEVEL_XP } from '../lib/levels';
import { useCalm } from '../lib/motion';
import { setBoard, useApp } from '../lib/session';
import { Bilu } from './Bilu';
import { Big, T } from './kit';
import { F } from './theme';

const COLORS = ['#FFD43B', '#FF6A4D', '#8C6CFF', '#5FD39A', '#8EA6FF', '#FFFFFF'];
const SAY = ['', 'Ai ieșit din casă. Așa da!', 'Prinzi gustul orașului.', 'Știi unde se întâmplă lucrurile.', 'Te iei după tine, nu după hartă.', 'Gașca se ține după tine.', 'Orașul e al tău.'];

export function LevelUp() {
  const lv = useApp((s) => (s.board.levelUp as number | undefined) ?? 0);
  const calm = useCalm();
  const { width: W, height: H } = useWindowDimensions();
  const flip = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, d: 0.6 + ((i * 13) % 40) / 100, r: (i * 47) % 360, c: COLORS[i % COLORS.length], s: 6 + (i % 3) * 3 })), []);
  useEffect(() => {
    if (!lv) return;
    flip.setValue(calm ? 1 : 0); fall.setValue(calm ? 1 : 0);
    if (calm) return;
    Animated.timing(flip, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [lv, calm, flip, fall]);
  if (!lv) return null;
  const close = () => setBoard({ levelUp: 0 });
  const next = LEVEL_XP[lv + 1];
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(4,7,24,0.82)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {!calm ? bits.map((b, i) => (
          <Animated.View key={i} pointerEvents="none" style={{
            position: 'absolute', left: (b.x / 100) * W, top: -20, width: b.s, height: b.s * 1.6, borderRadius: 2, backgroundColor: b.c,
            transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, H * b.d + 40] }) }, { rotate: b.r + 'deg' }],
            opacity: fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          }} />
        )) : null}
        <Bilu size={120} mood="yay" />
        <Animated.View style={{
          marginTop: 16, width: 230, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 22, borderWidth: 4, borderColor: '#FFD43B', alignItems: 'center', gap: 4,
          transform: [{ perspective: 800 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) }, { rotate: '-4deg' }],
        }}>
          <T style={{ fontFamily: F.b, fontSize: 13, letterSpacing: 2, color: '#FFD43B' }}>NIVEL NOU</T>
          <T style={{ fontFamily: F.display, fontSize: 40, lineHeight: 42, color: '#FFFFFF' }}>{'Nivel ' + lv}</T>
          <T style={{ fontFamily: F.display, fontSize: 24, lineHeight: 26, color: '#FFD43B', textAlign: 'center' }}>{LEVELS[lv]}</T>
        </Animated.View>
        <T style={{ marginTop: 16, fontFamily: F.sb, fontSize: 16, lineHeight: 22, color: '#FFFFFF', textAlign: 'center' }}>{SAY[lv] ?? ''}</T>
        {next ? <T style={{ marginTop: 4, fontFamily: F.m, fontSize: 14, color: '#A9B1DA', textAlign: 'center' }}>{'Următorul: ' + LEVELS[lv + 1] + ', la ' + next + ' XP.'}</T> : null}
        <Big style={{ marginTop: 20, alignSelf: 'stretch' }} label="Super!" color="#FFD43B" ink="#0E1440" onPress={close} />
      </View>
    </Modal>
  );
}
