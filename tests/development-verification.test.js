'use strict';
// Independent source-selection adversarial tests. Git fixtures only: no network,
// provider transport, real deployment, selected-suite execution or credentials.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const verification=require('../scripts/development-verification.cjs');
const auditedStyleDeclaration=fs.readFileSync(path.join(__dirname,'../scripts/development-verification.cjs'),'utf8').split('\n').find(line=>line.startsWith('const styles=new Set('));
const auditedIgnoreDeclaration=fs.readFileSync(path.join(__dirname,'../scripts/vercel-ignore-docs.cjs'),'utf8').split('\n').find(line=>line.startsWith('const SHA='));
const entry=(p,before='old',after='new',extra={})=>({path:p,before,after,beforeMode:'100644',mode:'100644',...extra});
const classify=(entries,options={})=>verification.classify(entries,{protectedConsumer:()=>false,...options});
function fixture(initial){
 const tempRoot=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(tempRoot,'callercore-verification-qa-'));
 const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
 const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),text);};
 const commit=()=>{git(['add','--all']);git(['commit','-m','synthetic verification fixture']);return git(['rev-parse','HEAD']);};
 git(['init']);git(['config','user.name','Synthetic Verification QA']);git(['config','user.email','synthetic@example.test']);git(['config','core.autocrlf','false']);git(['config','core.filemode','false']);git(['config','core.symlinks','false']);
 for(const[file,text]of Object.entries(initial))write(file,text);const base=commit();
 return{dir,git,write,commit,base,clean(){const resolved=path.resolve(dir);assert(resolved.startsWith(tempRoot+path.sep)&&path.basename(resolved).startsWith('callercore-verification-qa-'));fs.rmSync(resolved,{recursive:true,force:true});}};
}
function withFixture(initial,fn){const f=fixture(initial);try{return fn(f);}finally{f.clean();}}
test('only explicit nonruntime documentation is FAST and never grants permissions',()=>{
 assert.equal(classify([entry('docs/notes.md')]).lane,'FAST');
 assert.equal(classify([entry('CALLERCORE_PROJECT_STATE.md')]).docsOnly,true);
 assert.equal(classify([entry('docs/custom-policy.json')]).lane,'STRICT');
});
test('mapped audited CSS is FAST; explicit static page is STANDARD',()=>{
 const pages=[{path:'index.html',text:'<link href="industries.css">'}];
 const css=classify([entry('industries.css','a { color:red }','a { color:blue }')],{pages});assert.equal(css.lane,'FAST');assert.equal(css.docsOnly,false);assert.deepEqual(css.pages,['index.html']);
 assert.equal(classify([entry('index.html','<p>Old</p>','<p>New</p>')]).lane,'STANDARD');
});
for(const text of ['@import "other.css";','a {background:url(image.png)}','a {width:expression(x)}','javascript:alert(1)','a {behavior: x}','a {background:image-set("a.png" 1x)}','a {background:paint(custom)}','a {content:"https://external.test"}','a {content:"//external.test"}','a {background:u\\72l(x)}'])test('active CSS escalates: '+text,()=>assert.equal(classify([entry('industries.css','',text)],{pages:[{path:'index.html',text:'industries.css'}]}).lane,'STRICT'));
for(const text of ['<script src="app.js">','<a onclick="x()">','<iframe>','<form>','fetch("x")','XMLHttpRequest','require("x")','import("x")','/api/task','stripe','authorization','credential','javascript:x','<link href="x.css">','<object data="x">','<embed src="x">','<base href="/">','<style>a{}</style>','<meta http-equiv="refresh">','https://external.test','//external.test'])test('executable/integration public page escalates: '+text,()=>assert.equal(classify([entry('index.html','',text)]).lane,'STRICT'));
for(const file of ['lib/auth.js','lib/agent-operations-organization.js','api/billing.js','scripts/development-verification.cjs','tests/security-hygiene.test.js','.github/workflows/callercore-ci.yml','package-lock.json','vercel.json','unknown.file'])test('protected or unknown file cannot be downgraded: '+file,()=>assert.equal(classify([entry(file)]).lane,'STRICT'));
for(const mode of ['100755','120000','160000'])test('executable/symlink/submodule source is STRICT: '+mode,()=>{
 assert.equal(classify([entry('docs/notes.md','x','y',{mode})]).lane,'STRICT');
 assert.equal(classify([entry('docs/notes.md','x','y',{beforeMode:mode})]).lane,'STRICT');
});
test('invalid or duplicate paths and empty change sets fail closed',()=>{
 for(const p of ['../notes.md','docs\\notes.md','/docs/notes.md','docs/a\0.md','C:/docs/notes.md'])assert.throws(()=>classify([entry(p)]));
 assert.throws(()=>classify([]));assert.throws(()=>classify([entry('docs/notes.md'),entry('docs/notes.md')]));
 assert.equal(classify([entry('docs/notes.md'),entry('lib/security.js')]).lane,'STRICT');
});
test('actual committed documentation plan is FAST with identity-only Browser requirement',()=>withFixture({'docs/notes.md':'old'},f=>{
 f.write('docs/notes.md','new');const head=f.commit(),p=verification.plan(f.base,head,f.dir);assert.equal(p.lane,'FAST');assert.equal(p.browser,'identity');assert.equal(p.paidPermission,false);assert.deepEqual(p.paths,['docs/notes.md']);assert(!p.required.includes('full-regression'));
}));
for(const target of ['docs/notes.md','industries.css'])test('runtime consumer in either Git tree prevents false FAST for '+target,()=>withFixture({[target]:'old','index.html':'<link href="industries.css">','root-runtime.js':'const dependency = "'+target+'";'},f=>{
 f.write(target,'new');f.commit();assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'STRICT');
 f.write('root-runtime.js','consumer removed');f.commit();assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'STRICT','Removed base-tree consumer must not disappear from risk review');
}));
test('an import added after an audited allowlist declaration is still a protected consumer',()=>withFixture({'industries.css':'a{}','index.html':'<link href="industries.css">','scripts/development-verification.cjs':auditedStyleDeclaration+'\nconst x=require("../industries.css");'},f=>{
 f.write('industries.css','b{}');f.commit();assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'STRICT');
}));
test('exact audited name declaration alone does not turn mapped CSS into a protected import',()=>withFixture({'industries.css':'a{}','index.html':'<link href="industries.css">','scripts/development-verification.cjs':auditedStyleDeclaration},f=>{
 f.write('industries.css','b{}');f.commit();assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'FAST');
}));
test('an unrecognized lookalike allowlist declaration is not excluded from protected consumers',()=>withFixture({'industries.css':'a{}','index.html':'<link href="industries.css">','scripts/development-verification.cjs':'const styles=new Set(["industries.css"]);'},f=>{
 f.write('industries.css','b{}');f.commit();assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'STRICT');
}));

test('exact audited deployment-ignore declaration permits canonical and FMEA documentation FAST identity only',()=>withFixture({'CALLERCORE_PROJECT_STATE.md':'old checkpoint','docs/AGENT_OPERATIONS_FAILURE_MODES.json':'{"version":1}','scripts/vercel-ignore-docs.cjs':auditedIgnoreDeclaration},f=>{
 f.write('CALLERCORE_PROJECT_STATE.md','new checkpoint');f.write('docs/AGENT_OPERATIONS_FAILURE_MODES.json','{"version":2}');f.commit();const p=verification.plan(f.base,'HEAD',f.dir);
 assert.equal(p.lane,'FAST');assert.equal(p.reason,'nonruntime-documentation');assert.equal(p.docsOnly,true);assert.equal(p.browser,'identity');assert.equal(p.paidPermission,false);assert.deepEqual(p.paths,['CALLERCORE_PROJECT_STATE.md','docs/AGENT_OPERATIONS_FAILURE_MODES.json']);assert(!p.required.includes('full-regression'));assert(!p.required.includes('codeql'));assert.deepEqual(verification.assertPlan(p,f.dir),p);
}));

for(const target of ['CALLERCORE_PROJECT_STATE.md','docs/AGENT_OPERATIONS_FAILURE_MODES.json'])for(const kind of ['different-line','same-line','modified-declaration'])test('deployment-ignore exception never hides '+kind+' consumer of '+target,()=>{
 const consumer='const operationalPolicy=require("../'+target+'");',declaration=kind==='different-line'?auditedIgnoreDeclaration+'\n'+consumer:kind==='same-line'?auditedIgnoreDeclaration+consumer:auditedIgnoreDeclaration.replace('const SHA=','const  SHA=');
 withFixture({[target]:'old','scripts/vercel-ignore-docs.cjs':declaration},f=>{f.write(target,'new');f.commit();const p=verification.plan(f.base,'HEAD',f.dir);assert.equal(p.lane,'STRICT');assert.equal(p.reason,'protected-dependency');assert.equal(p.browser,'full');assert(p.required.includes('full-regression'));assert(p.required.includes('codeql'));assert.equal(p.paidPermission,false);});
});

test('deployment-ignore import deleted from head cannot erase protected base-tree changes',()=>withFixture({'CALLERCORE_PROJECT_STATE.md':'old','scripts/vercel-ignore-docs.cjs':auditedIgnoreDeclaration+'\nconst policy=require("../CALLERCORE_PROJECT_STATE.md");'},f=>{
 f.write('scripts/vercel-ignore-docs.cjs',auditedIgnoreDeclaration);f.write('CALLERCORE_PROJECT_STATE.md','new');f.commit();const p=verification.plan(f.base,'HEAD',f.dir);assert.equal(p.lane,'STRICT');assert(p.paths.includes('scripts/vercel-ignore-docs.cjs'));assert.equal(p.browser,'full');assert(p.required.includes('full-regression'));
}));

test('audited deployment-ignore name line cannot authorize unknown JSON or shared-security changes',()=>{
 for(const target of ['docs/unrecognized-runtime-policy.json','lib/auth.js'])withFixture({'CALLERCORE_PROJECT_STATE.md':'old','scripts/vercel-ignore-docs.cjs':auditedIgnoreDeclaration,[target]:'old'},f=>{
  f.write('CALLERCORE_PROJECT_STATE.md','new');f.write(target,'new');f.commit();const p=verification.plan(f.base,'HEAD',f.dir);assert.equal(p.lane,'STRICT');assert.equal(p.docsOnly,false);assert.equal(p.browser,'full');assert(p.required.includes('full-regression'));assert(p.required.includes('codeql'));assert.equal(p.paidPermission,false);
 });
});
test('critical deletion and rename to documentation retain both sides of actual diff',()=>withFixture({'lib/security.js':'original executable'},f=>{
 fs.mkdirSync(path.join(f.dir,'docs'));f.git(['mv','lib/security.js','docs/security.md']);f.commit();const p=verification.plan(f.base,'HEAD',f.dir);assert.equal(p.lane,'STRICT');assert(p.paths.includes('lib/security.js'));assert(p.paths.includes('docs/security.md'));
}));
test('actual executable mode transition is STRICT even for documentation',()=>withFixture({'docs/notes.md':'text'},f=>{
 f.git(['update-index','--chmod=+x','docs/notes.md']);f.git(['commit','-m','synthetic executable-mode fixture']);assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'STRICT');
}));
test('dirty/untracked state, bad base, missing object, nonancestor, empty diff fail closed',()=>withFixture({'docs/notes.md':'initial'},f=>{
 assert.throws(()=>verification.plan('short','HEAD',f.dir));assert.throws(()=>verification.plan('0'.repeat(40),'HEAD',f.dir));
 f.write('docs/notes.md','changed');assert.throws(()=>verification.plan(f.base,'HEAD',f.dir));f.commit();
 f.write('untracked.txt','untracked');assert.throws(()=>verification.plan(f.base,'HEAD',f.dir));fs.unlinkSync(path.join(f.dir,'untracked.txt'));
 const head=f.git(['rev-parse','HEAD']);assert.throws(()=>verification.plan(head,head,f.dir));
 f.git(['checkout','--orphan','unrelated']);f.git(['rm','-rf','.']);f.write('docs/other.md','unrelated');const other=f.commit();assert.throws(()=>verification.plan(head,other,f.dir));
}));
test('STRICT executes every full-suite and mandatory contract test once, without importing an executable preflight',()=>{
 const selected=verification.testsFor({lane:'STRICT',docsOnly:false}),all=fs.readdirSync(path.join(__dirname)).filter(n=>n.endsWith('.test.js')).sort(),contracts=require('../scripts/agent-operations-contract-preflight.cjs').tests;
 assert.deepEqual(selected,all);assert.equal(selected.length,new Set(selected).size);for(const file of contracts)assert(selected.includes(path.basename(file)));
});
test('FAST/STANDARD include independent selection policy and appropriate targeted tests',()=>{
 const docs=verification.testsFor({lane:'FAST',docsOnly:true}),ui=verification.testsFor({lane:'STANDARD',docsOnly:false});assert(docs.includes('development-verification.test.js'));assert(docs.includes('preview-release-pin.test.js'));assert(ui.includes('asset-links.test.js'));assert(ui.includes('syntax.test.js'));assert.equal(docs.length,new Set(docs).size);assert.equal(ui.length,new Set(ui).size);
});
test('source-bound plan rejects altered lanes, coverage, source/config identity or permissions before suite execution',()=>withFixture({'docs/notes.md':'old'},f=>{
 f.write('docs/notes.md','new');f.commit();const p=verification.plan(f.base,'HEAD',f.dir);assert.deepEqual(verification.assertPlan(p,f.dir),p);
 for(const patch of [{lane:'STRICT'},{lane:'STANDARD'},{lane:'arbitrary'},{tree:'0'.repeat(40)},{head:f.base},{browser:'full'},{docsOnly:false},{required:[]},{paths:[]},{paidPermission:true},{version:'foreign'}])assert.throws(()=>verification.assertPlan({...p,...patch},f.dir),/Stale or altered/);
 f.write('package-lock.json','{"lockfileVersion":3}');f.commit();assert.throws(()=>verification.assertPlan(p,f.dir),/Stale or altered/);assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'STRICT');
}));
test('even a newer documentation-only checkpoint invalidates the prior exact plan',()=>withFixture({'docs/notes.md':'old'},f=>{
 f.write('docs/notes.md','new');f.commit();const p=verification.plan(f.base,'HEAD',f.dir);f.write('docs/notes.md','newer');f.commit();assert.throws(()=>verification.assertPlan(p,f.dir),/Stale or altered/);assert.equal(verification.plan(f.base,'HEAD',f.dir).lane,'FAST');
}));
test('mandatory STRICT CI, independent storage, scheduled security and explicit full Browser paths remain wired',()=>{
 const read=f=>fs.readFileSync(path.join(__dirname,'../.github/workflows',f),'utf8'),ci=read('callercore-ci.yml'),security=read('codeql.yml'),browser=read('preview-browser-qa.yml');
 assert.match(ci,/node scripts\/development-verification\.cjs --run --base/);assert.match(ci,/needs\.selection\.outputs\.lane == 'STRICT'/);assert.match(ci,/node --test tests\/agent-operations-redis\.integration\.cjs/);
 assert.match(security,/github\.event_name == 'schedule' \|\| steps\.selection\.outputs\.lane == 'STRICT'/);assert.match(security,/no fresh security scan claimed/);
 assert.match(browser,/CALLERCORE_VERIFY_GPT: 'false'/);assert.match(browser,/--strict-plan --base/);assert.match(browser,/steps\.selection\.outputs\.browser == 'full'[\s\S]*run: npm run qa:preview/);assert.match(browser,/no fresh visual acceptance claimed/);
});
