'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const q=require('../lib/engineering-quality'),gate=require('../scripts/engineering-quality-preflight.cjs');
const digest='a'.repeat(64);
const plan=()=>({version:q.VERSION,changeDigest:digest,risk:'critical',scope:'Preview-only reusable engineering controls.',riskAnalysis:'Prevent false acceptance and hidden contract drift.',threatModel:{assets:'Permissions and immutable accounting records.',trustBoundaries:'Model output versus authoritative backend state.',abuseCases:'Downgrade or self-approve an unsafe change.',mitigations:'Fail closed and require independent review evidence.'},rollback:'Revert only the reviewed feature implementation.',negativePaths:Object.fromEntries(q.NEGATIVE_PATHS.map(k=>[k,'Offline negative regression; no provider calls.'])),verification:q.classify(['api/policy.js']).requirements,defects:[]});
test('risk floor covers all CallerCore surfaces and unknown files',()=>{
 for(const p of ['lib/agent-operations.js','api/stripe.js','api/voice.js','admin-dashboard.html','dashboard.js','lib/permissions.js','api/external-service.js','package.json','.github/workflows/a.yml','unknown.bin'])assert.equal(q.classify([p]).risk,'critical',p);
 assert.equal(q.classify(['industries/legal.html']).risk,'substantial');assert.equal(q.classify(['docs/roadmap.md']).risk,'routine');
 assert.equal(q.classify(['docs/a.md','api/auth.js']).risk,'critical');assert.throws(()=>q.classify(['../escape']));
});
test('risk downgrade, stale plan, omitted negative paths and defect records fail',()=>{
 const c=q.classify(['api/voice.js']);assert.equal(q.validatePlan(plan(),digest,c).paidPermission,false);
 for(const mutate of [p=>p.risk='routine',p=>p.changeDigest='b'.repeat(64),p=>delete p.threatModel,p=>delete p.negativePaths.concurrency,p=>p.defects=[{rootCause:'Only a root cause is not prevention.'}]]){const p=plan();mutate(p);assert.throws(()=>q.validatePlan(p,digest,c));}
});
test('independent QA and Auditor cannot be replaced by Chief or Engineering',()=>{
 const qa={role:'independentQA',changeDigest:digest,decision:'passed',executionId:'qa-1',evidenceRef:'immutable-review-1'},auditor={...qa,role:'engineeringAuditor',executionId:'audit-1'};
 assert.equal(q.acceptance({digest,implementationId:'eng-1',qa,auditor}).accepted,true);
 for(const r of [{...qa,role:'chief'},{...qa,decision:'failed'},{...qa,executionId:'eng-1'},{...qa,changeDigest:'b'.repeat(64)}])assert.equal(q.acceptance({digest,implementationId:'eng-1',qa:r,auditor}).accepted,false);
 assert.equal(q.acceptance({digest,implementationId:'eng-1',qa,auditor:{...auditor,executionId:'qa-1'}}).accepted,false);
});
test('readiness never promotes mock or unit proof to live or Production',()=>{
 const r=q.readiness({unit:{digest,status:'passed',evidenceRef:'test-run'},mockEndToEnd:{digest,status:'passed',evidenceRef:'mock-run'},live:{digest:'b'.repeat(64),status:'passed',evidenceRef:'old-source'}},digest);
 assert.equal(r.unit,'verified');assert.equal(r.mockEndToEnd,'verified');assert.equal(r.live,'unverified');assert.equal(r.production,'unverified');
});
test('change gate binds actual file content and rejects missing plans',()=>{
 const entries=[{path:'api/voice.js',blob:'deadbeef'}],d=gate.digestEntries(entries),p={...plan(),changeDigest:d};
 assert.equal(gate.check(entries,[p]).planRisk,'critical');assert.throws(()=>gate.check([{...entries[0],blob:'altered'}],[p]));assert.throws(()=>gate.check(entries,[p,p]));
 assert.equal(gate.recordPath('docs/engineering-changes/initial.json'),true);assert.equal(gate.recordPath('docs/engineering-changes/hidden.js'),false);
});
test('anomaly evaluator preserves uncertain holds and emits bounded codes only',()=>{
 const s={at:1000,failed:1,rejected:1,apiFailures:1,running:2,stalled:1,retainedMicros:7000000,pendingMicros:2200000,limitMicros:15000000,spendDeltaMicros:1,expectedSpendMicros:0,dependencies:{storage:'healthy',broker:'healthy',previewIdentity:'healthy',provider:'unknown'},secret:'do-not-return'};
 const a=q.anomalies(s,1001);assert(a.some(x=>x.code==='uncertain-costs'));assert(a.some(x=>x.code==='task-stall'));assert(a.some(x=>x.code==='dependency-provider'));assert(!JSON.stringify(a).includes('do-not-return'));assert.equal(s.pendingMicros,2200000);
 assert.equal(q.anomalies(s,400000)[0].code,'telemetry-unavailable');assert.equal(q.anomalies({...s,retainedMicros:NaN},1001)[0].code,'telemetry-invalid');
});
test('live prerequisite wrapper cannot run with omitted or non-SHA comparison',()=>{
 const {spawnSync}=require('node:child_process'),path=require('node:path');
 for(const args of [[],['--base','HEAD'],['--base','a'.repeat(40),'--activate']]){
  const r=spawnSync(process.execPath,[path.join(__dirname,'../scripts/agent-operations-live-readiness.cjs'),...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,1);assert.match(r.stderr,/Explicit verified --base/);assert(!r.stdout.includes('passed'));
 }
});
