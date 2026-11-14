'use strict';
// Prepare-only profile over one preserved agent patch. No provider/grant/dispatch.
const {createHash}=require('node:crypto'),{isDeepStrictEqual:equal}=require('node:util'),builder=require('../scripts/source-execution-call-row-tests.cjs'),runner=require('../scripts/source-execution-call-row-runner.cjs');
const PROFILE='call-row-source-tests-v1',DESCRIPTOR='d68f7ccc4da4ebc731aa6fe30132a8c166c46143b5bb29588a5b658bdf7a1297',PATCH='8f4f614467e665a277cb2a5a6e43a25b0bc6aa21693e1f5e111be68f7fbe501c',prepared=new WeakMap();
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex'),check=(v,c)=>{if(!v)throw Error(c);};
function prepare(input){
 check(input&&Object.keys(input).sort().join(',')==='baseline,binding,descriptorHash,patched,proposalHash','ENG_CALL_ROW_TEST_INPUT');
 const{binding,baseline,patched,proposalHash,descriptorHash}=input;
 check(binding&&Object.keys(binding).sort().join(',')==='deploymentId,executionId,ownerHash,planId,releaseHash,sourceCommit,taskId,workspaceHash','ENG_TEST_BINDING');
 for(const k of ['ownerHash','workspaceHash','releaseHash'])check(/^[a-f0-9]{64}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(/^[a-f0-9]{40}$/.test(binding.sourceCommit)&&/^dpl_[A-Za-z0-9]{1,100}$/.test(binding.deploymentId),'ENG_TEST_BINDING');
 for(const k of ['planId','taskId','executionId'])check(/^[A-Za-z0-9_-]{1,160}$/.test(binding[k]),'ENG_TEST_BINDING');
 check(descriptorHash===DESCRIPTOR&&proposalHash===PATCH,'ENG_CALL_ROW_TEST_SCOPE');
 const command=runner.command({mode:'call-row',baseline,patched});command.args[command.args.length-1]+='\n/* call-row-test-binding:'+hash({binding,proposalHash,descriptorHash})+' */\n';command.programSha256=hash(command.args.at(-1));
 const body={version:PROFILE,binding:structuredClone(binding),descriptorHash,proposalHash,commandHash:command.programSha256,testProgramHash:command.testProgramSha256,sourceHashes:command.sourceHashes};
 const job={manifest:{...body,hash:hash(body)},command};prepared.set(job,structuredClone(job));return job;
}
function decodeOutput(stdout){
 check(typeof stdout==='string'&&Buffer.byteLength(stdout)<=16000,'ENG_TEST_PROVIDER_RESULT');
 let envelope;try{envelope=JSON.parse(stdout);}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}
 check(envelope&&typeof envelope==='object'&&!Array.isArray(envelope),'ENG_TEST_PROVIDER_RESULT');
 if(envelope.version!=='call-row-result-envelope-v1')return stdout; // Original receipts remain readable.
 check(Buffer.byteLength(stdout)<=2801&&Object.keys(envelope).sort().join(',')==='bytes,data,encoding,sha256,version'&&envelope.encoding==='gzip-base64'&&/^[a-f0-9]{64}$/.test(envelope.sha256)&&Number.isInteger(envelope.bytes)&&envelope.bytes>0&&envelope.bytes<=16000&&typeof envelope.data==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.data),'ENG_TEST_RESULT_ENVELOPE');
 let raw;try{const compressed=Buffer.from(envelope.data,'base64');check(compressed.toString('base64')===envelope.data,'ENG_TEST_RESULT_ENVELOPE');raw=require('node:zlib').gunzipSync(compressed,{maxOutputLength:16000});}catch{throw Error('ENG_TEST_RESULT_ENVELOPE');}
 check(raw.length===envelope.bytes&&hash(raw.toString('utf8'))===envelope.sha256,'ENG_TEST_RESULT_ENVELOPE');return raw.toString('utf8');
}
function validateOutcome(job,outcome){
 check(job&&prepared.has(job)&&equal(job,prepared.get(job)),'ENG_CALL_ROW_TEST_PROVENANCE');
 check(outcome&&[0,1].includes(outcome.exitCode)&&typeof outcome.stdout==='string'&&Buffer.byteLength(outcome.stdout)<=16000,'ENG_TEST_PROVIDER_RESULT');
 let r;try{r=JSON.parse(decodeOutput(outcome.stdout));}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}
 check(r.version==='source-isolated-runner-result-v1'&&r.mode==='call-row'&&r.programSha256===job.manifest.commandHash,'ENG_TEST_RESULT_BINDING');
 check(r.qualificationPassed===true&&r.cleanupConfirmed===true&&r.publicationAuthorized===false,'ENG_TEST_ISOLATION');
 const labels=['qualification','positive','seeded-failure','timeout','call-row'];check(Array.isArray(r.results)&&r.results.length===5&&r.results.every((x,i)=>x.label===labels[i]),'ENG_TEST_RESULT_ORDER');
 const[q,p,n,t,s]=r.results,checks=require('./agent-operations-source-test-dispatch').CHECKS;
 check(q.exitCode===0&&q.output?.passed===true&&equal(Object.keys(q.output.checks||{}).sort(),[...checks].sort())&&Object.values(q.output.checks).every(v=>v===true),'ENG_TEST_ISOLATION');
 check([q,p,n,s].every(x=>x.timedOut===false&&x.outputLimit===false&&x.spawnFailed===false)&&p.exitCode===0&&n.exitCode===1&&t.timedOut===true&&t.signal==='SIGKILL'&&t.childStarted===true&&t.descendantsTerminated===true,'ENG_TEST_TERMINATION');
 check(s.programSha256===job.manifest.testProgramHash&&s.output?.version==='call-row-source-behavioral-result-v1'&&Array.isArray(s.output.tests)&&s.output.tests.length===builder.TESTS.length&&s.output.tests.every((x,i)=>Object.keys(x).sort().join(',')==='id,passed'&&x.id===builder.TESTS[i]&&typeof x.passed==='boolean'),'ENG_TEST_RESULT_BINDING');
 const passed=s.output.tests.every(x=>x.passed);check(s.output.passed===passed&&s.exitCode===(passed?0:1)&&outcome.exitCode===(passed?0:1)&&r.runPassed===passed&&(passed?r.independentlyAccepted===false:r.code==='SOURCE_CALL_ROW_TESTS_FAILED'&&r.phase==='call-row'),'ENG_TEST_FAILED');
 if(passed)check(r.protectedIntegrity===true&&r.testProgramSha256===job.manifest.testProgramHash&&equal(r.sourceHashes,job.manifest.sourceHashes),'ENG_TEST_RESULT_BINDING');
 else check(r.protectedIntegrity===undefined&&r.testProgramSha256===undefined&&r.sourceHashes===undefined,'ENG_TEST_RESULT_BINDING');
 return{contractValid:true,reportHash:hash(outcome.stdout),checksPassed:checks.length,tests:s.output.tests.map(x=>({...x})),testsPassed:passed,protectedIntegrityVerified:passed?true:null,adoptionBlocked:!passed,qualified:false,executionAuthorized:false,publicationAuthorized:false,independentlyAccepted:false,qualification:'Parsed outcome only; not a live VM attestation, source-test permission or product acceptance. A failed source test does not attest the supervisor post-test integrity check.'};
}
module.exports={PROFILE,DESCRIPTOR,PATCH,prepare,decodeOutput,validateOutcome};
