import { NextResponse } from "next/server";
import { z } from "zod";
import { mtnEnv } from "@/lib/env";
import { handle, safeEqual } from "@/lib/http";
import { settlePayment } from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

// MTN callbacks are unsigned. The secret path segment filters noise; the real protection is that
// settlePayment() re-queries MTN for the status instead of trusting this body.
const bodySchema = z.object({ externalId: z.string().uuid() }).passthrough();

export const PUT = handle(async (req, ctx: { params: Promise<{ secret: string }> }) => handleCallback(req, ctx));
export const POST = PUT;

async function handleCallback(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  if (!safeEqual(secret, mtnEnv().MTN_MOMO_CALLBACK_SECRET)) return new NextResponse(null, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (parsed.success) {
    await settlePayment(parsed.data.externalId, parsed.data).catch((e) => console.error("[mtn webhook]", e));
  }
  return NextResponse.json({ ok: true }); // always 200 so MTN doesn't hammer retries
}
