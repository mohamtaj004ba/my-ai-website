'use strict';
// Disposable filesystem for trusted patch-data only, NOT an untrusted-code sandbox.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const tools=require('../lib/agent-operations-engineering-tools');
const CHILD=require.resolve('./agent-operations-draft-child.cjs');
const correction=require('../lib/agent-operations-draft-correction');
const CORRECTION=require.resolve('../lib/agent-operations-draft-correction');
const proposed=require('../lib/agent-operations-draft-proposal'),PROPOSED=require.resolve('../lib/agent-operations-draft-proposal');
const SOURCE_LOCK=require('../lib/agent-operations-engineering-source-lock.json');
const MARKER='\n<!-- CallerCore isolated deterministic draft; not approved for publication. -->\n';
const QUALIFICATION='Fixed comment append only. Draft source is never executed. No untrusted-code sandbox, repository writer, shell, network adapter, commit, push or deployment executor.';
const CORRECTION_QUALIFICATION='Reviewed fixed local-calendar chart correction only. Draft source is never executed. No untrusted-code sandbox, repository writer, shell, network adapter, commit, push or deployment executor.';
const LIMITS=Object.freeze({maxFiles:3,maxBytes:200000,maxDurationMs:10000,maxOutputBytes:16000,maxOldSpaceMb:64,network:false,arbitraryCommands:false,externalCodeExecution:false,publication:false});
const CORRECTION_LIMITS=Object.freeze({...LIMITS,maxBytes:700000});
const PROPOSAL_LIMITS=Object.freeze({...CORRECTION_LIMITS,maxFiles:1,maxEdits:3});
const PROPOSAL_QUALIFICATION='Bounded proposed text replacements only. Draft source is never executed. No untrusted-code sandbox, repository writer, shell, network adapter, commit, push or deployment executor.';
const check=(v,c)=>{if(!v)throw Error(c);};
// Only the immutable approved Starter snapshot can supply a historical preimage.
// This is data provenance, not current-source admission or execution authority.
function historicalProposalSource(p){const taskSource=require('../lib/agent-operations-implementation-tasks').historicalSource(p?.preimageSha256);if(taskSource)return taskSource;if(p?.preimageSha256!==require('../lib/agent-operations-implementation-source-v1.json').sourceSha256)return null;const a=require('../lib/agent-operations-implementation').snapshot();return{manifest:a.manifest,text:a.text};}
function validateArtifact(result,{sourceSha,proposal,binding}={}){
 if(result?.version==='draft-data-v3'&&proposal?.version==='engineering-text-proposal-v1')return validateProposalArtifact(result,{sourceSha,proposal,binding});
 // Pure persisted-data validation. Caller still enforces authenticated task/release/fence binding.
 check(/^[a-f0-9]{40}$/.test(sourceSha||'')&&result&&result.sourceSha===sourceSha,'DRAFT_SOURCE_BINDING');
 const isProposal=result.version==='draft-data-v3';
 const keys=['version','files','patch','patchSha256','publicationAllowed','sourceSha','sourceManifestHash','repository','branch','limits','cleanup','classification','qualification',...(isProposal?['proposal','binding']:[])];
 check(Object.keys(result).length===keys.length&&keys.every(k=>Object.hasOwn(result,k)),'DRAFT_RESULT_INVALID');
 const isCorrection=result.version==='draft-data-v2';
 if(isProposal){proposed.validate(proposal);check(tools.hash(result.proposal)===tools.hash(proposal)&&tools.hash(result.binding)===tools.hash(proposal.binding)&&proposal.sourceSha===sourceSha,'DRAFT_PROPOSAL_BINDING');}
 const historical=isProposal?historicalProposalSource(proposal):null,sourceLock=historical?.manifest||SOURCE_LOCK;const source=sourceLock.files.find(f=>f.path===(isCorrection||isProposal?'dashboard.js':'dashboard.html'));
 const html=isCorrection||isProposal?null:tools.readFile('dashboard.html');if(html!==null)check(tools.hash(html)===source.sha256&&Buffer.byteLength(html)===source.bytes,'DRAFT_SOURCE_DRIFT');
 const expectedAfter=html===null?null:tools.hash(html+MARKER);
 const patch={path:'dashboard.html',operation:'append-fixed-html-comment',beforeSha256:source.sha256,afterSha256:expectedAfter,addedText:MARKER};
 const text=isCorrection||isProposal?(historical?.text||tools.readFile('dashboard.js')):null,expectedPatch=isProposal?proposed.patch(text,proposal):isCorrection?correction.patch(text):patch;
 const afterHash=isCorrection||isProposal?expectedPatch.afterSha256:expectedAfter;
 const file={path:isCorrection||isProposal?'dashboard.js':'dashboard.html',beforeSha256:source.sha256,afterSha256:afterHash,beforeBytes:source.bytes,afterBytes:isProposal?Buffer.byteLength(proposed.apply(text,proposal)):isCorrection?Buffer.byteLength(correction.apply(text)):source.bytes+Buffer.byteLength(MARKER)};
 check(['draft-data-v1','draft-data-v2','draft-data-v3'].includes(result.version)&&result.files?.length===1&&tools.hash(result.files[0])===tools.hash(file)&&tools.hash(result.patch)===tools.hash(expectedPatch)&&result.patchSha256===tools.hash(expectedPatch),'DRAFT_RESULT_INVALID');
 check(result.sourceManifestHash===tools.hash(sourceLock)&&result.repository==='mohamtaj004ba/my-ai-website'&&result.branch==='feature/callercore-dashboards','DRAFT_SOURCE_BINDING');
 check(result.publicationAllowed===false&&tools.hash(result.limits)===tools.hash(isProposal?PROPOSAL_LIMITS:isCorrection?CORRECTION_LIMITS:LIMITS)&&tools.hash(result.cleanup)===tools.hash({destroyed:true})&&result.classification==='real-disposable-filesystem-trusted-data-only'&&result.qualification===(isProposal?PROPOSAL_QUALIFICATION:isCorrection?CORRECTION_QUALIFICATION:QUALIFICATION),'DRAFT_AUTHORITY_DENIED');
 return true;
}
async function prepareInternal(options={}){
 const {sourceSha,expectedSourceSha,signal,timeoutMs=10000,delayMs=0,profile=null,proposal=null}=options;
 check(/^[a-f0-9]{40}$/.test(sourceSha||'')&&sourceSha===expectedSourceSha,'DRAFT_SOURCE_BINDING');
 check(Object.keys(options).every(k=>['sourceSha','expectedSourceSha','signal','timeoutMs','delayMs','profile','proposal'].includes(k)),'DRAFT_INPUT_DENIED');
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000&&Number.isInteger(delayMs)&&delayMs>=0&&delayMs<=10000,'DRAFT_LIMITS');
 check(profile===null||profile===correction.PROFILE,'DRAFT_INPUT_DENIED');
 if(proposal){proposed.validate(proposal);check(profile===null&&proposal.sourceSha===sourceSha,'DRAFT_PROPOSAL_BINDING');}
 check(!signal?.aborted,'DRAFT_CANCELLED');
 const filename=profile||proposal?'dashboard.js':'dashboard.html',limits=proposal?PROPOSAL_LIMITS:profile?CORRECTION_LIMITS:LIMITS;
 const historical=proposal?historicalProposalSource(proposal):null,current=tools.inspect(tools.PROFILE),authoritativeHash=tools.hash(tools.readFile(filename)),inspected=historical?{...current,manifest:historical.manifest,manifestHash:tools.hash(historical.manifest)}:current,text=historical?.text||tools.readFile(filename),expected=inspected.manifest.files.find(x=>x.path===filename);
 check(tools.hash(text)===expected.sha256,'DRAFT_SOURCE_DRIFT');check(Buffer.byteLength(text)+100<=limits.maxBytes,'DRAFT_BOUNDS');
 if(proposal)proposed.apply(text,proposal);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),proposal?'callercore-proposed-'+process.pid+'-':profile?'callercore-correction-':'callercore-draft-'+process.pid+'-'));let result,error;
 try{
  fs.writeFileSync(path.join(directory,filename),text,{flag:'wx',mode:0o600});
  result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--max-old-space-size=64','--permission',`--allow-fs-read=${CHILD}`,`--allow-fs-read=${CORRECTION}`,`--allow-fs-read=${PROPOSED}`,`--allow-fs-read=${directory}`,`--allow-fs-write=${directory}`,CHILD],{cwd:directory,env:{},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='',bytes=0,reason=null;
   const stop=c=>{reason=reason||c;child.kill();};
   const abort=()=>stop('DRAFT_CANCELLED'),timer=setTimeout(()=>stop('DRAFT_TIMEOUT'),timeoutMs);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
   child.stdout.on('data',b=>{bytes+=b.length;if(bytes>LIMITS.maxOutputBytes)stop('DRAFT_OUTPUT_BOUNDS');else output+=b.toString('utf8');});
   child.stderr.on('data',b=>{bytes+=b.length;if(bytes>LIMITS.maxOutputBytes)stop('DRAFT_OUTPUT_BOUNDS');});
   child.on('error',()=>{reason=reason||'DRAFT_START_FAILED';});
   child.stdin.on('error',()=>{});
   child.on('close',code=>{finish();if(reason||code!==0)return reject(Error(reason||'DRAFT_CHILD_DENIED'));try{resolve(JSON.parse(output));}catch{reject(Error('DRAFT_RESULT_INVALID'));}});
   child.stdin.end(JSON.stringify({version:proposal?'draft-data-v3':profile?'draft-data-v2':'draft-data-v1',profile,...(proposal?{proposal}:{}),files:[{path:filename,sha256:expected.sha256}],delayMs}));
  });
  const after=fs.readFileSync(path.join(directory,filename));
  check(result.files?.length===1&&result.files[0].beforeSha256===expected.sha256&&result.files[0].afterSha256===tools.hash(after.toString('utf8'))&&result.patchSha256===tools.hash(result.patch)&&result.publicationAllowed===false,'DRAFT_RESULT_INVALID');
 }catch(e){error=e;}finally{
  try{fs.rmSync(directory,{recursive:true,force:true,maxRetries:2});}catch{throw Object.assign(Error('DRAFT_CLEANUP_FAILED'),{cleanupConfirmed:false});}
  check(!fs.existsSync(directory),'DRAFT_CLEANUP_FAILED');
  check(tools.hash(tools.readFile(filename))===authoritativeHash,'DRAFT_AUTHORITATIVE_SOURCE_CHANGED');
 }
 if(error)throw Object.assign(error,{cleanupConfirmed:true});
 const artifact={...result,sourceSha,sourceManifestHash:inspected.manifestHash,repository:inspected.repository,branch:inspected.branch,limits,cleanup:{destroyed:true},classification:'real-disposable-filesystem-trusted-data-only',qualification:proposal?PROPOSAL_QUALIFICATION:profile?CORRECTION_QUALIFICATION:QUALIFICATION,...(proposal?{proposal,binding:proposal.binding}:{})};
 validateArtifact(artifact,{sourceSha,proposal});return artifact;
}
async function prepare(options={}){check(!Object.hasOwn(options,'proposal'),'DRAFT_INPUT_DENIED');return prepareInternal(options);}
function normalizeProposal(proposal,binding,sourceSha){
 const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');
 check(exact(proposal,['version','path','beforeSha256','edits'])&&proposal.version==='engineering-text-proposal-v1'&&proposal.path==='dashboard.js'&&Array.isArray(proposal.edits)&&proposal.edits.length>=1&&proposal.edits.length<=3,'DRAFT_PROPOSAL_DENIED');
 check(exact(binding,['planId','taskId','executionId','fence','ownerHash','workspaceHash','runtime'])&&['planId','taskId','executionId'].every(k=>/^[A-Za-z0-9_-]{1,170}$/.test(binding[k]||''))&&Number.isSafeInteger(binding.fence)&&binding.fence>=0&&binding.runtime?.sourceCommit===sourceSha&&binding.runtime.branch==='feature/callercore-dashboards','DRAFT_PROPOSAL_BINDING');
 check(exact(binding.runtime,['deploymentId','origin','sourceCommit','branch','release'])&&exact(binding.runtime.release,['version','digest'])&&binding.runtime.release.version==='organization-contracts-v4','DRAFT_PROPOSAL_BINDING');
 const historical=historicalProposalSource({preimageSha256:proposal.beforeSha256}),text=historical?.text||tools.readFile('dashboard.js'),normalized={version:proposed.VERSION,path:'dashboard.js',sourceSha,preimageSha256:proposal.beforeSha256,binding:{ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,taskId:binding.taskId,sourceCommit:sourceSha,deploymentId:binding.runtime.deploymentId,origin:binding.runtime.origin,releaseHash:binding.runtime.release.digest,contextHash:tools.hash(binding)},edits:proposal.edits.map(e=>{check(exact(e,['beforeText','afterText'])&&typeof e.beforeText==='string','DRAFT_PROPOSAL_EDIT');return{offset:text.indexOf(e.beforeText),before:e.beforeText,after:e.afterText,beforeSha256:tools.hash(e.beforeText)};})};proposed.apply(text,normalized);return normalized;
}
function validateProposalArtifact(result,{sourceSha,proposal,binding}={}){
 const normalized=normalizeProposal(proposal,binding,sourceSha);check(tools.hash(result?.proposal)===tools.hash(proposal)&&tools.hash(result?.binding)===tools.hash(binding),'DRAFT_PROPOSAL_BINDING');return validateArtifact({...result,proposal:normalized,binding:normalized.binding},{sourceSha,proposal:normalized});
}
async function prepareProposal(options={}){
 const {proposal,binding,authorize,sourceSha,expectedSourceSha,signal,timeoutMs=10000,delayMs=0,authorityTimeoutMs=null}=options;
 check(Object.keys(options).every(k=>['proposal','binding','authorize','sourceSha','expectedSourceSha','signal','timeoutMs','delayMs','authorityTimeoutMs'].includes(k))&&typeof authorize==='function','DRAFT_PROPOSAL_AUTHORITY_REQUIRED');
 check(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000,'DRAFT_LIMITS');const original=structuredClone(proposal),context=structuredClone(binding),captured=normalizeProposal(original,context,sourceSha);check(sourceSha===expectedSourceSha,'DRAFT_SOURCE_BINDING');
 if(authorityTimeoutMs!==null){
  check(Number.isSafeInteger(authorityTimeoutMs)&&authorityTimeoutMs>0&&authorityTimeoutMs<=30000&&signal instanceof AbortSignal,'DRAFT_LIMITS');
  // The caller's ORIGINAL stage/task signal remains authoritative. Remote
  // bookkeeping gets separate finite windows; the child's limit is unchanged.
  const controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal]);let active,phase='before-authority',authorityTimer;
  const authority=async stage=>{phase=stage+'-authority';check(!combined.aborted,'DRAFT_CANCELLED');let timer,aborted;try{return await Promise.race([Promise.resolve().then(()=>authorize(stage,structuredClone(context),combined)),new Promise((_,reject)=>{aborted=()=>reject(Error(authorityTimer?'DRAFT_AUTHORITY_TIMEOUT':'DRAFT_CANCELLED'));combined.addEventListener('abort',aborted,{once:true});timer=setTimeout(()=>{authorityTimer=true;controller.abort();},authorityTimeoutMs);})]);}finally{clearTimeout(timer);if(aborted)combined.removeEventListener('abort',aborted);}};
  const work=async()=>{check(await authority('before')===true,'DRAFT_PROPOSAL_AUTHORITY_DENIED');check(!combined.aborted,'DRAFT_CANCELLED');phase='worker';active=prepareInternal({sourceSha,expectedSourceSha,signal:combined,timeoutMs,delayMs,proposal:captured});const prepared=await active;check(await authority('after')===true,'DRAFT_PROPOSAL_AUTHORITY_DENIED');check(!combined.aborted,'DRAFT_CANCELLED');phase='artifact-validation';const artifact={...prepared,proposal:original,binding:context};validateProposalArtifact(artifact,{sourceSha,proposal:original,binding:context});return artifact;};
  let abort;
  try{return await Promise.race([work(),new Promise((_,reject)=>{abort=()=>reject(Error(authorityTimer?'DRAFT_AUTHORITY_TIMEOUT':'DRAFT_CANCELLED'));if(combined.aborted)abort();else combined.addEventListener('abort',abort,{once:true});})]);}
  catch(error){controller.abort();if(active)try{await active;}catch(childError){if(childError.cleanupConfirmed!==true)throw Object.assign(Error('DRAFT_CLEANUP_FAILED'),{cleanupConfirmed:false,draftPhase:phase});}throw Object.assign(error,{cleanupConfirmed:true,draftPhase:phase});}
  finally{if(abort)combined.removeEventListener('abort',abort);controller.abort();}
 }
 const c=new AbortController(),combined=signal?AbortSignal.any([signal,c.signal]):c.signal,timer=setTimeout(()=>c.abort(),timeoutMs);let listener,active;
 const work=async()=>{check(!combined.aborted,'DRAFT_CANCELLED');check(await authorize('before',structuredClone(context),combined)===true,'DRAFT_PROPOSAL_AUTHORITY_DENIED');check(!combined.aborted,'DRAFT_CANCELLED');active=prepareInternal({sourceSha,expectedSourceSha,signal:combined,timeoutMs,delayMs,proposal:captured});const prepared=await active;check(await authorize('after',structuredClone(context),combined)===true,'DRAFT_PROPOSAL_AUTHORITY_DENIED');check(!combined.aborted,'DRAFT_CANCELLED');const artifact={...prepared,proposal:original,binding:context};validateProposalArtifact(artifact,{sourceSha,proposal:original,binding:context});return artifact;};
 try{return await Promise.race([work(),new Promise((_,reject)=>{listener=()=>reject(Error('DRAFT_CANCELLED'));if(combined.aborted)listener();else combined.addEventListener('abort',listener,{once:true});})]);}catch(error){if(active)try{await active;}catch(workerError){if(workerError.cleanupConfirmed!==true)throw Object.assign(Error('DRAFT_CLEANUP_FAILED'),{cleanupConfirmed:false});}throw Object.assign(error,{cleanupConfirmed:true});}finally{clearTimeout(timer);if(listener)combined.removeEventListener('abort',listener);c.abort();}
}
// Inactive two-file task preparation: same restricted data worker, no source
// execution and no controller/grant registration. Source is always captured by
// the fixed server-owned phone task, never supplied by a model.
async function prepareBundle(options={}){
 check(Object.keys(options).every(k=>['proposal','binding','authorize','signal','timeoutMs','authorityTimeoutMs'].includes(k))&&typeof options.authorize==='function','DRAFT_PROPOSAL_AUTHORITY_REQUIRED');
 const {authorize,signal,timeoutMs=10000,authorityTimeoutMs=30000}=options,proposal=structuredClone(options.proposal),binding=structuredClone(options.binding),phone=require('../lib/agent-operations-phone-search'),context=phone.context(binding);
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000&&Number.isInteger(authorityTimeoutMs)&&authorityTimeoutMs>0&&authorityTimeoutMs<=30000,'DRAFT_LIMITS');
 const expected=phone.apply(proposal,context),summary=expected.files.map(({path:filename,text,beforeSha256,afterSha256})=>({path:filename,beforeSha256,afterSha256,afterBytes:Buffer.byteLength(text)}));
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
 let directory=null,child,closed,abort,timer,expired=false;
 const stop=()=>{if(child)child.kill();};combined.addEventListener('abort',stop,{once:true});
 const cancellation=new Promise((_,reject)=>{abort=()=>reject(Error(expired?'DRAFT_TIMEOUT':'DRAFT_CANCELLED'));if(combined.aborted)abort();else combined.addEventListener('abort',abort,{once:true});});
 // Preserve the repaired separation between remote bookkeeping windows and
 // the short local data-worker deadline. An enclosing task signal still wins.
 const arm=ms=>{clearTimeout(timer);timer=setTimeout(()=>{expired=true;controller.abort();},ms);};arm(authorityTimeoutMs);
 async function work(){
  check(!combined.aborted,'DRAFT_CANCELLED');check(await authorize('before',structuredClone(binding),combined)===true,'DRAFT_PROPOSAL_AUTHORITY_DENIED');check(!combined.aborted,'DRAFT_CANCELLED');
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'callercore-proposed-bundle-'));fs.mkdirSync(path.join(directory,'lib'));
  for(const f of context.files)fs.writeFileSync(path.join(directory,f.path),f.text,{flag:'wx',mode:0o600});
  arm(timeoutMs);
  const receipt=await new Promise((resolve,reject)=>{
   child=spawn(process.execPath,['--max-old-space-size=64','--permission',`--allow-fs-read=${CHILD}`,`--allow-fs-read=${PROPOSED}`,`--allow-fs-read=${directory}`,`--allow-fs-write=${directory}`,CHILD],{cwd:directory,env:{},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='',diagnostic='',bytes=0,tooLarge=false;closed=new Promise(done=>child.once('close',done));
   child.on('error',()=>reject(Error('DRAFT_CHILD_DENIED')));
   for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{bytes+=b.length;if(bytes>LIMITS.maxOutputBytes){tooLarge=true;child.kill();}else if(stream===child.stdout)output+=b.toString('utf8');else diagnostic+=b.toString('utf8');});
   child.on('close',code=>{if(code!==0||tooLarge)return reject(Error(tooLarge?'DRAFT_OUTPUT_BOUNDS':diagnostic==='DRAFT_BUNDLE_SYNTAX'?'DRAFT_BUNDLE_SYNTAX':'DRAFT_CHILD_DENIED'));try{resolve(JSON.parse(output));}catch{reject(Error('DRAFT_RESULT_INVALID'));}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({version:'draft-data-bundle-v1',binding,files:context.files.map(({path:filename,sha256,sites})=>({path:filename,sha256,sites})),proposal}));
   if(combined.aborted)child.kill();
  });
  check(!combined.aborted,'DRAFT_CANCELLED');arm(authorityTimeoutMs);check(await authorize('after',structuredClone(binding),combined)===true,'DRAFT_PROPOSAL_AUTHORITY_DENIED');check(!combined.aborted,'DRAFT_CANCELLED');
  check(tools.hash(receipt)===tools.hash({version:'draft-data-bundle-v1',proposalHash:expected.proposalHash,files:summary,publicationAllowed:false,sourceExecuted:false,syntaxValidated:true}),'DRAFT_RESULT_INVALID');
  return{...receipt,binding,cleanup:{destroyed:true},classification:'real-disposable-filesystem-trusted-data-only',executionAuthorized:false};
 }
 try{return await Promise.race([work(),cancellation]);}
 finally{
  clearTimeout(timer);combined.removeEventListener('abort',abort);combined.removeEventListener('abort',stop);controller.abort();if(child)child.kill();if(closed)await closed;
  if(directory){try{fs.rmSync(directory,{recursive:true,force:true});check(!fs.existsSync(directory),'DRAFT_CLEANUP_FAILED');}catch{throw Object.assign(Error('DRAFT_CLEANUP_FAILED'),{cleanupConfirmed:false});}}
 }
}
module.exports={prepare,prepareProposal,prepareBundle,validateArtifact,validateProposalArtifact,LIMITS};
