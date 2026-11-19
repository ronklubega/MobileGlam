"use client";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: boolean; error?: string } | null;
export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Form wired to a server action, showing its error/success message inline. */
export function ActionForm({ action, children, className }: { action: FormAction; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p role="status" className="mt-2 text-sm text-success">Saved</p> : null}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "ghost" | "danger" }) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand text-on-brand",
    ghost: "border border-line bg-surface text-ink",
    danger: "border border-danger text-danger bg-surface",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${styles}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

export const inputClass = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink";
export const labelClass = "mb-1 block text-xs font-semibold text-muted";
