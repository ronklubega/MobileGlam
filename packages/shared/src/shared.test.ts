import { describe, expect, it } from "vitest";
import { commissionAmount, depositAmount, detectUgNetwork, formatUGX, normalizeUgPhone } from "./index";

describe("phone", () => {
  it("normalises common formats", () => {
    for (const v of ["0772123456", "772123456", "256772123456", "+256 772 123 456"])
      expect(normalizeUgPhone(v)).toBe("+256772123456");
  });
  it("rejects invalid numbers", () => {
    for (const v of ["", "0212345678", "+254712345678", "07721234"]) expect(normalizeUgPhone(v)).toBeNull();
  });
  it("detects networks", () => {
    expect(detectUgNetwork("+256772123456")).toBe("mtn");
    expect(detectUgNetwork("+256752123456")).toBe("airtel");
  });
});

describe("money", () => {
  it("formats UGX", () => expect(formatUGX(150000)).toContain("150,000"));
  it("computes deposit rounded up to 100", () => {
    expect(depositAmount(50_000, 20)).toBe(10_000);
    expect(depositAmount(33_333, 20)).toBe(6_700);
  });
  it("computes commission", () => expect(commissionAmount(10_000, 1500)).toBe(1_500));
});

import { computeSlots, isSlotBookable, kampalaWeekday } from "./slots";

describe("slots", () => {
  const base = {
    date: "2030-03-04",
    shifts: [{ startTime: "09:00:00", endTime: "17:00:00" }],
    durationMin: 60,
    now: new Date("2030-03-01T00:00:00Z"),
  };
  const at = (t: string) => new Date(`2030-03-04T${t}:00+03:00`);
  it("respects shift bounds and busy ranges", () => {
    const slots = computeSlots({ ...base, busy: [{ start: at("10:00"), end: at("11:00") }] }).map((d) => d.getTime());
    expect(slots).toContain(at("09:00").getTime());
    expect(slots).not.toContain(at("09:15").getTime()); // would overlap 10:00 booking
    expect(slots).not.toContain(at("10:30").getTime());
    expect(slots).toContain(at("11:00").getTime());
    expect(slots).toContain(at("16:00").getTime());
    expect(slots).not.toContain(at("16:15").getTime()); // would end after shift
  });
  it("drops slots inside the minimum lead time", () => {
    const now = new Date(at("09:10").getTime());
    const slots = computeSlots({ ...base, now, busy: [] });
    expect(slots[0]?.getTime()).toBe(at("09:45").getTime());
  });
  it("validates a requested start", () => {
    const q = { ...base, busy: [] };
    expect(isSlotBookable(q, at("12:00"))).toBe(true);
    expect(isSlotBookable(q, at("12:07"))).toBe(false);
    expect(isSlotBookable(q, at("20:00"))).toBe(false);
  });
  it("computes weekday in Kampala", () => expect(kampalaWeekday("2030-03-04")).toBe(1));
});

import { payoutSchema } from "./schemas";

describe("payout details", () => {
  it("accepts a matching MTN number", () =>
    expect(payoutSchema.safeParse({ provider: "mtn_momo", phone: "0772123456", accountName: "Kololo Hair Studio" }).success).toBe(true));
  it("rejects a number from the wrong network", () =>
    expect(payoutSchema.safeParse({ provider: "airtel_money", phone: "0772123456", accountName: "Kololo Hair Studio" }).success).toBe(false));
  it("rejects non-Ugandan numbers", () =>
    expect(payoutSchema.safeParse({ provider: "mtn_momo", phone: "+254712345678", accountName: "Name" }).success).toBe(false));
});
