import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
const HR=["hr_manager","hr_admin","super_admin"];
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; const b=await req.json() as Record<string,string>;
  await pool.query(`UPDATE branches SET name=COALESCE($1,name), city=COALESCE($2,city) WHERE id=$3`,[b.name??null,b.city??null,id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"Branch updated",targetType:"branch",targetId:id,detail:b.name??id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; await pool.query(`DELETE FROM branches WHERE id=$1`,[id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"Branch deleted",targetType:"branch",targetId:id,detail:id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
