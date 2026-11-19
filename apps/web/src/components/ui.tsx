import type { ReactNode } from "react";

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(30,27,36,0.04)] ${className}`}>{children}</div>
);

const tones = {
  success: "bg-success-soft text-success", warn: "bg-warn-soft text-warn", danger: "bg-danger-soft text-danger", neutral: "bg-brand-soft text-brand",
} as const;
export const Badge = ({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
);

export const PageHeader = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
    <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
    {children}
  </div>
);

export const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card>
    <p className="text-xs font-semibold text-muted">{label}</p>
    <p className="mt-1 text-2xl font-bold">{value}</p>
    {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
  </Card>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</p>
);
