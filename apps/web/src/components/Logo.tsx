import { useId } from "react";

/** GlamDesk brand mark: gradient tile, white "G", gold sparkle. Source of truth: /brand/logo-mark.svg */
export function LogoMark({ size = 36 }: { size?: number }) {
  // Unique per instance: a gradient defined inside a display:none copy of the logo can't be referenced by a visible one.
  const gid = `gd-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="GlamDesk" className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8447C4" /><stop offset="1" stopColor="#3B1763" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M42.4 24.6 A13.5 13.5 0 1 0 45.5 32.5 H33.5" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47.5 9 L49.4 14.6 L55 16.5 L49.4 18.4 L47.5 24 L45.6 18.4 L40 16.5 L45.6 14.6 Z" fill="#F7C948" />
    </svg>
  );
}

export function Logo({ size = 36, inverted = false, tagline = false }: { size?: number; inverted?: boolean; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-none">
        <span className={`block text-xl font-extrabold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>
          Glam<span className={inverted ? "text-[#F7C948]" : "text-brand"}>Desk</span>
        </span>
        {tagline ? <span className={`mt-1 block text-[11px] font-medium tracking-wide ${inverted ? "text-white/70" : "text-muted"}`}>Beauty bookings, simplified</span> : null}
      </span>
    </span>
  );
}
