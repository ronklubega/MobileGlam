import { ActionForm, SubmitButton, inputClass, labelClass } from "@/components/forms";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/dashboard";
import { saveShifts, saveStaff, saveStaffServices, setStaffActive } from "../actions";

interface StaffRow {
  id: string; display_name: string; title: string | null; is_active: boolean;
  staff_services: { service_id: string }[]; staff_shifts: { weekday: number; start_time: string; end_time: string }[];
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first

export default async function StaffPage() {
  const ctx = await requireManager();
  const [staffRes, svcRes] = await Promise.all([
    ctx.supabase.from("staff").select("id,display_name,title,is_active,staff_services(service_id),staff_shifts(weekday,start_time,end_time)").eq("tenant_id", ctx.tenant.id).order("display_name"),
    ctx.supabase.from("services").select("id,name").eq("tenant_id", ctx.tenant.id).eq("is_active", true).order("name"),
  ]);
  const staff = (staffRes.data ?? []) as unknown as StaffRow[];
  const services = (svcRes.data ?? []) as unknown as { id: string; name: string }[];

  return (
    <>
      <PageHeader title="Staff & schedules" />
      <div className="space-y-4">
        {staff.length === 0 ? <Empty>No staff yet. Add your first stylist below.</Empty> : staff.map((s) => {
          const assigned = new Set(s.staff_services.map((x) => x.service_id));
          const shiftByDay = new Map(s.staff_shifts.map((x) => [x.weekday, x]));
          return (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{s.display_name} {!s.is_active ? <Badge tone="danger">Inactive</Badge> : null}</p>
                  {s.title ? <p className="text-sm text-muted">{s.title}</p> : null}
                </div>
                <ActionForm action={setStaffActive.bind(null, s.id, !s.is_active)}>
                  <SubmitButton variant="ghost">{s.is_active ? "Deactivate" : "Reactivate"}</SubmitButton>
                </ActionForm>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Services performed</summary>
                <ActionForm action={saveStaffServices.bind(null, s.id)} className="mt-3">
                  {services.length === 0 ? <p className="text-sm text-muted">Add services first.</p> : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {services.map((sv) => (
                        <label key={sv.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="serviceId" value={sv.id} defaultChecked={assigned.has(sv.id)} /> {sv.name}</label>
                      ))}
                    </div>
                  )}
                  <div className="mt-3"><SubmitButton>Save services</SubmitButton></div>
                </ActionForm>
              </details>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Weekly schedule</summary>
                <ActionForm action={saveShifts.bind(null, s.id)} className="mt-3">
                  <div className="space-y-2">
                    {ORDER.map((d) => {
                      const sh = shiftByDay.get(d);
                      return (
                        <div key={d} className="flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex w-32 items-center gap-2"><input type="checkbox" name={`on${d}`} defaultChecked={!!sh} /> {DAYS[d]}</label>
                          <input type="time" name={`start${d}`} defaultValue={sh?.start_time.slice(0, 5) ?? "09:00"} className="rounded-lg border border-line bg-surface px-2 py-1" aria-label={`${DAYS[d]} start`} />
                          <span className="text-muted">to</span>
                          <input type="time" name={`end${d}`} defaultValue={sh?.end_time.slice(0, 5) ?? "17:00"} className="rounded-lg border border-line bg-surface px-2 py-1" aria-label={`${DAYS[d]} end`} />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted">Times are Kampala time. Unticked days are days off.</p>
                  <div className="mt-3"><SubmitButton>Save schedule</SubmitButton></div>
                </ActionForm>
              </details>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Edit details</summary>
                <ActionForm action={saveStaff.bind(null, s.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><label className={labelClass}>Name</label><input name="displayName" required defaultValue={s.display_name} className={inputClass} /></div>
                  <div><label className={labelClass}>Title</label><input name="title" defaultValue={s.title ?? ""} className={inputClass} /></div>
                  <div><SubmitButton>Save</SubmitButton></div>
                </ActionForm>
              </details>
            </Card>
          );
        })}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Add staff member</h2>
      <Card>
        <ActionForm action={saveStaff.bind(null, null)} className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelClass}>Name</label><input name="displayName" required className={inputClass} /></div>
          <div><label className={labelClass}>Title (e.g. Senior Stylist)</label><input name="title" className={inputClass} /></div>
          <div><SubmitButton>Add</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
