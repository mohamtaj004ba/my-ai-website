const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('api/account.js','utf8');

function segment(startName,endMarker){
  const start=source.indexOf('async function '+startName+'('),end=source.indexOf(endMarker,start);
  assert.ok(start>=0&&end>start,startName+' handler missing');
  return source.slice(start,end);
}

test('appointment status changes are conflict-safe and audited with the changed record',()=>{
  const body=segment('updateAppointment','\nasync function analytics(');
  assert.match(body,/rawItems=await kv\.get\(key\)/);
  assert.match(body,/compareAndAudit\(kv,\{key,before:rawItems,after:next\},'audit:'\+s\.workspaceId,audit\)/);
  assert.match(body,/action:'appointment_status_update'/);
  assert.doesNotMatch(body,/await kv\.set\(/);
});

test('lead stage changes are conflict-safe and audited with the changed record',()=>{
  const body=segment('updateLead','\nasync function billingPortal(');
  assert.match(body,/rawItems=await kv\.get\(key\)/);
  assert.match(body,/compareAndAudit\(kv,\{key,before:rawItems,after:next\},'audit:'\+s\.workspaceId,audit\)/);
  assert.match(body,/action:'lead_stage_update'/);
  assert.doesNotMatch(body,/await kv\.set\(/);
});
