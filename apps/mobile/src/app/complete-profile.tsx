import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileForm } from "@/components/ProfileForm";
import { Button, ErrorState, Loading, colors, styles } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

/** Shown once after first sign-in: salons need a name to know who is coming. */
export default function CompleteProfile() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  if (isLoading) return <Loading />;
  if (error || !profile) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Welcome to MobileGlam</Text>
        <Text style={[styles.muted, { marginTop: 4, marginBottom: 24 }]}>Tell salons who's booking. Your photo is optional.</Text>
        <ProfileForm profile={profile} submitLabel="Continue" />
        <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} style={{ marginTop: 24, borderWidth: 0 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
