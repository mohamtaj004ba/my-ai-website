const test=require('node:test'),assert=require('node:assert/strict'),{inspect}=require('../lib/voice-inspection');
test('voice inspection refuses customer and billing-connected workspaces before reading calls',async()=>{
  for(const ws of [{id:'tenant'},{voiceTestWorkspace:true,stripeCustomerId:'cus_test'},{voiceTestWorkspace:true,stripeSubscriptionId:'sub_test'}]){
    const reads=[];assert.equal(await inspect({get:async key=>{reads.push(key);return ws}},'tenant'),null);assert.deepEqual(reads,['workspace:tenant']);
  }
});
test('voice inspection returns canonical results and current follow-up state without provider internals',async()=>{
  const values={'workspace:tenant':{voiceTestWorkspace:true,usage:{voiceMinutes:2.5}},'calls:tenant':[{id:'voice_1',source:'phone',caller:'Sam',category:'New service',disposition:'request_captured',outcome:'Follow-up',summary:'Repair',transcript:[['Caller','Bearer abcdefghijklmnopqrstuvwxyz0123456789']],providerCallId:'secret_provider_id',monitor:{controlUrl:'private'}},{id:'voice_2',source:'phone',disposition:'request_captured'},{id:'seed',source:'seed'}],'leads:tenant':[{source:'Phone call'},{source:'Website'}],'voice:contacts:tenant':[{id:'contact'}],'voice:pending:tenant':{voice_1:true},'followup:state:tenant':{voice_1:{status:'completed'}}};
  const result=await inspect({get:async key=>values[key]},'tenant');
  assert.equal(result.callCount,2);assert.equal(result.followupCount,1);assert.equal(result.leadCount,1);assert.equal(result.contactCount,1);assert.equal(result.pendingCount,1);assert.equal(result.voiceMinutes,2.5);assert.equal(result.overageBillingEnabled,false);
  assert.equal(result.calls[0].transcript[0][1],'[redacted]');assert.ok(!JSON.stringify(result).includes('secret_provider_id'));assert.ok(!JSON.stringify(result).includes('controlUrl'));
});
test('voice inspection does not turn corrupted history into empty success',async()=>{
  await assert.rejects(inspect({get:async key=>key==='workspace:tenant'?{voiceTestWorkspace:true}:key==='calls:tenant'?{}:null},'tenant'));
});
