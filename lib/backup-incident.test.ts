import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportBackupIncident} from '../scripts/backup-incident.mjs';
const title='[Backup monitor] Crestview restore verification needs attention';
const marker='<!-- crestview-backup-monitor:v1 -->';
type Entry={number:number,title?:string,body?:string,user?:{login:string},pull_request?:object};
function fixture(overrides:Record<string,unknown>={},issues:Entry[]=[],comments:Entry[]=[]){
  const run={id:123,workflow_id:456,run_attempt:1,name:'Encrypted backup and restore drill',status:'completed',conclusion:'failure',event:'schedule',head_branch:'main',head_repository:{full_name:'agui2087/crestview-business-platform'},...overrides};
  const context={eventName:'workflow_run',repo:{owner:'agui2087',repo:'crestview-business-platform'},payload:{action:'completed',workflow_run:run}};
  const writes:Record<string,unknown>[]=[];
  let reads=0;
  const listForRepo=()=>{},listComments=()=>{};
  const record=(kind:string)=>async(input:Record<string,unknown>)=>{writes.push({kind,...input});return {};};
  const github={
    request:async()=>{reads++;return {data:{workflow_runs:[run]}};},
    paginate:async(method:unknown)=>{reads++;return method===listForRepo?issues:comments;},
    rest:{issues:{listForRepo,listComments,create:record('create'),createComment:record('comment'),update:record('update')}},
  };
  return{context,github,writes,reads:()=>reads};
}
const managed={number:7,title,body:marker,user:{login:'github-actions[bot]'}};
test('backup failure creates a safe incident using only allowlisted metadata',async()=>{
  const f=fixture({html_url:'https://evil.invalid/secret',logs:'customer-secret-sentinel'});
  assert.equal(await reportBackupIncident(f),'opened');assert.equal(f.writes.length,1);
  assert.match(String(f.writes[0].body),/actions\/runs\/123/);
  assert.doesNotMatch(JSON.stringify(f.writes),/evil|customer-secret/);
});
test('forks, non-main branches and unsupported events cannot read or write incidents',async()=>{
  for(const override of [{head_branch:'feature'},{head_repository:{full_name:'other/repo'}},{event:'pull_request'},{name:'Untrusted workflow'},{id:'123/evil'},{conclusion:null}]){
    const f=fixture(override);assert.equal(await reportBackupIncident(f),'ignored');assert.equal(f.reads(),0);assert.equal(f.writes.length,0);
  }
});
test('late success cannot close a more recent failure',async()=>{
  const f=fixture({conclusion:'success'},[managed]);
  f.github.request=async()=>({data:{workflow_runs:[{...f.context.payload.workflow_run,id:999,conclusion:'failure'}]}});
  assert.equal(await reportBackupIncident(f),'stale');assert.equal(f.writes.length,0);
});
test('only current successful drill closes managed bot incidents',async()=>{
  const human={...managed,number:8,user:{login:'owner'}};
  const unrelated={...managed,number:9,body:'User-written note'};
  const f=fixture({conclusion:'success'},[managed,human,unrelated]);
  assert.equal(await reportBackupIncident(f),'recovered');assert.deepEqual(f.writes.map(w=>[w.kind,w.issue_number]),[['comment',7],['update',7]]);
  assert.equal(f.writes[1].state,'closed');assert.match(String(f.writes[0].body),/not the separate application-level recovery review/);
});
test('same run and attempt are not posted repeatedly',async()=>{
  const body=`${marker}\n<!-- crestview-backup-run:123:1 -->`;
  const f=fixture({},[{...managed,body}]);assert.equal(await reportBackupIncident(f),'unchanged');assert.equal(f.writes.length,0);
  const g=fixture({},[managed],[{number:1,body,user:{login:'github-actions[bot]'}}]);assert.equal(await reportBackupIncident(g),'unchanged');assert.equal(g.writes.length,0);
});
test('new failed attempt updates incident and cancellation is not a success',async()=>{
  const f=fixture({run_attempt:2},[{...managed,body:`${marker}\n<!-- crestview-backup-run:123:1 -->`}]);
  assert.equal(await reportBackupIncident(f),'updated');assert.match(String(f.writes[0].body),/123:2/);
  const g=fixture({conclusion:'cancelled'});assert.equal(await reportBackupIncident(g),'opened');assert.match(String(g.writes[0].body),/cancelled/);
});
test('unavailable latest-run check fails without mutating incidents',async()=>{
  const f=fixture();f.github.request=async()=>{throw new Error('API unavailable');};
  await assert.rejects(reportBackupIncident(f),/API unavailable/);assert.equal(f.writes.length,0);
});
test('trusted monitor release reconciles existing failure without rerunning backups',async()=>{
  const f=fixture();
  const context={...f.context,eventName:'push',ref:'refs/heads/main'};
  assert.equal(await reportBackupIncident({...f,context}),'opened');assert.equal(f.writes.length,1);
  const g=fixture();assert.equal(await reportBackupIncident({...g,context:{...g.context,eventName:'push',ref:'refs/heads/untrusted'}}),'ignored');assert.equal(g.reads(),0);
});
test('incident workflow executes trusted main without production backup secrets',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/backup-monitor.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_run:/);assert.match(workflow,/ref: main/);assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/secrets\.|download-artifact|ref:.*head_sha/);
  const backup=readFileSync(new URL('../.github/workflows/backup-restore-drill.yml',import.meta.url),'utf8');assert.doesNotMatch(backup,/issues: write/);
});
