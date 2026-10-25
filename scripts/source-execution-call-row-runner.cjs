'use strict';
// Derive only a closed test payload/label contract from the existing supervisor.
// No VM provisioning, local evaluation or model-selected command is exposed.
const {createHash}=require('node:crypto'),legacy=require('./source-execution-isolated-runner.cjs'),builder=require('./source-execution-call-row-tests.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const OLD_IDS="['baseline-starter-reproduces-automations-warning','patched-starter-omits-forbidden-feed-and-warning','entitled-plan-keeps-original-feed-handler','unrelated-feeds-and-failure-notice-preserved','appointment-capability-and-entitlement-both-required','cleared-generation-cannot-apply-stale-data-or-notice','older-generation-cannot-overwrite-newer-refresh']";
function command(input){
 if(arguments.length!==1||!input||input.mode!=='call-row'||Object.keys(input).sort().join(',')!=='baseline,mode,patched')throw Error('CALL_ROW_TEST_MODE_DENIED');
 const test=builder.buildProgram({baseline:input.baseline,patched:input.patched}),old=legacy.command({mode:'qualification'}),code=old.args.at(-1),marker=')({"mode":"qualification","test":null,';
 const at=code.indexOf(marker);if(at<0||at!==code.lastIndexOf(marker)||!code.endsWith(');'))throw Error('CALL_ROW_SUPERVISOR_VERSION');
 let prefix=code.slice(0,at+2);const payload=JSON.parse(code.slice(at+2,-2));
 const replacements=[['programs.starter','programs[\'call-row\']'],["phase='starter'","phase='call-row'"],["run('starter',payload.test.program","run('call-row',payload.test.program"],["'starter-source-behavioral-result-v1'","'call-row-source-behavioral-result-v1'"],['const ids='+OLD_IDS,'const ids='+JSON.stringify(builder.TESTS)]];
 for(const [before,after]of replacements){if(prefix.split(before).length!==2)throw Error('CALL_ROW_SUPERVISOR_VERSION');prefix=prefix.replace(before,after);}
 if(prefix.split('SOURCE_STARTER_TESTS_FAILED').length!==3)throw Error('CALL_ROW_SUPERVISOR_VERSION');prefix=prefix.replaceAll('SOURCE_STARTER_TESTS_FAILED','SOURCE_CALL_ROW_TESTS_FAILED');
 payload.mode='call-row';payload.test={program:test.program,programSha256:test.programSha256,sourceHashes:test.sourceHashes};
 const program=prefix+JSON.stringify(payload)+');';
 return{...old,version:'call-row-isolated-runner-command-v1',args:[...old.args.slice(0,-1),program],programSha256:hash(program),testProgramSha256:test.programSha256,sourceHashes:test.sourceHashes,executionClass:'exact-call-row-patch-only',executionAuthorized:false,qualified:false};
}
module.exports={command};
