import Link from "next/link";
import type { SetupStep } from "@/lib/setup";

export function SetupChecklist({ steps, pending }: { steps: SetupStep[]; pending?: boolean }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-label="Setup checklist" className="mb-6 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Finish setting up</h2>
        <span className="text-sm text-muted">{done} of {steps.length} done</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-brand" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden className={s.done ? "text-success" : "text-muted"}>{s.done ? "✓" : "○"}</span>
            {s.done ? <span className="text-muted line-through">{s.label}</span> : <Link href={s.href} className="font-medium text-brand">{s.label}</Link>}
          </li>
        ))}
      </ul>
      {pending ? <p className="mt-3 text-xs text-muted">Your business goes live to clients once it's approved and has services, staff and working hours.</p> : null}
    </section>
  );
}
