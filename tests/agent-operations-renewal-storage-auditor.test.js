'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'agent-operations-engineering-owner-control-qa.test.js'),'utf8');
const {setup,owner,create}=new Function('require','__dirname',source.slice(0,source.indexOf("test('"))+'\nreturn {setup,owner,create};')(require,__dirname);
async function ready(){const f=await setup();await f.h.broker.prepareApproval(owner,f.context,f.ap);return f;}
test('release validation failure creates no deadline timer or detached rejection',async()=>{
 const f=await ready(),contracts=require('../lib/agent-operations-contracts'),originalRelease=contracts.assertRelease,originalTimer=global.setTimeout;
 let timers=0;const before=f.h.raw(),compares=f.h.compares();
 try{contracts.assertRelease=()=>{throw Error('AUDITOR_RELEASE_DENIED');};global.setTimeout=(...args)=>{timers++;return originalTimer(...args);};await a.rejects(f.control.verifyRenewalStorage(owner,{}),/AUDITOR_RELEASE_DENIED/);a.equal(timers,0);a.equal(f.h.compares(),compares);a.equal(f.h.raw(),before);}
 finally{contracts.assertRelease=originalRelease;global.setTimeout=originalTimer;}
});
for(const mode of ['cancel','deadline'])test('late fresh authentication cannot compare after '+mode,async()=>{
 const f=await ready(),before=f.h.raw(),compares=f.h.compares(),controller=new AbortController();let checks=0,releaseOwner,enteredOwner,fireDeadline;
 const entered=new Promise(resolve=>{enteredOwner=resolve;}),gate=new Promise(resolve=>{releaseOwner=resolve;});
 const control=create({operations:{},organization:f.h.organization,runtime:f.h.runtime,assertOwner:async()=>{if(++checks===2){enteredOwner();await gate;}return true;}});
 const originalTimer=global.setTimeout,originalClear=global.clearTimeout,token={};
 try{
  if(mode==='deadline'){global.setTimeout=(fn,ms,...args)=>{if(ms===45000){fireDeadline=fn;return token;}return originalTimer(fn,ms,...args);};global.clearTimeout=id=>{if(id!==token)return originalClear(id);};}
  const pending=control.verifyRenewalStorage(owner,{}, {signal:controller.signal});await entered;
  if(mode==='deadline'){fireDeadline();const out=await pending;a.equal(out.status,'unconfirmed');releaseOwner();}
  else{controller.abort();releaseOwner();const out=await pending;a.equal(out.status,'unconfirmed');}
  await new Promise(resolve=>setImmediate(resolve));a.equal(f.h.compares(),compares);a.equal(f.h.raw(),before);
 }finally{releaseOwner();global.setTimeout=originalTimer;global.clearTimeout=originalClear;}
});
test('storage probe preserves an active approval lease and every raw ledger byte',async()=>{
 const f=await ready(),record=f.h.state().operations.approvals[0];await f.h.broker.activateApproval(owner,f.context,f.ap,record.revision);
 const before=f.h.raw(),compares=f.h.compares(),out=await f.control.verifyRenewalStorage(owner,{});
 a.equal(out.status,'verified');a.equal(out.executionAuthorized,false);a.equal(f.h.raw(),before);a.equal(f.h.compares(),compares+1);a.equal(f.h.state().operations.approvals[0].status,'active');
});
