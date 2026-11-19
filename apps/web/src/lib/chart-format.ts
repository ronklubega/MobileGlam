/** Number formats shared by server pages and the client chart components. */

/** 950 / 1.2K / 12K / 4.2M: for axes and tight spaces. Full values live in tooltips. */
export const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1_000)}K` : n >= 1_000 ? `${+(n / 1_000).toFixed(2)}K` : String(Math.round(n));
export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-US")}`;
export const ugxCompact = (n: number) => `UGX ${compact(n)}`;
export const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%");

/** Formats are named (not functions) so server components can pass them to client charts. */
export type Format = "ugx" | "ugxCompact" | "number";
export const FORMATS: Record<Format, (n: number) => string> = {
  ugx, ugxCompact, number: (n) => Math.round(n).toLocaleString("en-US"),
};
