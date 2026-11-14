'use strict';
// Independent Auditor boundary review. Synthetic counters/records only; no provider, credentials or writes.
const {test}=require('node:test'),assert=require('node:assert/strict');
const quality=require('../lib/engineering-quality');
const gate=require('../scripts/engineering-quality-preflight.cjs'),{spawnSync,execFileSync}=require('node:child_process'),path=require('node:path');
const digest='a'.repeat(64);
const review=(role,id)=>({role,executionId:id,changeDigest:digest,decision:'passed',evidenceRef:'artifact:verified-review'});
test('auditor: path traversal and unknown/high-consequence code cannot downgrade to routine',()=>{
 for(const path of ['../docs/a.md','docs/../a.md','/docs/a.md','docs\\a.md','C:/docs/a.md','docs/a\n.md'])assert.throws(()=>quality.classify([path]));
 for(const path of ['lib/auth.js','api/voice.js','.github/workflows/check.yml','scripts/check.cjs','unknown.bin','.env.local','package-lock.json','admin.html','client-portal.html'])assert.equal(quality.classify([path]).risk,'critical',path);
 assert.equal(quality.classify(['docs/a.md','lib/auth.js']).risk,'critical');
});
test('auditor: caller evidence cannot skip mandatory independent QA or critical Auditor failures',()=>{
 const base={digest,implementationId:'engineering-1',risk:'critical',qa:review('independentQA','qa-1'),auditor:review('engineeringAuditor','auditor-1')};
 const passed=quality.acceptance(base);assert.equal(passed.accepted,true);assert.equal(passed.executionPermission,false);assert.equal(passed.requiresTrustedEvidenceStore,true);
 for(const mutation of [v=>v.qa.decision='failed',v=>v.auditor.decision='failed',v=>v.qa.executionId=v.implementationId,v=>v.auditor.executionId=v.qa.executionId,v=>v.qa.changeDigest='b'.repeat(64),v=>v.auditor.role='chief',v=>delete v.qa.evidenceRef,v=>v.risk='unknown']){
  const changed=structuredClone(base);mutation(changed);assert.equal(quality.acceptance(changed).accepted,false);
 }
});
test('auditor: readiness dimensions do not inherit mock success as live or Production verification',()=>{
 const result=quality.readiness({unit:{digest,status:'passed',evidenceRef:'unit-log'},mockEndToEnd:{digest,status:'passed',evidenceRef:'mock-log'},live:{digest:'b'.repeat(64),status:'passed',evidenceRef:'old-live'},production:{digest,status:'passed'}},digest);
 assert.equal(result.unit,'verified');assert.equal(result.mockEndToEnd,'verified');assert.equal(result.live,'unverified');assert.equal(result.production,'unverified');assert.equal(result.integration,'unverified');
});
test('auditor: critical plans cannot declare arbitrary checks instead of mandated verification',()=>{
 const classification=quality.classify(['api/voice.js']);
 const plan={version:quality.VERSION,changeDigest:digest,risk:'critical',scope:'Preview engineering safeguard implementation.',riskAnalysis:'Untrusted model responses and partial execution can escape checks.',threatModel:{assets:'Immutable evidence and protected Preview credentials.',trustBoundaries:'Worker outputs versus authoritative backend state.',abuseCases:'Forged acceptance or self-issued authority grants.',mitigations:'Independent QA and Auditor review with fail closed gates.'},rollback:'Revert the isolated feature implementation only.',negativePaths:Object.fromEntries(quality.NEGATIVE_PATHS.map(k=>[k,'Deterministic offline adversarial test for this boundary.'])),defects:[],verification:['anything']};
 assert.throws(()=>quality.validatePlan(plan,digest,classification));
 plan.verification=classification.requirements;
 assert.equal(quality.validatePlan(plan,digest,classification).valid,true);
 plan.verification=classification.requirements.filter(x=>x!=='engineering-auditor');
 assert.throws(()=>quality.validatePlan(plan,digest,classification));
});
test('auditor: anomaly reports reject stale/malformed counters and never echo sensitive input',()=>{
 const now=1000000,snapshot={at:now,failed:1,rejected:1,apiFailures:1,running:1,stalled:1,retainedMicros:900,pendingMicros:300,limitMicros:1000,spendDeltaMicros:100,expectedSpendMicros:50,dependencies:{storage:'healthy',broker:'healthy',previewIdentity:'healthy',provider:'unknown'},error:'PRIVATE_PAYLOAD_TOKEN',credentials:'DO_NOT_REPORT'};
 const alerts=quality.anomalies(snapshot,now),codes=alerts.map(x=>x.code);for(const code of ['budget-near-limit','unexpected-spending','uncertain-costs','agent-failure','task-stall','rejected-work','external-api-failure','dependency-provider'])assert(codes.includes(code),code);
 assert(!JSON.stringify(alerts).includes('PRIVATE_PAYLOAD_TOKEN'));assert(!JSON.stringify(alerts).includes('DO_NOT_REPORT'));
 assert.deepEqual(quality.anomalies({...snapshot,at:now-300001},now),[{code:'telemetry-unavailable',severity:'critical'}]);
 for(const patch of [{pendingMicros:901},{stalled:2},{retainedMicros:NaN},{limitMicros:0},{failed:-1},{failed:'1'}])assert.deepEqual(quality.anomalies({...snapshot,...patch},now),[{code:'telemetry-invalid',severity:'critical'}]);
});
test('auditor: actual CLI refuses omitted comparison base rather than a silent empty diff',()=>{
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^QUALITY_BASE$|^OPENAI_|^CALLERCORE_|^VERCEL_/i.test(k)));
 const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/engineering-quality-preflight.cjs')],{encoding:'utf8',env,windowsHide:true});
 assert.equal(result.status,1);assert.match(result.stderr,/Explicit --base required/);assert.doesNotMatch(result.stdout,/engineeringPreflight.*passed/);
});
test('auditor: working manifest includes real untracked changes and dirty committed verification fails closed',()=>{
 const root=path.join(__dirname,'..');
 const dirty=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 const working=gate.working();assert.match(working.digest,/^[a-f0-9]{64}$/);
 for(const entry of working.entries){assert.match(entry.blob,/^(?:[a-f0-9]{40,64}|deleted)$/);assert.match(entry.oldBlob,/^(?:[a-f0-9]{40,64}|deleted)$/);}
 if(dirty)assert.throws(()=>gate.committed(gate.BASELINE),/Dirty worktree/);
 else assert.throws(()=>gate.committed('ffffffffffffffffffffffffffffffffffffffff'),/Command failed/);
});
