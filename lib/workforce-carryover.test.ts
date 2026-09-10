import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('carryover moves reviewed minutes atomically, preserves residual balance and rejects duplicate or stale transfers',async()=>{
  const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated");
    await db.query('insert into auth.users values($1,null),($2,null)',[owner,other]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0035_workforce_leave_ledger','0040_workforce_leave_carryover'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);const e=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic worker') returning id",[owner])).rows[0].id;
    const adopt=async(year:number)=>(await db.query<{id:string}>("select workforce_adopt_leave_policy($1,'Reviewed leave',$2,$3,100,500,false,array[]::date[],'Synthetic reviewed policy','manual_monthly') id",[e,`${year}-01-01`,`${year}-12-31`])).rows[0].id;
    const source=await adopt(2020),target=await adopt(2021),later=await adopt(2022);
    await db.query("select workforce_post_leave_entry($1,'2020-01-01','opening',800,'opening','Reviewed initial balance')",[source]);
    const transfer=(minutes=500,expected=800,to=target,version=1)=>db.query<{id:string}>("select workforce_transfer_leave($1,$2,$3,1,$4,$5,'Reviewed carryover') id",[source,to,version,expected,minutes]);
    await assert.rejects(transfer(501));await assert.rejects(transfer(500,799));await assert.rejects(transfer(500,800,target,2));
    await as(other);await assert.rejects(transfer());await as(owner);
    const id=(await transfer()).rows[0].id;assert.equal((await transfer()).rows[0].id,id);
    await assert.rejects(transfer(499));
    const balance=async(policy:string)=>Number((await db.query<{minutes:string}>('select minutes from workforce_leave_balance($1,current_date)',[policy])).rows[0].minutes);
    assert.equal(await balance(source),300);assert.equal(await balance(target),500); // no implicit forfeiture
    await assert.rejects(transfer(301,300,later));
    await db.exec("reset role; create function fail_transfer() returns trigger language plpgsql as $$begin raise exception 'transfer audit failed'; end$$; create trigger fail_transfer before insert on workforce_leave_transfers for each row execute function fail_transfer()");
    await as(owner);await assert.rejects(transfer(100,300,later));assert.equal(await balance(source),300);
    assert.equal((await db.query('select id from workforce_leave_ledger where policy_id=$1',[later])).rows.length,0);
    await assert.rejects(db.query('update workforce_leave_transfers set minutes=0'),{code:'42501'});
    await as(other);assert.equal((await db.query('select * from workforce_leave_transfers')).rows.length,0);
    await db.exec('reset role; set role anon');await assert.rejects(transfer(),{code:'42501'});
  }finally {await db.close();}
});
