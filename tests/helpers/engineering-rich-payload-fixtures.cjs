'use strict';
// Offline reporting/payload regression only. Prose and patches are deliberately
// synthetic fixtures, not model reasoning or product corrections. The existing
// trusted worker applies inert bytes to a disposable copy and destroys it; no
// proposed source is evaluated. Starter explicitly replays its frozen pre-fix
// source. No provider, network, billable execution or publication is supplied.
require('./historical-starter-fixture.cjs');
const inf=require('../../lib/agent-operations-engineering-inference'),provider=require('../../lib/agent-operations-engineering-provider-v2'),impl=require('../../lib/agent-operations-implementation'),phone=require('../../lib/agent-operations-phone-search'),tasks=require('../../lib/agent-operations-implementation-tasks'),handoff=require('../../lib/agent-operations-engineering-handoff'),copy=require('../../lib/agent-operations-proposal-copy'),contracts=require('../../lib/agent-operations-contracts');
const observed=require('../fixtures/phone-chief-observed-050085d9.json');
const bytes=x=>Buffer.byteLength(JSON.stringify(x));
function context(profile,{modern=true}={}){
 const objective={starter:impl.OBJECTIVE,visible:tasks.VISIBLE_TIME_OBJECTIVE,phone:phone.OBJECTIVE}[profile];if(!objective)throw Error('Unknown offline payload profile');
 const binding=structuredClone(observed.receipt.binding);Object.assign(binding,{planId:'offline_payload_plan',taskId:'offline_payload_task',executionId:'offline_payload_execution'});
 binding.runtime={...binding.runtime,release:contracts.release()};if(modern)binding.runtime=handoff.runtime(binding.runtime);else delete binding.runtime.engineeringContract;
 const c={binding,assignment:objective,priorReceipts:[]};c.evidence=impl.snapshotFor(c).evidence;return c;
}
function sentence(text,n){const phrase='Review source behavior and verify user impact against independent evidence. ';return(text+' '+phrase.repeat(Math.ceil(n/phrase.length))).slice(0,n-1)+'.';}
function rich(value,schema,{fraction=1}={}){
 function visit(v,node,path){
  if(!node)return v;if(node.anyOf)node=node.anyOf.find(n=>contracts.validateSchema(n,v))||node.anyOf[0];
  if(typeof v==='string'&&node.pattern&&!['id','siteId','before','beforeText','after','afterText','beforeSha256','path','sourceSha','profile'].includes(path.at(-1))&&!path.some(k=>['binding','evidenceIds','sourceEvidenceIds','qualityReviewRefs'].includes(k))){const m=node.pattern.match(/\{1,(\d+)\}/);if(m)return sentence(v,Math.floor(Number(m[1])*fraction)+(node.pattern.endsWith('[.!?]$')?1:0));}
  if(Array.isArray(v)){let rows=v;if(['scope','exclusions','deliverables','regressionRisks','affectedInterfaces','verificationStrategy','risks','verification'].includes(path.at(-1))&&node.maxItems)rows=Array.from({length:node.maxItems},(_,i)=>v[i%v.length]);return rows.map((x,i)=>visit(x,node.items,path.concat(String(i))));}
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x,node.properties?.[k],path.concat(k))]));return v;
 }
 return visit(value,schema,[]);
}
function response(stage,c,{fraction=1,findings=3,maxPhonePatch=true}={}){
 const s=copy.schema(stage,inf.schema(stage),c),sample=impl.fixture(stage,c);
 if(phone.enabled(c)&&stage==='specialist')for(let i=1;i<findings;i++)sample.findings.push({...sample.findings[0],id:'phone-search-'+i,claim:sample.findings[0].claim+' Finding '+i+'.'});
 const value=rich(sample,s,{fraction});
 // The permitted expression remains the fixture's parenthesized source. Only
 // harmless trailing spaces exercise the exact per-edit 2,048-byte contract.
 if(maxPhonePatch&&stage==='specialist'&&phone.enabled(c))for(const f of value.proposal.patch.files)for(const e of f.edits)e.after='('+e.before+')'+' '.repeat(2048-e.before.length-2);
 return value;
}
function envelope(stage,c,value,overrides={}){return{id:'resp_offline_payload',status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:12000,output_tokens:impl.stageOutputLimit(stage,c),input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}],...overrides};}
async function append(c,stage,value){
 inf.parseResponse(stage,value,c);const parsed=provider.parse(stage,envelope(stage,c,value),c);let artifact;
 if(stage==='specialist'){
  const workspace=await require('../../scripts/agent-operations-draft-workspace.cjs').prepareImplementation({context:c,sourceSha:c.binding.runtime.sourceCommit,expectedSourceSha:c.binding.runtime.sourceCommit,proposal:impl.proposal(value.proposal,c),binding:impl.workspaceBinding(c),authorize:async()=>true,timeoutMs:8000});
  artifact=impl.artifactFor(c,value.proposal,workspace);
 }
 const receipt=provider.receipt(stage,c,parsed,'fixture','e'.repeat(64),artifact);c.priorReceipts.push(receipt);return receipt;
}
module.exports={bytes,context,rich,response,envelope,append};
