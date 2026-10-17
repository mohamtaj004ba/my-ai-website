const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {summarize,review,monthsBefore}=require('../lib/voice-retention');
const id='voice_'+ 'a'.repeat(24),now=Date.parse('2026-10-06T12:00:00Z'),day=86400000;
function bundle(call={}){return {version:1,workspaceId:'test',configuration:null,contacts:[],usage:{calls:{},overageEnabled:false},pending:{},followups:{},requiresProviderReconciliation:true,calls:[{id,workspaceId:'test',purpose:'internal',status:'ended',endedAt:now-181*day,summary:'Private summary',transcript:[{text:'Private caller'}],...call}],journals:{[id]:{saved:{ok:true}}}}}
test('retention review counts old content without returning content or authorizing deletion',()=>{
  const b=bundle({recordingAvailable:true}),before=JSON.stringify(b),r=summarize(b,'test',{now});
  assert.equal(r.counts.transcriptReview,1);assert.equal(r.counts.recordingReview,1);assert.equal(r.counts.metadataReview,0);
  assert.equal(r.mode,'review_only');assert.equal(r.deletionEnabled,false);assert.equal(r.providerRetentionVerified,false);assert.equal(r.holdReviewRequired,true);
  assert.equal(JSON.stringify(b),before);assert.ok(!JSON.stringify(r).includes('Private'));assert.ok(!JSON.stringify(r).includes(id));
});
test('retention boundaries preserve metadata independently of call content',()=>{
  assert.equal(summarize(bundle({endedAt:now-180*day+1}),'test',{now}).counts.transcriptReview,0);
  assert.equal(summarize(bundle({endedAt:now-180*day}),'test',{now}).counts.transcriptReview,1);
  assert.equal(summarize(bundle({endedAt:Date.parse('2024-10-06T12:00:00Z')}),'test',{now}).counts.metadataReview,1);
  assert.equal(new Date(monthsBefore(Date.parse('2024-02-29T12:00:00Z'),24)).toISOString(),'2022-02-28T12:00:00.000Z');
});
test('unknown and future dates cannot become deletion candidates; active calls stay separate',()=>{
  for(const endedAt of [null,'invalid','1',now+1,-1]){const r=summarize(bundle({endedAt,startedAt:null}),'test',{now});assert.equal(r.counts.unknownDates,1);assert.equal(r.counts.transcriptReview,0)}
  const r=summarize(bundle({status:'active'}),'test',{now});assert.equal(r.counts.activeCalls,1);assert.equal(r.counts.transcriptReview,0);
});
test('retention rejects corrupt and foreign canonical bundles',()=>{
  assert.throws(()=>summarize(bundle({workspaceId:'victim'}),'test',{now}));
  assert.throws(()=>summarize({...bundle(),journals:{}},'test',{now}));
});
function store(){const b=bundle(),data={'workspace:test':{id:'test',voiceTestWorkspace:true},'calls:test':[{id,source:'phone'}],['voice:call:'+id]:b.calls[0],['voice:journal:'+id]:b.journals[id]};return {data,reads:[],async get(key){this.reads.push(key);return structuredClone(this.data[key]??null)}}}
test('read-only review uses canonical data and rejects customer or changed workspaces',async()=>{
  const kv=store(),before=JSON.stringify(kv.data);assert.equal((await review(kv,'test',{now})).counts.calls,1);assert.equal(JSON.stringify(kv.data),before);
  kv.data['workspace:test'].stripeCustomerId='cus_test';await assert.rejects(review(kv,'test',{now}));
  const changed=store(),get=changed.get.bind(changed);let reads=0;changed.get=async k=>{const v=await get(k);if(k==='workspace:test'&&++reads===2)v.updatedAt=1;return v};await assert.rejects(review(changed,'test',{now}),/changed/);
});
async function endpoint({role='admin',adminView=false,origin='https://preview.vercel.app',method='POST',body={},environment='preview'}={}){
  const kv=store();let code,result;
  const ctx=vm.createContext({module:{exports:{}},Buffer,URL,process:{env:{VERCEL_ENV:environment,CALLERCORE_VOICE_PREVIEW_ENABLED:'true'}},require(name){
    if(name==='../lib/auth')return {requireSession:async()=>({workspaceId:'test',email:'owner@example.test',role,adminView})};
    if(name==='../lib/kv')return {kv:{...kv,get:async k=>k==='user:email:owner@example.test'?{role}:kv.get(k)}};
    if(name==='../lib/rate-limit')return {rateLimit:async()=>({limited:false})};
    if(name==='../lib/voice-provider')return {...require('../lib/voice-provider'),previewGate:()=>require('../lib/voice-provider').previewGate(ctx.process.env)};
    if(name==='../lib/voice-service')return {};
    if(name==='../lib/voice-retention')return require('../lib/voice-retention');
    if(name==='../lib/config-transaction')return require('../lib/config-transaction');
    if(name==='crypto')return require('crypto');throw Error(name);
  }});
  vm.runInContext(fs.readFileSync('api/voice.js','utf8'),ctx);
  await ctx.module.exports({method,headers:{host:'preview.vercel.app',origin},query:{action:'retention-review'},body},{setHeader(){},status(n){code=n;return this},json(v){result=v}});
  return {code,result,reads:kv.reads};
}
test('retention endpoint is admin-only, same-origin and Preview gated',async()=>{
  assert.equal((await endpoint()).code,200);
  for(const [options,status] of [[{role:'owner'},403],[{adminView:true},403],[{origin:'https://attacker.test'},403],[{environment:'production'},503],[{body:{workspaceId:'victim'}},503]]){
    const r=await endpoint(options);assert.equal(r.code,status);assert.equal(r.reads.filter(k=>k.startsWith('voice:call:')).length,0);
  }
});
