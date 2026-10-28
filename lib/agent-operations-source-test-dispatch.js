'use strict';
// Trusted orchestration only. Journal callbacks use the existing organization
// CAS. The provider is private to the backend; neither is supplied by a model.
const {createHash}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util'),prepared=new WeakMap();
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const check=(v,code)=>{if(!v)throw Error(code);};
const {SOURCE_TEST_MS,SOURCE_COMMAND_MS}=require('./agent-operations-engineering-timing');
const PROFILE='starter-source-tests-v1';
const CODES=new Set(['ENG_TEST_BINDING','ENG_TEST_PROPOSAL','ENG_TEST_MANIFEST','ENG_TEST_COMMAND','ENG_TEST_PERMISSION','ENG_TEST_UNAVAILABLE','ENG_TEST_CANCELLED','ENG_TEST_REVOKED','ENG_TEST_SERIAL','ENG_TEST_PROVIDER_AUTH','ENG_TEST_PROVIDER_HTTP','ENG_TEST_PROVIDER_RESULT','ENG_TEST_PROVIDER_SCOPE','ENG_TEST_RESULT_BINDING','ENG_TEST_RESULT_ORDER','ENG_TEST_ISOLATION','ENG_TEST_TERMINATION','ENG_TEST_FAILED','ENG_TEST_SHUTDOWN','ENG_TEST_PROVIDER_UNCONFIRMED','ENG_TEST_JOURNAL_UNCONFIRMED']);
const IMAGE='vercel/sandbox/universal@sha256:3190aee7b741f9912c41c03f28a102f56e5ee8591f2696a06ef811cf901df949';
const PROJECT='prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX';
const CHECKS=['uidGid','noNewPrivileges','capabilitiesZero','groupsEmpty','readOnlyRoot','readOnlyProc','protectedRead','workWrite','protectedWrite','outsideWrite','symlinkEscape','traversalEscape','outsideTmp','otherWorkspaceRead','outsideSentinelAbsent','otherExecutable','processGroupEscapeDenied','networkSockets','stdioSocketsOnly','scratchQuota','diskDenial','descriptorDenial','processThreadDenial'];
const TESTS=['baseline-starter-reproduces-automations-warning','patched-starter-omits-forbidden-feed-and-warning','entitled-plan-keeps-original-feed-handler','unrelated-feeds-and-failure-notice-preserved','appointment-capability-and-entitlement-both-required','cleared-generation-cannot-apply-stale-data-or-notice','older-generation-cannot-overwrite-newer-refresh'];
const VISIBLE_PROFILE='call-row-visible-time-source-tests-v1',PHONE_PROFILE='client-phone-search-tests-v1';
function profileFor(c){if(require('./agent-operations-phone-search').enabled(c))return{version:PHONE_PROFILE,mode:'phone-search',executionClass:'task-scoped-phone-search-patch-only',tests:require('../scripts/source-execution-phone-search-tests.cjs').TESTS,taskDescriptor:require('./agent-operations-phone-search').descriptor()};const impl=require('./agent-operations-implementation'),tasks=require('./agent-operations-implementation-tasks'),d=tasks.descriptor(c);if(d?.id==='call-row-visible-time-v1'&&d.testProfile===VISIBLE_PROFILE)return{version:VISIBLE_PROFILE,mode:'visible-time',executionClass:'exact-visible-time-patch-only',tests:require('../scripts/source-execution-visible-time-tests.cjs').TESTS,taskDescriptor:d};if(impl.enabled(c)&&!d)return{version:PROFILE,mode:'starter',executionClass:'exact-starter-patch-only',tests:TESTS};return null;}
function policyForJob(job){if(job?.manifest?.version===PHONE_PROFILE){const p=profileFor({assignment:require('./agent-operations-phone-search').OBJECTIVE});check(job.manifest.taskDescriptorHash===p.taskDescriptor.descriptorHash,'ENG_TEST_MANIFEST');return p;}if(job?.manifest?.version===PROFILE)return{version:PROFILE,mode:'starter',executionClass:'exact-starter-patch-only',tests:TESTS};const tasks=require('./agent-operations-implementation-tasks'),policy=profileFor({assignment:tasks.VISIBLE_TIME_OBJECTIVE});check(job?.manifest?.version===policy.version&&job.manifest.taskDescriptorHash===policy.taskDescriptor.descriptorHash,'ENG_TEST_MANIFEST');return policy;}
function decodeResult(stdout,policy){if(policy.version===PROFILE)return stdout;let e;try{e=JSON.parse(stdout);}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}check(e&&Object.keys(e).sort().join(',')==='bytes,data,encoding,sha256,version'&&e.version==='source-test-result-br-v1'&&e.encoding==='brotli-base64'&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=16000&&typeof e.data==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(e.data),'ENG_TEST_PROVIDER_RESULT');try{const b=Buffer.from(e.data,'base64');check(b.toString('base64')===e.data,'ENG_TEST_PROVIDER_RESULT');const raw=require('node:zlib').brotliDecompressSync(b,{maxOutputLength:16000});check(raw.length===e.bytes&&hash(raw.toString('utf8'))===e.sha256,'ENG_TEST_PROVIDER_RESULT');return raw.toString('utf8');}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}}
function prepare(input){return prepareBody(input,true);}
function prepareBody({binding,baseline,patched,proposalHash,taskDescriptor},assertionReview){
 check(binding&&Object.keys(binding).sort().join(',')==='deploymentId,executionId,ownerHash,planId,releaseHash,sourceCommit,taskId,workspaceHash','ENG_TEST_BINDING');
 for(const k of ['ownerHash','workspaceHash','releaseHash'])check(/^[a-f0-9]{64}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{40}$/.test(binding.sourceCommit)&&/^dpl_[A-Za-z0-9]+$/.test(binding.deploymentId),'ENG_TEST_BINDING');
 for(const k of ['executionId','planId','taskId'])check(/^[a-zA-Z0-9_-]{1,160}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{64}$/.test(proposalHash),'ENG_TEST_PROPOSAL');
 let policy={version:PROFILE,mode:'starter'};if(taskDescriptor){const tasks=require('./agent-operations-implementation-tasks'),verified=tasks.validateDescriptor(taskDescriptor);policy=profileFor({assignment:verified.objective});check([VISIBLE_PROFILE,PHONE_PROFILE].includes(policy?.version),'ENG_TEST_UNAVAILABLE');}
 const command=policy.version===PHONE_PROFILE?phoneCommand(binding,baseline,patched):policy.version===PROFILE?require('../scripts/source-execution-isolated-runner.cjs').command({mode:'starter',baseline,patched}):require('../scripts/source-execution-visible-time-runner.cjs').command({mode:'visible-time',baseline,patched});
 if(assertionReview)command.args[command.args.length-1]=require('../scripts/source-execution-isolated-runner.cjs').reviewableAssertions(command.args.at(-1),policy.mode);
 command.args[command.args.length-1]+='\n/* source-test-binding:'+hash({binding,proposalHash})+' */\n';command.programSha256=hash(command.args.at(-1));
 const body={version:policy.version,...(assertionReview?{assertionReview:'safe-failed-tests-v1'}:{}),...(taskDescriptor?{taskDescriptorHash:taskDescriptor.descriptorHash}:{}),binding:structuredClone(binding),proposalHash,commandHash:command.programSha256,testProgramHash:command.testProgramSha256,sourceHashes:command.sourceHashes};
 const job={manifest:{...body,hash:hash(body)},command};prepared.set(job,structuredClone(job));return job;
}
function validateReport(job,result){
 const diagnostic=require('./agent-operations-source-test-diagnostic');
 try{return validateReportBody(job,result);}catch(error){throw diagnostic.attach(error,diagnostic.fromOutcome(job,result));}
}
function validateReportBody(job,result){
 check(result&&[0,1].includes(result.exitCode)&&(result.exitCode===0||[PROFILE,VISIBLE_PROFILE,PHONE_PROFILE].includes(job?.manifest?.version))&&typeof result.stdout==='string'&&Buffer.byteLength(result.stdout)<=16000,'ENG_TEST_PROVIDER_RESULT');
 const policy=policyForJob(job);let report;try{report=JSON.parse(decodeResult(result.stdout,policy));}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}
 check(report.version==='source-isolated-runner-result-v1'&&report.mode===policy.mode&&report.programSha256===job.manifest.commandHash&&report.testProgramSha256===job.manifest.testProgramHash&&JSON.stringify(report.sourceHashes)===JSON.stringify(job.manifest.sourceHashes),'ENG_TEST_RESULT_BINDING');
 check(report.qualificationPassed===true&&report.protectedIntegrity===true&&report.cleanupConfirmed===true&&report.publicationAuthorized===false&&report.independentlyAccepted===false,'ENG_TEST_ISOLATION');
 check(Array.isArray(report.results)&&report.results.length===5&&report.results.every((r,i)=>r.label===['qualification','positive','seeded-failure','timeout',policy.mode][i]),'ENG_TEST_RESULT_ORDER');
 const [q,p,n,t,s]=report.results;
 check(q.exitCode===0&&q.output?.passed===true&&Object.keys(q.output.checks||{}).sort().join(',')===[...CHECKS].sort().join(',')&&Object.values(q.output.checks).every(v=>v===true),'ENG_TEST_ISOLATION');
 check([q,p,n,s].every(x=>!x.timedOut&&!x.outputLimit&&!x.spawnFailed)&&p.exitCode===0&&n.exitCode===1&&t.timedOut===true&&t.signal==='SIGKILL'&&t.childStarted===true&&t.descendantsTerminated===true,'ENG_TEST_TERMINATION');
 // A complete assertion failure is technical review evidence, not an isolation
 // or transport failure. Unknown exceptions, truncated rows and contradictions
 // cannot acquire this disposition or reach downstream review.
 check([0,1].includes(s.exitCode)&&!s.timedOut&&!s.outputLimit&&!s.spawnFailed&&s.programSha256===job.manifest.testProgramHash&&s.output?.tests?.length===policy.tests.length&&s.output.tests.every((x,i)=>Object.keys(x).sort().join(',')==='id,passed'&&x.id===policy.tests[i]&&typeof x.passed==='boolean'),'ENG_TEST_FAILED');
 const testsPassed=s.output.tests.every(x=>x.passed);
 check(testsPassed||(job.manifest.assertionReview==='safe-failed-tests-v1'&&report.code===undefined&&report.phase===undefined),'ENG_TEST_FAILED');
 check(s.exitCode===(testsPassed?0:1)&&s.output.passed===testsPassed&&report.runPassed===testsPassed&&result.exitCode===(testsPassed?0:1),'ENG_TEST_FAILED');
 return{...(testsPassed?{}:{testsPassed:false,reviewDisposition:'behavioral-failure'}),reportHash:hash(result.stdout),checksPassed:23,tests:s.output.tests.map(x=>({...x})),sourceExecuted:true,cleanupConfirmed:true,publicationAuthorized:false,independentlyAccepted:false};
}
async function dispatch({job,journal,provider,signal,clock=Date.now}){
 check(job&&prepared.has(job)&&equal(prepared.get(job),job),'ENG_TEST_PREPARATION_PROVENANCE');
 job=structuredClone(prepared.get(job));
 check(job&&[PROFILE,VISIBLE_PROFILE,PHONE_PROFILE].includes(job.manifest?.version)&&hash({...job.manifest,hash:undefined})===job.manifest.hash,'ENG_TEST_MANIFEST');
 check(job.command?.programSha256===job.manifest.commandHash&&hash(job.command.args?.at(-1))===job.manifest.commandHash,'ENG_TEST_COMMAND');
 // Rebuild exact argv from the reviewed code, not caller-provided executable,
 // resources, environment or command flags.
 const expected=job.command,policy=policyForJob(job);
 check(job.command.command==='/usr/bin/env'&&job.command.sudo===true&&job.command.timeout===SOURCE_COMMAND_MS&&job.command.publicationAuthorized===false&&job.command.executionClass===policy.executionClass,'ENG_TEST_COMMAND');
 check(equal(expected,job.command)&&journal&&provider,'ENG_TEST_UNAVAILABLE');
 let permit,session,result,failure=null,diagnostic=null,stopConfirmed=false,createAttempted=false;
 const diagnostics=require('./agent-operations-source-test-diagnostic');
 const authorize=async()=>{check(!signal?.aborted,'ENG_TEST_CANCELLED');await journal.verify(structuredClone(permit),structuredClone(job.manifest));};
 try{
  // claim atomically consumes explicit source-test permission and records the
  // unique provider name BEFORE create. Lost acknowledgments never retry create.
  permit=structuredClone(await journal.claim(structuredClone(job.manifest)));
  check(permit?.manifestHash===job.manifest.hash&&/^[a-f0-9]{32}$/.test(permit.id)&&Number.isSafeInteger(permit.expiresAt)&&permit.expiresAt>clock()&&permit.expiresAt<=clock()+SOURCE_TEST_MS,'ENG_TEST_PERMISSION');
  await authorize();
  createAttempted=true;session=await provider.create({name:'callercore-test-'+permit.id,projectId:PROJECT,image:IMAGE,architecture:'amd64',region:'iad1',resources:{vcpus:1},timeout:SOURCE_TEST_MS,persistent:false,networkPolicy:{mode:'deny-all'},ports:[],env:{}},{signal});
  check(/^sbx_[A-Za-z0-9]+$/.test(session?.id||''),'ENG_TEST_PROVIDER_SCOPE');
  await journal.started(permit,session.id);await authorize();
  check(session.projectId===PROJECT&&session.name==='callercore-test-'+permit.id&&session.image===IMAGE&&session.vcpus===1&&session.memory===2048&&session.timeout===SOURCE_TEST_MS&&session.persistent===false&&session.networkPolicy?.mode==='deny-all'&&session.routes?.length===0,'ENG_TEST_PROVIDER_SCOPE');
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
   
 const body={version:policy.version,manifestHash:job.manifest.hash,permitId:permit.id,sessionId:/^sbx_[A-Za-z0-9]+$/.test(session?.id||'')?session.id:null,status:failure?'failed':'completed',failure,...(failure&&diagnostic?{diagnostic:diagnostics.sanitize(diagnostic)}:{}),result:failure?null:result,stopConfirmed,publicationAuthorized:false,independentlyAccepted:false};
   try{await journal.close(structuredClone(permit),{...body,hash:hash(body)});}catch{throw Object.assign(Error('ENG_TEST_JOURNAL_UNCONFIRMED'),{cleanupConfirmed:!createAttempted||stopConfirmed});}
  }
 }
 if(failure){const error=Object.assign(Error(failure),{cleanupConfirmed:!createAttempted||stopConfirmed});throw diagnostic?diagnostics.attach(error,diagnostic):error;}return result;
}
function validateEvidence(e,binding,proposal){if(proposal?.patch?.version==='draft-proposal-bundle-v1')return validatePhoneEvidence(e,binding,proposal);
 const impl=require('./agent-operations-implementation'),tasks=require('./agent-operations-implementation-tasks'),candidate=tasks.descriptor({assignment:tasks.VISIBLE_TIME_OBJECTIVE}),taskDescriptor=proposal?.profile===candidate.id?candidate:null,baseline=taskDescriptor?tasks.snapshot({assignment:taskDescriptor.objective}).text:impl.snapshot().text;
 check(proposal?.edits?.length===1,'ENG_TEST_PROPOSAL');const edit=proposal.edits[0];
 const expected=prepareForEvidence(e,{binding:{ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,planId:binding.planId,taskId:binding.taskId+'_source_test',executionId:binding.executionId+'_source_test',sourceCommit:binding.runtime.sourceCommit,releaseHash:binding.runtime.release.digest,deploymentId:binding.runtime.deploymentId},baseline,patched:baseline.replace(edit.beforeText,edit.afterText),proposalHash:hash(proposal),...(taskDescriptor?{taskDescriptor}: {})});
 check(e&&equal(e.manifest,expected.manifest)&&e.receipt?.manifestHash===e.manifest.hash,'ENG_TEST_RESULT_BINDING');const {hash:h,...body}=e.receipt;
 check(h===hash(body)&&body.version===expected.manifest.version&&body.status==='completed'&&body.failure===null&&body.stopConfirmed===true&&body.publicationAuthorized===false&&body.independentlyAccepted===false&&/^[a-f0-9]{32}$/.test(body.permitId)&&/^sbx_[A-Za-z0-9]+$/.test(body.sessionId||''),'ENG_TEST_RESULT_BINDING');
 const r=body.result,policy=policyForJob(expected);check(r?.sourceExecuted===true&&r.checksPassed===23&&r.cleanupConfirmed===true&&r.publicationAuthorized===false&&r.independentlyAccepted===false&&/^[a-f0-9]{64}$/.test(r.reportHash||'')&&r.tests?.length===policy.tests.length&&validTestResults(r,policy,e.manifest.assertionReview),'ENG_TEST_FAILED');return true;
}

function prepareForEvidence(e,input){check(e?.manifest&&(e.manifest.assertionReview===undefined||e.manifest.assertionReview==='safe-failed-tests-v1'),'ENG_TEST_RESULT_BINDING');return prepareBody(input,e.manifest.assertionReview==='safe-failed-tests-v1');}

function validTestResults(r,policy,assertionReview){
 if(!Array.isArray(r?.tests)||r.tests.length!==policy.tests.length||!r.tests.every((t,i)=>Object.keys(t).sort().join(',')==='id,passed'&&t.id===policy.tests[i]&&typeof t.passed==='boolean'))return false;
 const passed=r.tests.every(t=>t.passed);
 return passed?r.testsPassed===undefined&&r.reviewDisposition===undefined:assertionReview==='safe-failed-tests-v1'&&r.testsPassed===false&&r.reviewDisposition==='behavioral-failure';
}

function phoneCommand(binding,baseline,patched){
 const b=patched?.binding;check(b&&['ownerHash','workspaceHash','sourceCommit','releaseHash','deploymentId'].every(k=>b[k]===binding[k])&&binding.taskId===b.taskId+'_source_test'&&binding.executionId===b.executionId+'_source_test','ENG_TEST_BINDING');
 return require('../scripts/source-execution-phone-search-runner.cjs').command({mode:'phone-search',baseline,patched});
}
function validatePhoneEvidence(e,binding,proposal){
 const phone=require('./agent-operations-phone-search'),context={assignment:phone.OBJECTIVE,binding,evidence:phone.snapshot().evidence,priorReceipts:[]},p=phone.validateProposal(proposal,context);
 const expected=prepareForEvidence(e,{binding:{ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,planId:binding.planId,taskId:binding.taskId+'_source_test',executionId:binding.executionId+'_source_test',sourceCommit:binding.runtime.sourceCommit,releaseHash:binding.runtime.release.digest,deploymentId:binding.runtime.deploymentId},baseline:phone.snapshot().files,patched:{proposal:p,binding:p.binding},proposalHash:hash(proposal),taskDescriptor:phone.descriptor()});
 check(e&&equal(e.manifest,expected.manifest)&&e.receipt?.manifestHash===e.manifest.hash,'ENG_TEST_RESULT_BINDING');const{hash:h,...body}=e.receipt;
 check(h===hash(body)&&body.version===PHONE_PROFILE&&body.status==='completed'&&body.failure===null&&body.stopConfirmed===true&&body.publicationAuthorized===false&&body.independentlyAccepted===false&&/^[a-f0-9]{32}$/.test(body.permitId)&&/^sbx_[A-Za-z0-9]+$/.test(body.sessionId||''),'ENG_TEST_RESULT_BINDING');
 const r=body.result,policy=policyForJob(expected);check(r?.sourceExecuted===true&&r.checksPassed===CHECKS.length&&r.cleanupConfirmed===true&&r.publicationAuthorized===false&&r.independentlyAccepted===false&&/^[a-f0-9]{64}$/.test(r.reportHash||'')&&r.tests?.length===policy.tests.length&&validTestResults(r,policy,e.manifest.assertionReview),'ENG_TEST_FAILED');return true;
}

module.exports={PHONE_PROFILE,VISIBLE_PROFILE,profileFor,decodeResult,PROFILE,IMAGE,PROJECT,CHECKS,TESTS,prepare,validateReport,validateEvidence,dispatch};
