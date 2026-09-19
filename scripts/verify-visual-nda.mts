import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,base='http://127.0.0.1:3214';
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Only the isolated synthetic test project is allowed');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),browser=await chromium.launch();
const ids:string[]=[];let listing:string|undefined,filePath:string|undefined,signedPath:string|undefined;
const check=(r:{error:unknown})=>{if(r.error)throw Error(JSON.stringify(r.error));};
async function actor(role:string){
 const email=`visual-nda-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const user=await admin.auth.admin.createUser({email,password,email_confirm:true});check(user);const id=user.data.user!.id;ids.push(id);
 check(await admin.from('profiles').update({account_roles:[role]}).eq('user_id',id));
 const jar=new Map<string,string>();const auth=createServerClient(url!,key!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 check(await auth.auth.signInWithPassword({email,password}));const context=await browser.newContext();await context.addCookies([...jar].map(([name,value])=>({name,value,url:base,httpOnly:false,sameSite:'Lax'})));
 const page=await context.newPage();page.setDefaultTimeout(60000);return {id,page,context,auth};
}
try{
 const buyer=await actor('buyer'),broker=await actor('broker'),outsider=await actor('buyer');listing=randomUUID();
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 for(let i=1;i<=2;i++){const p=pdf.addPage([612,792]);p.drawText('SYNTHETIC NDA - NOT A REAL AGREEMENT',{x:45,y:725,size:17,font});p.drawText(`Page ${i}: synthetic visual signing rehearsal.`,{x:45,y:675,size:12,font});p.drawText('This file contains no customer information or binding terms.',{x:45,y:650,size:11,font});}
 const bytes=await pdf.save();filePath=`${broker.id}/listing-ndas/${randomUUID()}/visual.pdf`;
 check(await admin.from('marketplace_listings').insert({id:listing,broker_id:broker.id,title:'SYNTHETIC VISUAL NDA',summary:'Synthetic workflow only',industry:'Other',city:'Test',state_code:'OR',status:'draft'}));
 check(await admin.storage.from('deal-files').upload(filePath,bytes,{contentType:'application/pdf'}));
 check(await admin.from('listing_nda_templates').insert({listing_id:listing,broker_id:broker.id,document_name:'Synthetic visual NDA',template_body:'Synthetic test only',storage_path:filePath,security_status:'basic_validated',broker_attested:true}));
 check(await admin.from('billing_entitlements').insert({user_id:broker.id,product_code:'broker_plan',active:true,quantity:1,source_event_id:'synthetic-visual-nda'}));
 check(await admin.from('marketplace_listings').update({status:'published'}).eq('id',listing));
 await broker.page.goto(`${base}/en/dashboard/listings/${listing}/prepare-nda`);
 await broker.page.getByRole('button',{name:'Add Signature',exact:true}).click();await broker.page.getByLabel('Top (%)',{exact:true}).fill('70');
 await broker.page.getByRole('button',{name:'Position Signature 1',exact:true}).scrollIntoViewIfNeeded();
 const box=await broker.page.getByRole('button',{name:'Position Signature 1',exact:true}).boundingBox();if(!box)throw Error('Signature field missing');
 await broker.page.mouse.move(box.x+10,box.y+10);await broker.page.mouse.down();await broker.page.mouse.move(box.x+35,box.y+10,{steps:4});await broker.page.mouse.up();
 expect(Number(await broker.page.getByLabel('Left (%)',{exact:true}).inputValue())).toBeGreaterThan(8);
 await broker.page.getByRole('button',{name:'Add Date (UTC)',exact:true}).click();await broker.page.getByLabel('Top (%)',{exact:true}).fill('80');
 await broker.page.getByRole('button',{name:'Next page',exact:true}).click();
 await broker.page.getByRole('button',{name:'Add Initials',exact:true}).click();await broker.page.getByLabel('Top (%)',{exact:true}).fill('75');
 await broker.page.getByRole('button',{name:'Position Initials 3',exact:true}).press('ArrowRight');
 await broker.page.getByRole('button',{name:'Save fields for future NDAs',exact:true}).click();await broker.page.waitForURL(/saved=1/);
 const {data:template,error:templateError}=await admin.from('listing_nda_templates').select('*').eq('listing_id',listing).single();check({error:templateError});expect(template.signing_layout.fields).toHaveLength(3);expect(template.version).toBe(2);
 expect(template.signing_layout.fields[2].x).toBeCloseTo(.085);
 await broker.page.goto(`${base}/es/dashboard/listings/${listing}/prepare-nda`);await expect(broker.page.getByRole('heading',{name:'Preparar campos de firma',exact:true})).toBeVisible();
 // Deliver via the same authenticated insert used by automatic inquiry delivery.
 const deal=randomUUID(),nda=randomUUID();
 check(await admin.from('deal_inquiries').insert({id:deal,listing_id:listing,buyer_id:buyer.id,broker_id:broker.id,subject:'Synthetic visual workflow',initial_message:'Synthetic test only',status:'nda_sent'}));
 expect((await buyer.auth.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:template.document_name,template_body:template.template_body,storage_path:null,status:'sent',template_version:template.version,signature_record:{}})).error).toBeTruthy();
 check(await buyer.auth.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:template.document_name,template_body:template.template_body,storage_path:filePath,status:'sent',template_version:template.version,signature_record:{}}));
 expect((await buyer.auth.rpc('complete_deal_nda',{target_inquiry:deal,expected_nda:nda,expected_version:2,legal_name:'Forged bypass',fingerprint:'a'.repeat(64),file_sha256:'b'.repeat(64),ip_hash:null,locale:'en'})).error).toBeTruthy();
 await buyer.page.goto(`${base}/en/dashboard/deals/${deal}`);await buyer.page.getByRole('link',{name:'Review and sign on the PDF',exact:true}).click();
 await buyer.page.getByLabel('Full legal name',{exact:true}).fill('Synthetic Buyer');await buyer.page.getByLabel('Your initials',{exact:true}).fill('SB');
 await expect(buyer.page.getByRole('button',{name:'Confirm and sign NDA',exact:true})).toBeDisabled();
 await buyer.page.getByRole('button',{name:'Apply Signature 1',exact:true}).click();await buyer.page.getByRole('button',{name:'Apply Date (UTC) 2',exact:true}).click();
 await buyer.page.getByRole('button',{name:'Go to next required field',exact:true}).click();await buyer.page.getByRole('button',{name:'Apply Initials 3',exact:true}).click();
 for(const width of [1280,390]){await buyer.page.setViewportSize({width,height:900});expect(await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await buyer.page.screenshot({path:`/private/tmp/crestview-visual-sign-${width}.png`,fullPage:true});}
 await buyer.page.getByRole('combobox',{name:/PDF zoom/}).selectOption('2');await expect(buyer.page.getByRole('button',{name:'Apply Initials 3',exact:true})).toBeVisible();expect(await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await buyer.page.getByRole('combobox',{name:/PDF zoom/}).selectOption('1');
 const violations=(await new AxeBuilder({page:buyer.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 await buyer.page.getByRole('checkbox',{name:/I have reviewed the complete agreement/}).check();await buyer.page.getByRole('button',{name:'Confirm and sign NDA',exact:true}).click();await buyer.page.waitForURL(/\/agreement$/);
 await expect(buyer.page.getByRole('link',{name:'Download signed PDF',exact:true})).toBeVisible();
 const evidence=await(await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record`)).json();expect(Object.values(evidence.visual.field_values)).toContain('Synthetic Buyer');
 const signed=await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record?format=signed`);expect(signed.status()).toBe(200);const signedBytes=await signed.body();expect(createHash('sha256').update(signedBytes).digest('hex')).toBe(evidence.visual.sha256);expect((await PDFDocument.load(signedBytes)).getPageCount()).toBe(2);
 await writeFile('/private/tmp/crestview-visual-signed-synthetic.pdf',signedBytes);
 expect((await outsider.context.request.get(`${base}/api/deals/${deal}/signing-record?format=signed`)).status()).toBe(404);
 expect((await outsider.context.request.get(`${base}/api/nda-pdf/${nda}`)).status()).toBe(404);
 await broker.page.goto(`${base}/en/dashboard/deals/${deal}/agreement`);await expect(broker.page.getByRole('link',{name:'Download signed PDF',exact:true})).toBeVisible();
 const row=await admin.from('deal_nda_pdf_records').select('storage_path').eq('nda_id',nda).single();check(row);signedPath=row.data!.storage_path;
 expect((await buyer.auth.storage.from('signed-agreements').download(signedPath!)).error).toBeTruthy();
 console.log('PASS: field placement, keyboard adjustment, immutable snapshot, buyer signing, 2-page completed PDF, evidence hashes, role isolation, accessibility, mobile and desktop.');
}finally{
 await browser.close();
 // Capture any completed artifact even if a later assertion failed.
 if(listing&&!signedPath){const {data:deals}=await admin.from('deal_inquiries').select('id').eq('listing_id',listing);if(deals?.length){const {data:ndas}=await admin.from('deal_ndas').select('id').in('inquiry_id',deals.map(d=>d.id));if(ndas?.length){const {data:records}=await admin.from('deal_nda_pdf_records').select('storage_path').in('nda_id',ndas.map(n=>n.id));for(const r of records??[])check(await admin.storage.from('signed-agreements').remove([r.storage_path]));}}}
 if(signedPath)check(await admin.storage.from('signed-agreements').remove([signedPath]));if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));if(filePath)check(await admin.storage.from('deal-files').remove([filePath]));for(const id of ids)check(await admin.auth.admin.deleteUser(id));console.log('Synthetic visual rehearsal cleanup complete.');
}
