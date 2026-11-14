'use strict';
// Prepare-only second profile. No provider, grants, dispatch or qualification writer.
const {isDeepStrictEqual:equal}=require('node:util'),{createHash}=require('node:crypto');
const builder=require('../scripts/source-execution-notification-tests.cjs'),runner=require('../scripts/source-execution-notification-runner.cjs');
const PROFILE='notification-source-tests-v1',DESCRIPTOR='2afde9ca07f7fd17f7722fb86b748c278e5bc9c94d4a93feae4ec511fe7caa47',prepared=new WeakMap();
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex'),check=(v,c)=>{if(!v)throw Error(c);};
function capabilities(){return{profile:PROFILE,status:'prepared-awaiting-exact-profile-qualification',sourceHashes:{...builder.HASHES},testIds:[...builder.TESTS],qualified:false,executionAuthorized:false,providerConnected:false,publicationAuthorized:false,independentlyAccepted:false,taskReopened:false};}
function prepare(input){
 check(input&&Object.keys(input).sort().join(',')==='baseline,binding,descriptorHash,patched,proposalHash','ENG_NOTIFICATION_TEST_INPUT');
 const {binding,baseline,patched,proposalHash,descriptorHash}=input;
 check(binding&&Object.keys(binding).sort().join(',')==='deploymentId,executionId,ownerHash,planId,releaseHash,sourceCommit,taskId,workspaceHash','ENG_TEST_BINDING');
 for(const k of ['ownerHash','workspaceHash','releaseHash'])check(/^[a-f0-9]{64}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{40}$/.test(binding.sourceCommit)&&/^dpl_[A-Za-z0-9]{1,100}$/.test(binding.deploymentId),'ENG_TEST_BINDING');
 for(const k of ['planId','taskId','executionId'])check(/^[A-Za-z0-9_-]{1,160}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{64}$/.test(proposalHash)&&descriptorHash===DESCRIPTOR,'ENG_NOTIFICATION_TEST_SCOPE');
 const command=runner.command({mode:'notification',baseline,patched});
 command.args[command.args.length-1]+='\n/* notification-test-binding:'+hash({binding,proposalHash,descriptorHash})+' */\n';command.programSha256=hash(command.args.at(-1));
 const body={version:PROFILE,binding:structuredClone(binding),descriptorHash,proposalHash,commandHash:command.programSha256,testProgramHash:command.testProgramSha256,sourceHashes:command.sourceHashes};
 const job={manifest:{...body,hash:hash(body)},command};prepared.set(job,structuredClone(job));return job;
}
function validateReport(job,outcome){
 check(job&&prepared.has(job)&&equal(job,prepared.get(job)),'ENG_NOTIFICATION_TEST_PROVENANCE');
 check(outcome?.exitCode===0&&typeof outcome.stdout==='string'&&Buffer.byteLength(outcome.stdout)<=16000,'ENG_TEST_PROVIDER_RESULT');
 let r;try{r=JSON.parse(outcome.stdout);}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}
 check(r.version==='source-isolated-runner-result-v1'&&r.mode==='notification'&&r.programSha256===job.manifest.commandHash&&r.testProgramSha256===job.manifest.testProgramHash&&equal(r.sourceHashes,job.manifest.sourceHashes),'ENG_TEST_RESULT_BINDING');
 check(r.qualificationPassed===true&&r.runPassed===true&&r.protectedIntegrity===true&&r.cleanupConfirmed===true&&r.publicationAuthorized===false&&r.independentlyAccepted===false,'ENG_TEST_FAILED');
 const labels=['qualification','positive','seeded-failure','timeout','notification'];
 check(Array.isArray(r.results)&&r.results.length===5&&r.results.every((x,i)=>x.label===labels[i]),'ENG_TEST_RESULT_ORDER');
 const [q,p,n,t,s]=r.results,checks=require('./agent-operations-source-test-dispatch').CHECKS;
 check(q.exitCode===0&&q.output?.passed===true&&equal(Object.keys(q.output.checks||{}).sort(),[...checks].sort())&&Object.values(q.output.checks).every(x=>x===true),'ENG_TEST_ISOLATION');
 check([q,p,n,s].every(x=>x.timedOut===false&&x.outputLimit===false&&x.spawnFailed===false)&&p.exitCode===0&&n.exitCode===1&&t.timedOut===true&&t.signal==='SIGKILL'&&t.childStarted===true&&t.descendantsTerminated===true,'ENG_TEST_TERMINATION');
 check(s.exitCode===0&&s.programSha256===job.manifest.testProgramHash&&s.output?.version==='notification-source-behavioral-result-v1'&&s.output.passed===true&&Array.isArray(s.output.tests)&&s.output.tests.length===builder.TESTS.length&&s.output.tests.every((x,i)=>Object.keys(x).sort().join(',')==='id,passed'&&x.id===builder.TESTS[i]&&x.passed===true),'ENG_TEST_FAILED');
 return{contractValid:true,reportHash:hash(outcome.stdout),checksPassed:checks.length,tests:s.output.tests.map(x=>({...x})),qualified:false,executionAuthorized:false,publicationAuthorized:false,independentlyAccepted:false,qualification:'Outcome structure only; this parser creates no OS qualification, permission or proof of a live provider run.'};
}
module.exports={PROFILE,DESCRIPTOR,capabilities,prepare,validateReport};
