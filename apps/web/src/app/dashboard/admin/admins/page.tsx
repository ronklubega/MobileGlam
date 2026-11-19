import { formatDay } from "@glamdesk/shared";
import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { bootstrapEmails, requirePlatformRole, ROLE_LABEL, type PlatformRole } from "@/lib/platform";
import { changeAdminRole, removeAdmin } from "../actions";
import { CreateAdminForm } from "./create-admin-form";

interface Row { user_id: string; role: PlatformRole; created_at: string; profiles: { full_name: string | null } | null }

export default async function AdminsPage() {
  const ctx = await requirePlatformRole(await getContext(), "super_admin");
  const admin = supabaseAdmin();
  const { data } = await admin.from("platform_admins").select("user_id,role,created_at,profiles!platform_admins_user_id_fkey(full_name)").order("created_at");
  const rows = (data ?? []) as unknown as Row[];
  const emails = new Map(await Promise.all(rows.map(async (r) => [r.user_id, (await admin.auth.admin.getUserById(r.user_id)).data.user?.email ?? "unknown"] as const)));
  const env = bootstrapEmails();

  return (
    <>
      <PageHeader title="Platform admins" />
      <Card className="mb-6 text-sm">
        <p className="font-semibold">Roles</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
          <li><strong className="text-ink">Support:</strong> view businesses, users, approvals, refunds and activity. No changes.</li>
          <li><strong className="text-ink">Admin:</strong> also approve, suspend and reinstate businesses and record refunds.</li>
          <li><strong className="text-ink">Super admin:</strong> also create admins and change roles.</li>
        </ul>
      </Card>

      <ul className="mb-8 space-y-3">
        {env.map((e) => (
          <li key={e}><Card className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-semibold">{e}</p><p className="text-xs text-muted">Set in the server environment (PLATFORM_ADMIN_EMAILS). Always a super admin; change it in the deployment settings.</p></div>
            <Badge tone="success">Super admin</Badge>
          </Card></li>
        ))}
        {rows.map((r) => {
          const self = r.user_id === ctx.user.id;
          return (
            <li key={r.user_id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.profiles?.full_name || emails.get(r.user_id)} {self ? <Badge tone="neutral">You</Badge> : null}</p>
                    <p className="text-sm text-muted">{emails.get(r.user_id)} · added {formatDay(r.created_at)}</p>
                  </div>
                  {self ? <Badge tone="success">{ROLE_LABEL[r.role]}</Badge> : (
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionForm action={changeAdminRole.bind(null, r.user_id)} className="flex items-center gap-2">
                        <select name="role" defaultValue={r.role} className={`${inputClass} w-auto`} aria-label="Role">
                          <option value="support">Support</option><option value="admin">Admin</option><option value="super_admin">Super admin</option>
                        </select>
                        <SubmitButton variant="ghost">Update</SubmitButton>
                      </ActionForm>
                      <ActionForm action={removeAdmin.bind(null, r.user_id)}><SubmitButton variant="danger">Remove</SubmitButton></ActionForm>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <h2 className="mb-3 text-lg font-bold">Create an admin account</h2>
      <Card><CreateAdminForm /></Card>
    </>
  );
}
