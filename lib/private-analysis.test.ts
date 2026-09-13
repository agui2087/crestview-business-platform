import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localModelName, privateAnalysisEnabled, validatePageFindings} from './private-analysis.ts';

test('private analysis is disabled unless explicitly enabled',()=>{
  assert.equal(privateAnalysisEnabled({}),false);
  assert.equal(privateAnalysisEnabled({CRESTVIEW_PRIVATE_ANALYSIS_ENABLED:'true'}),true);
});
test('source citations reject blank fields, invented periods and truncated financial tokens',()=>{
  for(const key of ['metric','reportedValue','evidence'])assert.throws(()=>validatePageFindings({findings:[{...finding,[key]:' '}]},1,'Revenue $100 in 2025'));
  assert.throws(()=>validatePageFindings({findings:[{...finding,period:'025'}]},1,'Revenue $100 in 2025'));
  for(const [reportedValue,evidence] of [['$100','Revenue $100,000'],['100','Revenue $100'],['100','Revenue -100'],['10','Margin 10%'],['100','Revenue 100.5']]){
    assert.throws(()=>validatePageFindings({findings:[{...finding,reportedValue,evidence,period:''}]},1,evidence));
  }
  assert.equal(validatePageFindings({findings:[{...finding,reportedValue:'$100,000',evidence:'Revenue $100,000',period:''}]},1,'Revenue $100,000.').length,1);
});
test('local model configuration requires cloud disabled and rejects cloud tags',()=>{
  assert.throws(()=>localModelName({CRESTVIEW_PRIVATE_MODEL:'qwen3:4b'}));
  assert.throws(()=>localModelName({OLLAMA_NO_CLOUD:'1',CRESTVIEW_PRIVATE_MODEL:'qwen3:cloud'}));
  assert.equal(localModelName({OLLAMA_NO_CLOUD:'1',CRESTVIEW_PRIVATE_MODEL:'qwen3:4b'}),'qwen3:4b');
});
const finding={metric:'Revenue',reportedValue:'$100',period:'2025',page:1,evidence:'Revenue $100 in 2025',uncertainty:''};
test('PDF extraction emits parseable JSON without warning text and rejects malformed input',()=>{
  const script=fileURLToPath(new URL('../scripts/private-pdf-text.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script],{input:readFileSync(new URL('../e2e/fixtures/synthetic.pdf',import.meta.url)),encoding:'utf8',timeout:60000});
  assert.equal(result.status,0);assert.match(JSON.parse(result.stdout).pages[0],/SYNTHETIC TEST ONLY/);
  const invalid=spawnSync(process.execPath,[script],{input:'not a PDF',encoding:'utf8',timeout:60000});
  assert.equal(JSON.parse(invalid.stdout).error,'unreadable_pdf');
});
test('findings must cite the actual page and exact reported amount',()=>{
  assert.equal(validatePageFindings({findings:[finding]},1,'Revenue $100 in 2025').length,1);
  assert.throws(()=>validatePageFindings({findings:[finding]},2,'Revenue $100 in 2025'));
  assert.throws(()=>validatePageFindings({findings:[finding]},1,'Revenue $200 in 2025'));
  assert.throws(()=>validatePageFindings({findings:[{...finding,reportedValue:'$999'}]},1,'Revenue $100 in 2025'));
  assert.throws(()=>validatePageFindings({findings:[{...finding,period:'fiscal year 025'}]},1,'Revenue $100 in 2025'));
  assert.equal(validatePageFindings({findings:[{...finding,period:''}]},1,'Revenue $100 in 2025').length,1);
});
