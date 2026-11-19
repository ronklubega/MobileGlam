import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./ui";

/** Wires React Query's online state to the OS network state and shows a banner while offline. */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      const online = s.isConnected !== false && s.isInternetReachable !== false;
      onlineManager.setOnline(online);
      setOffline(!online);
    });
  }, []);
  if (!offline) return null;
  return (
    <View style={{ backgroundColor: colors.warnSoft, padding: 8, paddingTop: insets.top + 8 }}>
      <Text style={{ color: colors.warn, textAlign: "center", fontWeight: "600" }}>You're offline. Showing saved data; booking is paused.</Text>
    </View>
  );
}
