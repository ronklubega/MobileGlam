import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/dashboard";
import { deletePhoto, makeCoverPhoto } from "../actions";
import { PhotoUploader } from "./photo-uploader";

interface Photo { id: string; url: string; position: number }

export default async function PhotosPage() {
  const ctx = await requireManager();
  const { data } = await ctx.supabase.from("tenant_photos").select("id,url,position").eq("tenant_id", ctx.tenant.id).order("position").order("created_at");
  const photos = (data ?? []) as Photo[];
  const nextPosition = photos.reduce((m, p) => Math.max(m, p.position), 0) + 1;

  return (
    <>
      <PageHeader title="Photos" />
      <p className="mb-4 text-sm text-muted">
        Show clients your space and your work. The first photo is your cover in search results. Photos are resized automatically.
      </p>
      <Card className="mb-6"><PhotoUploader tenantId={ctx.tenant.id} existing={photos.length} nextPosition={nextPosition} /></Card>
      {photos.length === 0 ? <Empty>No photos yet. Businesses with photos get far more bookings.</Empty> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id}>
              <Card className="p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Business photo ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {i === 0 ? <Badge tone="success">Cover</Badge> : (
                    <ActionForm action={makeCoverPhoto.bind(null, p.id)}><SubmitButton variant="ghost">Make cover</SubmitButton></ActionForm>
                  )}
                  <ActionForm action={deletePhoto.bind(null, p.id)}><SubmitButton variant="danger">Delete</SubmitButton></ActionForm>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
