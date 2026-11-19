import Link from "next/link";
import { formatDay } from "@mobileglam/shared";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { inputClass } from "@/components/forms";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { requirePlatformRole, ROLE_LABEL, type PlatformRole } from "@/lib/platform";

interface U {
  id: string; full_name: string | null; phone: string | null; email: string | null; created_at: string; last_sign_in_at: string | null;
  bookings_count: number; owns_business: boolean; platform_role: PlatformRole | null; total_count: number;
}
const PAGE_SIZE = 25;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePlatformRole(await getContext(), "support");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { data, error } = await supabaseAdmin().rpc("admin_user_overview", { p_search: q || null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  if (error) throw new Error(error.message);
  const users = (data ?? []) as U[];
  const total = Number(users[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/dashboard/admin/users?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader title="Users">
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, phone or email" className={`${inputClass} w-64`} aria-label="Search users" />
          <button className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">Search</button>
        </form>
      </PageHeader>
      <p className="mb-3 text-sm text-muted">{total} user{total === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""}</p>
      {users.length === 0 ? <Empty>No users found.</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="p-3">User</th><th className="p-3">Contact</th><th className="p-3">Joined</th><th className="p-3">Last seen</th><th className="p-3 text-right">Bookings</th><th className="p-3">Roles</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0 align-top">
                  <td className="p-3 font-medium">{u.full_name || "—"}</td>
                  <td className="p-3"><span className="block">{u.phone ?? "—"}</span><span className="text-xs text-muted">{u.email}</span></td>
                  <td className="whitespace-nowrap p-3 text-muted">{formatDay(u.created_at)}</td>
                  <td className="whitespace-nowrap p-3 text-muted">{u.last_sign_in_at ? formatDay(u.last_sign_in_at) : "never"}</td>
                  <td className="p-3 text-right tabular-nums">{Number(u.bookings_count)}</td>
                  <td className="space-x-1 p-3">
                    {u.owns_business ? <Badge tone="neutral">Business owner</Badge> : null}
                    {u.platform_role ? <Badge tone="success">{ROLE_LABEL[u.platform_role]}</Badge> : null}
                    {!u.owns_business && !u.platform_role ? <span className="text-muted">Client</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link className="rounded-lg border border-line px-3 py-1.5" href={link(page - 1)}>← Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="rounded-lg border border-line px-3 py-1.5" href={link(page + 1)}>Next →</Link> : <span />}
        </div>
      ) : null}
    </>
  );
}
