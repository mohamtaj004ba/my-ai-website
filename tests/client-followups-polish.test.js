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
  assert.match(open,/listSelect=\[\.\.\.document\.querySelectorAll\('\[data-team-status\]'\)\]\.find/);
  assert.match(open,/if\(call&&listSelect\)listSelect\.value=teamStatusForCall\(call\)/);
  assert.match(open,/if\(call&&activeCallId===String\(id\)\)syncDrawerTeamStatus\(call\)/);
  assert.doesNotMatch(open,/renderLeads\(\)/);
});


test('completion modal backdrop follows the same guarded close path',()=>{
  assert.match(js,/teamStatusModal'\)\?\.addEventListener\('click',e=>\{if\(e\.target===e\.currentTarget\)closeTeamStatusModal\(\)\}\)/);
});


test('internal note composer locks during save and validates blank drafts',()=>{
  const block=js.slice(js.indexOf('function setNoteComposerPending('),js.indexOf('async function deleteCallNote('));
  assert.match(block,/composer\.setAttribute\('aria-busy',String\(!!pending\)\)/);
  assert.match(block,/input\.disabled=!!pending/);
  assert.match(block,/save\.disabled=!!pending/);
  assert.match(block,/cancel\.disabled=!!pending/);
  assert.match(block,/input\.setAttribute\('aria-invalid','true'\)/);
  assert.match(block,/Write a note first\./);
  assert.match(block,/setNoteComposerPending\(true\)/);
  assert.match(block,/finally\{followupMutationPending\.delete\(key\);setNoteComposerPending\(false\)/);
});


test('any follow-up mutation locks an open note composer',()=>{
  const block=js.slice(js.indexOf('function renderCallNotes('),js.indexOf('function startEditCallNote('));
  assert.match(block,/setNoteComposerPending\(pending\)/);
});


test('note delete failures stay inline instead of using a browser alert',()=>{
  const block=js.slice(js.indexOf('async function deleteCallNote('),js.indexOf('async function moveLead('));
  assert.match(block,/document\.getElementById\('drawerNoteStatus'\)/);
  assert.match(block,/status\.className='error'/);
  assert.doesNotMatch(block,/alert\(/);
});


test('Follow-ups exposes separate stale-feed and mutation feedback live regions',()=>{
  const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
  assert.match(html,/id="followupCoverageStatus" role="status" aria-live="polite" aria-atomic="true" hidden/);
  assert.match(html,/id="followupActionStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html,/id="drawerTeamStatusFeedback" role="status" aria-live="polite" aria-atomic="true"/);
  const load=js.slice(js.indexOf('async function loadFollowupState()'),js.indexOf('\nfunction followupIsHandled',js.indexOf('async function loadFollowupState()')));
  assert.match(load,/Follow-up status could not refresh\. Showing the last verified team-action state/);
  assert.match(load,/coverage\.hidden=true/);
  const persist=js.slice(js.indexOf('async function persistTeamStatus('),js.indexOf('\nfunction requestTeamStatusChange(',js.indexOf('async function persistTeamStatus(')));
  assert.match(persist,/Updating follow-up status…/);
  assert.match(persist,/Follow-up status updated\./);
  assert.match(persist,/setFeedback\(err\.message\|\|'Could not update follow-up status\.'/);
});
