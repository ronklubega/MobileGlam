import { formatUGX } from "@mobileglam/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { ActivityIndicator } from "react-native";
import { Button, Card, ErrorState, Loading, colors, styles } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useBookingStatus } from "@/lib/queries";

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, refetch, isFetching } = useBookingStatus(id);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data && !error) return <Loading />;
  if (!data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const provider = data.payment?.provider === "airtel_money" ? "Airtel Money" : "MTN MoMo";
  const ussd = data.payment?.provider === "airtel_money" ? "*185#" : "*165#";
  const remaining = data.holdExpiresAt ? Math.max(0, Math.floor((new Date(data.holdExpiresAt).getTime() - now) / 1000)) : 0;
  const mm = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  const goHome = () => router.replace("/(tabs)/bookings");

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 14 }}>
      {data.status === "pending_payment" && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.h1, { textAlign: "center" }]}>Approve on your phone</Text>
          <Text style={{ textAlign: "center", color: colors.muted }}>
            We sent a {provider} prompt for {formatUGX(data.depositUgx)}. Enter your PIN to confirm. No prompt? Dial {ussd} and check pending approvals.
          </Text>
          <Text style={{ textAlign: "center", fontWeight: "700" }}>Slot held for {mm}</Text>
          {error ? <Text style={{ textAlign: "center", color: colors.warn }}>Connection is slow. Still checking…</Text> : null}
          <Button title={isFetching ? "Checking…" : "I've paid — check now"} variant="ghost" onPress={() => refetch()} disabled={isFetching} />
        </>
      )}
      {data.status === "confirmed" && (
        <>
          <Text style={[styles.h1, { textAlign: "center", color: colors.success }]}>You're booked ✓</Text>
          <Card>
            <Text style={styles.h2}>{formatDateTime(data.startsAt)}</Text>
            <Text style={styles.muted}>Deposit paid: {formatUGX(data.depositUgx)}</Text>
            <Text style={styles.muted}>Balance at appointment: {formatUGX(data.priceUgx - data.depositUgx)}</Text>
          </Card>
          <Text style={{ textAlign: "center", color: colors.muted }}>We'll text you a reminder 2 hours before.</Text>
          <Button title="View my bookings" onPress={goHome} />
        </>
      )}
      {(data.status === "expired" || data.status === "cancelled") && (
        <>
          <Text style={[styles.h1, { textAlign: "center", color: colors.danger }]}>Payment not completed</Text>
          <Text style={{ textAlign: "center", color: colors.muted }}>
            {data.payment?.status === "failed" ? "The payment was declined or cancelled." : "The prompt wasn't approved in time, so the slot was released."} You were not booked.
          </Text>
          <Text style={{ textAlign: "center", color: colors.muted }}>If money left your account, it will be reversed by your provider or contact support.</Text>
          <Button title="Back to bookings" variant="ghost" onPress={goHome} />
          <Button title="Find another time" onPress={() => router.replace("/(tabs)")} />
        </>
      )}
      {(data.status === "completed" || data.status === "no_show") && <Button title="Back to bookings" onPress={goHome} />}
    </View>
  );
}
