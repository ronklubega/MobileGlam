import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getContext } from "@/lib/dashboard";
import { createTenant } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getContext();
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8"><Logo /></div>
      <h1 className="text-2xl font-extrabold tracking-tight">Set up your business</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Signed in as {ctx.user.email}. We review new listings before they appear to clients, usually within one business day.
      </p>
      {ctx.memberships.length > 0 ? <p className="mb-4 text-sm"><a className="font-semibold text-brand" href="/dashboard">← Back to dashboard</a></p> : null}
      <OnboardingForm action={createTenant} />
    </main>
  );
}
