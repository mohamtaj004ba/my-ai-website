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
// Multi-file preparation is deliberately separate from the historical one-file
// executor. It accepts server-supplied source/scope data, never filesystem paths
// or execution authority. Existing validate/apply callers remain unchanged.
const BUNDLE_VERSION='draft-proposal-bundle-v1';
const BUNDLE_PATHS=['dashboard.js','lib/conversation-history.js'];
function validateBundle(value,context){
 check(exact(context,['binding','files'])&&Array.isArray(context.files)&&context.files.length===2,'DRAFT_BUNDLE_CONTEXT');
 check(exact(value,['version','binding','files'])&&value.version===BUNDLE_VERSION&&Array.isArray(value.files)&&value.files.length===2,'DRAFT_BUNDLE_CONTRACT');
 check(exact(context.binding,['ownerHash','workspaceHash','taskId','executionId','sourceCommit','deploymentId','origin','releaseHash','contextHash']),'DRAFT_BUNDLE_BINDING');
 const {executionId,...binding}=context.binding;
 check(/^[A-Za-z0-9_-]{1,100}$/.test(executionId||'')&&exact(value.binding,Object.keys(context.binding))&&Object.keys(context.binding).every(k=>context.binding[k]===value.binding[k]),'DRAFT_BUNDLE_BINDING');
 let total=0;
 for(let i=0;i<2;i++){
  const source=context.files[i],file=value.files[i];
  check(exact(source,['path','text','sha256','sites'])&&source.path===BUNDLE_PATHS[i]&&typeof source.text==='string'&&Buffer.byteLength(source.text)<=700000&&hash(source.text)===source.sha256&&Array.isArray(source.sites)&&source.sites.length===(i===0?4:1),'DRAFT_BUNDLE_SOURCE');
  check(exact(file,['path','preimageSha256','edits'])&&file.path===source.path&&file.preimageSha256===source.sha256&&Array.isArray(file.edits)&&file.edits.length===source.sites.length,'DRAFT_BUNDLE_SCOPE');
  // Reuse the existing edit, binding, Unicode, overlap and preimage validator.
  // Its dashboard path is internal metadata only; bundle paths stay separately
  // authenticated above and are never passed to a filesystem writer.
  const local={version:VERSION,path:'dashboard.js',sourceSha:binding.sourceCommit,preimageSha256:source.sha256,binding,edits:file.edits};
  // Historical executor supports three edits. Validate each independently, then
  // enforce total ordering/overlap for this four-predicate data-only bundle.
  let end=0;
  const seen=new Set();
  for(const edit of file.edits){
   validate({...local,edits:[edit]});
   check(edit.offset>=end&&source.text.indexOf(edit.before)===edit.offset&&source.text.lastIndexOf(edit.before)===edit.offset,'DRAFT_BUNDLE_PREIMAGE');
   const site=source.sites.find(s=>exact(s,['id','before'])&&s.before===edit.before);
   check(site&&!seen.has(site.id),'DRAFT_BUNDLE_SCOPE');seen.add(site.id);
   check(!/[\u202a-\u202e\u2066-\u2069]/u.test(edit.after),'DRAFT_BUNDLE_ENCODING');
   end=edit.offset+edit.before.length;total+=Buffer.byteLength(JSON.stringify(edit));
  }
 }
 check(total<=16000,'DRAFT_BUNDLE_BOUNDS');return structuredClone(value);
}
function applyBundle(value,context){
 const checked=validateBundle(value,context),files=checked.files.map((file,i)=>{
  const source=context.files[i];let text='',cursor=0;
  for(const edit of file.edits){text+=source.text.slice(cursor,edit.offset)+edit.after;cursor=edit.offset+edit.before.length;}
  text+=source.text.slice(cursor);check(Buffer.byteLength(text)<=700000,'DRAFT_BUNDLE_BOUNDS');
  return{path:file.path,text,beforeSha256:source.sha256,afterSha256:hash(text)};
 });
 return{version:BUNDLE_VERSION,proposalHash:hash(checked),binding:checked.binding,files,executionAuthorized:false,publicationAllowed:false};
}
module.exports={VERSION,validate,apply,patch,hash,BUNDLE_VERSION,validateBundle,applyBundle};
