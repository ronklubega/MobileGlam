import Link from "next/link";
import { formatDay } from "@mobileglam/shared";
import { Card, Empty, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/dashboard";

interface ClientRow { client_id: string; full_name: string | null; phone: string | null; visits: number; last_visit: string | null }

export default async function ClientsPage() {
  const ctx = await getContext();
  if (!ctx.tenant) return null;
  const { data, error } = await ctx.supabase.rpc("tenant_clients", { p_tenant: ctx.tenant.id });
  if (error) throw new Error(error.message);
  const clients = (data ?? []) as ClientRow[];

  return (
    <>
      <PageHeader title="Clients" />
      {clients.length === 0 ? <Empty>Clients appear here after their first booking.</Empty> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="p-3">Client</th><th className="p-3">Phone</th><th className="p-3 text-right">Visits</th><th className="p-3 text-right">Last visit</th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.client_id} className="border-b border-line last:border-0">
                  <td className="p-3"><Link className="font-medium text-brand" href={`/dashboard/clients/${c.client_id}`}>{c.full_name || "Unnamed client"}</Link></td>
                  <td className="p-3 text-muted">{c.phone ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{Number(c.visits)}</td>
                  <td className="p-3 text-right text-muted">{c.last_visit ? formatDay(c.last_visit) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
