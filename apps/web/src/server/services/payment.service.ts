import { and, eq } from "drizzle-orm";
import { formatUGX } from "@glamdesk/shared";
import { schema } from "@glamdesk/db";
import { db, EXCLUSION_VIOLATION, pgCode } from "../db";
import { getProvider } from "../payments";
import { formatKampalaTime, sendSms } from "../notifications/sms";

const { bookings, payments, profiles, services, staff, tenants } = schema;

export type SettleOutcome = "unknown" | "already_settled" | "pending" | "confirmed" | "failed" | "late_payment_slot_lost";

/**
 * Idempotent reconciliation of one payment. Called from provider callbacks, client status polling and a
 * safety-net cron. The provider API is always the source of truth: a forged callback can at worst trigger
 * a harmless status lookup.
 */
export async function settlePayment(referenceId: string, rawCallback?: unknown): Promise<SettleOutcome> {
  const [payment] = await db().select().from(payments).where(eq(payments.referenceId, referenceId));
  if (!payment) return "unknown";
  if (payment.status !== "pending") return "already_settled";

  const result = await getProvider(payment.provider).getStatus(referenceId);
  if (result.status === "pending") return "pending";

  if (result.status === "failed") {
    await db().transaction(async (tx) => {
      const upd = await tx
        .update(payments)
        .set({ status: "failed", failureReason: result.reason ?? null, completedAt: new Date(), rawCallback: rawCallback ?? null })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
        .returning({ id: payments.id });
      // Release the slot immediately so someone else can book it.
      if (upd.length) {
        await tx.update(bookings).set({ status: "expired" }).where(and(eq(bookings.id, payment.bookingId), eq(bookings.status, "pending_payment")));
      }
    });
    return "failed";
  }

  // Successful. Claim the payment first so concurrent callers can't double-process.
  const claimed = await db()
    .update(payments)
    .set({ status: "successful", providerTxnId: result.providerTxnId ?? null, completedAt: new Date(), rawCallback: rawCallback ?? null })
    .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
    .returning({ id: payments.id });
  if (!claimed.length) return "already_settled";

  try {
    const confirmed = await db()
      .update(bookings)
      .set({ status: "confirmed", holdExpiresAt: null })
      .where(and(eq(bookings.id, payment.bookingId), eq(bookings.status, "pending_payment")))
      .returning({ id: bookings.id });
    if (!confirmed.length) throw Object.assign(new Error("booking no longer pending"), { code: EXCLUSION_VIOLATION });
  } catch (e) {
    if (pgCode(e) !== EXCLUSION_VIOLATION) throw e;
    // Customer paid after the hold expired and the slot was re-booked. Money is held; ops must refund.
    await db().update(payments).set({ failureReason: "LATE_PAYMENT_SLOT_LOST_REFUND_REQUIRED" }).where(eq(payments.id, payment.id));
    console.error("[payments] late payment, refund required", { paymentId: payment.id, bookingId: payment.bookingId });
    return "late_payment_slot_lost";
  }

  await notifyConfirmed(payment.bookingId, payment.amountUgx).catch((e) => console.error("[sms] confirmation failed", e));
  return "confirmed";
}

async function notifyConfirmed(bookingId: string, paidUgx: number) {
  const [row] = await db()
    .select({ phone: profiles.phone, startsAt: bookings.startsAt, tenant: tenants.name, staff: staff.displayName, service: services.name })
    .from(bookings)
    .innerJoin(profiles, eq(profiles.id, bookings.clientId))
    .innerJoin(tenants, eq(tenants.id, bookings.tenantId))
    .innerJoin(staff, eq(staff.id, bookings.staffId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .where(eq(bookings.id, bookingId));
  if (!row?.phone) return;
  await sendSms(
    row.phone,
    `Booking confirmed: ${row.service} at ${row.tenant} with ${row.staff}, ${formatKampalaTime(row.startsAt)}. Deposit of ${formatUGX(paidUgx)} received (non-refundable).`,
  );
}
