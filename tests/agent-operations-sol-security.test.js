'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('../lib/agent-operations-visual-model'),ef=require('../lib/agent-operations-evidence-first');
const {trustedApproval}=require('../lib/agent-operations-api'),{createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const source=require('./fixtures/agent-operations-qa-source.json');
function approval(){return {...PROJECT,...vm.identity(),authorized:true,modelAccessVerified:true,visionEstimateAccepted:true,id:'pilot_independent_sol_security',profile:vm.HYBRID.profile,evaluationHash:vm.HYBRID.evaluationHash,maxCalls:2,maxMicros:2000000,scopeHash:hash(source.scope),sourceTaskId:vm.HYBRID.sourceTaskId,findingsHash:vm.HYBRID.findingsHash,evidenceHash:vm.HYBRID.evidenceHash,expiresAt:Date.now()+300000};}
test('independent admission requires both exact verified strings and a separate paid authorization',()=>{
 const a=approval(),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a),CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED:'true',CALLERCORE_AGENTOPS_SOL_VISION_ESTIMATE_ACCEPTED:'true'};
 assert(trustedApproval(env,source.scope));
 for(const key of ['CALLERCORE_AGENTOPS_ENABLED','CALLERCORE_AGENTOPS_PAID_ENABLED','CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED','CALLERCORE_AGENTOPS_SOL_VISION_ESTIMATE_ACCEPTED'])for(const value of [undefined,false,true,'false','TRUE','1'])assert.equal(trustedApproval({...env,[key]:value},source.scope),null,key+':'+value);
 for(const patch of [{authorized:false},{modelAccessVerified:false},{maxCalls:3},{maxMicros:2000001},{evaluationHash:'0'.repeat(64)},{projectId:'foreign'}])assert.equal(trustedApproval({...env,CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify({...a,...patch})},source.scope),null);
});
test('planning bound accounts for schema/instructions and explicitly refuses to claim verified image sizing',()=>{
 const images=[1440,390,1440,390].map(viewport=>({viewport,height:1000}));
 const body={input:[{content:[{type:'input_text',text:'small'},{type:'input_image',image_url:'not-counted-as-text'}]}],instructions:'safe',text:{format:vm.schema('adjudicate')},max_output_tokens:20000,prompt_cache_options:{mode:'explicit'}};
 const bound=vm.requestBound(body,images);assert.equal(bound.visionSizingVerified,false);assert(bound.inputTokenPlanningBound>102004);
 assert.throws(()=>vm.requestBound({...body,instructions:'x'.repeat(40000)},images));
 assert.throws(()=>vm.requestBound({...body,max_output_tokens:50000},images));
 assert.throws(()=>vm.requestBound(body,images.slice(1)));
 assert.throws(()=>vm.requestBound(body,images.map(i=>({...i,height:1001}))));
 for(const options of [undefined,{mode:'implicit'},{mode:'explicit',breakpoints:[]},{mode:'explicit',extra:true}])assert.throws(()=>vm.requestBound({...body,prompt_cache_options:options},images));
});
test('server refuses forged legacy rates and excess stage output without consuming pending reservation',async()=>{
 let raw=JSON.stringify({version:1,revision:0,tasks:[structuredClone(source)],reservations:[]});
 const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(a!==raw)return false;raw=b;return true;}},{scope:source.scope});
 const task=await store.create({principal:'independent',idempotencyKey:'independent_sol_receipt',objective:vm.HYBRID.objective,mode:'pilot',approval:approval()});
 const running=await store.command(task.id,{type:'claim',expectedRevision:task.revision});
 await store.command(task.id,{type:'reserve',fence:running.fence,executionId:'exec_independent_sol_receipt'});
 const result={stage:'observe',facts:[1,2,3,4].map(i=>({id:'O'+i,imageId:'I'+i,region:[.1,.1,.3,.3],observed:'Offline fixture',readability:'limited',uncertainty:'Not visual acceptance'})),note:'Offline'};
 const diagnostic={phase:'provider_output',httpStatus:200,providerStatus:'completed',serviceTier:'default',inputTokens:100,outputTokens:100,cachedInputTokens:0,cacheWriteTokens:0,usageValidated:true};
 const finish={type:'finish',fence:running.fence,executionId:'exec_independent_sol_receipt',...PROJECT,result,model:vm.HYBRID.model,inputTokens:100,outputTokens:100,actualMicros:1200,diagnostic};
 for(const patch of [{actualMicros:1000},{outputTokens:20001,actualMicros:250210},{model:'gpt-4.1-2025-04-14'},{projectId:'foreign'}])await assert.rejects(store.command(task.id,{...finish,...patch}));
 const state=await store.read();assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations[0].ceilingMicros,1000000);assert.equal(state.tasks[1].usage.length,0);assert.deepEqual(state.tasks[0],source);
 for(const patch of [{cachedInputTokens:1},{cacheWriteTokens:1},{cachedInputTokens:undefined},{cacheWriteTokens:undefined},{cacheWriteTokens:-1},{cacheWriteTokens:'0'},{inputTokens:101},{outputTokens:101},{usageValidated:false},{providerStatus:'incomplete'},{serviceTier:'priority'}])await assert.rejects(store.command(task.id,{...finish,diagnostic:{...diagnostic,...patch}}));
 await assert.rejects(store.command(task.id,{...finish,diagnostic:undefined}));
 assert.equal((await store.read()).reservations[0].status,'pending');
 const completed=await store.command(task.id,finish);assert.equal(completed.stage,'adjudicate');assert.equal((await store.read()).reservations[0].status,'settled');
});
test('cache-control parameter diagnostics retain only canonical contract paths and bounded counters',()=>{
 const {providerError,taskDiagnostic}=require('../lib/agent-operations-diagnostics');
 for(const param of ['prompt_cache_options','prompt_cache_options.mode'])assert.equal(providerError({param}).providerParam,param);
 for(const param of ['prompt_cache_options.SECRET','prompt_cache_options.mode.SECRET','prompt_cache_options[secret]'])assert.equal(providerError({param}).providerParam,undefined);
 const t={profile:vm.HYBRID.profile};assert.equal(taskDiagnostic({cacheWriteTokens:0},t).cacheWriteTokens,0);assert.equal(taskDiagnostic({cacheWriteTokens:1050000},t).cacheWriteTokens,1050000);
 for(const value of [-1,1050001,'0',NaN,Infinity])assert.equal(taskDiagnostic({cacheWriteTokens:value},t).cacheWriteTokens,undefined);
 assert.equal(taskDiagnostic({cacheWriteTokens:10},{profile:ef.EF.profile}).cacheWriteTokens,undefined);
});
test('blind hybrid projection excludes server geometry, reference labels and arbitrary model config extras',()=>{
 const t={id:'offline',profile:vm.HYBRID.profile,stage:'observe',status:'running',evidenceBinding:ef.binding(require('../lib/agent-operations-qa').sourceFor(source)),results:{},source,modelConfig:{secret:'SENTINEL'},observationAssessment:{gold:'SENTINEL'},outcomes:{referenceSupport:'SENTINEL'},events:[{secret:'SENTINEL'}]};
 const p=ef.project(t);assert(!JSON.stringify(p).includes('SENTINEL'));assert.deepEqual(Object.keys(ef.input(p)),['images']);assert.equal(p.claims,undefined);
});
