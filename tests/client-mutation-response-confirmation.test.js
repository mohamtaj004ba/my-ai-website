const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function segment(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,start+' must exist');
  return source.slice(a,b);
}

test('client configuration mutations require canonical response payloads before reporting success',()=>{
  const agent=segment('async function saveAgent(',"\nfunction feedbackStatusLabel(");
  const feedback=segment('async function submitAiFeedback(',"\nfunction openCallFeedbackModal(");
  const automations=segment('async function persistAutomations(',"\nasync function toggleAutomation(");
  const webhook=segment('async function saveWebhook(',"\nfunction settingsControlIds(");
  const settings=segment('async function saveSettings(',"\n\nfunction renderPhoneRouting(");
  const locations=segment('async function persistLocations(',"\nasync function saveLocation(");
  assert.match(agent,/!data\.agent\|\|typeof data\.agent!=='object'\|\|Array\.isArray\(data\.agent\)/);
  assert.match(agent,/Object\.hasOwn\(data,'routing'\)/);
  assert.doesNotMatch(agent,/data\.agent\|\|next/);
  assert.match(feedback,/!data\.feedback\|\|typeof data\.feedback!=='object'\|\|Array\.isArray\(data\.feedback\)/);
  assert.doesNotMatch(feedback,/data\.feedback\|\|item/);
  assert.match(automations,/Array\.isArray\(data\.automations\)/);
  assert.doesNotMatch(automations,/\.automations\|\|automationsData/);
  assert.match(webhook,/!data\.integrations\|\|typeof data\.integrations!=='object'\|\|Array\.isArray\(data\.integrations\)/);
  assert.match(settings,/!data\.settings\|\|typeof data\.settings!=='object'\|\|Array\.isArray\(data\.settings\)/);
  assert.doesNotMatch(settings,/data\.settings\|\|payload/);
  assert.match(locations,/Array\.isArray\(data\.locations\)/);
  assert.match(locations,/Number\.isFinite\(confirmedLimit\)/);
  assert.doesNotMatch(locations,/data\.locations\|\|\[\]/);
});

test('follow-up and note mutations cannot accept a bare 200 response as confirmation',()=>{
  const team=segment('async function persistTeamStatus(',"\nfunction requestTeamStatusChange(");
  const note=segment('async function saveCallNote(',"\nasync function deleteCallNote(");
  const del=segment('async function deleteCallNote(',"\nasync function moveLead(");
  for(const body of [team,note,del]){
    assert.match(body,/!data\.state\|\|typeof data\.state!=='object'\|\|Array\.isArray\(data\.state\)/);
    assert.match(body,/!data\.state\[String\(id\)\]\|\|typeof data\.state\[String\(id\)\]!=='object'/);
    assert.doesNotMatch(body,/data\.state\|\|followupState/);
  }
});

test('high-impact admin mutations verify returned record identity before changing local state',()=>{
  const feedback=segment('async function updateAdminFeedback(',"\n\nfunction renderWebsiteTrafficChart(");
  const expenseSave=segment('async function saveExpense(',"\nasync function deleteExpense(");
  const expenseDelete=segment('async function deleteExpense(',"\nfunction updateAdminRefreshStamp(");
  const clientSave=segment('async function saveAdminClient(',"\nasync function deleteAdminClient(");
  const clientDelete=segment('async function deleteAdminClient(',"\nasync function restoreAdminClient(");
  const clientRestore=segment('async function restoreAdminClient(',"\nasync function viewAdminClient(");
  assert.match(feedback,/String\(data\.feedback\.id\|\|'\'\)!==key/);
  assert.match(expenseSave,/String\(data\.expense\.id\|\|'\'\)\.trim\(\)/);
  assert.match(expenseDelete,/String\(data\.deleted\.id\|\|'\'\)!==key/);
  assert.match(clientSave,/String\(data\.client\.id\|\|'\'\)!==targetId/);
  assert.match(clientDelete,/data\.pendingDeletion!==true/);
  assert.match(clientDelete,/data\.client\.status!=='pending_deletion'/);
  assert.match(clientRestore,/\['active','onboarding','suspended'\]\.includes\(restoredStatus\)/);
});

test('successful mutation payload guards reject missing objects instead of dereferencing them',()=>{
  assert.doesNotMatch(source,/!data\.[A-Za-z0-9_]+&&typeof data\.[A-Za-z0-9_]+==='object'/);
  const followup=segment('async function persistTeamStatus(',"\nfunction requestTeamStatusChange(");
  assert.match(followup,/!data\.state\|\|typeof data\.state!=='object'\|\|Array\.isArray\(data\.state\)/);
  const settings=segment('async function saveSettings(',"\n\nfunction renderPhoneRouting(");
  assert.match(settings,/!data\.settings\|\|typeof data\.settings!=='object'\|\|Array\.isArray\(data\.settings\)/);
  const clients=segment('async function saveAdminClient(',"\nasync function deleteAdminClient(");
  assert.match(clients,/!data\.client\|\|typeof data\.client!=='object'\|\|Array\.isArray\(data\.client\)/);
});

test('lead and appointment mutations require canonical changed records',()=>{
  const lead=segment('async function moveLead(',"\ndocument.getElementById('callSearch')");
  const appointment=segment('async function updateAppointment(',"\ndocument.getElementById('conversationSearch')");
  assert.doesNotMatch(lead,/expectedUpdatedAt/);
  assert.match(lead,/data\.updated!==true\|\|!data\.lead/);
  assert.match(lead,/String\(data\.lead\.id\|\|'\'\)!==String\(id\)/);
  assert.match(lead,/String\(data\.lead\.stage\|\|'\'\)!==String\(stage\)/);
  assert.match(appointment,/data\.updated!==true\|\|!data\.appointment/);
  assert.match(appointment,/String\(data\.appointment\.id\|\|'\'\)!==String\(id\)/);
  assert.match(appointment,/String\(data\.appointment\.status\|\|'\'\)!==String\(status\)/);
});

test('malformed 200 lead and appointment responses roll optimistic UI changes back',async()=>{
  const renders=[];
  const leadCtx=vm.createContext({
    leadsData:[{id:'lead-1',stage:'New'}],demoMode:false,renderLeads:()=>renders.push('lead'),
    fetch:async()=>({ok:true,json:async()=>({updated:true})}),console:{error(){}},
    String,Object,Array,JSON,Error
  });
  vm.runInContext(segment('async function moveLead(',"\ndocument.getElementById('callSearch')"),leadCtx);
  await vm.runInContext("moveLead('lead-1','Qualified')",leadCtx);
  assert.equal(leadCtx.leadsData[0].stage,'New');

  const alerts=[];
  const apptCtx=vm.createContext({
    appointmentsData:[{id:'appt-1',status:'Scheduled'}],demoMode:false,renderAppointments:()=>renders.push('appt'),
    fetch:async()=>({ok:true,json:async()=>({updated:true})}),alert:m=>alerts.push(m),
    String,Object,Array,JSON,Error
  });
  vm.runInContext(segment('const appointmentStatusPending=new Set();',"\ndocument.getElementById('conversationSearch')"),apptCtx);
  await vm.runInContext("updateAppointment('appt-1','Completed')",apptCtx);
  assert.equal(apptCtx.appointmentsData[0].status,'Scheduled');
  assert.ok(alerts.some(message=>/incomplete/i.test(message)));
});

test('automation and location saves preserve local records on malformed successful responses',async()=>{
  const alerts=[];
  const autoCtx=vm.createContext({
    demoMode:false,automationsData:[{id:'existing'}],
    fetch:async()=>({ok:true,json:async()=>({})}),alert:m=>alerts.push(m),Array
  });
  vm.runInContext(segment('let automationMutationPending=false;',"\nasync function toggleAutomation("),autoCtx);
  assert.equal(await vm.runInContext('persistAutomations()',autoCtx),false);
  assert.equal(autoCtx.automationsData[0].id,'existing');

  const locationCtx=vm.createContext({
    locationsData:[{id:'existing'}],locationsLimit:3,
    fetch:async()=>({ok:true,json:async()=>({locations:null,limit:3})}),
    alert:m=>alerts.push(m),renderLocations:()=>{},Number,Array
  });
  vm.runInContext(segment('async function persistLocations(',"\nasync function saveLocation("),locationCtx);
  assert.equal(await vm.runInContext("persistLocations([{id:'new'}])",locationCtx),false);
  assert.equal(locationCtx.locationsData[0].id,'existing');
  assert.equal(locationCtx.locationsLimit,3);
  assert.ok(alerts.some(m=>/confirm|incomplete/i.test(m)));
});


test('appointment status mutation blocks duplicate in-flight changes and unlocks after failure',async()=>{
  let release,requests=0,renders=0;
  const ctx=vm.createContext({
    appointmentsData:[{id:'appt-1',status:'Scheduled'}],demoMode:false,
    renderAppointments:()=>{renders++},alert:()=>{},
    fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:false,json:async()=>({error:'Unavailable'})}},
    String,Object,Array,JSON,Error,Set,Promise
  });
  vm.runInContext(segment('const appointmentStatusPending=new Set();',"\ndocument.getElementById('conversationSearch')"),ctx);
  const first=vm.runInContext("updateAppointment('appt-1','Completed')",ctx);
  await new Promise(resolve=>setImmediate(resolve));
  const second=await vm.runInContext("updateAppointment('appt-1','Confirmed')",ctx);
  assert.equal(second,false);
  assert.equal(requests,1);
  release();assert.equal(await first,false);
  assert.equal(ctx.appointmentsData[0].status,'Scheduled');
  assert.equal(vm.runInContext("appointmentStatusPending.has('appt-1')",ctx),false);
  assert.ok(renders>=2);
});
