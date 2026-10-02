const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const ui=fs.readFileSync('dashboard.js','utf8');

test('admin sign-in link uses shared pending lock and restores controls',()=>{
  const stateStart=ui.indexOf('function setAdminTechMutationState('),stateEnd=ui.indexOf('\nfunction setAdminClientMutationState(',stateStart);
  const sendStart=ui.indexOf('async function sendClientLogin(){'),sendEnd=ui.indexOf('\nasync function forceClientLogout(',sendStart);
  assert.ok(stateStart>=0&&stateEnd>stateStart&&sendStart>=0&&sendEnd>sendStart);
  const state=ui.slice(stateStart,stateEnd),send=ui.slice(sendStart,sendEnd);
  assert.match(state,/adminTechMutationTarget==='send-login'\?'Sending…':'Send sign-in link'/);
  assert.match(send,/if\(!currentAdminClient\|\|adminTechSaving\|\|adminClientSaving\)return false/);
  assert.match(send,/setAdminTechMutationState\(true,'send-login'\)/);
  assert.match(send,/const id=String\(currentAdminClient\.id\),request=adminClientOpenRequest/);
  assert.match(send,/JSON\.stringify\(\{id\}\)/);
  assert.match(send,/data\.ok!==true\|\|!String\(data\.email\|\|''\)\.trim\(\)/);
  assert.match(send,/loadAdminTechSupport\(id,request\)/);
  assert.match(send,/Sign-in link was sent, but access diagnostics could not refresh/);
  assert.match(send,/finally\{setAdminTechMutationState\(false\)\}/);
});
