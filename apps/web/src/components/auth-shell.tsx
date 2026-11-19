import type { ReactNode } from "react";
import { Logo } from "./Logo";

const POINTS = [
  "Take deposits by MTN MoMo and Airtel Money",
  "Automatic SMS reminders cut no-shows",
  "Live availability, no double-booking",
  "Revenue and client history in one place",
];

/** Split-screen frame for sign-in and registration. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="hidden flex-col justify-between p-12 text-white lg:flex" style={{ background: "linear-gradient(150deg, #6B33A0 0%, #3B1763 58%, #26103F 100%)" }}>
        <Logo inverted size={40} />
        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Run your salon, clinic or barbershop on MobileGlam.</h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-white/85">
                <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F7C948] text-xs font-bold text-[#3B1763]">✓</span>{p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/55">© {new Date().getFullYear()} MobileGlam. Built for Uganda.</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
