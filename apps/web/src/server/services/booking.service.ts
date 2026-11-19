import { and, eq, inArray, sql } from "drizzle-orm";
import { depositAmount, formatUGX, isSlotBookable, kampalaDateOf, kampalaInstant, type CreateBookingInput } from "@glamdesk/shared";
import { schema } from "@glamdesk/db";
import { errors } from "@/lib/http";
import { db, EXCLUSION_VIOLATION, pgCode } from "../db";
import { getProvider, ProviderError } from "../payments";
import { getBookableContext, loadBusy, loadShifts } from "./availability.service";
import { settlePayment } from "./payment.service";

const { bookings, payments, tenants } = schema;

const HOLD_MINUTES = 10;
const MAX_OPEN_HOLDS_PER_CLIENT = 3;

export async function createBooking(clientId: string, input: CreateBookingInput) {
  const { service, staff } = await getBookableContext(input.serviceId, input.staffId);
  const [tenant] = await db().select().from(tenants).where(and(eq(tenants.id, service.tenantId), eq(tenants.isActive, true)));
  if (!tenant) throw errors.notFound("Salon");

  if (input.isHomeVisit && !(service.allowsHomeVisit && tenant.offersHomeVisits)) {
    throw errors.badRequest("HOME_VISIT_UNAVAILABLE", "This service is not available as a home visit");
  }

  // Abuse guard: a client can't lock up many slots with unpaid prompts.
  const [{ open } = { open: 0 }] = await db()
    .select({ open: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.clientId, clientId), eq(bookings.status, "pending_payment")));
  if (open >= MAX_OPEN_HOLDS_PER_CLIENT) {
    throw errors.conflict("TOO_MANY_PENDING", "You have unpaid bookings awaiting approval. Complete or wait for them to expire.");
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const date = kampalaDateOf(startsAt);
  const dayStart = kampalaInstant(date, "00:00");
  const [shifts, busy] = await Promise.all([loadShifts(staff.id, date), loadBusy(staff.id, dayStart, new Date(dayStart.getTime() + 86_400_000))]);
  if (!isSlotBookable({ shifts, durationMin: service.durationMinutes, busy, now: new Date() }, startsAt)) {
    throw errors.conflict("SLOT_UNAVAILABLE", "That time is no longer available. Please pick another slot.");
  }

  const deposit = depositAmount(service.priceUgx, service.depositPercent);
  const free = deposit === 0;
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

  let bookingId: string;
  try {
    const [created] = await db()
      .insert(bookings)
      .values({
        tenantId: tenant.id,
        clientId,
        staffId: staff.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        status: free ? "confirmed" : "pending_payment",
        isHomeVisit: input.isHomeVisit,
        address: input.address ?? null,
        notes: input.notes ?? null,
        priceUgx: service.priceUgx,
        depositUgx: deposit,
        commissionBps: tenant.commissionBps,
        holdExpiresAt: free ? null : holdExpiresAt,
      })
      .returning({ id: bookings.id });
    bookingId = created!.id;
  } catch (e) {
    // The exclusion constraint is the real guard against races between concurrent clients.
    if (pgCode(e) === EXCLUSION_VIOLATION) throw errors.conflict("SLOT_TAKEN", "Someone just booked that slot. Please pick another time.");
    throw e;
  }

  if (input.latitude !== undefined && input.longitude !== undefined) {
    await db().execute(sql`update bookings set location = st_setsrid(st_makepoint(${input.longitude}, ${input.latitude}), 4326)::geography where id = ${bookingId}::uuid`);
  }

  if (free) return { bookingId, status: "confirmed" as const, depositUgx: 0, paymentId: null, holdExpiresAt: null };

  const [payment] = await db()
    .insert(payments)
    .values({ bookingId, provider: input.payment.provider, amountUgx: deposit, payerPhone: input.payment.phone })
    .returning({ id: payments.id, referenceId: payments.referenceId });

  try {
    await getProvider(input.payment.provider).requestPayment({
      referenceId: payment!.referenceId,
      amountUgx: deposit,
      payerPhone: input.payment.phone,
      note: `${tenant.name} booking deposit ${formatUGX(deposit)}`,
    });
  } catch (e) {
    // Provider never accepted the request: free the slot right away instead of waiting for the hold to lapse.
    await db().transaction(async (tx) => {
      await tx.update(payments).set({ status: "failed", failureReason: "PROVIDER_REJECTED", completedAt: new Date() }).where(eq(payments.id, payment!.id));
      await tx.update(bookings).set({ status: "expired" }).where(eq(bookings.id, bookingId));
    });
    console.error("[payments] request failed", e);
    throw e instanceof ProviderError ? errors.upstream("We couldn't reach your mobile money provider. Please try again.") : e;
  }

  return { bookingId, status: "pending_payment" as const, depositUgx: deposit, paymentId: payment!.id, holdExpiresAt: holdExpiresAt.toISOString() };
}

/** Status for the client's polling screen. Also nudges reconciliation if the callback hasn't arrived. */
export async function getBookingForClient(clientId: string, bookingId: string) {
  const load = async () => {
    const [b] = await db().select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.clientId, clientId)));
    if (!b) throw errors.notFound("Booking");
    const [p] = await db().select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(sql`${payments.createdAt} desc`).limit(1);
    return { b, p };
  };

  let { b, p } = await load();
  if (b.status === "pending_payment" && p?.status === "pending") {
    await settlePayment(p.referenceId).catch((e) => console.error("[payments] reconcile failed", e));
    ({ b, p } = await load());
  }
  return {
    id: b.id,
    status: b.status,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    priceUgx: b.priceUgx,
    depositUgx: b.depositUgx,
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    payment: p ? { provider: p.provider, status: p.status, failureReason: p.failureReason } : null,
  };
}

/** Safety net for callbacks that never arrive: settle any prompt older than 30s that is still open. */
export async function reconcileOpenPayments(limit = 50) {
  const open = await db()
    .select({ referenceId: payments.referenceId })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(and(eq(payments.status, "pending"), inArray(bookings.status, ["pending_payment"]), sql`${payments.createdAt} < now() - interval '30 seconds'`))
    .limit(limit);
  let settled = 0;
  for (const { referenceId } of open) {
    const r = await settlePayment(referenceId).catch(() => "pending");
    if (r === "confirmed" || r === "failed") settled++;
  }
  return { checked: open.length, settled };
}
