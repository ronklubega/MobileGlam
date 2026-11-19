/** All money is stored and computed as whole UGX integers (UGX has no minor unit in practice). */
/** Deterministic across runtimes (Hermes' Intl support varies by device), e.g. "UGX 150,000". */
export const formatUGX = (amount: number) => `UGX ${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

/** Deposit in UGX, rounded up to the nearest 100 so mobile money amounts stay clean. */
export function depositAmount(priceUgx: number, depositPercent: number): number {
  if (!Number.isInteger(priceUgx) || priceUgx < 0) throw new RangeError("priceUgx must be a non-negative integer");
  if (depositPercent < 0 || depositPercent > 100) throw new RangeError("depositPercent must be 0-100");
  return Math.ceil((priceUgx * depositPercent) / 100 / 100) * 100;
}

/** Platform commission using basis points (1500 = 15%), rounded down in the salon's favour. */
export function commissionAmount(amountUgx: number, commissionBps: number): number {
  return Math.floor((amountUgx * commissionBps) / 10_000);
}
