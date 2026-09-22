import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Isolated test configuration required');
const base='http://127.0.0.1:3216';
const admin=createClient(url,key,{auth:{persistSession:false}});
const users:string[]=[];let listing:string|undefined;let path:string|undefined;
const check=(r:{error:unknown})=>{if(r.error)throw Error(JSON.stringify(r.error));};
async function actor(role:string){
 const email=`file-access-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});check(created);
 const id=created.data.user!.id;users.push(id);
 check(await admin.from('profiles').update({account_roles:[role]}).eq('user_id',id));
 const jar=new Map<string,string>();
 const client=createServerClient(url!,key!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 check(await client.auth.signInWithPassword({email,password}));
 return{id,client,cookie:()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ')};
}
try{
 const buyer=await actor('buyer'),broker=await actor('broker'),outsider=await actor('buyer');
 listing=randomUUID();const deal=randomUUID(),nda=randomUUID(),doc=randomUUID();
 check(await admin.from('marketplace_listings').insert({id:listing,broker_id:broker.id,title:'SYNTHETIC FILE ACCESS TEST',summary:'Synthetic isolated test only.',industry:'Other',city:'Test',state_code:'OR',status:'draft'}));
 check(await admin.from('deal_inquiries').insert({id:deal,listing_id:listing,buyer_id:buyer.id,broker_id:broker.id,subject:'Synthetic file test',initial_message:'Synthetic file test',status:'nda_sent'}));
 check(await admin.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:'Synthetic agreement',template_body:'Synthetic testing agreement only.',status:'sent',template_version:1}));
 path=`${broker.id}/deal-rooms/${deal}/${randomUUID()}-synthetic.csv`;
 const bytes='category,amount\nsynthetic,1\n';
 check(await admin.storage.from('deal-files').upload(path,Buffer.from(bytes),{contentType:'text/csv'}));
 check(await admin.from('deal_room_documents').insert({id:doc,inquiry_id:deal,uploaded_by:broker.id,title:'Synthetic private file',storage_path:path,mime_type:'text/csv',original_filename:'synthetic.csv',security_status:'basic_validated',access_level:'nda_signed'}));
 const endpoint=`${base}/en/dashboard/deals/${deal}/documents/${doc}/file?download=1`;
 const get=(cookie='')=>fetch(endpoint,{headers:{cookie},redirect:'manual',signal:AbortSignal.timeout(30000)});
 assert.equal((await get()).status,404);
 assert.equal((await get(outsider.cookie())).status,404);
 assert.equal((await get(buyer.cookie())).status,404);
 assert.equal((await get(broker.cookie())).status,200);
 check(await buyer.client.rpc('complete_deal_nda',{target_inquiry:deal,expected_nda:nda,expected_version:1,legal_name:'Synthetic Buyer',fingerprint:'a'.repeat(64),file_sha256:null,ip_hash:null,locale:'en'}));
 const allowed=await get(buyer.cookie());assert.equal(allowed.status,200);assert.equal(await allowed.text(),bytes);
 assert.match(allowed.headers.get('cache-control')!,/no-store/);
 assert.match(allowed.headers.get('content-disposition')!,/synthetic.csv/);
 assert.equal(allowed.headers.get('location'),null);
 check(await broker.client.rpc('change_deal_document_access',{target_document:doc,expected_access:'nda_signed',new_access:'broker_only'}));
 assert.equal((await get(buyer.cookie())).status,404,'Previously used URL must reject access after revocation');
 assert.equal((await get(broker.cookie())).status,200);
 check(await broker.client.rpc('change_deal_document_access',{target_document:doc,expected_access:'broker_only',new_access:'approved'}));
 assert.equal((await get(buyer.cookie())).status,404,'NDA alone must not release financial-approval files');
 check(await admin.from('deal_room_documents').update({is_active:false}).eq('id',doc));
 assert.equal((await get(broker.cookie())).status,404,'Inactive files cannot be opened using old links');
 console.log('PASS: real storage bytes, signed-out/outsider/pre-NDA denial, signed buyer open, immediate repeat-link revocation, broker access, separate financial approval and inactive-file denial.');
}finally{
 if(path)check(await admin.storage.from('deal-files').remove([path]));
 if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));
 for(const id of users)check(await admin.auth.admin.deleteUser(id));
 console.log('Synthetic files, records and accounts removed.');
}
