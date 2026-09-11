import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import * as recovery from './password-recovery.ts';

test('recovery redirect configuration rejects unsafe or ambiguous URLs',()=>{
  for(const url of [undefined,'javascript:alert(1)','https://user:password@example.com','https://example.com/?next=evil','https://example.com/path','http://example.com']) assert.equal(recovery.recoveryOrigin(url),null);
  assert.equal(recovery.recoveryOrigin('https://crestviewplatform.com'),'https://crestviewplatform.com');
  assert.equal(recovery.recoveryOrigin('http://localhost:3100'),'http://localhost:3100');
  assert.equal(recovery.validNewPassword('short','short'),false);
  assert.equal(recovery.validNewPassword('synthetic-password','different-password'),false);
});

async function harness({user=true,sendError=null,updateError=null}:{user?:boolean;sendError?:{status:number}|null;updateError?:{status:number}|null}={}) {
  const calls:string[]=[];
  const source=await readFile(new URL('../app/[locale]/recover-password/actions.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string,(state:string,form:FormData)=>Promise<string>>={};
  runInNewContext(code,{exports,process:{env:{NEXT_PUBLIC_SITE_URL:'https://crestviewplatform.com'}},require:(name:string)=>{
    if(name==='zod')return {z};
    if(name==='@/lib/password-recovery')return recovery;
    if(name==='next/navigation')return {redirect:(url:string)=>{throw new Error('REDIRECT '+url);}};
    if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>({auth:{
      resetPasswordForEmail:async(_email:string,options:{redirectTo:string})=>{calls.push(options.redirectTo);return {error:sendError};},
      getUser:async()=>({data:{user:user?{id:'synthetic'}:null},error:null}),
      updateUser:async()=>{calls.push('update');return {error:updateError};},
      signOut:async()=>{calls.push('signout');return {error:null};},
    }})};
    throw new Error(name);
  }});
  const form=new FormData();form.set('locale','es');form.set('email','synthetic@example.invalid');form.set('password','synthetic-password');form.set('confirmation','synthetic-password');
  return {exports,form,calls};
}
test('recovery uses a fixed trusted callback and generic acknowledgement',async()=>{
  const h=await harness();h.form.set('return_to','https://evil.invalid');
  assert.equal(await h.exports.requestPasswordRecovery('',h.form),'sent');
  assert.deepEqual(h.calls,['https://crestviewplatform.com/auth/recovery?locale=es']);
  const failed=await harness({sendError:{status:500}});
  assert.equal(await failed.exports.requestPasswordRecovery('',failed.form),'unavailable');
  const limited=await harness({sendError:{status:429}});
  assert.equal(await limited.exports.requestPasswordRecovery('',limited.form),'rate-limited');
});
test('password mutation requires authenticated identity and matching valid input',async()=>{
  const unauth=await harness({user:false});
  assert.equal(await unauth.exports.completePasswordRecovery('',unauth.form),'expired');
  assert.deepEqual(unauth.calls,[]);
  const mismatch=await harness();mismatch.form.set('confirmation','different');
  assert.equal(await mismatch.exports.completePasswordRecovery('',mismatch.form),'invalid-password');
  assert.deepEqual(mismatch.calls,[]);
  const rejected=await harness({updateError:{status:422}});
  assert.equal(await rejected.exports.completePasswordRecovery('',rejected.form),'password-rejected');
  assert.deepEqual(rejected.calls,['update']);
  const success=await harness();
  await assert.rejects(success.exports.completePasswordRecovery('',success.form),/REDIRECT \/es\/sign-in\?message=password-updated/);
  assert.deepEqual(success.calls,['update','signout']);
});
