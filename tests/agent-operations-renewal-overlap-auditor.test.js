'use strict';
// Independent security tests of the real broker/CAS. Offline only.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-approval-control-qa.test.js'),'utf8');
const {fixture,owner,approval}=new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {fixture,owner,approval};')(require,__dirname);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function setup(){const h=fixture({paid:true}),c=h.context('chief-plan'),ap=approval(h,c),p=await h.broker.prepareApproval(owner,c,ap);await h.broker.activateApproval(owner,c,ap,p.record.revision);return{h,c,ap};}

test('both independent fresh reads begin before either completes; mutation waits for both',async()=>{
 const {h,c,ap}=await setup();h.advance(10000);const readStarted=deferred(),ownerStarted=deferred(),readGate=deferred(),ownerGate=deferred(),read=h.adapter.read;
 h.adapter.read=async()=>{readStarted.resolve();await readGate.promise;return read();};
 const broker=h.organization.engineering(async()=>{ownerStarted.resolve();await ownerGate.promise;});
 const before=h.raw(),compares=h.compares(),pending=broker.renewApproval(owner,c,ap);
 await Promise.all([readStarted.promise,ownerStarted.promise]);a.equal(h.raw(),before);a.equal(h.compares(),compares);
 readGate.resolve();await Promise.resolve();a.equal(h.raw(),before);ownerGate.resolve();const result=await pending;
 a.equal(result.leaseUntil,h.now()+30000);a.equal(result.executionAuthorized,false);a.equal(h.compares(),compares+1);
});

test('prefetched no-op cannot hide concurrent revocation and retries fresh authentication',async()=>{
 const {h,c,ap}=await setup();const ownerStarted=deferred(),gate=deferred(),read=h.adapter.read;let first=true,checks=0;
 h.adapter.read=async()=>{if(first){first=false;const captured=await read();await gate.promise;return captured;}return read();};
 const broker=h.organization.engineering(async()=>{checks++;if(checks===1){ownerStarted.resolve();await gate.promise;}else throw Error('AUDITOR_FRESH_OWNER_REVOKED');});
 const pending=broker.renewApproval(owner,c,ap);await ownerStarted.promise;await h.broker.revokeApproval(owner,c,ap);const revoked=h.raw();gate.resolve();
 await a.rejects(pending,/AUDITOR_FRESH_OWNER_REVOKED/);a.equal(checks,2);a.equal(h.raw(),revoked);a.equal(h.state().operations.approvals[0].status,'revoked');a.equal(h.state().operations.approvals[0].leaseUntil,0);
});

test('failed fresh owner check cannot mutate when a delayed independent read later resolves',async()=>{
 const {h,c,ap}=await setup();h.advance(10000);const started=deferred(),gate=deferred(),read=h.adapter.read;
 h.adapter.read=async()=>{started.resolve();await gate.promise;return read();};
 const broker=h.organization.engineering(async()=>{throw Error('AUDITOR_OWNER_DENIED');}),before=h.raw(),count=h.compares(),pending=broker.renewApproval(owner,c,ap);
 await started.promise;await a.rejects(pending,/AUDITOR_OWNER_DENIED/);gate.resolve();await new Promise(r=>setImmediate(r));a.equal(h.raw(),before);a.equal(h.compares(),count);
});
