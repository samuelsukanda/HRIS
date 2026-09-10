import { getSessionUser } from "@/lib/server/session";
import { ATTENDANCE_TEST_MODE } from "@/lib/server/test-mode";

/** GET /api/attendance/test-mode — flag mode test untuk client (perlu login). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, testMode: ATTENDANCE_TEST_MODE });
}
