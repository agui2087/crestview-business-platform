import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

async function harness(existingStage:string|null, fail=false) {
  const source=await readFile(new URL('../app/[locale]/dashboard/opportunities/actions.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const writes:Array<{table:string;kind:string;value:Record<string,unknown>}>=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'buyer-fixture'}}})},from:(table:string)=>{
    let kind='read';
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:existingStage?{stage:existingStage}:null,error:null}),
      upsert:(value:Record<string,unknown>)=>{kind='upsert';writes.push({table,kind,value});return query;},
      update:(value:Record<string,unknown>)=>{kind='update';writes.push({table,kind,value});return query;},
      insert:(value:Record<string,unknown>)=>{kind='insert';writes.push({table,kind,value});return query;},
      then:(resolve:(value:unknown)=>void)=>resolve({error:fail&&kind!=='read'?{message:'Synthetic failure'}:null})};
    return query;
  }};
  const exports:Record<string,(data:FormData)=>Promise<{ok:boolean}>>={};
  runInNewContext(code,{exports,FormData,Date,JSON,Number,String,require:(name:string)=>{
    if(name==='next/cache')return {revalidatePath:()=>{}};
    if(name==='next/navigation')return {redirect:(path:string)=>{throw new Error(`REDIRECT ${path}`);}};
    if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>client};
    if(name==='@/lib/opportunity-resolver')return {resolveOpportunity:async()=>({id:'synthetic'})};
    if(name==='@/lib/i18n')return {isLocale:(locale:string)=>['en','es'].includes(locale)};
    if(name==='@/lib/deal-intelligence'||name==='@/lib/guided-acquisition')return {};
    throw new Error(name);
  }});
  const form=new FormData();form.set('locale','en');form.set('opportunity_key','synthetic');form.set('current_step','7');form.set('checklist_progress','{}');form.set('step_notes','{}');form.set('valuation_inputs','{}');
  return {exports,form,writes};
}

test('reopening a completed acquisition never resets its saved stage',async()=>{
  const h=await harness('complete');
  await assert.rejects(h.exports.beginAcquisition(h.form),/REDIRECT.*#valuation/);
  assert.equal(h.writes.length,0);
});
test('checklist navigation saves progress without changing the pipeline stage',async()=>{
  const h=await harness('complete');
  assert.equal((await h.exports.saveAcquisitionWorkspace(h.form)).ok,true);
  const update=h.writes.find(w=>w.table==='saved_opportunities'&&w.kind==='update');
  assert.equal(update?.value.current_step,7);
  assert.equal(Object.hasOwn(update!.value,'stage'),false);
});
test('invalid checklist steps and failed saves cannot report successful progress',async()=>{
  const h=await harness(null);h.form.set('current_step','99');
  assert.equal((await h.exports.saveAcquisitionWorkspace(h.form)).ok,false);assert.equal(h.writes.length,0);
  const failed=await harness(null,true);
  assert.equal((await failed.exports.saveAcquisitionWorkspace(failed.form)).ok,false);
  assert.equal(failed.writes.some(w=>w.table==='deal_activities'),false);
  const malformed=await harness('complete');malformed.form.set('step_notes','broken JSON');
  assert.equal((await malformed.exports.saveAcquisitionWorkspace(malformed.form)).ok,false);
  assert.equal(malformed.writes.length,0);
});
