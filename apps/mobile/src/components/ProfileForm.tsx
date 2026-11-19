import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { nameSchema, saveProfile, type Profile } from "@/lib/profile";
import { Avatar } from "./Avatar";
import { Button, colors, styles } from "./ui";

/** Name + photo editor, shared by first-run setup and the Account tab. */
export function ProfileForm({ profile, submitLabel, onSaved }: { profile?: Profile; submitLabel: string; onSaved?: () => void }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(null); // locally picked, not yet uploaded
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const uid = session!.user.id;
      await saveProfile(uid, profile, { fullName: name, newPhotoUri: photoUri ?? undefined });
    },
    onSuccess: async () => {
      setPhotoUri(null);
      await qc.invalidateQueries({ queryKey: ["profile"] });
      onSaved?.();
    },
    onError: (e) => setError(e instanceof Error && "issues" in e ? (e as unknown as { issues: { message: string }[] }).issues[0]?.message ?? "Invalid name" : errorMessage(e)),
  });

  const pickOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };

  async function fromLibrary() {
    const r = await ImagePicker.launchImageLibraryAsync(pickOptions);
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  }
  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera access needed", "Allow camera access in Settings to take a photo, or choose one from your library.");
    const r = await ImagePicker.launchCameraAsync(pickOptions);
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  }
  const choosePhoto = () =>
    Alert.alert("Profile photo", undefined, [
      { text: "Take photo", onPress: () => void fromCamera() },
      { text: "Choose from library", onPress: () => void fromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);

  const nameOk = nameSchema.safeParse(name).success;
  const dirty = name.trim() !== (profile?.full_name ?? "") || !!photoUri;

  return (
    <View>
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar uri={photoUri ?? profile?.avatar_url} name={name || profile?.full_name} />
        </Pressable>
        <Pressable onPress={choosePhoto} style={{ padding: 8 }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{photoUri || profile?.avatar_url ? "Change photo" : "Add photo"}</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input} value={name} onChangeText={(t) => { setName(t); setError(null); }}
        placeholder="e.g. Grace Nakato" autoComplete="name" textContentType="name" maxLength={80} autoCapitalize="words"
      />
      {profile?.phone ? <Text style={[styles.muted, { marginTop: 8 }]}>Mobile: {profile.phone} (verified)</Text> : null}
      {error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text> : null}
      <Button title={submitLabel} onPress={() => { setError(null); save.mutate(); }} loading={save.isPending} disabled={!nameOk || !dirty} style={{ marginTop: 16 }} />
    </View>
  );
}
