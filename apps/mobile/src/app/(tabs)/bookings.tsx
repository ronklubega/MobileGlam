import { formatUGX } from "@mobileglam/shared";
import { useRouter } from "expo-router";
import { FlatList, RefreshControl, Text } from "react-native";
import { Badge, Card, Empty, ErrorState, Loading, styles } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMyBookings, type MyBooking } from "@/lib/queries";

const TONE: Record<MyBooking["status"], "success" | "warn" | "danger" | "neutral"> = {
  confirmed: "success", pending_payment: "warn", completed: "neutral", cancelled: "danger", no_show: "danger", expired: "danger",
};
const LABEL: Record<MyBooking["status"], string> = {
  confirmed: "Confirmed", pending_payment: "Awaiting payment", completed: "Completed", cancelled: "Cancelled", no_show: "Missed", expired: "Expired",
};

export default function Bookings() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useMyBookings();
  if (isLoading) return <Loading />;
  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  return (
    <FlatList
      data={data}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListEmptyComponent={<Empty title="No bookings yet" hint="Find a salon on the Discover tab." />}
      renderItem={({ item }) => (
        <Card onPress={() => router.push({ pathname: "/booking/[id]", params: { id: item.id } })}>
          <Text style={styles.h2}>{item.services?.name ?? "Appointment"}</Text>
          <Text style={styles.muted}>{item.tenants?.name} · {item.staff?.display_name}</Text>
          <Text style={{ marginVertical: 6 }}>{formatDateTime(item.starts_at)}</Text>
          <Badge label={LABEL[item.status]} tone={TONE[item.status]} />
          <Text style={[styles.muted, { marginTop: 6 }]}>Deposit {formatUGX(item.deposit_ugx)}</Text>
        </Card>
      )}
    />
  );
}
