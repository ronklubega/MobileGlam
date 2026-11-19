import { Image, Text, View } from "react-native";
import { colors } from "./ui";

export function Avatar({ uri, name, size = 96 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  if (uri) {
    return <Image source={{ uri }} accessibilityLabel="Profile photo" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontSize: size * 0.38, fontWeight: "700" }}>{initials}</Text>
    </View>
  );
}
