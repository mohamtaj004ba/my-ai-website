'use strict';
// No shell interpolation, no plan-provided commands, no network or model dispatch.
const {execFileSync,spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const policy=require('../lib/engineering-quality'),root=path.resolve(__dirname,'..');
const BASELINE='edc7a89d43d807012b796e470d8fb80d187739ba';
function git(args){return execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});}
function recordPath(p){return /^docs\/engineering-changes\/[a-z0-9-]+\.json$/.test(p);}
function digestEntries(entries){return policy.hash(entries.sort((a,b)=>a.path.localeCompare(b.path,'en')));}
function treeBlob(ref,p){const out=git(['ls-tree','-z',ref,'--',p]).split('\0').filter(Boolean);if(!out.length)return 'deleted';if(out.length!==1||!/^\d+ blob [a-f0-9]+\t/.test(out[0]))throw Error('Unsupported or ambiguous tree entry');return out[0].split('\t')[0].split(' ')[2];}
function changes(base,head){
 const names=git(['diff','--no-renames','--name-only','-z',base,head,'--']).split('\0').filter(Boolean);
 return names.filter(p=>!recordPath(p)).map(p=>{policy.canonical(p);return{path:p,oldBlob:treeBlob(base,p),blob:treeBlob(head,p)};});
}
function check(entries,records){
 if(!entries.length)return {skipped:'records-only-or-empty'};
 const digest=digestEntries(entries),classification=policy.classify(entries.map(x=>x.path));
 const plans=records.filter(p=>p.changeDigest===digest);
 if(plans.length!==1)throw Error('Exactly one matching engineering change plan required: '+digest);
 policy.validatePlan(plans[0],digest,classification);
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
 const commits=git(['rev-list','--reverse',base+'..'+head]).trim().split('\n').filter(Boolean),results=[];
 for(const commit of commits){
  const parents=git(['rev-list','--parents','-n','1',commit]).trim().split(' ').slice(1);
  if(parents.length!==1)throw Error('Merge commits require explicit review; linear feature history required');
  const entries=changes(parents[0],commit),files=git(['ls-tree','-r','--name-only',commit,'--','docs/engineering-changes']).trim().split('\n').filter(recordPath);
  const records=files.map(p=>JSON.parse(git(['show',commit+':'+p])));
  results.push({commit,...check(entries,records)});
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
  const t=spawnSync(process.execPath,['--require',path.join(root,'tests/helpers/agent-operations-offline-only.cjs'),'--test',path.join(root,'tests/engineering-quality.test.js'),path.join(root,'tests/engineering-quality-security-review.test.js')],{cwd:root,env,stdio:'inherit',windowsHide:true});
  if(t.status!==0)throw Error('Engineering policy regressions failed');
  console.log(JSON.stringify({engineeringPreflight:'passed',version:policy.VERSION,results,paidPermission:false,writePermission:false,acceptanceNotInferred:true}));
 }
}catch(e){console.error('Engineering preflight blocked: '+e.message);process.exitCode=1;}}
module.exports={BASELINE,recordPath,digestEntries,check,working,committed};
