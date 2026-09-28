const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('api/account.js','utf8');

function handler(name,next){
  const start=source.indexOf('async function '+name+'('),end=source.indexOf(next,start);
  assert.ok(start>=0&&end>start,name+' handler missing');
  return source.slice(start,end);
}

test('location saves bind data and audit history to one compare-and-audit transaction',()=>{
  const body=handler('saveLocations','\nasync function agent(');
  assert.match(body,/compareAndAudit\(kv,\{key,before:rawPrevious,after:items\},'audit:'\+s\.workspaceId,audit\)/);
  assert.match(body,/rawPrevious!=null&&!Array\.isArray\(rawPrevious\)/);
  assert.doesNotMatch(body,/await kv\.set\(|await appendAudit\(/);
});

test('automation saves bind data and audit history to one compare-and-audit transaction',()=>{
  const body=handler('saveAutomations','\nasync function conversations(');
  assert.match(body,/compareAndAudit\(kv,\{key,before:rawPrevious,after:items\},'audit:'\+access\.session\.workspaceId,audit\)/);
  assert.match(body,/rawPrevious!=null&&!Array\.isArray\(rawPrevious\)/);
  assert.doesNotMatch(body,/await kv\.set\(|await appendAudit\(/);
});

test('integration saves bind data and audit history to one compare-and-audit transaction',()=>{
  const body=handler('saveIntegrations','\nasync function clientDashboardData(');
  assert.match(body,/compareAndAudit\(kv,\{key,before:rawSaved,after:next\},'audit:'\+access\.session\.workspaceId,audit\)/);
  assert.match(body,/rawSaved!=null&&\(!rawSaved\|\|typeof rawSaved!=='object'\|\|Array\.isArray\(rawSaved\)\)/);
  assert.doesNotMatch(body,/await kv\.set\(|await appendAudit\(/);
});
