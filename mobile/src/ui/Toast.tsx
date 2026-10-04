import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from './insets';
import { useToast } from '../lib/toast';
import { T } from './kit';
import { F } from './theme';

/** The short message at the bottom, above the tab bar. */
export function Toast() {
  const msg = useToast();
  const ins = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: msg ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 6 }).start(); }, [msg, a]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom, 8) + 92 }}>
      <Animated.View accessibilityLiveRegion="polite" style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }], paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#0E1440' }}>
        {msg ? <T style={{ fontFamily: F.sb, fontSize: 14, lineHeight: 19, color: '#FFFFFF' }}>{msg}</T> : null}
      </Animated.View>
    </View>
  );
}
