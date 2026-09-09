import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
export async function GET(req:Request){
  const u=await getSessionUser(); if(!u) return Response.json({ok:false},{status:401});
  if (u.role === "employee") return Response.json({ok:false,error:"Hanya atasan/admin."},{status:403});
  const {searchParams}=new URL(req.url);
  const q=searchParams.get("q")??"";
  const from=searchParams.get("from");
  const to=searchParams.get("to");
  let sql=`SELECT * FROM audit_logs WHERE 1=1`; const p:any[]=[]; let i=1;
  if(q){ sql+=` AND (actor_name ILIKE $${i} OR action ILIKE $${i} OR detail ILIKE $${i})`; p.push(`%${q}%`); i++; }
  if(from){ sql+=` AND at >= $${i}`; p.push(from); i++; }
  if(to){ sql+=` AND at <= $${i}`; p.push(to); i++; }
  sql+=` ORDER BY at DESC LIMIT 200`;
  const r=await pool.query(sql,p);
  return Response.json({logs:r.rows});
}
