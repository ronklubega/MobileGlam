import { Tabs } from "expo-router";
import { colors } from "@/components/ui";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleStyle: { color: colors.text }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarLabel: "Discover" }} />
      <Tabs.Screen name="bookings" options={{ title: "My bookings", tabBarLabel: "Bookings" }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarLabel: "Account" }} />
    </Tabs>
  );
}
