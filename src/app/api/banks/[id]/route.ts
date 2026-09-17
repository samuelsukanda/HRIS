import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
const HR=["hr_manager","hr_admin","super_admin"];
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; const b=await req.json() as Record<string,string>; const name=b.name?.trim();
  if(!name) return Response.json({ok:false,error:"Nama bank wajib diisi"},{status:400});
  const dup=await pool.query(`SELECT 1 FROM banks WHERE lower(name)=lower($1) AND id<>$2`,[name,id]); if(dup.rowCount) return Response.json({ok:false,error:"Bank sudah terdaftar"},{status:400});
  await pool.query(`UPDATE banks SET name=$1 WHERE id=$2`,[name,id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"Bank updated",targetType:"bank",targetId:id,detail:name,at:new Date().toISOString()});
  return Response.json({ok:true});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; await pool.query(`DELETE FROM banks WHERE id=$1`,[id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"Bank deleted",targetType:"bank",targetId:id,detail:id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
