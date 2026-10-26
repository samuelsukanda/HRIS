import { describe, expect, it } from "vitest";
import { canApproveEmployee, canManageAccount, canManageEmployee, isActiveEmployeeStatus } from "@/lib/server/access";

const actor = (role: "super_admin" | "hr" | "manager" | "supervisor" | "employee", branchId = "BR-JKT") => ({
  id: `USR-${role}`,
  employeeId: `EMP-${role}`,
  role,
  branchId,
});

const employee = (id: string, branchId: string, spvId?: string, managerId?: string) => ({
  id,
  branchId,
  spvId,
  managerId,
});

describe("access scope", () => {
  it("allows super admins to manage every employee and account", () => {
    expect(canManageEmployee(actor("super_admin"), employee("EMP-1", "BR-SBG"))).toBe(true);
    expect(canManageAccount(actor("super_admin"), { role: "hr", employeeId: "EMP-1" }, "BR-SBG")).toBe(true);
  });

  it("limits HR accounts to their branch and protects super admins", () => {
    expect(canManageEmployee(actor("hr"), employee("EMP-1", "BR-JKT"))).toBe(true);
    expect(canManageEmployee(actor("hr"), employee("EMP-2", "BR-SBG"))).toBe(false);
    expect(canManageAccount(actor("hr"), { role: "employee", employeeId: "EMP-1" }, "BR-JKT")).toBe(true);
    expect(canManageAccount(actor("hr"), { role: "employee", employeeId: "EMP-2" }, "BR-SBG")).toBe(false);
    expect(canManageAccount(actor("hr"), { role: "super_admin", employeeId: "EMP-1" }, "BR-JKT")).toBe(false);
  });

  it("blocks HR from managing linked super-admin employees while preserving super-admin authority", () => {
    const target = { ...employee("EMP-ADMIN", "BR-JKT"), isSuperAdmin: true };
    expect(canManageEmployee(actor("hr"), target)).toBe(false);
    expect(canManageEmployee(actor("super_admin"), target)).toBe(true);
  });

  it("limits managers and supervisors to direct reports", () => {
    expect(canManageEmployee(actor("manager"), employee("EMP-1", "BR-JKT", "EMP-manager", "EMP-manager"))).toBe(true);
    expect(canManageEmployee(actor("supervisor"), employee("EMP-1", "BR-JKT", "EMP-supervisor", "EMP-manager"))).toBe(true);
    expect(canManageEmployee(actor("manager"), employee("EMP-2", "BR-JKT", "EMP-other", "EMP-other-manager"))).toBe(false);
  });

  it("treats inactive and resigned employees as blocked", () => {
    expect(isActiveEmployeeStatus("active")).toBe(true);
    expect(isActiveEmployeeStatus("on_leave")).toBe(true);
    expect(isActiveEmployeeStatus("inactive")).toBe(false);
    expect(isActiveEmployeeStatus("resigned")).toBe(false);
  });

  it("requires the stage role, branch, and exact hierarchy match", () => {
    const target = employee("EMP-1", "BR-JKT", "EMP-supervisor", "EMP-manager");
    expect(canApproveEmployee(actor("supervisor"), target, "supervisor")).toBe(true);
    expect(canApproveEmployee(actor("manager"), target, "manager")).toBe(true);
    expect(canApproveEmployee(actor("manager"), target, "supervisor")).toBe(false);
    expect(canApproveEmployee(actor("supervisor", "BR-SBG"), target, "supervisor")).toBe(false);
    expect(canApproveEmployee(actor("supervisor"), { ...target, spvId: "EMP-other" }, "supervisor")).toBe(false);
  });

  it("blocks self approval and keeps super-admin approval global", () => {
    const target = employee("EMP-1", "BR-JKT", "EMP-supervisor", "EMP-manager");
    expect(canApproveEmployee(actor("supervisor"), { ...target, id: "EMP-supervisor", spvId: "EMP-supervisor" }, "supervisor")).toBe(false);
    expect(canApproveEmployee(actor("super_admin", "BR-SBG"), { ...target, branchId: "BR-JKT" }, "manager")).toBe(true);
  });
});
