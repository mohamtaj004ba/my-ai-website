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
  const records=recoverDocumentation(commit,entries,historical,{mode:(kind,p)=>git(['ls-tree',refs[kind],'--',p]).split(' ')[0],load:p=>JSON.parse(git(['show',head+':'+p]))});
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
module.exports={BASELINE,recordPath,digestEntries,check,working,committed,recoverDocumentation,planReader};
