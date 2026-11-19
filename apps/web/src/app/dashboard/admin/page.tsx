import { supabaseAdmin } from "@/lib/auth";
import { getContext } from "@/lib/dashboard";
import { requirePlatformRole } from "@/lib/platform";
import { OverviewView, RANGES, type Analytics, type Entry, type Stats } from "./overview-view";

export default async function PlatformOverview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requirePlatformRole(await getContext(), "support");
  const sp = await searchParams;
  const n = RANGES.find((r) => String(r.n) === sp.days)?.n ?? 30;
  const admin = supabaseAdmin();
  const [stats, analytics, log] = await Promise.all([
    admin.rpc("admin_platform_stats"),
    admin.rpc("admin_platform_analytics", { p_days: n }),
    admin.from("admin_audit_log").select("id,actor_email,action,target_type,details,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  if (stats.error) throw new Error(stats.error.message);
  if (analytics.error) throw new Error(analytics.error.message);
  const s = stats.data as Stats;
  const a = analytics.data as Analytics;
  const entries = (log.data ?? []) as Entry[];
  return <OverviewView s={s} a={a} entries={entries} n={n} />;
}
