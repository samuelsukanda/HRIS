import type { PresenceState, Role } from "@/lib/types";

export interface AccessActor {
  id: string;
  employeeId: string;
  role: Role;
  branchId?: string | null;
}

export interface AccessEmployee {
  id: string;
  branchId: string;
  spvId?: string | null;
  managerId?: string | null;
  isSuperAdmin?: boolean;
}

export function canManageEmployee(actor: AccessActor, target: AccessEmployee): boolean {
  if (actor.role === "super_admin") return true;
  if (target.isSuperAdmin) return false;
  if (actor.role === "hr") return Boolean(actor.branchId && actor.branchId === target.branchId);
  if (actor.role === "manager" || actor.role === "supervisor") {
    return target.id === actor.employeeId || target.spvId === actor.employeeId || target.managerId === actor.employeeId;
  }
  return target.id === actor.employeeId;
}

export type ApprovalStage = "supervisor" | "manager";

export function canApproveEmployee(actor: AccessActor, target: AccessEmployee, stage: ApprovalStage): boolean {
  if (target.id === actor.employeeId) return false;
  if (actor.role === "super_admin") return true;
  if (actor.branchId !== target.branchId) return false;
  if (stage === "supervisor") return actor.role === "supervisor" && target.spvId === actor.employeeId;
  return actor.role === "manager" && target.managerId === actor.employeeId;
}

export function canManageAccount(
  actor: AccessActor,
  target: { role: Role; employeeId: string },
  targetBranchId?: string | null,
): boolean {
  if (target.role === "super_admin") return actor.role === "super_admin";
  if (actor.role === "super_admin") return true;
  return actor.role === "hr" && Boolean(actor.branchId && actor.branchId === targetBranchId);
}

export function isActiveEmployeeStatus(status: PresenceState | string): boolean {
  return status === "active" || status === "on_leave";
}
