'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),phone=require('../lib/agent-operations-phone-search'),impl=require('../lib/agent-operations-implementation'),inf=require('../lib/agent-operations-engineering-inference'),h=require('./helpers/bounded-implementation-workflow.cjs');
test('task-defined manifest can contain more than two files without changing source authority',()=>{
 const draft=require('../lib/agent-operations-draft-proposal'),ctx=phone.context({ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),taskId:'task_manifest_fixture',executionId:'execution_manifest_fixture',sourceCommit:'c'.repeat(40),deploymentId:'dpl_fixture',origin:'https://my-ai-website-fixture-mohamtaj004bas-projects.vercel.app',releaseHash:'d'.repeat(64),contextHash:'e'.repeat(64)});
 ctx.files=['first.js','lib/second.js','third.css','views/fourth.html'].map((path,i)=>({path,text:'fixture'+i,sha256:draft.hash('fixture'+i),sites:[{id:'site'+i,before:'fixture'+i}]}));
 const value={version:draft.BUNDLE_VERSION,binding:ctx.binding,files:ctx.files.map(f=>({path:f.path,preimageSha256:f.sha256,edits:[{offset:0,before:f.text,after:f.text+' changed',beforeSha256:f.sha256}]}))};
 const result=draft.applyBundle(value,ctx);a.equal(result.files.length,4);a.equal(result.executionAuthorized,false);a.equal(result.publicationAllowed,false);value.files[0].path='extra.js';a.throws(()=>draft.applyBundle(value,ctx),/DRAFT_BUNDLE_SCOPE/);
});
test('five-stage fixture uses exact backend evidence and completes with honest Auditor rejection',async()=>{
 const f=h.setup();f.input={...f.input,idempotencyKey:'phone_workflow_fixture',objective:phone.OBJECTIVE};
 const plan=await h.run(f);a.equal(plan.status,'completed');a.equal(plan.tasks.length,5);
 const bodies=plan.tasks.map(t=>t.result.body.engineering.body);a(bodies.every(b=>b.context.evidence.length===5));a(bodies[0].context.evidence.some(e=>e.path==='lib/conversation-history.js'));
 a.equal(bodies[1].artifact.workspace.files.length,2);a.equal(bodies[1].artifact.workspace.cleanup.destroyed,true);a.equal(bodies[1].artifact.sourceExecuted,false);a.equal(bodies[4].receipt.response.auditDecision,'fail');a.equal(bodies[4].receipt.response.acceptedWork,false);
 a.equal(impl.validatePersisted(plan,plan.tasks[1],f.state()),true);
});
test('backend evidence is accepted only for the exact registered source assignment',()=>{
 const f=h.setup(),c={assignment:phone.OBJECTIVE,evidence:phone.snapshot().evidence,priorReceipts:[],binding:{planId:'phone_plan',taskId:'phone_task',executionId:'phone_exec',fence:1,ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),authorizationRevision:1,runtime:{...f.runtime,sourceCommit:f.runtime.commit,release:require('../lib/agent-operations-contracts').release()}}};delete c.binding.runtime.commit;delete c.binding.runtime.environment;
 a.doesNotThrow(()=>inf.buildRequest('chief-plan',c));a.throws(()=>inf.buildRequest('chief-plan',{...c,assignment:'unregistered backend evidence'}),/ENG_AI_EVIDENCE/);
 const changed=structuredClone(c);changed.evidence[4].text+=' modified';a.throws(()=>inf.buildRequest('chief-plan',changed),/ENG_AI_EVIDENCE/);
});
test('reusable manifest rejects protected source families and retains task scope as authoritative',()=>{
 const draft=require('../lib/agent-operations-draft-proposal');for(const p of ['lib/auth.js','lib/audit-log.js','lib/permissions.js','api/token.js','api/reveal-token.js','lib/secrets/store.js','lib/agent-operations-activation-controller.js','package-lock.json','vercel.json','../dashboard.js','lib/%2e%2e/auth.js'])a.throws(()=>draft.bundlePath(p),/DRAFT_BUNDLE_PATH/);
 a.equal(draft.bundlePath('lib/conversation-history.js'),'lib/conversation-history.js');
});
test('new task policy is registered consistently without reviving historical authority',()=>{
 const p=require('../lib/agent-operations-engineering-provider-v2'),c={assignment:phone.OBJECTIVE},t=p.PHONE_SEARCH_TRIAL;
 a.equal(p.activeDevelopment(t),true);a.equal(p.developmentFor(c),t);a.equal(p.isDevelopmentPolicy(t),true);a.equal(p.selectedTrial({CALLERCORE_AGENTOPS_ENGINEERING_TRIAL_AUTHORIZATION_ID:t.authorizationId}),t);a.equal(p.trialFor({countPricing:{authorizationId:t.authorizationId,evidenceHash:p.hash(t)}}),t);
 for(const file of ['agent-operations-command-center.js','lib/agent-operations-approval-lifecycle.js'])a(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8').includes(t.authorizationId));
 a.equal(phone.assignment().liveTaskRegistered,false); // descriptive preparation does not activate a grant
});
