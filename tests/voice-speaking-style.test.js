const test=require('node:test'),assert=require('node:assert/strict');
const {createProvider,agentMatches}=require('../lib/voice-provider');
const {validatePolicy}=require('../lib/voice-policy');
const env={VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',VAPI_SERVER_CREDENTIAL_ID:'fixture-credential',CALLERCORE_VOICE_WEBHOOK_SECRET:'x'.repeat(32),CALLERCORE_VOICE_CALLBACK_URL:'https://fixture.vercel.app/api/voice-webhook'};
const policy=validatePolicy({timezone:'America/Los_Angeles',schedule:[]});
test('provider readiness rejects absent or changed speaking-style guidance',()=>{
 const desired=createProvider({env}).assistantConfig({id:'fixture',name:'Fixture'},{},policy);
 assert.deepEqual(desired.model.speaker.personalityPacks,['unhurried']);
 assert.equal(agentMatches(structuredClone(desired),desired),true);
 for(const packs of [undefined,[],['bouncy'],['unhurried','idle-hummer']]){
  const saved=structuredClone(desired);saved.model.speaker.personalityPacks=packs;
  assert.equal(agentMatches(saved,desired),false);
 }
 const demo=createProvider({env}).assistantConfig({id:'demo',name:'Fixture'},{},policy,{demo:true});
 assert.equal(demo.maxDurationSeconds,300);assert.equal(demo.artifactPlan.recordingEnabled,false);
 assert.equal(desired.model.tools.at(-1).type,'endCall');
});
