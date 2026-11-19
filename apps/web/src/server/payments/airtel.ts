import { toNationalNumber } from "@glamdesk/shared";
import { airtelEnv } from "@/lib/env";
import { ProviderError, type CollectRequest, type PaymentProvider, type StatusResult } from "./types";

const TIMEOUT_MS = 15_000;
let token: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const env = airtelEnv();
  const res = await fetch(`${env.AIRTEL_BASE_URL}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify({ client_id: env.AIRTEL_CLIENT_ID, client_secret: env.AIRTEL_CLIENT_SECRET, grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderError("airtel_money", `Airtel token request failed (${res.status})`, res.status);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

const authHeaders = async () => {
  const env = airtelEnv();
  return {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
    Accept: "*/*",
    "X-Country": env.AIRTEL_COUNTRY,
    "X-Currency": env.AIRTEL_CURRENCY,
  };
};

export const airtelProvider: PaymentProvider = {
  id: "airtel_money",

  async requestPayment(req: CollectRequest) {
    const env = airtelEnv();
    const res = await fetch(`${env.AIRTEL_BASE_URL}/merchant/v2/payments/`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        reference: req.note.slice(0, 64),
        subscriber: { country: env.AIRTEL_COUNTRY, currency: env.AIRTEL_CURRENCY, msisdn: toNationalNumber(req.payerPhone) },
        transaction: { amount: req.amountUgx, country: env.AIRTEL_COUNTRY, currency: env.AIRTEL_CURRENCY, id: req.referenceId },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401) token = undefined;
    const body = (await res.json().catch(() => null)) as { status?: { success?: boolean; message?: string } } | null;
    if (!res.ok || body?.status?.success !== true) {
      throw new ProviderError("airtel_money", `Airtel rejected the payment request: ${body?.status?.message ?? res.status}`, res.status);
    }
  },

  async getStatus(referenceId: string): Promise<StatusResult> {
    const env = airtelEnv();
    const res = await fetch(`${env.AIRTEL_BASE_URL}/standard/v1/payments/${referenceId}`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { status: "pending" };
    if (!res.ok) throw new ProviderError("airtel_money", `Airtel status check failed (${res.status})`, res.status);
    const body = (await res.json()) as { data?: { transaction?: { status?: string; message?: string; airtel_money_id?: string } } };
    const txn = body.data?.transaction;
    // TS = success, TF = failed, TE = expired; TIP (in progress) and TA (ambiguous) stay pending.
    switch (txn?.status) {
      case "TS": return { status: "successful", providerTxnId: txn.airtel_money_id };
      case "TF": return { status: "failed", reason: txn.message ?? "TF" };
      case "TE": return { status: "failed", reason: "EXPIRED" };
      default: return { status: "pending" };
    }
  },
};
