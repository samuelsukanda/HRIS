# HRIS

HRIS multi-cabang untuk absensi, cuti, lembur, payroll, rekrutmen, pelatihan, aset, reimbursement, dan audit.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- PostgreSQL dengan `pg`
- Tailwind CSS v4, Motion, Leaflet, face-api

## Menjalankan

```bash
npm install
cp .env.example .env
npm run dev
```

Isi `.env` minimal:

```env
DATABASE_URL=postgres://user:password@localhost:5432/hris
SESSION_SECRET=ganti-dengan-secret-acak-yang-panjang
```

Buat tabel dan muat data demo:

```bash
npx tsx scripts/migrate.ts
npx tsx src/db/seed.ts
npx tsx src/db/seed-superadmin.ts
```

Seeder `src/db/seed.ts` menghapus dan mengisi ulang data demo. Jangan jalankan pada database produksi.

## Verifikasi

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Model face-api berada di `public/models`. Unduh ulang dengan:

```bash
node scripts/get-models.mjs
```

Dokumen privat disimpan di `var/uploads` dan hanya dapat diakses melalui route terautentikasi. Folder `var/` tidak masuk Git.

## Akun demo

Seeder membuat akun dengan password `demo1234`. Akun super admin memakai kredensial yang ditetapkan oleh environment saat menjalankan `seed-superadmin.ts`.
