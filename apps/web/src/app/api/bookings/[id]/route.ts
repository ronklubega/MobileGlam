import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { getBookingForClient } from "@/server/services/booking.service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  return getBookingForClient(user.id, z.string().uuid().parse(id));
});
