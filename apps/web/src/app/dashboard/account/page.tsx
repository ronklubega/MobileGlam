import { Card, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/dashboard";
import { ROLE_LABEL } from "@/lib/platform";
import { PasswordForm } from "./password-form";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const ctx = await getContext();
  const required = (await searchParams).required === "1";
  return (
    <>
      <PageHeader title="My account" />
      {required ? (
        <div role="alert" className="mb-4 rounded-xl border border-line bg-warn-soft p-4 text-sm text-warn">
          <strong>Choose a new password to continue.</strong> Your account was created with a temporary password.
        </div>
      ) : null}
      <Card className="mb-6 text-sm">
        <p><span className="text-muted">Email:</span> {ctx.user.email}</p>
        {ctx.role ? <p className="mt-1"><span className="text-muted">Business role:</span> <span className="capitalize">{ctx.role}</span> at {ctx.tenant?.name}</p> : null}
        {ctx.platformRole ? <p className="mt-1"><span className="text-muted">Platform role:</span> {ROLE_LABEL[ctx.platformRole]}</p> : null}
      </Card>
      <h2 className="mb-3 text-lg font-bold">Change password</h2>
      <Card className="max-w-md"><PasswordForm required={required} /></Card>
    </>
  );
}
