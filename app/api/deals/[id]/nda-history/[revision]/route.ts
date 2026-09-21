import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {matchesRecordedPdf} from '@/lib/signing-integrity';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export async function GET(request:Request,{params}:{params:Promise<{id:string;revision:string}>}){
 const p=z.object({id:z.string().uuid(),revision:z.string().uuid()}).safeParse(await params);
 const fail=(status:number,message:string)=>Response.json({error:message},{status,headers});if(!p.success)return fail(404,'Not found');
 const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)return fail(401,'Sign in');
 const {data:row,error}=await db.from('deal_nda_revisions').select('*').eq('id',p.data.revision).eq('inquiry_id',p.data.id).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
 if(error)return fail(503,'History unavailable');if(!row)return fail(404,'Not found');
 if(new URL(request.url).searchParams.get('format')==='original'){
  if(!row.agreement.storage_path)return fail(404,'This revision contains text, not a PDF. Download its revision record.');
  if(!row.original_sha256)return fail(409,'Original integrity record unavailable');
  const {data:file,error:fileError}=await createSupabaseAdminClient().storage.from('deal-files').download(row.agreement.storage_path);
  if(fileError||!file)return fail(503,'Original unavailable');const bytes=Buffer.from(await file.arrayBuffer());
  if(!matchesRecordedPdf(bytes,row.original_sha256))return fail(409,'Original integrity check failed');
  return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="crestview-unsigned-revision-${row.revision}.pdf"`}});
 }
 const {storage_path:storagePath,...agreement}=row.agreement;void storagePath;
 return Response.json({format:'crestview-unsigned-revision-v1',revision:row.revision,archived_at:row.archived_at,reason:row.reason,original_sha256:row.original_sha256,agreement,controls:row.controls,events:row.events,notice:'Preserved unsigned revision. Not a signed agreement. The current request must be reviewed separately.'},{headers:{...headers,'Content-Disposition':`attachment; filename="crestview-unsigned-revision-${row.revision}.json"`}});
}
