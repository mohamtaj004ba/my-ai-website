'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const discovery=require('../lib/agent-operations-engineering-discovery'),chief=require('../lib/agent-operations-chief-model'),contracts=require('../lib/agent-operations-contracts'),tools=require('../lib/agent-operations-engineering-tools');
const ctx=()=>discovery.packet({sourceCommit:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),release:contracts.assertRelease()});
const value=c=>({contextHash:c.hash,decision:'investigate',problem:'Source-only fixture candidate, not a verified bug.',userImpact:'Potential recovery inconsistency requires investigation.',evidenceIds:[c.body.evidence[0].id],files:[c.body.evidence[0].path],acceptanceCriteria:['Verify recovery against a reproducible failure.'],exclusions:['No generated-code execution, real repository mutation or publication.'],uncertainty:'Fixture selection only; no model reasoning or runtime reproduction.',reason:'Exercise current source binding without claiming a product defect.'});
const response=v=>({status:'completed',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1000,output_tokens:300,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:50}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(v)}]}]});
test('current source catalog reaches the existing Chief request without granting authority',()=>{
 const c=ctx(),r=chief.request(c);assert.ok(c.body.catalog.length>100);assert.equal(r.body.model,'gpt-6.1-sol');assert.equal(r.body.reasoning.effort,'medium');assert.equal(r.body.max_output_tokens,4000);assert.deepEqual(r.body.tools,[]);assert.ok(Buffer.byteLength(JSON.stringify(r.body))<65536);assert.equal(r.executionEnabled,false);assert.equal(r.automaticDispatch,false);
 for(const e of c.body.evidence){const source=tools.readFile(e.path);assert.equal(source.split('\n').slice(e.line-1,e.endLine).join('\n'),e.text);assert.equal(tools.hash(source),e.sha256);}
});
test('Chief can request any catalog excerpt without a Work-selected defect or arbitrary path',()=>{const c=ctx(),id=c.body.catalog.at(-1)[0],next=discovery.packet(c.body.identity,{evidenceIds:[id]});assert.equal(next.body.evidence[0].id,id);assert.throws(()=>discovery.packet(c.body.identity,{evidenceIds:['../../.env']}),/EVIDENCE/);assert.throws(()=>discovery.packet(c.body.identity,{evidenceIds:[id,id]}),/EVIDENCE/);});
test('real parser to source-bound task draft retains uncertainty and denies registration',()=>{const c=ctx(),v=value(c),r=chief.receipt(response(v),c);assert.equal(r.proposal.next,'review-source-bound-task-draft');assert.deepEqual(r.proposal.evidence,[c.body.evidence[0]]);assert.equal(r.actualMicros,5000);for(const k of ['executionAuthorized','paidDispatch','publicationAuthorized','acceptedWork'])assert.equal(r.proposal[k],false);assert.equal(require('../lib/agent-operations-implementation-tasks').registration({assignment:r.proposal.decision.problem}),null);});
test('hold and inspect are honest results, never successful engineering assignments',()=>{const c=ctx();for(const decision of ['hold','inspect']){const v={...value(c),decision,files:[],acceptanceCriteria:[],evidenceIds:decision==='inspect'?[c.body.catalog.at(-1)[0]]:[]};const r=chief.receipt(response(v),c);assert.equal(r.proposal.decision.decision,decision);assert.equal(r.proposal.executionAuthorized,false);}});
for(const [name,mutate,code]of [
 ['wrong context',v=>v.contextHash='0'.repeat(64),'OUTPUT'],
 ['invented evidence',v=>v.evidenceIds=['missing'],'OUTPUT'],
 ['protected configuration',v=>v.files=['.env'],'OUTPUT'],
 ['dependency installation',v=>v.files=['package.json'],'OUTPUT'],
 ['unread source claim',(v,c)=>v.evidenceIds=[c.body.catalog.find(x=>!c.body.evidence.some(e=>e.id===x[0]))[0]],'UNREAD'],
 ['unbacked file scope',v=>v.files=['dashboard.css'],'FILE_SCOPE'],
 ['missing criteria',v=>v.acceptanceCriteria=[],'INCOMPLETE'],
 ['incomplete criterion',v=>v.acceptanceCriteria=['Verify recovery and'],'INCOMPLETE'],
 ['duplicate criteria',v=>v.acceptanceCriteria=['A.','A.'],'OUTPUT'],
 ['forged acceptance',v=>v.acceptedWork=true,'OUTPUT'],
 ['blank narrative',v=>v.problem='  ','OUTPUT'],
 ['secret in model output',v=>v.problem='sk-proj-'+'a'.repeat(40),'SOURCE_SECRET']
])test('deny '+name,()=>{const c=ctx(),v=value(c);mutate(v,c);assert.throws(()=>chief.receipt(response(v),c),new RegExp(code));});
test('tampered source and rehashed metadata cannot replace canonical capture',()=>{const c=ctx();c.body.evidence[0].text='Forged source';c.body.evidence[0].excerptHash=tools.hash(c.body.evidence[0].text);c.hash=tools.hash(c.body);assert.throws(()=>chief.request(c),/SOURCE_STALE/);});
test('forged release, unsafe source identity and unknown request modes fail closed',()=>{const c=ctx();assert.throws(()=>discovery.packet({...c.body.identity,release:{...c.body.identity.release,digest:'0'.repeat(64)}}),/RELEASE/);assert.throws(()=>discovery.packet({...c.body.identity,sourceCommit:'main'}),/IDENTITY/);assert.throws(()=>chief.request(c,{format:'tools'}),/format denied/);});
for(const kind of ['incomplete','refusal','tool','tokens','malformed','error','wrong-role','duplicate-message'])test('provider '+kind+' cannot create a finding',()=>{const c=ctx(),r=response(value(c));if(kind==='incomplete')r.status='incomplete';if(kind==='refusal')r.output[0].content=[{type:'refusal',refusal:'No'}];if(kind==='tool')r.output=[{type:'function_call',name:'execute',arguments:'{}'}];if(kind==='tokens')r.usage.input_tokens=12001;if(kind==='malformed')r.output[0].content[0].text='{';if(kind==='error')r.error={code:'provider-error'};if(kind==='wrong-role')r.output[0].role='user';if(kind==='duplicate-message')r.output.push(structuredClone(r.output[0]));assert.throws(()=>chief.receipt(r,c));});
test('relabeled commit and explicit cache-policy omission are prevented',()=>{const c=ctx();assert.throws(()=>discovery.packet({...c.body.identity,sourceCommit:'0'.repeat(40)}),/SOURCE_COMMIT/);c.body.identity.sourceCommit='0'.repeat(40);c.hash=tools.hash(c.body);assert.throws(()=>chief.request(c),/SOURCE_COMMIT/);assert.deepEqual(chief.request(ctx()).body.prompt_cache_options,{mode:'explicit'});});
test('existing document-only checkpoint equivalence does not invalidate unchanged application source',()=>{const c=ctx(),source=require('../scripts/development-checkpoint.cjs').applicationSource();assert.equal(discovery.current(discovery.packet({...c.body.identity,sourceCommit:source})),true);});
test('Chief inspect decision reads actual additional lines and preserves exact provenance through the next draft',()=>{
 const c=ctx(),v={...value(c),decision:'inspect',evidenceIds:[c.body.catalog.find(row=>row[3]==='renderCalls')[0]],files:[],acceptanceCriteria:[]};
 const first=chief.receipt(response(v),c).proposal,next=discovery.readSelection(first,c),e=next.body.evidence[0];
 assert.ok(e.endLine>e.line);assert.equal(e.text,tools.readFile(e.path).split('\n').slice(e.line-1,e.endLine).join('\n'));assert.notEqual(next.hash,c.hash);
 assert.equal(chief.receipt(response(value(next)),next).proposal.executionAuthorized,false);
 const forged=structuredClone(first);forged.decision.evidenceIds=['source-999999'];assert.throws(()=>discovery.readSelection(forged,c));
});
