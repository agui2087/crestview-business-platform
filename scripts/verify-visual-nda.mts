import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,base='http://127.0.0.1:3214';
const dual=process.env.NDA_COUNTERSIGN_TEST==='1';
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
 if(dual){
  await broker.page.getByRole('button',{name:'Add Signature',exact:true}).click();await broker.page.getByLabel('Top (%)',{exact:true}).fill('55');await broker.page.getByLabel('Assigned signer',{exact:true}).selectOption('broker');
  await broker.page.getByRole('button',{name:'Add Company',exact:true}).click();await broker.page.getByLabel('Top (%)',{exact:true}).fill('40');
  await broker.page.getByRole('button',{name:'Add Checkbox',exact:true}).click();await broker.page.getByLabel('Top (%)',{exact:true}).fill('30');await broker.page.getByLabel('Field label',{exact:true}).fill('Required acknowledgement');
 }
 await broker.page.getByRole('button',{name:'Save fields for future NDAs',exact:true}).click();await broker.page.waitForURL(/saved=1/);
 const {data:template,error:templateError}=await admin.from('listing_nda_templates').select('*').eq('listing_id',listing).single();check({error:templateError});expect(template.signing_layout.fields).toHaveLength(dual?6:3);expect(template.version).toBe(2);
 if(dual){await broker.page.getByLabel('Preset name',{exact:true}).fill('Synthetic reusable layout');await broker.page.getByRole('button',{name:'Save current saved layout as preset',exact:true}).click();await expect(broker.page.getByLabel('Preset name',{exact:true})).toHaveValue('');await broker.page.getByLabel('Reuse a saved layout for this PDF',{exact:true}).selectOption({label:'Synthetic reusable layout'});}
 expect(template.signing_layout.fields[2].x).toBeCloseTo(.085);
 await broker.page.goto(`${base}/es/dashboard/listings/${listing}/prepare-nda`);await expect(broker.page.getByRole('heading',{name:'Preparar campos de firma',exact:true})).toBeVisible();
 // Deliver via the same authenticated insert used by automatic inquiry delivery.
 const deal=randomUUID(),nda=randomUUID();
 check(await admin.from('deal_inquiries').insert({id:deal,listing_id:listing,buyer_id:buyer.id,broker_id:broker.id,subject:'Synthetic visual workflow',initial_message:'Synthetic test only',status:'nda_sent'}));
 expect((await buyer.auth.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:template.document_name,template_body:template.template_body,storage_path:null,status:'sent',template_version:template.version,signature_record:{}})).error).toBeTruthy();
 check(await buyer.auth.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:template.document_name,template_body:template.template_body,storage_path:filePath,status:'sent',template_version:template.version,signature_record:{}}));
 if(dual){await broker.page.goto(`${base}/en/dashboard/deals/${deal}/sign`);await expect(broker.page.getByText('This request is not available for your signature yet.',{exact:false})).toBeVisible();}
 expect((await buyer.auth.rpc('complete_deal_nda',{target_inquiry:deal,expected_nda:nda,expected_version:2,legal_name:'Forged bypass',fingerprint:'a'.repeat(64),file_sha256:'b'.repeat(64),ip_hash:null,locale:'en'})).error).toBeTruthy();
 await buyer.page.goto(`${base}/en/dashboard/deals/${deal}`);await buyer.page.getByRole('link',{name:'Review and sign on the PDF',exact:true}).click();
 const consent=buyer.page.getByRole('checkbox',{name:/I have reviewed the complete agreement/});
 await consent.check();await buyer.page.getByLabel('Full legal name',{exact:true}).fill('Changed name');await expect(consent).not.toBeChecked();
 await consent.check();await buyer.page.getByLabel('Your initials',{exact:true}).fill('XX');await expect(consent).not.toBeChecked();
 await buyer.page.getByLabel('Full legal name',{exact:true}).fill('Synthetic Buyer');await buyer.page.getByLabel('Your initials',{exact:true}).fill('SB');
 if(dual){
  await buyer.page.getByLabel('Company',{exact:true}).fill('Synthetic Company');await buyer.page.getByLabel('Required acknowledgement',{exact:true}).check();
  await buyer.page.getByLabel('Method',{exact:true}).selectOption('drawn');const pad=buyer.page.getByRole('img',{name:'Draw your signature here',exact:true});await pad.scrollIntoViewIfNeeded();const b=await pad.boundingBox();if(!b)throw Error('Missing signature pad');await buyer.page.mouse.move(b.x+b.width*.1,b.y+b.height*.2);await buyer.page.mouse.down();await buyer.page.mouse.move(b.x+b.width*.5,b.y+b.height*.8,{steps:10});await buyer.page.mouse.move(b.x+b.width*.8,b.y+b.height*.1,{steps:10});await buyer.page.mouse.up();
 }
 await expect(buyer.page.getByRole('button',{name:'Confirm and sign NDA',exact:true})).toBeDisabled();
 await buyer.page.getByRole('button',{name:'Apply Signature 1',exact:true}).click();await buyer.page.getByRole('button',{name:'Apply Date (UTC) 2',exact:true}).click();
 await buyer.page.getByRole('button',{name:'Go to next required field',exact:true}).click();await expect(buyer.page.getByRole('button',{name:'Apply Initials 3',exact:true})).toBeFocused();await buyer.page.getByRole('button',{name:'Apply Initials 3',exact:true}).click();
 if(dual){await buyer.page.getByRole('button',{name:'Apply Company 5',exact:true}).click();await buyer.page.getByRole('button',{name:'Apply Checkbox 6',exact:true}).click();await expect(buyer.page.getByRole('button',{name:'Apply Signature 4',exact:true})).toBeDisabled();}
 for(const width of [1280,390]){await buyer.page.setViewportSize({width,height:900});expect(await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await buyer.page.screenshot({path:`/private/tmp/crestview-visual-sign-${width}.png`,fullPage:true});}
 await buyer.page.getByRole('combobox',{name:/PDF zoom/}).selectOption('2');await expect(buyer.page.getByRole('button',{name:'Apply Initials 3',exact:true})).toBeVisible();expect(await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await buyer.page.getByRole('combobox',{name:/PDF zoom/}).selectOption('1');
 const violations=(await new AxeBuilder({page:buyer.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 // Simulate a page-render failure after all fields and consent were completed.
 await consent.check();await buyer.page.locator('canvas').evaluate(canvas=>Object.defineProperty(canvas,'width',{configurable:true,set(){throw Error('Synthetic render failure');}}));
 await buyer.page.getByRole('combobox',{name:/PDF zoom/}).selectOption('2');await expect(buyer.page.getByRole('alert').filter({hasText:'This page could not be rendered'})).toContainText('could not be rendered');await expect(buyer.page.getByRole('button',{name:'Confirm and sign NDA',exact:true})).toBeDisabled();
 await buyer.page.locator('canvas').evaluate(canvas=>Reflect.deleteProperty(canvas,'width'));await buyer.page.getByRole('combobox',{name:/PDF zoom/}).selectOption('1');await expect(buyer.page.getByRole('button',{name:'Confirm and sign NDA',exact:true})).toBeEnabled();
 await buyer.page.getByRole('checkbox',{name:/I have reviewed the complete agreement/}).check();await buyer.page.getByRole('button',{name:'Confirm and sign NDA',exact:true}).click();
 if(dual){
  await buyer.page.waitForURL(/recorded=1/);await expect(buyer.page.getByText('Your signature is recorded.',{exact:false})).toBeVisible();
  const pending=await admin.from('deal_ndas').select('status').eq('id',nda).single();check(pending);expect(pending.data!.status).not.toBe('signed');
  expect((await admin.from('deal_nda_pdf_records').select('nda_id').eq('nda_id',nda)).data).toHaveLength(0);
  check(await admin.from('deal_nda_controls').upsert({nda_id:nda,withdrawn_at:new Date().toISOString(),withdrawal_reason:'Synthetic audit'}));
  await buyer.page.reload();await expect(buyer.page.getByText('This request was withdrawn.',{exact:false})).toBeVisible();await expect(buyer.page.getByText('Your signature is recorded.',{exact:false})).toHaveCount(0);
  check(await admin.from('deal_nda_controls').update({withdrawn_at:null,expires_at:new Date(Date.now()-60000).toISOString()}).eq('nda_id',nda));
  await buyer.page.reload();await expect(buyer.page.getByText('This request expired.',{exact:false})).toBeVisible();
  check(await admin.from('deal_nda_controls').update({expires_at:null,withdrawal_reason:null}).eq('nda_id',nda));
  await broker.page.goto(`${base}/en/dashboard/deals/${deal}/sign`);await broker.page.getByLabel('Full legal name',{exact:true}).fill('Synthetic Broker');await broker.page.getByLabel('Method',{exact:true}).selectOption('uploaded');
  await expect(broker.page.getByRole('img',{name:'Drawn signature: Synthetic Buyer',exact:true})).toBeVisible();
  await broker.page.screenshot({path:'/private/tmp/crestview-countersigner-preview-audit.png',fullPage:true});
  const png=await broker.page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=180;const ctx=c.getContext('2d')!;ctx.font='italic 56px serif';ctx.fillText('Synthetic Broker',20,110);return c.toDataURL('image/png').split(',')[1];});
  await broker.page.locator('input[type=file]').setInputFiles({name:'synthetic-signature.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await broker.page.getByRole('button',{name:'Next page',exact:true}).click();await broker.page.getByRole('button',{name:'Apply Signature 4',exact:true}).click();await broker.page.getByRole('checkbox',{name:/I have reviewed the complete agreement/}).check();
  await broker.page.locator('input[type=file]').setInputFiles({name:'invalid-signature.txt',mimeType:'text/plain',buffer:Buffer.from('Not a signature')});
  await expect(broker.page.getByRole('checkbox',{name:/I have reviewed the complete agreement/})).not.toBeChecked();await expect(broker.page.getByRole('button',{name:'Confirm and sign NDA',exact:true})).toBeDisabled();await expect(broker.page.getByRole('img',{name:'Uploaded signature: Synthetic Broker',exact:true})).toHaveCount(0);
  await broker.page.locator('input[type=file]').setInputFiles({name:'synthetic-signature.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await broker.page.getByRole('button',{name:'Apply Signature 4',exact:true}).click();await broker.page.getByRole('checkbox',{name:/I have reviewed the complete agreement/}).check();
  expect((await new AxeBuilder({page:broker.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await broker.page.getByRole('button',{name:'Confirm and sign NDA',exact:true}).click();await broker.page.waitForURL(/\/agreement$/);await buyer.page.goto(`${base}/en/dashboard/deals/${deal}/agreement`);
 }else await buyer.page.waitForURL(/\/agreement$/);
 await expect(buyer.page.getByRole('link',{name:'Download signed PDF',exact:true})).toBeVisible();
 const evidence=await(await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record`)).json();expect(Object.values(evidence.visual.field_values)).toContain('Synthetic Buyer');
 if(dual){expect(evidence.participants).toHaveLength(2);expect(evidence.participants.map((p:{appearance:{mode:string}})=>p.appearance.mode).sort()).toEqual(['drawn','uploaded']);expect(Object.values(evidence.visual.field_values)).toContain('Synthetic Broker');}
 const signed=await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record?format=signed`);expect(signed.status()).toBe(200);const signedBytes=await signed.body();expect(createHash('sha256').update(signedBytes).digest('hex')).toBe(evidence.visual.sha256);expect((await PDFDocument.load(signedBytes)).getPageCount()).toBe(2);
 await writeFile('/private/tmp/crestview-visual-signed-synthetic.pdf',signedBytes);
 expect((await outsider.context.request.get(`${base}/api/deals/${deal}/signing-record?format=signed`)).status()).toBe(404);
 expect((await outsider.context.request.get(`${base}/api/nda-pdf/${nda}`)).status()).toBe(404);
 await broker.page.goto(`${base}/en/dashboard/deals/${deal}/agreement`);await expect(broker.page.getByRole('link',{name:'Download signed PDF',exact:true})).toBeVisible();
 const row=await admin.from('deal_nda_pdf_records').select('storage_path').eq('nda_id',nda).single();check(row);signedPath=row.data!.storage_path;
 expect((await buyer.auth.storage.from('signed-agreements').download(signedPath!)).error).toBeTruthy();
 // A storage replacement must not masquerade as the delivered original or signed copy.
 check(await admin.storage.from('deal-files').update(filePath!,Buffer.from('%PDF-1.4 synthetic changed bytes'),{contentType:'application/pdf'}));
 const changedOriginal=await buyer.context.request.get(`${base}/api/nda-pdf/${nda}`);
 // Storage may temporarily retain the old, correctly hashed copy in its CDN.
 if(changedOriginal.status()===200)expect(createHash('sha256').update(await changedOriginal.body()).digest('hex')).toBe(template.signing_layout.sha256);else expect(changedOriginal.status()).toBe(409);
 check(await admin.storage.from('signed-agreements').update(signedPath!,Buffer.from('%PDF-1.4 synthetic changed bytes'),{contentType:'application/pdf'}));
 const changedSigned=await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record?format=signed`);
 if(changedSigned.status()===200)expect(createHash('sha256').update(await changedSigned.body()).digest('hex')).toBe(evidence.visual.sha256);else expect(changedSigned.status()).toBe(409);
 console.log('PASS: field placement, keyboard adjustment, immutable snapshot, buyer signing, 2-page completed PDF, evidence hashes, role isolation, accessibility, mobile and desktop.');
}finally{
 await browser.close();
 // Capture any completed artifact even if a later assertion failed.
 if(listing&&!signedPath){const {data:deals}=await admin.from('deal_inquiries').select('id').eq('listing_id',listing);if(deals?.length){const {data:ndas}=await admin.from('deal_ndas').select('id').in('inquiry_id',deals.map(d=>d.id));if(ndas?.length){const {data:records}=await admin.from('deal_nda_pdf_records').select('storage_path').in('nda_id',ndas.map(n=>n.id));for(const r of records??[])check(await admin.storage.from('signed-agreements').remove([r.storage_path]));}}}
 if(signedPath)check(await admin.storage.from('signed-agreements').remove([signedPath]));if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));if(filePath)check(await admin.storage.from('deal-files').remove([filePath]));for(const id of ids){check(await admin.from('nda_layout_presets').delete().eq('broker_id',id));check(await admin.auth.admin.deleteUser(id));}console.log('Synthetic visual rehearsal cleanup complete.');
}
