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
const helper=segment('function confirmedResponseObject(','\nfunction lockFormControls(');

test('mutation response object guard rejects null arrays and primitives',()=>{
  const ctx=vm.createContext({Array});
  vm.runInContext(helper,ctx);
  assert.equal(vm.runInContext('confirmedResponseObject({ok:true})',ctx),true);
  for(const value of ['null','[]','"text"','0','false'])assert.equal(vm.runInContext('confirmedResponseObject('+value+')',ctx),false);
});

test('client configuration mutations require canonical response payloads before reporting success',()=>{
  const agent=segment('async function saveAgent(','\nfunction feedbackStatusLabel(');
  const feedback=segment('async function submitAiFeedback(','\nfunction openCallFeedbackModal(');
  const automations=segment('async function persistAutomations(','\nasync function toggleAutomation(');
  const webhook=segment('async function saveWebhook(','\nfunction settingsControlIds(');
  const settings=segment('async function saveSettings(','\n\nfunction renderPhoneRouting(');
  const locations=segment('async function persistLocations(','\nasync function saveLocation(');
  assert.match(agent,/confirmedResponseObject\(data\.agent\)/);
  assert.match(agent,/Object\.hasOwn\(data,'routing'\)/);
  assert.doesNotMatch(agent,/data\.agent\|\|next/);
  assert.match(feedback,/confirmedResponseObject\(data\.feedback\)/);
  assert.doesNotMatch(feedback,/data\.feedback\|\|item/);
  assert.match(automations,/Array\.isArray\(data\.automations\)/);
  assert.doesNotMatch(automations,/\.automations\|\|automationsData/);
  assert.match(webhook,/confirmedResponseObject\(data\.integrations\)/);
  assert.match(settings,/confirmedResponseObject\(data\.settings\)/);
  assert.doesNotMatch(settings,/data\.settings\|\|payload/);
  assert.match(locations,/Array\.isArray\(data\.locations\)/);
  assert.match(locations,/Number\.isFinite\(confirmedLimit\)/);
  assert.doesNotMatch(locations,/data\.locations\|\|\[\]/);
});

test('follow-up and note mutations cannot accept a bare 200 response as confirmation',()=>{
  const team=segment('async function persistTeamStatus(','\nfunction requestTeamStatusChange(');
  const note=segment('async function saveCallNote(','\nasync function deleteCallNote(');
  const del=segment('async function deleteCallNote(','\nasync function moveLead(');
  for(const body of [team,note,del]){
    assert.match(body,/confirmedResponseObject\(data\.state\)/);
    assert.match(body,/confirmedResponseObject\(data\.state\[String\(id\)\]\)/);
    assert.doesNotMatch(body,/data\.state\|\|followupState/);
  }
});

test('high-impact admin mutations verify returned record identity before changing local state',()=>{
  const feedback=segment('async function updateAdminFeedback(','\n\nfunction renderWebsiteTrafficChart(');
  const expenseSave=segment('async function saveExpense(','\nasync function deleteExpense(');
  const expenseDelete=segment('async function deleteExpense(','\nfunction updateAdminRefreshStamp(');
  const clientSave=segment('async function saveAdminClient(','\nasync function deleteAdminClient(');
  const clientDelete=segment('async function deleteAdminClient(','\nasync function restoreAdminClient(');
  const clientRestore=segment('async function restoreAdminClient(','\nasync function viewAdminClient(');
  assert.match(feedback,/confirmedResponseObject\(data\.feedback\)/);
  assert.match(feedback,/String\(data\.feedback\.id\|\|'\'\)!==key/);
  assert.match(expenseSave,/confirmedResponseObject\(data\.expense\)/);
  assert.match(expenseDelete,/confirmedResponseObject\(data\.deleted\)/);
  assert.match(clientSave,/confirmedResponseObject\(data\.client\)/);
  assert.match(clientDelete,/data\.pendingDeletion!==true/);
  assert.match(clientDelete,/data\.client\.status!=='pending_deletion'/);
  assert.match(clientRestore,/confirmedResponseObject\(data\.client\)/);
  assert.match(clientRestore,/\['active','onboarding','suspended'\]\.includes\(restoredStatus\)/);
});

test('automation and location saves preserve local records on malformed successful responses',async()=>{
  const alerts=[];
  const autoCtx=vm.createContext({demoMode:false,automationsData:[{id:'existing'}],fetch:async()=>({ok:true,json:async()=>({})}),alert:m=>alerts.push(m),Array});
  vm.runInContext(segment('async function persistAutomations(','\nasync function toggleAutomation('),autoCtx);
  assert.equal(await vm.runInContext('persistAutomations()',autoCtx),false);
  assert.equal(autoCtx.automationsData[0].id,'existing');

  const locationCtx=vm.createContext({
    locationsData:[{id:'existing'}],locationsLimit:3,fetch:async()=>({ok:true,json:async()=>({locations:null,limit:3})}),
    alert:m=>alerts.push(m),renderLocations:()=>{},Number,Array
  });
  vm.runInContext(segment('async function persistLocations(','\nasync function saveLocation('),locationCtx);
  assert.equal(await vm.runInContext("persistLocations([{id:'new'}])",locationCtx),false);
  assert.equal(locationCtx.locationsData[0].id,'existing');
  assert.equal(locationCtx.locationsLimit,3);
  assert.ok(alerts.some(m=>/confirm|incomplete/i.test(m)));
});
