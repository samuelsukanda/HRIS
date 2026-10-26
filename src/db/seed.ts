import { applySchema, pool } from "./client";
import { hashPassword } from "../lib/server/auth";
import { seedData } from "../lib/data";

const DEMO_PASSWORD = "demo1234";

async function main() {
  await applySchema();
  const d = seedData();

  const q = async (text: string, values?: unknown[]) => pool.query(text, values);

  await q(`TRUNCATE payslips, payroll_runs, attendance, roster, leave_requests, overtime_requests,
    audit_logs, announcements, notifications, reimbursements, candidates, training_enrollments,
    asset_assignments, performance_reviews, assets, trainings, job_postings, shift_swaps, asset_requests,
    users, employees, shifts, work_locations, departments, positions,
    branches, leave_types, banks, upload_records, id_counters RESTART IDENTITY CASCADE`);

  for (const b of d.branches)
    await q(`INSERT INTO branches (id,name,city) VALUES ($1,$2,$3)`, [b.id, b.name, b.city]);

  for (const dep of d.departments)
    await q(`INSERT INTO departments (id,name,branch_id) VALUES ($1,$2,$3)`, [dep.id, dep.name, dep.branchId]);

  for (const p of d.positions)
    await q(`INSERT INTO positions (id,title,level) VALUES ($1,$2,$3)`, [p.id, p.title, p.level]);

  for (const b of d.banks)
    await q(`INSERT INTO banks (id,name) VALUES ($1,$2)`, [b.id, b.name]);

  for (const w of d.workLocations)
    await q(
      `INSERT INTO work_locations (id,name,branch_id,latitude,longitude,radius_m,allowed_types)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [w.id, w.name, w.branchId, w.latitude, w.longitude, w.radiusM, w.allowedTypes],
    );

  // Gaji dasar sederhana berdasarkan level posisi — untuk Fase D
  const levelSalary: Record<string, [number, number]> = {
    director: [45_000_000, 12_000_000],
    manager: [22_000_000, 6_000_000],
    supervisor: [12_000_000, 3_000_000],
    staff: [6_500_000, 1_200_000],
    nurse: [7_000_000, 1_400_000],
    technician: [6_000_000, 1_100_000],
    admin: [5_500_000, 900_000],
  };

  const positionLevel = new Map((d.positions).map((p) => [p.id, p.level.toLowerCase()]));

  for (const e of d.employees) {
    const level = positionLevel.get(e.positionId) ?? "staff";
    const [base, allowance] = levelSalary[level] ?? levelSalary.staff;
    await q(
      `INSERT INTO employees (id,nik,name,gender,birth_place,birth_date,address,phone,email,join_date,
        department_id,position_id,spv_id,manager_id,branch_id,work_location_id,employment_type,status,
        bank_name,bank_account,emergency_contact,face_registered,face_descriptor,base_salary,allowance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [
        e.id, e.nik, e.name, e.gender, e.birthPlace, e.birthDate, e.address, e.phone, e.email,
        e.joinDate, e.departmentId, e.positionId, e.spvId ?? null, e.managerId ?? null, e.branchId, e.workLocationId,
        e.employmentType, e.status, e.bankName, e.bankAccount, JSON.stringify(e.emergencyContact),
        e.faceRegistered, null, base, allowance,
      ],
    );
  }

  for (const u of d.users)
    await q(`INSERT INTO users (id,employee_id,email,role,password_hash) VALUES ($1,$2,$3,$4,$5)`, [
      u.id, u.employeeId, u.email, u.role, hashPassword(DEMO_PASSWORD),
    ]);

  for (const s of d.shifts)
    await q(`INSERT INTO shifts (id,name,start_time,end_time,grace_minutes,crosses_midnight) VALUES ($1,$2,$3,$4,$5,$6)`, [
      s.id, s.name, s.start, s.end, s.graceMinutes, s.crossesMidnight,
    ]);

  for (const r of d.roster)
    await q(`INSERT INTO roster (employee_id,date,shift_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [
      r.employeeId, r.date, r.shiftId,
    ]);

  for (const a of d.attendance) {
    const snap = a.checkInSnap ? JSON.stringify(a.checkInSnap) : null;
    const out = a.checkOutSnap ? JSON.stringify(a.checkOutSnap) : null;
    await q(
      `INSERT INTO attendance (id,employee_id,date,check_in_at,check_out_at,check_in_snap,check_out_snap,
        status,risk_score,verification_status,rejection_reason,corrections)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        a.id, a.employeeId, a.date,
        a.checkInAt ? new Date(a.checkInAt) : null,
        a.checkOutAt ? new Date(a.checkOutAt) : null,
        snap, out, a.status, a.riskScore, a.verificationStatus, a.rejectionReason ?? null,
        JSON.stringify(a.corrections),
      ],
    );
  }

  for (const l of d.leaveTypes)
    await q(`INSERT INTO leave_types (id,name,allocation_days,paid,requires_attachment) VALUES ($1,$2,$3,$4,$5)`, [
      l.id, l.name, l.allocationDays, l.paid, l.requiresAttachment,
    ]);

  for (const r of d.leaveRequests)
    await q(
      `INSERT INTO leave_requests (id,employee_id,type_id,start_date,end_date,days,reason,status,submitted_at,decided_by,decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        r.id, r.employeeId, r.typeId, r.startDate, r.endDate, r.days, r.reason, r.status,
        new Date(r.submittedAt), r.decidedBy ?? null, r.decidedAt ? new Date(r.decidedAt) : null,
      ],
    );

  for (const o of d.overtimeRequests)
    await q(
      `INSERT INTO overtime_requests (id,employee_id,date,start_time,end_time,hours,reason,status,submitted_at,decided_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [o.id, o.employeeId, o.date, o.start, o.end, o.hours, o.reason, o.status, new Date(o.submittedAt), o.decidedBy ?? null],
    );

  for (const log of d.auditLogs)
    await q(
      `INSERT INTO audit_logs (id,actor_id,actor_name,action,target_type,target_id,detail,"before","after",at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [log.id, log.actorId, log.actorName, log.action, log.targetType, log.targetId, log.detail, log.before ?? null, log.after ?? null, new Date(log.at)],
    );

  for (const a of d.announcements)
    await q(`INSERT INTO announcements (id,title,body,category,date,branch_id) VALUES ($1,$2,$3,$4,$5,$6)`, [
      a.id, a.title, a.body, a.category, a.date, a.branchId ?? null,
    ]);

  for (const r of d.reimbursements)
    await q(
      `INSERT INTO reimbursements (id,employee_id,category,amount,description,status,submitted_at,approvals)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [r.id, r.employeeId, r.category, r.amount, r.description, r.status, new Date(r.submittedAt), JSON.stringify(r.approvals)],
    );

  for (const j of d.jobPostings)
    await q(
      `INSERT INTO job_postings (id,title,department_id,description,requirements,salary_range,status,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [j.id, j.title, j.departmentId, j.description, j.requirements, j.salaryRange, j.status, new Date(j.createdAt)],
    );

  for (const c of d.candidates)
    await q(
      `INSERT INTO candidates (id,job_posting_id,name,email,phone,status,applied_at,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [c.id, c.jobPostingId, c.name, c.email, c.phone, c.status, new Date(c.appliedAt), c.notes ?? null],
    );

  for (const t of d.trainings)
    await q(
      `INSERT INTO trainings (id,title,provider,description,start_date,end_date,max_participants,status,branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [t.id, t.title, t.provider, t.description, t.startDate, t.endDate, t.maxParticipants, t.status, t.branchId ?? null],
    );

  for (const e of d.trainingEnrollments)
    await q(
      `INSERT INTO training_enrollments (id,training_id,employee_id,status,enrolled_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [e.id, e.trainingId, e.employeeId, e.status, new Date(e.enrolledAt)],
    );

  for (const a of d.assets)
    await q(
      `INSERT INTO assets (id,name,category,serial_number,purchase_date,status,brand,model,purchase_price,notes,branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [a.id, a.name, a.category, a.serialNumber, a.purchaseDate, a.status, a.brand ?? null, a.model ?? null, a.purchasePrice ?? null, a.notes ?? null, a.branchId ?? null],
    );

  for (const a of d.assetAssignments)
    await q(
      `INSERT INTO asset_assignments (id,asset_id,employee_id,assigned_at,returned_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [a.id, a.assetId, a.employeeId, new Date(a.assignedAt), a.returnedAt ? new Date(a.returnedAt) : null],
    );

  for (const r of d.performanceReviews)
    await q(
      `INSERT INTO performance_reviews (id,employee_id,reviewer_id,period,score,strengths,improvements,goals,status,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [r.id, r.employeeId, r.reviewerId, r.period, r.score, r.strengths, r.improvements, r.goals, r.status, new Date(r.createdAt)],
    );

  for (const n of d.notifications)
    await q(
      `INSERT INTO notifications (id,user_id,title,body,type,read,created_at,link)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8
       WHERE EXISTS (SELECT 1 FROM users WHERE id=$2 AND role <> 'super_admin')`,
      [n.id, n.userId, n.title, n.body, n.type, n.read, new Date(n.createdAt), n.link ?? null],
    );

  console.log(`Seed selesai: ${d.employees.length} karyawan, ${d.attendance.length} absensi, ${d.reimbursements.length} reimbursement, ${d.trainings.length} pelatihan, ${d.assets.length} aset, password demo: ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
