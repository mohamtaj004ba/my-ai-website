'use strict';
// Pure verification policy. No credentials, executors, model calls or permission grants.
const {createHash}=require('node:crypto');
const VERSION='engineering-quality-v1';
const LEVELS=['routine','substantial','critical'];
const DIMENSIONS=['unit','integration','contractReplay','mockEndToEnd','live','production'];
const NEGATIVE_PATHS=['malformed-response','stale-state','concurrency','cancellation','worker-interruption','api-outage','authorization-denial','spending-limit','partial-execution'];
const ROLES=Object.freeze({engineering:{department:'technology',authority:'implement-and-test'},independentQA:{department:'quality-risk',authority:'independent-acceptance'},engineeringAuditor:{department:'quality-risk',authority:'security-veto-and-owner-escalation',activeModelExecution:false},chief:{authority:'coordinate-within-backend-grant',model:'gpt-6.1-sol',reasoning:'medium',canOverrideAcceptance:false}});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function canonical(p){if(typeof p!=='string'||!p||p.length>300||/[\\\x00-\x1f:]|(^|\/)\.\.?(\/|$)|^\//.test(p))throw Error('Invalid repository path');return p;}
function classify(paths){
 if(!Array.isArray(paths)||!paths.length)throw Error('Change paths required');
 const domains=new Set();let rank=0;
 for(const raw of paths){const p=canonical(raw);let r=2,d='shared-backend';
  if(/^(docs\/|README\.md$|CALLERCORE_PROJECT_STATE\.md$)/.test(p)){r=0;d='documentation';}
  else if(/^tests\//.test(p)){r=1;d='verification';}
  else if(/^(lib\/|api\/|scripts\/|\.github\/|package.*\.json$|vercel\.json$)/.test(p)){r=2;
   if(/agent-operations|organization|chief-intent/.test(p))d='agent-autonomy';
   else if(/voice|telephony|twilio/.test(p))d='telephony';
   else if(/billing|stripe|checkout|plans|entitlement/.test(p))d='billing';
   else if(/auth|session|security|permission|origin|rate-limit/.test(p))d='security';
   else if(/\.github\/|package|vercel|engineering-quality/.test(p))d='infrastructure';
   else if(/account|customer|export|portal/.test(p))d='customer-data';
  }else if(/admin|dashboard|onboarding|login|checkout|billing|voice|portal/i.test(p)){r=2;d=/voice/i.test(p)?'telephony':/admin/i.test(p)?'admin-dashboard':'client-portal';}
  else if(/^(industries\/|assets\/|public\/)|\.(html|css|js|png|svg|jpg|webp)$/.test(p)){r=1;d='public-website';}
  rank=Math.max(rank,r);domains.add(d);
 }
 return {version:VERSION,risk:LEVELS[rank],domains:[...domains].sort(),requirements:rank===0?['scope-review']:rank===1?['risk-analysis','targeted-tests','independent-qa','preview-check']:['risk-analysis','threat-model','targeted-tests','full-regression','independent-qa','engineering-auditor','negative-paths','rollback-plan','ci','codeql','preview-check']};
}
function validatePlan(plan,changeDigest,classification){
 const fail=m=>{throw Error(m);};
 if(!plan||plan.version!==VERSION||plan.changeDigest!==changeDigest)fail('Missing or stale change-bound plan');
 if(!LEVELS.includes(plan.risk)||LEVELS.indexOf(plan.risk)<LEVELS.indexOf(classification.risk))fail('Risk downgrade denied');
 const rank=LEVELS.indexOf(plan.risk),nonempty=x=>typeof x==='string'&&x.trim().length>=12&&x.length<=4000;
 if(!nonempty(plan.scope))fail('Scope required');
 const required=classify([rank===2?'api/policy.js':'index.html']).requirements;
 if(rank>0&&(!nonempty(plan.riskAnalysis)||!Array.isArray(plan.verification)||!required.every(k=>plan.verification.includes(k))))fail('Risk analysis and required verification plan missing');
 if(rank===2){
  if(!plan.threatModel||!['assets','trustBoundaries','abuseCases','mitigations'].every(k=>nonempty(plan.threatModel[k]))||!nonempty(plan.rollback))fail('Threat model and rollback required');
  if(!plan.negativePaths||!NEGATIVE_PATHS.every(k=>nonempty(plan.negativePaths[k])))fail('All negative paths require a test or justified not-applicable rationale');
 }
 // Defect declarations are reviewable evidence, never automatically invented by the model.
 if(!Array.isArray(plan.defects))fail('Explicit defect list required');
 for(const d of plan.defects)if(!['rootCause','detectionGap','regression','historicalPrevention'].every(k=>nonempty(d[k])))fail('Incomplete defect prevention record');
 return {valid:true,risk:plan.risk,implementationPermission:false,paidPermission:false};
}
function acceptance({digest,implementationId,qa,auditor,risk='critical'}={}){
 if(!/^[a-f0-9]{64}$/.test(digest||'')||!LEVELS.includes(risk)||typeof implementationId!=='string'||!implementationId)return {accepted:false,reason:'invalid-binding'};
 const valid=(r,role)=>r?.role===role&&r.changeDigest===digest&&r.decision==='passed'&&typeof r.executionId==='string'&&r.executionId.length>0&&r.executionId!==implementationId&&typeof r.evidenceRef==='string'&&r.evidenceRef.length>0;
 if(!valid(qa,'independentQA'))return {accepted:false,reason:'independent-qa-required'};
 if(risk==='critical'&&(!valid(auditor,'engineeringAuditor')||auditor.executionId===qa.executionId))return {accepted:false,reason:'independent-auditor-required'};
 return {accepted:true,requiresTrustedEvidenceStore:true,executionPermission:false};
}
function readiness(records,digest){
 if(!/^[a-f0-9]{64}$/.test(digest||''))throw Error('Invalid readiness binding');
 return Object.fromEntries(DIMENSIONS.map(d=>{const r=records?.[d];return[d,r?.digest===digest&&r.status==='passed'&&typeof r.evidenceRef==='string'&&r.evidenceRef.length>0?'verified':'unverified'];}));
}
function anomalies(snapshot,now=Date.now()){
 // Strict bounded counters only: no task text, provider errors, credentials or payloads in output.
 const alerts=[],num=x=>Number.isSafeInteger(x)&&x>=0,add=(code,severity)=>alerts.push({code,severity});
 if(!snapshot||!num(now)||!num(snapshot.at)||snapshot.at>now||now-snapshot.at>300000){add('telemetry-unavailable','critical');return alerts;}
 for(const k of ['failed','rejected','apiFailures','running','stalled','retainedMicros','pendingMicros','limitMicros','spendDeltaMicros','expectedSpendMicros'])if(!num(snapshot[k])){add('telemetry-invalid','critical');return alerts;}
 if(snapshot.limitMicros<1||snapshot.pendingMicros>snapshot.retainedMicros||snapshot.stalled>snapshot.running){add('telemetry-invalid','critical');return alerts;}
 if(snapshot.retainedMicros>=snapshot.limitMicros)add('budget-exhausted','critical');
 else if(BigInt(snapshot.retainedMicros)*10n>=BigInt(snapshot.limitMicros)*9n)add('budget-near-limit','warning');
 if(snapshot.spendDeltaMicros>snapshot.expectedSpendMicros)add('unexpected-spending','critical');
 if(snapshot.pendingMicros>0)add('uncertain-costs','warning');
 if(snapshot.failed>0)add('agent-failure','warning');
 if(snapshot.stalled>0)add('task-stall','critical');
 if(snapshot.rejected>0)add('rejected-work','warning');
 if(snapshot.apiFailures>0)add('external-api-failure','warning');
 if(!snapshot.dependencies||!['storage','broker','previewIdentity','provider'].every(k=>['healthy','unavailable','unknown'].includes(snapshot.dependencies[k])))add('dependency-telemetry-invalid','critical');
 else for(const k of ['storage','broker','previewIdentity','provider'])if(snapshot.dependencies[k]!=='healthy')add('dependency-'+k,'critical');
 return alerts;
}
module.exports={VERSION,LEVELS,DIMENSIONS,NEGATIVE_PATHS,ROLES,hash,canonical,classify,validatePlan,acceptance,readiness,anomalies};
