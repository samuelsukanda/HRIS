# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Next.js 15 (App Router, TypeScript), Tailwind v4, motion, @phosphor-icons/react — dipilih karena satu codebase untuk Admin Web + Employee Mobile-Web (PWA-style) dengan mock data layer yang siap diganti backend Laravel/PostgreSQL di kemudian hari.

## Users

- **HR Admin / HR Manager** — mengelola data karyawan, memantau kehadiran real-time, menyetujui cuti/lembur/koreksi, menjalankan payroll nantinya. Bekerja di desktop, jam kerja.
- **Manager / Supervisor** — memantau kehadiran tim dan menyetujui pengajuan subordinate. Desktop, sesekali mobile.
- **Employee** — melakukan check-in/check-out harian via smartphone (GPS + face + liveness), melihat jadwal shift, saldo cuti, payslip. Mobile-first, terburu-buru saat check-in pagi.
- Target industri: perusahaan multi-cabang, rumah sakit/klinik, institusi pendidikan — organisasi dengan sistem shift.

## Product Purpose

HRIS menggantikan proses HR manual (Excel, absensi fisik, approval WhatsApp) dalam satu platform. Inti diferensiasinya adalah **attendance engine anti-fraud**: GPS geofencing + face verification 1:1 + liveness/PAD + device validation + schedule validation + risk engine + audit trail. Sukses = absensi yang valid benar-benar dari orang yang tepat, di lokasi yang tepat, di waktu yang tepat — dan data itu mengalir otomatis ke leave/overtime/payroll/reporting.

## Positioning

"One Employee — One HR Profile — One Attendance Record — One Payroll Source." Kompetitor HRIS umum tidak bisa menyalin rantai validasi VALID ATTENDANCE = GPS AND Geofence AND Face AND Liveness AND Schedule AND Device AND Rule — dengan pesan penolakan yang spesifik dan edukatif, bukan generik.

## Operating Context

- Check-in terjadi di gerbang kantor/lift, pagi hari, sibuk, cepat: alur wajib singkat tanpa form panjang.
- Shift lintas tengah malam (23:00–07:00) valid dan harus ditangani.
- Lokasi kerja punya radius geofence berbeda per cabang (mis. Kantor Pusat 100m).
- Bahasa UI campuran Indonesia + istilah HR Inggris (Check-in, Leave, Payslip).
- Privacy-by-design: GPS hanya dikumpulkan saat absensi, bukan tracking 24/7.

## Capabilities and Constraints

- **MVP (tahap ini):** Auth & RBAC demo, Dashboard (HR/Manager/Employee), Organization & Work Location (radius editor), Employee management, Attendance Engine (GPS→Geofence→Face sim→Liveness sim→Schedule→Risk score), Shift & Roster, Leave (saldo/pengajuan/approval), Overtime, Reports+CSV export, Audit Log, Attendance Review admin.
- **Biometrik disimulasikan realistis:** kamera asli via getUserMedia; skor face/liveness dihasilkan pipeline simulasi deterministik; arsitektur siap diganti vendor SDK (on-device atau server-side).
- **Tersedia penuh (sebelumnya ditunda, kini terhubung di navigasi):** Payroll, Rekrutmen, Performa, Pelatihan, Aset, Reimbursement.
- **Ditunda:** offline mode; aplikasi native (Flutter).
- Pesan error absensi harus spesifik dan edukatif (jarak aktual vs radius, checklist wajah), bukan "attendance failed".
- Mock data layer TypeScript bertipe sesuai entitas PRD §61; API route tipis sebagai seam pengganti backend.

## Brand Commitments

Nama produk: **HRIS**. Tidak ada logo, palet, atau aset brand lain yang mengikat — arah visual bebas ditentukan lewat proses new-work.

## Evidence on Hand

PRD lengkap (`PRD_HRIS_GPS_Face_Recognition.md` di workspace asli) sebagai sumber kebenaran produk: struktur menu §6, alur attendance §57, acceptance criteria §80, format dashboard §41–43, skema database §61–64. Tidak ada data pelanggan, testimonial, atau aset foto nyata — semua data demo harus sintetik dan realistis (nama Indonesia, cabang Jakarta/Bandung/Surabaya).

## Product Principles

1. **Validitas di atas kenyamanan semu** — absensi gagal harus jelas alasannya; sistem tidak pernah diam-diam menerima.
2. **Cepat saat paling dibutuhkan** — check-in 3 ketukan: buka → kamera → sukses.
3. **Transparansi tanpa surveillance** — lokasi hanya untuk absensi; karyawan bisa melihat data apa yang disimpan.
4. **Audit segalanya** — perubahan data sensitif meninggalkan jejak before/after.
5. **Satu sumber kebenaran** — attendance yang tervalidasi adalah fondasi payroll, bukan Excel paralel.

## Accessibility & Inclusion

WCAG AA minimum untuk teks dan kontrol. Alur absensi harus tetap bisa dipakai di kondisi cahaya kurang dan oleh pengguna berkacamata (pesan bimbingan kamera jelas). `prefers-reduced-motion` dihormati.
