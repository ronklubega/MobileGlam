export type ProviderId = "mtn_momo" | "airtel_money";
export type ProviderStatus = "pending" | "successful" | "failed";

export interface CollectRequest {
  /** Our idempotency key; the provider echoes it back and we look payments up by it. */
  referenceId: string;
  amountUgx: number;
  /** E.164, e.g. +256772123456 */
  payerPhone: string;
  note: string;
}

export interface StatusResult {
  status: ProviderStatus;
  providerTxnId?: string;
  reason?: string;
}

export interface PaymentProvider {
  id: ProviderId;
  /** Sends the USSD/push prompt to the payer's phone. Resolves once the provider has ACCEPTED the request. */
  requestPayment(req: CollectRequest): Promise<void>;
  /** Source of truth for a payment's outcome. Callbacks are never trusted on their own. */
  getStatus(referenceId: string): Promise<StatusResult>;
}

export class ProviderError extends Error {
  constructor(public provider: ProviderId, message: string, public httpStatus?: number) {
    super(message);
  }
}
