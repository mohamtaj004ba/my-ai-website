'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{equivalent,validate,pair,pin}=require('../scripts/preview-release-pin.cjs');
const source='a'.repeat(40),checkpoint='b'.repeat(40),release={version:'organization-contracts-v3',digest:'c'.repeat(64)};
const identity={sha:source,url:'https://my-ai-website-test.vercel.app',deploymentId:'dpl_Test',projectId:'prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX',environment:'preview',branch:'feature/callercore-dashboards',release};
const git=paths=>args=>{if(args[0]==='merge-base')return '';return paths.join('\0');};
test('documentation checkpoints require actual ancestry and conservative changed paths, not commit titles',()=>{
 assert.equal(equivalent(source,checkpoint,git(['CALLERCORE_PROJECT_STATE.md','docs/AGENT_OPERATIONS_FAILURE_MODES.json','docs/engineering-changes/transport-verified-handoff.json'])).length,3);
 for(const p of ['api/account.js','index.html','assets/image.png','.github/workflows/preview-browser-qa.yml','package-lock.json','vercel.json','docs/payload.cjs','docs/payload.json'])assert.throws(()=>equivalent(source,checkpoint,git([p])),/application-source-mismatch/);
 assert.throws(()=>equivalent(source,checkpoint,()=>{throw Error('not ancestor');}),/not ancestor/);
 assert.throws(()=>equivalent('--bad',checkpoint,git([])),/invalid-source/);
});
test('stale release, deployment ID, branch, environment and malformed identity fail closed',()=>{
 const options={checkpoint,release,git:git([])};assert.deepEqual(validate(identity,options),[]);
 for(const change of [{deploymentId:''},{projectId:'prj_wrong'},{environment:'production'},{branch:'main'},{sha:'bad'},{url:'https://attacker.test'},{release:{...release,digest:'d'.repeat(64)}}])assert.throws(()=>validate({...identity,...change},options));
 for(const change of [{deploymentId:'dpl_Other'},{sha:checkpoint},{url:'https://my-ai-website-other.vercel.app'},{release:{...release,digest:'d'.repeat(64)}}])assert.throws(()=>pair(identity,{...identity,...change}));
});
test('actual pin uses authenticated immutable identity; doc-only source is explicit and alias changes cannot move browser target',async()=>{
 const calls=[];const result=await pin({alias:'https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app',checkpoint,release,headers:{'x-qa-secret':'fictional'},git:git(['CALLERCORE_PROJECT_STATE.md']),fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>identity};}});
 assert.equal(result.url,identity.url);assert.equal(result.source,source);assert.equal(result.checkpoint,checkpoint);assert.equal(result.deploymentId,'dpl_Test');assert.equal(calls[1].url,identity.url+'/api/account?action=preview-build');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers['x-qa-secret'],'fictional');
});
test('HTTP denial, changed immutable deployment, stale application and transport failure never pin',async()=>{
 for(const mode of ['denied','changed','stale','network']){let count=0;await assert.rejects(pin({alias:'https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app',checkpoint,release,headers:{},git:git(mode==='stale'?['api/account.js']:[]),fetcher:async()=>{if(mode==='network')throw Error('network');return{ok:mode!=='denied',status:403,json:async()=>++count===2&&mode==='changed'?{...identity,deploymentId:'dpl_Foreign'}:identity};}}));}
});
test('actual guarded identity function returns exact nonsecret runtime fields and preserves denial',()=>{
 const fs=require('fs'),vm=require('vm'),s=fs.readFileSync(require.resolve('../api/account.js'),'utf8');const body=s.slice(s.indexOf('function previewQaBuild('),s.indexOf('async function previewQaSession('));
 const run=(allowed,env)=>{let status=200,data;const res={setHeader(){},status(n){status=n;return this;},json(x){data=x;return this;}};vm.runInNewContext(body+';previewQaBuild({},res)',{res,previewQaRequestAllowed:()=>allowed,process:{env},require:()=>({assertRelease:()=>release})});return{status,data};};
 const env={VERCEL_GIT_COMMIT_SHA:source,VERCEL_URL:'my-ai-website-test.vercel.app',VERCEL_DEPLOYMENT_ID:'dpl_Test',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:identity.branch};assert.equal(run(false,env).status,404);assert.equal(run(true,{...env,VERCEL_DEPLOYMENT_ID:''}).status,503);assert.equal(run(true,env).data.deploymentId,'dpl_Test');assert.equal(run(true,env).data.release.digest,release.digest);
});

// Historical replays are distinct from the always-required missing-object denial.
// Vercel may provide shallow history; CI explicitly checks out the full history.
function historicalReplay(t,refs,verify){
 const {spawnSync}=require('node:child_process');
 const repository=spawnSync('git',['rev-parse','--is-inside-work-tree'],{encoding:'utf8',windowsHide:true});
 assert.ifError(repository.error);assert.equal(repository.status,0,'Historical replay requires a real Git checkout');
 assert.equal(repository.stdout.trim(),'true');
 const shallowResult=spawnSync('git',['rev-parse','--is-shallow-repository'],{encoding:'utf8',windowsHide:true});assert.ifError(shallowResult.error);assert.equal(shallowResult.status,0);assert(['true','false'].includes(shallowResult.stdout.trim()));const shallow=shallowResult.stdout.trim()==='true';
 const missing=refs.filter(ref=>{const result=spawnSync('git',['cat-file','-e',ref+'^{commit}'],{encoding:'utf8',windowsHide:true});assert.ifError(result.error);return result.status!==0;});
 if(shallow||missing.length){
  t.diagnostic(JSON.stringify({historicalReplay:'unavailable',shallowRepository:shallow,missingCommits:missing,livePinVerified:false}));
  assert.notEqual(process.env.GITHUB_ACTIONS,'true','CI must have full ancestry and required historical commits; fetch-depth: 0 is mandatory. Missing: '+missing.join(', '));
  t.skip('Historical replay unavailable: '+(shallow?'shallow ancestry; ':'')+(missing.length?'missing '+missing.join(', '):'')+'. This does not establish release equivalence.');return;
 }
 verify();t.diagnostic(JSON.stringify({historicalReplay:'verified',commits:refs}));
}
const historical={application:'6fbc2bd6ea515f0cb719bbeed650ff0b70b1c260',documentation:'f95ed62b937ef767608de2ff7dbc5b0a73038c0b',older:'47e35258d677a9deba2299a432ef9cfdb2bbc5cc'};
test('real historical Git verifies the f95 documentation-only checkpoint when its history is available',t=>historicalReplay(t,[historical.application,historical.documentation],()=>assert.equal(equivalent(historical.application,historical.documentation).length,4)));
test('real historical Git rejects the older application runtime when its history is available',t=>historicalReplay(t,[historical.older,historical.documentation],()=>assert.throws(()=>equivalent(historical.older,historical.documentation),/application-source-mismatch/)));
test('real historical Git rejects reversed checkpoint ancestry when its history is available',t=>historicalReplay(t,[historical.application,historical.documentation],()=>assert.throws(()=>equivalent(historical.documentation,historical.application))));
test('real Git missing source or checkpoint objects always fail closed before equivalence or pin success',()=>{
 const {execFileSync,spawnSync}=require('node:child_process'),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),absent='0'.repeat(40);
 assert.match(head,/^[a-f0-9]{40}$/);const probe=spawnSync('git',['cat-file','-e',absent+'^{commit}'],{encoding:'utf8',windowsHide:true});assert.ifError(probe.error);assert.notEqual(probe.status,0,'The negative fixture must be absent from actual Git storage');
 for(const [source,checkpoint]of [[absent,head],[head,absent]])assert.throws(()=>equivalent(source,checkpoint),error=>Number.isInteger(error.status)&&error.status!==0);
});
