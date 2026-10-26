# Review HRIS

## Status

- Next.js 16 App Router, React 19, TypeScript, PostgreSQL.
- Guard akses dan branch scoping diterapkan pada API sensitif.
- Check-in server memvalidasi jadwal, geofence, wajah, liveness, WFH, dan risk.
- Upload privat disimpan di `var/uploads` melalui route terautentikasi.
- Data demo memiliki cabang Kantor Pusat, Bandung, Surabaya, dan Subang.

## Verifikasi

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Tindak lanjut

- Tambahkan integration test API untuk seluruh role dan branch.
- Tambahkan E2E browser untuk login, check-in, check-out, dan approval.
- Simpan snapshot identitas pada payslip historis.
- Dokumentasikan setup certificate untuk `npm run dev:lan`.
- Jalankan migration/seed hanya pada database demo; `src/db/seed.ts` menghapus data.
