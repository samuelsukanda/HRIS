import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // izinkan akses dev server dari loopback + LAN (wildcard per-segmen, aman untuk IP DHCP
  // yang berubah-ubah) — tanpa ini chunk/_next ber-Origin ditolak 403 dan halaman blank
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.*.*", "10.*.*.*", "172.16.*.*"],
};

export default nextConfig;
