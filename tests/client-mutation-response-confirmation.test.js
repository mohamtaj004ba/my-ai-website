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
  assert.match(webhook,/data\.ok!==true/);assert.match(webhook,/String\(confirmed\.webhookUrl\|\|'\'\)!==webhookUrl/);
  assert.match(settings,/data\.ok!==true/);
  assert.match(settings,/confirmedRevision<=Number\(payload\.expectedUpdatedAt\|\|0\)/);
  assert.match(settings,/String\(confirmed\.businessName\|\|'\'\)!==String\(payload\.businessName\|\|'\'\)/);
  assert.doesNotMatch(settings,/data\.settings\|\|payload/);
  assert.match(locations,/!Array\.isArray\(rows\)/);
  assert.match(locations,/Number\.isFinite\(confirmedLimit\)/);
  assert.doesNotMatch(locations,/data\.locations\|\|\[\]/);
});

test('follow-up and note mutations cannot accept a bare 200 response as confirmation',()=>{
  const team=segment('async function persistTeamStatus(',"\nfunction requestTeamStatusChange(");
  const note=segment('async function saveCallNote(',"\nasync function deleteCallNote(");
  const del=segment('async function deleteCallNote(',"\nasync function moveLead(");
  for(const body of [team,note,del]){
    assert.match(body,/!data\.state\|\|typeof data\.state!=='object'\|\|Array\.isArray\(data\.state\)/);
    assert.match(body,/!confirmed\|\|typeof confirmed!=='object'|data\.state\?\.\[String\(id\)\]/);
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
  assert.match(expenseSave,/data\.ok!==true/);
  assert.match(expenseSave,/String\(data\.expense\.id\|\|'\'\)\.trim\(\)/);
  assert.match(expenseDelete,/data\.ok!==true/);
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
  assert.match(settings,/!confirmed\|\|typeof confirmed!=='object'\|\|Array\.isArray\(confirmed\)/);
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

  const statuses=[];
  const apptCtx=vm.createContext({
    appointmentsData:[{id:'appt-1',status:'Scheduled'}],demoMode:false,renderAppointments:()=>renders.push('appt'),
    fetch:async()=>({ok:true,json:async()=>({updated:true})}),setAppointmentActionStatus:m=>statuses.push(m),
    String,Object,Array,JSON,Error
  });
  vm.runInContext(segment('const appointmentStatusPending=new Set();',"\ndocument.getElementById('conversationSearch')"),apptCtx);
  await vm.runInContext("updateAppointment('appt-1','Completed')",apptCtx);
  assert.equal(apptCtx.appointmentsData[0].status,'Scheduled');
  assert.ok(statuses.some(message=>/incomplete/i.test(message)));
});

test('automation and location saves preserve local records on malformed successful responses',async()=>{
  const statuses=[];
  const autoCtx=vm.createContext({
    demoMode:false,automationsData:[{id:'existing'}],setAutomationMutationUi:()=>{},setAutomationActionStatus:m=>statuses.push(m),
    fetch:async()=>({ok:true,json:async()=>({})}),Array
  });
  vm.runInContext(segment('let automationMutationPending=false;',"\nasync function toggleAutomation("),autoCtx);
  assert.equal(await vm.runInContext('persistAutomations()',autoCtx),false);
  assert.equal(autoCtx.automationsData[0].id,'existing');

  const locationCtx=vm.createContext({
    locationsData:[{id:'existing'}],locationsLimit:3,
    fetch:async()=>({ok:true,json:async()=>({locations:null,limit:3})}),
    setLocationActionStatus:m=>statuses.push(m),renderLocations:()=>{},lockFormControls:()=>()=>{},Number,Array,Object,String,Set
  });
  vm.runInContext("let locationMutationPending=false,locationLastMutationError='';\n"+segment('async function persistLocations(',"\nasync function saveLocation("),locationCtx);
  assert.equal(await vm.runInContext("persistLocations([{id:'new'}])",locationCtx),false);
  assert.equal(locationCtx.locationsData[0].id,'existing');
  assert.equal(locationCtx.locationsLimit,3);
  assert.ok(statuses.some(m=>/confirm|incomplete/i.test(m)));
});


test('appointment status mutation blocks duplicate in-flight changes and unlocks after failure',async()=>{
  let release,requests=0,renders=0;
  const ctx=vm.createContext({
    appointmentsData:[{id:'appt-1',status:'Scheduled'}],demoMode:false,
    renderAppointments:()=>{renders++},setAppointmentActionStatus:()=>{},
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


test('location saves serialize mutations and require canonical row identities',async()=>{
  let release,requests=0;
  const ctx=vm.createContext({
    locationsData:[{id:'loc-1',name:'Main',updatedAt:1}],locationsLimit:2,
    fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({ok:true,locations:[{id:'loc-1',name:'Main',updatedAt:2}],limit:2})}},
    setLocationActionStatus:()=>{},renderLocations:()=>{},lockFormControls:()=>()=>{},Number,Array,Object,String,Set,Promise,Error
  });
  vm.runInContext("let locationMutationPending=false,locationLastMutationError='';\n"+segment('async function persistLocations(',"\nasync function saveLocation("),ctx);
  const first=vm.runInContext("persistLocations([{id:'loc-1',name:'Main'}])",ctx);
  await new Promise(resolve=>setImmediate(resolve));
  const second=await vm.runInContext("persistLocations([{id:'loc-1',name:'Other'}])",ctx);
  assert.equal(second,false);
  assert.equal(requests,1);
  release();
  assert.equal(await first,true);
  assert.equal(ctx.locationsData[0].updatedAt,2);
  assert.equal(vm.runInContext('locationMutationPending',ctx),false);
});

test('location save rejects mismatched existing record identities despite HTTP 200',async()=>{
  const ctx=vm.createContext({
    locationsData:[{id:'loc-1',name:'Main',updatedAt:1}],locationsLimit:2,
    fetch:async()=>({ok:true,json:async()=>({ok:true,locations:[{id:'different',name:'Main',updatedAt:2}],limit:2})}),
    setLocationActionStatus:()=>{},renderLocations:()=>{},lockFormControls:()=>()=>{},Number,Array,Object,String,Set,Promise,Error
  });
  vm.runInContext("let locationMutationPending=false,locationLastMutationError='';\n"+segment('async function persistLocations(',"\nasync function saveLocation("),ctx);
  assert.equal(await vm.runInContext("persistLocations([{id:'loc-1',name:'Main'}])",ctx),false);
  assert.equal(ctx.locationsData[0].id,'loc-1');
});


test('location modal cannot close while a save is pending',()=>{
  const block=segment('function closeLocationModal()',"\nasync function persistLocations(");
  assert.match(block,/if\(locationMutationPending\)return false/);
  const persist=segment('async function persistLocations(',"\nasync function saveLocation(");
  assert.match(persist,/lockFormControls\('locationModal'\)/);
  assert.match(persist,/finally\{unlock\(\);locationMutationPending=false/);
});


test('location builder validates required name and exposes inline accessible status',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const html=fs.readFileSync('dashboard.html','utf8');
  const open=ui.slice(ui.indexOf("function openLocationModal(id='')"),ui.indexOf('function closeLocationModal()'));
  const save=ui.slice(ui.indexOf('async function saveLocation(){'),ui.indexOf('async function deleteLocation('));
  assert.match(html,/id="locationFormStatus" role="status" aria-live="polite"/);
  assert.match(html,/id="locationName" maxlength="120" autocomplete="organization" aria-describedby="locationFormStatus"/);
  assert.match(html,/id="locationPhone" type="tel" inputmode="tel" maxlength="24"/);
  assert.match(html,/id="saveLocationButton" type="button"/);
  assert.match(open,/name\.removeAttribute\('aria-invalid'\)/);
  assert.match(open,/setTimeout\(\(\)=>name\?\.focus\(\),20\)/);
  assert.match(save,/nameInput\.setAttribute\('aria-invalid','true'\)/);
  assert.match(save,/Add a location name before saving\./);
  assert.match(save,/Saving location…/);
  assert.match(save,/Location was not saved\. Review the message and try again\./);
});


test('location modal save keeps provider errors inline while list actions use page feedback',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const persist=ui.slice(ui.indexOf('async function persistLocations('),ui.indexOf('async function saveLocation('));
  const save=ui.slice(ui.indexOf('async function saveLocation(){'),ui.indexOf('async function deleteLocation('));
  assert.match(persist,/\{surfaceError=true\}=\{\}/);
  assert.match(persist,/if\(surfaceError\)setLocationActionStatus/);
  assert.doesNotMatch(persist,/\balert\s*\(/);
  assert.match(save,/persistLocations\(next,\{surfaceError:false\}\)/);
});
