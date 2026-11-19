// Typed mirror of supabase/migrations. SQL migrations are the source of truth (RLS, exclusion
// constraints, PostGIS); do NOT run drizzle-kit push against production.
import { bigint, boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tenantType = pgEnum("tenant_type", ["salon", "barbershop", "clinic"]);
export const memberRole = pgEnum("member_role", ["owner", "manager", "staff"]);
export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "completed", "cancelled", "no_show", "expired"]);
export const paymentProvider = pgEnum("payment_provider", ["mtn_momo", "airtel_money"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "successful", "failed", "timeout"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const ugx = (name: string) => bigint(name, { mode: "number" });

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone").unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: tenantType("type").notNull(),
  description: text("description"),
  address: text("address"),
  area: text("area"),
  offersHomeVisits: boolean("offers_home_visits").notNull().default(false),
  commissionBps: integer("commission_bps").notNull().default(1000),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenantMembers = pgTable("tenant_members", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull(),
}, (t) => [primaryKey({ columns: [t.tenantId, t.userId] })]);

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  title: text("title"),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [index("staff_tenant_idx").on(t.tenantId)]);

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priceUgx: ugx("price_ugx").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  depositPercent: integer("deposit_percent").notNull().default(20),
  allowsHomeVisit: boolean("allows_home_visit").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [index("services_tenant_idx").on(t.tenantId)]);

export const staffServices = pgTable("staff_services", {
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })]);

export const staffShifts = pgTable("staff_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
}, (t) => [check("shift_order", sql`${t.startTime} < ${t.endTime}`)]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => profiles.id),
  staffId: uuid("staff_id").notNull(),
  serviceId: uuid("service_id").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  status: bookingStatus("status").notNull().default("pending_payment"),
  isHomeVisit: boolean("is_home_visit").notNull().default(false),
  address: text("address"),
  notes: text("notes"),
  priceUgx: ugx("price_ugx").notNull(),
  depositUgx: ugx("deposit_ugx").notNull(),
  commissionBps: integer("commission_bps").notNull(),
  holdExpiresAt: ts("hold_expires_at"),
  reminderSentAt: ts("reminder_sent_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("bookings_tenant_time_idx").on(t.tenantId, t.startsAt), index("bookings_client_idx").on(t.clientId, t.startsAt)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  provider: paymentProvider("provider").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  amountUgx: ugx("amount_ugx").notNull(),
  payerPhone: text("payer_phone").notNull(),
  referenceId: uuid("reference_id").notNull().unique().defaultRandom(),
  providerTxnId: text("provider_txn_id"),
  failureReason: text("failure_reason"),
  rawCallback: jsonb("raw_callback"),
  createdAt: ts("created_at").notNull().defaultNow(),
  completedAt: ts("completed_at"),
});

export const clientNotes = pgTable("client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => profiles.id),
  note: text("note").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
