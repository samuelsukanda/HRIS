import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "hris_session";

/**
 * Proteksi rute optimistis: cek keberadaan cookie sesi sebelum halaman render.
 * Verifikasi penuh tetap dilakukan per-API di server (src/lib/server/session.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!request.cookies.has(SESSION_COOKIE) && (pathname.startsWith("/admin") || pathname.startsWith("/app"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
