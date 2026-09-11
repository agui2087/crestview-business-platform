import { createSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { resolveOpportunity } from '@/lib/opportunity-resolver';

export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
  if(!isSupabaseConfigured())return Response.json({error:'Export unavailable'},{status:503,headers});
  const db=await createSupabaseServerClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return Response.json({error:'Sign in required'},{status:401,headers});
  const url=new URL(request.url),key=url.searchParams.get('key')??'',locale=url.searchParams.get('locale')==='es'?'es':'en',es=locale==='es';
  if(!key || key.length>200)return Response.json({error:'Choose an opportunity'},{status:400,headers});
  try {
    const {data:pro,error}=await db.from('billing_entitlements').select('active,expires_at').eq('user_id',user.id).eq('product_code','crestview_pro').maybeSingle();
    if(error)throw error;
    if(!pro?.active || (pro.expires_at && new Date(pro.expires_at)<=new Date()))return Response.json({error:'Active Pro membership required'},{status:403,headers});
    const {data:plan,error:planError}=await db.from('saved_opportunities').select('stage,next_action,notes,updated_at').eq('user_id',user.id).eq('opportunity_key',key).maybeSingle();
    if(planError)throw planError;
    if(!plan)return Response.json({error:'Saved opportunity not found'},{status:404,headers});
    const opportunity=await resolveOpportunity(key,locale);
    if(!opportunity)return Response.json({error:'Opportunity unavailable'},{status:404,headers});
    const [tasks,findings]=await Promise.all([
      db.from('diligence_items').select('title,status,risk_level,due_date,assigned_role').eq('user_id',user.id).eq('opportunity_key',key).order('id').limit(1000),
      db.from('deal_document_findings').select('metric_name,reported_value,source_document,period_label,review_status').eq('user_id',user.id).eq('opportunity_key',key).order('id').limit(1000)
    ]);
    if(tasks.error || findings.error)throw new Error('Report unavailable');
    // Never silently present a truncated review as a complete report.
    if(tasks.data.length>=1000 || findings.data.length>=1000)return Response.json({error:'Report exceeds export limit'},{status:413,headers});
    const text=[es?'CRESTVIEW — INFORME DE DECISIÓN':'CRESTVIEW — DECISION REPORT',opportunity.title,new Date().toISOString(),
      `${es?'Etapa':'Stage'}: ${plan.stage}`,`${es?'Próxima acción':'Next action'}: ${plan.next_action??'—'}`,
      `${es?'Precio declarado':'Reported asking price'}: ${opportunity.price}`,`${es?'Ingresos declarados':'Reported revenue'}: ${opportunity.revenue}`,`${es?'Flujo declarado':'Reported cash flow'}: ${opportunity.cashFlow}`,'',
      es?'CHECKLIST — ESTADO / RIESGO / RESPONSABLE / FECHA':'CHECKLIST — STATUS / RISK / ROLE / DUE DATE',
      ...tasks.data.map(t=>`${t.title} | ${t.status} | ${t.risk_level} | ${t.assigned_role??'—'} | ${t.due_date??'—'}`),'',
      es?'HALLAZGOS INGRESADOS — FUENTE / PERIODO / REVISIÓN':'ENTERED FINDINGS — SOURCE / PERIOD / REVIEW',
      ...findings.data.map(f=>`${f.metric_name}: ${f.reported_value} | ${f.source_document} | ${f.period_label??'—'} | ${f.review_status}`),'',
      es?'NOTAS PRIVADAS':'PRIVATE NOTES',plan.notes??'—','',
      es?'Contiene información privada. Revisa antes de compartir. No es verificación independiente ni asesoría financiera o legal. Los estados son registros del usuario.':'Contains private information. Review before sharing. Not independent verification or financial/legal advice. Statuses are user-recorded.'
    ].join('\n');
    return new Response(text,{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':'attachment; filename="crestview-decision-report.txt"'}});
  }catch{return Response.json({error:'Report could not be loaded. Try again.'},{status:503,headers});}
}
