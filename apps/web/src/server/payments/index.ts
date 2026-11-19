import { airtelProvider } from "./airtel";
import { mockProvider } from "./mock";
import { mtnProvider } from "./mtn";
import type { PaymentProvider, ProviderId } from "./types";

const providers: Record<ProviderId, PaymentProvider> = {
  mtn_momo: mtnProvider,
  airtel_money: airtelProvider,
};

export function getProvider(id: ProviderId): PaymentProvider {
  if (process.env.PAYMENTS_MODE === "mock") {
    if (process.env.NODE_ENV === "production") throw new Error("PAYMENTS_MODE=mock is not allowed in production");
    return mockProvider(id);
  }
  return providers[id];
}
export * from "./types";
