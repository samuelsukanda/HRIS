// Kewenangan HR penuh — super_admin mewarisi semua akses HR
export function isHr(role: string): boolean {
  return role === "hr" || role === "super_admin";
}
