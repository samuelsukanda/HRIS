import { loadHrisData, scopeForUser } from "@/lib/server/state";
import { getSessionUser } from "@/lib/server/session";
import type { Role } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ session: null }, { status: 401 });
  const data = await loadHrisData();
  return Response.json({
    session: { userId: user.id, employeeId: user.employee_id },
    data: scopeForUser(data, { id: user.id, employeeId: user.employee_id, email: user.email, role: user.role as Role }),
  });
}
