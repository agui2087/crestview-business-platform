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
 return {id,context,page:await context.newPage()};
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
 await page.getByLabel('Type your full legal name').fill('Synthetic Browser Buyer');await page.getByRole('checkbox',{name:/I have reviewed the complete agreement/}).check();
 await page.getByRole('button',{name:'Sign NDA',exact:true}).click();await page.waitForURL(/nda=signed/);
 await page.getByRole('link',{name:'View signing record'}).click();await expect(page.getByRole('heading',{name:'NDA signing record',exact:true})).toBeVisible();
 await expect(page.getByText(createHash('sha256').update(pdf).digest('hex'),{exact:true})).toBeVisible();
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Signing record overflows');}
 await broker.page.goto(`${base}/en/dashboard/deals/${deal}/agreement`);await expect(broker.page.getByRole('heading',{name:'NDA signing record',exact:true})).toBeVisible();
 const anonymous=await browser.newContext();const denied=await anonymous.newPage();await denied.goto(`${base}/en/dashboard/deals/${deal}/agreement`);await expect(denied.getByRole('heading',{name:'NDA signing record',exact:true})).toHaveCount(0);
 console.log('PASS: browser PDF signing, exact PDF fingerprint, buyer/broker signing record, mobile overflow, and anonymous denial.');
}finally{
 await browser.close();if(listing)check(await admin.from('marketplace_listings').delete().eq('id',listing));if(filePath)check(await admin.storage.from('deal-files').remove([filePath]));for(const id of ids)check(await admin.auth.admin.deleteUser(id));console.log('Browser rehearsal cleanup complete.');
}
