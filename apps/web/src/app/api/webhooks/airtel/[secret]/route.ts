import { NextResponse } from "next/server";
import { z } from "zod";
import { airtelEnv } from "@/lib/env";
import { handle, safeEqual } from "@/lib/http";
import { settlePayment } from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ transaction: z.object({ id: z.string().uuid() }).passthrough() }).passthrough();

export const POST = handle(async (req, ctx: { params: Promise<{ secret: string }> }) => {
  const { secret } = await ctx.params;
  if (!safeEqual(secret, airtelEnv().AIRTEL_CALLBACK_SECRET)) return new NextResponse(null, { status: 404 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (parsed.success) {
    await settlePayment(parsed.data.transaction.id, parsed.data).catch((e) => console.error("[airtel webhook]", e));
  }
  return NextResponse.json({ ok: true });
});
