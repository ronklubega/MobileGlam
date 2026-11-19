import { createBookingSchema } from "@mobileglam/shared";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/http";
import { createBooking } from "@/server/services/booking.service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const input = await parseBody(req, createBookingSchema);
  return NextResponse.json(await createBooking(user.id, input), { status: 201 });
});
