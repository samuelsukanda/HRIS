import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit, writeNotification } from "@/lib/server/state";
const ADMIN=["hr_admin","hr_manager","super_admin","manager"];
export async function POST(req:Request){
  const u=await getSessionUser(); if(!u||!ADMIN.includes(u.role)) return Response.json({ok:false},{status:403});
  const {ids, approve}=await req.json() as {ids:string[], approve:boolean};
  if(!ids?.length) return Response.json({ok:false},{status:400});
  const approver=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  const status=approve?"approved":"rejected";
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    for(const id of ids){
      const r=await client.query(`SELECT employee_id FROM overtime_requests WHERE id=$1 AND status='pending'`,[id]);
      if(r.rows.length===0) continue;
      await client.query(`UPDATE overtime_requests SET status=$1, decided_by=$2 WHERE id=$3`,[status,approver,id]);
      await writeAudit({actorId:u.id,actorName:approver,action:approve?"Approved overtime":"Rejected overtime",targetType:"overtime_request",targetId:id,detail:status,before:"pending",after:status,at:new Date().toISOString()});
      const ur=await client.query(`SELECT id FROM users WHERE employee_id=$1`,[r.rows[0].employee_id]);
      if(ur.rows[0]) await writeNotification({userId:ur.rows[0].id,title:approve?"Lembur Disetujui":"Lembur Ditolak",body:`Lembur ${approve?"disetujui":"ditolak"} oleh ${approver}`,type:"info",link:"/app/lembur"});
    }
    await client.query("COMMIT");
  }catch(e){ await client.query("ROLLBACK"); throw e; } finally{ client.release(); }
  return Response.json({ok:true});
}
