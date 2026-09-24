import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { isHr } from "@/lib/roles";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!isHr(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; const b=await req.json() as Record<string,string>;
  await pool.query(`UPDATE branches SET name=COALESCE($1,name), city=COALESCE($2,city) WHERE id=$3`,[b.name??null,b.city??null,id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"Branch updated",targetType:"branch",targetId:id,detail:b.name??id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!isHr(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params;
  try{
    await pool.query(`DELETE FROM branches WHERE id=$1`,[id]);
    const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
    await writeAudit({actorId:u.id,actorName:n,action:"Branch deleted",targetType:"branch",targetId:id,detail:id,at:new Date().toISOString()});
    return Response.json({ok:true});
  }catch(e){
    if((e as {code?:string}).code==="23503") return Response.json({ok:false,error:"Cabang masih dipakai data lain (karyawan/departemen) dan tidak bisa dihapus."},{status:409});
    return Response.json({ok:false,error:"Gagal menghapus cabang."},{status:500});
  }
}
