import { useId } from "react";

/** MobileGlam brand mark: gradient tile, white "M" crowned with a gold sparkle. Source of truth: /brand/logo-mark.svg */
export function LogoMark({ size = 36 }: { size?: number }) {
  // Unique per instance: a gradient defined inside a display:none copy of the logo can't be referenced by a visible one.
  const gid = `gd-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="MobileGlam" className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8447C4" /><stop offset="1" stopColor="#3B1763" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M16 46 V22 L32 38 L48 22 V46" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 9.5 L34.25 15.25 L40 17.5 L34.25 19.75 L32 25.5 L29.75 19.75 L24 17.5 L29.75 15.25 Z" fill="#F7C948" />
    </svg>
  );
}

export function Logo({ size = 36, inverted = false, tagline = false }: { size?: number; inverted?: boolean; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-none">
        <span className={`block text-xl font-extrabold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>
          Mobile<span className={inverted ? "text-[#F7C948]" : "text-brand"}>Glam</span>
        </span>
        {tagline ? <span className={`mt-1 block text-[11px] font-medium tracking-wide ${inverted ? "text-white/70" : "text-muted"}`}>Beauty bookings, simplified</span> : null}
      </span>
    </span>
  );
}
