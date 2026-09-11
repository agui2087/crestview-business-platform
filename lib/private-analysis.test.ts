import test from 'node:test';
import assert from 'node:assert/strict';
import {localModelName, privateAnalysisEnabled, validatePageFindings} from './private-analysis.ts';

test('private analysis is disabled unless explicitly enabled',()=>{
  assert.equal(privateAnalysisEnabled({}),false);
  assert.equal(privateAnalysisEnabled({CRESTVIEW_PRIVATE_ANALYSIS_ENABLED:'true'}),true);
});
test('local model configuration requires cloud disabled and rejects cloud tags',()=>{
  assert.throws(()=>localModelName({CRESTVIEW_PRIVATE_MODEL:'qwen3:4b'}));
  assert.throws(()=>localModelName({OLLAMA_NO_CLOUD:'1',CRESTVIEW_PRIVATE_MODEL:'qwen3:cloud'}));
  assert.equal(localModelName({OLLAMA_NO_CLOUD:'1',CRESTVIEW_PRIVATE_MODEL:'qwen3:4b'}),'qwen3:4b');
});
const finding={metric:'Revenue',reportedValue:'$100',period:'2025',page:1,evidence:'Revenue $100 in 2025',uncertainty:''};
test('findings must cite the actual page and exact reported amount',()=>{
  assert.equal(validatePageFindings({findings:[finding]},1,'Revenue $100 in 2025').length,1);
  assert.throws(()=>validatePageFindings({findings:[finding]},2,'Revenue $100 in 2025'));
  assert.throws(()=>validatePageFindings({findings:[finding]},1,'Revenue $200 in 2025'));
  assert.throws(()=>validatePageFindings({findings:[{...finding,reportedValue:'$999'}]},1,'Revenue $100 in 2025'));
});
