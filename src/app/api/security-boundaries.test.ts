import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  getSessionUser: vi.fn(),
  writeAudit: vi.fn(),
  writeNotification: vi.fn(),
  hashPassword: vi.fn(),
  randomPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/db/client", () => ({ pool: { query: mocks.query, connect: mocks.connect } }));
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/server/state", () => ({ writeAudit: mocks.writeAudit, writeNotification: mocks.writeNotification }));
vi.mock("@/lib/server/auth", () => ({
  hashPassword: mocks.hashPassword,
  randomPassword: mocks.randomPassword,
  verifyPassword: mocks.verifyPassword,
}));

const actor = (role: "hr" | "super_admin" = "hr") => ({
  id: `USR-${role}`,
  employee_id: `EMP-${role}`,
  email: `${role}@example.com`,
  role,
  name: role,
  branch_id: "BR-JKT",
  status: "active",
});

beforeEach(() => {
  mocks.hashPassword.mockReturnValue("hashed-password");
  mocks.randomPassword.mockReturnValue("temporary-password");
  mocks.verifyPassword.mockReturnValue(true);
});

afterEach(() => {
  vi.resetModules();
  mocks.query.mockReset();
  mocks.connect.mockReset();
  mocks.getSessionUser.mockReset();
  mocks.writeAudit.mockReset();
  mocks.writeNotification.mockReset();
  mocks.hashPassword.mockReset();
  mocks.randomPassword.mockReset();
  mocks.verifyPassword.mockReset();
});

describe("user privilege boundaries", () => {
  it("blocks HR password resets for super-admin accounts", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "USR-ADMIN", email: "admin@example.com", employee_id: "EMP-ADMIN", role: "super_admin", branch_id: "BR-JKT" }],
    });
    const { POST } = await import("./users/[id]/reset-password/route");

    const response = await POST(new Request("http://localhost/api/users/USR-ADMIN/reset-password"), {
      params: Promise.resolve({ id: "USR-ADMIN" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("allows HR password resets for ordinary same-branch accounts", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query
      .mockResolvedValueOnce({
        rows: [{ id: "USR-2", email: "employee@example.com", employee_id: "EMP-2", role: "employee", branch_id: "BR-JKT" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: "HR" }] });
    const { POST } = await import("./users/[id]/reset-password/route");

    const response = await POST(new Request("http://localhost/api/users/USR-2/reset-password"), {
      params: Promise.resolve({ id: "USR-2" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, tempPassword: "temporary-password" });
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE users SET password_hash=$1, session_version=session_version+1 WHERE id=$2",
      ["hashed-password", "USR-2"],
    );
  });

  it("blocks HR changes and deactivation of super-admin accounts", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "USR-ADMIN", email: "admin@example.com", employee_id: "EMP-ADMIN", role: "super_admin", active: true, branch_id: "BR-JKT" }],
    });
    const { PATCH } = await import("./users/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/users/USR-ADMIN", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "employee", active: false }),
      }),
      { params: Promise.resolve({ id: "USR-ADMIN" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("keeps self-deactivation blocked", async () => {
    const session = actor();
    mocks.getSessionUser.mockResolvedValue(session);
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: session.id, email: session.email, employee_id: session.employee_id, role: session.role, active: true, branch_id: session.branch_id }],
    });
    const { PATCH } = await import("./users/[id]/route");

    const response = await PATCH(
      new Request(`http://localhost/api/users/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: session.id }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});

describe("session revocation", () => {
  it("revokes existing sessions after an authenticated password change", async () => {
    const session = actor();
    mocks.getSessionUser.mockResolvedValue(session);
    mocks.query
      .mockResolvedValueOnce({ rows: [{ password_hash: "stored-password" }] })
      .mockResolvedValueOnce({ rows: [] });
    const { POST } = await import("./auth/change-password/route");

    const response = await POST(new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "current-password", newPassword: "new-password" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE users SET password_hash = $1, session_version=session_version+1 WHERE id = $2",
      ["hashed-password", session.id],
    );
    expect(mocks.writeAudit).toHaveBeenCalledOnce();
  });

  it("revokes existing sessions after a user role change", async () => {
    const session = actor();
    mocks.getSessionUser.mockResolvedValue(session);
    mocks.query
      .mockResolvedValueOnce({
        rows: [{ id: "USR-2", email: "employee@example.com", employee_id: "EMP-2", role: "employee", active: true, branch_id: "BR-JKT" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: "HR" }] });
    const { PATCH } = await import("./users/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/users/USR-2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "supervisor" }),
      }),
      { params: Promise.resolve({ id: "USR-2" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE users SET role=$1, session_version=session_version+1 WHERE id=$2",
      ["supervisor", "USR-2"],
    );
  });
});

describe("self-approval boundaries", () => {
  it("blocks HR from deciding their own reimbursement", async () => {
    const session = actor();
    mocks.getSessionUser.mockResolvedValue(session);
    mocks.query
      .mockResolvedValueOnce({
        rows: [{ id: "RBM-1", employee_id: session.employee_id, status: "pending", category: "meal", amount: 1000, approvals: [] }],
      })
      .mockResolvedValueOnce({ rows: [{ branch_id: "BR-JKT" }] })
      .mockResolvedValueOnce({ rows: [{ name: "HR" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: session.id }] });
    const { PATCH } = await import("./reimbursements/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/reimbursements/RBM-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true }),
      }),
      { params: Promise.resolve({ id: "RBM-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.writeNotification).not.toHaveBeenCalled();
  });

  it("skips self reimbursements in bulk decisions", async () => {
    const session = actor();
    mocks.getSessionUser.mockResolvedValue(session);
    mocks.query.mockResolvedValueOnce({ rows: [{ name: "HR" }] });
    const clientQuery = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("FROM reimbursements")) {
        return Promise.resolve({ rows: [{ id: "RBM-1", employee_id: session.employee_id, status: "pending", category: "meal", amount: 1000, approvals: [] }] });
      }
      if (sql.includes("FROM employees")) return Promise.resolve({ rows: [{ branch_id: "BR-JKT" }] });
      return Promise.resolve({ rows: [] });
    });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const { POST } = await import("./reimbursements/bulk/route");

    const response = await POST(new Request("http://localhost/api/reimbursements/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["RBM-1"], approve: true }),
    }));

    expect(response.status).toBe(200);
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "SELECT * FROM reimbursements WHERE id=$1 FOR UPDATE",
      "COMMIT",
    ]);
  });

  it("blocks HR from deciding their own attendance correction", async () => {
    const session = actor();
    mocks.getSessionUser.mockResolvedValue(session);
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          id: "ATT-1",
          employee_id: session.employee_id,
          emp_name: "HR",
          branch_id: "BR-JKT",
          branchId: "BR-JKT",
          corrections: [{
            id: "COR-001",
            requestedAt: "2026-01-01T00:00:00.000Z",
            reason: "Lupa check-in",
            afterCheckIn: "2026-01-01T08:00:00.000Z",
            status: "pending",
            byEmployeeId: session.employee_id,
          }],
        }],
      })
      .mockResolvedValueOnce({ rows: [{ name: "HR" }] })
      .mockResolvedValueOnce({ rows: [] });
    const { PATCH } = await import("./attendance/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/attendance/ATT-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", correctionId: "COR-001", approve: true }),
      }),
      { params: Promise.resolve({ id: "ATT-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });
});

describe("employee deactivation", () => {
  it("blocks HR changes to an employee linked to a super-admin account", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "EMP-ADMIN", name: "Admin", branch_id: "BR-JKT", branchId: "BR-JKT", isSuperAdmin: true }] })
      .mockResolvedValueOnce({ rows: [{ name: "HR" }] });
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const { PATCH } = await import("./employees/[id]/route");

    const response = await PATCH(
      new Request("http://localhost/api/employees/EMP-ADMIN", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Changed" }),
      }),
      { params: Promise.resolve({ id: "EMP-ADMIN" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("blocks HR deactivation of an employee linked to a super-admin account", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query
      .mockResolvedValueOnce({
        rows: [{ id: "EMP-ADMIN", name: "Admin", branch_id: "BR-JKT", branchId: "BR-JKT", isSuperAdmin: true }],
      })
      .mockResolvedValueOnce({ rows: [{ name: "HR" }] });
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const { DELETE } = await import("./employees/[id]/route");

    const response = await DELETE(new Request("http://localhost/api/employees/EMP-ADMIN"), {
      params: Promise.resolve({ id: "EMP-ADMIN" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("revokes the linked user account in the same transaction", async () => {
    mocks.getSessionUser.mockResolvedValue(actor("super_admin"));
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "EMP-2", name: "Employee Two", branch_id: "BR-JKT", isSuperAdmin: true }] })
      .mockResolvedValueOnce({ rows: [{ name: "Super Admin" }] });
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    mocks.connect.mockResolvedValue({ query: clientQuery, release });
    const { DELETE } = await import("./employees/[id]/route");

    const response = await DELETE(new Request("http://localhost/api/employees/EMP-2"), {
      params: Promise.resolve({ id: "EMP-2" }),
    });

    expect(response.status).toBe(200);
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "UPDATE employees SET status='inactive' WHERE id=$1",
      "UPDATE users SET active=false, session_version=session_version+1 WHERE employee_id=$1",
      "COMMIT",
    ]);
    expect(clientQuery).toHaveBeenNthCalledWith(3, expect.any(String), ["EMP-2"]);
    expect(release).toHaveBeenCalledOnce();
  });
});

const approvalActor = (
  role: "manager" | "supervisor" | "employee" | "super_admin",
  branchId = "BR-JKT",
) => ({
  id: `USR-${role}`,
  employee_id: "EMP-APPROVER",
  email: `${role}@example.com`,
  role,
  name: role,
  branch_id: branchId,
  status: "active",
});

describe("approval hierarchy boundaries", () => {
  it("rejects an employee who only matches the leave supervisor id", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("employee"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM leave_requests")) {
        return { rows: [{ id: "LV-1", employee_id: "EMP-1", status: "pending", emp_name: "Employee", spv_id: "EMP-APPROVER", manager_id: "EMP-MANAGER", branch_id: "BR-JKT", start_date: "2026-01-01", end_date: "2026-01-01", days: 1 }] };
      }
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Employee" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./leave/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/leave/LV-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    }), { params: Promise.resolve({ id: "LV-1" }) });

    expect(response.status).toBe(403);
  });

  it("rejects an approval when the actor and requester are in different branches", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("supervisor"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM overtime_requests")) {
        return { rows: [{ id: "OT-1", employee_id: "EMP-1", status: "pending", emp_name: "Employee", spv_id: "EMP-APPROVER", manager_id: null, branch_id: "BR-SBG", date: "2026-01-01", start_time: "17:00", end_time: "18:00", hours: 1 }] };
      }
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Supervisor" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./overtime/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/overtime/OT-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    }), { params: Promise.resolve({ id: "OT-1" }) });

    expect(response.status).toBe(403);
  });

  it("requires the manager role for the manager stage of overtime", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("supervisor"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM overtime_requests")) {
        return { rows: [{ id: "OT-2", employee_id: "EMP-1", status: "pending", emp_name: "Employee", spv_id: null, manager_id: "EMP-APPROVER", branch_id: "BR-JKT", date: "2026-01-01", start_time: "17:00", end_time: "18:00", hours: 1 }] };
      }
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Supervisor" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./overtime/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/overtime/OT-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    }), { params: Promise.resolve({ id: "OT-2" }) });

    expect(response.status).toBe(403);
  });

  it("rejects a shift-swap approval for a cross-branch subordinate", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("supervisor"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM shift_swaps")) {
        return { rows: [{ id: "SW-1", employee_id: "EMP-1", status: "pending", emp_name: "Employee", spv_id: "EMP-APPROVER", manager_id: "EMP-MANAGER", branch_id: "BR-SBG", date: "2026-01-01", target_shift_id: "S-PAGI" }] };
      }
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Supervisor" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./shift-swaps/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/shift-swaps/SW-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    }), { params: Promise.resolve({ id: "SW-1" }) });

    expect(response.status).toBe(403);
  });

  it("keeps super-admin approval global at the manager stage", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("super_admin", "BR-JKT"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM leave_requests")) {
        return { rows: [{ id: "LV-ADMIN", employee_id: "EMP-1", status: "spv_approved", emp_name: "Employee", spv_id: "EMP-SPV", manager_id: "EMP-MGR", branch_id: "BR-SBG", start_date: "2026-01-01", end_date: "2026-01-01", days: 1 }] };
      }
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Super Admin" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./leave/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/leave/LV-ADMIN", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    }), { params: Promise.resolve({ id: "LV-ADMIN" }) });

    expect(response.status).toBe(200);
  });

  it("does not decide bulk leave for a non-supervisor id match", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("employee"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Employee" }] };
      return { rows: [] };
    });
    const clientQuery = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("FROM leave_requests")) return { rows: [{ id: "LV-BULK", employee_id: "EMP-1", status: "pending", spv_id: "EMP-APPROVER", manager_id: "EMP-MANAGER", branch_id: "BR-JKT" }] };
      return { rows: [] };
    });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const { POST } = await import("./leave/bulk/route");

    const response = await POST(new Request("http://localhost/api/leave/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["LV-BULK"], approve: true }),
    }));

    expect(response.status).toBe(200);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE leave_requests"))).toBe(false);
  });

  it("does not decide bulk overtime across a branch boundary", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("manager"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Manager" }] };
      return { rows: [] };
    });
    const clientQuery = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("FROM overtime_requests")) return { rows: [{ id: "OT-BULK", employee_id: "EMP-1", status: "spv_approved", spv_id: "EMP-APPROVER", manager_id: "EMP-APPROVER", branch_id: "BR-SBG" }] };
      return { rows: [] };
    });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const { POST } = await import("./overtime/bulk/route");

    const response = await POST(new Request("http://localhost/api/overtime/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["OT-BULK"], approve: true }),
    }));

    expect(response.status).toBe(200);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE overtime_requests"))).toBe(false);
  });
});

describe("employee hierarchy validation", () => {
  it.each([
    ["missing", []],
    ["wrong role", [{ id: "EMP-SPV", branch_id: "BR-JKT", role: "employee" }]],
    ["different branch", [{ id: "EMP-SPV", branch_id: "BR-SBG", role: "supervisor" }]],
  ])("rejects a %s supervisor reference with status 400", async (_label, referenceRows) => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("EXISTS (SELECT 1 FROM users")) {
        return { rows: [{ id: "EMP-1", name: "Employee", branch_id: "BR-JKT", branchId: "BR-JKT", isSuperAdmin: false }] };
      }
      if (sql.includes("LEFT JOIN users")) return { rows: referenceRows };
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "HR" }] };
      return { rows: [] };
    });
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });
    const { PATCH } = await import("./employees/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/employees/EMP-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spvId: "EMP-SPV" }),
    }), { params: Promise.resolve({ id: "EMP-1" }) });

    expect(response.status).toBe(400);
  });
});

describe("roster mutation scope", () => {
  it("rejects cross-branch PATCH and DELETE requests", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM employees e")) return { rows: [{ id: "EMP-2", branch_id: "BR-SBG", branchId: "BR-SBG", isSuperAdmin: false }] };
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "HR" }] };
      return { rows: [] };
    });
    const { PATCH, DELETE } = await import("./rosters/[id]/route");

    const patchResponse = await PATCH(new Request("http://localhost/api/rosters/EMP-2-2026-01-01", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: "S-PAGI" }),
    }), { params: Promise.resolve({ id: "EMP-2-2026-01-01" }) });
    const deleteResponse = await DELETE(new Request("http://localhost/api/rosters/EMP-2-2026-01-01"), {
      params: Promise.resolve({ id: "EMP-2-2026-01-01" }),
    });

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });

  it("rejects PATCH and DELETE for a linked super-admin employee", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM employees e")) return { rows: [{ id: "EMP-ADMIN", branch_id: "BR-JKT", branchId: "BR-JKT", isSuperAdmin: true }] };
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "HR" }] };
      return { rows: [] };
    });
    const { PATCH, DELETE } = await import("./rosters/[id]/route");

    const patchResponse = await PATCH(new Request("http://localhost/api/rosters/EMP-ADMIN-2026-01-01", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: "S-PAGI" }),
    }), { params: Promise.resolve({ id: "EMP-ADMIN-2026-01-01" }) });
    const deleteResponse = await DELETE(new Request("http://localhost/api/rosters/EMP-ADMIN-2026-01-01"), {
      params: Promise.resolve({ id: "EMP-ADMIN-2026-01-01" }),
    });

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
  });
});

describe("training cancellation scope", () => {
  it("blocks HR cancellation when the enrolled employee is in another branch", async () => {
    mocks.getSessionUser.mockResolvedValue(actor());
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM training_enrollments")) return { rows: [{ id: "TRE-1", training_id: "TRN-1", employee_id: "EMP-2", branch_id: "BR-SBG" }] };
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "HR" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./pelatihan/enroll/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/pelatihan/enroll/TRE-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ id: "TRE-1" }) });

    expect(response.status).toBe(403);
  });

  it("keeps super-admin cancellation global", async () => {
    mocks.getSessionUser.mockResolvedValue(approvalActor("super_admin"));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM training_enrollments")) return { rows: [{ id: "TRE-2", training_id: "TRN-1", employee_id: "EMP-2", branch_id: "BR-SBG" }] };
      if (sql.startsWith("SELECT name FROM employees")) return { rows: [{ name: "Super Admin" }] };
      return { rows: [] };
    });
    const { PATCH } = await import("./pelatihan/enroll/[id]/route");

    const response = await PATCH(new Request("http://localhost/api/pelatihan/enroll/TRE-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ id: "TRE-2" }) });

    expect(response.status).toBe(200);
  });
});
