import { pool } from "@/db/client";
import type {
  Announcement,
  ApprovalEntry,
  Asset,
  AssetAssignment,
  AssetRequest,
  AttendanceRecord,
  AuditLogEntry,
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
    usersR, branchesR, departmentsR, positionsR, locationsR, employeesR, shiftsR,
    rosterR, attendanceR, leaveTypesR, leaveReqR, otReqR, logsR, annsR,
    reimbR, jpR, candR, trainR, enrollR, assetR, assignR, revR, notifR,
    swapR, assetReqR, settingsR,
  ] = await Promise.all([
    pool.query(`SELECT * FROM users`),
    pool.query(`SELECT * FROM branches ORDER BY id`),
    pool.query(`SELECT * FROM departments ORDER BY id`),
    pool.query(`SELECT * FROM positions ORDER BY id`),
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
    departmentId: r.department_id, positionId: r.position_id, managerId: r.manager_id ?? undefined,
    branchId: r.branch_id, workLocationId: r.work_location_id,
    employmentType: r.employment_type, status: r.status,
    bankName: r.bank_name, bankAccount: r.bank_account,
    emergencyContact: r.emergency_contact,
    faceRegistered: r.face_registered,
    baseSalary: r.base_salary ?? undefined,
    allowance: r.allowance ?? undefined,
  }));

  const users: User[] = usersR.rows.map((r) => ({
    id: r.id, employeeId: r.employee_id, email: r.email, role: r.role as Role,
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
    })),
    assetAssignments: assignR.rows.map((r): AssetAssignment => ({
      id: r.id, assetId: r.asset_id, employeeId: r.employee_id,
      assignedAt: iso(r.assigned_at)!, returnedAt: iso(r.returned_at),
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

/** Karyawan hanya melihat data miliknya; role lain melihat penuh. */
export function scopeForUser(data: HrisData, user: User | null): HrisData {
  if (!user || user.role !== "employee") return data;
  const own = <T extends { employeeId: string }>(arr: T[]) => arr.filter((x) => x.employeeId === user.employeeId);
  return {
    ...data,
    // direktori minimal: tanpa NIK/gaji/bank/kontak/wajah
    users: data.users.map((x) => ({ ...x, email: x.id === user.id ? x.email : "" })),
    employees: data.employees
      .map((e) => (e.id === user.employeeId
        ? e
        : { ...e, nik: "", phone: "", email: "", address: "", baseSalary: undefined, allowance: undefined, bankName: "", bankAccount: "", emergencyContact: { name: "", relation: "", phone: "" }, faceRegistered: false })),
    // roster & kandidat bukan konsumsi employee
    roster: [],
    candidates: [],
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
    auditLogs: [],
  };
}

export async function writeAudit(entry: Omit<AuditLogEntry, "id">) {
  const n = await pool.query(`SELECT COUNT(*)::int AS c FROM audit_logs`);
  const id = `LOG-${String(n.rows[0].c + 1).padStart(3, "0")}`;
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
    "branches", "departments", "positions", "leave_types",
    "shift_swaps", "asset_requests", "settings"
  ];
  if (!allowed.includes(table)) throw new Error("Invalid table name: " + table);
  // kunci advisory per-tabel dalam transaksi agar concurrent POST tak dapat ID sama
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [table]);
    const r = await client.query(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`);
    let nextNum = 1;
    if (r.rows.length > 0) {
      const lastId = String(r.rows[0].id);
      const m = lastId.match(/(\d+)\s*$/);
      nextNum = (m ? parseInt(m[1], 10) : 0) + 1 || 1;
    }
    await client.query("COMMIT");
    return `${prefix}-${String(nextNum).padStart(3, "0")}`;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function writeNotification(notif: { userId: string; title: string; body: string; type: "approval" | "info" | "reminder"; link?: string }) {
  const id = await nextId("notifications", "NTF");
  await pool.query(
    `INSERT INTO notifications (id,user_id,title,body,type,read,created_at,link)
     VALUES ($1,$2,$3,$4,$5,false,NOW(),$6)`,
    [id, notif.userId, notif.title, notif.body, notif.type, notif.link ?? null]
  );
}
