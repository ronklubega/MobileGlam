import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, maskPhone, verifyOtp } from "./otp";

describe("otp", () => {
  it("generates 6-digit codes", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^[1-9]\d{5}$/);
  });
  it("verifies the right code and rejects wrong ones", () => {
    const h = hashOtp("secret", "req-1", "123456");
    expect(verifyOtp("secret", "req-1", "123456", h)).toBe(true);
    expect(verifyOtp("secret", "req-1", "123457", h)).toBe(false);
  });
  it("binds the hash to the request id and the secret", () => {
    const h = hashOtp("secret", "req-1", "123456");
    expect(verifyOtp("secret", "req-2", "123456", h)).toBe(false);
    expect(verifyOtp("other", "req-1", "123456", h)).toBe(false);
  });
  it("masks phone numbers", () => expect(maskPhone("+256772123456")).toBe("+25677••••456"));
});
