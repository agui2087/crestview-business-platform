import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
test('backup encryption commands recover exact synthetic artifact bytes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'crestview-artifact-test-'));
  const source=join(directory,'source'),encrypted=join(directory,'encrypted'),restored=join(directory,'restored');
  try {
    const bytes=randomBytes(4096);await writeFile(source,bytes);
    const env={...process.env,CRESTVIEW_TEST_BACKUP_PASSPHRASE:randomBytes(32).toString('hex')};
    const options=['-aes-256-cbc','-pbkdf2','-iter','200000'];
    execFileSync('openssl',['enc',...options,'-salt','-in',source,'-out',encrypted,'-pass','env:CRESTVIEW_TEST_BACKUP_PASSPHRASE'],{env,stdio:'pipe'});
    const cipher=await readFile(encrypted);const checksum=createHash('sha256').update(cipher).digest('hex');
    execFileSync('openssl',['enc','-d',...options,'-in',encrypted,'-out',restored,'-pass','env:CRESTVIEW_TEST_BACKUP_PASSPHRASE'],{env,stdio:'pipe'});
    assert.deepEqual(await readFile(restored),bytes);
    cipher[25]^=1;
    assert.notEqual(createHash('sha256').update(cipher).digest('hex'),checksum);
    // A co-located checksum detects accidental damage, not malicious replacement.
    // This is a synthetic artifact roundtrip, not a database/storage restore drill.
  } finally {await rm(directory,{recursive:true,force:true});}
});
