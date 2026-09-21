const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'lib','gmail.js'),'utf8');
const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');

test('Gmail API retries quota and concurrency responses with bounded exponential backoff',()=>{
  assert.match(src,/for\(let attempt=0;attempt<3;attempt\+\+\)/);
  assert.match(src,/r\.status===429/);
  assert.match(src,/r\.status===403&&\/quota\|rate\|concurrent\/i\.test\(message\)/);
  assert.match(src,/800\*Math\.pow\(2,attempt\)/);
  assert.match(src,/Math\.min\(delay,5000\)/);
});

test('Inbox thread hydration is sequential to avoid Gmail concurrent-request limits',()=>{
  assert.match(src,/for\(let i=0;i<refs\.length;i\+\+\)/);
  assert.match(src,/threads\.push\(await loadThread\(refs\[i\]\)\)/);
  assert.match(src,/setTimeout\(r,180\)/);
  assert.doesNotMatch(src,/Promise\.all\(refs\.slice/);
});

test('Gmail token encryption requires a strong environment key',()=>{
  assert.match(src,/CALLERCORE_ENCRYPTION_KEY must be at least 32 characters/);
  assert.match(src,/String\(process\.env\.CALLERCORE_ENCRYPTION_KEY\|\|''\)\.length>=32/);
  assert.match(src,/aes-256-gcm/);
  assert.match(src,/randomBytes\(12\)/);
});

test('Gmail OAuth requests only the restricted modify scope needed for admin inbox operations',()=>{
  assert.match(src,/gmail\.modify/);
  assert.doesNotMatch(src,/gmail\.send/);
  assert.match(src,/integration:gmail:admin:/);
});

test('Gmail sync is quota-conscious and cache-first',()=>{
  assert.match(src,/maxResults=25/);
  assert.match(account,/Date\.now\(\)-Number\(cached\.syncedAt\|\|0\)<2\*60\*1000/);
  assert.match(account,/Math\.min\(25/);
  assert.match(account,/6\*60\*60\*1000/);
  assert.match(account,/Array\.isArray\(aliasCache\)\?aliasCache/);
  assert.match(account,/warning:'Fresh Gmail sync failed'/);
  assert.match(account,/error:'Gmail sync failed'/);
});
