// Synthetic production verification; never logs credentials or access codes.
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://gsabakontancxutgsbem.supabase.co'||!key)throw Error('Production configuration required');
const codes=process.argv.slice(2);if(codes.length!==15)throw Error('Supply the 15 broker codes');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const base='https://www.crestviewplatform.com';
for(let index=0;index<codes.length;index++){
 let uid:string|undefined;
 try{
  const email=`broker-code-qa-${randomUUID()}@crestview.test`,password=randomUUID()+randomUUID();
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(created.error||!created.data.user)throw Error('Synthetic account creation failed');uid=created.data.user.id;
  const profile=await admin.from('profiles').update({account_roles:['broker']}).eq('user_id',uid).select('user_id');
  if(profile.error||profile.data?.length!==1)throw Error('Synthetic broker profile failed');
  const jar=new Map<string,string>();
  const actor=createServerClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
  if((await actor.auth.signInWithPassword({email,password})).error)throw Error('Synthetic sign-in failed');
  const redeem=async(code:string)=>{
   const form=new FormData();form.set('locale','en');form.set('broker_code',code);
   return fetch(base+'/api/broker-trial/redeem',{method:'POST',body:form,redirect:'manual',headers:{origin:base,cookie:[...jar].map(([name,value])=>`${name}=${value}`).join('; ')},signal:AbortSignal.timeout(30000)});
  };
  const result=await redeem(codes[index]);assert.equal(result.status,303);assert.equal(new URL(result.headers.get('location')!,base).searchParams.get('broker_code'),'success');
  const entitlement=await admin.from('billing_entitlements').select('active,quantity,expires_at').eq('user_id',uid).eq('product_code','broker_plan').single();
  assert.equal(entitlement.data?.active,true);assert.equal(entitlement.data?.quantity,1);
  const days=(Date.parse(entitlement.data!.expires_at)-Date.now())/86400000;assert.ok(days>175&&days<190);
  const repeat=await redeem(codes[index]);assert.equal(new URL(repeat.headers.get('location')!,base).searchParams.get('broker_code'),'used');
  console.log(`PASS broker code ${index+1}: live redemption, six-month access, repeat blocked.`);
 }finally{
  if(uid){const removed=await admin.auth.admin.deleteUser(uid);if(removed.error)throw Error('Synthetic account cleanup failed');}
 }
}
console.log('All 15 live broker-code checks passed; synthetic accounts removed.');
