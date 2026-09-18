import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Isolated test configuration required');
const boundedFetch:typeof fetch=async(input,init)=>{
 const response=await fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(String(input).includes('/rpc/change_deal_document_access')){
  const body=JSON.parse(String(init?.body??'{}'));
  console.log('Permission response',body.expected_access,body.new_access,response.status,response.headers.get('cf-cache-status'));
 }
 return response;
};
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:boundedFetch}});
const ids:string[]=[];let listing:string|undefined;
const check=(result:{error:unknown})=>{if(result.error)throw Error(JSON.stringify(result.error));};
async function actor(role:string){
 console.log(`Preparing synthetic ${role} account`);
 const email=`sharing-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const result=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{role}});check(result);
 const id=result.data.user!.id;ids.push(id);
 const client=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:boundedFetch}});
 check(await client.auth.signInWithPassword({email,password}));return {id,client};
}
try{
 const buyer=await actor('buyer'),broker=await actor('broker'),outsider=await actor('buyer');
 listing=randomUUID();const deal=randomUUID(),nda=randomUUID(),doc=randomUUID();
 check(await admin.from('marketplace_listings').insert({id:listing,broker_id:broker.id,title:'SYNTHETIC SHARING CHECK',summary:'Synthetic test only',industry:'Other',city:'Test',state_code:'OR',status:'draft'}));
 check(await admin.from('deal_inquiries').insert({id:deal,listing_id:listing,buyer_id:buyer.id,broker_id:broker.id,subject:'Synthetic test',initial_message:'Synthetic test',status:'nda_sent'}));
 check(await admin.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:'Synthetic agreement',template_body:'Synthetic agreement for automated testing only.',status:'sent',template_version:1}));
 check(await admin.from('deal_room_documents').insert({id:doc,inquiry_id:deal,uploaded_by:broker.id,title:'Synthetic private document',access_level:'broker_only'}));
 const signature={target_inquiry:deal,expected_nda:nda,expected_version:1,legal_name:'Synthetic Buyer',fingerprint:'a'.repeat(64),file_sha256:null,ip_hash:null,locale:'en'};
 assert.ok((await outsider.client.rpc('complete_deal_nda',signature)).error);
 assert.ok((await broker.client.rpc('complete_deal_nda',signature)).error);
 assert.equal((await buyer.client.rpc('complete_deal_nda',{...signature,expected_version:2})).error?.code,'P0001');
 check(await buyer.client.rpc('complete_deal_nda',signature));
 assert.equal((await buyer.client.rpc('complete_deal_nda',signature)).error?.code,'P0001');
 assert.ok((await broker.client.from('deal_ndas').update({signer_name:'Changed'}).eq('id',nda)).error);
 const change={target_document:doc,expected_access:'broker_only',new_access:'nda_signed'};
 const visibleBefore=await buyer.client.from('deal_room_documents').select('id').eq('id',doc);check(visibleBefore);assert.equal(visibleBefore.data?.length,0);
 assert.ok((await buyer.client.rpc('change_deal_document_access',change)).error);
 assert.ok((await outsider.client.rpc('change_deal_document_access',change)).error);
 check(await broker.client.rpc('change_deal_document_access',change));
 const visibleShared=await buyer.client.from('deal_room_documents').select('id').eq('id',doc);check(visibleShared);assert.equal(visibleShared.data?.length,1);
 assert.equal((await broker.client.rpc('change_deal_document_access',change)).error?.code,'P0001');
 check(await broker.client.rpc('change_deal_document_access',{...change,expected_access:'nda_signed',new_access:'broker_only'}));
 const actual=await admin.from('deal_room_documents').select('access_level').eq('id',doc).single();check(actual);
 const evidence=await admin.from('marketplace_audit_events').select('details').eq('inquiry_id',deal).eq('event_type','document_access_changed');check(evidence);assert.equal(evidence.data?.length,2);
 assert.equal(actual.data?.access_level,'broker_only','Revocation must persist');
 const visibleRevoked=await buyer.client.from('deal_room_documents').select('id').eq('id',doc);check(visibleRevoked);assert.equal(visibleRevoked.data?.length,0);
 const saved=await admin.from('deal_ndas').select('status,signature_record').eq('id',nda).single();check(saved);
 assert.equal(saved.data!.status,'signed');assert.equal(saved.data!.signature_record.record_version,2);
 console.log('PASS: connected signing, stale/replay protection, signed-record preservation, and sharing authorization.');
}finally{
 if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));
 for(const id of ids)check(await admin.auth.admin.deleteUser(id));
 console.log('Synthetic test cleanup complete.');
}
