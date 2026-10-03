const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

function segment(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+1);assert.ok(a>=0&&b>a,start);return source.slice(a,b);
}

test('notification read mutations use server-side bounded union instead of read-modify-write',()=>{
  const one=segment('async function notificationsRead(req,res)','async function notificationsReadAll(req,res)');
  const all=segment('async function notificationsReadAll(req,res)','function userProfileKey(');
  assert.match(one,/saveNotificationReadSet\(scope,sessionData\.email,workspaceId,ids\)/);
  assert.doesNotMatch(one,/getNotificationReadSet|kv\.set/);
  assert.match(all,/saveNotificationReadSet\(scope,sessionData\.email,workspaceId,items\.map\(x=>x\.id\)\)/);
  assert.doesNotMatch(all,/getNotificationReadSet|kv\.set/);
});

test('call viewed mutation uses the same atomic bounded union primitive',()=>{
  const body=segment('async function callViewedMark(req,res)','async function clientDashboardData(req,res)');
  assert.match(body,/addBoundedIds\(kv,key,\[callId\],\{limit:2000\}\)/);
  assert.doesNotMatch(body,/kv\.set\(|new Set\(/);
});

test('notification read helper keeps one-year retention while merging atomically',()=>{
  const body=segment('async function saveNotificationReadSet','function notificationItem');
  assert.match(body,/addBoundedIds\(kv,notificationReadKey\(scope,email,workspaceId\),ids,\{limit:2000,ttlSeconds:60\*60\*24\*365\}\)/);
});


test('client read-state UI requires explicit canonical acknowledgements before keeping optimistic state',()=>{
  const callStart=dashboard.indexOf('async function markCallViewed('),callEnd=dashboard.indexOf('\nfunction syncCallSortHeader',callStart),callBlock=dashboard.slice(callStart,callEnd);
  const noteStart=dashboard.indexOf('async function markNotifications('),noteEnd=dashboard.indexOf('\nasync function navigateNotification(',noteStart),noteBlock=dashboard.slice(noteStart,noteEnd);
  const allStart=dashboard.indexOf('async function markAllNotifications('),allEnd=dashboard.indexOf('\nfunction initNotifications(',allStart),allBlock=dashboard.slice(allStart,allEnd);
  assert.ok(callStart>=0&&callEnd>callStart&&noteStart>=0&&noteEnd>noteStart&&allStart>=0&&allEnd>allStart);
  assert.match(callBlock,/data\.ok!==true/);
  assert.match(callBlock,/callViewedIds\.delete\(key\)/);
  assert.match(noteBlock,/data\.ok!==true/);
  assert.match(noteBlock,/Nothing was hidden locally|may reappear after refresh/);
  assert.match(allBlock,/data\.ok!==true/);
  assert.match(allBlock,/Nothing was hidden locally/);
});
