import { pool } from "@/db/client";
import type {
  Announcement,
  ApprovalEntry,
  Asset,
  AssetAssignment,
  AssetRequest,
  AttendanceRecord,
  AuditLogEntry,
  Bank,
  Branch,
  Candidate,
  Department,
  Employee,
  HrisData,
  JobPosting,
  LeaveRequest,
  LeaveType,
  Notification,
  OvertimeRequest,
  PerformanceReview,
  Position,
  Reimbursement,
  Role,
  RosterEntry,
  Shift,
  ShiftSwap,
  Training,
  TrainingEnrollment,
  User,
  WorkLocation,
} from "../types";

const iso = (v: Date | string | null): string | undefined =>
  v ? (typeof v === "string" ? v : v.toISOString()) : undefined;

// kolom DATE pg dibaca tengah malam lokal — toISOString (UTC) menggeser -1 hari di WIB,
// jadi format dari komponen lokal, bukan UTC
function isoDate(v: Date | string | null): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (!v) return "";
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, "0");
  const dd = String(v.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function loadHrisData(): Promise<HrisData> {
  const [
    usersR, branchesR, departmentsR, positionsR, banksR, locationsR, employeesR, shiftsR,
    rosterR, attendanceR, leaveTypesR, leaveReqR, otReqR, logsR, annsR,
    reimbR, jpR, candR, trainR, enrollR, assetR, assignR, revR, notifR,
    swapR, assetReqR, settingsR,
  ] = await Promise.all([
    pool.query(`SELECT * FROM users`),
    pool.query(`SELECT * FROM branches ORDER BY id`),
    pool.query(`SELECT * FROM departments ORDER BY id`),
    pool.query(`SELECT * FROM positions ORDER BY id`),
    pool.query(`SELECT * FROM banks ORDER BY name`),
    pool.query(`SELECT * FROM work_locations ORDER BY id`),
    pool.query(`SELECT * FROM employees ORDER BY id`),
    pool.query(`SELECT * FROM shifts ORDER BY id`),
    pool.query(`SELECT * FROM roster ORDER BY date, employee_id`),
    pool.query(`SELECT * FROM attendance ORDER BY date DESC, id`),
    pool.query(`SELECT * FROM leave_types ORDER BY id`),
    pool.query(`SELECT * FROM leave_requests ORDER BY submitted_at DESC`),
    pool.query(`SELECT * FROM overtime_requests ORDER BY submitted_at DESC`),
    pool.query(`SELECT * FROM audit_logs ORDER BY at DESC`),
    pool.query(`SELECT * FROM announcements ORDER BY date DESC`),
    pool.query(`SELECT * FROM reimbursements ORDER BY submitted_at DESC`),
    pool.query(`SELECT * FROM job_postings ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM candidates ORDER BY applied_at DESC`),
    pool.query(`SELECT * FROM trainings ORDER BY start_date DESC`),
    pool.query(`SELECT * FROM training_enrollments ORDER BY enrolled_at DESC`),
    pool.query(`SELECT * FROM assets ORDER BY id`),
    pool.query(`SELECT * FROM asset_assignments ORDER BY assigned_at DESC`),
    pool.query(`SELECT * FROM performance_reviews ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM notifications ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM shift_swaps ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM asset_requests ORDER BY created_at DESC`),
    pool.query(`SELECT * FROM settings`),
  ]);

  const employees: Employee[] = employeesR.rows.map((r) => ({
    id: r.id, nik: r.nik, name: r.name, gender: r.gender,
    birthPlace: r.birth_place, birthDate: isoDate(r.birth_date),
    address: r.address, phone: r.phone, email: r.email, joinDate: isoDate(r.join_date),
    departmentId: r.department_id, positionId: r.position_id, spvId: r.spv_id ?? undefined, managerId: r.manager_id ?? undefined,
    branchId: r.branch_id, workLocationId: r.work_location_id,
    employmentType: r.employment_type, status: r.status,
    bankName: r.bank_name, bankAccount: r.bank_account,
    emergencyContact: r.emergency_contact,
    faceRegistered: r.face_registered,
    photoUrl: r.photo_url ?? undefined,
    baseSalary: r.base_salary ?? undefined,
    allowance: r.allowance ?? undefined,
  }));

  const users: User[] = usersR.rows.map((r) => ({
    id: r.id, employeeId: r.employee_id, email: r.email, role: r.role as Role, active: r.active ?? true,
  }));

  const attendance: AttendanceRecord[] = attendanceR.rows.map((r) => ({
    id: r.id, employeeId: r.employee_id, date: isoDate(r.date),
    checkInAt: iso(r.check_in_at), checkOutAt: iso(r.check_out_at),
    checkInSnap: r.check_in_snap ?? undefined, checkOutSnap: r.check_out_snap ?? undefined,
    status: r.status, riskScore: r.risk_score, verificationStatus: r.verification_status,
    rejectionReason: r.rejection_reason ?? undefined, corrections: r.corrections ?? [],
  }));

  return {
    users,
    branches: branchesR.rows as Branch[],
    departments: departmentsR.rows.map((r): Department => ({ id: r.id, name: r.name, branchId: r.branch_id })),
    positions: positionsR.rows as Position[],
    banks: banksR.rows as Bank[],
    workLocations: locationsR.rows.map((r): WorkLocation => ({
      id: r.id, name: r.name, branchId: r.branch_id,
      latitude: r.latitude, longitude: r.longitude, radiusM: r.radius_m,
      allowedTypes: r.allowed_types,
    })),
    employees,
    shifts: shiftsR.rows.map((r): Shift => ({
      id: r.id, name: r.name, start: r.start_time, end: r.end_time,
      graceMinutes: r.grace_minutes, crossesMidnight: r.crosses_midnight,
    })),
    roster: rosterR.rows.map((r): RosterEntry => ({
      employeeId: r.employee_id, date: isoDate(r.date), shiftId: r.shift_id, id: `${r.employee_id}-${iso(r.date)!.slice(0,10)}`,
    })),
    attendance,
    leaveTypes: leaveTypesR.rows.map((r): LeaveType => ({
      id: r.id, name: r.name, allocationDays: r.allocation_days,
      paid: r.paid, requiresAttachment: r.requires_attachment,
    })),
    leaveRequests: leaveReqR.rows.map((r): LeaveRequest => ({
      id: r.id, employeeId: r.employee_id, typeId: r.type_id,
      startDate: isoDate(r.start_date), endDate: isoDate(r.end_date),
      days: r.days, reason: r.reason, status: r.status,
      submittedAt: iso(r.submitted_at)!, decidedBy: r.decided_by ?? undefined, decidedAt: iso(r.decided_at),
      attachmentUrl: r.attachment_url ?? undefined,
    })),
    overtimeRequests: otReqR.rows.map((r): OvertimeRequest => ({
      id: r.id, employeeId: r.employee_id, date: isoDate(r.date),
      start: r.start_time, end: r.end_time, hours: Number(r.hours), reason: r.reason,
      status: r.status, submittedAt: iso(r.submitted_at)!, decidedBy: r.decided_by ?? undefined,
    })),
    auditLogs: logsR.rows.map((r): AuditLogEntry => ({
      id: r.id, actorId: r.actor_id, actorName: r.actor_name, action: r.action,
      targetType: r.target_type, targetId: r.target_id, detail: r.detail,
      before: r.before ?? undefined, after: r.after ?? undefined, at: iso(r.at)!,
    })),
    announcements: annsR.rows.map((r): Announcement => ({
      id: r.id, title: r.title, body: r.body, category: r.category, date: isoDate(r.date),
      branchId: r.branch_id ?? undefined,
    })),
    reimbursements: reimbR.rows.map((r): Reimbursement => ({
      id: r.id, employeeId: r.employee_id, category: r.category, amount: r.amount,
      description: r.description, status: r.status, submittedAt: iso(r.submitted_at)!,
      approvals: (r.approvals ?? []) as ApprovalEntry[],
      attachmentUrl: r.attachment_url ?? undefined,
    })),
    jobPostings: jpR.rows.map((r): JobPosting => ({
      id: r.id, title: r.title, departmentId: r.department_id, description: r.description,
      requirements: r.requirements, salaryRange: r.salary_range, status: r.status,
      createdAt: iso(r.created_at)!,
    })),
    candidates: candR.rows.map((r): Candidate => ({
      id: r.id, jobPostingId: r.job_posting_id, name: r.name, email: r.email,
      phone: r.phone, status: r.status, appliedAt: iso(r.applied_at)!, notes: r.notes ?? undefined,
    })),
    trainings: trainR.rows.map((r): Training => ({
      id: r.id, title: r.title, provider: r.provider, description: r.description,
      startDate: isoDate(r.start_date), endDate: isoDate(r.end_date),
      maxParticipants: r.max_participants, status: r.status,
      branchId: r.branch_id ?? undefined,
    })),
    trainingEnrollments: enrollR.rows.map((r): TrainingEnrollment => ({
      id: r.id, trainingId: r.training_id, employeeId: r.employee_id,
      status: r.status, enrolledAt: iso(r.enrolled_at)!,
    })),
    assets: assetR.rows.map((r): Asset => ({
      id: r.id, name: r.name, category: r.category, serialNumber: r.serial_number,
      purchaseDate: isoDate(r.purchase_date), status: r.status,
      brand: r.brand ?? undefined, model: r.model ?? undefined,
      purchasePrice: r.purchase_price ?? undefined, notes: r.notes ?? undefined,
      branchId: r.branch_id ?? undefined,
    })),
    assetAssignments: assignR.rows.map((r): AssetAssignment => ({
      id: r.id, assetId: r.asset_id, employeeId: r.employee_id,
      assignedAt: iso(r.assigned_at)!, returnedAt: iso(r.returned_at),
      returnRequestedAt: iso(r.return_requested_at),
    })),
    performanceReviews: revR.rows.map((r): PerformanceReview => ({
      id: r.id, employeeId: r.employee_id, reviewerId: r.reviewer_id, period: r.period,
      score: r.score, strengths: r.strengths, improvements: r.improvements,
      goals: r.goals, status: r.status, createdAt: iso(r.created_at)!,
    })),
    notifications: notifR.rows.map((r): Notification => ({
      id: r.id, userId: r.user_id, title: r.title, body: r.body, type: r.type,
      read: r.read, createdAt: iso(r.created_at)!, link: r.link ?? undefined,
    })),
    shiftSwaps: swapR.rows.map((r): ShiftSwap => ({
      id: r.id, employeeId: r.employee_id, date: isoDate(r.date),
      fromShiftId: r.from_shift_id ?? null, targetShiftId: r.target_shift_id ?? null,
      reason: r.reason ?? "", status: r.status, decidedBy: r.decided_by ?? undefined,
      createdAt: iso(r.created_at)!,
    })),
    assetRequests: assetReqR.rows.map((r): AssetRequest => ({
      id: r.id, employeeId: r.employee_id, category: r.category,
      description: r.description, status: r.status, decidedBy: r.decided_by ?? undefined,
      createdAt: iso(r.created_at)!,
    })),
    settings: Object.fromEntries(settingsR.rows.map((r) => [r.key, r.value] as [string, string])),
  };
}

/** Konten cabang: null = seluruh perusahaan; selain itu hanya terlihat di cabangnya. */
function visibleInBranch<T extends { branchId?: string }>(arr: T[], branchId: string | undefined | null): T[] {
  return arr.filter((x) => !x.branchId || !branchId || x.branchId === branchId);
}

function emptyProjection(data: HrisData): HrisData {
  return {
    users: [], branches: [], departments: [], positions: data.positions, banks: data.banks, workLocations: [], employees: [], shifts: data.shifts,
    roster: [], attendance: [], leaveTypes: data.leaveTypes, leaveRequests: [], overtimeRequests: [], auditLogs: [], announcements: [],
    reimbursements: [], jobPostings: [], candidates: [], trainings: [], trainingEnrollments: [], assets: [],
    assetAssignments: [], performanceReviews: [], notifications: [], shiftSwaps: [], assetRequests: [], settings: data.settings,
  };
}

function sanitizeEmployee(employee: Employee, own: boolean): Employee {
  if (own) return employee;
  return {
    ...employee,
    nik: "", phone: "", email: "", address: "", baseSalary: undefined, allowance: undefined,
    bankName: "", bankAccount: "", emergencyContact: { name: "", relation: "", phone: "" }, faceRegistered: false,
  };
}

function scopedUsers(data: HrisData, employeeIds: Set<string>, ownUserId: string, revealEmail: boolean): User[] {
  return data.users
    .filter((user) => employeeIds.has(user.employeeId))
    .map((user) => ({ ...user, email: revealEmail || user.id === ownUserId ? user.email : "" }));
}

/** Notifikasi ke semua user aktif di cabang (HR + karyawan); branchId null = seluruh perusahaan. */
export async function notifySameBranch(
  branchId: string | null,
  excludeUserId: string,
  n: { title: string; body: string; type: "approval" | "info" | "reminder"; link?: string },
) {
  const r = branchId
    ? await pool.query(
        `SELECT DISTINCT u.id FROM users u
         JOIN employees e ON e.id = u.employee_id
         WHERE u.active = true AND u.role <> 'super_admin' AND e.branch_id = $1 AND u.id <> $2`,
        [branchId, excludeUserId],
      )
    : await pool.query(`SELECT id FROM users WHERE active = true AND role <> 'super_admin' AND id <> $1`, [excludeUserId]);
  for (const row of r.rows) await writeNotification({ userId: row.id, ...n });
}

/** Karyawan hanya melihat data miliknya; manager/supervisor hanya timnya; hr hanya cabangnya. */
export function scopeForUser(data: HrisData, user: User | null): HrisData {
  const base = emptyProjection(data);
  if (!user) return base;
  if (user.role === "super_admin") return { ...data, notifications: [] };

  if (user.role === "employee") {
    const own = <T extends { employeeId: string }>(arr: T[]) => arr.filter((x) => x.employeeId === user.employeeId);
    const meEmp = data.employees.find((e) => e.id === user.employeeId);
    if (!meEmp) return base;
    const branchId = meEmp.branchId;
    const visibleJobs = data.jobPostings.filter((j) => {
      const dept = data.departments.find((d) => d.id === j.departmentId);
      return !dept?.branchId || dept.branchId === branchId;
    });
    return {
      ...base,
      users: data.users.filter((u) => u.id === user.id),
      branches: data.branches.filter((b) => b.id === branchId),
      departments: data.departments.filter((d) => d.branchId === branchId),
      positions: data.positions,
      banks: data.banks,
      workLocations: data.workLocations.filter((w) => w.branchId === branchId),
      employees: data.employees.filter((e) => e.branchId === branchId).map((e) => sanitizeEmployee(e, e.id === user.employeeId)),
      shifts: data.shifts,
      leaveTypes: data.leaveTypes,
      roster: own(data.roster),
      attendance: own(data.attendance),
      leaveRequests: own(data.leaveRequests),
      overtimeRequests: own(data.overtimeRequests),
      reimbursements: own(data.reimbursements),
      trainingEnrollments: own(data.trainingEnrollments),
      assetAssignments: own(data.assetAssignments),
      performanceReviews: own(data.performanceReviews),
      shiftSwaps: own(data.shiftSwaps),
      assetRequests: own(data.assetRequests),
      notifications: data.notifications.filter((n) => n.userId === user.id),
      announcements: visibleInBranch(data.announcements, branchId),
      trainings: visibleInBranch(data.trainings, branchId),
      assets: visibleInBranch(data.assets, branchId),
      jobPostings: visibleJobs,
    };
  }

  if (user.role === "hr" || user.role === "manager" || user.role === "supervisor") {
    const me = data.employees.find((e) => e.id === user.employeeId);
    if (!me) return base;
    const allowed = new Set<string>();
    if (user.role === "hr") {
      for (const e of data.employees) if (e.branchId === me.branchId) allowed.add(e.id);
    } else {
      for (const e of data.employees) {
        if (e.branchId === me.branchId && (e.spvId === user.employeeId || e.managerId === user.employeeId || e.id === user.employeeId)) allowed.add(e.id);
      }
    }
    const inScope = <T extends { employeeId: string }>(arr: T[]) => arr.filter((x) => allowed.has(x.employeeId));
    const branchId = me.branchId;
    const deptIds = new Set(data.departments.filter((d) => d.branchId === branchId).map((d) => d.id));
    const visibleJobs = data.jobPostings.filter((j) => deptIds.has(j.departmentId));
    const visibleJobIds = new Set(visibleJobs.map((j) => j.id));
    const visibleEmployees = data.employees.filter((e) => allowed.has(e.id)).map((e) => sanitizeEmployee(e, user.role === "hr" || e.id === user.employeeId));
    return {
      ...base,
      users: scopedUsers(data, allowed, user.id, user.role === "hr"),
      branches: data.branches.filter((b) => b.id === branchId),
      departments: data.departments.filter((d) => d.branchId === branchId),
      positions: data.positions,
      banks: data.banks,
      workLocations: data.workLocations.filter((w) => w.branchId === branchId),
      employees: visibleEmployees,
      shifts: data.shifts,
      leaveTypes: data.leaveTypes,
      roster: inScope(data.roster),
      attendance: inScope(data.attendance),
      leaveRequests: inScope(data.leaveRequests),
      overtimeRequests: inScope(data.overtimeRequests),
      shiftSwaps: inScope(data.shiftSwaps),
      reimbursements: inScope(data.reimbursements),
      trainingEnrollments: inScope(data.trainingEnrollments),
      assetAssignments: inScope(data.assetAssignments),
      performanceReviews: inScope(data.performanceReviews),
      notifications: data.notifications.filter((n) => n.userId === user.id),
      announcements: visibleInBranch(data.announcements, branchId),
      trainings: visibleInBranch(data.trainings, branchId),
      assets: visibleInBranch(data.assets, branchId),
      jobPostings: visibleJobs,
      candidates: data.candidates.filter((c) => visibleJobIds.has(c.jobPostingId)),
      assetRequests: inScope(data.assetRequests),
    };
  }

  return base;
}

export async function writeAudit(entry: Omit<AuditLogEntry, "id">) {
  const id = await nextId("audit_logs", "LOG");
  await pool.query(
    `INSERT INTO audit_logs (id,actor_id,actor_name,action,target_type,target_id,detail,"before","after",at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, entry.actorId, entry.actorName, entry.action, entry.targetType, entry.targetId, entry.detail, entry.before ?? null, entry.after ?? null, new Date(entry.at)],
  );
}

export async function nextId(table: string, prefix: string): Promise<string> {
  const allowed = [
    "employees", "users", "work_locations", "shifts", "roster", "job_postings",
    "candidates", "trainings", "training_enrollments", "assets", "asset_assignments",
    "performance_reviews", "notifications", "announcements", "leave_requests",
    "overtime_requests", "reimbursements", "audit_logs",
    "branches", "departments", "positions", "leave_types", "banks",
    "shift_swaps", "asset_requests", "settings"
  ];
  if (!allowed.includes(table)) throw new Error("Invalid table name: " + table);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO id_counters (table_name,next_num) VALUES ($1,1) ON CONFLICT (table_name) DO NOTHING`, [table]);
    const counter = await client.query(`SELECT next_num FROM id_counters WHERE table_name=$1 FOR UPDATE`, [table]);
    const r = await client.query(`SELECT id FROM ${table}`);
    let maxNum = 0;
    for (const row of r.rows) {
      const match = String(row.id).match(/(\d+)\s*$/);
      if (match) maxNum = Math.max(maxNum, Number(match[1]));
    }
    const nextNum = Math.max(Number(counter.rows[0]?.next_num ?? 1), maxNum + 1);
    await client.query(`UPDATE id_counters SET next_num=$1 WHERE table_name=$2`, [nextNum + 1, table]);
    await client.query("COMMIT");
    return `${prefix}-${String(nextNum).padStart(3, "0")}`;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function writeNotification(notif: { userId: string; title: string; body: string; type: "approval" | "info" | "reminder"; link?: string }) {
  const recipient = await pool.query(`SELECT role FROM users WHERE id = $1`, [notif.userId]);
  if (recipient.rows[0]?.role === "super_admin") return;
  const id = await nextId("notifications", "NTF");
  await pool.query(
    `INSERT INTO notifications (id,user_id,title,body,type,read,created_at,link)
     VALUES ($1,$2,$3,$4,$5,false,NOW(),$6)`,
    [id, notif.userId, notif.title, notif.body, notif.type, notif.link ?? null]
  );
}
