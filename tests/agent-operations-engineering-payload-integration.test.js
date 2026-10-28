'use strict';
// Full reporting-chain payload qualification using independent rich fixtures.
// Exact bytes are measured; no byte-to-token estimate is made. Synthetic usage
// exercises the unchanged parser ceiling only, never claims actual consumption.
const test=require('node:test'),a=require('node:assert/strict');
const helper=require('./helpers/engineering-rich-payload-fixtures.cjs'),inf=require('../lib/agent-operations-engineering-inference'),provider=require('../lib/agent-operations-engineering-provider-v2'),impl=require('../lib/agent-operations-implementation'),handoff=require('../lib/agent-operations-engineering-handoff'),copy=require('../lib/agent-operations-proposal-copy'),contracts=require('../lib/agent-operations-contracts');

for(const profile of ['starter','visible','phone'])test(profile+' rich source-bound reports complete all five request/parser handoffs with unchanged token ceilings',async()=>{
 const c=helper.context(profile),measurements=[];
 for(const stage of inf.STAGES){
  const built=provider.request(stage,c),value=helper.response(stage,c),raw=helper.envelope(stage,c,value);
  a.equal(contracts.validateSchema(copy.schema(stage,inf.schema(stage),c),value),true,stage+' schema');
  a.equal(built.body.max_output_tokens,stage==='specialist'?8000:4000);
  a(built.inputBound<=65536,stage+' request bound');a(helper.bytes(value)<=32768,stage+' artifact bound');a(helper.bytes(raw)<=131072,stage+' provider envelope bound');
  const tooManyInputs=structuredClone(raw);tooManyInputs.usage.input_tokens=12001;a.throws(()=>provider.parse(stage,tooManyInputs,c),/ENG_TRANSPORT_USAGE/);
  const tooManyOutputs=structuredClone(raw);tooManyOutputs.usage.output_tokens=built.body.max_output_tokens+1;a.throws(()=>provider.parse(stage,tooManyOutputs,c),/ENG_TRANSPORT_USAGE/);
  a.throws(()=>provider.parseCount(stage,{object:'response.input_tokens',input_tokens:12001},c),/ENG_TRANSPORT_COUNT/);
  const counted=provider.countRequest(stage,c),b=built.body,now=Date.now();
  a.deepEqual(counted.body,{model:b.model,input:b.input,instructions:b.instructions,reasoning:b.reasoning,text:b.text,tools:b.tools,truncation:b.truncation});
  a.equal(counted.requestHash,built.requestHash);
  const proof=provider.parseCount(stage,{object:'response.input_tokens',input_tokens:12000},c,now,now+135000);
  a.equal(provider.assertCount(stage,c,proof,now).inputTokens,12000);
  a.throws(()=>provider.assertCount(stage,c,structuredClone(proof),now),/ENG_TRANSPORT_COUNT_PROVENANCE/);
  const foreign=structuredClone(c);foreign.binding.workspaceHash='f'.repeat(64);a.throws(()=>provider.assertCount(stage,foreign,proof,now),/ENG_TRANSPORT_COUNT_PROVENANCE/);
  measurements.push({stage,requestBytes:helper.bytes(built.body),admissionBytes:built.inputBound,schemaBytes:helper.bytes(built.body.text.format.schema),responseBytes:helper.bytes(value),providerBytes:helper.bytes(raw)});
  await helper.append(c,stage,value);
 }
 a.equal(c.priorReceipts.length,5);a.equal(c.priorReceipts[4].response.auditDecision,c.priorReceipts[3].response.decision);a(['fail','unresolved'].includes(c.priorReceipts[4].response.auditDecision));a.equal(c.priorReceipts[4].response.acceptedWork,false);
 const artifact=c.priorReceipts[1].implementationArtifact;a.equal(artifact.filesystemCreated,true);a.equal(artifact.workspace.cleanup.destroyed,true);a.equal(artifact.sourceExecuted,false);a.equal(artifact.publicationAuthorized,false);
 for(const r of c.priorReceipts){a.equal(r.mode,'fixture');a.equal(r.provider,null);a.equal(r.usage,null);a.equal(r.acceptedWork,false);a.equal(r.publicationAuthorized,false);}
 if(profile==='phone')a(measurements[1].responseBytes>16000,'regresses the old 16,000-byte output mismatch');
});

test('schema-valid 20,587-byte phone Specialist artifact fits modern policy while historical parsing remains unchanged',async()=>{
 const c=helper.context('phone');await helper.append(c,'chief-plan',impl.fixture('chief-plan',c));
 const value=helper.response('specialist',c,{findings:1}),size=helper.bytes(value);a.equal(size,20587);a.equal(contracts.validateSchema(copy.schema('specialist',inf.schema('specialist'),c),value),true);a.doesNotThrow(()=>impl.validateProposal(value.proposal,c));
 a.deepEqual(inf.parseResponse('specialist',JSON.stringify(value),c),value);
 const old=helper.context('phone',{modern:false});await helper.append(old,'chief-plan',impl.fixture('chief-plan',old));const historical=helper.response('specialist',old,{findings:1});a.throws(()=>inf.parseResponse('specialist',JSON.stringify(historical),old),/ENG_AI_OUTPUT_LIMIT/);
});

test('modern byte allowance is finite and does not silently loosen malformed or stale source validation',async()=>{
 const c=helper.context('phone');await helper.append(c,'chief-plan',impl.fixture('chief-plan',c));const value=helper.response('specialist',c,{findings:1});
 a.throws(()=>inf.parseResponse('specialist',' '.repeat(32769),c),/ENG_AI_OUTPUT_LIMIT/);
 const oversize=structuredClone(value);oversize.remainingUncertainty='x'.repeat(32769);a.throws(()=>inf.parseResponse('specialist',oversize,c),/ENG_AI_OUTPUT_LIMIT/);
 const stale=structuredClone(value);stale.proposal.patch.files[0].preimageSha256='0'.repeat(64);a.throws(()=>inf.parseResponse('specialist',stale,c),/ENG_AI_RESPONSE_SCHEMA|DRAFT_|PHONE_/);
 const malformed=structuredClone(value);malformed.proposal.patch.files[0].edits[0].after='process.exit()';a.throws(()=>inf.parseResponse('specialist',malformed,c),/PHONE_SEARCH_EXPRESSION/);
 a.equal(inf.CONFIG.maxInputTokens,12000);a.equal(inf.CONFIG.requestTimeoutMs,150000);a.equal(inf.CONFIG.durationMs,600000);a.equal(handoff.enabled(c),true);
});

test('one versioned byte policy covers request, artifact and provider envelope without changing historical bounds',()=>{
 a.deepEqual(handoff.payloadLimits(helper.context('phone')),{requestBytes:65536,outputBytes:32768,providerBytes:131072});
 a.deepEqual(handoff.payloadLimits(helper.context('phone',{modern:false})),{requestBytes:32768,outputBytes:16000,providerBytes:65536});
 for(const profile of ['starter','visible'])a.deepEqual(handoff.payloadLimits(helper.context(profile)),handoff.payloadLimits(helper.context('phone')));
});
