import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit } from "@/lib/server/state";
import { isHr } from "@/lib/roles";
export async function GET(){ const u=await getSessionUser(); if(!u) return Response.json({ok:false},{status:401}); const r=await pool.query(`SELECT * FROM departments ORDER BY id`); return Response.json({departments:r.rows}); }
export async function POST(req:Request){ const u=await getSessionUser(); if(!u||!isHr(u.role)) return Response.json({ok:false},{status:403}); const b=await req.json() as Record<string,string>; if(!b.name||!b.branch_id) return Response.json({ok:false,error:"Field wajib"},{status:400}); const id=await nextId("departments","DP"); await pool.query(`INSERT INTO departments (id,name,branch_id) VALUES ($1,$2,$3)`,[id,b.name,b.branch_id]); const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id; await writeAudit({actorId:u.id,actorName:n,action:"Department created",targetType:"department",targetId:id,detail:b.name,at:new Date().toISOString()}); return Response.json({ok:true,id}); }
