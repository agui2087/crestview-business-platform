import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

async function harness(failTable='',missing=false){
  const writes:Array<{table:string;kind:string;options:unknown}>=[];
  const filters:Array<[string,string,unknown]>=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'synthetic-buyer'}}})},from:(table:string)=>{
    const query={eq:(name:string,value:unknown)=>{filters.push([table,name,value]);return query;},in:()=>query,select:()=>query,maybeSingle:()=>query,
      upsert:(_value:unknown,options:unknown)=>{writes.push({table,kind:'upsert',options});return query;},
      insert:()=>{writes.push({table,kind:'insert',options:null});return query;},update:()=>{writes.push({table,kind:'update',options:null});return query;},
      throwOnError:async()=>{if(table===failTable)throw new Error('Synthetic save failure');return {data:missing?null:{id:'synthetic-item'},error:null};},
      then:(resolve:(v:unknown)=>void)=>resolve({data:missing?null:{id:'synthetic-item'},error:null})};return query;
  }};
  const source=await readFile(new URL('../app/[locale]/dashboard/opportunities/actions.ts',import.meta.url),'utf8');
  const exports:Record<string,(f:FormData)=>Promise<unknown>>={};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,URL,FormData,require:(name:string)=>{
      if(name==='next/cache')return {revalidatePath:()=>{}};
      if(name==='next/navigation')return {redirect:()=>{throw new Error('Unexpected redirect');}};
      if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>client};
      if(name==='@/lib/opportunity-resolver')return {resolveOpportunity:async()=>({id:'synthetic-deal'})};
      if(name==='@/lib/i18n')return {isLocale:()=>true};
      if(name==='@/lib/guided-acquisition')return {buildGuidedChecklist:()=>[{category:'Financial',title:'Synthetic item'}]};
      if(name==='@/lib/acquisition-tailoring')return tailoring;
      return {};
    }
  });
  const form=new FormData();for(const [key,value]of Object.entries({locale:'en',opportunity_key:'synthetic-deal',id:'synthetic-item',status:'verified',title:'Synthetic item',label:'Synthetic evidence',diligence_item_id:'synthetic-item'}))form.set(key,value);
  return {exports,form,writes,filters};
}
test('checklist and transition updates require both buyer and current deal scope',async()=>{
  for(const [action,table]of [['updateDiligenceItem','diligence_items'],['updateTransitionItem','transition_items']]){
    const h=await harness();await h.exports[action](h.form);
    assert.ok(h.filters.some(([t,k,v])=>t===table&&k==='opportunity_key'&&v==='synthetic-deal'));
    assert.ok(h.filters.some(([t,k,v])=>t===table&&k==='user_id'&&v==='synthetic-buyer'));
    const absent=await harness('',true);await assert.rejects(absent.exports[action](absent.form),/no longer available/);
  }
});
test('failed secondary saves stop execution before an activity can claim success',async()=>{
  const h=await harness('diligence_items');
  await assert.rejects(h.exports.addDiligenceItem(h.form),/Synthetic save failure/);
  assert.equal(h.writes.some(w=>w.table==='deal_activities'),false);
  const plan=await harness('diligence_items');
  await assert.rejects(plan.exports.generateGuidedPlan(plan.form),/Synthetic save failure/);
  assert.equal(plan.writes.some(w=>w.table==='transition_items'||w.table==='deal_activities'),false);
});
test('reloading templates preserves already reviewed items rather than upserting defaults over them',async()=>{
  for(const action of ['addDiligenceTemplate','generateGuidedPlan']){
    const h=await harness();await h.exports[action](h.form);
    for(const write of h.writes.filter(w=>['diligence_items','transition_items'].includes(w.table)))
      assert.equal((write.options as {ignoreDuplicates?:boolean}).ignoreDuplicates,true);
  }
});
test('evidence cannot use executable links or a missing item from another deal',async()=>{
  const h=await harness();h.form.set('source_url','javascript:alert(1)');
  await assert.rejects(h.exports.addDiligenceEvidence(h.form),/HTTP or HTTPS/);assert.equal(h.writes.length,0);
  const missing=await harness('',true);
  await assert.rejects(missing.exports.addDiligenceEvidence(missing.form),/Choose a checklist item/);assert.equal(missing.writes.length,0);
});
import * as tailoring from './acquisition-tailoring.ts';
