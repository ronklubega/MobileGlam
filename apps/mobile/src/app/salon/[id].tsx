import { formatUGX } from "@glamdesk/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { Badge, Button, Card, ErrorState, Loading, colors, styles } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useSalon } from "@/lib/queries";

export default function Salon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useSalon(id);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const { tenant, services, photos } = data;

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <Stack.Screen options={{ title: tenant.name }} />
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -14 }} contentInset={{ left: 14, right: 14 }}>
          {photos.map((p, i) => (
            <Image
              key={p.id} source={{ uri: p.url }} accessibilityLabel={`${tenant.name} photo ${i + 1}`} resizeMode="cover"
              style={{ width: 280, height: 190, borderRadius: 14, backgroundColor: colors.border, marginLeft: i === 0 ? 14 : 0 }}
            />
          ))}
        </ScrollView>
      ) : null}
      <Text style={styles.h1}>{tenant.name}</Text>
      <Text style={styles.muted}>{[tenant.address, tenant.area].filter(Boolean).join(", ")}</Text>
      {tenant.description ? <Text>{tenant.description}</Text> : null}
      {tenant.offers_home_visits ? <Badge label="Offers home visits" tone="success" /> : null}
      <Text style={[styles.h2, { marginTop: 12 }]}>Services</Text>
      {services.map((s) => {
        const hasStaff = s.staff_services.some((x) => x.staff?.is_active);
        return (
          <Card key={s.id}>
            <Text style={styles.h2}>{s.name}</Text>
            {s.description ? <Text style={styles.muted}>{s.description}</Text> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 8 }}>
              <Text style={{ fontWeight: "700" }}>{formatUGX(s.price_ugx)}</Text>
              <Text style={styles.muted}>{s.duration_minutes} min · {s.deposit_percent}% deposit</Text>
            </View>
            <Button
              title={hasStaff ? "Book" : "No staff available"}
              disabled={!hasStaff}
              onPress={() => router.push({ pathname: "/book/[serviceId]", params: { serviceId: s.id } })}
            />
          </Card>
        );
      })}
    </ScrollView>
  );
}
