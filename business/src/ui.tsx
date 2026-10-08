import {
  Text,
  View,
  Pressable,
  TextInput,
  Switch,
  type TextStyle,
} from "react-native";
import { useTheme, F } from "../../shared/theme";
import type { ReactNode } from "react";
export function Txt({
  children,
  big = false,
  muted = false,
  style,
}: {
  children: ReactNode;
  big?: boolean;
  muted?: boolean;
  style?: TextStyle;
}) {
  const { t } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: big ? F.display : F.r,
          fontSize: big ? 26 : 15,
          lineHeight: big ? 32 : 22,
          color: muted ? t.ink2 : t.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  title,
  tint,
}: {
  children: ReactNode;
  title?: string;
  tint?: string;
}) {
  const { t } = useTheme();
  return (
    <View
      style={{
        backgroundColor: tint ?? t.s1,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 20,
        padding: 20,
        gap: 14,
        minWidth: 0,
      }}
    >
      {title && (
        <Txt
          big
          style={{
            fontSize: 21,
            ...(tint === "#FFD43B" ? { color: "#0E1440" } : {}),
          }}
        >
          {title}
        </Txt>
      )}
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  nav = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  nav?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: nav
          ? secondary
            ? "rgba(255,255,255,0.07)"
            : "#FFD43B"
          : secondary
            ? t.s2
            : t.blue,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: nav
            ? secondary
              ? "#A9B1DA"
              : "#0E1440"
            : secondary
              ? t.ink
              : "#fff",
          fontFamily: F.sb,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  secure?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 6, flexGrow: 1 }}>
      <Txt muted style={{ fontSize: 13, fontFamily: F.sb }}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        secureTextEntry={secure}
        style={{
          backgroundColor: t.bgCont,
          color: t.ink,
          borderColor: t.line,
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          minHeight: 46,
          fontFamily: F.r,
          fontSize: 16,
        }}
      />
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row>
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
      />
    </Row>
  );
}
export function Row({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}
export function Empty({
  text = "Nimic de afișat în această perioadă.",
}: {
  text?: string;
}) {
  return <Txt muted>{text}</Txt>;
}
