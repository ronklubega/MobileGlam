import { redirect } from "next/navigation";
import { formatDateTime, formatUGX } from "@mobileglam/shared";
import { supabaseAdmin } from "@/lib/auth";
import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { Card, Empty, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/dashboard";
import { markRefunded } from "../admin/actions";
import { atLeast } from "@/lib/platform";

interface Row {
  id: string; provider: string; amount_ugx: number; payer_phone: string; completed_at: string | null;
  bookings: { starts_at: string; tenants: { name: string } | null } | null;
}

/** Platform operators only: deposits that arrived after the slot was lost and must be returned to the payer. */
export default async function RefundsPage() {
  const ctx = await getContext();
  if (!ctx.platformAdmin) redirect("/dashboard");
  const canRefund = atLeast(ctx.platformRole, "admin");

  const { data, error } = await supabaseAdmin()
    .from("payments")
    .select("id,provider,amount_ugx,payer_phone,completed_at,bookings(starts_at,tenants(name))")
    .eq("status", "successful").like("failure_reason", "LATE_PAYMENT%").is("refunded_at", null)
    .order("completed_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Refund queue" />
      <p className="mb-4 text-sm text-muted">
        These clients paid a deposit after their held slot expired and was re-booked. Refund them in the MTN/Airtel merchant portal,
        then record the transaction reference here.
      </p>
      {rows.length === 0 ? <Empty>Nothing to refund. 🎉</Empty> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <p className="font-bold">{formatUGX(Number(r.amount_ugx))} to {r.payer_phone} <span className="font-normal text-muted">({r.provider === "mtn_momo" ? "MTN MoMo" : "Airtel Money"})</span></p>
                <p className="text-sm text-muted">{r.bookings?.tenants?.name} · slot {r.bookings ? formatDateTime(r.bookings.starts_at) : ""} · paid {r.completed_at ? formatDateTime(r.completed_at) : ""}</p>
                {canRefund ? (
                  <ActionForm action={markRefunded.bind(null, r.id)} className="mt-3 flex flex-wrap items-center gap-2">
                    <input name="reference" required placeholder="Refund transaction reference" className={`${inputClass} max-w-xs`} />
                    <SubmitButton>Mark refunded</SubmitButton>
                  </ActionForm>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
