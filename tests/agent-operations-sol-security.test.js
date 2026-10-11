'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('../lib/agent-operations-visual-model'),ef=require('../lib/agent-operations-evidence-first');
const {trustedApproval}=require('../lib/agent-operations-api'),{createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const source=require('./fixtures/agent-operations-qa-source.json');
function approval(){return {...PROJECT,...vm.identity(),authorized:true,modelAccessVerified:true,id:'pilot_independent_sol_security',profile:vm.HYBRID.profile,evaluationHash:vm.HYBRID.evaluationHash,maxCalls:2,maxMicros:1000000,scopeHash:hash(source.scope),sourceTaskId:vm.HYBRID.sourceTaskId,findingsHash:vm.HYBRID.findingsHash,evidenceHash:vm.HYBRID.evidenceHash,expiresAt:Date.now()+300000};}
test('independent admission requires both exact verified strings and a separate paid authorization',()=>{
 const a=approval(),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify(a),CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED:'true',CALLERCORE_AGENTOPS_SOL_VISION_BOUND_VERIFIED:'true'};
 assert(trustedApproval(env,source.scope));
 for(const key of ['CALLERCORE_AGENTOPS_ENABLED','CALLERCORE_AGENTOPS_PAID_ENABLED','CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED','CALLERCORE_AGENTOPS_SOL_VISION_BOUND_VERIFIED'])for(const value of [undefined,false,true,'false','TRUE','1'])assert.equal(trustedApproval({...env,[key]:value},source.scope),null,key+':'+value);
 for(const patch of [{authorized:false},{modelAccessVerified:false},{maxCalls:3},{maxMicros:1000001},{evaluationHash:'0'.repeat(64)},{projectId:'foreign'}])assert.equal(trustedApproval({...env,CALLERCORE_AGENTOPS_PILOT_APPROVAL:JSON.stringify({...a,...patch})},source.scope),null);
});
test('planning bound accounts for schema/instructions and explicitly refuses to claim verified image sizing',()=>{
 const images=[1440,390,1440,390].map(viewport=>({viewport,height:1000}));
 const body={input:[{content:[{type:'input_text',text:'small'},{type:'input_image',image_url:'not-counted-as-text'}]}],instructions:'safe',text:{format:vm.schema('adjudicate')},max_output_tokens:25000};
 const bound=vm.requestBound(body,images);assert.equal(bound.visionSizingVerified,false);assert(bound.inputTokenPlanningBound>80000);
 assert.throws(()=>vm.requestBound({...body,instructions:'x'.repeat(40000)},images));
 assert.throws(()=>vm.requestBound({...body,max_output_tokens:50000},images));
 assert.throws(()=>vm.requestBound(body,images.slice(1)));
 assert.throws(()=>vm.requestBound(body,images.map(i=>({...i,height:1001}))));
});
test('server refuses forged legacy rates and excess stage output without consuming pending reservation',async()=>{
 let raw=JSON.stringify({version:1,revision:0,tasks:[structuredClone(source)],reservations:[]});
 const store=createStore({read:async()=>raw,compare:async(a,b)=>{if(a!==raw)return false;raw=b;return true;}},{scope:source.scope});
 const task=await store.create({principal:'independent',idempotencyKey:'independent_sol_receipt',objective:vm.HYBRID.objective,mode:'pilot',approval:approval()});
 const running=await store.command(task.id,{type:'claim',expectedRevision:task.revision});
 await store.command(task.id,{type:'reserve',fence:running.fence,executionId:'exec_independent_sol_receipt'});
 const result={stage:'observe',facts:[1,2,3,4].map(i=>({id:'O'+i,imageId:'I'+i,region:[.1,.1,.3,.3],observed:'Offline fixture',readability:'limited',uncertainty:'Not visual acceptance'})),note:'Offline'};
 const finish={type:'finish',fence:running.fence,executionId:'exec_independent_sol_receipt',...PROJECT,result,model:vm.HYBRID.model,inputTokens:100,outputTokens:100,actualMicros:1200};
 for(const patch of [{actualMicros:1000},{outputTokens:25001,actualMicros:250210},{model:'gpt-4.1-2025-04-14'},{projectId:'foreign'}])await assert.rejects(store.command(task.id,{...finish,...patch}));
 const state=await store.read();assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations[0].ceilingMicros,500000);assert.equal(state.tasks[1].usage.length,0);assert.deepEqual(state.tasks[0],source);
});
test('blind hybrid projection excludes server geometry, reference labels and arbitrary model config extras',()=>{
 const t={id:'offline',profile:vm.HYBRID.profile,stage:'observe',status:'running',evidenceBinding:ef.binding(require('../lib/agent-operations-qa').sourceFor(source)),results:{},source,modelConfig:{secret:'SENTINEL'},observationAssessment:{gold:'SENTINEL'},outcomes:{referenceSupport:'SENTINEL'},events:[{secret:'SENTINEL'}]};
 const p=ef.project(t);assert(!JSON.stringify(p).includes('SENTINEL'));assert.deepEqual(Object.keys(ef.input(p)),['images']);assert.equal(p.claims,undefined);
});
