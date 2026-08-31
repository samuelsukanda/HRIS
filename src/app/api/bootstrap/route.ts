import { loadHrisData } from "@/lib/server/state";

/** Data publik untuk layar login (tanpa sesi): daftar akun demo & struktur org. */
export async function GET() {
  const d = await loadHrisData();
  return Response.json({
    users: d.users,
    employees: d.employees,
    branches: d.branches,
    departments: d.departments,
    positions: d.positions,
    workLocations: d.workLocations,
    shifts: d.shifts,
    leaveTypes: d.leaveTypes,
    announcements: d.announcements,
  });
}
