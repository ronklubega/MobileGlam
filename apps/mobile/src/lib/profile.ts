import { useQuery } from "@tanstack/react-query";
import * as ImageManipulator from "expo-image-manipulator";
import { SaveFormat } from "expo-image-manipulator";
import { z } from "zod";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export interface Profile { id: string; full_name: string | null; phone: string | null; avatar_url: string | null }

export const nameSchema = z.string().trim().min(2, "Enter your name (at least 2 letters)").max(80, "Name is too long");

export function useProfile() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["profile", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,phone,avatar_url").eq("id", uid!).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your profile wasn't found. Sign out and sign in again.");
      return data as Profile;
    },
  });
}

const BUCKET = "avatars";
const pathFromUrl = (url: string | null) => (url ? url.split(`/${BUCKET}/`)[1]?.split("?")[0] ?? null : null);

/**
 * Shrinks the picked photo to 512px JPEG (a camera shot can be 4 MB+, painful on mobile data and over the
 * bucket's 2 MB cap) and uploads it into the user's own folder. Returns the public URL.
 */
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const rendered = await ImageManipulator.ImageManipulator.manipulate(localUri).resize({ width: 512 }).renderAsync();
  const small = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const bytes = await (await fetch(small.uri)).arrayBuffer();
  const path = `${uid}/${Date.now()}.jpg`; // unique name: no stale-cache problems when replacing
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("Couldn't upload your photo. Check your connection and try again.");
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Saves name and/or photo. The previous photo file is deleted afterwards (best effort). */
export async function saveProfile(uid: string, current: Profile | undefined, patch: { fullName?: string; newPhotoUri?: string }) {
  const update: { full_name?: string; avatar_url?: string } = {};
  if (patch.fullName !== undefined) update.full_name = nameSchema.parse(patch.fullName);
  if (patch.newPhotoUri) update.avatar_url = await uploadAvatar(uid, patch.newPhotoUri);
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("profiles").update(update).eq("id", uid);
  if (error) throw new Error("Couldn't save your profile. Please try again.");
  const old = pathFromUrl(current?.avatar_url ?? null);
  if (update.avatar_url && old) void supabase.storage.from(BUCKET).remove([old]);
}
