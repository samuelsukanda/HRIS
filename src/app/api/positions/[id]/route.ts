import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { isHr } from "@/lib/roles";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!isHr(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params; const b=await req.json() as Record<string,string>;
  await pool.query(`UPDATE positions SET title=COALESCE($1,title), level=COALESCE($2,level) WHERE id=$3`,[b.title??null,b.level??null,id]);
  const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
  await writeAudit({actorId:u.id,actorName:n,action:"Position updated",targetType:"position",targetId:id,detail:b.title??id,at:new Date().toISOString()});
  return Response.json({ok:true});
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  const u=await getSessionUser(); if(!u||!isHr(u.role)) return Response.json({ok:false},{status:403});
  const {id}=await params;
  try{
    await pool.query(`DELETE FROM positions WHERE id=$1`,[id]);
    const n=(await pool.query(`SELECT name FROM employees WHERE id=$1`,[u.employee_id])).rows[0]?.name??u.employee_id;
    await writeAudit({actorId:u.id,actorName:n,action:"Position deleted",targetType:"position",targetId:id,detail:id,at:new Date().toISOString()});
    return Response.json({ok:true});
  }catch(e){
    if((e as {code?:string}).code==="23503") return Response.json({ok:false,error:"Jabatan masih dipakai data karyawan dan tidak bisa dihapus."},{status:409});
    return Response.json({ok:false,error:"Gagal menghapus jabatan."},{status:500});
  }
}
