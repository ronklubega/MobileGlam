import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const errors = {
  unauthorized: () => new AppError(401, "UNAUTHORIZED", "Sign in to continue"),
  forbidden: () => new AppError(403, "FORBIDDEN", "You do not have access to this resource"),
  notFound: (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`),
  conflict: (code: string, msg: string) => new AppError(409, code, msg),
  badRequest: (code: string, msg: string) => new AppError(400, code, msg),
  upstream: (msg: string) => new AppError(502, "PAYMENT_PROVIDER_ERROR", msg),
};

/** Wraps a route handler: consistent JSON errors, Zod -> 400, unknown -> 500 (details logged, never leaked). */
export function handle<C>(fn: (req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid request", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } },
          { status: 400 },
        );
      }
      if (e instanceof AppError) {
        return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      console.error("[unhandled]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw errors.badRequest("INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
