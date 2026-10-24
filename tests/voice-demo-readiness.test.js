const test=require('node:test'),assert=require('node:assert/strict');
const {demoReadiness}=require('../lib/voice-demo');
function fixture(){
  const ids=[1,2,3].map(n=>'voice_'+String(n).repeat(24));
  const values=new Map([['workspace:test',{id:'test',voiceTestWorkspace:true,demoVoiceWorkspace:true}],['voice:config:test',{purpose:'demo',state:'ready',verifiedAt:Date.now(),revision:1,numberId:'number',assistantId:'assistant'}],['voice:acceptance:test',{source:'operator_real_call_review',configRevision:1,internalAcceptancePassed:true,demoAcceptancePassed:true,numberAbuseControlsVerified:true,disclosureReviewed:true,callIds:ids}]]);
  for(const id of ids)values.set('voice:call:'+id,{id,workspaceId:'test',purpose:'demo',status:'ended',durationVerified:true,transcriptState:'available'});
  return {values,kv:{get:async key=>values.get(key)},env:{VERCEL_ENV:'preview',CALLERCORE_VOICE_PREVIEW_ENABLED:'true',CALLERCORE_DEMO_WORKSPACE_ID:'test',DEMO_PHONE_NUMBER:'+15095550100',VAPI_DEMO_NUMBER_ID:'number',VAPI_DEMO_ASSISTANT_ID:'assistant'},ids};
}
test('demo release needs explicit passing evidence; strings and numbers cannot approve it',async()=>{
  const good=fixture();assert.equal((await demoReadiness(good.kv,good.env)).available,true);
  for(const field of ['internalAcceptancePassed','demoAcceptancePassed','numberAbuseControlsVerified','disclosureReviewed'])for(const value of ['false','true',1,false,null]){const f=fixture();f.values.get('voice:acceptance:test')[field]=value;assert.deepEqual(await demoReadiness(f.kv,f.env),{available:false})}
});
test('demo release rejects future, stale or malformed verification and inactive workspaces',async()=>{
  for(const verifiedAt of [Date.now()+60000,Date.now()-300001,String(Date.now()),NaN,Infinity,0]){const f=fixture();f.values.get('voice:config:test').verifiedAt=verifiedAt;assert.deepEqual(await demoReadiness(f.kv,f.env),{available:false})}
  for(const patch of [{status:'deleted'},{id:'other'},{voiceTestWorkspace:'true'},{demoVoiceWorkspace:'true'}]){const f=fixture();Object.assign(f.values.get('workspace:test'),patch);assert.deepEqual(await demoReadiness(f.kv,f.env),{available:false})}
  for(const revision of [0,-1,1.5,'1']){const f=fixture();f.values.get('voice:config:test').revision=revision;f.values.get('voice:acceptance:test').configRevision=revision;assert.deepEqual(await demoReadiness(f.kv,f.env),{available:false})}
});
test('demo release validates canonical call identity, tenant and actual duration verification',async()=>{
  for(const patch of [{id:'other'},{workspaceId:'other'},{purpose:'internal'},{status:'active'},{durationVerified:'true'},{durationVerified:1},{transcriptState:'pending'}]){const f=fixture();Object.assign(f.values.get('voice:call:'+f.ids[0]),patch);assert.deepEqual(await demoReadiness(f.kv,f.env),{available:false})}
});
