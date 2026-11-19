import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Image, Linking, Pressable, RefreshControl, Text, View } from "react-native";
import { Badge, Card, Chip, Empty, ErrorState, Loading, colors, styles } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { PLACES, useDeviceLocation, type Coords } from "@/lib/location";
import { useNearby, type NearbyTenant } from "@/lib/queries";

const TYPES: { label: string; value?: NearbyTenant["type"] }[] = [
  { label: "All" }, { label: "Salons", value: "salon" }, { label: "Barbers", value: "barbershop" }, { label: "Hair clinics", value: "clinic" },
];
const RADII = [5, 10, 25, 50];
const TYPE_LABEL = { salon: "Salon", barbershop: "Barbershop", clinic: "Hair clinic" } as const;

const distanceLabel = (km: number) => (km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(1)} km`);

export default function Discover() {
  const router = useRouter();
  const device = useDeviceLocation();
  const [place, setPlace] = useState<{ name: string; coords: Coords } | null>(null); // manual override
  const [picking, setPicking] = useState(false);
  const [type, setType] = useState<NearbyTenant["type"] | undefined>();
  const [homeVisit, setHomeVisit] = useState(false);
  const [radius, setRadius] = useState(25);

  const coords = place?.coords ?? device.state.coords;
  const { data, isLoading, error, refetch, isRefetching } = useNearby(coords, { type, radiusKm: radius, homeVisit });

  const s = device.state;
  const where = place
    ? { text: `Showing salons near ${place.name}`, action: s.status === "device" ? { label: "Use my location", run: () => setPlace(null) } : undefined }
    : s.status === "device" ? { text: "Showing salons near you", action: undefined }
    : s.status === "loading" ? { text: "Finding your location…", action: undefined }
    : s.status === "denied" ? { text: "Location is off, showing Kampala.", action: { label: s.canAskAgain ? "Allow location" : "Open settings", run: () => (s.canAskAgain ? void device.retry() : void Linking.openSettings()) } }
    : s.status === "outside" ? { text: "You appear to be outside Uganda, showing Kampala.", action: undefined }
    : { text: "Couldn't get your location, showing Kampala.", action: { label: "Try again", run: () => void device.retry() } };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[styles.muted, { flex: 1 }]} accessibilityLiveRegion="polite">{where.text}</Text>
        {where.action ? <Pressable accessibilityRole="button" onPress={where.action.run} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: "700" }}>{where.action.label}</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => setPicking((v) => !v)} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: "700" }}>{picking ? "Done" : "Change area"}</Text></Pressable>
      </View>

      {picking ? (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 6, flexWrap: "wrap" }}>
          {PLACES.map((p) => <Chip key={p.name} label={p.name} selected={place?.name === p.name} onPress={() => { setPlace(p); setPicking(false); }} />)}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10, flexWrap: "wrap" }}>
        {TYPES.map((t) => <Chip key={t.label} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />)}
        <Chip label="Home visits" selected={homeVisit} onPress={() => setHomeVisit((v) => !v)} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" }}>
        <Text style={styles.muted}>Within</Text>
        {RADII.map((r) => <Chip key={r} label={`${r} km`} selected={radius === r} onPress={() => setRadius(r)} />)}
      </View>

      {isLoading ? <Loading /> : error && !data ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : (
        <FlatList
          data={data}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          ListEmptyComponent={
            <Empty
              title={`Nothing within ${radius} km`}
              hint={radius < 50 ? "Try a wider distance or another area." : "Try another area or category, or check back soon."}
            />
          }
          ListFooterComponent={radius < 50 && data && data.length === 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setRadius(50)} style={{ alignSelf: "center", padding: 12 }}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Search within 50 km</Text>
            </Pressable>
          ) : undefined}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: "/salon/[id]", params: { id: item.id } })}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} accessibilityLabel={`${item.name} photo`} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.border }} />
                ) : (
                  <View style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 30, fontWeight: "800", color: colors.primary }}>{item.name[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.h2} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.muted}>{[item.area, distanceLabel(item.distance_km)].filter(Boolean).join(" · ")}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <Badge label={TYPE_LABEL[item.type]} tone="neutral" />
                    {item.offers_home_visits ? <Badge label="Home visits" tone="success" /> : null}
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}
      {error && data ? <Text style={{ color: colors.warn, textAlign: "center", padding: 8 }}>Couldn't refresh. Showing saved results.</Text> : null}
    </View>
  );
}
