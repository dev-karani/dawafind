import { NextResponse, type NextRequest } from "next/server";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence for cookie-authenticated API calls (in addition to SameSite=Lax cookies):
 * state-changing requests must come from the same origin. The scheduled-job endpoint is
 * exempt because it authenticates with a bearer secret instead of cookies.
 */
export function proxy(req: NextRequest) {
  if (UNSAFE.has(req.method) && req.nextUrl.pathname.startsWith("/api/") && !req.nextUrl.pathname.startsWith("/api/cron/")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let ok = false;
    if (origin && host) {
      try {
        ok = new URL(origin).host === host;
      } catch {
        ok = false;
      }
    }
    if (!ok) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
