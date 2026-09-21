const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');
const auth=fs.readFileSync(path.join(root,'lib','auth.js'),'utf8');

test('magic-link requests are limited by both IP and recipient',()=>{
  assert.match(account,/auth:rate:/);
  assert.match(account,/auth:email-rate:/);
  assert.match(account,/Promise\.all\(\[kv\.incr\(bucket\),kv\.incr\(emailBucket\)\]\)/);
  assert.match(account,/count>MAX\|\|emailCount>MAX/);
});

test('magic links are one-time and expire quickly',()=>{
  assert.match(account,/login:'\+token/);
  assert.match(account,/\{ex:15\*60\}/);
  const verifyStart=account.indexOf('async function verify(');
  const verifyBody=account.slice(verifyStart,account.indexOf('\nasync function ',verifyStart+1));
  assert.match(verifyBody,/await kv\.del\(key\)/);
  assert.match(verifyBody,/createSession/);
});

test('session cookies are HttpOnly SameSite and Secure in production',()=>{
  assert.match(auth,/HttpOnly; SameSite=Lax/);
  assert.match(auth,/NODE_ENV==='production'\?'\; Secure'/);
  assert.match(auth,/SESSION_TTL=60\*60\*24\*7/);
});

test('pending deletion disables customer magic-link access',()=>{
  assert.match(account,/member&&member\.workspaceId&&!member\.disabled/);
  assert.match(account,/loginWs&&loginWs\.status==='pending_deletion'/);
  assert.match(account,/member\.disabled\|\|!loginWs\|\|loginWs\.status==='pending_deletion'/);
});
