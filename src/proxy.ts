import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "hris_session";

/**
 * Proteksi rute optimistis: cek keberadaan cookie sesi sebelum halaman render.
 * Verifikasi penuh tetap dilakukan per-API di server (src/lib/server/session.ts).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
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
