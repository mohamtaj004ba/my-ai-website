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

test('client notification coverage treats malformed provider rows and receptionist questions as unavailable',()=>{
  const start=api.indexOf('async function buildClientNotifications('),end=api.indexOf('\nasync function buildAdminNotifications(',start),block=api.slice(start,end);
  assert.match(block,/agent\.qualificationQuestions==null\|\|Array\.isArray\(agent\.qualificationQuestions\)/);
  assert.match(block,/numbersValid=.*\.every/);
  assert.match(block,/callsValid=.*\.every/);
});

test('client notification coverage exposes unavailable or malformed workspace usage',()=>{
  const start=api.indexOf('async function buildClientNotifications('),end=api.indexOf('\nasync function buildAdminNotifications(',start),block=api.slice(start,end);
  assert.match(block,/workspace_unavailable/);
  assert.match(block,/Workspace source unavailable|workspace_unavailable/);
  assert.match(block,/Number\.isFinite\(Number\(ws\.usage\.minutes\)\)/);
  assert.match(ui,/Workspace source unavailable/);
});

test('admin notification coverage treats malformed client usage as incomplete client-directory coverage',()=>{
  const start=api.indexOf('async function buildAdminNotifications('),end=api.indexOf('\nasync function followups(',start),block=api.slice(start,end);
  assert.match(block,/usageValid=/);
  assert.match(block,/if\(!usageValid\)workspaceRecordUnavailable=true/);
  assert.match(block,/if\(usageValid&&plan\.minutes\)/);
});

test('notification builders reject duplicate or blank provider directories as incomplete coverage',()=>{
  const clientStart=api.indexOf('async function aiFeedbackListForWorkspace('),clientEnd=api.indexOf('\nasync function aiFeedback(',clientStart),clientBlock=api.slice(clientStart,clientEnd);
  const adminStart=api.indexOf('async function buildAdminNotifications('),adminEnd=api.indexOf('\nasync function followups(',adminStart),adminBlock=api.slice(adminStart,adminEnd);
  assert.match(clientBlock,/new Set\(ids\)\.size===ids\.length/);
  assert.match(clientBlock,/sourceValid:false/);
  assert.match(adminBlock,/supportIndexValid=validDirectory/);
  assert.match(adminBlock,/workspaceIndexValid=validDirectory/);
  assert.match(adminBlock,/feedbackIndexValid=validDirectory/);
  assert.match(adminBlock,/!supportIndexValid\|\|supportRecordUnavailable/);
  assert.match(adminBlock,/!feedbackIndexValid\|\|feedbackRecordUnavailable/);
  assert.match(adminBlock,/!workspaceIndexValid\|\|workspaceRecordUnavailable/);
});

test('client and admin notifications mark malformed onboarding checklist coverage unavailable',()=>{
  const client=api.slice(api.indexOf('async function buildClientNotifications('),api.indexOf('\nasync function buildAdminNotifications('));
  const admin=api.slice(api.indexOf('async function buildAdminNotifications('),api.indexOf('\nasync function followups('));
  assert.match(client,/onboarding\.checklist==null/);
  assert.match(admin,/onboarding\.checklist==null/);
});

test('notification builders validate canonical feedback, support, and Growth records before alerting',()=>{
  const client=api.slice(api.indexOf('async function buildClientNotifications('),api.indexOf('\nasync function buildAdminNotifications('));
  const admin=api.slice(api.indexOf('async function buildAdminNotifications('),api.indexOf('\nasync function followups('));
  assert.match(client,/validTicket=/);
  assert.match(client,/\['open','in_progress','resolved'\]\.includes/);
  assert.match(client,/typeof t\.subject==='string'/);
  assert.match(admin,/validFeedback=/);
  assert.match(admin,/\['call','receptionist'\]\.includes/);
  assert.match(admin,/typeof f\.message==='string'/);
  assert.match(admin,/validTicket=/);
  assert.match(admin,/validProspect=/);
  assert.match(admin,/typeof p\.stage==='string'/);
});
test('legacy direct onboarding phone sync helper is removed after atomic routing migration',()=>{
  assert.doesNotMatch(api,/async function syncOnboardingPhoneAssignment\(/);
});

test('client notifications reject duplicate phone, call, and support directory identities',()=>{
  const start=api.indexOf('async function buildClientNotifications('),end=api.indexOf('\nasync function buildAdminNotifications(',start),block=api.slice(start,end);
  assert.match(block,/new Set\(numbers\.map\(item=>String\(item\.id\)\)\)\.size===numbers\.length/);
  assert.match(block,/new Set\(calls\.map\(item=>String\(item\.id\)\)\)\.size===calls\.length/);
  assert.match(block,/supportIndexValid=/);
  assert.match(block,/new Set\(index\)\.size===index\.length/);
  assert.match(block,/!supportIndexValid\|\|supportRecordUnavailable/);
});
