import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { CreateBookingInput } from "@glamdesk/shared";
import type { z } from "zod";
import type { createBookingSchema } from "@glamdesk/shared";
import { api } from "./api";
import { supabase } from "./supabase";

export type CreateBookingPayload = z.input<typeof createBookingSchema>;
export type { CreateBookingInput };

export interface NearbyTenant {
  id: string; name: string; slug: string; type: "salon" | "barbershop" | "clinic";
  area: string | null; offers_home_visits: boolean; distance_km: number; cover_url: string | null;
}

export interface ServiceRow {
  id: string; name: string; description: string | null; price_ugx: number; duration_minutes: number;
  deposit_percent: number; allows_home_visit: boolean; tenant_id: string;
  staff_services: { staff: { id: string; display_name: string; title: string | null; is_active: boolean } | null }[];
}

export interface BookingStatus {
  id: string;
  status: "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  startsAt: string; endsAt: string; priceUgx: number; depositUgx: number; holdExpiresAt: string | null;
  payment: { provider: "mtn_momo" | "airtel_money"; status: "pending" | "successful" | "failed" | "timeout"; failureReason: string | null } | null;
}

export function useNearby(loc: { lat: number; lng: number }, opts: { type?: NearbyTenant["type"]; radiusKm?: number; homeVisit?: boolean } = {}) {
  const { type, radiusKm = 25, homeVisit } = opts;
  // homeVisit is only sent when true: the API coerces the string "false" to true.
  const params = new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng), radiusKm: String(radiusKm), ...(type ? { type } : {}), ...(homeVisit ? { homeVisit: "true" } : {}) });
  return useQuery({
    queryKey: ["nearby", loc.lat.toFixed(3), loc.lng.toFixed(3), type, radiusKm, !!homeVisit],
    queryFn: () => api<{ results: NearbyTenant[] }>(`/api/tenants/nearby?${params}`).then((r) => r.results),
    placeholderData: keepPreviousData,
  });
}

export function useSalon(id: string) {
  return useQuery({
    queryKey: ["salon", id],
    queryFn: async () => {
      const [tenant, services, photos] = await Promise.all([
        supabase.from("tenants").select("id,name,type,description,address,area,offers_home_visits").eq("id", id).single(),
        supabase
          .from("services")
          .select("id,name,description,price_ugx,duration_minutes,deposit_percent,allows_home_visit,tenant_id,staff_services(staff(id,display_name,title,is_active))")
          .eq("tenant_id", id)
          .eq("is_active", true)
          .order("name"),
        supabase.from("tenant_photos").select("id,url").eq("tenant_id", id).order("position").order("created_at"),
      ]);
      if (tenant.error) throw tenant.error;
      if (services.error) throw services.error;
      // Photos are decorative: if they fail to load the salon page should still work.
      return { tenant: tenant.data, services: services.data as unknown as ServiceRow[], photos: (photos.data ?? []) as { id: string; url: string }[] };
    },
  });
}

export function useService(serviceId: string) {
  return useQuery({
    queryKey: ["service", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,description,price_ugx,duration_minutes,deposit_percent,allows_home_visit,tenant_id,tenants(name,offers_home_visits),staff_services(staff(id,display_name,title,is_active))")
        .eq("id", serviceId)
        .single();
      if (error) throw error;
      return data as unknown as ServiceRow & { tenants: { name: string; offers_home_visits: boolean } };
    },
  });
}

export function useSlots(staffId: string | undefined, serviceId: string, date: string) {
  return useQuery({
    queryKey: ["slots", staffId, serviceId, date],
    enabled: !!staffId,
    staleTime: 15_000,
    queryFn: () => api<{ slots: string[] }>(`/api/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`).then((r) => r.slots),
  });
}

export function useBookingStatus(id: string) {
  return useQuery({
    queryKey: ["booking", id],
    queryFn: () => api<BookingStatus>(`/api/bookings/${id}`),
    // Poll while the mobile money prompt is outstanding.
    refetchInterval: (q) => (q.state.data?.status === "pending_payment" ? 3000 : false),
    refetchIntervalInBackground: false,
    retry: 5,
  });
}

export interface MyBooking {
  id: string; status: BookingStatus["status"]; starts_at: string; deposit_ugx: number;
  services: { name: string } | null; tenants: { name: string } | null; staff: { display_name: string } | null;
}

export function useMyBookings() {
  return useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id,status,starts_at,deposit_ugx,services(name),tenants(name),staff(display_name)")
        .neq("status", "expired")
        .order("starts_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as MyBooking[];
    },
  });
}
