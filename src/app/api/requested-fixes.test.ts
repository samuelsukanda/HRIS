import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  getSessionUser: vi.fn(),
  writeAudit: vi.fn(),
  writeNotification: vi.fn(),
  nextId: vi.fn(),
}));

vi.mock("@/db/client", () => ({ pool: { query: mocks.query, connect: mocks.connect } }));
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/server/state", () => ({
  nextId: mocks.nextId,
  writeAudit: mocks.writeAudit,
  writeNotification: mocks.writeNotification,
}));

const session = (role: "employee" | "hr" | "manager" | "super_admin" = "employee", employeeId = "EMP-1") => ({
  id: `USR-${role}`,
  employee_id: employeeId,
  email: `${role}@example.com`,
  role,
  name: role,
  branch_id: "BR-JKT",
  status: "active",
});

beforeEach(() => {
  mocks.nextId.mockResolvedValue("NEXT-001");
  mocks.query.mockResolvedValue({ rows: [] });
  mocks.connect.mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  });
});

afterEach(() => {
  vi.resetModules();
  mocks.query.mockReset();
  mocks.connect.mockReset();
  mocks.getSessionUser.mockReset();
  mocks.writeAudit.mockReset();
  mocks.writeNotification.mockReset();
  mocks.nextId.mockReset();
});

describe("attendance admin decisions", () => {
  it("marks an approved correction valid", async () => {
    mocks.getSessionUser.mockResolvedValue(session("hr", "EMP-HR"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM attendance a JOIN employees")) {
        return {
          rows: [{
            id: "ATT-1",
            employee_id: "EMP-1",
            emp_name: "Employee",
            branch_id: "BR-JKT",
            spv_id: null,
            manager_id: null,
            verification_status: "review",
            status: "absent",
            corrections: [{
              id: "COR-1",
              requestedAt: "2026-09-25T00:00:00.000Z",
              reason: "Transport delay",
              beforeCheckIn: "2026-09-25T08:00:00.000Z",
              afterCheckIn: "2026-09-25T07:50:00.000Z",
              status: "pending",
              byEmployeeId: "EMP-1",
            }],
          }],
        };
      }
      return { rows: [] };
    });

    const { PATCH } = await import("./attendance/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/attendance/ATT-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", correctionId: "COR-1", approve: true }),
      }),
      { params: Promise.resolve({ id: "ATT-1" }) },
    );

    expect(response.status).toBe(200);
    const update = mocks.query.mock.calls.find(([sql]) => String(sql).includes("verification_status"));
    expect(update?.[0]).toMatch(/verification_status.*'valid'/);
    expect(update?.[0]).toMatch(/rejection_reason.*THEN NULL/);
    expect(update?.[0]).toMatch(/status.*NOT IN/);
  });

  it("marks an admin time edit valid without changing the response shape", async () => {
    mocks.getSessionUser.mockResolvedValue(session("hr", "EMP-HR"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM attendance a JOIN employees")) {
        return {
          rows: [{
            id: "ATT-1",
            employee_id: "EMP-1",
            emp_name: "Employee",
            branch_id: "BR-JKT",
            spv_id: null,
            manager_id: null,
            verification_status: "review",
            check_in_at: "2026-09-25T08:00:00.000Z",
            check_out_at: null,
          }],
        };
      }
      return { rows: [] };
    });

    const { PATCH } = await import("./attendance/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/attendance/ATT-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_time",
          checkInAt: "2026-09-25T08:15:00.000Z",
          checkOutAt: "2026-09-25T17:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "ATT-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const update = mocks.query.mock.calls.find(([sql]) => String(sql).includes("verification_status"));
    expect(update?.[0]).toContain("verification_status = 'valid'");
  });
});

describe("period and balance boundaries", () => {
  it("rejects an invalid payroll month before querying the database", async () => {
    mocks.getSessionUser.mockResolvedValue(session("super_admin", "EMP-ADMIN"));

    const { POST } = await import("./payroll/run/route");
    const response = await POST(new Request("http://localhost/api/payroll/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2026-13" }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("reserves only the current calendar year", async () => {
    mocks.getSessionUser.mockResolvedValue(session("employee"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM employees WHERE id = $1")) {
        return { rows: [{ id: "EMP-1", branch_id: "BR-JKT", spv_id: null, manager_id: null }] };
      }
      if (sql.includes("FROM leave_types")) {
        return { rows: [{ id: "LV-CT", allocation_days: 12, requires_attachment: false }] };
      }
      return { rows: [] };
    });
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT COALESCE(SUM(days)")) {
        if (!sql.includes("start_date >= $3") || !sql.includes("start_date < $4")) {
          return { rows: [{ days: 99 }] };
        }
        return { rows: [{ days: 0 }] };
      }
      if (sql.includes("SELECT 1 FROM leave_requests") || sql.includes("INSERT INTO leave_requests")) return { rows: [] };
      return { rows: [] };
    });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });

    const { POST } = await import("./leave/route");
    const response = await POST(new Request("http://localhost/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeId: "LV-CT",
        startDate: "2026-09-25",
        endDate: "2026-09-25",
        reason: "A valid leave reason",
      }),
    }));

    expect(response.status).toBe(200);
    const reservation = clientQuery.mock.calls.find(([sql]) => String(sql).includes("SELECT COALESCE(SUM(days)")) as [string, unknown[]] | undefined;
    expect(reservation?.[1]).toEqual(["EMP-1", "LV-CT", `${new Date().getFullYear()}-01-01`, `${new Date().getFullYear() + 1}-01-01`]);
  });
});

describe("private upload boundaries", () => {
  it("rejects a profile photo owned by another user", async () => {
    mocks.getSessionUser.mockResolvedValue(session());
    mocks.query.mockResolvedValue({ rows: [{ user_id: "USR-OTHER" }] });

    const { PATCH } = await import("./profile-photo/route");
    const response = await PATCH(new Request("http://localhost/api/profile-photo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: "/api/uploads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg" }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE employees"))).toBe(false);
  });

  it("requires an employee to own a leave attachment", async () => {
    mocks.getSessionUser.mockResolvedValue(session());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM employees WHERE id = $1")) {
        return { rows: [{ id: "EMP-1", branch_id: "BR-JKT", spv_id: null, manager_id: null }] };
      }
      if (sql.includes("FROM leave_types")) {
        return { rows: [{ id: "LV-SK", allocation_days: 12, requires_attachment: true }] };
      }
      if (sql.includes("FROM upload_records")) return { rows: [{ user_id: "USR-OTHER" }] };
      return { rows: [] };
    });

    const { POST } = await import("./leave/route");
    const response = await POST(new Request("http://localhost/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeId: "LV-SK",
        startDate: "2026-09-25",
        endDate: "2026-09-25",
        reason: "A valid leave reason",
        attachmentUrl: "/api/uploads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("does not grant upload access from the actor's own employee reference", async () => {
    mocks.getSessionUser.mockResolvedValue(session());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM upload_records")) return { rows: [{ user_id: "USR-OTHER" }] };
      if (sql.includes("FROM leave_requests")) return { rows: [{ employee_id: "EMP-1" }] };
      if (sql.includes("FROM employees WHERE id = ANY")) {
        return { rows: [{ id: "EMP-1", branch_id: "BR-JKT", spv_id: null, manager_id: null }] };
      }
      return { rows: [] };
    });

    const { GET } = await import("./uploads/[filename]/route");
    const response = await GET(new Request("http://localhost/api/uploads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg"), {
      params: Promise.resolve({ filename: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg" }),
    });

    expect(response.status).toBe(403);
  });
});

describe("overtime overlap boundary", () => {
  it("rejects overlap with an active request before inserting", async () => {
    mocks.getSessionUser.mockResolvedValue(session());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM employees WHERE id=$1")) {
        return { rows: [{ id: "EMP-1", branch_id: "BR-JKT", spv_id: null, manager_id: null }] };
      }
      if (sql.includes("FROM overtime_requests")) {
        return { rows: [{ start_time: "17:00", end_time: "19:00" }] };
      }
      return { rows: [] };
    });

    const { POST } = await import("./overtime/route");
    const response = await POST(new Request("http://localhost/api/overtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-09-25", start: "18:00", end: "20:00", reason: "A valid overtime reason" }),
    }));

    expect(response.status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO overtime_requests"))).toBe(false);
  });
});
