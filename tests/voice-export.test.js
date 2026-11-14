const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {buildVoiceExport,validateVoiceExport}=require('../lib/voice-export');
const id='voice_'+'a'.repeat(24),workspaceId='tenant';
function fixture(){return {
  'workspace:tenant':{id:workspaceId,usage:{minutes:1}},
  'calls:tenant':[{id,source:'phone'}],
  'voice:config:tenant':{revision:2,purpose:'internal',assistantId:'saved-resource',webhookSecret:'fixture-secret'},
  'voice:contacts:tenant':[{id:'contact_1',name:'Caller'}],
  'voice:usage:tenant':{calls:{[id]:{seconds:60,month:'2026-10',purpose:'internal'}},overageEnabled:false},
  'voice:pending:tenant':{},'followup:state:tenant':{[id]:{status:'completed'}},
  ['voice:call:'+id]:{id,workspaceId,purpose:'internal',durationSeconds:60,durationVerified:true,transcript:[{speaker:'caller',text:'Hello'}]},
  ['voice:journal:'+id]:{'event:1':{ok:true,callId:id}}
}}
const reader=records=>({get:async key=>structuredClone(records[key])});
test('voice export includes canonical records, idempotency journals and usage without activating providers',async()=>{
  const records=fixture(),before=structuredClone(records);
  const bundle=await buildVoiceExport(reader(records),workspaceId,records['calls:tenant']);
  assert.equal(bundle.calls[0].transcript[0].text,'Hello');
  assert.equal(bundle.usage.calls[id].seconds,60);
  assert.equal(bundle.journals[id]['event:1'].callId,id);
  assert.equal(bundle.followups[id].status,'completed');
  assert.equal(bundle.requiresProviderReconciliation,true);assert.deepEqual(records,before);
});
test('voice export supports workspaces with no phone history',async()=>{
  const bundle=await buildVoiceExport(reader({}),workspaceId,[]);
  assert.deepEqual(bundle.calls,[]);assert.equal(bundle.configuration,null);assert.equal(bundle.usage.overageEnabled,false);
});
test('voice export rejects foreign, missing and duplicate canonical records',async()=>{
  for(const mutate of [r=>r['voice:call:'+id].workspaceId='other',r=>delete r['voice:call:'+id],r=>delete r['voice:journal:'+id],r=>r['calls:tenant'].push({id,source:'phone'}),r=>r['voice:pending:tenant']['voice_'+'b'.repeat(24)]=true]){
    const records=fixture();mutate(records);await assert.rejects(buildVoiceExport(reader(records),workspaceId,records['calls:tenant']));
  }
});
test('voice export refuses corrupt usage and contact identities',async()=>{
  for(const mutate of [r=>r['voice:usage:tenant'].calls[id].seconds=61,r=>r['voice:usage:tenant'].overageEnabled=true,r=>r['voice:usage:tenant'].calls[id].month='2026-99',r=>r['voice:contacts:tenant'].push({id:'contact_1'})]){
    const records=fixture();mutate(records);await assert.rejects(buildVoiceExport(reader(records),workspaceId,records['calls:tenant']));
  }
});
test('voice export refuses state that changes during the read',async()=>{
  const records=fixture();let reads=0;
  const kv={get:async key=>{if(key==='voice:config:tenant'&&++reads===2)records[key].revision++;return structuredClone(records[key])}};
  await assert.rejects(buildVoiceExport(kv,workspaceId,records['calls:tenant']),/changed during export/);
});
const api=fs.readFileSync('api/account.js','utf8');
const exportCode=api.slice(api.indexOf('function redactExportSecrets('),api.indexOf('\nfunction sendWorkspaceExport('));
async function applicationExport(records){
  const context=vm.createContext({kv:reader(records),buildVoiceExport,validateVoiceExport,readAllConversations:async()=>[],Date});
  vm.runInContext(exportCode,context);
  return vm.runInContext("buildWorkspaceExportData('tenant')",context);
}
test('actual account export redacts voice secrets and validates the complete section',async()=>{
  const bundle=await applicationExport(fixture());
  assert.equal(bundle.voice.configuration.webhookSecret,'[redacted]');
  const context=vm.createContext({validateVoiceExport});vm.runInContext(exportCode,context);context.bundle=bundle;
  const report=vm.runInContext('validateWorkspaceExportData(bundle)',context);
  assert.equal(report.ok,true);assert.equal(report.sections.voice,true);assert.equal(report.requiresProviderReconnect,true);
});
test('actual account export refuses a concurrent workspace mutation',async()=>{
  const records=fixture();let reads=0;
  const context=vm.createContext({kv:{get:async key=>{if(key==='workspace:tenant'&&++reads===2)records[key].usage.minutes=2;return structuredClone(records[key])}},buildVoiceExport,validateVoiceExport,readAllConversations:async()=>[],Date});
  vm.runInContext(exportCode,context);await assert.rejects(vm.runInContext("buildWorkspaceExportData('tenant')",context),/changed during export/);
});
test('older exports with phone views are not reported as complete recovery sources',async()=>{
  const bundle=await applicationExport(fixture());delete bundle.voice;
  const context=vm.createContext({validateVoiceExport});vm.runInContext(exportCode,context);context.bundle=bundle;
  const report=vm.runInContext('validateWorkspaceExportData(bundle)',context);
  assert.equal(report.ok,true);assert.equal(report.recoverable,false);assert.match(report.warnings.join(' '),/lacks canonical voice/);
});
test('exported journal survives serialization and prevents duplicate call mutations in a recovery rehearsal',async()=>{
  const records=fixture(),bundle=JSON.parse(JSON.stringify(await buildVoiceExport(reader(records),workspaceId,records['calls:tenant'])));
  const recovered={['voice:call:'+id]:bundle.calls[0],['workspace:'+workspaceId]:records['workspace:tenant'],['voice:journal:'+id]:bundle.journals[id]};
  const kv={get:async key=>structuredClone(recovered[key]),eval:async()=>assert.fail('A replay must not write restored state')};
  const result=await require('../lib/voice-store').mutateCall(kv,{workspaceId,purpose:'internal'},{id,providerCallId:bundle.calls[0].providerCallId},'event:1',()=>assert.fail('A replay must not repeat the original mutation'));
  assert.deepEqual(result,{ok:true,callId:id});
});
