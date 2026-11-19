import { depositAmount, detectUgNetwork, formatUGX, normalizeUgPhone } from "@mobileglam/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Button, Card, Chip, ErrorState, Loading, colors, styles } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateLabel, formatTime, upcomingDates } from "@/lib/format";
import { useService, useSlots, type CreateBookingPayload } from "@/lib/queries";

type Provider = "mtn_momo" | "airtel_money";
const PROVIDERS: { id: Provider; label: string }[] = [{ id: "mtn_momo", label: "MTN MoMo" }, { id: "airtel_money", label: "Airtel Money" }];

export default function Book() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const service = useService(serviceId);

  const dates = useMemo(() => upcomingDates(14), []);
  const [staffId, setStaffId] = useState<string>();
  const [date, setDate] = useState(dates[0]!);
  const [slot, setSlot] = useState<string>();
  const [homeVisit, setHomeVisit] = useState(false);
  const [address, setAddress] = useState("");
  const [provider, setProvider] = useState<Provider>();
  const [payPhone, setPayPhone] = useState(session?.user.phone ? `+${session.user.phone.replace(/^\+/, "")}` : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffList = (service.data?.staff_services ?? []).map((x) => x.staff).filter((s): s is NonNullable<typeof s> => !!s?.is_active);
  const activeStaffId = staffId ?? staffList[0]?.id;
  const slots = useSlots(activeStaffId, serviceId, date);

  if (service.isLoading) return <Loading />;
  if (service.error || !service.data) return <ErrorState message={errorMessage(service.error)} onRetry={() => service.refetch()} />;
  const svc = service.data;
  const canHome = svc.allows_home_visit && svc.tenants.offers_home_visits;
  const deposit = depositAmount(svc.price_ugx, svc.deposit_percent);

  const e164 = normalizeUgPhone(payPhone);
  const detected = e164 ? detectUgNetwork(e164) : null;
  const effectiveProvider: Provider | undefined = provider ?? (detected === "mtn" ? "mtn_momo" : detected === "airtel" ? "airtel_money" : undefined);
  const mismatch = !!detected && !!effectiveProvider && ((effectiveProvider === "mtn_momo") !== (detected === "mtn")) && (detected === "mtn" || detected === "airtel");
  const ready = !!slot && !!activeStaffId && !!e164 && !!effectiveProvider && !mismatch && (!homeVisit || address.trim().length > 5);

  async function submit() {
    if (!ready || !slot || !activeStaffId || !e164 || !effectiveProvider) return;
    setSubmitting(true); setError(null);
    const body: CreateBookingPayload = {
      serviceId, staffId: activeStaffId, startsAt: slot, isHomeVisit: homeVisit,
      address: homeVisit ? address.trim() : undefined,
      payment: { provider: effectiveProvider, phone: e164 },
    };
    try {
      const res = await api<{ bookingId: string }>("/api/bookings", { method: "POST", body });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      router.replace({ pathname: "/booking/[id]", params: { id: res.bookingId } });
    } catch (e) {
      if (e instanceof ApiError && (e.code === "SLOT_TAKEN" || e.code === "SLOT_UNAVAILABLE")) {
        setSlot(undefined);
        slots.refetch();
      }
      setError(
        e instanceof ApiError && e.isNetwork
          ? "We couldn't confirm whether your booking went through. Check the Bookings tab before trying again."
          : errorMessage(e),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>{svc.name}</Text>
      <Text style={styles.muted}>{svc.tenants.name} · {svc.duration_minutes} min · {formatUGX(svc.price_ugx)}</Text>

      <Text style={styles.label}>Stylist</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {staffList.map((s) => (
          <Chip key={s.id} label={s.display_name} selected={s.id === activeStaffId} onPress={() => { setStaffId(s.id); setSlot(undefined); }} />
        ))}
      </View>

      <Text style={styles.label}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {dates.map((d) => <Chip key={d} label={dateLabel(d)} selected={d === date} onPress={() => { setDate(d); setSlot(undefined); }} />)}
      </ScrollView>

      <Text style={styles.label}>Time</Text>
      {slots.isLoading ? <Loading /> : slots.error ? (
        <ErrorState message={errorMessage(slots.error)} onRetry={() => slots.refetch()} />
      ) : slots.data?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {slots.data.map((s) => <Chip key={s} label={formatTime(s)} selected={s === slot} onPress={() => setSlot(s)} />)}
        </View>
      ) : <Text style={styles.muted}>No free times on this day. Try another date or stylist.</Text>}

      {canHome ? (
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontWeight: "600" }}>Home visit</Text>
            <Switch value={homeVisit} onValueChange={setHomeVisit} trackColor={{ true: colors.primary }} />
          </View>
          {homeVisit ? <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Address / landmark (e.g. Ntinda, near Capital Shopping Centre)" value={address} onChangeText={setAddress} maxLength={300} /> : null}
        </View>
      ) : null}

      <Text style={styles.label}>Pay deposit with</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {PROVIDERS.map((p) => <Chip key={p.id} label={p.label} selected={p.id === effectiveProvider} onPress={() => setProvider(p.id)} />)}
      </View>
      <Text style={styles.label}>Mobile money number</Text>
      <TextInput style={styles.input} value={payPhone} onChangeText={setPayPhone} keyboardType="phone-pad" placeholder="0772 123 456" maxLength={18} />
      {payPhone && !e164 ? <Text style={{ color: colors.danger, marginTop: 4 }}>Enter a valid Ugandan number.</Text> : null}
      {mismatch ? <Text style={{ color: colors.danger, marginTop: 4 }}>This number looks like {detected === "mtn" ? "MTN" : "Airtel"}. Pick the matching provider.</Text> : null}

      <Card style={{ marginTop: 18, backgroundColor: colors.primarySoft }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700" }}>Deposit due now</Text>
          <Text style={{ fontWeight: "800" }}>{formatUGX(deposit)}</Text>
        </View>
        <Text style={[styles.muted, { marginTop: 4 }]}>
          {deposit > 0 ? `Non-refundable. Balance of ${formatUGX(svc.price_ugx - deposit)} is paid at the appointment.` : "No deposit needed for this service."}
        </Text>
      </Card>

      {error ? <Text style={{ color: colors.danger, marginTop: 12 }}>{error}</Text> : null}
      <Button title={deposit > 0 ? `Pay ${formatUGX(deposit)} & book` : "Confirm booking"} onPress={submit} loading={submitting} disabled={!ready} style={{ marginTop: 16, marginBottom: 32 }} />
    </ScrollView>
  );
}
