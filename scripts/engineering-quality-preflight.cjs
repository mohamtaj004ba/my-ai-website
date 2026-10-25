'use strict';
// No shell interpolation, no plan-provided commands, no network or model dispatch.
const {execFileSync,spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const policy=require('../lib/engineering-quality'),root=path.resolve(__dirname,'..');
const BASELINE='edc7a89d43d807012b796e470d8fb80d187739ba',PROACTIVE_BASELINE='68d19669a149e873f6ff9d5a6dad8bfe1d4d3e22';
// One preserved documentation checkpoint omitted its plan. Recover that exact
// historical evidence, never a general exception for missing or stale plans.
const DOCUMENT_RECOVERY=Object.freeze({commit:'7934a97c860a025c37e09ea1c3532c698143bc0d',digest:'02a29c98b569773d511e48ce29b9f37aaddce2a04f68d5e38faeb8b6ae5159ae',path:'CALLERCORE_PROJECT_STATE.md',plan:'docs/engineering-changes/stripe-verified-checkpoint-recovery.json'});
function recoverDocumentation(commit,entries,records,{mode,load}={}){
 if(commit!==DOCUMENT_RECOVERY.commit||entries.length!==1||entries[0].path!==DOCUMENT_RECOVERY.path||digestEntries(entries)!==DOCUMENT_RECOVERY.digest||records.some(p=>p.changeDigest===DOCUMENT_RECOVERY.digest))return records;
 if(typeof mode!=='function'||typeof load!=='function'||mode('parent',DOCUMENT_RECOVERY.path)!=='100644'||mode('commit',DOCUMENT_RECOVERY.path)!=='100644'||mode('head',DOCUMENT_RECOVERY.plan)!=='100644')throw Error('Historical documentation recovery requires exact regular files');
 const supplement=load(DOCUMENT_RECOVERY.plan);if(supplement?.historicalCommit!==commit||supplement.changeDigest!==DOCUMENT_RECOVERY.digest||supplement.risk!=='routine')throw Error('Historical documentation recovery binding denied');
 return [...records,supplement];
}
// Exact reviewed recovery for two preserved commits whose plans were omitted.
// No caller-controlled registry and no fallback for other missing plans.
const REVIEWED_CHECKPOINTS=Object.freeze([
 {commit:'9f2e51f063c9a3ff9d7e8f9c5c24a6cda13ba7cb',digest:'03477e2283b07677c1cb5e75657b5e63be36ed03da89a0f0d73061bfb10aece9',risk:'routine',plan:'docs/engineering-changes/live-schema-checkpoint-recovery.json',planHash:'4c414c0cd4cacffaaad57c7ad8542e28da2fa6e64d8d15e833234be0a7103bd8',paths:['CALLERCORE_PROJECT_STATE.md']},
 {commit:'7d58c89041a1dcf79282d3fac85fdcfda3f4db35',digest:'83704e98e41595bd88de83b14b6842fc6ab06444758c0d11d0c53f0ee593a4cc',risk:'critical',plan:'docs/engineering-changes/trial-journal-source-recovery.json',planHash:'c30b89f2c2a5b3958e94cce4b55df13580b71bca8a0cb402ea87c35df7cf3906',paths:['CALLERCORE_PROJECT_STATE.md','agent-operations-command-center.js','lib/agent-operations-contract-lock.json','tests/agent-operations-call-row-contract.test.js','tests/agent-operations-fresh-execution-ui.test.js']}
]);
function recoverReviewedCheckpoint(commit,entries,records,{mode,load}={}){
 const pin=REVIEWED_CHECKPOINTS.find(x=>x.commit===commit);if(!pin||digestEntries(entries)!==pin.digest||records.some(p=>p.changeDigest===pin.digest))return records;
 if(JSON.stringify(entries.map(e=>e.path).sort())!==JSON.stringify(pin.paths.slice().sort())||typeof mode!=='function'||typeof load!=='function')throw Error('Reviewed checkpoint scope denied');
 for(const e of entries){const parent=mode('parent',e.path),current=mode('commit',e.path);if((e.oldBlob==='deleted'?parent!=='':parent!=='100644')||current!=='100644')throw Error('Reviewed checkpoint requires exact regular files');}
 if(mode('head',pin.plan)!=='100644')throw Error('Reviewed checkpoint requires exact regular files');
 const supplement=load(pin.plan);if(supplement?.historicalCommit!==pin.commit||supplement.changeDigest!==pin.digest||supplement.risk!==pin.risk||policy.hash(supplement)!==pin.planHash)throw Error('Reviewed checkpoint binding denied');
 return [...records,supplement]; // The caller still runs unchanged full plan/proactive validation.
}
function git(args){return execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});}
function recordPath(p){return /^docs\/engineering-changes\/[a-z0-9-]+\.json$/.test(p);}
// Cache only immutable JSON bytes during one scan, never a validation result.
function planReader(readGit){
 const blobs=new Map();
 return ref=>readGit(['ls-tree','-rz',ref,'--','docs/engineering-changes']).split('\0').filter(Boolean).flatMap(line=>{
  const entry=/^(\d+) ([a-z]+) ([a-f0-9]{40})\t(.+)$/.exec(line);if(!entry)throw Error('Invalid engineering plan tree entry');
  const [,mode,type,oid,file]=entry;if(!recordPath(file))return[];
  if(mode!=='100644'||type!=='blob')throw Error('Engineering plans must be regular JSON files');
  if(!blobs.has(oid))blobs.set(oid,JSON.parse(readGit(['cat-file','blob',oid])));
  return[structuredClone(blobs.get(oid))];
 });
}
function digestEntries(entries){return policy.hash(entries.sort((a,b)=>a.path.localeCompare(b.path,'en')));}
function treeBlob(ref,p){const out=git(['ls-tree','-z',ref,'--',p]).split('\0').filter(Boolean);if(!out.length)return 'deleted';if(out.length!==1||!/^\d+ blob [a-f0-9]+\t/.test(out[0]))throw Error('Unsupported or ambiguous tree entry');return out[0].split('\t')[0].split(' ')[2];}
function changes(base,head){
 const names=git(['diff','--no-renames','--name-only','-z',base,head,'--']).split('\0').filter(Boolean);
 return names.filter(p=>!recordPath(p)).map(p=>{policy.canonical(p);return{path:p,oldBlob:treeBlob(base,p),blob:treeBlob(head,p)};});
}
function check(entries,records,{proactive=false}={}){
 if(!entries.length)return {skipped:'records-only-or-empty'};
 const digest=digestEntries(entries),classification=policy.classify(entries.map(x=>x.path));
 const plans=records.filter(p=>p.changeDigest===digest);
 if(plans.length!==1)throw Error('Exactly one matching engineering change plan required: '+digest);
 policy.validatePlan(plans[0],digest,classification);if(proactive&&classification.risk==='critical')policy.validateProactive(plans[0]);
 return {digest,...classification,planRisk:plans[0].risk,verified:'plan-and-source-binding',liveVerified:false};
}
function working(){
 const names=[...new Set([...git(['diff','--no-renames','--name-only','-z','HEAD','--']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')].filter(Boolean))];
 const entries=names.filter(p=>!recordPath(p)).map(p=>{policy.canonical(p);const f=path.join(root,p),oldBlob=treeBlob('HEAD',p);if(!fs.existsSync(f))return{path:p,oldBlob,blob:'deleted'};if(!fs.lstatSync(f).isFile())throw Error('Non-file change denied');return{path:p,oldBlob,blob:git(['hash-object','--path='+p,f]).trim()};});
 return {entries,digest:digestEntries(entries),classification:entries.length?policy.classify(entries.map(x=>x.path)):null};
}
function committed(base,head='HEAD'){
 if(git(['status','--porcelain','--untracked-files=all']).trim())throw Error('Dirty worktree: inspect --working and commit reviewed changes before preflight');
 git(['merge-base','--is-ancestor',BASELINE,head]);
 if(!base||/^0+$/.test(base))base=BASELINE;
 // Initial adoption excludes already verified history, never future commits.
 try{git(['merge-base','--is-ancestor',base,BASELINE]);base=BASELINE;}catch{git(['merge-base','--is-ancestor',base,head]);}
 const commits=git(['rev-list','--reverse',base+'..'+head]).trim().split('\n').filter(Boolean),results=[],readPlans=planReader(git);
 for(const commit of commits){
  const parents=git(['rev-list','--parents','-n','1',commit]).trim().split(' ').slice(1);
  if(parents.length!==1)throw Error('Merge commits require explicit review; linear feature history required');
  const entries=changes(parents[0],commit),historical=readPlans(commit),refs={parent:parents[0],commit,head};
  const options={mode:(kind,p)=>git(['ls-tree',refs[kind],'--',p]).split(' ')[0],load:p=>JSON.parse(git(['show',head+':'+p]))};
  const records=recoverReviewedCheckpoint(commit,entries,recoverDocumentation(commit,entries,historical,options),options);
  let proactive=false;try{git(['merge-base','--is-ancestor',PROACTIVE_BASELINE,commit]);proactive=commit!==PROACTIVE_BASELINE;}catch{}results.push({commit,...check(entries,records,{proactive})});
 }
 return results;
}
if(require.main===module){try{
 const args=process.argv.slice(2);
 if(args.includes('--working')){console.log(JSON.stringify(working(),null,2));}
 else{
  const i=args.indexOf('--base'),base=i>=0?args[i+1]:process.env.QUALITY_BASE;
  if(!base)throw Error('Explicit --base required; no silent empty diff');
  const results=committed(base);
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^OPENAI_|^CALLERCORE_|^VERCEL_/i.test(k)));
  const t=spawnSync(process.execPath,['--require',path.join(root,'tests/helpers/agent-operations-offline-only.cjs'),'--test',path.join(root,'tests/engineering-quality.test.js'),path.join(root,'tests/engineering-quality-security-review.test.js'),path.join(root,'tests/engineering-proactive-review.test.js')],{cwd:root,env,stdio:'inherit',windowsHide:true});
  if(t.status!==0)throw Error('Engineering policy regressions failed');
  console.log(JSON.stringify({engineeringPreflight:'passed',version:policy.VERSION,results,paidPermission:false,writePermission:false,acceptanceNotInferred:true}));
 }
}catch(e){console.error('Engineering preflight blocked: '+e.message);process.exitCode=1;}}
module.exports={recoverReviewedCheckpoint,BASELINE,recordPath,digestEntries,check,working,committed,recoverDocumentation,planReader};
