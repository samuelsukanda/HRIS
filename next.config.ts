import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // izinkan akses dev server dari HP/LAN (IP PC: 192.168.142.33) — tanpa ini HMR websocket
  // ditolak dan halaman blank saat dibuka via IP, bukan localhost
  allowedDevOrigins: ["192.168.142.33"],
};

export default nextConfig;
