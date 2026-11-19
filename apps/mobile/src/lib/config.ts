import Constants from "expo-constants";

/**
 * In development the Mac running Metro also runs the backend, and Metro's address (hostUri) is always current,
 * so we reuse it instead of a hard-coded LAN IP that changes whenever the router reassigns addresses.
 * Skipped for tunnels (hostnames, not IPv4), where EXPO_PUBLIC_API_URL must be set to a public URL instead.
 */
function devApiUrl(): string | undefined {
  if (!__DEV__) return undefined;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? `http://${host}:3000` : undefined;
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` references, so each is written out.
export const API_URL = (devApiUrl() ?? required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL)).replace(/\/$/, "");
export const SUPABASE_URL = required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

/** Central Kampala; used until location permission is granted. */
export const DEFAULT_LOCATION = { lat: 0.3476, lng: 32.5825 };
