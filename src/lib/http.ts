import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new ApiError(400, m);
export const unauthorized = (m = "Please sign in to continue.") => new ApiError(401, m);
export const forbidden = (m = "You do not have permission to do that.") => new ApiError(403, m);
export const notFound = (m = "Not found.") => new ApiError(404, m);
export const conflict = (m: string) => new ApiError(409, m);
export const tooMany = (m = "Too many attempts. Please wait a moment and try again.") => new ApiError(429, m);

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler with uniform, non-leaky error handling.
 * Internal errors are logged server-side and returned as a generic message.
 */
export function route<P = Record<string, string>>(
  handler: (req: NextRequest, ctx: { params: P }) => Promise<Response | object>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const params = (await ctx?.params) ?? ({} as P);
      const result = await handler(req, { params });
      if (result instanceof Response) return result;
      return NextResponse.json(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const flat = err.flatten();
    const first = Object.entries(flat.fieldErrors)[0];
    const message = first ? `${first[0]}: ${first[1]?.[0]}` : (flat.formErrors[0] ?? "Invalid input.");
    return NextResponse.json({ error: message, fields: flat.fieldErrors }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return NextResponse.json({ error: "That record already exists." }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => (obj[k] = v));
  return schema.parse(obj);
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
