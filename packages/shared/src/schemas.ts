import { z } from "zod";
import { detectUgNetwork, ugPhoneSchema } from "./phone";

export const tenantTypes = ["salon", "barbershop", "clinic"] as const;
export const bookingStatuses = ["pending_payment", "confirmed", "completed", "cancelled", "no_show", "expired"] as const;
export const paymentProviders = ["mtn_momo", "airtel_money"] as const;
export const paymentStatuses = ["pending", "successful", "failed", "timeout"] as const;

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);

export const createServiceSchema = z.object({
  tenantId: uuid,
  name: text(120),
  description: z.string().trim().max(1000).optional(),
  priceUgx: z.number().int().min(0).max(50_000_000),
  durationMinutes: z.number().int().min(5).max(600),
  depositPercent: z.number().int().min(0).max(100).default(20),
  allowsHomeVisit: z.boolean().default(false),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const shiftSchema = z
  .object({
    staffId: uuid,
    weekday: z.number().int().min(0).max(6), // 0 = Sunday
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((s) => s.startTime < s.endTime, { message: "Shift must end after it starts", path: ["endTime"] });

export const availabilityQuerySchema = z.object({
  staffId: uuid,
  serviceId: uuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createBookingSchema = z.object({
  serviceId: uuid,
  staffId: uuid,
  startsAt: z.string().datetime({ offset: true }),
  isHomeVisit: z.boolean().default(false),
  address: z.string().trim().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(500).optional(),
  payment: z.object({
    provider: z.enum(paymentProviders),
    phone: ugPhoneSchema,
  }),
}).refine((b) => !b.isHomeVisit || !!b.address, { message: "Address is required for home visits", path: ["address"] });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const nearbySearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(50).default(10),
  type: z.enum(tenantTypes).optional(),
  homeVisit: z.coerce.boolean().optional(),
});

export const clientNoteSchema = z.object({
  tenantId: uuid,
  clientId: uuid,
  note: text(2000),
});

/** Rough bounding box of Uganda; rejects obviously wrong coordinates from self-registration. */
export const UGANDA_BOUNDS = { minLat: -1.6, maxLat: 4.3, minLng: 29.5, maxLng: 35.1 } as const;

export const createTenantSchema = z.object({
  name: text(120).refine((v) => v.length >= 2, "Enter your business name"),
  type: z.enum(tenantTypes),
  description: z.string().trim().max(1000).optional(),
  address: text(200),
  area: text(80),
  offersHomeVisits: z.boolean().default(false),
  latitude: z.number().min(UGANDA_BOUNDS.minLat, "Location must be in Uganda").max(UGANDA_BOUNDS.maxLat, "Location must be in Uganda"),
  longitude: z.number().min(UGANDA_BOUNDS.minLng, "Location must be in Uganda").max(UGANDA_BOUNDS.maxLng, "Location must be in Uganda"),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/** Where a business receives payouts. The number must belong to the chosen network. */
export const payoutSchema = z
  .object({
    provider: z.enum(paymentProviders),
    phone: ugPhoneSchema,
    accountName: text(80).refine((v) => v.length >= 2, "Enter the registered account name"),
  })
  .superRefine((v, ctx) => {
    if (typeof v.phone !== "string") return; // phone already failed validation; don't pile a second error on it
    const network = detectUgNetwork(v.phone);
    const expected = v.provider === "mtn_momo" ? "mtn" : "airtel";
    if (network !== expected) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: `That number isn't an ${expected === "mtn" ? "MTN" : "Airtel"} number` });
    }
  });
export type PayoutInput = z.infer<typeof payoutSchema>;
