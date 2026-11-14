'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
const {test}=require('node:test'),a=require('node:assert/strict');
const impl=require('../lib/agent-operations-implementation'),v1=require('../lib/agent-operations-engineering-inference'),v2=require('../lib/agent-operations-engineering-provider-v2'),old=require('./fixtures/engineering-implementation-headroom-v1-requests.json');
const context=assignment=>({...structuredClone(old.context),assignment,priorReceipts:[]});
function specialist(assignment){const c=context(assignment),response=impl.fixture('chief-plan',c),body={version:v2.VERSION,stage:'chief-plan',binding:structuredClone(c.binding),response,acceptedWork:false};c.priorReceipts=[{...body,hash:v2.hash(body)}];return c;}
function constraints(schema){const out=structuredClone(schema);const walk=s=>{delete s.description;for(const v of Object.values(s.properties||{}))walk(v);if(s.items)walk(s.items);};walk(out);return out;}

test('all five frozen headroom v1/v2 request objects and policies remain byte-identical',async()=>{
 a.equal(impl.HEADROOM_OBJECTIVE,old.assignment);a.deepEqual(v2.HEADROOM_STARTER_TRIAL,old.starter);a.deepEqual(v2.HEADROOM_DEVELOPMENT_TRIAL,old.development);
 const c=context(old.assignment),native=context(old.assignment);
 for(const row of old.requests){a.deepEqual(v1.buildRequest(row.stage,c),row.v1);a.deepEqual(v2.request(row.stage,native),row.v2);
  if(row.stage!=='specialist'){const current=v2.request(row.stage,{...native,assignment:impl.GUIDANCE_OBJECTIVE}).body;a.equal(current.instructions,row.v2.body.instructions);a.deepEqual(current.text.format.schema,row.v2.body.text.format.schema);a.equal(current.max_output_tokens,row.v2.body.max_output_tokens);}
  c.priorReceipts.push(v1.executeFixture(row.stage,c));const response=impl.fixture(row.stage,native);let artifact;
  if(row.stage==='specialist'){const binding=impl.workspaceBinding(native),workspace=await require('../scripts/agent-operations-draft-workspace.cjs').prepareProposal({sourceSha:binding.runtime.sourceCommit,expectedSourceSha:binding.runtime.sourceCommit,binding,proposal:impl.proposal(response.proposal,native),authorize:async()=>true});a.equal(workspace.cleanup.destroyed,true);artifact=impl.artifactFor(native,response.proposal,workspace);}
  const body={version:v2.VERSION,stage:row.stage,binding:structuredClone(native.binding),response,acceptedWork:false,...(artifact?{implementationArtifact:artifact}:{})};native.priorReceipts.push({...body,hash:v2.hash(body)});
 }
});

test('new Specialist deduplicates only repeated annotations while preserving all schema constraints and other request settings',()=>{
 const previous=v2.request('specialist',specialist(impl.HEADROOM_OBJECTIVE)).body,current=v2.request('specialist',specialist(impl.GUIDANCE_OBJECTIVE)).body;
 a.deepEqual(constraints(current.text.format.schema),constraints(previous.text.format.schema));
 const guidance='Write one brief complete statement well below this ceiling. Rephrase; never cut off a word or sentence, append punctuation to a fragment, or use placeholders.';
 a.equal(JSON.stringify(previous.text.format.schema).split(guidance).length-1,16);a.equal(JSON.stringify(current.text.format.schema).includes(guidance),false);a.equal(current.instructions,previous.instructions+' Shared field-writing guidance: '+guidance);
 const before=structuredClone(previous),after=structuredClone(current);delete before.instructions;delete after.instructions;delete before.text.format.schema;delete after.text.format.schema;
 const data=JSON.parse(after.input[0].content[0].text);a.equal(data.assignment,impl.GUIDANCE_OBJECTIVE);data.assignment=impl.HEADROOM_OBJECTIVE;after.input[0].content[0].text=JSON.stringify(data);a.deepEqual(after,before);
 a(Buffer.byteLength(JSON.stringify(current))<Buffer.byteLength(JSON.stringify(previous))-2500);
});

test('historical headroom policies remain readable but cannot authorize the selected compact contract',()=>{
 a.equal(v2.hash(v2.HEADROOM_DEVELOPMENT_TRIAL),'9561acf9e5761271232129ebe83c4a002a278ecc13265aa3dbe822541b41af20');
 for(const t of [v2.HEADROOM_STARTER_TRIAL,v2.HEADROOM_DEVELOPMENT_TRIAL]){const approval={countPricing:{kind:t.kind,authorizationId:t.authorizationId,evidenceHash:v2.hash(t),uncertaintyAccepted:true,providerHardCap:false}};
  a.equal(v2.trialFor(approval),t);a.equal(v2.countPolicyPinned(approval,{CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID:t.authorizationId,CALLERCORE_AGENTOPS_ENGINEERING_COUNT_UNCERTAINTY_SHA256:v2.hash(t)}),false);
 }
 a.notEqual(v2.hash(v2.DEVELOPMENT_TRIAL),v2.hash(v2.HEADROOM_DEVELOPMENT_TRIAL));
});

test('only exact compact objective opts in; limits and other-stage guidance remain unchanged',()=>{
 for(const assignment of [impl.GUIDANCE_OBJECTIVE,impl.HEADROOM_OBJECTIVE]){for(const stage of v1.STAGES)a.equal(impl.stageOutputLimit(stage,{assignment}),stage==='specialist'?8000:4000);a.equal(impl.totalOutputLimit({assignment}),24000);}
 for(const stage of v1.STAGES.filter(s=>s!=='specialist')){const c=context(impl.GUIDANCE_OBJECTIVE);a.equal(impl.providerInstructions(stage,c,'base'),'base');}
 a.equal(impl.providerInstructions('specialist',{assignment:impl.GUIDANCE_OBJECTIVE+' extra'},'base'),'base');a.equal(impl.enabled({assignment:impl.GUIDANCE_OBJECTIVE+' extra'}),false);
});

test('compact guidance does not relax backend source, evidence, code or output-envelope rejection',()=>{
 const c=specialist(impl.GUIDANCE_OBJECTIVE),value=impl.fixture('specialist',c);a(v1.parseResponse('specialist',value,c));
 for(const mutate of [x=>x.proposal.path='../dashboard.js',x=>x.proposal.binding.workspaceHash='f'.repeat(64),x=>x.proposal.beforeSha256='f'.repeat(64),x=>x.proposal.edits[0].afterText='process.exit()',x=>x.findings[0].evidenceIds=['invented'],x=>x.acceptanceMapping=[]]){const bad=structuredClone(value);mutate(bad);a.throws(()=>v1.parseResponse('specialist',bad,c));}
 a.throws(()=>v2.parse('specialist',{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[],usage:{input_tokens:0,output_tokens:0}},c),/ENG_TRANSPORT_RESPONSE/);
});
