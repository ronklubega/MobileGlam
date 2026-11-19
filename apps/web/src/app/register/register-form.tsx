"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass } from "@/components/forms";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function RegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true); setError(null);
    const { data, error } = await supabaseBrowser().auth.signUp({
      email: String(fd.get("email")).trim(),
      password,
      options: { data: { full_name: String(fd.get("fullName")).trim() } },
    });
    setBusy(false);
    if (error) return setError(error.message.toLowerCase().includes("registered") ? "That email already has an account. Sign in instead." : error.message);
    if (data.session) { router.replace("/onboarding"); router.refresh(); }
    else setCheckEmail(true); // email confirmation is enabled in Supabase
  }

  if (checkEmail) {
    return <p role="status" className="rounded-xl border border-line bg-surface p-4 text-sm">We sent a confirmation link to your email. Open it, then <a className="font-semibold text-brand" href="/login">sign in</a> to set up your business.</p>;
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className={labelClass} htmlFor="fullName">Your name</label><input id="fullName" name="fullName" required maxLength={80} autoComplete="name" className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} /></div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
    </form>
  );
}
