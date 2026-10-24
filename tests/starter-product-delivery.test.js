'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),tools=require('../lib/agent-operations-engineering-tools'),impl=require('../lib/agent-operations-implementation');
test('current product contains exactly the preserved agent replacement while original source and evidence stay immutable',()=>{
 const old=impl.snapshot(),current=tools.readFile('dashboard.js'),before="    ['automations',d=>{automationsData=d.automations||[]}],",after="    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),";
 a.equal(old.sourceSha256,'202a482a439821294d30a984d8f7402b9102fb5d28680a931da31969785ea049');a.equal(tools.hash(current),'c812f5c62121e503ecd0946f7ca6d09eeac1a1147b4110d7dbc5c50493146cef');a.equal(current,old.text.replace(before,after));a.deepEqual(impl.historicalEvidence(),old.evidence);
 a.equal(tools.hash(require('../lib/agent-operations-implementation-source-v1.json')),'00a3c2c8b0181ed5055ff5f0620b85d2a8c6e9ca97fcfec7421c6d36dbb6782a');
});
test('resolved Starter task fails current-source admission rather than silently substituting historical evidence',()=>{
 a.equal(impl.availability().status,'resolved');a.equal(impl.availability().freshAssignmentAllowed,false);a.throws(()=>impl.sourceEvidence(),/ENG_IMPLEMENTATION_RESOLVED/);a(impl.historicalEvidence().length>0);a.equal(impl.capabilities().assignmentAvailability.status,'resolved');
});
test('current generic read evidence matches current file digests and old evidence remains immutable',()=>{
 const current=tools.captureApproved();for(const e of require('../lib/agent-operations-engineering-rehearsal').sourceEvidence()){a.equal(e.sha256,tools.hash(current.texts[e.path]));a.equal(current.texts[e.path].split('\n')[e.line-1],e.text);}
 a.equal(tools.hash(require('../lib/agent-operations-engineering-inference-evidence-v4.json')),'4d1ea56aca638656b35d674155c4c44e4e6b494ac992e5b1914a109a8b24e0b0');
});
test('current source-only test builder stays historical and does not mislabel the corrected product as a new baseline',()=>{
 const builder=require('../scripts/source-execution-starter-tests.cjs'),baseline=impl.snapshot().text,patched=tools.readFile('dashboard.js');a.deepEqual(builder.buildProgram({baseline,patched}).sourceHashes,builder.HASHES);a.throws(()=>builder.buildProgram({baseline:patched,patched}),/STARTER_SOURCE_IDENTITY/);
});
test('fresh resolved Starter assignment is rejected before journal append with current source validation enabled',async()=>{
 const owner={kind:'owner',verifiedOwner:true,id:'starter-delivery-owner@example.test',workspaceId:'starter-delivery'},rows=new Map(),runtime={environment:'preview',origin:'https://my-ai-website-starterdelivery-mohamtaj004bas-projects.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_starterDelivery'},ledger={version:1,revision:1,tasks:[],reservations:[],operations:{workflows:[],grants:[],reservations:[],audit:[],approvals:[]}};
 const service=require('../lib/agent-operations-operating-system').createOperations({kv:{get:async k=>rows.get(k)??null,eval:async()=>{throw Error('No journal append expected');}},runtime,assertOwner:async()=>true,ledgerAdapter:{read:async()=>JSON.stringify(ledger)}});
 const templates=require('../lib/agent-operations-engineering-rehearsal').templates;
 await a.rejects(service.create(owner,{idempotencyKey:'resolved_starter_product',objective:impl.OBJECTIVE,priority:'normal',durationMs:600000,engineeringProfile:impl.PROFILE,subtasks:templates.map((template,i)=>({key:'stage'+i,template,dependsOn:i?['stage'+(i-1)]:[]}))}),/ENG_IMPLEMENTATION_RESOLVED/);a.equal(rows.size,0);
});
test('owner readiness remains readable for retired Starter scope and cannot supply a paid admission hash',async()=>{
 const runtime={environment:'preview',origin:'https://my-ai-website-starterdelivery-mohamtaj004bas-projects.vercel.app',commit:'a'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_starterDelivery'},owner={kind:'owner',verifiedOwner:true,id:'starter-delivery-owner@example.test',workspaceId:'starter-delivery'},p=require('../lib/agent-operations-engineering-provider-v2');let raw=null;
 const organization=require('../lib/agent-operations-organization').createOrganization({read:async()=>raw,compare:async(before,after)=>{if(before!==raw)return false;raw=after;return true;}},{runtime,scope:{commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app'}});
 const control=require('../lib/agent-operations-activation-controller').createEngineeringOwnerControl({operations:{read:async()=>({plans:[]})},organization,runtime,assertOwner:async()=>true,env:{CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID:p.STARTER_TRIAL.authorizationId}});
 const r=await control.readiness(owner,{});a.equal(r.uncertainTrialScopeHash,null);a(r.blockers.includes('starter-assignment-resolved-or-source-changed'));a.equal(r.configurationGatesSatisfied,false);a.equal(r.paidExecution,false);
});
