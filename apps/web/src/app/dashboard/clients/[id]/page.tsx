import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDateTime, formatUGX } from "@glamdesk/shared";
import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/dashboard";
import { addClientNote } from "../../actions";

interface Visit { id: string; starts_at: string; status: string; price_ugx: number; services: { name: string } | null; staff: { display_name: string } | null }
interface Note { id: string; note: string; created_at: string; author: { full_name: string | null } | null }

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await getContext();
  if (!ctx.tenant) return null;

  const [profile, visits, notes] = await Promise.all([
    ctx.supabase.from("profiles").select("id,full_name,phone,avatar_url").eq("id", id).maybeSingle(),
    ctx.supabase.from("bookings").select("id,starts_at,status,price_ugx,services(name),staff(display_name)").eq("tenant_id", ctx.tenant.id).eq("client_id", id).neq("status", "expired").order("starts_at", { ascending: false }).limit(50),
    ctx.supabase.from("client_notes").select("id,note,created_at,author:profiles!client_notes_author_id_fkey(full_name)").eq("tenant_id", ctx.tenant.id).eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  if (!profile.data) notFound();
  const p = profile.data as { full_name: string | null; phone: string | null; avatar_url: string | null };
  const history = (visits.data ?? []) as unknown as Visit[];
  const noteList = (notes.data ?? []) as unknown as Note[];

  return (
    <>
      <Link href="/dashboard/clients" className="text-sm text-muted">← Clients</Link>
      {p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt={`${p.full_name ?? "Client"} photo`} width={72} height={72} className="mb-3 h-[72px] w-[72px] rounded-full object-cover" />
      ) : null}
      <PageHeader title={p.full_name || "Unnamed client"}>
        {p.phone ? <a href={`tel:${p.phone}`} className="rounded-lg border border-line px-3 py-1.5 text-sm">Call {p.phone}</a> : null}
      </PageHeader>

      <h2 className="mb-2 text-lg font-bold">Notes</h2>
      <p className="mb-3 text-sm text-muted">Private to your team. Clients never see these.</p>
      <Card className="mb-4">
        <ActionForm action={addClientNote.bind(null, id)}>
          <textarea name="note" required maxLength={2000} rows={3} placeholder="e.g. Sensitive scalp, prefers no relaxer. Allergic to ammonia dyes." className={inputClass} />
          <div className="mt-2"><SubmitButton>Add note</SubmitButton></div>
        </ActionForm>
      </Card>
      {noteList.length === 0 ? <Empty>No notes yet.</Empty> : (
        <ul className="space-y-2">
          {noteList.map((n) => (
            <li key={n.id}><Card><p className="whitespace-pre-wrap text-sm">{n.note}</p><p className="mt-2 text-xs text-muted">{n.author?.full_name || "Team member"} · {formatDateTime(n.created_at)}</p></Card></li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 mt-8 text-lg font-bold">History</h2>
      {history.length === 0 ? <Empty>No bookings.</Empty> : (
        <ul className="space-y-2">
          {history.map((v) => (
            <li key={v.id}>
              <Card className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium">{v.services?.name}</p><p className="text-sm text-muted">{formatDateTime(v.starts_at)} · {v.staff?.display_name} · {formatUGX(Number(v.price_ugx))}</p></div>
                <Badge tone={v.status === "confirmed" || v.status === "completed" ? "success" : v.status === "pending_payment" ? "warn" : "danger"}>{v.status.replace("_", " ")}</Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
