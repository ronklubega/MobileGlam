import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

export const colors = {
  primary: "#5B2A86", primarySoft: "#F1E8F9", bg: "#FAF8FC", card: "#FFFFFF",
  text: "#1E1B24", muted: "#6B6577", border: "#E5DFEC", danger: "#B42318", dangerSoft: "#FEE4E2",
  success: "#067647", successSoft: "#DCFAE6", warn: "#B54708", warnSoft: "#FEF0C7",
};

export function Button({ title, onPress, loading, disabled, variant = "primary", style }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: "primary" | "ghost"; style?: ViewStyle;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.btn, variant === "ghost" && styles.btnGhost, off && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={variant === "ghost" ? colors.primary : "#fff"} /> : (
        <Text style={[styles.btnText, variant === "ghost" && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.chip, selected && styles.chipOn, disabled && { opacity: 0.4 }]}>
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: "success" | "warn" | "danger" | "neutral" }) {
  const map = { success: [colors.successSoft, colors.success], warn: [colors.warnSoft, colors.warn], danger: [colors.dangerSoft, colors.danger], neutral: [colors.primarySoft, colors.primary] } as const;
  return <View style={[styles.badge, { backgroundColor: map[tone][0] }]}><Text style={{ color: map[tone][1], fontSize: 12, fontWeight: "600" }}>{label}</Text></View>;
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.h2, { textAlign: "center" }]}>Something went wrong</Text>
      <Text style={{ color: colors.muted, textAlign: "center", marginVertical: 8 }}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} style={{ alignSelf: "stretch" }} /> : null}
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.h2}>{title}</Text>
      {hint ? <Text style={{ color: colors.muted, textAlign: "center", marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 48 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text },
  h2: { fontSize: 18, fontWeight: "700", color: colors.text },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: "#fff", color: colors.text },
  muted: { color: colors.muted },
});
