'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,hash,LIMITS}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {MODEL,PRICING,pilotAdapter}=require('../lib/agent-operations-pilot');
const {runStage}=require('../lib/agent-operations-worker');
const {diagnostic,providerError}=require('../lib/agent-operations-diagnostics');
async function setup(fetchImpl){
  let raw=null;const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(raw!==a)return false;raw=b;return true;}},{scope:{origin:'https://contract-fixture.vercel.app',commit:'a'.repeat(40)}});
  const approval={...PROJECT,id:'pilot_contract_fixture',authorized:true,scopeHash:hash(store.scope),expiresAt:Date.now()+600000,maxMicros:LIMITS.taskMicros,model:MODEL,pricingVersion:PRICING.version};
  const task=await store.create({principal:'offline',idempotencyKey:'contract_fixture',objective:'Inspect Legal dashboard imagery relevance and Growth pricing badge spacing on the pinned Preview. Read-only findings and independent QA; no code changes.',mode:'pilot',approval});approval.taskId=task.id;
  return {store,task,adapter:pilotAdapter({enabled:true,apiKey:'synthetic-only-key',getApproval:async()=>approval,capture:async()=>[],fetchImpl})};
}
function success(){return new Response(JSON.stringify({id:'resp_offline_contract',model:MODEL,status:'completed',usage:{input_tokens:200,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({stage:'chief',delegate:'website-visual-qa',note:'Synthetic offline delegation'})}]}]}),{status:200,headers:{'x-request-id':'req_offline_contract'}});}
// Independent narrow contract fixture, not a substitute for the provider implementation.
function validateRequest(url,options){
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert(options.signal instanceof AbortSignal);
  assert.deepEqual(Object.keys(options.headers).sort(),['Authorization','Content-Type','OpenAI-Organization','OpenAI-Project','X-Client-Request-Id'].sort());assert.equal(options.headers.Authorization,'Bearer synthetic-only-key');assert.equal(options.headers['Content-Type'],'application/json');assert.equal(options.headers['OpenAI-Project'],PROJECT.projectId);assert.equal(options.headers['OpenAI-Organization'],PROJECT.organizationId);assert.match(options.headers['X-Client-Request-Id'],/^exec_/);
  const b=JSON.parse(options.body);assert.deepEqual(Object.keys(b).sort(),['model','instructions','input','max_output_tokens','store','tools','text','metadata'].sort());assert.equal(b.model,'gpt-4.1-2025-04-14');assert.equal(b.max_output_tokens,1500);assert.equal(b.store,false);assert.deepEqual(b.tools,[]);assert.deepEqual(b.text,{format:{type:'json_object'}});assert.equal(typeof b.instructions,'string');assert.match(b.instructions,/untrusted data/);assert.equal(b.input.length,2);
  assert.deepEqual(b.input.map(m=>m.role),['developer','user']);for(const m of b.input){assert.deepEqual(Object.keys(m).sort(),['content','role']);assert.equal(m.content.length,1);assert.deepEqual(Object.keys(m.content[0]).sort(),['text','type']);assert.equal(m.content[0].type,'input_text');assert.equal(typeof m.content[0].text,'string');}
  assert.match(b.input[0].content[0].text,/\bJSON\b/);const data=JSON.parse(b.input[1].content[0].text);assert.deepEqual(Object.keys(data).sort(),['objective','prior','scope']);assert.equal(data.prior,null);assert(!/\bjson\b/i.test(b.input[1].content[0].text));assert.deepEqual(Object.keys(b.metadata).sort(),['execution_id','task_id']);for(const [k,v]of Object.entries(b.metadata)){assert(k.length<=64);assert.equal(typeof v,'string');assert(v.length<=512);}return b;
}
test('exact Chief request satisfies the reviewed GPT-4.1 Responses contract with no SDK or reasoning/tool extras',async()=>{
  let calls=0;const f=await setup(async(url,options)=>{calls++;validateRequest(url,options);return success();});const out=await runStage(f.store,f.adapter,{taskId:f.task.id});assert.equal(calls,1);assert.equal(out.stage,'inspect');assert.equal(out.usage.length,1);assert.equal((await f.store.read()).reservations[0].status,'settled');
});
test('input-only JSON prerequisite mock rejects reconstructed legacy shape and accepts corrected conversation',async()=>{
  let received;const f=await setup(async(url,options)=>{received=validateRequest(url,options);return success();});await runStage(f.store,f.adapter,{taskId:f.task.id});
  const legacy={...received,input:received.input.filter(m=>m.role==='user')};assert.match(legacy.instructions,/JSON/);assert(!/json/i.test(JSON.stringify(legacy.input)));
  // Hypothetical input-only gate: official docs say context, which also includes instructions.
  // This demonstrates the defensive change, not the historical provider implementation/cause.
  const mockProvider=b=>!/\bjson\b/i.test(JSON.stringify(b.input))?new Response(JSON.stringify({error:{type:'invalid_request_error',code:null,param:'input',message:"Response input messages must contain the word 'json' to use text.format of type json_object."}}),{status:400}):success();
  assert.equal(mockProvider(legacy).status,400);assert.equal(mockProvider(received).status,200);
});
test('provider error parameter and canonical message survive durable checkpoints without echoed payloads or retries',async()=>{
  let calls=0;const f=await setup(async()=>{calls++;return new Response(JSON.stringify({error:{type:'invalid_request_error',code:null,param:'input',message:"Response input messages must contain the word 'json'. Echo: private objective sk-proj-THIS_IS_A_SYNTHETIC_SECRET_123 Bearer fake-sensitive-value"}}),{status:400,headers:{'x-request-id':'req_contract_denied'}});});const out=await runStage(f.store,f.adapter,{taskId:f.task.id});const d=out.events.at(-1).diagnostic,r=(await f.store.read()).reservations[0];assert.equal(d.code,'invalid_request_error');assert.equal(d.providerParam,'input');assert.equal(d.providerMessage,'JSON mode requires an explicit JSON instruction in request context.');assert.equal(d.requestId,'req_contract_denied');assert.equal(d.httpStatus,400);assert.equal(d.errorType,'RequestFormatError');assert(r.evidence.some(e=>e.providerParam==='input'&&e.providerMessage===d.providerMessage));assert.equal(r.status,'pending');assert.equal(out.usage.length,0);await runStage(f.store,f.adapter,{taskId:f.task.id});assert.equal(calls,1);const saved=JSON.stringify(await f.store.read());for(const forbidden of ['private objective','THIS_IS_A_SYNTHETIC_SECRET','fake-sensitive-value','Echo:'])assert(!saved.includes(forbidden));
});
test('provider summaries and parameter paths independently fail closed on arbitrary text and credential-like names',()=>{
  assert.deepEqual(providerError({code:'unsupported_parameter',param:'reasoning.effort',message:"Unsupported parameter: reasoning.effort; secret-payload"}),{code:'unsupported_parameter',providerParam:'reasoning.effort',providerMessage:'Unsupported request parameter.'});assert.equal(providerError({type:'invalid_request_error',param:'input[1].content[0].text'}).providerParam,'input[1].content[0].text');
  for(const value of ['sk-proj-SECRET_123456789','input[9].content[0].text','metadata.customer_private_value','https://secret.example'])assert.equal(providerError({param:value}).providerParam,undefined);
  const d=diagnostic({phase:'provider_http',providerParam:'secret',providerMessage:'credentials and payload',message:'raw-message'});assert.equal(d.providerParam,undefined);assert.equal(d.providerMessage,undefined);assert.equal(d.message,undefined);
  assert.equal(providerError({message:'an arbitrary sensitive objective or credential'}).providerMessage,'Provider error text omitted.');
});
