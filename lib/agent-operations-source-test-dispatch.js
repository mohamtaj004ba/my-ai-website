'use strict';
// Trusted orchestration only. Journal callbacks use the existing organization
// CAS. The provider is private to the backend; neither is supplied by a model.
const {createHash}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util'),prepared=new WeakMap();
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const check=(v,code)=>{if(!v)throw Error(code);};
const PROFILE='starter-source-tests-v1';
const CODES=new Set(['ENG_TEST_BINDING','ENG_TEST_PROPOSAL','ENG_TEST_MANIFEST','ENG_TEST_COMMAND','ENG_TEST_PERMISSION','ENG_TEST_UNAVAILABLE','ENG_TEST_CANCELLED','ENG_TEST_REVOKED','ENG_TEST_SERIAL','ENG_TEST_PROVIDER_AUTH','ENG_TEST_PROVIDER_HTTP','ENG_TEST_PROVIDER_RESULT','ENG_TEST_PROVIDER_SCOPE','ENG_TEST_RESULT_BINDING','ENG_TEST_RESULT_ORDER','ENG_TEST_ISOLATION','ENG_TEST_TERMINATION','ENG_TEST_FAILED','ENG_TEST_SHUTDOWN','ENG_TEST_PROVIDER_UNCONFIRMED','ENG_TEST_JOURNAL_UNCONFIRMED']);
const IMAGE='vercel/sandbox/universal@sha256:3190aee7b741f9912c41c03f28a102f56e5ee8591f2696a06ef811cf901df949';
const PROJECT='prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX';
const CHECKS=['uidGid','noNewPrivileges','capabilitiesZero','groupsEmpty','readOnlyRoot','readOnlyProc','protectedRead','workWrite','protectedWrite','outsideWrite','symlinkEscape','traversalEscape','outsideTmp','otherWorkspaceRead','outsideSentinelAbsent','otherExecutable','processGroupEscapeDenied','networkSockets','stdioSocketsOnly','scratchQuota','diskDenial','descriptorDenial','processThreadDenial'];
const TESTS=['baseline-starter-reproduces-automations-warning','patched-starter-omits-forbidden-feed-and-warning','entitled-plan-keeps-original-feed-handler','unrelated-feeds-and-failure-notice-preserved','appointment-capability-and-entitlement-both-required','cleared-generation-cannot-apply-stale-data-or-notice','older-generation-cannot-overwrite-newer-refresh'];
function prepare({binding,baseline,patched,proposalHash}){
 check(binding&&Object.keys(binding).sort().join(',')==='deploymentId,executionId,ownerHash,planId,releaseHash,sourceCommit,taskId,workspaceHash','ENG_TEST_BINDING');
 for(const k of ['ownerHash','workspaceHash','releaseHash'])check(/^[a-f0-9]{64}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{40}$/.test(binding.sourceCommit)&&/^dpl_[A-Za-z0-9]+$/.test(binding.deploymentId),'ENG_TEST_BINDING');
 for(const k of ['executionId','planId','taskId'])check(/^[a-zA-Z0-9_-]{1,160}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{64}$/.test(proposalHash),'ENG_TEST_PROPOSAL');
 const command=require('../scripts/source-execution-isolated-runner.cjs').command({mode:'starter',baseline,patched});
 command.args[command.args.length-1]+='\n/* source-test-binding:'+hash({binding,proposalHash})+' */\n';command.programSha256=hash(command.args.at(-1));
 const body={version:PROFILE,binding:structuredClone(binding),proposalHash,commandHash:command.programSha256,testProgramHash:command.testProgramSha256,sourceHashes:command.sourceHashes};
 const job={manifest:{...body,hash:hash(body)},command};prepared.set(job,structuredClone(job));return job;
}
function validateReport(job,result){
 const diagnostic=require('./agent-operations-source-test-diagnostic');
 try{return validateReportBody(job,result);}catch(error){throw diagnostic.attach(error,diagnostic.fromOutcome(job,result));}
}
function validateReportBody(job,result){
 check(result&&result.exitCode===0&&typeof result.stdout==='string'&&Buffer.byteLength(result.stdout)<=16000,'ENG_TEST_PROVIDER_RESULT');
 let report;try{report=JSON.parse(result.stdout);}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}
 check(report.version==='source-isolated-runner-result-v1'&&report.mode==='starter'&&report.programSha256===job.manifest.commandHash&&report.testProgramSha256===job.manifest.testProgramHash&&JSON.stringify(report.sourceHashes)===JSON.stringify(job.manifest.sourceHashes),'ENG_TEST_RESULT_BINDING');
 check(report.qualificationPassed===true&&report.runPassed===true&&report.protectedIntegrity===true&&report.cleanupConfirmed===true&&report.publicationAuthorized===false&&report.independentlyAccepted===false,'ENG_TEST_FAILED');
 check(Array.isArray(report.results)&&report.results.length===5&&report.results.every((r,i)=>r.label===['qualification','positive','seeded-failure','timeout','starter'][i]),'ENG_TEST_RESULT_ORDER');
 const [q,p,n,t,s]=report.results;
 check(q.exitCode===0&&q.output?.passed===true&&Object.keys(q.output.checks||{}).sort().join(',')===[...CHECKS].sort().join(',')&&Object.values(q.output.checks).every(v=>v===true),'ENG_TEST_ISOLATION');
 check([q,p,n,s].every(x=>!x.timedOut&&!x.outputLimit&&!x.spawnFailed)&&p.exitCode===0&&n.exitCode===1&&t.timedOut===true&&t.signal==='SIGKILL'&&t.childStarted===true&&t.descendantsTerminated===true,'ENG_TEST_TERMINATION');
 check(s.exitCode===0&&!s.timedOut&&!s.outputLimit&&!s.spawnFailed&&s.programSha256===job.manifest.testProgramHash&&s.output?.passed===true&&s.output.tests?.length===7&&s.output.tests.every((x,i)=>Object.keys(x).sort().join(',')==='id,passed'&&x.id===TESTS[i]&&x.passed===true),'ENG_TEST_FAILED');
 return{reportHash:hash(result.stdout),checksPassed:23,tests:s.output.tests.map(x=>({...x})),sourceExecuted:true,cleanupConfirmed:true,publicationAuthorized:false,independentlyAccepted:false};
}
async function dispatch({job,journal,provider,signal,clock=Date.now}){
 check(job&&prepared.has(job)&&equal(prepared.get(job),job),'ENG_TEST_PREPARATION_PROVENANCE');
 job=structuredClone(prepared.get(job));
 check(job&&job.manifest?.version===PROFILE&&hash({...job.manifest,hash:undefined})===job.manifest.hash,'ENG_TEST_MANIFEST');
 check(job.command?.programSha256===job.manifest.commandHash&&hash(job.command.args?.at(-1))===job.manifest.commandHash,'ENG_TEST_COMMAND');
 // Rebuild exact argv from the reviewed code, not caller-provided executable,
 // resources, environment or command flags.
 const expected=job.command;
 check(job.command.command==='/usr/bin/env'&&job.command.sudo===true&&job.command.timeout===150000&&job.command.publicationAuthorized===false&&job.command.executionClass==='exact-starter-patch-only','ENG_TEST_COMMAND');
 check(equal(expected,job.command)&&journal&&provider,'ENG_TEST_UNAVAILABLE');
 let permit,session,result,failure=null,diagnostic=null,stopConfirmed=false,createAttempted=false;
 const diagnostics=require('./agent-operations-source-test-diagnostic');
 const authorize=async()=>{check(!signal?.aborted,'ENG_TEST_CANCELLED');await journal.verify(structuredClone(permit),structuredClone(job.manifest));};
 try{
  // claim atomically consumes explicit source-test permission and records the
  // unique provider name BEFORE create. Lost acknowledgments never retry create.
  permit=structuredClone(await journal.claim(structuredClone(job.manifest)));
  check(permit?.manifestHash===job.manifest.hash&&/^[a-f0-9]{32}$/.test(permit.id)&&Number.isSafeInteger(permit.expiresAt)&&permit.expiresAt>clock()&&permit.expiresAt<=clock()+300000,'ENG_TEST_PERMISSION');
  await authorize();
  createAttempted=true;session=await provider.create({name:'callercore-test-'+permit.id,projectId:PROJECT,image:IMAGE,architecture:'amd64',region:'iad1',resources:{vcpus:1},timeout:300000,persistent:false,networkPolicy:{mode:'deny-all'},ports:[],env:{}},{signal});
  check(/^sbx_[A-Za-z0-9]+$/.test(session?.id||''),'ENG_TEST_PROVIDER_SCOPE');
  await journal.started(permit,session.id);await authorize();
  check(session.projectId===PROJECT&&session.name==='callercore-test-'+permit.id&&session.image===IMAGE&&session.vcpus===1&&session.memory===2048&&session.timeout===300000&&session.persistent===false&&session.networkPolicy?.mode==='deny-all'&&session.routes?.length===0,'ENG_TEST_PROVIDER_SCOPE');
  const outcome=await provider.run(session.id,structuredClone(job.command),{signal,authorize});
  await authorize();diagnostic=diagnostics.fromOutcome(job,outcome);result=validateReport(job,outcome);diagnostic=null;
 }catch(error){failure=CODES.has(error?.message)?error.message:'ENG_TEST_PROVIDER_UNCONFIRMED';diagnostic=diagnostics.forError(error)||diagnostic;}
 finally{
  if(permit){
   try{
    // Reconcile a lost create acknowledgment by its unique name, never create
    // again. Cleanup has independent authority even after task revocation.
    const found=await provider.find('callercore-test-'+permit.id);
    if(found){check(found.projectId===PROJECT&&found.name==='callercore-test-'+permit.id&&/^sbx_[A-Za-z0-9]+$/.test(found.id||''),'ENG_TEST_SHUTDOWN');session=found;await provider.stop(found.id);const terminal=await provider.read(found.id);check(terminal.id===found.id&&terminal.projectId===PROJECT&&terminal.name===found.name&&terminal.status==='stopped','ENG_TEST_SHUTDOWN');stopConfirmed=true;}
    else{check(!createAttempted,'ENG_TEST_SHUTDOWN');stopConfirmed=true;}
   }catch{failure='ENG_TEST_SHUTDOWN';}
   
 const body={version:PROFILE,manifestHash:job.manifest.hash,permitId:permit.id,sessionId:/^sbx_[A-Za-z0-9]+$/.test(session?.id||'')?session.id:null,status:failure?'failed':'completed',failure,...(failure&&diagnostic?{diagnostic:diagnostics.sanitize(diagnostic)}:{}),result:failure?null:result,stopConfirmed,publicationAuthorized:false,independentlyAccepted:false};
   try{await journal.close(structuredClone(permit),{...body,hash:hash(body)});}catch{throw Object.assign(Error('ENG_TEST_JOURNAL_UNCONFIRMED'),{cleanupConfirmed:!createAttempted||stopConfirmed});}
  }
 }
 if(failure){const error=Object.assign(Error(failure),{cleanupConfirmed:!createAttempted||stopConfirmed});throw diagnostic?diagnostics.attach(error,diagnostic):error;}return result;
}
function validateEvidence(e,binding,proposal){
 const impl=require('./agent-operations-implementation'),baseline=impl.snapshot().text;
 check(proposal?.edits?.length===1,'ENG_TEST_PROPOSAL');const edit=proposal.edits[0];
 const expected=prepare({binding:{ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,planId:binding.planId,taskId:binding.taskId+'_source_test',executionId:binding.executionId+'_source_test',sourceCommit:binding.runtime.sourceCommit,releaseHash:binding.runtime.release.digest,deploymentId:binding.runtime.deploymentId},baseline,patched:baseline.replace(edit.beforeText,edit.afterText),proposalHash:hash(proposal)});
 check(e&&equal(e.manifest,expected.manifest)&&e.receipt?.manifestHash===e.manifest.hash,'ENG_TEST_RESULT_BINDING');const {hash:h,...body}=e.receipt;
 check(h===hash(body)&&body.status==='completed'&&body.failure===null&&body.stopConfirmed===true&&body.publicationAuthorized===false&&body.independentlyAccepted===false&&/^[a-f0-9]{32}$/.test(body.permitId)&&/^sbx_[A-Za-z0-9]+$/.test(body.sessionId||''),'ENG_TEST_RESULT_BINDING');
 const r=body.result;check(r?.sourceExecuted===true&&r.checksPassed===23&&r.cleanupConfirmed===true&&r.publicationAuthorized===false&&r.independentlyAccepted===false&&/^[a-f0-9]{64}$/.test(r.reportHash||'')&&r.tests?.length===7&&r.tests.every((t,i)=>t.id===TESTS[i]&&t.passed===true),'ENG_TEST_FAILED');return true;
}
module.exports={PROFILE,IMAGE,PROJECT,CHECKS,TESTS,prepare,validateReport,validateEvidence,dispatch};
