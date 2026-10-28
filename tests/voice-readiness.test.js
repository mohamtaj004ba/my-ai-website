const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {voiceStatus,clientRouting}=require('../lib/voice-status');
test('saved active or paused inventory and spoofed verification never establish live voice',()=>{
  for(const status of ['active','paused','configured']){
    const s=voiceStatus({number:'5550100',status,verified:true,voice:{operational:true}});
    assert.equal(s.operational,false);assert.equal(s.controlsAvailable,false);assert.equal(s.state,'awaiting_activation');
  }
  assert.equal(voiceStatus(null).state,'unassigned');
  assert.equal(clientRouting({number:'5550100',smsEnabled:true}).smsEnabled,false);
});
test('live call control rejects before any stored data can be modified',async()=>{
  const source=fs.readFileSync('api/account.js','utf8');
  const code=source.slice(source.indexOf('async function aiAnsweringControl('),source.indexOf('async function integrations('));
  let result,codeStatus;
  const ctx=vm.createContext({requireWritableSession:async()=>({workspaceId:'test'}),requireOperationalWorkspace:async()=>true,res:{status(n){codeStatus=n;return this},json(x){result=x}},req:{body:{paused:true}},kv:{set:()=>assert.fail('No writes allowed')}});
  vm.runInContext(code,ctx);await vm.runInContext('aiAnsweringControl(req,res)',ctx);
  assert.equal(codeStatus,409);assert.equal(result.code,'VOICE_CONTROL_UNAVAILABLE');
});
