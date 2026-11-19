"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass } from "@/components/forms";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("password")) });
    if (error) { setBusy(false); setError("Incorrect email or password."); return; }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className={labelClass} htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} /></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
