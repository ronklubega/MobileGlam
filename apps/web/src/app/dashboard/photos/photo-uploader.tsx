"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const MAX_PHOTOS = 10;
const MAX_EDGE = 1600;

/** Resizes in the browser first: owners often pick 5-10 MB phone photos over slow connections. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82));
}

export function PhotoUploader({ tenantId, existing, nextPosition }: { tenantId: string; existing: number; nextPosition: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const room = MAX_PHOTOS - existing;

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Only ${room} more photo${room === 1 ? "" : "s"} allowed (limit ${MAX_PHOTOS}). Uploading the first ${room}.`);
    const supabase = supabaseBrowser();
    setBusy(true);
    let done = 0;
    for (const [i, file] of picked.entries()) {
      setStatus(`Uploading ${i + 1} of ${picked.length}…`);
      if (!file.type.startsWith("image/")) { setError(`${file.name} isn't an image.`); continue; }
      try {
        const blob = await shrink(file);
        const path = `${tenantId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("tenant-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const url = supabase.storage.from("tenant-photos").getPublicUrl(path).data.publicUrl;
        const ins = await supabase.from("tenant_photos").insert({ tenant_id: tenantId, path, url, position: nextPosition + i });
        if (ins.error) {
          await supabase.storage.from("tenant-photos").remove([path]); // don't leave an orphan file
          throw ins.error;
        }
        done++;
      } catch {
        setError(`Couldn't upload ${file.name}. Use a JPG, PNG or WebP photo and check your connection.`);
      }
    }
    setBusy(false);
    setStatus(done ? `${done} photo${done === 1 ? "" : "s"} added.` : null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onPick(e.target.files)} />
      <button
        type="button" disabled={busy || room <= 0} onClick={() => input.current?.click()}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50"
      >
        {room <= 0 ? "Photo limit reached" : busy ? "Uploading…" : "Add photos"}
      </button>
      <span className="ml-3 text-sm text-muted">{existing} of {MAX_PHOTOS} used</span>
      {status ? <p role="status" className="mt-2 text-sm text-success">{status}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
