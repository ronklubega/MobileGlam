"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { inputClass, labelClass } from "@/components/forms";
import { confirmPayoutChange, requestPayoutChange, saveFirstPayout, type PayoutResult } from "./payout-actions";

interface Payout { provider: "mtn_momo" | "airtel_money"; phone: string; account_name: string }

function Submit({ children, ghost }: { children: React.ReactNode; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${ghost ? "border border-line bg-surface text-ink" : "bg-brand text-on-brand"}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

function DetailsFields({ p }: { p?: Payout }) {
  return (
    <>
      <div>
        <label className={labelClass}>Network</label>
        <select name="provider" defaultValue={p?.provider ?? "mtn_momo"} className={inputClass}><option value="mtn_momo">MTN MoMo</option><option value="airtel_money">Airtel Money</option></select>
      </div>
      <div><label className={labelClass}>Mobile money number</label><input name="phone" required defaultValue={p?.phone ?? ""} inputMode="tel" placeholder="0772 123 456" className={inputClass} /></div>
      <div className="sm:col-span-2"><label className={labelClass}>Registered account name</label><input name="accountName" required defaultValue={p?.account_name ?? ""} maxLength={80} className={inputClass} /></div>
    </>
  );
}

/** No payout details yet: plain save. */
export function FirstPayoutForm() {
  const [res, setRes] = useState<PayoutResult | null>(null);
  return (
    <form action={async (fd) => setRes(await saveFirstPayout(fd))} className="grid gap-3 sm:grid-cols-2">
      <DetailsFields />
      <div className="sm:col-span-2"><Submit>Save payout details</Submit></div>
      {res?.error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{res.error}</p> : null}
      {res?.ok ? <p role="status" className="text-sm text-success sm:col-span-2">Saved</p> : null}
    </form>
  );
}

/** Existing payout details: password + SMS code to the new number before anything changes. */
export function ChangePayoutForm({ current }: { current: Payout }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"edit" | "code" | "done">("edit");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div>
        <p className="text-sm">{current.provider === "mtn_momo" ? "MTN MoMo" : "Airtel Money"} · <span className="font-semibold">{current.phone}</span> · {current.account_name}</p>
        <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">Change payout number</button>
      </div>
    );
  }
  if (step === "done") {
    return <p role="status" className="text-sm text-success">Payout details updated. We've also texted your previous number to let them know.</p>;
  }

  if (step === "code") {
    return (
      <form action={async (fd) => { const r = await confirmPayoutChange(fd); if (r.error) setError(r.error); else setStep("done"); }} className="space-y-3">
        <p className="text-sm">We sent a 6-digit code to <span className="font-semibold">{sentTo}</span>. Enter it to confirm.</p>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={`${inputClass} max-w-[10rem] text-center text-lg tracking-[0.4em]`} aria-label="6-digit code" />
        <div className="flex gap-2"><Submit>Confirm change</Submit><button type="button" onClick={() => { setStep("edit"); setError(null); }} className="rounded-lg border border-line px-3 py-2 text-sm">Back</button></div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    );
  }
  return (
    <form action={async (fd) => { const r = await requestPayoutChange(fd); if (r.error) setError(r.error); else { setSentTo(r.sentTo ?? "the new number"); setError(null); setStep("code"); } }} className="grid gap-3 sm:grid-cols-2">
      <DetailsFields p={current} />
      <div className="sm:col-span-2">
        <label className={labelClass}>Your account password</label>
        <input name="password" type="password" required autoComplete="current-password" className={`${inputClass} max-w-xs`} />
        <p className="mt-1 text-xs text-muted">To protect your money we confirm it's you, text a code to the new number, and notify your current number once changed.</p>
      </div>
      <div className="flex gap-2 sm:col-span-2"><Submit>Send confirmation code</Submit><button type="button" onClick={() => { setOpen(false); setError(null); }} className="rounded-lg border border-line px-3 py-2 text-sm">Cancel</button></div>
      {error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p> : null}
    </form>
  );
}
