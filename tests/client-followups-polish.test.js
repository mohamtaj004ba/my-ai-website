const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
const api=fs.readFileSync(path.join(root,'api/account.js'),'utf8');
const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');

test('Follow-ups separates contact actions from workflow management',()=>{
  assert.match(js,/class="followup-contact-actions"/);
  assert.match(js,/class="followup-view-call" data-call-id=/);
  assert.match(js,/>View call →<\/button>/);
  assert.match(js,/class="followup-status-select"/);
  assert.match(css,/\.followup-actions\{\s*display:grid;\s*grid-template-columns:auto minmax\(132px,150px\)/);
  assert.match(css,/\.followup-status-select\{[\s\S]*border-left:1px solid #edf0f2;/);
});

test('follow-up reads and mutations reject malformed rows and call history',()=>{
  const readStart=api.indexOf('async function followups('),readEnd=api.indexOf('\nasync function followupUpdate(',readStart),readBlock=api.slice(readStart,readEnd);
  const writeStart=api.indexOf('async function followupUpdate('),writeEnd=api.indexOf('\nfunction aiFeedbackWorkspaceIndexKey',writeStart),writeBlock=api.slice(writeStart,writeEnd);
  assert.match(readBlock,/Team follow-up records are incomplete or malformed/);
  assert.match(writeBlock,/Call history contains unverifiable entries\. Team follow-up state was not changed/);
});

test('follow-up reads and mutations validate individual note rows and sibling entries',()=>{
  const readStart=api.indexOf('async function followups('),readEnd=api.indexOf('\nasync function followupUpdate(',readStart),readBlock=api.slice(readStart,readEnd);
  const writeStart=api.indexOf('async function followupUpdate('),writeEnd=api.indexOf('\nfunction aiFeedbackWorkspaceIndexKey',writeStart),writeBlock=api.slice(writeStart,writeEnd);
  assert.match(readBlock,/item\.notes\.some\(note=>/);
  assert.match(readBlock,/typeof note\.text!=='string'/);
  assert.match(writeBlock,/Object\.values\(rawState\)\.some/);
  assert.match(writeBlock,/Team follow-up records are incomplete or malformed\. No changes were made/);
});


test('follow-up completed toggle exposes its pressed state',()=>{
  const html=fs.readFileSync('dashboard.html','utf8'),js=fs.readFileSync('dashboard.js','utf8');
  assert.match(html,/id="showHandledFollowups" aria-pressed="false"/);
  assert.match(js,/showHandledFollowups[\s\S]*setAttribute\('aria-pressed',String\(showHandledFollowups\)\)/);
});


test('completion modal blocks duplicate saves and announces unconfirmed updates',()=>{
  const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
  const open=js.slice(js.indexOf('function requestTeamStatusChange('),js.indexOf('function syncDrawerTeamStatus('));
  assert.match(html,/id="teamStatusModalStatus" role="status" aria-live="polite"/);
  assert.match(html,/id="teamCompletionOther"[^>]+aria-describedby="teamStatusModalStatus"/);
  assert.match(open,/function setTeamStatusModalPending\(pending\)/);
  assert.match(open,/save\.disabled=!!pending/);
  assert.match(open,/if\(close\)close\.disabled=!!pending/);
  assert.match(open,/save\.textContent=pending\?'Saving…':'Mark complete'/);
  assert.match(open,/if\(!id\|\|followupMutationPending\.has\(String\(id\)\)\)return false/);
  assert.match(open,/Saving completion…/);
  assert.match(open,/Could not confirm the completion update\. Your selection is still open; try again\./);
  assert.match(open,/finally\{setTeamStatusModalPending\(false\)\}/);
  assert.match(open,/if\(pendingTeamStatusCallId&&followupMutationPending\.has\(String\(pendingTeamStatusCallId\)\)\)return false/);
});
