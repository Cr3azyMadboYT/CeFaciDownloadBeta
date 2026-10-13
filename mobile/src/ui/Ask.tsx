// „Sigur?” cu fața aplicației (Cornel, 13.10: dialogul gri de Android nu arăta ca CeFaci).
// ask({ title, text, ok }) → Promise<boolean>; <AskHost /> stă o dată în _layout.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { Bilu } from './Bilu';
import { Press, T } from './kit';
import { F, useTheme } from './theme';

type Req = { title: string; text?: string; ok: string; cancel?: string; danger?: boolean; done: (yes: boolean) => void };
let cur: Req | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function ask(o: { title: string; text?: string; ok: string; cancel?: string; danger?: boolean }): Promise<boolean> {
  cur?.done(false);
  return new Promise((done) => { cur = { ...o, done }; emit(); });
}
function close(yes: boolean) { const r = cur; cur = null; emit(); r?.done(yes); }

export function AskHost() {
  const r = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur);
  const { t } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (r) { a.setValue(0); Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start(); } }, [r, a]);
  return (
    <Modal visible={!!r} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(5,8,28,0.62)', justifyContent: 'center', padding: 24 }} onPress={() => close(false)} accessibilityLabel="Închide">
        {r ? (
          <Animated.View onStartShouldSetResponder={() => true} accessibilityViewIsModal
            style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }], borderRadius: 28, backgroundColor: t.s1, padding: 22, paddingTop: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bilu size={52} mood={r.danger ? 'oops' : 'hi'} shadow={false} still />
              <T accessibilityRole="header" style={{ flex: 1, fontFamily: F.display, fontSize: 22, lineHeight: 25, color: t.ink }}>{r.title}</T>
            </View>
            {r.text ? <T style={{ fontFamily: F.m, fontSize: 15, lineHeight: 21, color: t.ink2 }}>{r.text}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Press onPress={() => close(false)} accessibilityLabel={r.cancel ?? 'Rămân'}
                style={{ flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: t.s2, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontFamily: F.sb, fontSize: 16, color: t.ink }}>{r.cancel ?? 'Rămân'}</T>
              </Press>
              <Press onPress={() => close(true)} accessibilityLabel={r.ok}
                style={{ flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: r.danger ? t.coral : '#FFD43B', alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontFamily: F.sb, fontSize: 16, color: r.danger ? '#FFFFFF' : '#0E1440' }}>{r.ok}</T>
              </Press>
            </View>
          </Animated.View>
        ) : null}
      </Pressable>
    </Modal>
  );
}
