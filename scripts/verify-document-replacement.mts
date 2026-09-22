import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Isolated project only');
const admin=createClient(url,key,{auth:{persistSession:false}}),base='http://127.0.0.1:3216';
const users:string[]=[];let listing:string|undefined;let deal:string|undefined;
const check=(r:{error:unknown})=>{if(r.error)throw Error(JSON.stringify(r.error));};
async function actor(role:string){
 const email=`replacement-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const r=await admin.auth.admin.createUser({email,password,email_confirm:true});check(r);const id=r.data.user!.id;users.push(id);
 check(await admin.from('profiles').update({account_roles:[role]}).eq('user_id',id));
 const jar=new Map<string,string>();const client=createServerClient(url!,key!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 check(await client.auth.signInWithPassword({email,password}));return{id,jar,client};
}
const browser=await chromium.launch();
try{
 const broker=await actor('broker'),buyer=await actor('buyer'),outsider=await actor('buyer');
 const l=await admin.from('marketplace_listings').insert({broker_id:broker.id,title:'Synthetic replacement test',summary:'Isolated synthetic test only.',industry:'Other',city:'Test',state_code:'OR',status:'draft'}).select('id').single();check(l);listing=l.data!.id;
 const d=await admin.from('deal_inquiries').insert({listing_id:listing,broker_id:broker.id,buyer_id:buyer.id,subject:'Synthetic replacement',initial_message:'Synthetic replacement',status:'nda_sent'}).select('id').single();check(d);deal=d.data!.id;
 const n=await admin.from('deal_ndas').insert({inquiry_id:deal,broker_id:broker.id,buyer_id:buyer.id,document_name:'Synthetic NDA',template_body:'Synthetic testing agreement only.',template_version:1,status:'sent'}).select('id').single();check(n);
 check(await buyer.client.rpc('complete_deal_nda',{target_inquiry:deal,expected_nda:n.data!.id,expected_version:1,legal_name:'Synthetic Buyer',fingerprint:'a'.repeat(64),file_sha256:null,ip_hash:null,locale:'en'}));
 const context=await browser.newContext();await context.addCookies([...broker.jar].map(([name,value])=>({name,value,url:base})));
 const page=await context.newPage();await page.goto(`${base}/en/dashboard/deals/${deal}`);
 const upload=page.locator('#deal-upload form');
 await upload.locator('[name=document_file]').setInputFiles({name:'synthetic-original.csv',mimeType:'text/csv',buffer:Buffer.from('year,revenue\n2025,10\n')});
 await upload.locator('[name=title]').fill('Synthetic statement');await upload.locator('[name=access_level]').selectOption('nda_signed');
 await upload.getByRole('button',{name:'Save document',exact:true}).click();await expect(page).toHaveURL(/document=saved/);
 const original=await admin.from('deal_room_documents').select('*').eq('inquiry_id',deal).single();check(original);
 const old=original.data!;
 const req=await admin.from('deal_document_requests').insert({inquiry_id:deal,requested_by:buyer.id,item_name:'Synthetic statement',status:'fulfilled',document_id:old.id,resolved_at:new Date().toISOString()}).select('id').single();check(req);
 const card=page.locator('.room-documents article').filter({has:page.getByText('Synthetic statement',{exact:true})});
 await card.getByText('Replace with a new version',{exact:true}).click();
  const replacement=card.locator('form').filter({has:page.locator('[name=replace_document_id]')});
 await replacement.locator('[name=replacement_note]').fill('Invalid file should not replace the original');
 await replacement.locator('[name=document_file]').setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('This is not a PDF file.')});
 await replacement.getByRole('button',{name:'Save new version',exact:true}).click();await expect(page).toHaveURL(/error=document_file/);
 expect((await admin.from('deal_room_documents').select('is_active').eq('id',old.id).single()).data?.is_active).toBe(true);
 await card.getByText('Replace with a new version',{exact:true}).click();
 await replacement.locator('[name=replacement_note]').fill('Corrected synthetic annual figures');
 await replacement.locator('[name=document_file]').setInputFiles({name:'synthetic-updated.csv',mimeType:'text/csv',buffer:Buffer.from('year,revenue\n2025,20\n')});
 await replacement.getByRole('button',{name:'Save new version',exact:true}).click();await expect(page).toHaveURL(/document=replaced/);
 const fresh=await admin.from('deal_room_documents').select('*').eq('inquiry_id',deal).eq('is_active',true).single();check(fresh);
 expect(fresh.data!.version).toBe(2);expect(fresh.data!.access_level).toBe('nda_signed');expect(fresh.data!.replaces_document_id).toBe(old.id);
 expect((await admin.from('deal_document_requests').select('document_id').eq('id',req.data!.id).single()).data?.document_id).toBe(fresh.data!.id);
 expect((await admin.storage.from('deal-files').download(old.storage_path)).data).not.toBeNull();
 expect((await buyer.client.storage.from('deal-files').download(old.storage_path)).error).not.toBeNull();
 expect((await buyer.client.from('deal_room_documents').select('id').eq('id',old.id)).data).toEqual([]);
 const buyerContext=await browser.newContext();await buyerContext.addCookies([...buyer.jar].map(([name,value])=>({name,value,url:base})));
 const fileUrl=`${base}/en/dashboard/deals/${deal}/documents/${fresh.data!.id}/file?download=1`;
 const downloaded=await buyerContext.request.get(fileUrl);expect(downloaded.status()).toBe(200);expect(await downloaded.text()).toBe('year,revenue\n2025,20\n');
 expect((await buyerContext.request.get(`${base}/en/dashboard/deals/${deal}/documents/${old.id}/file`)).status()).toBe(404);
 expect((await outsider.client.from('deal_room_documents').select('id').eq('inquiry_id',deal)).data).toEqual([]);
 expect((await broker.client.rpc('replace_deal_document',{p_original:old.id,p_candidate:fresh.data!.id,p_version:1,p_access:'nda_signed',p_note:'Stale retry'})).error).not.toBeNull();
 expect((await buyer.client.rpc('replace_deal_document',{p_original:old.id,p_candidate:fresh.data!.id,p_version:1,p_access:'nda_signed',p_note:'Unauthorized'})).error).not.toBeNull();
 for(const locale of ['en','es']){
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/${locale}/dashboard/deals/${deal}`);
  await expect(page.getByText(locale==='es'?'Historial de versiones anteriores':'Previous version history',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByText(locale==='es'?'Historial de versiones anteriores':'Previous version history',{exact:true}).click();
  await page.locator('.secure-room').screenshot({path:`/private/tmp/crestview-replacement-${locale}-phone.png`});
 }
 check(await broker.client.rpc('change_deal_document_access',{target_document:fresh.data!.id,expected_access:'nda_signed',new_access:'approved'}));
 expect((await buyer.client.from('deal_room_documents').select('id').eq('id',fresh.data!.id)).data).toEqual([]);
 expect((await buyerContext.request.get(fileUrl)).status()).toBe(404);
 console.log('PASS: actual screened browser uploads/replacement, rejected invalid file preserves original, version 2, inherited sharing, rebound request, new bytes downloaded/old URL denied, archived storage denial, outsider/stale/buyer denial, separate financial approval, EN/ES phone layout.');
}finally{
 if(deal){const files=await admin.from('deal_room_documents').select('storage_path').eq('inquiry_id',deal);check(files);const paths=(files.data??[]).map(x=>x.storage_path).filter(Boolean);if(paths.length)check(await admin.storage.from('deal-files').remove(paths));}
 if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));
 for(const id of users)check(await admin.auth.admin.deleteUser(id));
 await browser.close();console.log('Synthetic records, accounts and files removed.');
}
