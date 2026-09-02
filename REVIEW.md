# Review HRIS — UI & Fitur

Tanggal review: 2026-08-31 · Scope: seluruh 31 halaman, ~40 API route, data layer, dan navigasi.

## 1. Ringkasan

HRIS ini sudah jauh melampaui status "MVP di atas kertas". Seluruh modul inti dan modul yang tadinya direncanakan Phase 3–4 (Payroll, Rekrutmen, Performa, Pelatihan, Aset, Reimbursement) sudah dibangun end-to-end: UI → store (optimistic) → API route → PostgreSQL → audit log. Diferensiator utamanya — attendance engine anti-fraud 7 tahap (GPS → geofence → device → face → liveness → 1:1 verification → schedule) plus risk engine — berfungsi dengan pesan penolakan yang spesifik dan edukatif, sesuai positioning produk.

## 2. Yang Sudah Kuat

- **Kelengkapan modul**: 17 rute admin + 13 rute karyawan, semuanya terhubung navigasi (setelah perbaikan di review ini) dan tersinkron API.
- **Attendance engine**: pipeline validasi bertahap dengan skor risiko 7 faktor, rekaman evidence lengkap (koordinat, jarak vs radius, snap wajah, skor liveness, device), dan alur review/koreksi admin.
- **Arsitektur data**: PostgreSQL sebagai sumber kebenaran, API route tipis sebagai seam pengganti backend, optimistic UI dengan rollback + re-fetch `/api/state`, seeding deterministik (nama Indonesia, cabang Jakarta/Bandung/Surabaya).
- **Keamanan dasar**: sesi httpOnly bertanda tangan HMAC, hash scrypt, role-scoping data karyawan, audit log before→after untuk perubahan sensitif.
- **Payroll**: hitung PPH21 (TK/0), BPJS, biaya jabatan — ada unit test-nya.
- **Desain & aksesibilitas**: bahasa visual "ledger arsip" konsisten dengan DESIGN.md, tabular-nums, animasi stamp, `prefers-reduced-motion`, fokus terlihat jelas.

## 3. Gap yang Ditemukan → Sudah Diperbaiki di Review Ini

| # | Gap | Dampak | Perbaikan |
|---|-----|--------|-----------|
| 1 | **Tidak ada proteksi rute** — `/admin/*` dan `/app/*` bisa dibuka tanpa login; API aman tapi halaman merender shell kosong | Pengunjung anonim melihat UI admin yang kosong, pengalaman buruk | `src/proxy.ts` (konvensi Next.js 16 — middleware kini bernama Proxy): redirect optimistis ke `/` bila cookie `hris_session` tidak ada. Verifikasi penuh tetap di server per-API |
| 2 | **3 halaman karyawan orphaned** — `/app/lembur`, `/app/performa`, `/app/pengumuman` selesai dibangun tapi tidak ada satu pun tautan ke sana | Fitur tak terpakai; karyawan tidak tahu bisa ajukan lembur/lihat review | Kartu quick-link "Lembur" & "Performa" di beranda + tautan "lihat semua →" pada bagian Pengumuman |
| 3 | **Ikon quick-card tertukar** — Pelatihan dan Aset sama-sama memakai ikon Megaphone | Sinyal visual salah; Megaphone identik dengan Pengumuman | Pelatihan → GraduationCap, Aset → Package (konsisten dengan ikon sidebar admin) |
| 4 | **Case duplikat `UPDATE_LOCATION`** di reducer dan di `syncAction` (dead code, 2 lokasi) | Rawan salah paham saat maintain; case kedua tidak pernah dieksekusi | Duplikat dihapus; case asli (reducer versi audit-log + sync PATCH) dipertahankan |
| 5 | **PRODUCT.md drift** — masih menyebut Payroll/Rekrutmen/Performa/Pelatihan/Aset/Reimbursement "ditunda (menu disabled)" | Dokumen produk menyesatkan stakeholder baru | Diperbarui: modul tersebut kini "tersedia penuh"; yang ditunda hanya offline mode & Flutter native |
| 6 | **Payload `UPDATE_EMPLOYEE` redundan + cast `any`** — `(a.data as any).locationId` selalu `undefined` (field sebenarnya `workLocationId`, sudah terkirim lewat spread), plus 2 import tipe tak terpakai | Cast `any` menyembunyikan niat kode; rawan disalahpahami saat maintain | Payload dikirim sebagai `a.data` apa adanya (API menerima camelCase); import dibuang |
| 7 | **Lokasi kerja hanya memakai input koordinat dan plot SVG** | Sulit memilih titik akurat secara visual; admin harus mencari latitude/longitude manual | Ditambahkan map picker Leaflet + OpenStreetMap: klik/drag pin, circle radius geofence real-time, dan input koordinat manual tetap tersedia |

## 4. Rekomendasi Lanjutan (Belum Dikerjakan)

1. **Role guard di level halaman admin** — proxy hanya memverifikasi keberadaan sesi; manager seharusnya tidak bisa membuka `/admin/karyawan` atau `/admin/payroll`, dan role-halaman (mis. hr_manager vs manager) belum dibatasi di UI. Tambahkan peta role→menu di layout admin.
2. **Device binding nyata** — `deviceId` saat ini acak per sesi sessionStorage; klaim "maks 2 device + OTP" di halaman profil belum dituntaskan. Butuh fingerprint perangkat/vendor + flow OTP.
3. **PTKP dinamis di payroll** — masih TK/0 statis; status kawin/tanggungan perlu jadi field karyawan sebelum payroll dipakai nyata (lihat catatan di `src/lib/payroll.ts`).
4. **Notifikasi untuk approver** — notifikasi saat ini mengalir ke karyawan; HR/manager belum diberi notifikasi ketika ada pengajuan baru menunggu keputusan.
5. **README masih boilerplate create-next-app** — tulis setup nyata: prasyarat PostgreSQL, `.env`, `npm run db:seed`, akun demo (`demo1234`), dan skrip smoke (`scripts/check-pages.mjs`).
6. **E2E alur absensi** — unit test engine sudah ada; tambahkan Playwright untuk alur check-in happy-path + skenario penolakan (jarak di luar radius, wajah tidak terdaftar).
7. **Utang lint** — `npm run lint` merah sejak sebelum review ini: 21 error `@typescript-eslint/no-explicit-any` (terkonsentrasi di API route: parsing body tanpa tipe) + 18 warning unused-vars. Perlu satu sesi pembersihan bertipe (mis. validasi body dengan zod); file yang disentuh review ini sudah bersih.
8. **Offline mode** (sesuai roadmap PRODUCT.md) — antrian lokal untuk check-in saat jaringan lemah di gerbang/lift.

## 5. Verifikasi

Perubahan divalidasi dengan typecheck, lint, dan unit test (lihat riwayat perintah pada sesi review). Alur smoke halaman dapat diulang via `node scripts/check-pages.mjs`.
