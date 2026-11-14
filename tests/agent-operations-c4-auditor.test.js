'use strict';
// Frozen historical source replay; not current-release or hosted evidence.
const {withHistorical}=require('./helpers/historical-calendar-source.cjs');
const test=(name,fn)=>nodeTest('historical replay: '+name,()=>withHistorical(fn));
const {test:nodeTest}=require('node:test'),assert=require('node:assert/strict');
const github=require('../lib/agent-operations-github-app');
const setup=require('../lib/agent-operations-integration-setup');
const sha='b'.repeat(40),now=100000;
const config={environment:'preview',repository:github.REPOSITORY,repositoryId:123,installationId:456,credentialReference:'vault:github:preview'};
const lease=()=>({token:'ghs_TEST_TOKEN_ONLY',repository:github.REPOSITORY,repositoryId:123,installationId:456,expiresAt:now+60000,permissions:{...github.PERMISSIONS}});
test('Auditor: setup metadata cannot claim connected authority or leak mutable shared steps',()=>{
 for(const provider of ['github','vercel','browser']){
  const first=setup.describe(provider);assert.equal(first.status,'prepared-not-connected');assert.equal(first.credentialsEnteredHere,false);assert.equal(first.externalWritesEnabled,false);assert(first.blockedBy.length);
  first.ownerSteps[0]='INJECTED';assert(!setup.describe(provider).ownerSteps.includes('INJECTED'));
 }
 assert.equal(setup.describe('unapproved-provider'),null);
});
test('Auditor: provider transport exception containing token and private response remains sanitized',async()=>{
 const client=github.create({config,clock:()=>now,authorize:async()=>true,credentialBroker:async()=>lease(),fetchImpl:async()=>{throw Error('ghs_SECRET private@example.test');}});
 await assert.rejects(client.inspect({kind:'commit',sourceCommit:sha}),/^Error: GH_TRANSPORT_OR_CONTRACT_UNAVAILABLE$/);
});
test('Auditor: cancellation during first provider response cannot dispatch the commit request',async()=>{
 const abort=new AbortController();let calls=0;
 const client=github.create({config,clock:()=>now,authorize:async()=>true,credentialBroker:async()=>lease(),fetchImpl:async()=>{calls++;abort.abort();return Response.json({total_count:1,repositories:[{id:123,full_name:github.REPOSITORY}]});}});
 await assert.rejects(client.inspect({kind:'commit',sourceCommit:sha},{signal:abort.signal}),/GH_CANCELLED/);assert.equal(calls,1);
});
test('Auditor: trusted authorization must return true, not a model-provided truthy claim',async()=>{
 let minted=0,requests=0;
 for(const forged of ['true',{approved:true},1]){
  const client=github.create({config,clock:()=>now,authorize:async()=>forged,credentialBroker:async()=>{minted++;return lease();},fetchImpl:async()=>{requests++;return Response.json({});}});
  await assert.rejects(client.inspect({kind:'ci',sourceCommit:sha}),/GH_AUTHORITY_DENIED/);
 }
 assert.equal(minted,0);assert.equal(requests,0);
});
test('Auditor: exact source identity is verified even after authorized repository inventory',async()=>{
 let calls=0;
 const client=github.create({config,clock:()=>now,authorize:async()=>true,credentialBroker:async()=>lease(),fetchImpl:async()=>Response.json(++calls===1?{total_count:1,repositories:[{id:123,full_name:github.REPOSITORY}]}:{sha:'c'.repeat(40),parents:[]})});
 await assert.rejects(client.inspect({kind:'commit',sourceCommit:sha}),/GH_RESPONSE_INVALID/);assert.equal(calls,2);
});
test('Auditor: practical correction cites immutable actual source without claiming customer impact',()=>{
 const tools=require('../lib/agent-operations-engineering-tools'),fix=require('../lib/agent-operations-draft-correction');
 const source=tools.readFile('dashboard.js'),e=tools.inspectCorrection(),finding=e.observations[0];
 assert.equal(e.observations.length,1);assert.equal(finding.id,'chart-local-day-dst');
 assert.equal(source.split('\n')[finding.evidence.line-1],finding.evidence.text);
 assert.equal(finding.evidence.sha256,fix.hash(source));assert.equal(finding.evidence.excerptHash,fix.hash(finding.evidence.text));
 assert.match(finding.uncertainty,/customer occurrence.*not been observed/);
 const after=fix.apply(source);assert.equal(after.replace(fix.AFTER,fix.BEFORE),source);
 assert.equal(source.split(fix.BEFORE).length,2);assert(!after.includes(fix.BEFORE));
});
test('Auditor: draft correction API is inert and refuses malformed or substituted preimages',()=>{
 const tools=require('../lib/agent-operations-engineering-tools'),fix=require('../lib/agent-operations-draft-correction'),source=tools.readFile('dashboard.js');
 for(const changed of [source+'\n',source.replace(fix.BEFORE,'const next=evil();'),source.replace(fix.BEFORE,fix.AFTER)])assert.throws(()=>fix.apply(changed),/DRAFT_PREIMAGE/);
 const patch=fix.patch(source);assert.equal(patch.path,'dashboard.js');assert.equal(patch.operation,'replace-reviewed-fixed-text');assert.deepEqual(Object.keys(patch),['path','operation','profile','beforeSha256','afterSha256','beforeText','afterText']);
});
test('Auditor: GitHub request binding is immutable across asynchronous credential work',async()=>{
 const input={kind:'ci',sourceCommit:sha};let requested;
 const client=github.create({config,clock:()=>now,authorize:async()=>true,credentialBroker:async()=>{input.sourceCommit='c'.repeat(40);return lease();},fetchImpl:async(url)=>{requested=url;return Response.json(url.includes('/installation/repositories')?{total_count:1,repositories:[{id:123,full_name:github.REPOSITORY}]}:{workflow_runs:[]});}});
 const receipt=await client.inspect(input);assert(requested.includes('head_sha='+sha));assert.equal(receipt.sourceCommit,sha);
});
