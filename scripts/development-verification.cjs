'use strict';
// Source-derived selection only. No execution permissions or reusable security attestations.
const fs=require('node:fs'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),quality=require('../lib/engineering-quality'),pin=require('./preview-release-pin.cjs');
const VERSION='development-verification-v1',SHA=/^[a-f0-9]{40}$/;
const styles=new Set(['industries.css','industry-refinement.css','industry-platform.css','industry-pages.css','home-motion.css','hero-film.css','homepage-imagery.css','dashboard-showcase.css']);
// Audited literal-only declarations. Any edit (including an added import on the
// same line) invalidates this exception and escalates its referenced dependency.
const nameOnlyLines=Object.freeze({'scripts/development-verification.cjs':'4386fa3b16aabc4100ca32df8cdb003358ee7e6fa577baf9ec34be127dc46bca','scripts/preview-release-pin.cjs':'d5c034df711399822ffa94ad9a3480f2cfe2369cd32a204285915c6dbe926538','lib/agent-operations-chief-context.js':'5e8fd4b4d06e654a4b507e80a03821ef05500be70eea473ae95f8c06a5bd5900'});
const publicPage=p=>p==='index.html'||/^industries\/[a-z-]+\.html$/.test(p);
const presentationTests=['asset-links.test.js','ui-structure.test.js','syntax.test.js','public-premium.test.js','public-experience.test.js','industry-experience.test.js'];
const strictRequirements=['full-regression','contracts','engineering','redis','codeql','full-browser','independent-qa','engineering-auditor'];
function classify(entries,{protectedConsumer=()=>true,pages=[]}={}){
 if(!Array.isArray(entries)||!entries.length)throw Error('Actual nonempty change set required');
 const paths=entries.map(e=>quality.canonical(e.path));if(new Set(paths).size!==paths.length)throw Error('Duplicate change path');
 let lane='FAST',docsOnly=true;const affected=new Set();
 for(const e of entries){
  if([e.mode,e.beforeMode].some(mode=>mode&&!['100644','deleted'].includes(mode)))return{lane:'STRICT',docsOnly:false,pages:[],reason:'nonregular-or-executable-file'};
  if(protectedConsumer(e.path))return{lane:'STRICT',docsOnly:false,pages:[],reason:'protected-dependency'};
  if(pin.documentation(e.path))continue;
  docsOnly=false;
  if(quality.classify([e.path]).risk==='critical')return{lane:'STRICT',docsOnly:false,pages:[],reason:'protected-or-shared-source'};
  const text=[e.before||'',e.after||''].join('\n');
  if(styles.has(e.path)){
   if(/\\|@import|url\s*\(|expression\s*\(|javascript:|behavior\s*:|image(?:-set)?\s*\(|paint\s*\(|https?:|\/\//i.test(text))return{lane:'STRICT',docsOnly:false,pages:[],reason:'active-style-dependency'};
   const consumers=pages.filter(p=>p.text.includes(e.path));if(!consumers.length)return{lane:'STRICT',docsOnly:false,pages:[],reason:'unmapped-presentation'};
   for(const p of consumers)affected.add(p.path);
  }else if(publicPage(e.path)){
   if(/<(?:script|iframe|form|link|object|embed|base|style)\b|<meta[^>]+http-equiv|\b(?:on\w+|href|src|srcdoc|action|style)\s*=|javascript:|https?:|\/\/|fetch\s*\(|XMLHttpRequest|\b(?:require|import)\s*\(|\/api\/|stripe|authorization|credential/i.test(text))return{lane:'STRICT',docsOnly:false,pages:[],reason:'executable-or-integration-page'};
   lane='STANDARD';affected.add(e.path);
  }else return{lane:'STRICT',docsOnly:false,pages:[],reason:'unknown-source'};
 }
 return{lane,docsOnly,pages:[...affected].sort(),reason:docsOnly?'nonruntime-documentation':'mapped-presentation'};
}
function git(args){return execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});}
function plan(base,head='HEAD',repository=root){
 const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
 if(!SHA.test(base)||head!=='HEAD'&&!SHA.test(head))throw Error('Explicit complete base SHA required');head=git(['rev-parse','--verify',head+'^{commit}']).trim();
 if(!SHA.test(head))throw Error('Invalid head');git(['merge-base','--is-ancestor',base,head]);
 if(git(['status','--porcelain','--untracked-files=all']).trim())throw Error('Commit reviewed changes before verification selection');
 const names=git(['diff','--no-renames','--name-only','-z',base,head,'--']).split('\0').filter(Boolean);
 if(!names.length)throw Error('Actual nonempty change set required');names.forEach(quality.canonical);
 const finish=selection=>({version:VERSION,base,head,tree:git(['rev-parse',head+'^{tree}']).trim(),paths:names,...selection,browser:selection.docsOnly?'identity':selection.lane==='STRICT'?'full':'affected',required:selection.lane==='STRICT'?strictRequirements:['targeted-tests','engineering','exact-preview-identity',...(selection.docsOnly?[]:['affected-browser','independent-qa'])],paidPermission:false});
 // STRICT is already maximal; no body/dependency scan can select a lower lane.
 if(names.some(p=>quality.classify([p]).risk==='critical'||p.startsWith('tests/')))return finish({lane:'STRICT',docsOnly:false,pages:[],reason:'protected-or-shared-source'});
 const mode=(ref,p)=>git(['ls-tree',ref,'--',p]).split(' ')[0]||'deleted';
 const read=(ref,p)=>mode(ref,p)==='deleted'?'':git(['show',ref+':'+p]);
 const entries=names.map(p=>({path:p,before:read(base,p),after:read(head,p),beforeMode:mode(base,p),mode:mode(head,p)}));
 const protectedConsumer=p=>{
  // Inspect both trees. Fixed-string search is conservative, including transitive
  // consumers through protected shared modules and renamed/deleted references.
  for(const ref of [base,head]){try{const out=git(['grep','-I','-n','-F','-e',p,'-e',path.posix.basename(p),ref,'--',':(exclude)tests/**',':(exclude)docs/**',':(exclude)*.md']);
   // These exact audited allowlist declarations are names, not runtime imports.
   // Any other line, including a later import in either file, remains protected.
   const real=out.split('\n').filter(Boolean).filter(line=>{
    const file=line.split(':')[1];
    if(styles.has(p)&&publicPage(file))return false; // explicitly mapped presentation consumer
    return quality.hash(line.split(':').slice(3).join(':').replace(/\r$/,''))!==nameOnlyLines[file];
   });
   if(real.length)return true;}catch(error){if(error.status!==1)throw error;}}
  return false;
 };
 const pages=git(['ls-tree','-r','--name-only',head]).split('\n').filter(publicPage).map(p=>({path:p,text:read(head,p)}));
 const selection=classify(entries,{protectedConsumer,pages});
 return finish(selection);
}
function testsFor(p){
 const all=fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.js')).sort();
 const contracts=require('./agent-operations-contract-preflight.cjs').tests.map(f=>path.basename(f));
 if([...contracts,'engineering-quality.test.js','engineering-quality-security-review.test.js','engineering-proactive-review.test.js','development-verification.test.js'].some(n=>!all.includes(n)))throw Error('Mandatory contract or policy test missing from full suite');
 return p.lane==='STRICT'?all:[...new Set(['development-verification.test.js','engineering-quality.test.js','engineering-quality-security-review.test.js','engineering-proactive-review.test.js',...(p.docsOnly?['preview-release-pin.test.js']:presentationTests)])].sort();
}
function assertPlan(p,repository=root){const current=plan(p.base,'HEAD',repository);if(quality.hash(current)!==quality.hash(p))throw Error('Stale or altered verification selection');return current;}
function run(p){
 assertPlan(p);
 const release=require('../lib/agent-operations-contracts').assertRelease(),tests=testsFor(p),started=Date.now();
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^OPENAI_|^CALLERCORE_|^VERCEL_/i.test(k)));
 const engineering=require('./engineering-quality-preflight.cjs').committed(p.base);
 // Policy tests are in the selected union, not run a second time by this gate.
 const result=spawnSync(process.execPath,['--require',path.join(root,'tests/helpers/agent-operations-offline-only.cjs'),'--test','--test-concurrency=4',...tests.map(f=>path.join(root,'tests',f))],{cwd:root,env,stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error('Selected verification failed');
 if(JSON.stringify(release)!==JSON.stringify(require('../lib/agent-operations-contracts').assertRelease()))throw Error('Release changed during verification');
 assertPlan(p);
 const evidence={...p,tests:tests.length,elapsedMs:Date.now()-started,engineering,environment:{node:process.version,platform:process.platform,architecture:process.arch},contracts:p.lane==='STRICT'?'executed-in-full-suite':'not-required-unchanged',release,modelRequests:0,liveVerified:false};
 fs.mkdirSync(path.join(root,'artifacts/agent-operations'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/agent-operations/DEVELOPMENT_VERIFICATION.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
}
function main(args=process.argv.slice(2)){
 if(args.length!==3||!['--plan','--strict-plan','--run'].includes(args[0])||args[1]!=='--base')throw Error('Use --plan|--strict-plan|--run --base <verified SHA>');
 const p=plan(args[2]);if(args[0]==='--strict-plan')Object.assign(p,{lane:'STRICT',docsOnly:false,browser:'full',reason:'explicit-strict-reverification',required:strictRequirements});
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'lane='+p.lane+'\nbrowser='+p.browser+'\n');
 console.log(JSON.stringify(args[0]==='--run'?run(p):p));
}
if(require.main===module)try{main();}catch(e){console.error('Verification selection failed closed: '+e.message);process.exitCode=1;}
module.exports={VERSION,classify,plan,assertPlan,testsFor,run,main};
