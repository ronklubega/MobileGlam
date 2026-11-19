import { toMsisdn } from "@mobileglam/shared";
import { mtnEnv, coreEnv } from "@/lib/env";
import { ProviderError, type CollectRequest, type PaymentProvider, type StatusResult } from "./types";

const TIMEOUT_MS = 15_000;
let token: { value: string; expiresAt: number } | undefined;

const isSandbox = () => mtnEnv().MTN_MOMO_TARGET_ENV === "sandbox";
/** The MTN sandbox only accepts EUR; production Uganda uses UGX. */
const currency = () => (isSandbox() ? "EUR" : "UGX");

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const env = mtnEnv();
  const basic = Buffer.from(`${env.MTN_MOMO_API_USER}:${env.MTN_MOMO_API_KEY}`).toString("base64");
  const res = await fetch(`${env.MTN_MOMO_BASE_URL}/collection/token/`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Ocp-Apim-Subscription-Key": env.MTN_MOMO_SUBSCRIPTION_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderError("mtn_momo", `MTN token request failed (${res.status})`, res.status);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

export const mtnProvider: PaymentProvider = {
  id: "mtn_momo",

  async requestPayment(req: CollectRequest) {
    const env = mtnEnv();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await accessToken()}`,
      "X-Reference-Id": req.referenceId,
      "X-Target-Environment": env.MTN_MOMO_TARGET_ENV,
      "Ocp-Apim-Subscription-Key": env.MTN_MOMO_SUBSCRIPTION_KEY,
      "Content-Type": "application/json",
    };
    // MTN ignores callbacks in sandbox; in production they only trigger a re-check (see payment.service).
    if (!isSandbox()) {
      headers["X-Callback-Url"] = `${coreEnv().APP_BASE_URL}/api/webhooks/mtn/${env.MTN_MOMO_CALLBACK_SECRET}`;
    }
    const res = await fetch(`${env.MTN_MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: String(req.amountUgx),
        currency: currency(),
        externalId: req.referenceId, // echoed in the callback so we can map it back
        payer: { partyIdType: "MSISDN", partyId: toMsisdn(req.payerPhone) },
        payerMessage: req.note.slice(0, 160),
        payeeNote: req.note.slice(0, 160),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status !== 202) {
      if (res.status === 401) token = undefined;
      throw new ProviderError("mtn_momo", `MTN rejected the payment request (${res.status})`, res.status);
    }
  },

  async getStatus(referenceId: string): Promise<StatusResult> {
    const env = mtnEnv();
    const res = await fetch(`${env.MTN_MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "X-Target-Environment": env.MTN_MOMO_TARGET_ENV,
        "Ocp-Apim-Subscription-Key": env.MTN_MOMO_SUBSCRIPTION_KEY,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { status: "pending" }; // not yet visible; retry later
    if (!res.ok) throw new ProviderError("mtn_momo", `MTN status check failed (${res.status})`, res.status);
    const body = (await res.json()) as { status: "PENDING" | "SUCCESSFUL" | "FAILED"; financialTransactionId?: string; reason?: string | { code?: string; message?: string } };
    if (body.status === "SUCCESSFUL") return { status: "successful", providerTxnId: body.financialTransactionId };
    if (body.status === "FAILED") {
      const reason = typeof body.reason === "string" ? body.reason : body.reason?.code ?? "FAILED";
      return { status: "failed", reason };
    }
    return { status: "pending" };
  },
};
