// Mode test absensi: boleh check-in berkali-kali sehari + tanpa jadwal.
// Aktif via ATTENDANCE_TEST_MODE=1, dan OTOMATIS MATI di production
// (NODE_ENV=production) agar tak pernah bocor ke live.
export const ATTENDANCE_TEST_MODE =
  process.env.ATTENDANCE_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
