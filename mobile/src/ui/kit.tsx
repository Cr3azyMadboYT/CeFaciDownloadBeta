// The design's building blocks as native pieces: text styles, the big button, chips, segments, fields, Bilu's bubble.
import { forwardRef, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useRef } from 'react';
import { useModalInsets } from './insets';
import * as Haptics from 'expo-haptics';
import { Bilu, type Mood } from './Bilu';
import { Icon, type IconName } from './Icon';
import { F, useTheme } from './theme';

export const tap = () => { Haptics.selectionAsync().catch(() => {}); };

// layout keys belong on the outer Pressable, so `flex: 1` or a width works the same as on a View
const OUTER = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'left', 'right', 'top', 'bottom', 'zIndex'];

/** Pressable that shrinks a little when held, like the design's `.press:active`. */
export function Press({ style, children, onPress, disabled, haptic = true, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children?: ReactNode; haptic?: boolean }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER.includes(k) ? outer : inner)[k] = v;
  if (outer.flex !== undefined || outer.flexGrow !== undefined) {
    inner.flexGrow = 1;
    // on Android (Yoga) a `flex` child of a column whose height is not set starts from 0 and stays there — no floor at
    // its content's height like on the web: the button's own height keeps it from shrinking to nothing (it could not be
    // pressed, and Android would not see it; the bottom bar's tabs had this, 05.10)
    const floor = inner.minHeight ?? inner.height;
    if (typeof floor === 'number' && outer.minHeight === undefined) outer.minHeight = floor;
  }
  return (
    <Pressable
      {...rest}
      style={outer as ViewStyle}
      disabled={disabled}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={(e) => { if (haptic) tap(); onPress?.(e); }}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
    >
      <Animated.View style={[inner as ViewStyle, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

type TP = TextProps & { style?: StyleProp<TextStyle>; children?: ReactNode; color?: string };
export function T({ style, color, ...p }: TP) {
  const { t } = useTheme();
  // the phone's own text size may grow body text a little, never the big titles (they would push buttons off screen)
  const size = (StyleSheet.flatten(style)?.fontSize as number | undefined) ?? 15;
  return <Text maxFontSizeMultiplier={size >= 24 ? 1 : 1.15} {...p} style={[{ fontFamily: F.m, fontSize: 15, color: color ?? t.ink }, style]} />;
}
export const H1 = ({ style, ...p }: TP) => <T accessibilityRole="header" {...p} style={[{ fontFamily: F.display, fontSize: 30, lineHeight: 31, letterSpacing: -0.6 }, style]} />;
export const Lead = ({ style, ...p }: TP) => { const { t } = useTheme(); return <T {...p} style={[{ fontFamily: F.m, fontSize: 15, lineHeight: 22, color: t.ink2 }, style]} />; };
export const Lbl = ({ style, ...p }: TP) => { const { t } = useTheme(); return <T {...p} style={[{ fontFamily: F.sb, fontSize: 13, lineHeight: 16, color: t.ink2 }, style]} />; };
export const Muted = ({ style, ...p }: TP) => { const { t } = useTheme(); return <T {...p} style={[{ fontFamily: F.m, fontSize: 13, lineHeight: 18, color: t.ink2 }, style]} />; };

/** The big blue button (`.big`). */
export function Big({ label, onPress, disabled, icon, color, ink, style }: { label: string; onPress?: () => void; disabled?: boolean; icon?: ReactNode; color?: string; ink?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityLabel={label}
      style={[{ minHeight: 56, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: disabled ? t.s3 : color ?? t.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, style]}>
      {icon}
      <T style={{ flexShrink: 1, textAlign: 'center', fontFamily: F.sb, fontSize: 17, color: disabled ? t.ink2 : ink ?? '#FFFFFF' }}>{label}</T>
    </Press>
  );
}

/** A quiet text button (`.btnq`). */
export function Quiet({ label, onPress, color, underline }: { label: string; onPress?: () => void; color?: string; underline?: boolean }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontFamily: F.sb, fontSize: 15, color: color ?? t.blueInk, textDecorationLine: underline ? 'underline' : 'none' }}>{label}</T>
    </Press>
  );
}

/** Rounded pill (`.chip`); dark when on. */
export function Chip({ label, on, onPress, icon, small }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName; small?: boolean }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} accessibilityState={{ selected: !!on }}
      style={{ minHeight: small ? 34 : 42, paddingVertical: 4, paddingHorizontal: small ? 12 : 15, borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon ? <Icon name={icon} size={16} color={on ? t.bg : t.ink} /> : null}
      <T style={{ fontFamily: F.sb, fontSize: small ? 13 : 14, color: on ? (t.dark ? '#121215' : '#EEF1FB') : t.ink }}>{label}</T>
    </Press>
  );
}

/** One option of a segmented row (`.seg`); blue outline when on. */
export function Seg({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} accessibilityState={{ selected: !!on }}
      style={{ flex: 1, minHeight: 48, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.blue : t.line, backgroundColor: on ? t.blueSoft : t.s1, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontFamily: F.sb, fontSize: 14, textAlign: 'center', color: on ? t.blueInk : t.ink }}>{label}</T>
    </Press>
  );
}

/** Text field (`.field`): rounded box, blue ring while typing. */
export const Field = forwardRef<TextInput, TextInputProps & { prefix?: string; big?: boolean; focused?: boolean }>(function Field({ prefix, big, style, ...p }, ref) {
  const { t } = useTheme();
  return (
    <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.s1, borderWidth: 1.5, borderColor: p.focused ? t.blue : t.line }}>
      {prefix ? <T style={{ fontFamily: F.b, fontSize: 17, color: t.ink2 }}>{prefix}</T> : null}
      <TextInput ref={ref} placeholderTextColor={t.ink3} maxFontSizeMultiplier={1.15} {...p}
        style={[{ flex: 1, minHeight: 50, color: t.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null), fontFamily: big ? F.b : F.sb, fontSize: big ? 26 : 17, letterSpacing: big ? 8 : 0, padding: 0 }, style]} />
    </View>
  );
});

export function Note({ kind, children }: { kind: 'ok' | 'err'; children: ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: kind === 'ok' ? t.greenSoft : t.coralSoft }}>
      <T style={{ fontFamily: F.sb, fontSize: 14, lineHeight: 19, color: kind === 'ok' ? t.greenInk : t.coralInk }}>{children}</T>
    </View>
  );
}

/** Small Bilu with a speech bubble (`.say`). */
export function Say({ mood, text }: { mood: Mood; text: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
      <Bilu size={70} mood={mood} look={mood === 'up' ? 'ul' : 'c'} shadow={false} />
      <View style={{ flex: 1, marginBottom: 10, paddingVertical: 12, paddingHorizontal: 14, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 6, backgroundColor: t.s1, borderWidth: 1, borderColor: t.line }}>
        <T style={{ fontFamily: F.sb, fontSize: 15, lineHeight: 21 }}>{text}</T>
      </View>
    </View>
  );
}

export function RoundBtn({ icon, onPress, label, dark }: { icon: IconName; onPress?: () => void; label: string; dark?: boolean }) {
  const { t } = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: dark ? 'rgba(255,255,255,0.1)' : t.s1, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.14)' : t.line, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} color={dark ? '#FFFFFF' : t.ink} />
    </Press>
  );
}

/** A bottom sheet over a dimmed screen; its content scrolls when it is taller than the screen (big text). */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { t } = useTheme();
  const ins = useModalInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={{ flex: 1, backgroundColor: t.scrim }} onPress={onClose} accessibilityLabel="Închide" />
        <View style={{ maxHeight: height - ins.top - 24, backgroundColor: t.bgCont, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: Math.max(ins.bottom, 12) + 16 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Small pill label (`.tag` / `.role`). */
export function Tag({ text, bg, fg, big }: { text: string; bg: string; fg: string; big?: boolean }) {
  return (
    <View style={{ minHeight: big ? 24 : 22, paddingVertical: 2, paddingHorizontal: big ? 9 : 8, borderRadius: 999, backgroundColor: bg, justifyContent: 'center' }}>
      <T style={{ fontFamily: F.b, fontSize: big ? 12 : 11, color: fg }}>{text}</T>
    </View>
  );
}

