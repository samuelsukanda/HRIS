import { loadHrisData } from "@/lib/server/state";

/** Data publik untuk layar login (tanpa sesi): struktur org + akun demo (tanpa PII). */
export async function GET() {
  const d = await loadHrisData();
  return Response.json({
    branches: d.branches,
    departments: d.departments,
    positions: d.positions,
    banks: d.banks,
    shifts: d.shifts,
    leaveTypes: d.leaveTypes,
    announcements: d.announcements.filter((a) => !a.branchId),
  });
}
