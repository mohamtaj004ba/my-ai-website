'use strict';
// Explicit reusable offline providers for the real controller/CAS and fixed
// source-test path. No provider credential, network or real VM is used.
require('./historical-starter-fixture.cjs');
const a=require('node:assert/strict'),v1=require('../../lib/agent-operations-engineering-inference'),v2=require('../../lib/agent-operations-engineering-provider-v2'),impl=require('../../lib/agent-operations-implementation');
const owner={kind:'owner',verifiedOwner:true,id:'live-patch-qa@example.test',workspaceId:'live-patch-qa-workspace'},PROJECT=require('../../lib/agent-operations-project').PROJECT;
async function setup(testProvider){return require('./engineering-controller.cjs').fixture({objective:impl.OBJECTIVE,sourceTestProvider:testProvider,actor:owner});}

function installProvider(f,{badSpecialist=false,failResponse=-1,afterResponse}={}){
 const previous=global.fetch,calls=[],requests=[];global.fetch=async(url,options)=>{
  a.equal(options.redirect,'error');a.equal(options.headers['OpenAI-Project'],PROJECT.projectId);a.match(url,/^https:\/\/api\.openai\.com\/v1\/responses(?:\/input_tokens)?$/);calls.push(url);const request=JSON.parse(options.body);requests.push({url,request});
  if(url.endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:1000});
  const index=calls.filter(u=>u.endsWith('/responses')).length-1,stage=v1.STAGES[index];if(index===failResponse)return Response.json({error:{message:'Synthetic offline provider failure'}},{status:503});
  const workflow=f.state().operations.workflows[0],approval=workflow.approval,c={...f.context,binding:{...f.context.binding,taskId:f.plan.tasks[index].id,executionId:approval.id+'_'+stage},priorReceipts:workflow.results},value=impl.fixture(stage,c);
  if(stage==='specialist'){const fields=request.text.format.schema.properties.proposal.properties;a.deepEqual(fields.beforeSha256.enum,[impl.snapshot().sourceSha256]);for(const [key,expected] of Object.entries(impl.patchContext(c).binding))a.deepEqual(fields.binding.properties[key].enum,[expected],key);a.equal(value.proposal.beforeSha256,impl.snapshot().sourceSha256);a.deepEqual(request.tools,[]);a.equal(request.store,false);}if(stage==='specialist'&&badSpecialist)value.proposal.path='../protected.js';if(stage==='qa'){for(const d of value.decisions)d.reason='Fixed isolated Starter cases pass; full-app behavior and rendered Starter impact remain unverified.';}if(stage==='auditor'){value.decision='fail';value.reason='Offline independent criticism: fixed Starter cases pass, but full-app behavior and rendered user impact remain unverified.';}
  await afterResponse?.(stage,c,value);
  return Response.json({id:'resp_offline_starter_'+index,status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1000,output_tokens:500,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 };return{calls,requests,restore:()=>{global.fetch=previous;}};
}

function sandboxFixture({fail=false,assertionFailure=false,duringRun,cleanupFailure=false}={}){
 const dispatch=require('../../lib/agent-operations-source-test-dispatch');let session,starts=0,stops=0;
 return{counts:()=>({starts,stops}),async metadata(){return{authenticated:true,executionAuthorized:false};},async create(input){starts++;session={id:'sbx_OfflineSourceTest',name:input.name,projectId:dispatch.PROJECT,image:dispatch.IMAGE,vcpus:1,memory:2048,timeout:300000,persistent:false,networkPolicy:{mode:'deny-all'},routes:[]};return session;},async find(){return session||null;},async stop(){stops++;},async read(){return{...session,status:cleanupFailure?'running':'stopped'};},async run(_id,command,{authorize}){
  await authorize();await duringRun?.();if(fail)throw Error('SYNTHETIC_SECRET_PROVIDER_ERROR');if(assertionFailure){const f=await require('./notification-supervisor-fixture.cjs').fixture({testFailure:true},{baseline:'UNUSED_TRUSTED_FIXTURE',patched:'UNUSED_TRUSTED_FIXTURE',runner:{command:()=>command},mode:'starter',testIds:dispatch.TESTS,resultVersion:'starter-source-behavioral-result-v1'});return{exitCode:f.exitCode,stdout:f.output};}
  const row=(label,exitCode)=>({label,exitCode,timedOut:false,outputLimit:false,spawnFailed:false});
  const report={version:'source-isolated-runner-result-v1',mode:'starter',programSha256:command.programSha256,testProgramSha256:command.testProgramSha256,sourceHashes:command.sourceHashes,qualificationPassed:true,runPassed:true,protectedIntegrity:true,cleanupConfirmed:true,publicationAuthorized:false,independentlyAccepted:false,results:[{...row('qualification',0),output:{passed:true,checks:Object.fromEntries(dispatch.CHECKS.map(k=>[k,true]))}},row('positive',0),row('seeded-failure',1),{label:'timeout',timedOut:true,signal:'SIGKILL',childStarted:true,descendantsTerminated:true},{...row('starter',0),programSha256:command.testProgramSha256,output:{passed:true,tests:dispatch.TESTS.map(id=>({id,passed:true}))}}]};if(assertionFailure){report.runPassed=false;report.results[4].exitCode=1;report.results[4].output.passed=false;report.results[4].output.tests[0].passed=false;}return{exitCode:assertionFailure?1:0,stdout:JSON.stringify(report)};
 }};
}
async function authorize(f){const manifest=await f.control.trialManifest(owner,{planId:f.plan.id,expectedRevision:1,sequenceId:f.sequenceId}),input={planId:f.plan.id,expectedRevision:1,approval:manifest.approval},prepared=await f.control.prepare(owner,input);
 await a.rejects(f.control.authorizeSourceTests({...owner,workspaceId:'foreign'},{...input,expectedApprovalRevision:prepared.record.revision}));
 const tests=await f.control.authorizeSourceTests(owner,{...input,expectedApprovalRevision:prepared.record.revision});await a.rejects(f.control.authorizeSourceTests(owner,{...input,expectedApprovalRevision:prepared.record.revision}));
 const active=await f.control.activate(owner,{...input,expectedApprovalRevision:tests.approvalRevision});return{...input,expectedApprovalRevision:active.revision};}

module.exports={setup,authorize,installProvider,sandboxFixture,owner};
