import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getSessionUser: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("@/db/client", () => ({ pool: { query: mocks.query } }));
vi.mock("@/lib/server/session", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/server/state", () => ({ writeAudit: mocks.writeAudit }));

afterEach(() => {
  vi.resetModules();
  mocks.query.mockReset();
  mocks.getSessionUser.mockReset();
  mocks.writeAudit.mockReset();
});

describe("check-in duplicate", () => {
  it("returns 409 without deleting today's attendance", async () => {
    vi.resetModules();

    mocks.getSessionUser.mockResolvedValue({
      id: "USR-001",
      employee_id: "EMP-001",
      email: "samuel.hartono@hrissmart.id",
      role: "hr",
      name: "Samuel Hartono",
    });
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "EMP-001", lat: -6.2, lng: 106.816666, radius_m: 100, allowed_types: ["onsite"] }] })
      .mockResolvedValueOnce({ rows: [{ key: "checkin_window", value: "60" }, { key: "wfh_face", value: "WAJIB" }, { key: "wfh_liveness", value: "WAJIB" }, { key: "wfh_gps", value: "TIDAK WAJIB" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ date: new Date(`${today}T00:00:00`), start_time: "09:00", end_time: "17:00", grace_minutes: 15, crosses_midnight: false }] })
      .mockResolvedValueOnce({ rows: [{ check_in_at: new Date() }] });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ latitude: -6.2, longitude: 106.816666, accuracyM: 5, mockLocation: false, developerMode: false, descriptor: [], livenessScore: 0, livenessPassed: true, deviceId: "DEV-1", deviceName: "Test" }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("DELETE"))).toBe(false);
  });

  it("rejects WFH when the work location does not allow it", async () => {
    vi.resetModules();
    mocks.getSessionUser.mockResolvedValue({
      id: "USR-001",
      employee_id: "EMP-001",
      email: "samuel.hartono@hrissmart.id",
      role: "hr",
      name: "Samuel Hartono",
    });
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "EMP-001", allowed_types: ["onsite"] }] })
      .mockResolvedValueOnce({ rows: [{ key: "wfh_face", value: "WAJIB" }, { key: "wfh_liveness", value: "WAJIB" }, { key: "wfh_gps", value: "TIDAK WAJIB" }, { key: "checkin_window", value: "60" }] });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ wfh: true, latitude: 0, longitude: 0, accuracyM: 0, mockLocation: false, developerMode: false, descriptor: [], livenessScore: 0, livenessPassed: true, deviceId: "DEV-1", deviceName: "Test" }),
    }));

    expect(response.status).toBe(403);
  });
});
