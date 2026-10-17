'use strict';
// Text-data contract only. Proposed JavaScript is never loaded or executed.
const {createHash}=require('node:crypto');
const VERSION='draft-proposal-v3',check=(x,c)=>{if(!x)throw Error(c);};
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
function validate(p){
 check(exact(p,['version','path','sourceSha','preimageSha256','binding','edits'])&&p.version===VERSION&&p.path==='dashboard.js'&&/^[a-f0-9]{40}$/.test(p.sourceSha||'')&&/^[a-f0-9]{64}$/.test(p.preimageSha256||''),'DRAFT_PROPOSAL_DENIED');
 const b=p.binding;check(exact(b,['ownerHash','workspaceHash','taskId','sourceCommit','deploymentId','origin','releaseHash','contextHash'])&&[b.ownerHash,b.workspaceHash,b.releaseHash,b.contextHash].every(x=>/^[a-f0-9]{64}$/.test(x||''))&&b.sourceCommit===p.sourceSha&&/^dpl_[A-Za-z0-9]{1,100}$/.test(b.deploymentId||'')&&/^[A-Za-z0-9_-]{1,100}$/.test(b.taskId||'')&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(b.origin||''),'DRAFT_PROPOSAL_BINDING');
 check(Array.isArray(p.edits)&&p.edits.length>=1&&p.edits.length<=3&&Buffer.byteLength(JSON.stringify(p.edits))<=12000,'DRAFT_PROPOSAL_BOUNDS');
 let end=0;for(const e of p.edits){check(exact(e,['offset','before','after','beforeSha256'])&&Number.isSafeInteger(e.offset)&&e.offset>=end&&typeof e.before==='string'&&e.before.length>0&&Buffer.byteLength(e.before)<=2048&&typeof e.after==='string'&&Buffer.byteLength(e.after)<=2048&&e.before!==e.after&&e.beforeSha256===hash(e.before),'DRAFT_PROPOSAL_EDIT');check(!/[\u0000\ud800-\udfff]/u.test(e.before+e.after),'DRAFT_PROPOSAL_ENCODING');end=e.offset+e.before.length;}
 return p;
}
function apply(text,p){validate(p);check(Buffer.byteLength(text)<=700000&&hash(text)===p.preimageSha256,'DRAFT_PREIMAGE');let out='',cursor=0;for(const e of p.edits){check(text.indexOf(e.before)===e.offset&&text.lastIndexOf(e.before)===e.offset&&text.slice(e.offset,e.offset+e.before.length)===e.before,'DRAFT_PROPOSAL_PREIMAGE');out+=text.slice(cursor,e.offset)+e.after;cursor=e.offset+e.before.length;}out+=text.slice(cursor);check(Buffer.byteLength(out)<=700000,'DRAFT_BOUNDS');return out;}
function patch(text,p){const after=apply(text,p);return{path:p.path,operation:'bounded-proposed-text-replacements',proposalHash:hash(p),beforeSha256:hash(text),afterSha256:hash(after),edits:structuredClone(p.edits)};}
module.exports={VERSION,validate,apply,patch,hash};
