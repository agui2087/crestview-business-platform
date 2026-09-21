import {verifySigningDelivery} from '@/lib/signing-delivery';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const reply=(status:number)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
 const secret=process.env.RESEND_WEBHOOK_SECRET;if(!secret)return reply(503);
 const reader=request.body?.getReader();if(!reader)return reply(400);
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return reply(413);}chunks.push(value);}}catch{return reply(400);}
 let event;try{event=verifySigningDelivery(Buffer.concat(chunks).toString('utf8'),request.headers,secret);}catch{return reply(400);}
 if(!event.state)return reply(204);
 const {data,error}=await createSupabaseAdminClient().rpc('record_signing_delivery',{event_id:event.id,email_id:event.providerId,delivery_state:event.state,event_time:event.occurredAt,event_code:event.code});
 // A callback can race the sending worker. Ask the provider to retry rather
 // than acknowledge and silently lose the delivery evidence.
 return reply(error||!data?503:204);
}
