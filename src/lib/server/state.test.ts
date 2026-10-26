import { describe, expect, it, vi } from "vitest";
import { scopeForUser } from "@/lib/server/state";
import type { Employee, HrisData } from "@/lib/types";

vi.mock("@/db/client", () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const employee = (id: string, branchId: string, nik: string): Employee => ({
  id,
  nik,
  name: id,
  gender: "L",
  birthPlace: "Jakarta",
  birthDate: "1990-01-01",
  address: "Jl. Test",
  phone: "08123456789",
  email: `${id.toLowerCase()}@example.com`,
  joinDate: "2020-01-01",
  departmentId: "DP-JKT",
  positionId: "PS-EMP",
  branchId,
  workLocationId: "WL-JKT",
  employmentType: "permanent",
  status: "active",
  bankName: "BCA",
  bankAccount: "123",
  emergencyContact: { name: "Test", relation: "Keluarga", phone: "08987654321" },
  faceRegistered: true,
  baseSalary: 5000000,
  allowance: 500000,
});

const data: HrisData = {
  users: [],
  branches: [{ id: "BR-JKT", name: "Jakarta", city: "Jakarta" }, { id: "BR-SBG", name: "Subang", city: "Subang" }],
  departments: [],
  positions: [],
  banks: [],
  workLocations: [],
  employees: [employee("EMP-1", "BR-JKT", "111"), employee("EMP-2", "BR-JKT", "222"), employee("EMP-3", "BR-SBG", "333")],
  shifts: [],
  roster: [],
  attendance: [],
  leaveTypes: [],
  leaveRequests: [],
  overtimeRequests: [],
  auditLogs: [],
  announcements: [],
  reimbursements: [],
  jobPostings: [],
  candidates: [],
  trainings: [],
  trainingEnrollments: [],
  assets: [],
  assetAssignments: [],
  performanceReviews: [],
  notifications: [],
  shiftSwaps: [{ id: "SW-1", employeeId: "EMP-1", date: "2026-01-01", fromShiftId: null, targetShiftId: "S-PAGI", reason: "", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" }],
  assetRequests: [{ id: "AR-1", employeeId: "EMP-1", category: "laptop", description: "Test", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" }],
  settings: {},
};

describe("employee state projection", () => {
  it("keeps the employee record full, limits the directory to its branch, and includes own requests", () => {
    const result = scopeForUser(data, { id: "USR-1", employeeId: "EMP-1", email: "emp-1@example.com", role: "employee" });

    expect(result.employees.map((e) => e.id)).toEqual(["EMP-1", "EMP-2"]);
    expect(result.employees[0]).toEqual(data.employees[0]);
    expect(result.employees[1].email).toBe("");
    expect(result.shiftSwaps).toEqual([data.shiftSwaps[0]]);
    expect(result.assetRequests).toEqual([data.assetRequests[0]]);
  });
});
