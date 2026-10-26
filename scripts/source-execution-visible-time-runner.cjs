'use strict';
// Reuses the reviewed OS supervisor. Only fixed test payload/labels/codec differ.
const {createHash}=require('node:crypto'),legacy=require('./source-execution-isolated-runner.cjs'),builder=require('./source-execution-visible-time-tests.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
function command(input){
 if(arguments.length!==1||!input||input.mode!=='visible-time'||Object.keys(input).sort().join(',')!=='baseline,mode,patched')throw Error('VISIBLE_TIME_MODE_DENIED');
 const test=builder.buildProgram({baseline:input.baseline,patched:input.patched}),old=legacy.command({mode:'qualification'}),code=old.args.at(-1),marker=')({"mode":"qualification","test":null,',at=code.indexOf(marker);
 if(at<0||at!==code.lastIndexOf(marker)||!code.endsWith(');'))throw Error('VISIBLE_TIME_SUPERVISOR_VERSION');
 let prefix=code.slice(0,at+2);const payload=JSON.parse(code.slice(at+2,-2));
 const ids="['baseline-starter-reproduces-automations-warning','patched-starter-omits-forbidden-feed-and-warning','entitled-plan-keeps-original-feed-handler','unrelated-feeds-and-failure-notice-preserved','appointment-capability-and-entitlement-both-required','cleared-generation-cannot-apply-stale-data-or-notice','older-generation-cannot-overwrite-newer-refresh']";
 for(const [before,after]of [['programs.starter',"programs['visible-time']"],["phase='starter'","phase='visible-time'"],["run('starter',payload.test.program","run('visible-time',payload.test.program"],['const ids='+ids,'const ids='+JSON.stringify(builder.TESTS)]]){if(prefix.split(before).length!==2)throw Error('VISIBLE_TIME_SUPERVISOR_VERSION');prefix=prefix.replace(before,after);}
 if(prefix.split('SOURCE_STARTER_TESTS_FAILED').length!==3)throw Error('VISIBLE_TIME_SUPERVISOR_VERSION');prefix=prefix.replaceAll('SOURCE_STARTER_TESTS_FAILED','SOURCE_VISIBLE_TIME_TESTS_FAILED');
 const output="const output=JSON.stringify(report)+'\\n';for(let offset=0;offset<output.length;offset+=1200){process.stdout.write(output.slice(offset,offset+1200));await new Promise(resolve=>setTimeout(resolve,25));}";
 const encoded="const raw=JSON.stringify(report),data=require('node:zlib').brotliCompressSync(Buffer.from(raw),{params:{[require('node:zlib').constants.BROTLI_PARAM_QUALITY]:11}}).toString('base64');const envelope=JSON.stringify({version:'source-test-result-br-v1',encoding:'brotli-base64',sha256:sha(raw),bytes:Buffer.byteLength(raw),data});if(envelope.length>1900)throw Error('VISIBLE_TIME_RESULT_TRANSPORT_LIMIT');process.stdout.write(envelope+'\\n');";
 if(prefix.split(output).length!==2)throw Error('VISIBLE_TIME_SUPERVISOR_VERSION');prefix=prefix.replace(output,encoded);
 payload.mode='visible-time';payload.test={program:test.program,programSha256:test.programSha256,sourceHashes:test.sourceHashes};const program=prefix+JSON.stringify(payload)+');';
 return{...old,version:'visible-time-isolated-runner-command-v1',args:[...old.args.slice(0,-1),program],programSha256:hash(program),testProgramSha256:test.programSha256,sourceHashes:test.sourceHashes,executionClass:'exact-visible-time-patch-only'};
}
module.exports={command};
