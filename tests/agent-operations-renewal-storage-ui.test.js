'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-review-ui.test.js'),'utf8'),prefix=source.split(/\r?\ntest\(/)[0];
const {harness,state}=new Function('require','__dirname',prefix+'\nreturn {harness,state};')(require,__dirname);
function view(){const v=state();v.runtime={origin:'https://my-ai-website-test-mohamtaj004bas-projects.vercel.app',sourceCommit:'c'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_exact',release:{version:'organization-contracts-v4',digest:'d'.repeat(64)}};return v;}
function receipt(v){return{version:'engineering-renewal-storage-check-v1',runtime:structuredClone(v.runtime),status:'verified',comparedUnchanged:true,modelRequests:0,executionAuthorized:false,publicationAuthorized:false,acceptance:false,diagnostic:{phase:'ledger-cas',elapsedMs:2,phaseElapsedMs:1}};}
function onlyProbe(h){a.equal(h.calls.length,1);a.equal(h.calls[0].action,'operations-engineering-activation-verifyRenewalStorage');a.deepEqual(h.calls[0].input,{});}
const result=h=>h.get('opsEngineeringActivationResult').textContent;
for(const reordered of [false,true])test('storage UI accepts exact runtime independent of key ordering: '+reordered,async()=>{
 const v=view(),r=receipt(v);if(reordered){r.runtime=Object.fromEntries(Object.entries(r.runtime).reverse());r.runtime.release=Object.fromEntries(Object.entries(r.runtime.release).reverse());}
 const h=harness(async()=>({__engineering:true,value:r}));h.update(v);await h.get('opsEngineeringRenewalStorage').emit('click');onlyProbe(h);const shown=JSON.parse(result(h));a.equal(shown.status,'verified');a.equal(shown.modelRequests,0);a.equal(shown.executionAuthorized,false);a.equal(shown.publicationAuthorized,false);a.equal(shown.acceptance,false);
});
for(const field of ['sourceCommit','deploymentId','releaseDigest','releaseVersion','origin','branch'])test('storage UI rejects mismatched response '+field,async()=>{
 const v=view(),r=receipt(v);if(field==='releaseDigest')r.runtime.release.digest='e'.repeat(64);else if(field==='releaseVersion')r.runtime.release.version='foreign';else r.runtime[field]='foreign';
 const h=harness(async()=>({__engineering:true,value:r}));h.update(v);await h.get('opsEngineeringRenewalStorage').emit('click');onlyProbe(h);a.match(result(h),/Storage verification unconfirmed/);a.doesNotMatch(result(h),/"status": "verified"/);
});
for(const field of ['sourceCommit','deploymentId','release','workspace'])test('storage UI suppresses stale response after current '+field+' changes',async()=>{
 const v=view(),r=receipt(v);let resolve;const pending=new Promise(done=>{resolve=done;}),h=harness(async()=>pending);h.update(v);const run=h.get('opsEngineeringRenewalStorage').emit('click');onlyProbe(h);
 const next=structuredClone(v);if(field==='workspace')next.scopeIdentity.workspaceHash='e'.repeat(64);else if(field==='release')next.runtime.release.digest='e'.repeat(64);else next.runtime[field]='foreign';h.update(next);resolve({__engineering:true,value:r});await run;onlyProbe(h);a.equal(result(h),'No current engineering activation evidence loaded.');
});
test('storage UI ignores duplicate clicks while the single check is pending',async()=>{
 const v=view();let resolve;const pending=new Promise(done=>{resolve=done;}),h=harness(async()=>pending);h.update(v);const button=h.get('opsEngineeringRenewalStorage'),run=button.emit('click');a.equal(button.disabled,true);await button.emit('click');onlyProbe(h);resolve({__engineering:true,value:receipt(v)});await run;onlyProbe(h);a.equal(JSON.parse(result(h)).status,'verified');a.equal(button.disabled,false);
});
