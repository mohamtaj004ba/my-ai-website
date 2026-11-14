const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('dashboard.js','utf8');
test('profile view requires explicit edit and cancel restores both avatar and saved revision',()=>{
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},disabled:false,focus(){this.focused=true}});return nodes.get(id)};
  const context=vm.createContext({currentUserProfile:{displayName:'Owner',avatarDataUrl:'saved',updatedAt:11,email:'owner@example.test'},document:{getElementById:node},renderUserProfile(){}}),start=src.indexOf('let profileSaving=false,'),end=src.indexOf('\nfunction setProfileSaving(',start);
  vm.runInContext(src.slice(start,end),context);context.setProfileEditing(false);assert.equal(node('accountPanel').dataset.editing,'false');assert.equal(node('profileNameInput').disabled,true);assert.equal(node('profileSummaryName').textContent,'Owner');
  context.setProfileEditing(true);assert.equal(node('profileNameInput').disabled,false);assert.equal(node('profileNameInput').focused,true);
  context.currentUserProfile.avatarDataUrl='draft';context.setProfileEditing(false,{restore:true});assert.equal(context.currentUserProfile.avatarDataUrl,'saved');assert.equal(context.currentUserProfile.updatedAt,11);
});
test('historical active follow-up values display Pending without rewriting their saved state',()=>{
  const start=src.indexOf('const TEAM_STATUS_META='),end=src.indexOf('\nfunction callAnswered(',start),ctx=vm.createContext({followupState:{call:{status:'in_progress',updatedAt:15}}});vm.runInContext(src.slice(start,end),ctx);
  assert.equal(ctx.teamStatusForCall({id:'call'}),'in_progress');assert.equal(ctx.teamStatusLabel({id:'call'}),'Pending');assert.equal(ctx.teamStatusActive({id:'call'}),true);assert.equal(ctx.followupState.call.updatedAt,15);
  assert.equal(vm.runInContext('TEAM_STATUS_META.needs_action.tone',ctx),'red');
});
test('call details omit redundant agent identity and keep recovery separate from the two outcomes',()=>{
  const drawer=src.slice(src.indexOf('async function openCall('),src.indexOf('\nfunction closeCall(')),contact=src.slice(src.indexOf('function contactInlineCallHtml('),src.indexOf('\nfunction ',src.indexOf('function contactInlineCallHtml(')+1));
  assert.doesNotMatch(drawer,/Answered by/);assert.doesNotMatch(contact,/Answered by/);
  const html=fs.readFileSync('dashboard.html','utf8');assert.match(html,/value="needs_action" disabled>Pending/);assert.doesNotMatch(html.match(/<select id="drawerTeamStatus">([\s\S]*?)<\/select>/)[0],/in_progress/);assert.match(html,/id="drawerReopenFollowup" hidden/);
});
