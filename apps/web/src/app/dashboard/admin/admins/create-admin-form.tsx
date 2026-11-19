"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { inputClass, labelClass } from "@/components/forms";
import { createAdmin, type CreateAdminResult } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">{pending ? "Creating…" : "Create admin"}</button>;
}

export function CreateAdminForm() {
  const [res, setRes] = useState<CreateAdminResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (res?.ok) {
    return (
      <div role="status" className="space-y-3 rounded-xl border border-line bg-success-soft p-4">
        {res.tempPassword ? (
          <>
            <p className="font-semibold text-success">Account created for {res.email}</p>
            <p className="text-sm">Share this one-time password securely (it won't be shown again). They must choose a new password at first sign-in.</p>
            <div className="flex items-center gap-2">
              <code className="rounded-lg border border-line bg-surface px-3 py-2 text-base font-semibold tracking-wide">{res.tempPassword}</code>
              <button type="button" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold"
                onClick={async () => { await navigator.clipboard.writeText(res.tempPassword!); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </>
        ) : <p className="font-semibold text-success">{res.email} already had an account and now has admin access. They keep their existing password.</p>}
        <button type="button" className="text-sm font-semibold text-brand" onClick={() => { setRes(null); setCopied(false); }}>Add another</button>
      </div>
    );
  }
  return (
    <form action={async (fd) => setRes(await createAdmin(fd))} className="grid gap-3 sm:grid-cols-2">
      <div><label className={labelClass}>Full name</label><input name="fullName" maxLength={80} className={inputClass} /></div>
      <div><label className={labelClass}>Email</label><input name="email" type="email" required className={inputClass} /></div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Role</label>
        <select name="role" defaultValue="admin" className={inputClass}>
          <option value="support">Support: view only</option>
          <option value="admin">Admin: approve, suspend, record refunds</option>
          <option value="super_admin">Super admin: everything, including managing admins</option>
        </select>
      </div>
      <div className="sm:col-span-2"><Submit /></div>
      {res?.error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{res.error}</p> : null}
    </form>
  );
}
