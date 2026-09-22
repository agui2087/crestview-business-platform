import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium,expect as baseExpect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
const expect=baseExpect.configure({timeout:60000});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,base='http://127.0.0.1:3214';
if(url!=='https://bxtrkycetuoqooammgpp.supabase.co'||!key)throw Error('Isolated test project only');
const admin=createClient(url,key,{auth:{persistSession:false}}),browser=await chromium.launch();const ids:string[]=[];
const check=(r:{error:unknown})=>{if(r.error)throw Error('Synthetic fixture operation failed');};
async function actor(role:string){
 const email=`profile-test-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
 const result=await admin.auth.admin.createUser({email,password,email_confirm:true});check(result);const id=result.data.user!.id;ids.push(id);
 expect((await admin.from('profiles').select('organization_name').eq('user_id',id).single()).data?.organization_name).toBeNull();
 check(await admin.from('profiles').update({account_roles:[role],phone:'PRIVATE-NOT-FOR-PUBLIC',organization_name:'PRIVATE-ACCOUNT'}).eq('user_id',id));
 const jar=new Map<string,string>();const auth=createServerClient(url!,key!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 check(await auth.auth.signInWithPassword({email,password}));const context=await browser.newContext();await context.addCookies([...jar].map(([name,value])=>({name,value,url:base,sameSite:'Lax'})));const page=await context.newPage();page.setDefaultTimeout(60000);return{id,page,auth};
}
try{
 const broker=await actor('broker'),buyer=await actor('buyer');const visitorContext=await browser.newContext();const visitor=await visitorContext.newPage();visitor.setDefaultTimeout(60000);
 await broker.page.goto(`${base}/en/dashboard/broker-profile`);
 await broker.page.getByLabel('Professional name',{exact:true}).fill('Synthetic Test Broker');await broker.page.getByLabel('About you',{exact:true}).fill('I support first-time buyers as they learn the acquisition process. Synthetic test only.');
 await broker.page.getByRole('button',{name:'Save broker profile',exact:true}).click();
 try{await expect.poll(async()=>(await broker.auth.from('broker_profiles').select('display_name').eq('user_id',broker.id).maybeSingle()).data?.display_name,{timeout:15000}).toBe('Synthetic Test Broker');}catch(error){console.log('Synthetic save diagnostic',await broker.page.locator('main').innerText());throw error;}
 await expect(broker.page.getByRole('status')).toContainText('Profile saved.');
 expect((await visitor.goto(`${base}/en/brokers/${broker.id}`))?.status()).toBe(404);
 expect((await buyer.auth.from('broker_profiles').select('user_id').eq('user_id',broker.id)).data).toEqual([]);
 await broker.page.getByRole('checkbox',{name:/Publish this profile/}).check();await broker.page.getByRole('button',{name:'Save broker profile',exact:true}).click();await expect.poll(async()=>(await broker.auth.from('broker_profiles').select('published').eq('user_id',broker.id).single()).data?.published).toBe(true);
 await visitor.goto(`${base}/en/brokers/${broker.id}`);await expect(visitor.getByRole('heading',{name:'Synthetic Test Broker',exact:true})).toBeVisible();
 expect(await visitor.locator('body').innerText()).not.toContain('PRIVATE-NOT-FOR-PUBLIC');expect(await visitor.locator('body').innerText()).not.toContain('PRIVATE-ACCOUNT');
 expect((await buyer.auth.from('broker_profiles').update({display_name:'Tampered'}).eq('user_id',broker.id).select()).data).toEqual([]);
 for(const locale of ['en','es'])for(const width of [1280,390]){
  await visitor.setViewportSize({width,height:900});await visitor.goto(`${base}/${locale}/brokers/${broker.id}`);await expect(visitor.getByRole('heading',{name:'Synthetic Test Broker',exact:true})).toBeVisible();expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect((await new AxeBuilder({page:visitor}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
  await visitor.screenshot({path:`/private/tmp/crestview-broker-${locale}-${width}.png`,fullPage:true});
  await visitor.goto(`${base}/${locale}/brokers`);await expect(visitor.getByRole('heading',{name:locale==='es'?'Conoce a los corredores':'Meet the brokers',exact:true})).toBeVisible();await expect(visitor.getByRole('link',{name:'Synthetic Test Broker',exact:true})).toBeVisible();expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect((await new AxeBuilder({page:visitor}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
 }
 await broker.page.setViewportSize({width:390,height:900});expect(await broker.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect((await new AxeBuilder({page:broker.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
 await broker.page.getByRole('checkbox',{name:/Publish this profile/}).uncheck();await broker.page.getByRole('button',{name:'Save broker profile',exact:true}).click();await expect.poll(async()=>(await broker.auth.from('broker_profiles').select('published').eq('user_id',broker.id).single()).data?.published).toBe(false);
 expect((await visitor.goto(`${base}/en/brokers/${broker.id}`))?.status()).toBe(404);
 await buyer.page.goto(`${base}/en/dashboard/broker-profile`);await expect(buyer.page).toHaveURL(/dashboard\/settings/);
 await buyer.page.getByLabel('Display name',{exact:true}).fill('Synthetic First-time Buyer');
 await buyer.page.getByLabel('Organization',{exact:true}).fill('');
 await buyer.page.getByLabel('Phone',{exact:true}).fill('');
 await buyer.page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(buyer.page.getByRole('status')).toContainText('Your profile was saved.');
 expect((await buyer.auth.from('profiles').select('display_name,organization_name,phone').eq('user_id',buyer.id).single()).data).toEqual({display_name:'Synthetic First-time Buyer',organization_name:null,phone:null});
 await buyer.page.reload();await expect(buyer.page.getByLabel('Organization',{exact:true})).toHaveValue('');
 await buyer.page.goto(`${base}/en/dashboard/preparation`);await buyer.page.getByRole('checkbox',{name:'Define the business and location you want',exact:true}).check();await buyer.page.getByRole('radio',{name:'Actively searching',exact:true}).check();await buyer.page.getByRole('button',{name:'Save preparation',exact:true}).click();await expect(buyer.page.getByRole('status')).toContainText('Preparation saved.');
 await expect(buyer.page.getByRole('progressbar')).toHaveAttribute('value','1');expect((await broker.auth.from('buyer_preparation').select('user_id').eq('user_id',buyer.id)).data).toEqual([]);
 expect((await buyer.auth.from('profiles').update({verification_status:'verified'}).eq('user_id',buyer.id)).error).toBeTruthy();
 expect((await buyer.auth.from('buyer_preferences').upsert({user_id:buyer.id,proof_of_funds_status:'verified'})).error).toBeTruthy();
 await buyer.page.getByRole('radio',{name:'Preparing to buy',exact:true}).check();await buyer.page.getByRole('checkbox',{name:'Define the business and location you want',exact:true}).uncheck();await buyer.page.getByRole('button',{name:'Save preparation',exact:true}).click();await expect.poll(async()=>(await buyer.auth.from('buyer_preparation').select('path,completed_steps').eq('user_id',buyer.id).single()).data).toEqual({path:'preparing',completed_steps:[]});
 for(const locale of ['en','es'])for(const width of [1280,390]){await buyer.page.setViewportSize({width,height:900});await buyer.page.goto(`${base}/${locale}/dashboard/preparation`);await expect(buyer.page.getByRole('heading',{name:locale==='es'?'Prepárate a tu ritmo':'Prepare at your own pace',exact:true})).toBeVisible();await expect(buyer.page.getByRole('checkbox')).toHaveCount(8);expect(await buyer.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect((await new AxeBuilder({page:buyer.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);await buyer.page.screenshot({path:`/private/tmp/crestview-preparation-${locale}-${width}.png`,fullPage:true});}
 console.log('PASS: private draft, publish/unpublish, private account separation, ownership, buyer denial, optional account organization/contact save and reload, private preparation without funds, reversible progress, verification spoof denial, EN/ES, desktop/mobile and automated accessibility.');
}finally{for(const id of ids)check(await admin.auth.admin.deleteUser(id));await browser.close();}
