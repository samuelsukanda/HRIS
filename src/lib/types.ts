// Entitas inti HRIS — mengikuti PRD §61 (Database Core Entities)

export type Role =
  | "super_admin"
  | "hr_admin"
  | "hr_manager"
  | "manager"
  | "finance"
  | "employee";

export interface User {
  id: string;
  employeeId: string;
  email: string;
  role: Role;
  active?: boolean;
}

export interface WorkLocation {
  id: string;
  name: string;
  branchId: string;
  latitude: number;
  longitude: number;
  radiusM: number; // radius geofence dalam meter
  allowedTypes: AttendanceType[];
}

export interface Branch {
  id: string;
  name: string;
  city: string;
}

export interface Department {
  id: string;
  name: string;
  branchId: string;
}

export interface Position {
  id: string;
  title: string;
  level: string;
}

export type EmploymentStatus = "probation" | "permanent" | "contract" | "intern" | "resigned";
export type PresenceState = "active" | "on_leave" | "absent" | "resigned" | "inactive";

export interface Employee {
  id: string; // EMP-001
  nik: string; // 16 digit
  name: string;
  gender: "L" | "P";
  birthPlace: string;
  birthDate: string;
  address: string;
  phone: string;
  email: string;
  joinDate: string;
  departmentId: string;
  positionId: string;
  managerId?: string;
  branchId: string;
  workLocationId: string;
  employmentType: EmploymentStatus;
  status: PresenceState;
  bankName: string;
  bankAccount: string;
  emergencyContact: { name: string; relation: string; phone: string };
  faceRegistered: boolean;
  photoUrl?: string;
  baseSalary?: number;
  allowance?: number;
}

export interface Shift {
  id: string;
  name: string;
  start: string; // "07:00"
  end: string; // "15:00"
  graceMinutes: number;
  crossesMidnight: boolean;
}

export interface RosterEntry {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftId: string | null; // null = libur
}

export type AttendanceType = "onsite" | "wfh";

export type AttendanceStatus =
  | "present"
  | "late"
  | "early_leave"
  | "absent"
  | "leave"
  | "sick"
  | "permission"
  | "business_trip"
  | "wfh";

export interface StageResult {
  stage: number; // 01–07 sesuai PRD §57
  name: string;
  pass: boolean;
  detail: string;
}

export interface VerificationSnapshot {
  at: string; // ISO
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  mockLocation: boolean;
  developerMode: boolean;
  faceScore: number; // 0–1 similarity
  faceDistance?: number; // jarak euclidean descriptor (makin kecil makin mirip)
  livenessScore: number; // 0–1
  livenessPassed: boolean;
  deviceId: string;
  deviceName: string;
  ip: string;
  stages: StageResult[];
}

export interface Correction {
  id: string;
  requestedAt: string;
  reason: string;
  beforeCheckIn?: string;
  afterCheckIn?: string;
  status: "pending" | "approved" | "rejected";
  byEmployeeId: string;
  decidedBy?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  checkInSnap?: VerificationSnapshot;
  checkOutSnap?: VerificationSnapshot;
  status: AttendanceStatus;
  riskScore: number; // 0–100
  verificationStatus: "valid" | "pending" | "rejected" | "review";
  rejectionReason?: string;
  corrections: Correction[];
}

export interface LeaveType {
  id: string;
  name: string;
  allocationDays: number;
  paid: boolean;
  requiresAttachment: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  attachmentUrl?: string;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  date: string;
  start: string;
  end: string;
  hours: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt: string;
  decidedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  before?: string;
  after?: string;
  at: string; // ISO
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: "pengumuman" | "kebijakan" | "libur" | "acara";
  date: string;
}

export interface HrisData {
  users: User[];
  branches: Branch[];
  departments: Department[];
  positions: Position[];
  workLocations: WorkLocation[];
  employees: Employee[];
  shifts: Shift[];
  roster: RosterEntry[];
  attendance: AttendanceRecord[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  auditLogs: AuditLogEntry[];
  announcements: Announcement[];
  reimbursements: Reimbursement[];
  jobPostings: JobPosting[];
  candidates: Candidate[];
  trainings: Training[];
  trainingEnrollments: TrainingEnrollment[];
  assets: Asset[];
  assetAssignments: AssetAssignment[];
  performanceReviews: PerformanceReview[];
  notifications: Notification[];
  shiftSwaps: ShiftSwap[];
  assetRequests: AssetRequest[];
  settings: Record<string, string>;
}

// ── Phase 3-4 modules ──────────────────────────────────────────────


export interface ApprovalEntry {
  level: "manager" | "hr";
  byName: string;
  at: string;
  approved: boolean;
}

export interface Reimbursement {
  id: string;
  employeeId: string;
  category: "transport" | "meal" | "accommodation" | "equipment" | "other";
  amount: number;
  description: string;
  status: "pending" | "manager_approved" | "approved" | "rejected";
  submittedAt: string;
  approvals: ApprovalEntry[];
  attachmentUrl?: string;
}

export interface JobPosting {
  id: string;
  title: string;
  departmentId: string;
  description: string;
  requirements: string;
  salaryRange: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface Candidate {
  id: string;
  jobPostingId: string;
  name: string;
  email: string;
  phone: string;
  status: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  appliedAt: string;
  notes?: string;
}

export interface Training {
  id: string;
  title: string;
  provider: string;
  description: string;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  status: "upcoming" | "ongoing" | "completed";
}

export interface TrainingEnrollment {
  id: string;
  trainingId: string;
  employeeId: string;
  status: "enrolled" | "completed" | "cancelled";
  enrolledAt: string;
}

export interface Asset {
  id: string;
  name: string;
  category: "laptop" | "phone" | "monitor" | "furniture" | "vehicle" | "other";
  serialNumber: string;
  purchaseDate: string;
  status: "available" | "assigned" | "maintenance" | "retired";
  brand?: string;
  model?: string;
  purchasePrice?: number;
  notes?: string;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  employeeId: string;
  assignedAt: string;
  returnedAt?: string;
  returnRequestedAt?: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewerId: string;
  period: string;
  score: number; // 1-5
  strengths: string;
  improvements: string;
  goals: string;
  status: "draft" | "submitted" | "final";
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: "approval" | "info" | "reminder";
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface ShiftSwap {
  id: string;
  employeeId: string;
  date: string;
  fromShiftId: string | null;
  targetShiftId: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  createdAt: string;
}

export interface AssetRequest {
  id: string;
  employeeId: string;
  category: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  createdAt: string;
}
