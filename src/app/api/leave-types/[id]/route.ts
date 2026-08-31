import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
const HR=["hr_manager","hr_admin","super_admin"];
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; const b=await req.json() as Record<string,any>;
  await pool.query(`UPDATE leave_types SET name=COALESCE($1,name), allocation_days=COALESCE($2,allocation_days), paid=COALESCE($3,paid), requires_attachment=COALESCE($4,requires_attachment) WHERE id=$5`,[b.name??null,b.allocation_days??b.allocationDays??null,b.paid??null,b.requires_attachment??b.requiresAttachment??null,id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"LeaveType updated",targetType:"leave_type",targetId:id,detail:b.name??id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!HR.includes(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; await pool.query(`DELETE FROM leave_types WHERE id=$1`,[id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"LeaveType deleted",targetType:"leave_type",targetId:id,detail:id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
