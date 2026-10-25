'use strict';
// Owner/Work-attested external rejection evidence. No provider I/O or execution authority.
const p=require('./agent-operations-engineering-provider-v2'),{isDeepStrictEqual:equal}=require('node:util');
const VERSION='owner-attested-configuration-rejection-v1',check=(v)=>{if(!v)throw Error('ENG_CONFIG_REJECTION_PROOF');},hex=x=>/^[a-f0-9]{64}$/.test(x||''),exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&equal(Object.keys(x).sort(),k.slice().sort());
function requestHash(r){return p.hash({requestBody:{name:'my-ai-website',project:r.scope.projectId,deploymentId:r.originalRuntime.deploymentId,target:'preview',meta:{callercoreConfigurationIntent:r.id,callercoreSourceCommit:r.sourceCommit}},teamId:r.scope.teamId});}
// Exact minimal redeploy envelope also observed receiving the same HTTP 400.
// Preserve the historical hash; never infer a different request from a receipt.
function minimalRequestHash(r){return p.hash({teamId:r.scope.teamId,requestBody:{name:'my-ai-website',deploymentId:r.originalRuntime.deploymentId,target:'preview'}});}
function validate(r,x){
 check(exact(x,['version','intentId','intentHash','cancellationHash','eventsHash','identity','scope','sourceCommit','originalRuntime','proof','review','reviewRuntime','at','executionAuthorized','fundingAuthority','qualification','hash']));
 const {hash,...body}=x,q=x.proof,events=r.events;
 check(x.version===VERSION&&r.status==='cancelled'&&x.intentId===r.id&&x.intentHash===r.intentHash&&x.cancellationHash===r.cancellation?.hash&&x.eventsHash===p.hash(events)&&equal(x.identity,r.identity)&&equal(x.scope,r.scope)&&x.sourceCommit===r.sourceCommit&&equal(x.originalRuntime,r.originalRuntime));
 check(events.length===18&&events.at(-2).step==='deploy'&&events.at(-2).phase==='dispatch'&&events.at(-1).step==='deploy'&&events.at(-1).phase==='unknown'&&events.slice(0,-2).every((e,i)=>e.phase===(i%2?'acknowledged':'dispatch')));
 check(exact(q,['classification','status','code','operation','requestId','requestHash','evidenceHash','providerMetadataHash','observedAt'])&&q.classification==='invalid-preview-rest-target'&&q.status===400&&q.code==='bad_request'&&q.operation==='POST /v13/deployments'&&/^[A-Za-z0-9:_-]{1,160}$/.test(q.requestId||'')&&[requestHash(r),minimalRequestHash(r)].includes(q.requestHash)&&hex(q.evidenceHash)&&hex(q.providerMetadataHash)&&Number.isSafeInteger(q.observedAt)&&q.observedAt>=events.at(-2).at&&q.observedAt<=x.at);
 const v=x.review,u=x.reviewRuntime;check(exact(v,['workQaHash','workAuditorHash','sourceCommit','releaseHash'])&&hex(v.workQaHash)&&hex(v.workAuditorHash)&&v.workQaHash!==v.workAuditorHash&&u?.environment==='preview'&&u.branch===r.scope.branch&&/^[a-f0-9]{40}$/.test(u.commit||'')&&/^dpl_[A-Za-z0-9]+$/.test(u.deploymentId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(u.origin||'')&&u.release?.version==='organization-contracts-v4'&&hex(u.release.digest)&&v.sourceCommit===u.commit&&v.releaseHash===u.release.digest);
 check(Number.isSafeInteger(x.at)&&x.at>=r.cancellation.at&&x.executionAuthorized===false&&x.fundingAuthority===false&&x.qualification==='Authenticated owner/Work attestation of external HTTP rejection; not cryptographic provider proof, independent human acceptance or authority to execute.'&&hash===p.hash(body));return true;
}
function append(r,input,now,runtime){
 check(exact(input,['id','intentHash','cancellationHash','eventsHash','proof','review'])&&input.id===r.id&&input.intentHash===r.intentHash&&input.cancellationHash===r.cancellation?.hash&&input.eventsHash===p.hash(r.events));
 if(r.rejectionReconciliation){validate(r,r.rejectionReconciliation);check(equal(r.rejectionReconciliation.proof,input.proof)&&equal(r.rejectionReconciliation.review,input.review)&&equal(r.rejectionReconciliation.reviewRuntime,runtime));return{receipt:r.rejectionReconciliation,appended:false};}
 const body={version:VERSION,intentId:r.id,intentHash:r.intentHash,cancellationHash:r.cancellation.hash,eventsHash:p.hash(r.events),identity:structuredClone(r.identity),scope:structuredClone(r.scope),sourceCommit:r.sourceCommit,originalRuntime:structuredClone(r.originalRuntime),proof:structuredClone(input.proof),review:structuredClone(input.review),reviewRuntime:structuredClone(runtime),at:now,executionAuthorized:false,fundingAuthority:false,qualification:'Authenticated owner/Work attestation of external HTTP rejection; not cryptographic provider proof, independent human acceptance or authority to execute.'};
 const receipt={...body,hash:p.hash(body)};validate(r,receipt);r.rejectionReconciliation=receipt;return{receipt,appended:true};
}
module.exports={VERSION,requestHash,minimalRequestHash,validate,append};
