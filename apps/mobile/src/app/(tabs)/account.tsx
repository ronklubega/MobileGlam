import { ScrollView } from "react-native";
import { ProfileForm } from "@/components/ProfileForm";
import { Button, ErrorState, Loading } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export default function Account() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  if (isLoading) return <Loading />;
  if (error || !profile) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <ProfileForm key={profile.avatar_url ?? "none"} profile={profile} submitLabel="Save changes" />
      <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} style={{ marginTop: 32 }} />
    </ScrollView>
  );
}
