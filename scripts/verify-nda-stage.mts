import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,unlink} from 'node:fs/promises';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Isolated project only');
const admin=createClient(url,key,{auth:{persistSession:false}});
const fixture='/private/tmp/crestview-nda-stage-fixture.json';
const base='http://127.0.0.1:3216';
const check=(r:{error:unknown})=>{if(r.error)throw Error(JSON.stringify(r.error));};
type Person={id:string,email:string,password:string};
type Fixture={buyer:Person,broker:Person,outsider:Person,deal:string,nda:string,agreement:unknown,version:string};
async function person(role:string):Promise<Person>{
 const email=`nda-stage-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const r=await admin.auth.admin.createUser({email,password,email_confirm:true});check(r);
 const id=r.data.user!.id;check(await admin.from('profiles').update({account_roles:[role]}).eq('user_id',id));return{id,email,password};
}
async function auth(person:Person){
 const jar=new Map<string,string>();const client=createServerClient(url!,key!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 check(await client.auth.signInWithPassword(person));return{client,jar};
}
if(process.argv[2]==='seed'){
 const buyer=await person('buyer'),broker=await person('broker'),outsider=await person('buyer');
 const listing=await admin.from('marketplace_listings').insert({broker_id:broker.id,title:'Synthetic NDA stage rehearsal',summary:'Isolated synthetic workflow test, not a real business.',industry:'Testing',city:'Test',state_code:'OR',status:'draft'}).select('id').single();check(listing);
 const deal=await admin.from('deal_inquiries').insert({listing_id:listing.data!.id,buyer_id:buyer.id,broker_id:broker.id,subject:'Synthetic stage repair',initial_message:'Synthetic stage repair',status:'nda_sent'}).select('id').single();check(deal);
 const nda=await admin.from('deal_ndas').insert({inquiry_id:deal.data!.id,buyer_id:buyer.id,broker_id:broker.id,document_name:'Synthetic test agreement only',template_body:'Synthetic test agreement for workflow testing only. No real transaction.',status:'sent',template_version:1}).select('id').single();check(nda);
 const signed=await auth(buyer);check(await signed.client.rpc('complete_deal_nda',{target_inquiry:deal.data!.id,expected_nda:nda.data!.id,expected_version:1,legal_name:'Synthetic Test Buyer',fingerprint:'a'.repeat(64),file_sha256:null,ip_hash:null,locale:'en'}));
 const agreement=await admin.from('deal_ndas').select('*').eq('id',nda.data!.id).single();check(agreement);
 const legacy=await admin.from('deal_inquiries').update({status:'nda_sent'}).eq('id',deal.data!.id).select('updated_at').single();check(legacy);
 for(const access_level of ['broker_only','approved','nda_signed'])check(await admin.from('deal_room_documents').insert({inquiry_id:deal.data!.id,uploaded_by:broker.id,title:`Synthetic ${access_level}`,access_level}));
 await writeFile(fixture,JSON.stringify({buyer,broker,outsider,deal:deal.data!.id,nda:nda.data!.id,agreement:agreement.data,version:legacy.data!.updated_at}),{mode:0o600});
 console.log('Synthetic signed-NDA/old-stage mismatch prepared in isolated database.');
}else{
 const f:Fixture=JSON.parse(await readFile(fixture,'utf8'));
 if(process.argv[2]==='cleanup'){
  for(const p of [f.buyer,f.broker,f.outsider])check(await admin.auth.admin.deleteUser(p.id));await unlink(fixture);console.log('Synthetic accounts and fixture removed.');
 }else{
  const browser=await chromium.launch();
  try{
   const before=await admin.from('deal_ndas').select('*').eq('id',f.nda).single();check(before);expect(before.data).toEqual(f.agreement);
   const state=await admin.from('deal_inquiries').select('status,financial_access_status').eq('id',f.deal).single();check(state);expect(state.data).toEqual({status:'nda_signed',financial_access_status:'not_requested'});
   const buyer=await auth(f.buyer),broker=await auth(f.broker),outsider=await auth(f.outsider);
   expect((await buyer.client.from('deal_room_documents').select('access_level').eq('inquiry_id',f.deal)).data).toEqual([{access_level:'nda_signed'}]);
   expect((await outsider.client.from('deal_ndas').select('id').eq('id',f.nda)).data).toEqual([]);
   expect((await broker.client.rpc('advance_my_broker_inquiry',{p_inquiry:f.deal,p_expected:f.version,p_status:'document_review'})).error).not.toBeNull();
   const pages=[];
   for(const actor of [buyer,broker]){
    const context=await browser.newContext();await context.addCookies([...actor.jar].map(([name,value])=>({name,value,url:base,sameSite:'Lax' as const})));pages.push(await context.newPage());
   }
   const [bp,rp]=pages;
   await bp.goto(`${base}/en/dashboard/deals/${f.deal}`);await expect(bp.locator('.deal-overview-strip')).toContainText('NDA signed');
   await rp.goto(`${base}/en/dashboard/deals/${f.deal}`);await expect(rp.getByLabel('Next deal stage')).toBeVisible();
   await rp.getByLabel('Next deal stage').selectOption('document_review');await rp.locator('form').filter({has:rp.getByLabel('Next deal stage')}).getByRole('button').click();
   await expect(rp).toHaveURL(/stage=updated/);
   await bp.reload();await expect(bp.locator('.deal-overview-strip')).toContainText('Document review');
   await bp.locator('[name=financial_request_message]').fill('Synthetic request to review the financial statements.');
   await bp.locator('[name=financial_request_timeline]').selectOption('Within 6 months');await bp.locator('[name=financial_request_capital]').selectOption('Exploring financing');
   await bp.locator('form').filter({has:bp.locator('[name=financial_request_message]')}).getByRole('button').click();
   await expect.poll(async()=>(await admin.from('deal_inquiries').select('financial_access_status').eq('id',f.deal).single()).data?.financial_access_status).toBe('requested');
   expect((await buyer.client.from('deal_room_documents').select('access_level').eq('inquiry_id',f.deal)).data).toEqual([{access_level:'nda_signed'}]);
   await rp.reload();await rp.getByRole('button',{name:'Approve access',exact:true}).first().click();
   await expect.poll(async()=>(await admin.from('deal_inquiries').select('financial_access_status').eq('id',f.deal).single()).data?.financial_access_status).toBe('approved');
   expect((await buyer.client.from('deal_room_documents').select('access_level').eq('inquiry_id',f.deal)).data?.map(x=>x.access_level).sort()).toEqual(['approved','nda_signed']);
   for(const locale of ['en','es']){await bp.setViewportSize({width:390,height:844});await bp.goto(`${base}/${locale}/dashboard/deals/${f.deal}`);await expect(bp.locator('.deal-overview-strip')).toContainText('Document review');expect(await bp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
   expect((await admin.from('deal_ndas').select('*').eq('id',f.nda).single()).data).toEqual(f.agreement);
   console.log('PASS: repaired signed evidence unchanged, buyer/broker stage agreement, browser advancement, stale rejection, financial request/approval, no premature document access, outsider denial, EN/ES phone layout.');
  }finally{await browser.close();}
 }
}
