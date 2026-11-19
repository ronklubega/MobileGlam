"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass } from "@/components/forms";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function PasswordForm({ required }: { required: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = String(fd.get("password")); const again = String(fd.get("confirm"));
    if (next.length < 10) return setError("Use at least 10 characters.");
    if (next !== again) return setError("The two passwords don't match.");
    setBusy(true); setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: next, data: { must_change_password: false } });
    if (error) { setBusy(false); return setError(error.message.includes("same") ? "Choose a password you haven't used before." : "Couldn't update your password. Please try again."); }
    await supabase.auth.refreshSession(); // pull the updated claims so the forced-change gate lifts
    setBusy(false); setDone(true);
    if (required) { router.replace("/dashboard"); router.refresh(); }
  }

  if (done && !required) return <p role="status" className="text-sm text-success">Password updated.</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className={labelClass} htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className={inputClass} /></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">{busy ? "Saving…" : "Update password"}</button>
    </form>
  );
}
