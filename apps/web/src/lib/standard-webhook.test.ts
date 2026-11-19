import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStandardWebhook } from "./standard-webhook";

const keyB64 = Buffer.from("super-secret-key-for-tests-12345").toString("base64");
const secret = `v1,whsec_${keyB64}`;
const body = JSON.stringify({ user: { phone: "+256772000001" }, sms: { otp: "123456" } });
const now = 1_800_000_000_000;
const ts = String(now / 1000);
const sign = (id: string, t: string, b: string) => `v1,${createHmac("sha256", Buffer.from(keyB64, "base64")).update(`${id}.${t}.${b}`).digest("base64")}`;

describe("verifyStandardWebhook", () => {
  const base = { id: "msg_1", timestamp: ts, body, secret, now };
  it("accepts a valid signature", () => expect(verifyStandardWebhook({ ...base, signature: sign("msg_1", ts, body) })).toBe(true));
  it("accepts when one of several signatures matches", () =>
    expect(verifyStandardWebhook({ ...base, signature: `v1,AAAA ${sign("msg_1", ts, body)}` })).toBe(true));
  it("rejects a tampered body", () => expect(verifyStandardWebhook({ ...base, body: body.replace("123456", "999999"), signature: sign("msg_1", ts, body) })).toBe(false));
  it("rejects a wrong secret", () => expect(verifyStandardWebhook({ ...base, secret: `v1,whsec_${Buffer.from("other").toString("base64")}`, signature: sign("msg_1", ts, body) })).toBe(false));
  it("rejects stale timestamps (replay)", () => {
    const old = String(now / 1000 - 3600);
    expect(verifyStandardWebhook({ ...base, timestamp: old, signature: sign("msg_1", old, body) })).toBe(false);
  });
  it("rejects missing headers", () => expect(verifyStandardWebhook({ ...base, signature: null })).toBe(false));
});
