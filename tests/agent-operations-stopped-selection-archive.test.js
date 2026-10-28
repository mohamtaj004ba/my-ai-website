'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const original=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-review-ui.test.js'),'utf8'),prefix=original.split(/\r?\ntest\(/)[0],payload=original.match(/function recoveryPayload\(\)\{[^\r\n]+/)[0];
const {harness,recoveryPayload}=new Function('require','__dirname',prefix+'\n'+payload+'\nreturn {harness,recoveryPayload};')(require,__dirname);
const key='callercore-engineering-development-4usd-v1';
function setup(change,storage=new Map()){
 const p=recoveryPayload(),s=p.ownerPilotControl.engineeringSequences[0];s.status='stopped';s.stoppedAt=Date.now();const raw=JSON.stringify({scope:p.operatingSystem.scopeIdentity,runtime:JSON.stringify(s.enrollments.at(-1).runtime),id:s.id,registrationRequested:true});storage.set(key,raw);let reads=0;
 const h=harness(async()=>{reads++;await change?.(p,h,reads);return{__json:true,value:structuredClone(p)};},storage);h.update(p.operatingSystem);return{p,s,h,raw,archiveKey:key+'-closed-selection-'+s.id,run:()=>h.get('opsEngineeringStoppedSelectionArchive').emit('click')};
}
test('stopped selection is archived after two owner readbacks without changing server history or creating authority',async()=>{
 const f=setup(),before=JSON.stringify(f.p);await f.run();a.equal(f.h.calls.length,2);a(f.h.calls.every(x=>x.method==='GET'));a.equal(f.h.storage.has(key),false);const archived=JSON.parse(f.h.storage.get(f.archiveKey));a.equal(archived.selectedRaw,f.raw);a.equal(archived.executionAuthorized,false);a.equal(JSON.stringify(f.p),before);a.match(f.h.get('opsEngineeringTrialResult').textContent,/archived with original history/);
});
for(const kind of ['open','unknown-id','foreign-workspace','active-approval','active-lease','open-attempt','bad-cleanup','changed-history','changed-cache','wrong-runtime','malformed-cache','archive-conflict','network'])test('stopped selection archive denies '+kind+' without erasing selection',async()=>{
 const f=setup((p,h,n)=>{if(kind==='network')throw Error('PRIVATE_SOURCE');if(kind==='foreign-workspace'&&n===2){const q=structuredClone(p.operatingSystem);q.scopeIdentity.workspaceHash='0'.repeat(64);h.update(q);}if(kind==='changed-history'&&n===2)p.ownerPilotControl.engineeringSequences[0].stoppedAt++;if(kind==='changed-cache'&&n===2)h.storage.set(key,'NEW_SELECTION');});
 if(kind==='open')f.s.status='open';if(kind==='unknown-id')f.s.id='sequence_'+'9'.repeat(32);if(kind==='active-approval')f.p.ownerPilotControl.approvals=[{status:'prepared',leaseUntil:0}];if(kind==='active-lease')f.p.ownerPilotControl.workflows=[{status:'blocked',leaseUntil:1,attempts:[]}];if(kind==='open-attempt')f.p.ownerPilotControl.workflows=[{status:'blocked',leaseUntil:0,attempts:[{closed:false}]}];if(kind==='bad-cleanup')f.p.ownerPilotControl.cleanupStatus.ready=false;
 if(kind==='wrong-runtime'){const x=JSON.parse(f.raw);x.runtime=JSON.stringify(f.p.operatingSystem.runtime);f.h.storage.set(key,JSON.stringify(x));}if(kind==='malformed-cache')f.h.storage.set(key,'NOT_JSON');if(kind==='archive-conflict')f.h.storage.set(f.archiveKey,'{"version":"foreign"}');
 const before=f.h.storage.get(key);await f.run();a.equal(f.h.storage.get(key),kind==='changed-cache'?'NEW_SELECTION':before);a.match(f.h.get('opsEngineeringTrialResult').textContent,kind==='foreign-workspace'?/No trial evidence for the current owner/:/unconfirmed/);a(!f.h.get('opsEngineeringTrialResult').textContent.includes('PRIVATE'));a(f.h.calls.every(x=>x.method==='GET'));
});
test('archive write failure leaves active selection intact; interrupted removal resumes from exact preserved proof',async()=>{
 const storage=new Map(),f=setup(null,storage),set=storage.set.bind(storage);storage.set=(k,v)=>{if(k===f.archiveKey)throw Error('quota');return set(k,v);};await f.run();a.equal(storage.get(key),f.raw);a.equal(storage.has(f.archiveKey),false);
 storage.set=set;const remove=storage.delete.bind(storage);storage.delete=k=>{if(k===key)throw Error('interrupted');return remove(k);};await f.run();a.equal(storage.get(key),f.raw);const archived=storage.get(f.archiveKey);a(archived);storage.delete=remove;await f.run();a.equal(storage.has(key),false);a.equal(storage.get(f.archiveKey),archived);
});
test('pending trial journals cannot be cleared by stopped-selection archive',async()=>{
 const f=setup();f.h.storage.set('callercore-engineering-development-attempt-v1','UNCONFIRMED');await f.run();a.equal(f.h.calls.length,0);a.equal(f.h.storage.get(key),f.raw);a.equal(f.h.storage.get('callercore-engineering-development-attempt-v1'),'UNCONFIRMED');
});
