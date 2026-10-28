'use strict';
// Serializes a fixed, source-bound test program. Never evaluates source locally.
const {createHash}=require('node:crypto'),rawAsset=require('../lib/agent-operations-visible-time-task-v1.json');
const hash=s=>createHash('sha256').update(s).digest('hex');
if(hash(JSON.stringify(rawAsset))!=='5deaabf2d934d46430e604b4b22c6df09bea3b3a8a7895a207041c5dc3aa15a9')throw Error('VISIBLE_TIME_ASSET');
const asset=structuredClone(rawAsset);
const TESTS=Object.freeze(['baseline-invalid-visible-time-reproduced','valid-locale-output-unchanged','out-of-range-separate-fallbacks','non-finite-timestamp-fallbacks','missing-values-preserve-defaults','dynamic-text-remains-escaped','accessible-label-and-other-row-content-unchanged']);
function extract(source){const lines=source.split('\n'),esc=lines.filter(x=>x.startsWith('function esc(v){')),start=lines.findIndex(x=>x==='function recordTime(x){'),row=lines.filter(x=>x.trimStart().startsWith('return \'<button class="call-row data '));if(esc.length!==1||start<0||lines[start+3]!=='}'||row.length!==1)throw Error('VISIBLE_TIME_SOURCE_BOUNDARY');return{helpers:esc[0]+'\n'+lines.slice(start,start+4).join('\n'),row:row[0]};}
function buildProgram(input){
 if(arguments.length!==1||!input||Object.keys(input).sort().join(',')!=='baseline,patched')throw Error('VISIBLE_TIME_INPUT_DENIED');
 const{baseline,patched}=input,d=asset.tasks[0].definition;
 if(typeof baseline!=='string'||typeof patched!=='string'||hash(baseline)!==d.sourceSha256||hash(patched)!==d.resolvedSha256||baseline.split(d.beforeText).length!==2||baseline.replace(d.beforeText,asset.tasks[0].fixtureAfterText)!==patched)throw Error('VISIBLE_TIME_SOURCE_IDENTITY');
 const program='('+guestProgram.toString()+')('+JSON.stringify({baseline:extract(baseline),patched:extract(patched)})+');';
 return{program,programSha256:hash(program),sourceHashes:{baseline:hash(baseline),patched:hash(patched)},testIds:[...TESTS],executionAuthorized:false};
}
function guestProgram(sources){
 const vm=require('node:vm'),a=require('node:assert/strict'),results=[];
 function fixture(source){const c=vm.createContext({callViewedCoverage:{verified:true},callRecordAlertBadge:()=>'',callDispositionClass:()=> 'handled'});vm.runInContext(source.helpers+'\nfunction row(x){const stateClass="ready",unviewed=false,disposition={label:"Handled"},team={tone:"ok",label:"Team"};'+source.row+'}',c,{timeout:250});return x=>{c.input=structuredClone(x);return vm.runInContext('row(input)',c,{timeout:250});};}
 const baseline=fixture(sources.baseline),patched=fixture(sources.patched),pattern=/<span><strong>([\s\S]*?)<\/strong><small class="subtle">([\s\S]*?)<\/small><\/span>/,visible=s=>{const m=s.match(pattern);a(m);return m;};
 function check(id,fn){try{fn();results.push({id,passed:true});}catch{results.push({id,passed:false});}}
 const valid={id:'fictional-call',caller:'Fictional Caller',createdAt:Date.UTC(2026,9,25,10),duration:'1:00'},invalid={...valid,activityAt:1e30,time:'Fallback time',agent:'Fallback agent'};
 check('baseline-invalid-visible-time-reproduced',()=>a(visible(baseline(invalid))[0].includes('Invalid Date')));
 check('valid-locale-output-unchanged',()=>a.equal(patched(valid),baseline(valid)));
 check('out-of-range-separate-fallbacks',()=>{const m=visible(patched(invalid));a.equal(m[1],'Fallback time');a.equal(m[2],'Fallback agent');a(!m[0].includes('Invalid Date'));});
 check('non-finite-timestamp-fallbacks',()=>{for(const activityAt of [Infinity,-Infinity,1e30,-1e30]){const m=visible(patched({...invalid,activityAt}));a.equal(m[1],'Fallback time');a.equal(m[2],'Fallback agent');}});
 check('missing-values-preserve-defaults',()=>{const m=visible(patched({id:'fictional-missing'}));a.equal(m[1],'—');a.equal(m[2],'Maya');});
 check('dynamic-text-remains-escaped',()=>{const m=visible(patched({...invalid,time:'<img onerror="fictional">',agent:'<script>fictional</script>'}));a(m[1].includes('&lt;img'));a(m[1].includes('&quot;'));a(m[2].includes('&lt;script'));a(!m[0].includes('<img'));a(!m[0].includes('<script>'));});
 check('accessible-label-and-other-row-content-unchanged',()=>{for(const x of [valid,invalid,{id:'fictional-missing'}])a.equal(baseline(x).replace(pattern,''),patched(x).replace(pattern,''));});
 const passed=results.every(x=>x.passed);process.stdout.write(JSON.stringify({version:'starter-source-behavioral-result-v1',fixtureDataOnly:true,tests:results,passed,qualified:false,publicationAuthorized:false})+'\n');process.exitCode=passed?0:1;
}
if(require.main===module)throw Error('VISIBLE_TIME_GUEST_REQUIRES_QUALIFIED_DISPATCHER');
module.exports={TESTS,buildProgram};
