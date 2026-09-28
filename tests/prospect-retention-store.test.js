const test=require('node:test');
const assert=require('node:assert/strict');
const {applyStaleProspectDeidentification,prospectEmailLookupKey}=require('../lib/prospect-retention-store');

const day=24*60*60*1000;
function fixture(prospect,{lookupOwner,mutateBeforeCommit=false}={}){
  const records=new Map([['site:prospect:'+prospect.id,JSON.parse(JSON.stringify(prospect))]]);
  const lookupKey=prospectEmailLookupKey(prospect.email);
  if(lookupKey&&lookupOwner!==null)records.set(lookupKey,lookupOwner===undefined?prospect.id:lookupOwner);
  let evalCalls=0;
  const kv={
    async get(key){const value=records.get(key);return value===undefined?null:JSON.parse(JSON.stringify(value))},
    async eval(_script,keys,args){
      evalCalls++;
      if(mutateBeforeCommit)records.set('site:prospect:'+prospect.id,{...records.get('site:prospect:'+prospect.id),updatedAt:Number(prospect.updatedAt||0)+1});
      const count=Number(args[0]);
      for(let i=0;i<count;i++){
        const expected=args[(i*2)+1],current=records.has(keys[i])?JSON.stringify(records.get(keys[i])):'';
        if(current!==expected)return 0;
      }
      for(let i=0;i<count;i++){
        const next=args[(i*2)+2];
        if(next==='__CALLERCORE_DELETE__')records.delete(keys[i]);
        else records.set(keys[i],JSON.parse(next));
      }
      return 1;
    }
  };
  return {kv,records,lookupKey,get evalCalls(){return evalCalls}};
}

test('eligible stale prospect is de-identified and owned email lookup is removed atomically',async()=>{
  const now=600*day,prospect={id:'p1',stage:'new',name:'Person',email:'Person@Example.test',phone:'5095550101',message:'private',notes:'private',visitorId:'v',sessionId:'s',updatedAt:now-400*day,createdAt:now-450*day,source:'google',plan:'Growth',monthlyValue:99};
  const f=fixture(prospect),r=await applyStaleProspectDeidentification(f.kv,prospect,now);
  assert.equal(r.ok,true);assert.equal(r.emailLookupRemoved,true);assert.equal(f.evalCalls,1);
  const saved=f.records.get('site:prospect:p1');
  assert.equal(saved.privacyState,'deidentified');assert.equal(saved.source,'google');assert.equal(saved.plan,'Growth');assert.equal(saved.monthlyValue,99);
  for(const field of ['name','email','phone','message','notes','visitorId','sessionId'])assert.equal(Object.prototype.hasOwnProperty.call(saved,field),false,field);
  assert.equal(f.records.has(f.lookupKey),false);
});

test('missing email lookup is allowed but foreign lookup ownership fails closed',async()=>{
  const now=600*day,prospect={id:'p1',stage:'lost',email:'person@example.test',updatedAt:now-400*day};
  const missing=fixture(prospect,{lookupOwner:null}),ok=await applyStaleProspectDeidentification(missing.kv,prospect,now);
  assert.equal(ok.ok,true);assert.equal(ok.emailLookupRemoved,false);
  const foreign=fixture(prospect,{lookupOwner:'another'});
  await assert.rejects(()=>applyStaleProspectDeidentification(foreign.kv,prospect,now),err=>err.code==='PROSPECT_EMAIL_LOOKUP_CONFLICT');
  assert.equal(foreign.records.get('site:prospect:p1').privacyState,undefined);assert.equal(foreign.evalCalls,0);
});

test('recent, customer-linked or explicitly consented prospect is never written',async()=>{
  const now=600*day,old=now-400*day;
  for(const [prospect,options] of [
    [{id:'recent',stage:'new',updatedAt:now-10*day},{}],
    [{id:'customer',stage:'new',updatedAt:old,workspaceId:'w1'},{}],
    [{id:'converted',stage:'converted',updatedAt:old},{}],
    [{id:'consented',stage:'new',updatedAt:old},{consentActive:true}]
  ]){
    const f=fixture(prospect),r=await applyStaleProspectDeidentification(f.kv,prospect,now,options);
    assert.equal(r.ok,false);assert.equal(r.eligible,false);assert.equal(f.evalCalls,0);
  }
});

test('scan snapshot drift before execution is reported as conflict without a write',async()=>{
  const now=600*day,prospect={id:'p1',stage:'new',updatedAt:now-400*day};
  const f=fixture(prospect);f.records.set('site:prospect:p1',{...prospect,notes:'new activity',updatedAt:prospect.updatedAt+1});
  const r=await applyStaleProspectDeidentification(f.kv,prospect,now);
  assert.equal(r.ok,false);assert.equal(r.conflict,true);assert.equal(r.reason,'changed');assert.equal(f.evalCalls,0);
});

test('transaction race after preflight is reported as conflict and leaves email lookup intact',async()=>{
  const now=600*day,prospect={id:'p1',stage:'new',email:'person@example.test',updatedAt:now-400*day};
  const f=fixture(prospect,{mutateBeforeCommit:true}),r=await applyStaleProspectDeidentification(f.kv,prospect,now);
  assert.equal(r.ok,false);assert.equal(r.conflict,true);assert.equal(r.reason,'changed');assert.equal(f.evalCalls,1);
  assert.equal(f.records.get(f.lookupKey),'p1');assert.equal(f.records.get('site:prospect:p1').privacyState,undefined);
});

test('malformed stored record fails closed rather than replacing it',async()=>{
  const now=600*day,prospect={id:'p1',stage:'new',updatedAt:now-400*day};
  const f=fixture(prospect);f.records.set('site:prospect:p1',{id:'wrong',stage:'new',updatedAt:prospect.updatedAt});
  await assert.rejects(()=>applyStaleProspectDeidentification(f.kv,prospect,now),/malformed/);
  assert.equal(f.evalCalls,0);
});
