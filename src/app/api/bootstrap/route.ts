import { loadHrisData } from "@/lib/server/state";

/** Data publik untuk layar login (tanpa sesi): struktur org + akun demo (tanpa PII). */
export async function GET() {
  const d = await loadHrisData();
  return Response.json({
    users: d.users.map((u) => ({ id: u.id, email: u.email, role: u.role })),
    employees: d.employees.map((e) => ({
      id: e.id, name: e.name, departmentId: e.departmentId, positionId: e.positionId,
      branchId: e.branchId, status: e.status,
    })),
    branches: d.branches,
    departments: d.departments,
    positions: d.positions,
    workLocations: d.workLocations,
    shifts: d.shifts,
    leaveTypes: d.leaveTypes,
    announcements: d.announcements,
  });
}
