'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-owner-control-qa.test.js'),'utf8');
const {setup,owner,create}=new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {setup,owner,create};')(require,__dirname);
async function ready(){const f=await setup();await f.h.broker.prepareApproval(owner,f.context,f.ap);return f;}
test('real owner storage probe compares exact unchanged ledger and creates no authority or accounting changes',async()=>{
 const f=await ready(),before=f.h.raw(),count=f.h.compares(),out=await f.control.verifyRenewalStorage(owner,{});
 a.equal(out.status,'verified');a.equal(out.comparedUnchanged,true);a.equal(out.modelRequests,0);a.equal(out.executionAuthorized,false);a.equal(out.publicationAuthorized,false);a.equal(out.acceptance,false);a.equal(out.runtime.sourceCommit,f.h.runtime.commit);a.equal(f.h.raw(),before);a.equal(f.h.compares(),count+1);
});
test('foreign actor, non-preview and extra input cannot reach probe CAS',async()=>{
 const f=await ready(),before=f.h.raw(),count=f.h.compares();
 for(const actor of [{...owner,id:'foreign@example.test'},{...owner,workspaceId:'other'},{...owner,verifiedOwner:false}])await a.rejects(f.control.verifyRenewalStorage(actor,{}));
 await a.rejects(f.control.verifyRenewalStorage(owner,{raw:'forbidden'}));
 const control=create({operations:{},organization:f.h.organization,runtime:{...f.h.runtime,environment:'production'},assertOwner:async()=>true});await a.rejects(control.verifyRenewalStorage(owner,{}));
 a.equal(f.h.raw(),before);a.equal(f.h.compares(),count);
});
test('adapter errors return only closed classification without storage content',async()=>{
 const f=await ready(),before=f.h.raw();f.h.adapter.compare=async()=>{throw Error('Bearer PRIVATE_LEDGER');};const out=await f.control.verifyRenewalStorage(owner,{});
 a.equal(out.status,'unconfirmed');a.equal(out.diagnostic.phase,'ledger-cas-error');a.equal(out.executionAuthorized,false);a(!JSON.stringify(out).includes('PRIVATE'));a.equal(f.h.raw(),before);
});
test('five conflicts preserve concurrent ledger and report exhaustion without granting a lease',async()=>{
 const f=await ready();let count=0;f.h.adapter.compare=async()=>{count++;const s=f.h.state();s.revision++;s.probeConcurrent=count;f.h.set(s);return false;};
 const out=await f.control.verifyRenewalStorage(owner,{});a.equal(out.status,'unconfirmed');a.equal(out.diagnostic.phase,'ledger-cas-exhausted');a.equal(count,5);a.equal(f.h.state().probeConcurrent,5);a.equal(f.h.state().operations.approvals[0].status,'prepared');a.equal(f.h.state().operations.approvals[0].leaseUntil,0);
});
test('fresh authentication failure and cancellation prevent compare',async()=>{
 for(const mode of ['revoked','cancelled']){const f=await ready(),before=f.h.raw(),compares=f.h.compares(),controller=new AbortController();let checks=0;const control=create({operations:{},organization:f.h.organization,runtime:f.h.runtime,assertOwner:async()=>{if(++checks===2){if(mode==='cancelled')controller.abort();else return false;}return true;}});
 const out=await control.verifyRenewalStorage(owner,{}, {signal:controller.signal});a.equal(out.status,'unconfirmed');a.equal(f.h.raw(),before);a.equal(f.h.compares(),compares);}
});
