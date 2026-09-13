import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/check-backup-configuration.mjs',import.meta.url));
const run=(phase:string,env:Record<string,string>={})=>spawnSync(process.execPath,[script,phase],{env:{...env,NODE_ENV:'test'},encoding:'utf8',timeout:10000});
test('backup preflight reports every missing name and never claims success',()=>{
  const result=run('backup');assert.equal(result.status,1);
  for(const name of ['SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CRESTVIEW_BACKUP_PASSPHRASE'])assert.ok(result.stderr.includes(name));
  assert.match(result.stderr,/Vercel and local environment values are not automatically available/);
});
test('backup preflight never prints provided secrets and rejects whitespace',()=>{
  const result=run('backup',{SUPABASE_DB_URL:'synthetic-secret-sentinel',NEXT_PUBLIC_SUPABASE_URL:'   '});
  assert.equal(result.status,1);assert.doesNotMatch(result.stderr,/synthetic-secret-sentinel/);assert.doesNotMatch(result.stderr,/SUPABASE_DB_URL/);
  assert.match(result.stderr,/NEXT_PUBLIC_SUPABASE_URL/);
});
test('restore settings stay a separate gate after artifact preservation',()=>{
  assert.equal(run('restore').status,1);
  const result=run('restore',{RESTORE_SUPABASE_URL:'synthetic-target',RESTORE_SUPABASE_SERVICE_ROLE_KEY:'synthetic-key'});
  assert.equal(result.status,0);assert.match(result.stdout,/not yet verified/);assert.doesNotMatch(result.stdout,/synthetic/);
  assert.equal(run('unknown').status,1);
});
