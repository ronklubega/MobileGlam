"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

export interface NavItem { href: string; label: string; icon: string; badge?: number }
export interface NavGroup { title?: string; items: NavItem[] }

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`));
}

/** Desktop sidebar. */
export function SideNav({ groups }: { groups: NavGroup[] }) {
  const isActive = useActive();
  return (
    <nav aria-label="Dashboard" className="space-y-6">
      {groups.map((g, i) => (
        <div key={g.title ?? i}>
          {g.title ? <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p> : null}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href} aria-current={isActive(it.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(it.href) ? "bg-brand-soft text-brand" : "text-muted hover:bg-bg hover:text-ink"}`}
                >
                  <Icon name={it.icon} />
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-on-brand">{it.badge}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Small-screen horizontal bar. */
export function BarNav({ groups }: { groups: NavGroup[] }) {
  const isActive = useActive();
  const items = groups.flatMap((g) => g.items);
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-2">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? "page" : undefined}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive(it.href) ? "bg-brand-soft text-brand" : "text-muted"}`}>
          <Icon name={it.icon} size={16} />{it.label}
          {it.badge ? <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-on-brand">{it.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
