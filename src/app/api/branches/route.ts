import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { nextId, writeAudit } from "@/lib/server/state";
const HR=["hr_manager","hr_admin","super_admin"];
export async function GET(){ const u=await getSessionUser(); if(!u) return Response.json({ok:false},{status:401}); const r=await pool.query(`SELECT * FROM branches ORDER BY id`); return Response.json({branches:r.rows}); }
export async function POST(req:Request){ const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403}); const b=await req.json() as Record<string,string>; if(!b.name||!b.city) return Response.json({ok:false,error:"Field wajib"},{status:400}); const id=await nextId("branches","BR"); await pool.query(`INSERT INTO branches (id,name,city) VALUES ($1,$2,$3)`,[id,b.name,b.city]); const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id; await writeAudit({actorId:u.id,actorName:n,action:"Branch created",targetType:"branch",targetId:id,detail:b.name,at:new Date().toISOString()}); return Response.json({ok:true,id}); }
