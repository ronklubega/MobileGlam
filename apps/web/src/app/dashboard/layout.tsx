import Link from "next/link";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { BarNav, SideNav, type NavGroup } from "@/components/nav";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { atLeast, ROLE_LABEL } from "@/lib/platform";
import { signOut, switchTenant } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const manager = ctx.role === "owner" || ctx.role === "manager";

  const groups: NavGroup[] = [];
  if (ctx.tenant) {
    groups.push({
      title: "Business",
      items: [
        { href: "/dashboard", label: "Bookings", icon: "calendar" },
        ...(manager ? [
          { href: "/dashboard/services", label: "Services", icon: "list" },
          { href: "/dashboard/staff", label: "Staff", icon: "user" },
          { href: "/dashboard/photos", label: "Photos", icon: "image" },
          { href: "/dashboard/revenue", label: "Revenue", icon: "chart" },
        ] : []),
        { href: "/dashboard/clients", label: "Clients", icon: "users" },
        ...(manager ? [{ href: "/dashboard/settings", label: "Settings", icon: "sliders" }] : []),
      ],
    });
  }
  if (ctx.platformRole) {
    const { count: pending } = await supabaseAdmin().from("tenants").select("id", { count: "exact", head: true }).eq("is_active", false).is("suspended_at", null);
    groups.push({
      title: "Platform",
      items: [
        { href: "/dashboard/admin", label: "Overview", icon: "home" },
        { href: "/dashboard/admin/salons", label: "Businesses", icon: "building" },
        { href: "/dashboard/approvals", label: "Approvals", icon: "check", badge: pending ?? 0 },
        { href: "/dashboard/admin/users", label: "Users", icon: "users" },
        { href: "/dashboard/refunds", label: "Refunds", icon: "undo" },
        ...(atLeast(ctx.platformRole, "super_admin") ? [{ href: "/dashboard/admin/admins", label: "Admins", icon: "shield" }] : []),
      ],
    });
  }

  const label = ctx.displayName || ctx.user.email || "Account";
  const initials = label.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const roleText = ctx.platformRole ? ROLE_LABEL[ctx.platformRole] : ctx.role ? ctx.role[0]!.toUpperCase() + ctx.role.slice(1) : "";

  const tenantSwitcher = ctx.memberships.length > 1 ? (
    <form action={switchTenant} className="flex gap-2 px-3 pb-4">
      <select name="tenantId" defaultValue={ctx.tenant?.id} className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" aria-label="Switch business">
        {ctx.memberships.map((m) => <option key={m.tenant.id} value={m.tenant.id}>{m.tenant.name}</option>)}
      </select>
      <button className="rounded-lg border border-line px-2 text-sm">Go</button>
    </form>
  ) : ctx.tenant ? <p className="truncate px-6 pb-4 text-sm font-semibold">{ctx.tenant.name}</p> : null;

  const userBlock = (
    <div className="border-t border-line p-3">
      <Link href="/dashboard/account" className="flex items-center gap-3 rounded-lg p-2 hover:bg-bg">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{initials || "?"}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs text-muted">{roleText}</span>
        </span>
      </Link>
      <form action={signOut}>
        <button className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-ink"><Icon name="logout" />Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface lg:flex">
        <div className="px-6 py-6"><Logo /></div>
        {tenantSwitcher}
        <div className="flex-1 overflow-y-auto px-3 pb-4"><SideNav groups={groups} /></div>
        {userBlock}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo size={30} />
            <div className="flex items-center gap-1">
              <Link href="/dashboard/account" className="rounded-lg px-3 py-1.5 text-sm text-muted">Account</Link>
              <form action={signOut}><button className="rounded-lg px-3 py-1.5 text-sm text-muted">Sign out</button></form>
            </div>
          </div>
          <BarNav groups={groups} />
        </header>

        {ctx.tenant?.suspended_at ? (
          <div role="alert" className="border-b border-line bg-danger-soft px-4 py-2.5 text-center text-sm font-medium text-danger">
            {ctx.tenant.name} is suspended and hidden from clients{ctx.tenant.suspension_reason ? `: ${ctx.tenant.suspension_reason}` : ""}. Contact GlamDesk support to resolve this.
          </div>
        ) : ctx.tenant && !ctx.tenant.is_active ? (
          <div role="status" className="border-b border-line bg-warn-soft px-4 py-2.5 text-center text-sm font-medium text-warn">
            {ctx.tenant.name} is awaiting approval and isn't visible to clients yet. You can still set up services, staff and schedules.
          </div>
        ) : null}

        <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
          {ctx.tenant || ctx.platformRole ? children : (
            <div className="rounded-2xl border border-line bg-surface p-6">
              <h1 className="text-xl font-bold">No business linked to this account</h1>
              <p className="mt-2 text-sm text-muted">
                Signed in as {ctx.user.email}. You haven't set up a business yet. Register one now, or ask the GlamDesk team to link your account to an existing one.
              </p>
              <a href="/onboarding" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand">Set up your business</a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
