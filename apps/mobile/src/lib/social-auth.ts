import * as AppleAuthentication from "expo-apple-authentication";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Closes the in-app browser popup if the app is reopened through the redirect link.
WebBrowser.maybeCompleteAuthSession();

/** Thrown when the user backs out of the Google/Apple sheet: not an error worth showing. */
export class AuthCancelled extends Error {}

/**
 * Where Supabase sends the user back after Google. Must be listed exactly under
 * Supabase -> Authentication -> URL Configuration -> Redirect URLs.
 * iOS's auth browser captures any redirect to our scheme itself, so mobileglam://auth-callback works even in
 * Expo Go and never changes. Android Expo Go can only reopen exp://<lan-ip>:8081/--/auth-callback, which
 * changes with the Mac's IP; builds on both platforms use mobileglam://auth-callback.
 */
const APP_REDIRECT = "mobileglam://auth-callback";
const inExpoGoOnAndroid = Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const googleRedirect = () => (inExpoGoOnAndroid ? Linking.createURL("auth-callback") : APP_REDIRECT);

/** Google via Supabase OAuth in the system auth browser. */
export async function signInWithGoogle() {
  const redirectTo = googleRedirect();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) throw new Error("Google sign-in isn't available right now.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new AuthCancelled();

  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  const failure = url.searchParams.get("error_description") ?? new URLSearchParams(url.hash.slice(1)).get("error_description");
  if (failure || !code) throw new Error(failure ?? "Google sign-in didn't complete. Please try again.");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error("Google sign-in didn't complete. Please try again.");
}

export const appleSignInAvailable = () =>
  Platform.OS === "ios" ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false);

/** Native Sign in with Apple, exchanged for a Supabase session with a hashed nonce. */
export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") throw new AuthCancelled();
    throw new Error("Apple sign-in isn't available right now.");
  }
  if (!credential.identityToken) throw new Error("Apple sign-in didn't complete. Please try again.");

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
  if (error || !data.user) throw new Error("Apple sign-in didn't complete. Please try again.");

  // Apple shares the name only on the very first sign-in, so save it now (skips the "complete profile" step).
  const name = credential.fullName ? AppleAuthentication.formatFullName(credential.fullName).trim() : "";
  if (name.length >= 2) {
    await supabase.from("profiles").update({ full_name: name }).eq("id", data.user.id).is("full_name", null);
  }
}
