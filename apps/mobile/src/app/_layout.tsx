import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OfflineBanner } from "@/components/OfflineBanner";
import { colors } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";

// Keep the native splash (logo on brand colour) up until we know who is signed in, then fade into the app,
// so users never see a blank screen or a flash of the wrong screen.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 350 });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      networkMode: "offlineFirst", // serve cache immediately, fetch when connectivity returns
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

function Routes() {
  const { session, loading } = useAuth();
  const profile = useProfile();
  const ready = !loading && !(session && profile.isLoading);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);
  // Safety net: never leave a user stuck on the splash if something hangs (very slow network).
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hide(), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;
  // If the profile can't be loaded (e.g. offline) don't lock the user out of the app.
  const needsProfile = !!session && !!profile.data && !profile.data.full_name;
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !needsProfile}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="salon/[id]" options={{ title: "" }} />
        <Stack.Screen name="book/[serviceId]" options={{ title: "Book appointment" }} />
        <Stack.Screen name="booking/[id]" options={{ title: "Booking", headerBackVisible: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <OfflineBanner />
          <Routes />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
