'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const sourceTask=require('./fixtures/agent-operations-qa-source.json');
const {QA,sourceFor,validSource,validImages,validVerdict}=require('../lib/agent-operations-qa');
const {createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {MODEL,PRICING,pilotAdapter}=require('../lib/agent-operations-pilot');
const {runStage}=require('../lib/agent-operations-worker');
const {createHandler}=require('../lib/agent-operations-api');
const {scopedBridge}=require('../scripts/agent-operations-launcher.cjs');
const {loadEvidence}=require('../scripts/agent-operations-qa-evidence.cjs');
const directory=path.join(__dirname,'fixtures/agent-operations-qa');
const load=source=>loadEvidence(source,{directory});
function verdict(){const source=sourceFor(sourceTask);return {stage:'review',decision:'reject',findings:source.inspect.findings.map((f,i)=>({code:f.code,decision:'reject',evidenceSufficient:true,reason:'OFFLINE fixture only; not an actual QA judgment',observed:'OFFLINE evidence fixture',unsupportedClaims:['OFFLINE unsupported claim fixture'],evidence:[{path:source.inspect.artifacts[i].path,sha256:source.inspect.artifacts[i].sha256,region:'OFFLINE region'}]})),note:'OFFLINE synthetic reject verdict'};}
async function fixture(){
 let raw=JSON.stringify({version:1,revision:0,tasks:[structuredClone(sourceTask)],reservations:[{taskId:'historical',executionId:'exec_historical',mode:'pilot',ceilingMicros:600000,status:'pending',day:'2026-10-11',month:'2026-10'},{taskId:'settled_prior',executionId:'exec_prior',mode:'pilot',ceilingMicros:900000,status:'settled',actualMicros:6178,day:'2026-10-11',month:'2026-10'}]});
 const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{scope:sourceTask.scope});
 const approval={...PROJECT,authorized:true,id:'pilot_qa_fixture',profile:QA.profile,maxCalls:1,maxMicros:QA.maxMicros,sourceTaskId:QA.sourceTaskId,findingsHash:QA.findingsHash,evidenceHash:QA.evidenceHash,scopeHash:hash(store.scope),expiresAt:Date.now()+60000,model:MODEL,pricingVersion:PRICING.version};
 const task=await store.create({principal:'offline',idempotencyKey:approval.id,objective:QA.objective,mode:'pilot',approval});approval.taskId=task.id;
 return {store,approval,task,sourceBefore:structuredClone(sourceTask),get raw(){return raw;},set raw(s){raw=s;}};
}
test('QA-only actual request sends four exact high-detail original images and immutable findings; separate reject verdict terminates without any later stage',async()=>{
 const f=await fixture();let calls=0,captures=0,loads=0;
 const adapter=pilotAdapter({enabled:true,apiKey:'offline-only',getApproval:async()=>f.approval,loadEvidence:async s=>{loads++;return load(s);},capture:async()=>{captures++;assert.fail('QA must never capture');},fetchImpl:async(url,o)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(o.headers['OpenAI-Project'],PROJECT.projectId);assert.equal(o.redirect,'error');const b=JSON.parse(o.body);assert.equal(b.model,MODEL);assert.equal(b.max_output_tokens,1500);assert.equal(b.store,false);assert.deepEqual(b.tools,[]);assert.deepEqual(b.text,{format:{type:'json_object'}});
  const c=b.input[1].content;assert.deepEqual(JSON.parse(c[0].text).source,sourceFor(sourceTask));assert.equal(c.length,5);const images=await load(sourceFor(sourceTask));c.slice(1).forEach((im,i)=>{assert.equal(im.type,'input_image');assert.equal(im.detail,'high');assert.equal(im.image_url,images[i].dataUrl);});
  return new Response(JSON.stringify({id:'resp_qa_offline',status:'completed',model:MODEL,usage:{input_tokens:6000,output_tokens:1000},output:[{content:[{type:'output_text',text:JSON.stringify(verdict())}]}]}),{headers:{'x-request-id':'req_qa_offline'}});
 }});
 const done=await runStage(f.store,adapter,{taskId:f.task.id});assert.equal(done.status,'verified');assert.equal(done.stage,'review');assert.equal(done.calls,1);assert.equal(done.results.qaVerdict.decision,'reject');assert.deepEqual(Object.keys(done.results),['qaVerdict']);assert.equal(done.usage[0].actualMicros,20000);assert.equal(loads,1);assert.equal(captures,0);
 await runStage(f.store,adapter,{taskId:f.task.id});assert.equal(calls,1);const state=await f.store.read();assert.deepEqual(state.tasks[0],f.sourceBefore);assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations.reduce((n,r)=>n+r.ceilingMicros,0),1800000);assert.equal(state.reservations.at(-1).status,'settled');assert.equal(done.events.filter(e=>e.type==='claimed').length,1);assert.equal(done.events[0].sourceTaskId,QA.sourceTaskId);
});
test('missing, substituted or mismatched original image evidence blocks before any reservation or provider dispatch',async()=>{
 for(const kind of ['missing','altered','mismatch','wrong-count']){
  const f=await fixture();let calls=0;const adapter=pilotAdapter({enabled:true,apiKey:'offline',getApproval:async()=>f.approval,loadEvidence:async source=>{const images=await load(source);if(kind==='missing')throw Error('missing');if(kind==='altered')images[0].dataUrl='data:image/png;base64,AA==';if(kind==='mismatch')images[0].sha256='a'.repeat(64);if(kind==='wrong-count')images.pop();return images;},fetchImpl:async()=>{calls++;assert.fail('No dispatch');}});
  const done=await runStage(f.store,adapter,{taskId:f.task.id});assert.equal(done.status,'blocked');assert.equal(done.calls,0);assert.equal(calls,0);assert.equal((await f.store.read()).reservations.length,2);assert.deepEqual((await f.store.read()).tasks[0],sourceTask);
 }
});
test('disk evidence loader rejects missing files and altered file bytes',async()=>{
 const source=sourceFor(sourceTask),temp=await fs.mkdtemp(path.join(os.tmpdir(),'qa-evidence-'));
 try{
  await assert.rejects(loadEvidence(source,{directory:temp}));
  for(const a of source.inspect.artifacts)await fs.copyFile(path.join(directory,a.path),path.join(temp,a.path));
  assert(validImages(await loadEvidence(source,{directory:temp}),source));
  await fs.appendFile(path.join(temp,source.inspect.artifacts[0].path),'altered');await assert.rejects(loadEvidence(source,{directory:temp}),/mismatch/);
 }finally{for(const a of source.inspect.artifacts)await fs.unlink(path.join(temp,a.path)).catch(()=>{});await fs.rmdir(temp);}
});
test('QA API requires exact trusted profile and worker-only action; consumed approval disables gate and initialization',async()=>{
 const f=await fixture(),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_WORKER_SECRET:'w'.repeat(40),CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify({...f.approval,id:'pilot_qa_api_test'})};const h=createHandler({env,store:f.store,getSession:async()=>null,getMember:async()=>null,rateLimit:async()=>({limited:false})});
 const request=async body=>{let status,value;await h({method:body?'POST':'GET',headers:{authorization:'Bearer '+env.CALLERCORE_AGENTOPS_WORKER_SECRET},...(body?{body}:{})},{setHeader(){},status(n){status=n;return this;},json(v){value=v;}});return {status,value};};
 assert.equal((await request()).value.independentQA.enabled,true);for(const body of [{action:'initialize-pilot'},{action:'initialize-specialist'},{action:'initialize-smoke'},{action:'initialize-qa',sourceTaskId:'override'}])assert.equal((await request(body)).status,403);
 const created=await request({action:'initialize-qa'});assert.equal(created.status,201);assert.equal(created.value.task.stage,'review');await f.store.command(created.value.task.id,{type:'cancel'});assert.equal((await request()).value.paidExecution,false);assert.equal((await request()).value.pilotApproval,undefined);assert.equal((await request({action:'initialize-qa'})).status,403);
});
test('trusted parent allows only assigned original evidence before reserve; denies capture, duplicate loads and forged verdict references',async()=>{
 const f=await fixture(),broker={read:async()=>({...await f.store.read(),paidExecution:true,pilotApproval:f.approval}),command:f.store.command};let captures=0;
 const bridge=scopedBridge({broker,taskIds:[f.task.id],mode:'pilot',loadEvidence:load,capture:async()=>{captures++;assert.fail();}});
 const t=await bridge({op:'command',id:f.task.id,command:{type:'claim',expectedRevision:f.task.revision}});
 await assert.rejects(bridge({op:'command',id:t.id,command:{type:'reserve',fence:t.fence,executionId:'exec_qa_parent'}}),/QA command denied/);
 const images=await bridge({op:'qa-evidence',id:t.id});assert(validImages(images,t.source));await assert.rejects(bridge({op:'qa-evidence',id:t.id}),/denied/);
 await bridge({op:'command',id:t.id,command:{type:'reserve',fence:t.fence,executionId:'exec_qa_parent'}});await assert.rejects(bridge({op:'capture',id:t.id,executionId:'exec_qa_parent'}),/Capture not reserved/);assert.equal(captures,0);
 const bad=verdict();bad.findings[0].evidence[0].sha256='a'.repeat(64);await assert.rejects(bridge({op:'command',id:t.id,command:{type:'finish',fence:t.fence,executionId:'exec_qa_parent',result:bad,...PROJECT,model:MODEL,inputTokens:100,outputTokens:100,actualMicros:1000}}),/QA command denied/);
});
test('QA provider rejection or invalid verdict preserves its reservation and sanitized evidence without retries or source mutation',async()=>{
 for(const denied of [true,false]){const f=await fixture();let calls=0;const adapter=pilotAdapter({enabled:true,apiKey:'offline-dummy',getApproval:async()=>f.approval,loadEvidence:load,fetchImpl:async()=>{calls++;return denied?new Response(JSON.stringify({error:{type:'invalid_request_error',code:'insufficient_permissions',param:'model',message:'PRIVATE_PAGE_TEXT'}}),{status:403,headers:{'x-request-id':'req_qa_denied'}}):new Response(JSON.stringify({id:'resp_qa_invalid',status:'completed',model:MODEL,usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify({stage:'review',accepted:true,note:'Wrong legacy contract'})}]}]}),{headers:{'x-request-id':'req_qa_invalid'}});}});
 const done=await runStage(f.store,adapter,{taskId:f.task.id});await runStage(f.store,adapter,{taskId:f.task.id});assert.equal(calls,1);assert.equal(done.status,'blocked');assert.equal(done.calls,1);assert.equal(done.results.qaVerdict,undefined);const state=await f.store.read(),receipt=state.reservations.at(-1);assert.equal(receipt.status,'pending');assert.equal(receipt.ceilingMicros,300000);assert.equal(receipt.evidence.at(-1).requestId,denied?'req_qa_denied':'req_qa_invalid');assert.equal(JSON.stringify(state).includes('PRIVATE_PAGE_TEXT'),false);assert.deepEqual(state.tasks[0],sourceTask);
 }
});

test('per-finding contract rejects omissions, duplicate codes, unsupported acceptance, wrong references and inconsistent overall decisions',()=>{
 const source=sourceFor(sourceTask);assert(validSource(source));assert(validVerdict(verdict(),source));
 for(const mutate of [v=>v.findings.pop(),v=>v.findings[1].code=v.findings[0].code,v=>v.decision='accept',v=>v.findings[0].decision='accept',v=>v.findings[0].evidence=[],v=>v.findings[0].evidence[0].path='../escape',v=>v.tool='write']){const v=verdict();mutate(v);assert.equal(validVerdict(v,source),false);}
});
