import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDealPlan, defaultTaskDetails, readTaskDetails, validTaskDate, validateTaskMetadata, taskIsResolved, tailoredChecklist, changeDealPlan } from './acquisition-tailoring.ts';

test('task metadata rejects malformed values and impossible dates', () => {
  for (const raw of ['null','1','"hello"','[]','broken',JSON.stringify({owner:'admin'}),JSON.stringify({document:'foreign-path'})]) assert.equal(readTaskDetails(raw),null);
  assert.equal(validTaskDate('2026-02-30'),false);
  assert.equal(validTaskDate('2028-02-29'),true);
  assert.equal(validTaskDate('2026-99-99'),false);
});
test('not applicable needs a saved reason and is distinct from completion', () => {
  const state: Record<string,string> = {'item:0:0':'not_applicable'};
  assert.equal(validateTaskMetadata(state),false);
  assert.equal(taskIsResolved(state,0,0),false);
  state['details:item:0:0']=JSON.stringify({...defaultTaskDetails,reason:'No employees transfer in this purchase.'});
  assert.equal(validateTaskMetadata(state),true);
  assert.equal(taskIsResolved(state,0,0),true);
  assert.equal(state['item:0:0'],'not_applicable');
});
test('tailoring preserves old indexes and adds explicit review tasks in both languages', () => {
  const base=Array.from({length:8},(_,s)=>Array.from({length:s===5?7:5},(_,i)=>`${s}:${i}`));
  for(const es of [false,true]) {
    const cash=tailoredChecklist(base,{...defaultDealPlan,financing:'cash',employees:'no',property:'yes'},es);
    assert.equal(cash[5].length,10);
    assert.deepEqual(cash[5].slice(0,7),base[5]);
    assert.notEqual(cash[3][2],base[3][2]);
    assert.notEqual(cash[6][2],base[6][2]);
  }
  assert.deepEqual(tailoredChecklist(base,null,false),base);
});
test('changing deal facts reopens reviews without deleting unrelated work or evidence', () => {
  const state={'item:0:0':'complete','item:3:2':'complete','7':'complete','details:item:3:2':'evidence'};
  const plan={...defaultDealPlan,financing:'cash' as const};
  const changed=changeDealPlan(state,plan);
  assert.equal(changed['item:0:0'],'complete');
  assert.equal(changed['item:3:2'],'open');
  assert.equal(changed['7'],'open');
  assert.equal(changed['details:item:3:2'],'evidence');
  assert.deepEqual(changeDealPlan(changed,plan),changed);
});
