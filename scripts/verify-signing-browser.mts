import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium,expect} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const base=process.env.SIGNING_TEST_BASE_URL??'http://127.0.0.1:3214';
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Isolated test configuration required');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const ids:string[]=[];let listing:string|undefined;let filePath:string|undefined;
const check=(r:{error:unknown})=>{if(r.error)throw Error(JSON.stringify(r.error));};
const browser=await chromium.launch();
async function actor(role:string){
 const email=`signing-browser-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const user=await admin.auth.admin.createUser({email,password,email_confirm:true});check(user);const id=user.data.user!.id;ids.push(id);
 check(await admin.from('profiles').update({account_roles:[role]}).eq('user_id',id));
 const jar=new Map<string,string>();const auth=createServerClient(url!,key!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 check(await auth.auth.signInWithPassword({email,password}));
 const context=await browser.newContext();await context.addCookies([...jar].map(([name,value])=>({name,value,url:base,httpOnly:false,sameSite:'Lax'})));
 return {id,context,page:await context.newPage(),client:auth};
}
try{
 const buyer=await actor('buyer'),broker=await actor('broker');listing=randomUUID();const deal=randomUUID(),nda=randomUUID();
 check(await admin.from('marketplace_listings').insert({id:listing,broker_id:broker.id,title:'SYNTHETIC BROWSER REHEARSAL',summary:'Synthetic test only',industry:'Other',city:'Test',state_code:'OR',status:'draft'}));
 check(await admin.from('deal_inquiries').insert({id:deal,listing_id:listing,buyer_id:buyer.id,broker_id:broker.id,subject:'Synthetic browser test',initial_message:'Synthetic test',status:'nda_sent'}));
 const pdf=await readFile('e2e/fixtures/synthetic.pdf');filePath=`${broker.id}/listing-ndas/${randomUUID()}/synthetic.pdf`;
 check(await admin.storage.from('deal-files').upload(filePath,pdf,{contentType:'application/pdf'}));
 check(await admin.from('listing_nda_templates').insert({listing_id:listing,broker_id:broker.id,document_name:'Synthetic agreement',template_body:'Synthetic agreement for automated testing only.',storage_path:filePath,security_status:'basic_validated',broker_attested:true}));
 check(await admin.from('billing_entitlements').insert({user_id:broker.id,product_code:'broker_plan',active:true,quantity:1,source_event_id:'synthetic-browser-rehearsal'}));
 check(await admin.from('marketplace_listings').update({status:'published'}).eq('id',listing));
 check(await admin.from('deal_ndas').insert({id:nda,inquiry_id:deal,buyer_id:buyer.id,broker_id:broker.id,document_name:'Synthetic agreement',template_body:'Synthetic agreement for automated testing only.',storage_path:filePath,status:'sent',template_version:1}));
 const page=buyer.page;page.setDefaultTimeout(60000);
 await page.goto(`${base}/en/dashboard/deals/${deal}`);await expect(page.getByRole('link',{name:/Open the complete NDA PDF/})).toBeVisible();
 await page.getByRole('button',{name:'Acknowledge receipt (not a signature)',exact:true}).click();await page.waitForURL(/signing=receipt/);
 await expect(page.getByText(/Buyer acknowledged receipt/)).toBeVisible();
 await broker.page.goto(`${base}/en/dashboard/deals/${deal}`);await broker.page.getByRole('button',{name:'Send in-app reminder',exact:true}).click();await broker.page.waitForURL(/signing=remind/);
 await expect(broker.page.getByRole('button',{name:'Send in-app reminder',exact:true})).toBeDisabled();
 await broker.page.getByText('Set or extend signing deadline',{exact:true}).click();await broker.page.getByLabel('Deadline from now').selectOption('7');await broker.page.getByRole('button',{name:'Save deadline',exact:true}).click();await broker.page.waitForURL(/signing=expire/);
 await page.goto(`${base}/en/dashboard/deals/${deal}`);
 await page.getByLabel('Type your full legal name').fill('Synthetic Browser Buyer');await page.getByRole('checkbox',{name:/I have reviewed the complete agreement/}).check();
 await page.getByRole('button',{name:'Sign NDA',exact:true}).click();await page.waitForURL(/nda=signed/);
 await page.getByRole('link',{name:'View signing record'}).click();await expect(page.getByRole('heading',{name:'NDA signing record',exact:true})).toBeVisible();
 check(await admin.from('marketplace_listings').update({status:'paused'}).eq('id',listing));
 await page.reload();await expect(page.getByRole('link',{name:'Download original agreement PDF'})).toBeVisible();
 await expect(page.getByText(createHash('sha256').update(pdf).digest('hex'),{exact:true})).toBeVisible();
 const evidenceResponse=await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record`);expect(evidenceResponse.status()).toBe(200);
 const evidence=await evidenceResponse.json();expect(evidence.events.map((e:{event_type:string})=>e.event_type)).toEqual(['receipt_acknowledged','reminder_sent','expiration_changed','signed']);
 const original=await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record?format=original`);expect(original.status()).toBe(200);expect(createHash('sha256').update(await original.body()).digest('hex')).toBe(createHash('sha256').update(pdf).digest('hex'));
 const removal=await broker.client.storage.from('deal-files').remove([filePath]);expect(removal.data??[]).toHaveLength(0);
 expect((await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record?format=original`)).status()).toBe(200);
 check(await admin.storage.from('deal-files').update(filePath,Buffer.from('%PDF-1.4\nSynthetic altered bytes'),{contentType:'application/pdf'}));
 const changed=await buyer.context.request.get(`${base}/api/deals/${deal}/signing-record?format=original`);
 // Storage CDN may still return the authentic original. Either reject changed
 // bytes or return exactly the recorded original; never release the alteration.
 if(changed.status()===200)expect(createHash('sha256').update(await changed.body()).digest('hex')).toBe(createHash('sha256').update(pdf).digest('hex'));
 else expect(changed.status()).toBe(409);
 check(await admin.storage.from('deal-files').update(filePath,pdf,{contentType:'application/pdf'}));
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Signing record overflows');}
 await broker.page.goto(`${base}/en/dashboard/deals/${deal}/agreement`);await expect(broker.page.getByRole('heading',{name:'NDA signing record',exact:true})).toBeVisible();
 await page.goto(`${base}/es/dashboard/deals/${deal}/agreement`);
 await expect(page.getByRole('heading',{name:'Registro de firma del NDA',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Descargar el PDF del acuerdo original'})).toBeVisible();
 await expect(page.getByText('ID de cuenta del firmante',{exact:true})).toBeVisible();
 await broker.page.goto(`${base}/en/dashboard/deals/${deal}?error=document_link`);
 await expect(broker.page.getByRole('alert').filter({hasText:'Use a valid HTTPS link'})).toHaveCount(1);
 const form=broker.page.locator('#deal-upload form');
 await form.getByLabel('Document source').selectOption('link');await form.getByLabel('HTTPS link').fill('https://example.com/synthetic-private-document');
 await form.getByLabel('Title',{exact:true}).fill('SYNTHETIC PRIVATE TITLE');await form.getByRole('button',{name:'Save document',exact:true}).click();
 await broker.page.waitForURL(/document=saved/);await expect(broker.page.getByText('SYNTHETIC PRIVATE TITLE',{exact:true})).toBeVisible();
 await page.goto(`${base}/en/dashboard/deals/${deal}`);await expect(page.getByText('SYNTHETIC PRIVATE TITLE',{exact:false})).toHaveCount(0);
 const anonymous=await browser.newContext();const denied=await anonymous.newPage();await denied.goto(`${base}/en/dashboard/deals/${deal}/agreement`);await expect(denied.getByRole('heading',{name:'NDA signing record',exact:true})).toHaveCount(0);
 expect((await anonymous.request.get(`${base}/api/deals/${deal}/signing-record`)).status()).toBe(401);
 await broker.page.goto(`${base}/en/dashboard/signing`);await expect(broker.page.getByRole('heading',{name:'Signing center',exact:true})).toBeVisible();await expect(broker.page.getByRole('heading',{name:'Synthetic agreement',exact:true})).toBeVisible();
 for(const width of [1280,390]){await broker.page.setViewportSize({width,height:900});if(await broker.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Signing center overflows');await broker.page.screenshot({path:`/private/tmp/crestview-signing-center-${width}.png`,fullPage:true});}
 console.log('PASS: browser PDF signing, exact PDF fingerprint, buyer/broker signing record, mobile overflow, and anonymous denial.');
}finally{
 await browser.close();if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));if(filePath)check(await admin.storage.from('deal-files').remove([filePath]));for(const id of ids)check(await admin.auth.admin.deleteUser(id));console.log('Browser rehearsal cleanup complete.');
}
