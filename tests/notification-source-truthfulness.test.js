const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');

test('malformed notification read state fails closed instead of marking every alert unread',async()=>{
  const start=api.indexOf('async function getNotificationReadSet('),end=api.indexOf('\nasync function saveNotificationReadSet(',start),block=api.slice(start,end);
  const ctx=vm.createContext({notificationReadKey:()=> 'read',kv:{get:async()=>({corrupt:true})},Set,Array,Error});
  vm.runInContext(block,ctx);
  await assert.rejects(()=>vm.runInContext('getNotificationReadSet("client","x@example.test","ws")',ctx),/malformed/);
});

test('notification endpoint returns 503 when read-state truth cannot be established',async()=>{
  const start=api.indexOf('async function notifications(req,res){'),end=api.indexOf('\nasync function notificationsRead(',start),block=api.slice(start,end);
  let status=0,payload;
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'ws',email:'x@example.test'}),buildClientNotifications:async()=>({items:[{id:'a'}],coverage:{limited:false,sources:[]}}),
    getNotificationReadSet:async()=>{throw Error('bad')},safeError:()=>'',console:{error(){}},
    req:{query:{scope:'client'}},res:{status(n){status=n;return this},json(x){payload=x;return x}},Array,Number,Set,String
  });
  vm.runInContext(block,ctx);await vm.runInContext('notifications(req,res)',ctx);
  assert.equal(status,503);assert.match(payload.error,/Previously loaded alerts should be preserved/);
});

test('client notification coverage exposes malformed preference/provider sources without fake setup alerts',()=>{
  const start=api.indexOf('async function buildClientNotifications('),end=api.indexOf('\nasync function buildAdminNotifications(',start),block=api.slice(start,end);
  assert.match(block,/settings_unavailable/);assert.match(block,/onboarding_unavailable/);assert.match(block,/agent_unavailable/);
  assert.match(block,/phone_unavailable/);assert.match(block,/calls_unavailable/);
  assert.match(block,/prefs=\{[\s\S]*billing:settingsValid&&/);
  assert.match(block,/prefs\.setup&&agentValid&&!agent/);
  assert.match(block,/prefs\.setup&&numbersValid&&!phone/);
});

test('admin notification coverage exposes malformed platform alert preferences',()=>{
  const start=api.indexOf('async function buildAdminNotifications('),end=api.indexOf('\nasync function followups(',start),block=api.slice(start,end);
  assert.match(block,/platformValid/);assert.match(block,/platform_unavailable/);
  assert.match(block,/prospects:platformValid&&/);
});

test('notification UI gives readable names to new incomplete-coverage sources',()=>{
  for(const token of ['Notification preferences unavailable','Onboarding source unavailable','AI receptionist source unavailable','Phone routing source unavailable','Call history source unavailable','Platform alert preferences unavailable'])assert.match(ui,new RegExp(token));
});
