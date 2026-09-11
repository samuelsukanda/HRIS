"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApprovalEntry,
  Asset,
  AssetAssignment,
  AssetRequest,
  AttendanceRecord,
  AuditLogEntry,
  Candidate,
  Employee,
  HrisData,
  JobPosting,
  LeaveRequest,
  OvertimeRequest,
  Reimbursement,
  RosterEntry,
  Shift,
  ShiftSwap,
  Training,
  TrainingEnrollment,
  VerificationSnapshot,
  WorkLocation,
} from "./types";
import { seedData } from "./data";
import { alertAccountDisabled, showTempPassword } from "./swal";

export interface SessionUser {
  userId: string;
  employeeId: string;
}

interface State {
  data: HrisData;
  session: SessionUser | null;
}

type Action =
  | { type: "HYDRATE"; state: State }
  | { type: "LOGIN"; userId: string }
  | { type: "LOGOUT" }
  | { type: "CHECK_IN"; record: AttendanceRecord }
  | { type: "CHECK_OUT"; attendanceId: string; snapshot: AttendanceRecord["checkOutSnap"] }
  | { type: "SUBMIT_LEAVE"; request: LeaveRequest }
  | { type: "DECIDE_LEAVE"; id: string; approve: boolean; byName: string }
  | { type: "SUBMIT_OVERTIME"; request: OvertimeRequest }
  | { type: "DECIDE_OVERTIME"; id: string; approve: boolean; byName: string }
  | { type: "DECIDE_CORRECTION"; attendanceId: string; correctionId: string; approve: boolean; byName: string }
  | { type: "REGISTER_FACE"; employeeId: string; descriptor?: number[] }
  | { type: "UPDATE_SELF_PHOTO"; employeeId: string; photoUrl: string | null }
  | { type: "SUBMIT_REIMBURSEMENT"; request: Reimbursement }
  | { type: "DECIDE_REIMBURSEMENT"; id: string; level: "manager" | "hr"; approve: boolean; byName: string }
  | { type: "APPLY_CANDIDATE"; candidate: Candidate }
  | { type: "UPDATE_CANDIDATE"; id: string; status: Candidate["status"]; notes?: string }
  | { type: "ENROLL_TRAINING"; enrollment: TrainingEnrollment }
  | { type: "CANCEL_ENROLLMENT"; id: string }
  | { type: "ASSIGN_ASSET"; assignment: AssetAssignment }
  | { type: "RETURN_ASSET"; assignmentId: string }
  | { type: "SUBMIT_REVIEW"; review: { id: string; employeeId: string; reviewerId: string; period: string; score: number; strengths: string; improvements: string; goals: string } }
  | { type: "FINALIZE_REVIEW"; id: string }
  | { type: "MARK_NOTIFICATION_READ"; id: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ"; userId: string }
  | { type: "CREATE_ANNOUNCEMENT"; announcement: { id: string; title: string; body: string; category: "pengumuman" | "kebijakan" | "libur" | "acara"; date: string } }
  | { type: "UPDATE_ANNOUNCEMENT"; id: string; title?: string; body?: string; category?: "pengumuman" | "kebijakan" | "libur" | "acara"; date?: string }
  | { type: "DELETE_ANNOUNCEMENT"; id: string }
  | { type: "ADD_NOTIFICATION"; notification: { id: string; userId: string; title: string; body: string; type: "approval" | "info" | "reminder"; read: boolean; createdAt: string; link?: string } }
  | { type: "CREATE_EMPLOYEE"; employee: Employee }
  | { type: "UPDATE_EMPLOYEE"; id: string; data: Partial<Employee> }
  | { type: "DELETE_EMPLOYEE"; id: string }
  | { type: "CREATE_SHIFT"; shift: Shift }
  | { type: "UPDATE_SHIFT"; id: string; data: Partial<Shift> }
  | { type: "DELETE_SHIFT"; id: string }
  | { type: "CREATE_ROSTER"; roster: RosterEntry }
  | { type: "UPDATE_ROSTER"; id: string; data: Partial<RosterEntry> }
  | { type: "DELETE_ROSTER"; id: string }
  | { type: "CREATE_TRAINING"; training: Training }
  | { type: "UPDATE_TRAINING"; id: string; data: Partial<Training> }
  | { type: "DELETE_TRAINING"; id: string }
  | { type: "CREATE_JOB_POSTING"; job: JobPosting }
  | { type: "UPDATE_JOB_POSTING"; id: string; data: Partial<JobPosting> }
  | { type: "DELETE_JOB_POSTING"; id: string }
  | { type: "CREATE_ASSET"; asset: Asset }
  | { type: "UPDATE_ASSET"; id: string; data: Partial<Asset> }
  | { type: "DELETE_ASSET"; id: string }
  | { type: "BULK_DECIDE_LEAVE"; ids: string[]; approve: boolean; byName: string }
  | { type: "BULK_DECIDE_OVERTIME"; ids: string[]; approve: boolean; byName: string }
  | { type: "BULK_DECIDE_REIMBURSEMENT"; ids: string[]; approve: boolean; level: "manager" | "hr" }
  | { type: "CANCEL_LEAVE"; id: string }
  | { type: "CANCEL_OVERTIME"; id: string }
  | { type: "CREATE_LOCATION"; location: WorkLocation }
  | { type: "UPDATE_LOCATION"; id: string; data: Partial<WorkLocation> }
  | { type: "DELETE_LOCATION"; id: string }
  | { type: "REQUEST_SHIFT_SWAP"; swap: ShiftSwap }
  | { type: "DECIDE_SHIFT_SWAP"; id: string; approve: boolean }
  | { type: "REQUEST_ASSET"; request: AssetRequest }
  | { type: "DECIDE_ASSET_REQUEST"; id: string; approve: boolean };

function log(
  data: HrisData,
  entry: Omit<AuditLogEntry, "id">,
): HrisData {
  const next: AuditLogEntry = { id: `LOG-${String(data.auditLogs.length + 1).padStart(3, "0")}`, ...entry };
  return { ...data, auditLogs: [next, ...data.auditLogs] };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "LOGIN": {
      const loginUser = state.data.users.find((u) => u.id === action.userId);
      if (!loginUser) return state;
      return { ...state, session: { userId: action.userId, employeeId: loginUser.employeeId } };
    }
    case "LOGOUT":
      return { ...state, session: null };
    case "CHECK_IN":
      return {
        ...state,
        data: log(
          { ...state.data, attendance: [action.record, ...state.data.attendance.filter((a) => a.id !== action.record.id)] },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === action.record.employeeId)?.name ?? "-",
            action: "Attendance created",
            targetType: "attendance",
            targetId: action.record.id,
            detail: `Check-in ${action.record.status.toUpperCase()} · risk ${action.record.riskScore}/100`,
            after: action.record.checkInAt,
            at: new Date().toISOString(),
          },
        ),
      };
    case "CHECK_OUT":
      return {
        ...state,
        data: {
          ...state.data,
          attendance: state.data.attendance.map((a) =>
            a.id === action.attendanceId ? { ...a, checkOutAt: action.snapshot!.at, checkOutSnap: action.snapshot! } : a,
          ),
        },
      };
    case "SUBMIT_LEAVE":
      return {
        ...state,
        data: log(
          { ...state.data, leaveRequests: [action.request, ...state.data.leaveRequests] },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === action.request.employeeId)?.name ?? "-",
            action: "Leave submitted",
            targetType: "leave_request",
            targetId: action.request.id,
            detail: `${action.request.days} hari · status pending`,
            at: new Date().toISOString(),
          },
        ),
      };
    case "DECIDE_LEAVE":
      return {
        ...state,
        data: log(
          {
            ...state.data,
            leaveRequests: state.data.leaveRequests.map((r) =>
              r.id === action.id
                ? { ...r, status: action.approve ? ("approved" as const) : ("rejected" as const), decidedBy: action.byName, decidedAt: new Date().toISOString() }
                : r,
            ),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: action.byName,
            action: action.approve ? "Approved leave" : "Rejected leave",
            targetType: "leave_request",
            targetId: action.id,
            detail: action.approve ? "Pengajuan cuti disetujui" : "Pengajuan cuti ditolak",
            before: "pending",
            after: action.approve ? "approved" : "rejected",
            at: new Date().toISOString(),
          },
        ),
      };
    case "SUBMIT_OVERTIME":
      return {
        ...state,
        data: log(
          { ...state.data, overtimeRequests: [action.request, ...state.data.overtimeRequests] },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === action.request.employeeId)?.name ?? "-",
            action: "Overtime submitted",
            targetType: "overtime_request",
            targetId: action.request.id,
            detail: `${action.request.hours} jam · status pending`,
            at: new Date().toISOString(),
          },
        ),
      };
    case "DECIDE_OVERTIME":
      return {
        ...state,
        data: log(
          {
            ...state.data,
            overtimeRequests: state.data.overtimeRequests.map((r) =>
              r.id === action.id ? { ...r, status: action.approve ? ("approved" as const) : ("rejected" as const), decidedBy: action.byName } : r,
            ),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: action.byName,
            action: action.approve ? "Approved overtime" : "Rejected overtime",
            targetType: "overtime_request",
            targetId: action.id,
            detail: action.approve ? "Lembur disetujui" : "Lembur ditolak",
            before: "pending",
            after: action.approve ? "approved" : "rejected",
            at: new Date().toISOString(),
          },
        ),
      };
    case "DECIDE_CORRECTION": {
      const att = state.data.attendance.find((a) => a.id === action.attendanceId);
      const corr = att?.corrections.find((c) => c.id === action.correctionId);
      if (!att || !corr) return state;
      const updatedAtt: AttendanceRecord = {
        ...att,
        corrections: att.corrections.map((c) =>
          c.id === action.correctionId
            ? { ...c, status: action.approve ? ("approved" as const) : ("rejected" as const), decidedBy: action.byName }
            : c,
        ),
        ...(action.approve && corr.afterCheckIn ? { checkInAt: corr.afterCheckIn, status: att.status === "late" ? "present" : att.status } : {}),
      };
      return {
        ...state,
        data: log(
          { ...state.data, attendance: state.data.attendance.map((a) => (a.id === action.attendanceId ? updatedAtt : a)) },
          {
            actorId: state.session?.userId ?? "-",
            actorName: action.byName,
            action: action.approve ? "Correction approved" : "Correction rejected",
            targetType: "attendance_correction",
            targetId: action.correctionId,
            detail: action.approve ? `Check-in dikoreksi` : "Koreksi ditolak",
            before: corr.beforeCheckIn,
            after: corr.afterCheckIn,
            at: new Date().toISOString(),
          },
        ),
      };
    }
    case "REGISTER_FACE":
      return {
        ...state,
        data: log(
          {
            ...state.data,
            employees: state.data.employees.map((e) => (e.id === action.employeeId ? { ...e, faceRegistered: true } : e)),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === action.employeeId)?.name ?? "-",
            action: "Face registered",
            targetType: "face_profile",
            targetId: action.employeeId,
            detail: "Template wajah terdaftar & terenkripsi",
            at: new Date().toISOString(),
          },
        ),
      };
    case "UPDATE_SELF_PHOTO":
      return {
        ...state,
        data: log(
          {
            ...state.data,
            employees: state.data.employees.map((e) => (e.id === action.employeeId ? { ...e, photoUrl: action.photoUrl ?? undefined } : e)),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === action.employeeId)?.name ?? "-",
            action: action.photoUrl ? "Photo updated" : "Photo removed",
            targetType: "employee",
            targetId: action.employeeId,
            detail: action.photoUrl ? "Foto profil diperbarui" : "Foto profil dihapus",
            at: new Date().toISOString(),
          },
        ),
      };
    case "UPDATE_LOCATION": {
      const loc = state.data.workLocations.find((w) => w.id === action.id);
      if (!loc) return state;
      const updated = { ...loc, ...action.data };
      return {
        ...state,
        data: log(
          { ...state.data, workLocations: state.data.workLocations.map((w) => (w.id === action.id ? updated : w)) },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === state.session?.employeeId)?.name ?? "-",
            action: "Work location updated",
            targetType: "work_location",
            targetId: action.id,
            detail: `Radius ${loc.radiusM} m → ${updated.radiusM} m`,
            before: `radius ${loc.radiusM} m`,
            after: `radius ${updated.radiusM} m`,
            at: new Date().toISOString(),
          },
        ),
      };
    }
    case "SUBMIT_REIMBURSEMENT":
      return {
        ...state,
        data: log(
          { ...state.data, reimbursements: [action.request, ...state.data.reimbursements] },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === action.request.employeeId)?.name ?? "-",
            action: "Reimbursement submitted",
            targetType: "reimbursement",
            targetId: action.request.id,
            detail: `${action.request.category} Rp${action.request.amount.toLocaleString("id-ID")}`,
            at: new Date().toISOString(),
          },
        ),
      };
    case "DECIDE_REIMBURSEMENT": {
      const isLastLevel = action.level === "hr";
      const newStatus = action.approve ? (isLastLevel ? "approved" : "manager_approved") : "rejected";
      const entry: ApprovalEntry = { level: action.level, byName: action.byName, at: new Date().toISOString(), approved: action.approve };
      return {
        ...state,
        data: log(
          {
            ...state.data,
            reimbursements: state.data.reimbursements.map((r) =>
              r.id === action.id ? { ...r, status: newStatus as Reimbursement["status"], approvals: [...r.approvals, entry] } : r,
            ),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: action.byName,
            action: action.approve ? "Reimbursement approved" : "Reimbursement rejected",
            targetType: "reimbursement",
            targetId: action.id,
            detail: `${action.level} approval: ${action.approve ? "disetujui" : "ditolak"}`,
            at: new Date().toISOString(),
          },
        ),
      };
    }
    case "APPLY_CANDIDATE":
      return { ...state, data: { ...state.data, candidates: [action.candidate, ...state.data.candidates] } };
    case "UPDATE_CANDIDATE":
      return {
        ...state,
        data: {
          ...state.data,
          candidates: state.data.candidates.map((c) =>
            c.id === action.id ? { ...c, status: action.status, notes: action.notes ?? c.notes } : c,
          ),
        },
      };
    case "ENROLL_TRAINING":
      return { ...state, data: { ...state.data, trainingEnrollments: [action.enrollment, ...state.data.trainingEnrollments] } };
    case "CANCEL_ENROLLMENT":
      return {
        ...state,
        data: {
          ...state.data,
          trainingEnrollments: state.data.trainingEnrollments.map((e) =>
            e.id === action.id ? { ...e, status: "cancelled" as const } : e,
          ),
        },
      };
    case "ASSIGN_ASSET":
      return {
        ...state,
        data: log(
          {
            ...state.data,
            assetAssignments: [action.assignment, ...state.data.assetAssignments],
            assets: state.data.assets.map((a) => (a.id === action.assignment.assetId ? { ...a, status: "assigned" as const } : a)),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === state.session?.employeeId)?.name ?? "-",
            action: "Asset assigned",
            targetType: "asset_assignment",
            targetId: action.assignment.id,
            detail: `Aset ${action.assignment.assetId} → ${action.assignment.employeeId}`,
            at: new Date().toISOString(),
          },
        ),
      };
    case "RETURN_ASSET": {
      const aa = state.data.assetAssignments.find((a) => a.id === action.assignmentId);
      if (!aa) return state;
      return {
        ...state,
        data: log(
          {
            ...state.data,
            assetAssignments: state.data.assetAssignments.map((a) =>
              a.id === action.assignmentId ? { ...a, returnRequestedAt: new Date().toISOString() } : a,
            ),
            assets: state.data.assets.map((a) => (a.id === aa.assetId ? { ...a, status: "available" as const } : a)),
          },
          {
            actorId: state.session?.userId ?? "-",
            actorName: state.data.employees.find((e) => e.id === state.session?.employeeId)?.name ?? "-",
            action: "Asset returned",
            targetType: "asset_assignment",
            targetId: action.assignmentId,
            detail: `Aset ${aa.assetId} dikembalikan`,
            at: new Date().toISOString(),
          },
        ),
      };
    }
    case "SUBMIT_REVIEW":
      return {
        ...state,
        data: {
          ...state.data,
          performanceReviews: [
            { ...action.review, status: "submitted" as const, createdAt: new Date().toISOString() },
            ...state.data.performanceReviews.filter((r) => r.id !== action.review.id),
          ],
        },
      };
    case "FINALIZE_REVIEW":
      return {
        ...state,
        data: {
          ...state.data,
          performanceReviews: state.data.performanceReviews.map((r) =>
            r.id === action.id ? { ...r, status: "final" as const } : r,
          ),
        },
      };
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        data: {
          ...state.data,
          notifications: state.data.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
        },
      };
    case "MARK_ALL_NOTIFICATIONS_READ":
      return {
        ...state,
        data: {
          ...state.data,
          notifications: state.data.notifications.map((n) => (n.userId === action.userId ? { ...n, read: true } : n)),
        },
      };
    case "CREATE_ANNOUNCEMENT":
      return {
        ...state,
        data: {
          ...state.data,
          announcements: [action.announcement, ...state.data.announcements],
        },
      };
    case "UPDATE_ANNOUNCEMENT":
      return {
        ...state,
        data: {
          ...state.data,
          announcements: state.data.announcements.map((a) =>
            a.id === action.id ? { ...a, ...(action.title && { title: action.title }), ...(action.body && { body: action.body }), ...(action.category && { category: action.category as never }), ...(action.date && { date: action.date }) } : a
          ),
        },
      };
    case "DELETE_ANNOUNCEMENT":
      return {
        ...state,
        data: {
          ...state.data,
          announcements: state.data.announcements.filter((a) => a.id !== action.id),
        },
      };
    case "ADD_NOTIFICATION":
      return {
        ...state,
        data: {
          ...state.data,
          notifications: [action.notification, ...state.data.notifications],
        },
      };
    case "CREATE_EMPLOYEE":
      return { ...state, data: { ...state.data, employees: [...state.data.employees, action.employee] } };
    case "UPDATE_EMPLOYEE":
      return { ...state, data: { ...state.data, employees: state.data.employees.map((e) => (e.id === action.id ? { ...e, ...action.data } : e)) } };
    case "DELETE_EMPLOYEE":
      return { ...state, data: { ...state.data, employees: state.data.employees.map((e) => (e.id === action.id ? { ...e, status: "inactive" as const } : e)) } };
    case "CREATE_SHIFT":
      return { ...state, data: { ...state.data, shifts: [...state.data.shifts, action.shift] } };
    case "UPDATE_SHIFT":
      return { ...state, data: { ...state.data, shifts: state.data.shifts.map((s) => (s.id === action.id ? { ...s, ...action.data } : s)) } };
    case "DELETE_SHIFT":
      return { ...state, data: { ...state.data, shifts: state.data.shifts.filter((s) => s.id !== action.id) } };
    case "CREATE_ROSTER":
      return { ...state, data: { ...state.data, roster: [...state.data.roster.filter((r) => !(r.employeeId === action.roster.employeeId && r.date === action.roster.date)), { ...action.roster, id: `${action.roster.employeeId}-${action.roster.date}` }] } };
    case "UPDATE_ROSTER":
      return { ...state, data: { ...state.data, roster: state.data.roster.map((r) => (r.id === action.id ? { ...r, ...action.data } : r)) } };
    case "DELETE_ROSTER":
      return { ...state, data: { ...state.data, roster: state.data.roster.filter((r) => r.id !== action.id) } };
    case "CREATE_TRAINING":
      return { ...state, data: { ...state.data, trainings: [...state.data.trainings, action.training] } };
    case "UPDATE_TRAINING":
      return { ...state, data: { ...state.data, trainings: state.data.trainings.map((t) => (t.id === action.id ? { ...t, ...action.data } : t)) } };
    case "DELETE_TRAINING":
      return { ...state, data: { ...state.data, trainings: state.data.trainings.filter((t) => t.id !== action.id) } };
    case "CREATE_JOB_POSTING":
      return { ...state, data: { ...state.data, jobPostings: [...state.data.jobPostings, action.job] } };
    case "UPDATE_JOB_POSTING":
      return { ...state, data: { ...state.data, jobPostings: state.data.jobPostings.map((j) => (j.id === action.id ? { ...j, ...action.data } : j)) } };
    case "DELETE_JOB_POSTING":
      return { ...state, data: { ...state.data, jobPostings: state.data.jobPostings.filter((j) => j.id !== action.id) } };
    case "CREATE_ASSET":
      return { ...state, data: { ...state.data, assets: [...state.data.assets, action.asset] } };
    case "UPDATE_ASSET":
      return { ...state, data: { ...state.data, assets: state.data.assets.map((a) => (a.id === action.id ? { ...a, ...action.data } : a)) } };
    case "DELETE_ASSET":
      return { ...state, data: { ...state.data, assets: state.data.assets.filter((a) => a.id !== action.id) } };
    case "BULK_DECIDE_LEAVE":
      return { ...state, data: { ...state.data, leaveRequests: state.data.leaveRequests.map((l) => (action.ids.includes(l.id) ? { ...l, status: action.approve ? "approved" as const : "rejected" as const, decidedBy: action.byName } : l)) } };
    case "BULK_DECIDE_OVERTIME":
      return { ...state, data: { ...state.data, overtimeRequests: state.data.overtimeRequests.map((o) => (action.ids.includes(o.id) ? { ...o, status: action.approve ? "approved" as const : "rejected" as const, decidedBy: action.byName } : o)) } };
    case "BULK_DECIDE_REIMBURSEMENT":
      return { ...state, data: { ...state.data, reimbursements: state.data.reimbursements.map((r) => {
        if (!action.ids.includes(r.id)) return r;
        const entry: ApprovalEntry = { level: action.level, byName: "", at: new Date().toISOString(), approved: action.approve };
        return { ...r, status: action.approve ? (action.level === "hr" ? "approved" as const : "manager_approved" as const) : "rejected" as const, approvals: [...r.approvals, entry] };
      }) } };
    case "CANCEL_LEAVE":
      return { ...state, data: { ...state.data, leaveRequests: state.data.leaveRequests.map((l) => (l.id === action.id ? { ...l, status: "cancelled" as const } : l)) } };
    case "CANCEL_OVERTIME":
      return { ...state, data: { ...state.data, overtimeRequests: state.data.overtimeRequests.map((o) => (o.id === action.id ? { ...o, status: "cancelled" as const } : o)) } };
    case "CREATE_LOCATION":
      return { ...state, data: { ...state.data, workLocations: [...state.data.workLocations, action.location] } };
    case "DELETE_LOCATION":
      return { ...state, data: { ...state.data, workLocations: state.data.workLocations.filter((l) => l.id !== action.id) } };
    case "REQUEST_SHIFT_SWAP":
      return { ...state, data: { ...state.data, shiftSwaps: [action.swap, ...state.data.shiftSwaps] } };
    case "DECIDE_SHIFT_SWAP":
      return { ...state, data: { ...state.data, shiftSwaps: state.data.shiftSwaps.map((s) => (s.id === action.id ? { ...s, status: action.approve ? "approved" as const : "rejected" as const } : s)) } };
    case "REQUEST_ASSET":
      return { ...state, data: { ...state.data, assetRequests: [action.request, ...state.data.assetRequests] } };
    case "DECIDE_ASSET_REQUEST":
      return { ...state, data: { ...state.data, assetRequests: state.data.assetRequests.map((r) => (r.id === action.id ? { ...r, status: action.approve ? "approved" as const : "rejected" as const } : r)) } };
    default:
      return state;
  }
}

// ── Koneksi API: server = sumber kebenaran ───────────────────────────

export interface CheckInPayload {
  latitude: number;
  longitude: number;
  accuracyM: number;
  mockLocation: boolean;
  developerMode: boolean;
  descriptor: number[];
  livenessScore: number;
  livenessPassed: boolean;
  deviceId: string;
  deviceName: string;
  wfh?: boolean;
}

export class ApiError extends Error {
  title: string;
  lines: string[];
  constructor(title: string, lines: string[]) {
    super(lines.join(" "));
    this.title = title;
    this.lines = lines;
  }
}

async function postJSON(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) {
    throw new Error((j.error as string) || r.statusText || "Gagal sinkronisasi data.");
  }
  return { r, j };
}

/** Sinkron aksi lokal ke API. Return true jika perlu rekonsiliasi state. */
async function syncAction(a: Action): Promise<boolean> {
  switch (a.type) {
    case "SUBMIT_LEAVE":
      return (await postJSON("/api/leave", a.request)).r.ok;
    case "DECIDE_LEAVE":
      return (await postJSON(`/api/leave/${a.id}`, { approve: a.approve }, "PATCH")).r.ok;
    case "SUBMIT_OVERTIME":
      return (
        (
          await postJSON("/api/overtime", {
            date: a.request.date,
            start: a.request.start,
            end: a.request.end,
            hours: a.request.hours,
            reason: a.request.reason,
          })
        ).r.ok
      );
    case "DECIDE_OVERTIME":
      return (await postJSON(`/api/overtime/${a.id}`, { approve: a.approve }, "PATCH")).r.ok;
    case "DECIDE_CORRECTION":
      return (
        (
          await postJSON(`/api/attendance/${a.attendanceId}`, {
            action: "decide",
            correctionId: a.correctionId,
            approve: a.approve,
          }, "PATCH")
        ).r.ok
      );
    case "UPDATE_LOCATION":
      return (await postJSON(`/api/locations/${a.id}`, a.data, "PATCH")).r.ok;
    case "REGISTER_FACE":
      return (
        (
          await postJSON("/api/face", a.descriptor ? { descriptor: a.descriptor } : {}, "PATCH")
        ).r.ok
      );
    case "UPDATE_SELF_PHOTO":
      return (await postJSON("/api/profile-photo", { photoUrl: a.photoUrl }, "PATCH")).r.ok;
    case "SUBMIT_REIMBURSEMENT":
      return (await postJSON("/api/reimbursements", { category: a.request.category, amount: a.request.amount, description: a.request.description })).r.ok;
    case "DECIDE_REIMBURSEMENT":
      return (await postJSON(`/api/reimbursements/${a.id}`, { level: a.level, approve: a.approve }, "PATCH")).r.ok;
    case "APPLY_CANDIDATE":
      return (await postJSON("/api/rekrutmen/candidates", { jobPostingId: a.candidate.jobPostingId, name: a.candidate.name, email: a.candidate.email, phone: a.candidate.phone })).r.ok;
    case "UPDATE_CANDIDATE":
      return (await postJSON(`/api/rekrutmen/candidates/${a.id}`, { status: a.status, notes: a.notes }, "PATCH")).r.ok;
    case "ENROLL_TRAINING":
      return (await postJSON("/api/pelatihan/enroll", { trainingId: a.enrollment.trainingId })).r.ok;
    case "CANCEL_ENROLLMENT":
      return (await postJSON(`/api/pelatihan/enroll/${a.id}`, {}, "PATCH")).r.ok;
    case "ASSIGN_ASSET":
      return (await postJSON("/api/aset/assign", { assetId: a.assignment.assetId, employeeId: a.assignment.employeeId })).r.ok;
    case "RETURN_ASSET":
      return (await postJSON(`/api/aset/assign/${a.assignmentId}`, {}, "PATCH")).r.ok;
    case "SUBMIT_REVIEW":
      return (await postJSON("/api/performa/reviews", { employeeId: a.review.employeeId, period: a.review.period, score: a.review.score, strengths: a.review.strengths, improvements: a.review.improvements, goals: a.review.goals })).r.ok;
    case "FINALIZE_REVIEW":
      return (await postJSON(`/api/performa/reviews/${a.id}`, {}, "PATCH")).r.ok;
    case "CREATE_ANNOUNCEMENT":
      return (await postJSON("/api/announcements", { title: a.announcement.title, body: a.announcement.body, category: a.announcement.category, date: a.announcement.date })).r.ok;
    case "UPDATE_ANNOUNCEMENT":
      return (await postJSON(`/api/announcements/${a.id}`, { ...(a.title && { title: a.title }), ...(a.body && { body: a.body }), ...(a.category && { category: a.category }), ...(a.date && { date: a.date }) }, "PATCH")).r.ok;
    case "DELETE_ANNOUNCEMENT":
      return (await postJSON(`/api/announcements/${a.id}`, {}, "DELETE")).r.ok;
    case "CREATE_EMPLOYEE": {
      const { j } = await postJSON("/api/employees", { name: a.employee.name, email: a.employee.email, phone: a.employee.phone, nik: a.employee.nik, role: "employee", departmentId: a.employee.departmentId, positionId: a.employee.positionId, branchId: a.employee.branchId, workLocationId: a.employee.workLocationId, employmentType: a.employee.employmentType, base_salary: a.employee.baseSalary, allowance: a.employee.allowance, join_date: a.employee.joinDate });
      if (typeof j.tempPassword === "string") void showTempPassword(a.employee.email, j.tempPassword);
      return true;
    }
    case "UPDATE_EMPLOYEE":
      return (await postJSON(`/api/employees/${a.id}`, a.data, "PATCH")).r.ok;
    case "DELETE_EMPLOYEE":
      return (await postJSON(`/api/employees/${a.id}`, {}, "DELETE")).r.ok;
    case "CREATE_SHIFT":
      return (await postJSON("/api/shifts", a.shift)).r.ok;
    case "UPDATE_SHIFT":
      return (await postJSON(`/api/shifts/${a.id}`, a.data, "PATCH")).r.ok;
    case "DELETE_SHIFT":
      return (await postJSON(`/api/shifts/${a.id}`, {}, "DELETE")).r.ok;
    case "CREATE_ROSTER":
      return (await postJSON("/api/rosters", { employee_id: a.roster.employeeId, date: a.roster.date, shift_id: a.roster.shiftId })).r.ok;
    case "UPDATE_ROSTER":
      return (await postJSON(`/api/rosters/${a.id}`, a.data, "PATCH")).r.ok;
    case "DELETE_ROSTER":
      return (await postJSON(`/api/rosters/${a.id}`, {}, "DELETE")).r.ok;
    case "CREATE_TRAINING":
      return (await postJSON("/api/pelatihan", a.training)).r.ok;
    case "UPDATE_TRAINING":
      return (await postJSON(`/api/pelatihan/${a.id}`, a.data, "PATCH")).r.ok;
    case "DELETE_TRAINING":
      return (await postJSON(`/api/pelatihan/${a.id}`, {}, "DELETE")).r.ok;
    case "CREATE_JOB_POSTING":
      return (await postJSON("/api/jobs", a.job)).r.ok;
    case "UPDATE_JOB_POSTING":
      return (await postJSON(`/api/jobs/${a.id}`, a.data, "PATCH")).r.ok;
    case "DELETE_JOB_POSTING":
      return (await postJSON(`/api/jobs/${a.id}`, {}, "DELETE")).r.ok;
    case "CREATE_ASSET":
      return (await postJSON("/api/assets", a.asset)).r.ok;
    case "UPDATE_ASSET":
      return (await postJSON(`/api/assets/${a.id}`, a.data, "PATCH")).r.ok;
    case "DELETE_ASSET":
      return (await postJSON(`/api/assets/${a.id}`, {}, "DELETE")).r.ok;
    case "BULK_DECIDE_LEAVE":
      return (await postJSON(`/api/leave/bulk`, { ids: a.ids, approve: a.approve }, "POST")).r.ok;
    case "BULK_DECIDE_OVERTIME":
      return (await postJSON(`/api/overtime/bulk`, { ids: a.ids, approve: a.approve }, "POST")).r.ok;
    case "BULK_DECIDE_REIMBURSEMENT":
      return (await postJSON(`/api/reimbursements/bulk`, { ids: a.ids, approve: a.approve, level: a.level }, "POST")).r.ok;
    case "CANCEL_LEAVE":
      return (await postJSON(`/api/leave/${a.id}`, { cancel: true }, "PATCH")).r.ok;
    case "CANCEL_OVERTIME":
      return (await postJSON(`/api/overtime/${a.id}`, { cancel: true }, "PATCH")).r.ok;
    case "CREATE_LOCATION":
      return (await postJSON("/api/locations", a.location)).r.ok;
    case "DELETE_LOCATION":
      return (await postJSON(`/api/locations/${a.id}`, {}, "DELETE")).r.ok;
    case "REQUEST_SHIFT_SWAP":
      return (await postJSON("/api/shift-swaps", { id: a.swap.id, date: a.swap.date, fromShiftId: a.swap.fromShiftId, targetShiftId: a.swap.targetShiftId, reason: a.swap.reason })).r.ok;
    case "DECIDE_SHIFT_SWAP":
      return (await postJSON(`/api/shift-swaps/${a.id}`, { approve: a.approve }, "PATCH")).r.ok;
    case "REQUEST_ASSET":
      return (await postJSON("/api/asset-requests", { id: a.request.id, category: a.request.category, description: a.request.description })).r.ok;
    case "DECIDE_ASSET_REQUEST":
      return (await postJSON(`/api/asset-requests/${a.id}`, { approve: a.approve }, "PATCH")).r.ok;
    case "MARK_NOTIFICATION_READ":
      return (await postJSON(`/api/notifications`, { id: a.id }, "PATCH")).r.ok;
    case "MARK_ALL_NOTIFICATIONS_READ":
      return (await postJSON(`/api/notifications`, { markAll: true }, "PATCH")).r.ok;
    default:
      return false;
  }
}

const Ctx = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  refresh: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  submitCheckIn: (payload: CheckInPayload) => Promise<AttendanceRecord>;
  submitCheckOut: (payload: CheckInPayload) => Promise<{ id: string; snap: VerificationSnapshot }>;
  toast: { message: string; type: "success" | "error" } | null;
  showToast: (message: string, type?: "success" | "error") => void;
  hideToast: () => void;
} | null>(null);

export function HrisProvider({ children }: { children: React.ReactNode }) {
  // Render pertama selalu seed agar SSR & client identik
  const [state, rawDispatch] = useReducer(reducer, undefined, (): State => ({ data: seedData(), session: null }));
  const [ready, setReady] = useState(false);
  const bootstrapped = useRef(false);
  const router = useRouter();
  const hadSessionRef = useRef(false);
  const kickedRef = useRef(false);

  const loadAnonymous = useCallback(async () => {
    try {
      const b = await fetch("/api/bootstrap");
      if (!b.ok) return;
      const pub = (await b.json()) as Partial<HrisData>;
      const seed = seedData();
      rawDispatch({
        type: "HYDRATE",
        state: {
          session: null,
          data: {
            ...seed,
            ...pub,
            attendance: [],
            roster: [],
            leaveRequests: [],
            overtimeRequests: [],
            auditLogs: [],
          },
        },
      });
    } catch {
      // offline → tetap seed lokal agar layar login terlihat
    }
  }, []);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    hadSessionRef.current = !!state.session;
    if (state.session) kickedRef.current = false;
  }, [state.session]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await loadAnonymous();
  }, [loadAnonymous]);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/state");
      if (!r.ok) {
        // sesi tadinya ada tapi state gagal → cek apakah akun dinonaktifkan
        if (hadSessionRef.current && !kickedRef.current) {
          try {
            const s = await fetch("/api/auth/status");
            const sj = await s.json().catch(() => ({})) as { code?: string };
            if (sj.code === "disabled") {
              kickedRef.current = true;
              // navigasi dulu selama UI masih valid, lalu bersihkan sesi — hindari frame blank di rute terlindungi
              void fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              router.push("/");
              void alertAccountDisabled();
              await loadAnonymous();
              return false;
            }
          } catch { /* abaikan, fallback anonim */ }
        }
        await loadAnonymous();
        return false;
      }
      const j = (await r.json()) as State;
      rawDispatch({ type: "HYDRATE", state: { data: j.data, session: j.session } });
      return !!j.session;
    } catch {
      return false;
    }
  }, [loadAnonymous, router]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      // Deep-link demo dev-only: ?as=USR-001 masuk tanpa password
      const as = new URLSearchParams(window.location.search).get("as");
      if (as && process.env.NODE_ENV !== "production") {
        await postJSON("/api/auth/dev-login", { userId: as }).catch(() => undefined);
      }
      await refresh();
      setReady(true);
    })();
    // polling 15s saat tab terlihat — deteksi penonaktifkan akun terasa langsung & notifikasi tetap segar tanpa realtime infra
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const dispatch = useCallback<React.Dispatch<Action>>(
    (a) => {
      rawDispatch(a);
      syncAction(a)
        .then((changed) => {
          if (changed) void refresh();
        })
        .catch((err) => {
          showToast(err.message || "Gagal sinkronisasi data.", "error");
          void refresh(); // revert optimistic state
        });
    },
    [refresh, showToast],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const { r, j } = await postJSON("/api/auth/login", { email, password });
        if (!r.ok) return (j.error as string) ?? "Login gagal.";
        await refresh();
        return null;
      } catch (e) {
        // TypeError = fetch gagal (jaringan/server); Error lain membawa pesan dari API (mis. akun dinonaktifkan)
        return e instanceof TypeError ? "Tidak dapat menghubungi server. Coba lagi." : e instanceof Error ? e.message : "Login gagal.";
      }
    },
    [refresh],
  );

  const submitCheckIn = useCallback(async (payload: CheckInPayload): Promise<AttendanceRecord> => {
    const { r, j } = await postJSON("/api/attendance/check-in", payload);
    if (!r.ok) {
      throw new ApiError(
        (j.title as string) ?? "Absensi tidak dapat diproses.",
        (j.lines as string[]) ?? [(j.error as string) ?? "Terjadi kesalahan. Coba lagi."],
      );
    }
    rawDispatch({ type: "CHECK_IN", record: j.record as AttendanceRecord });
    return j.record as AttendanceRecord;
  }, []);

  const submitCheckOut = useCallback(async (payload: CheckInPayload): Promise<{ id: string; snap: VerificationSnapshot }> => {
    const { r, j } = await postJSON("/api/attendance/check-out", payload);
    if (!r.ok) {
      throw new ApiError(
        (j.title as string) ?? "Check-out tidak dapat diproses.",
        (j.lines as string[]) ?? [(j.error as string) ?? "Terjadi kesalahan. Coba lagi."],
      );
    }
    rawDispatch({ type: "CHECK_OUT", attendanceId: j.id as string, snapshot: j.snap as AttendanceRecord["checkOutSnap"] });
    return { id: j.id as string, snap: j.snap as VerificationSnapshot };
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, refresh, login, logout, submitCheckIn, submitCheckOut, toast, showToast, hideToast }),
    [state, dispatch, refresh, login, logout, submitCheckIn, submitCheckOut, toast, showToast, hideToast],
  );
  if (!ready) return <div className="min-h-[100dvh] bg-paper" aria-hidden />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHris() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHris di luar HrisProvider");
  return ctx;
}

// ── Helper seleksi ───────────────────────────────────────────────────
import { toLocalISO } from "./format";

export function currentUser(state: State) {
  if (!state.session) return null;
  const user = state.data.users.find((u) => u.id === state.session!.userId);
  if (!user) return null;
  const employee = state.data.employees.find((e) => e.id === user.employeeId);
  if (!employee) return null;
  return { user, employee };
}

export function rosterShiftFor(data: HrisData, employeeId: string, date: string) {
  const entry = data.roster.find((r) => r.employeeId === employeeId && r.date === date);
  if (!entry?.shiftId) return null;
  return data.shifts.find((s) => s.id === entry.shiftId) ?? null;
}

export function todayISO(): string {
  return toLocalISO(new Date());
}
