import { applySchema, pool } from "./client";
import { hashPassword } from "../lib/server/auth";

const EMP_ID = "EMP-SUPERADMIN";
const USER_ID = "USR-SUPERADMIN";
const EMAIL = process.env.SUPERADMIN_EMAIL ?? "superadmin@hrissmart.id";
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin123!";

async function main() {
  await applySchema();
  const q = async (text: string, values?: unknown[]) => pool.query(text, values);

  // Master data minimal sebagai referensi FK karyawan superadmin (idempotent)
  await q(`INSERT INTO branches (id,name,city) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    "BR-SA", "Kantor Pusat", "Jakarta",
  ]);
  await q(`INSERT INTO departments (id,name,branch_id) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    "DEP-SA", "Manajemen", "BR-SA",
  ]);
  await q(`INSERT INTO positions (id,title,level) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [
    "POS-SA", "Super Admin", "director",
  ]);
  await q(
    `INSERT INTO work_locations (id,name,branch_id,latitude,longitude,radius_m,allowed_types)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    ["LOC-SA", "Kantor Pusat Jakarta", "BR-SA", -6.2088, 106.8456, 100, ["onsite", "wfh"]],
  );

  await q(
    `INSERT INTO employees (id,nik,name,gender,birth_place,birth_date,address,phone,email,join_date,
      department_id,position_id,branch_id,work_location_id,employment_type,status,
      bank_name,bank_account,emergency_contact,face_registered)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
    [
      EMP_ID, "3201010101900001", "Super Admin", "L", "Jakarta", "1990-01-01",
      "Jl. Kantor Pusat No. 1, Jakarta", "081200000001", EMAIL, "2020-01-01",
      "DEP-SA", "POS-SA", "BR-SA", "LOC-SA", "permanent", "active",
      "BCA", "0000000001",
      JSON.stringify({ name: "Admin Darurat", relation: "keluarga", phone: "081200000002" }),
      false,
    ],
  );

  await q(
    `INSERT INTO users (id,employee_id,email,role,password_hash,active)
     VALUES ($1,$2,$3,'super_admin',$4,true)
     ON CONFLICT (email) DO UPDATE SET
       employee_id = EXCLUDED.employee_id,
       role = 'super_admin',
       password_hash = EXCLUDED.password_hash,
       active = true`,
    [USER_ID, EMP_ID, EMAIL, hashPassword(PASSWORD)],
  );

  console.log(`Superadmin siap — login dengan email: ${EMAIL}, password: ${PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
