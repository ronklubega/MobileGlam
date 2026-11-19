import { eq } from "drizzle-orm";
import { schema } from "@glamdesk/db";
import { db } from "../db";
import type { PaymentProvider, ProviderId, StatusResult } from "./types";

const APPROVE_AFTER_MS = 8_000;

/**
 * Development-only stand-in for MTN/Airtel (PAYMENTS_MODE=mock). Stateless, so it survives dev-server reloads:
 * the outcome is derived from the payment's age and the payer's number.
 *   - pending for the first 8 seconds (like waiting for the PIN prompt)
 *   - then SUCCESSFUL, unless the payer number ends in 0, which simulates a declined payment
 */
export const mockProvider = (id: ProviderId): PaymentProvider => ({
  id,
  async requestPayment() {
    /* nothing to send; the "prompt" is simulated */
  },
  async getStatus(referenceId): Promise<StatusResult> {
    const [p] = await db()
      .select({ createdAt: schema.payments.createdAt, phone: schema.payments.payerPhone })
      .from(schema.payments)
      .where(eq(schema.payments.referenceId, referenceId));
    if (!p || Date.now() - p.createdAt.getTime() < APPROVE_AFTER_MS) return { status: "pending" };
    return p.phone.endsWith("0")
      ? { status: "failed", reason: "MOCK_DECLINED" }
      : { status: "successful", providerTxnId: `mock-${referenceId.slice(0, 8)}` };
  },
});
