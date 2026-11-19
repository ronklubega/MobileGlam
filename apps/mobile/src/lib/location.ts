import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { DEFAULT_LOCATION } from "./config";

export interface Coords { lat: number; lng: number }

/** Towns clients can pick when they don't want (or can't) share their location. */
export const PLACES: { name: string; coords: Coords }[] = [
  { name: "Kampala", coords: DEFAULT_LOCATION },
  { name: "Entebbe", coords: { lat: 0.0512, lng: 32.4637 } },
  { name: "Wakiso", coords: { lat: 0.4044, lng: 32.4594 } },
  { name: "Jinja", coords: { lat: 0.4244, lng: 33.2041 } },
  { name: "Mbarara", coords: { lat: -0.6072, lng: 30.6545 } },
  { name: "Gulu", coords: { lat: 2.7746, lng: 32.299 } },
];

/** Great-circle distance in km (haversine). */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Beyond this from Kampala we are almost certainly outside our service area (or on a simulator abroad). */
const SERVICE_AREA_KM = 600;

export type LocationState =
  | { status: "loading"; coords: Coords }
  | { status: "device"; coords: Coords }          // using the phone's real position
  | { status: "denied"; coords: Coords; canAskAgain: boolean }
  | { status: "outside"; coords: Coords }         // phone is outside Uganda → fall back to Kampala
  | { status: "unavailable"; coords: Coords };    // GPS off / timed out

/** Resolves the device position once, and again when the app returns to the foreground after a denial. */
export function useDeviceLocation() {
  const [state, setState] = useState<LocationState>({ status: "loading", coords: DEFAULT_LOCATION });
  const busy = useRef(false);

  const resolve = useCallback(async (opts?: { prompt?: boolean }) => {
    if (busy.current) return;
    busy.current = true;
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted" && (opts?.prompt ?? true) && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return setState({ status: "denied", coords: DEFAULT_LOCATION, canAskAgain: perm.canAskAgain });

      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
        ]));
      if (!pos) return setState({ status: "unavailable", coords: DEFAULT_LOCATION });

      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setState(distanceKm(coords, DEFAULT_LOCATION) > SERVICE_AREA_KM ? { status: "outside", coords: DEFAULT_LOCATION } : { status: "device", coords });
    } catch {
      setState({ status: "unavailable", coords: DEFAULT_LOCATION });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => { void resolve(); }, [resolve]);

  // The user may have just enabled location in system Settings.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setState((cur) => { if (cur.status !== "device") void resolve({ prompt: false }); return cur; });
    });
    return () => sub.remove();
  }, [resolve]);

  return { state, retry: () => resolve({ prompt: true }) };
}
