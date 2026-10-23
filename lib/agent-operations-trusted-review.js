'use strict';
// Authenticated evidence review is a separate record, never task acceptance or execution authority.
const {createHash,randomUUID}=require('node:crypto');
const equal=require('node:util').isDeepStrictEqual;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const identity=x=>createHash('sha256').update(String(x)).digest('hex');
const VERSION='owner-evidence-review-v1';
const check=(x,m)=>{if(!x)throw Error(m);};
const text=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&equal(Object.keys(x).sort(),keys.slice().sort());
function createTrustedReview(adapter,{runtime,clock=Date.now,assertReviewer}={}){
 check(adapter&&typeof adapter.read==='function'&&typeof adapter.compare==='function'&&typeof assertReviewer==='function','Trusted reviewer policy required');
 function context(){check(runtime?.environment==='preview'&&/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(runtime.origin||'')&&/^[a-f0-9]{40}$/.test(runtime.commit||''),'Preview review runtime required');return{origin:runtime.origin,sourceCommit:runtime.commit,release:require('./agent-operations-contracts').assertRelease()};}
 function parse(raw){const s=JSON.parse(raw);check(s?.version===1&&Number.isSafeInteger(s.revision)&&s.revision>=0&&Array.isArray(s.tasks)&&Array.isArray(s.reservations)&&s.operations?.version===1&&['workflows','grants','reservations','audit'].every(k=>Array.isArray(s.operations[k])),'Review ledger malformed');check(s.operations.trustedReviews===undefined||Array.isArray(s.operations.trustedReviews),'Review registry malformed');return s;}
 function snapshot(s,id,ctx){
  const w=s.operations.workflows.find(w=>w.id===id);check(w&&w.stage==='outcome'&&['verified','rejected'].includes(w.status)&&w.outcomes?.execution==='completed'&&Number.isSafeInteger(w.revision),'Terminal workflow required');
  const chief=w.results?.chiefReview;check(chief&&chief.authoritativeBinding&&chief.executionId,'Historical Chief report required');
  const projected=structuredClone(w);projected.stage='chief_review';projected.outcomes.execution='qa-completed';
  const p=require('./agent-operations-final-report').build(projected,{version:chief.contractVersion}),{authoritativeBinding,executionId,...report}=chief;
  check(equal(authoritativeBinding,p.binding)&&equal(report,p.report),'Historical evidence binding inconsistent');
  check(typeof w.contractVersion==='string'&&/^[a-f0-9]{64}$/.test(w.contractHash||''),'Historical release required');
  const grant=s.operations.grants.find(g=>g.id===w.grantId);check(grant&&/^[a-f0-9]{64}$/.test(grant.issuerHash||''),'Historical owner binding required');
  const approval=s.operations.approvals?.find(a=>a.id===w.approvalId);const originalRuntime=w.executionRuntime||((approval?.sourceCommit&&approval?.deploymentOrigin)?{origin:approval.deploymentOrigin,sourceCommit:approval.sourceCommit}:null);
  const binding={version:VERSION,workflowId:w.id,originalExecutionRuntime:originalRuntime,originalWorkspaceId:w.workspaceId||null,taskRevision:w.revision,taskHash:hash(w),originalSource:w.scope.commit,originalRelease:{version:w.contractVersion,digest:w.contractHash},ownerHash:grant.issuerHash,evidenceHash:w.evidence.hash,findingsHash:w.results.specialist.findingsHash,observationHash:w.results.observation.hash,qaHash:w.results.qa.hash,acceptanceHash:hash(w.results.acceptance),chiefHash:hash(chief),reviewRuntime:ctx};
  return{w,binding,bindingHash:hash(binding),projection:p};
 }
 async function authorize(actor,w,operation,binding){const p=await assertReviewer(actor,structuredClone(w),operation,{ownerHash:binding.ownerHash,originalWorkspaceId:w.workspaceId||null});check(p&&p.role==='workspace-owner'&&text(p.id,320)&&text(p.workspaceId,200),'Verified reviewer identity required');const reviewerHash=identity(p.id),known=Array.isArray(w.reviewImplementerHashes)&&w.reviewImplementerHashes.length>0&&w.reviewImplementerHashes.every(x=>/^[a-f0-9]{64}$/.test(x));check(operation!=='attest'||!known||!w.reviewImplementerHashes.includes(reviewerHash),'Reviewer self-review denied');return{reviewerHash,reviewerRole:p.role,workspaceHash:identity(p.workspaceId),independence: p.independenceVerified===true&&known&&!w.reviewImplementerHashes.includes(reviewerHash)?'verified':'unverified'};}
 function records(s){const r=s.operations.trustedReviews||[];check(r.length<=32&&r.every(x=>{const {hash:stored,...body}=x;return stored===hash(body);}), 'Review record integrity failure');return r;}
 function output(record){return structuredClone(record);}
 async function readBundle(actor,input){check(exact(input,['workflowId'])&&/^wf_[A-Za-z0-9_-]{1,80}$/.test(input.workflowId),'Invalid review request');const s=parse(await adapter.read()),v=snapshot(s,input.workflowId,context()),p=await authorize(actor,v.w,'read',v.binding);const r=records(s);return{version:VERSION,workflowId:v.w.id,expectedRevision:s.revision,bindingHash:v.bindingHash,binding:v.binding,evidence:structuredClone(v.w.evidence),findings:structuredClone(v.w.results.specialist.findings),observations:structuredClone(v.w.results.observation),qa:structuredClone(v.w.results.qa),acceptance:structuredClone(v.w.results.acceptance),chiefReport:structuredClone(v.projection.report),independence:p.independence,acceptedWork:false,reviews:r.filter(r=>r.workflowId===v.w.id).map(output)};}
 async function attest(actor,input){
  check(exact(input,['workflowId','expectedRevision','bindingHash','idempotencyKey','decisions','reason','inspectedEvidenceHashes'])&&/^wf_[A-Za-z0-9_-]{1,80}$/.test(input.workflowId)&&Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0&&/^[a-f0-9]{64}$/.test(input.bindingHash||'')&&/^[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey||'')&&text(input.reason,1000),'Invalid attestation');
  for(let attempt=0;attempt<5;attempt++){
   const raw=await adapter.read(),s=parse(raw),v=snapshot(s,input.workflowId,context()),p=await authorize(actor,v.w,'attest',v.binding),r=records(s);
   const now=clock();check(Number.isSafeInteger(now)&&now>=0,'Review clock invalid');check(!s.operations.workflows.some(w=>(w.mode==='pilot'||w.rehearsal)&&!['verified','rejected','failed','blocked','cancelled'].includes(w.status)&&w.deadline>now),'Review write denied during active execution');check(v.bindingHash===input.bindingHash,'Stale review binding');check(Array.isArray(input.inspectedEvidenceHashes)&&equal(input.inspectedEvidenceHashes,v.w.evidence.images.map(im=>im.sha256)),'Declared inspected evidence mismatch');
   const findings=v.projection.report.findings,images=new Set(v.w.evidence.images.map(i=>i.id));
   check(Array.isArray(input.decisions)&&input.decisions.length===findings.length&&new Set(input.decisions.map(d=>d.code)).size===findings.length&&input.decisions.every(d=>exact(d,['code','decision','reason','evidence'])&&findings.some(f=>f.code===d.code)&&['accept','reject','unresolved'].includes(d.decision)&&text(d.reason,1000)&&Array.isArray(d.evidence)&&d.evidence.length>=1&&d.evidence.length<=4&&new Set(d.evidence).size===d.evidence.length&&d.evidence.every(i=>images.has(i)&&findings.find(f=>f.code===d.code).imageId===i)),'Invalid evidence-linked reviewer decisions');
   const key=hash({workflowId:v.w.id,reviewer:p.reviewerHash,workspace:p.workspaceHash,key:input.idempotencyKey}),payloadHash=hash(input),existing=r.find(x=>x.idempotencyHash===key);
   if(existing){check(existing.payloadHash===payloadHash&&existing.bindingHash===v.bindingHash,'Attestation replay mismatch');return output(existing);}
   check(s.revision===input.expectedRevision,'Stale review revision');check(r.length<32&&s.operations.audit.length<600,'Review capacity exhausted');
   const record={version:VERSION,id:'review_'+randomUUID(),kind:'owner-evidence-review',workflowId:v.w.id,at:now,reviewerHash:p.reviewerHash,reviewerRole:p.reviewerRole,workspaceHash:p.workspaceHash,independence:p.independence,humanInspection:'not-established-by-authentication',declaredInspectedEvidenceHashes:[...input.inspectedEvidenceHashes],inspectionBasis:'browser-hash-verified-files-declared-by-reviewer-not-proof-of-human-inspection',acceptedWork:false,operationalAuthority:false,binding:v.binding,bindingHash:v.bindingHash,idempotencyHash:key,clientKey:input.idempotencyKey,payloadHash,reason:input.reason,decisions:input.decisions.map(d=>({...structuredClone(d),originalQaDisposition:findings.find(f=>f.code===d.code).qaDisposition}))};record.hash=hash(record);
   s.operations.trustedReviews??=[];s.operations.trustedReviews.push(record);
   const a={sequence:s.operations.audit.length+1,at:now,actor:'trusted-reviewer',actorHash:p.reviewerHash,type:'owner_evidence_review_recorded',workflowId:v.w.id,reviewId:record.id,reviewHash:record.hash,previousHash:s.operations.audit.at(-1)?.hash||null};a.hash=hash(a);s.operations.audit.push(a);s.revision++;
   const next=JSON.stringify(s);if(await adapter.compare(raw,next))return output(record);
  }throw Error('Concurrent review update');
 }
 return{readBundle,attest};
}
function createOwnerReviewPolicy({getSession,getMember,getWorkspace,request}){return async(actor,workflow,operation,authority,{onPhase}={})=>{
 const captured={kind:actor?.kind,verifiedOwner:actor?.verifiedOwner,id:actor?.id,workspaceId:actor?.workspaceId},ownerHash=authority?.ownerHash,hint=authority?.originalWorkspaceId;
 check(captured.kind==='owner'&&captured.verifiedOwner===true&&typeof captured.id==='string','Reviewer session denied');
 const mark=phase=>{try{if(typeof onPhase==='function')onPhase(phase);}catch{}},unchanged=()=>check(equal(captured,{kind:actor?.kind,verifiedOwner:actor?.verifiedOwner,id:actor?.id,workspaceId:actor?.workspaceId})&&ownerHash===authority?.ownerHash&&hint===authority?.originalWorkspaceId,'Reviewer workspace ownership denied');
 let session,member,workspace;
 if(typeof hint==='string'&&hint.length>0){
  // These are fresh reads of a known bound workspace, not cached authority.
  // No result or ownership proof is exposed before every check succeeds.
  const pending=new Set(['owner-session-pending','owner-member-pending','owner-workspace-pending']);mark('owner-identity-reads');
  const observed=async(phase,read)=>{const value=await read();pending.delete(phase);if(pending.size===1)mark([...pending][0]);return value;};
  [session,member,workspace]=await Promise.all([observed('owner-session-pending',()=>getSession(request)),observed('owner-member-pending',()=>getMember(captured.id)),observed('owner-workspace-pending',()=>getWorkspace(hint))]);
 }else{mark('owner-session-pending');session=await getSession(request);check(session&&!session.adminView&&String(session.email).trim().toLowerCase()===captured.id,'Reviewer session denied');mark('owner-identity-reads');[member,workspace]=await Promise.all([getMember(captured.id),getWorkspace(session.workspaceId)]);}
 mark('owner-identity-validation');unchanged();check(session&&!session.adminView&&String(session.email).trim().toLowerCase()===captured.id,'Reviewer session denied');
 check(member&&!member.disabled&&member.role==='admin'&&member.workspaceId===session.workspaceId&&String(member.email||session.email).trim().toLowerCase()===captured.id&&String(workspace?.ownerEmail||'').trim().toLowerCase()===captured.id&&identity(captured.id)===ownerHash&&(!hint||hint===session.workspaceId),'Reviewer workspace ownership denied');
 return{id:captured.id,workspaceId:session.workspaceId,role:'workspace-owner',independenceVerified:false};
};}
module.exports={VERSION,createTrustedReview,createOwnerReviewPolicy};
