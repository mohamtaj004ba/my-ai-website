'use strict';
// Builds a fixed guest-only test program. Never evaluates source or provisions a VM.
const {createHash}=require('node:crypto');
const HASHES=Object.freeze({baseline:'202a482a439821294d30a984d8f7402b9102fb5d28680a931da31969785ea049',patched:'c812f5c62121e503ecd0946f7ca6d09eeac1a1147b4110d7dbc5c50493146cef'});
const BEFORE="    ['automations',d=>{automationsData=d.automations||[]}],";
const AFTER="    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),";
const START='let secondaryClientLoadGeneration=0;';
const END='function renderWorkspaceAccessState(){';
const hash=s=>createHash('sha256').update(s).digest('hex');
function extract(source){
 if(typeof source!=='string'||Buffer.byteLength(source)>700000)throw Error('STARTER_SOURCE_DENIED');
 const a=source.indexOf(START),b=source.indexOf(END);
 if(a<0||b<=a||a!==source.lastIndexOf(START)||b!==source.lastIndexOf(END))throw Error('STARTER_SOURCE_BOUNDARY');
 return source.slice(a,b);
}
function buildProgram(input){
 if(arguments.length!==1||!input||Object.keys(input).sort().join(',')!=='baseline,patched')throw Error('STARTER_INPUT_DENIED');
 const {baseline,patched}=input;
 if(typeof baseline!=='string'||typeof patched!=='string'||hash(baseline)!==HASHES.baseline||hash(patched)!==HASHES.patched)throw Error('STARTER_SOURCE_IDENTITY');
 if(baseline.indexOf(BEFORE)<0||baseline.indexOf(BEFORE)!==baseline.lastIndexOf(BEFORE)||baseline.replace(BEFORE,AFTER)!==patched)throw Error('STARTER_PATCH_SCOPE');
 const sources={baseline:extract(baseline),patched:extract(patched)};
 const program='('+guestProgram.toString()+')('+JSON.stringify(sources)+');';
 return {version:'starter-source-behavioral-tests-v1',sourceHashes:{...HASHES},program,programSha256:hash(program),timeoutMs:20000,maxOutputBytes:16000,requiresQualifiedOsSandbox:true,executionAuthorized:false,generatedCodeExecutionAllowed:false,qualification:'Actual source functions against fictional DOM and fetch fixtures. This builder does not execute them. Node VM is not the security boundary.'};
}
// This function is serialized, never invoked by this module or its local tests.
async function guestProgram(sources){
 const vm=require('node:vm'),assert=require('node:assert/strict');
 const results=[];
 function fixture(source,{entitled=false,calendar=false,appointments=false,fail=null,deferred=false}={}){
  const calls=[],warnings=[],renders=[],pending=[],copy={textContent:'unchanged'},notice={hidden:true,querySelector:()=>copy};
  const data=(action,suffix='')=>({[action]:[{id:action+'-fictional'+suffix}],total:1,nextCursor:null,limit:2});
  const globals={leadsData:[],conversationThreadsData:[],conversationPageTotal:0,conversationNextCursor:null,conversationBackendPaging:false,conversationsData:[],appointmentsData:[],automationsData:[{id:'prior-fictional'}],locationsData:[],locationsLimit:1,
   has:key=>key==='automations'?entitled:key==='appointments'?appointments:false,capability:key=>key==='calendar'&&calendar,
   fetchJsonRetry:(url,options)=>{const action=url.split('=')[1];assert(['leads','conversations','appointments','automations','locations'].includes(action));assert.equal(Object.keys(options).sort().join(','),'attempts,timeout');assert.equal(options.attempts,1);assert.equal(options.timeout,8000);calls.push(action);const answer=(suffix='')=>{if(action===fail||action==='automations'&&!entitled)throw Error('FICTIONAL_UNAVAILABLE');return data(action,suffix);};return deferred?new Promise((resolve,reject)=>pending.push(suffix=>{try{resolve(answer(suffix));}catch{reject(Error('FICTIONAL_UNAVAILABLE'));}})):Promise.resolve().then(()=>answer());},
   document:{getElementById:id=>{assert.equal(id,'clientSecondaryDataHealth');return notice;}},console:{warn:(_message,action)=>warnings.push(action)}};
  for(const name of ['Contacts','Conversations','Appointments','Automations','Locations'])globals['render'+name]=()=>renders.push(name);
  const context=vm.createContext(globals);vm.runInContext(source,context,{timeout:250});
  return {calls,warnings,renders,copy,notice,pending,globals,start:()=>vm.runInContext('loadSecondaryClientData()',context,{timeout:250}),clear:()=>vm.runInContext('clearSecondaryClientCoverage()',context,{timeout:250})};
 }
 async function check(id,fn){let timer;try{await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('FIXED_TEST_TIMEOUT')),1500);})]);results.push({id,passed:true});}catch{results.push({id,passed:false});}finally{clearTimeout(timer);}}
 await check('baseline-starter-reproduces-automations-warning',async()=>{const f=fixture(sources.baseline);await f.start();assert(f.calls.includes('automations'));assert(f.warnings.includes('automations'));assert.equal(f.notice.hidden,false);assert(f.copy.textContent.includes('automations'));});
 await check('patched-starter-omits-forbidden-feed-and-warning',async()=>{const f=fixture(sources.patched);await f.start();assert.deepEqual(f.calls,['leads','conversations','locations']);assert.equal(f.warnings.length,0);assert.equal(f.notice.hidden,true);assert.equal(f.copy.textContent,'');assert.equal(f.globals.automationsData[0].id,'prior-fictional');});
 await check('entitled-plan-keeps-original-feed-handler',async()=>{const f=fixture(sources.patched,{entitled:true});await f.start();assert.deepEqual(f.calls,['leads','conversations','automations','locations']);assert.equal(f.globals.automationsData[0].id,'automations-fictional');assert.equal(f.notice.hidden,true);});
 await check('unrelated-feeds-and-failure-notice-preserved',async()=>{const f=fixture(sources.patched,{fail:'locations'});await f.start();assert.equal(f.globals.leadsData[0].id,'leads-fictional');assert.equal(f.globals.conversationThreadsData[0].id,'conversations-fictional');assert.equal(f.globals.conversationPageTotal,1);assert.equal(f.globals.conversationBackendPaging,true);assert.deepEqual(f.warnings,['locations']);assert.equal(f.notice.hidden,false);assert(f.copy.textContent.includes('locations'));assert(!f.copy.textContent.includes('automations'));});
 await check('appointment-capability-and-entitlement-both-required',async()=>{for(const [calendar,appointments]of [[false,false],[false,true],[true,false],[true,true]]){const f=fixture(sources.patched,{calendar,appointments});await f.start();assert.equal(f.calls.includes('appointments'),calendar&&appointments);assert.equal(f.globals.appointmentsData.length,calendar&&appointments?1:0);}});
 await check('cleared-generation-cannot-apply-stale-data-or-notice',async()=>{const f=fixture(sources.patched,{entitled:true,deferred:true,fail:'locations'}),p=f.start();assert.equal(f.pending.length,4);f.clear();for(const resolve of f.pending)resolve();await p;assert.equal(f.globals.leadsData.length,0);assert.equal(f.globals.conversationThreadsData.length,0);assert.equal(f.globals.automationsData[0].id,'prior-fictional');assert.equal(f.renders.length,0);assert.equal(f.notice.hidden,true);assert.equal(f.copy.textContent,'');});
 await check('older-generation-cannot-overwrite-newer-refresh',async()=>{const f=fixture(sources.patched,{deferred:true}),old=f.start(),split=f.pending.length,current=f.start();for(const resolve of f.pending.slice(split))resolve('-new');await current;assert.equal(f.globals.leadsData[0].id,'leads-fictional-new');const rendered=f.renders.length;for(const resolve of f.pending.slice(0,split))resolve('-old');await old;assert.equal(f.globals.leadsData[0].id,'leads-fictional-new');assert.equal(f.globals.conversationThreadsData[0].id,'conversations-fictional-new');assert.equal(f.renders.length,rendered);assert.equal(f.notice.hidden,true);});
 const passed=results.every(r=>r.passed);process.stdout.write(JSON.stringify({version:'starter-source-behavioral-result-v1',fixtureDataOnly:true,tests:results,passed,qualified:false,publicationAuthorized:false,qualification:'Source-function unit behavior only; no real customer, browser, network integration or general isolation acceptance.'})+'\n');process.exitCode=passed?0:1;
}
if(require.main===module)throw Error('STARTER_GUEST_PROGRAM_REQUIRES_QUALIFIED_DISPATCHER');
module.exports={buildProgram,HASHES};
