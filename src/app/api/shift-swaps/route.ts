import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";
export async function POST(req:Request){
  const u=await getSessionUser(); if(!u) return Response.json({ok:false},{status:401});
  const {date, targetShiftId, reason}=await req.json() as {date:string, targetShiftId:string, reason:string};
  if(!date) return Response.json({ok:false,error:"Tanggal wajib"},{status:400});
  const emp=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:emp,action:"Shift swap requested",targetType:"roster",targetId:`${u.employee_id}-${date}`,detail:`${date} → ${targetShiftId||"Off"}: ${reason||""}`,at:new Date().toISOString()});
  const mgrs=await pool.query(`SELECT id FROM users WHERE role IN ('hr_manager','hr_admin','super_admin','manager')`);
  for(const m of mgrs.rows) await writeNotification({userId:m.id,title:"Permintaan Tukar Shift",body:`${emp} ajukan tukar shift ${date} → ${targetShiftId||"Off"}`,type:"approval",link:"/admin/jadwal"});
  return Response.json({ok:true});
}
