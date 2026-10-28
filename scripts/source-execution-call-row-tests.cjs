'use strict';
// Serializes fixed guest tests only. This module never evaluates proposed code.
const {createHash}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
const HASHES=Object.freeze({baseline:'a79132d86e64401a08623ceed9cdbcd31371386a8bb0774f29d7004eb6ba47df',patched:'8defc782ad52401e14df1d3e05e28286a341a844f31688ec51c082a9ccd61814'});
const BEFORE="aria-label=\"Open '+esc(x.caller||'caller')+' call details\"";
const AFTER="aria-label=\"Open '+esc(x.caller||'caller')+' call details, '+esc(recordTime(x)?new Date(recordTime(x)).toLocaleString():(x.time||'Time unavailable'))+'\"";
const TESTS=Object.freeze(['baseline-repeated-caller-name-collision','patched-distinct-valid-times','escaped-caller-and-time-fallback','unknown-caller-and-missing-time','equal-times-remain-a-known-limitation','invalid-time-is-an-adoption-blocker','unchanged-row-attributes-and-visible-content']);
function extract(source){
 const lines=source.split('\n'),esc=lines.filter(x=>x.startsWith('function esc(v){')),start=lines.findIndex(x=>x==='function recordTime(x){'),row=lines.filter(x=>x.trimStart().startsWith("return '<button class=\"call-row data "));
 if(esc.length!==1||start<0||lines[start+3]!=='}'||row.length!==1)throw Error('CALL_ROW_SOURCE_BOUNDARY');
 return{helpers:esc[0]+'\n'+lines.slice(start,start+4).join('\n'),row:row[0]};
}
function buildProgram(input){
 if(arguments.length!==1||!input||Object.keys(input).sort().join(',')!=='baseline,patched')throw Error('CALL_ROW_INPUT_DENIED');
 const{baseline,patched}=input;
 if(typeof baseline!=='string'||typeof patched!=='string'||Buffer.byteLength(baseline)>700000||Buffer.byteLength(patched)>700000||hash(baseline)!==HASHES.baseline||hash(patched)!==HASHES.patched)throw Error('CALL_ROW_SOURCE_IDENTITY');
 if(baseline.indexOf(BEFORE)<0||baseline.indexOf(BEFORE)!==baseline.lastIndexOf(BEFORE)||baseline.replace(BEFORE,AFTER)!==patched)throw Error('CALL_ROW_PATCH_SCOPE');
 const program='('+guestProgram.toString()+')('+JSON.stringify({baseline:extract(baseline),patched:extract(patched)})+');';
 return{version:'call-row-source-behavioral-tests-v1',program,programSha256:hash(program),sourceHashes:{...HASHES},testIds:[...TESTS],timeoutMs:20000,maxOutputBytes:16000,requiresQualifiedOsSandbox:true,executionAuthorized:false,qualified:false,qualification:'Source row-function behavior with fictional data only. No browser accessibility-tree, assistive-technology or full-application acceptance.'};
}
// Serialized for the existing OS-isolated guest; never called by host tests.
function guestProgram(sources){
 const vm=require('node:vm'),a=require('node:assert/strict'),results=[];
 function fixture(source){const c=vm.createContext({callViewedCoverage:{verified:true},callRecordAlertBadge:()=>'',callDispositionClass:()=> 'handled'});vm.runInContext(source.helpers+'\nfunction row(x){const stateClass="ready",unviewed=false,disposition={label:"Handled"},team={tone:"ok",label:"Team"};'+source.row+'}',c,{timeout:250});return x=>{c.input=structuredClone(x);return vm.runInContext('row(input)',c,{timeout:250});};}
 const baseline=fixture(sources.baseline),patched=fixture(sources.patched),label=s=>{const m=s.match(/ aria-label="([^"]*)"/);a(m);return m[1];};
 function check(id,fn){try{fn();results.push({id,passed:true});}catch{results.push({id,passed:false});}}
 const first={id:'fictional-call-1',caller:'Fictional Caller',createdAt:Date.UTC(2026,9,25,10,0),duration:'1:00'},second={...first,id:'fictional-call-2',createdAt:first.createdAt+3600000};
 check('baseline-repeated-caller-name-collision',()=>a.equal(label(baseline(first)),label(baseline(second))));
 check('patched-distinct-valid-times',()=>{a.notEqual(label(patched(first)),label(patched(second)));a(label(patched(first)).includes(new Date(first.createdAt).toLocaleString()));});
 check('escaped-caller-and-time-fallback',()=>{const x={id:'fictional-special',caller:'A "<>&\' caller',time:'<img onerror="fictional">'};const s=patched(x),name=label(s);a(name.includes('&quot;'));a(name.includes('&lt;'));a(name.includes('&amp;'));a(!name.includes('<img'));a.equal((s.match(/ aria-label=/g)||[]).length,1);});
 check('unknown-caller-and-missing-time',()=>a.equal(label(patched({id:'fictional-unknown'})),'Open caller call details, Time unavailable'));
 check('equal-times-remain-a-known-limitation',()=>a.equal(label(patched(first)),label(patched({...first,id:'fictional-equal'}))));
 // Intentionally requires graceful invalid-time handling. A failure is evidence
 // against adopting the original patch, never permission to alter the test.
 check('invalid-time-is-an-adoption-blocker',()=>{const name=label(patched({...first,activityAt:1e30,time:'Fallback time'}));a(!name.includes('Invalid Date'));a(name.includes('Fallback time')||name.includes('Time unavailable'));});
 check('unchanged-row-attributes-and-visible-content',()=>{for(const x of [first,second,{id:'fictional-unknown'}]){const b=baseline(x),p=patched(x);a.equal(b.replace(/ aria-label="[^"]*"/,''),p.replace(/ aria-label="[^"]*"/,''));a(p.includes('data-call-id="'+x.id+'"'));}});
 const passed=results.every(x=>x.passed);process.stdout.write(JSON.stringify({version:'call-row-source-behavioral-result-v1',fixtureDataOnly:true,tests:results,passed,qualified:false,publicationAuthorized:false,qualification:'Exact source row and helpers only; no browser, customer or independent acceptance.'})+'\n');process.exitCode=passed?0:1;
}
if(require.main===module)throw Error('CALL_ROW_GUEST_REQUIRES_QUALIFIED_DISPATCHER');
module.exports={buildProgram,HASHES,BEFORE,AFTER,TESTS};
