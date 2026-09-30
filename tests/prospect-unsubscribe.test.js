const test=require('node:test');
const assert=require('node:assert/strict');
const {
  createMarketingUnsubscribeToken,tokenMatchesProspect,marketingUnsubscribeUrl,
  inspectMarketingUnsubscribe,revokeMarketingUnsubscribe
}=require('../lib/prospect-unsubscribe');

const SECRET='s'.repeat(64);
const grant=(recordedAt=1000)=>({status:'granted',source:'contact_form',noticeVersion:'2026-09-29',recordedAt});
function prospect(overrides={}){
  return {id:'prospect-123',email:'private@example.test',name:'Private Person',createdAt:500,updatedAt:800,marketingEmailConsent:grant(),...overrides};
}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function memoryKv(initial,{conflictOnce=false}={}){
  const data=new Map(Object.entries(initial).map(([k,v])=>[k,clone(v)]));let evalCalls=0,conflicted=false;
  return {
    data,get evalCalls(){return evalCalls},
    async get(key){return data.has(key)?clone(data.get(key)):null},
    async eval(_script,keys,args){
      evalCalls++;
      if(conflictOnce&&!conflicted){
        conflicted=true;
        const current=data.get(keys[0]);data.set(keys[0],{...current,notes:'newer admin note',updatedAt:Number(current.updatedAt||0)+1});
        return 0;
      }
      const current=data.has(keys[0])?JSON.stringify(data.get(keys[0])):'';
      if(current!==args[0])return 0;
      const raw=data.get(keys[1]);let history=[];
      if(raw!=null){if(!Array.isArray(raw))return -1;history=clone(raw)}
      let event;try{event=JSON.parse(args[2])}catch(_){return -2}
      data.set(keys[0],JSON.parse(args[1]));
      history.unshift(event);history=history.slice(0,200);data.set(keys[1],history);
      return 1;
    }
  };
}

test('unsubscribe URL generation requires HTTPS',()=>{
  const p=prospect();
  assert.throws(()=>marketingUnsubscribeUrl(p,SECRET,{siteUrl:'http://callercore.test'}),/site URL is invalid/);
});

test('unsubscribe token is signed, prospect-specific and contains no contact PII',()=>{
  const p=prospect(),token=createMarketingUnsubscribeToken(p,SECRET),url=marketingUnsubscribeUrl(p,SECRET,{siteUrl:'https://preview.callercore.test'});
  assert.equal(tokenMatchesProspect(token,p,SECRET),true);
  assert.match(url,/^https:\/\/preview\.callercore\.test\/unsubscribe#token=/);
  assert.equal(token.includes('private@example.test'),false);
  assert.equal(token.includes('Private Person'),false);
  assert.equal(url.includes('private@example.test'),false);
});

test('GET-style inspection is read-only and recognizes current or already-revoked consent',async()=>{
  const p=prospect(),token=createMarketingUnsubscribeToken(p,SECRET),kv=memoryKv({['site:prospect:'+p.id]:p});
  const before=JSON.stringify([...kv.data.entries()]),status=await inspectMarketingUnsubscribe(kv,token,SECRET);
  assert.deepEqual(status,{valid:true,state:'granted',active:true,alreadyUnsubscribed:false});
  assert.equal(JSON.stringify([...kv.data.entries()]),before);
  await revokeMarketingUnsubscribe(kv,token,SECRET,{now:2000});
  const after=await inspectMarketingUnsubscribe(kv,token,SECRET);
  assert.equal(after.state,'revoked');assert.equal(after.active,false);assert.equal(after.alreadyUnsubscribed,true);
});

test('explicit unsubscribe revokes consent and writes a bounded privacy-safe audit atomically',async()=>{
  const p=prospect(),token=createMarketingUnsubscribeToken(p,SECRET),kv=memoryKv({['site:prospect:'+p.id]:p});
  const result=await revokeMarketingUnsubscribe(kv,token,SECRET,{now:2000});
  assert.deepEqual(result,{ok:true,unsubscribed:true,alreadyUnsubscribed:false,changed:true});
  const saved=kv.data.get('site:prospect:'+p.id),audit=kv.data.get('site:consent:audit:'+p.id);
  assert.equal(saved.marketingEmailConsent.status,'revoked');
  assert.equal(saved.marketingEmailConsent.revokedAt,2000);
  assert.equal(saved.marketingEmailConsent.revocationSource,'unsubscribe_link');
  assert.equal(saved.updatedBy,'prospect-unsubscribe');
  assert.equal(audit.length,1);
  assert.equal(audit[0].action,'marketing_email_unsubscribe');
  assert.equal(audit[0].before.status,'granted');
  assert.equal(audit[0].after.status,'revoked');
  const serialized=JSON.stringify(audit);
  assert.equal(serialized.includes('private@example.test'),false);
  assert.equal(serialized.includes('Private Person'),false);
});

test('unsubscribe is idempotent and does not append duplicate audit events',async()=>{
  const p=prospect(),token=createMarketingUnsubscribeToken(p,SECRET),kv=memoryKv({['site:prospect:'+p.id]:p});
  await revokeMarketingUnsubscribe(kv,token,SECRET,{now:2000});
  const again=await revokeMarketingUnsubscribe(kv,token,SECRET,{now:3000});
  assert.equal(again.alreadyUnsubscribed,true);
  assert.equal(again.changed,false);
  assert.equal(kv.data.get('site:consent:audit:'+p.id).length,1);
});

test('conflict retry preserves a newer unrelated prospect edit before revoking',async()=>{
  const p=prospect(),token=createMarketingUnsubscribeToken(p,SECRET),kv=memoryKv({['site:prospect:'+p.id]:p},{conflictOnce:true});
  const result=await revokeMarketingUnsubscribe(kv,token,SECRET,{now:2000});
  assert.equal(result.changed,true);
  assert.equal(kv.evalCalls,2);
  const saved=kv.data.get('site:prospect:'+p.id);
  assert.equal(saved.notes,'newer admin note');
  assert.equal(saved.marketingEmailConsent.status,'revoked');
});

test('old unsubscribe token becomes invalid after a new explicit opt-in',async()=>{
  const p=prospect(),token=createMarketingUnsubscribeToken(p,SECRET),
    regranted=prospect({marketingEmailConsent:grant(5000),updatedAt:5001}),kv=memoryKv({['site:prospect:'+p.id]:regranted});
  await assert.rejects(()=>inspectMarketingUnsubscribe(kv,token,SECRET),err=>err.code==='INVALID_TOKEN');
  await assert.rejects(()=>revokeMarketingUnsubscribe(kv,token,SECRET,{now:6000}),err=>err.code==='INVALID_TOKEN');
  assert.equal(kv.data.get('site:prospect:'+p.id).marketingEmailConsent.status,'granted');
});

test('missing/short signing secrets and malformed tokens fail closed',async()=>{
  const p=prospect();
  assert.throws(()=>createMarketingUnsubscribeToken(p,'short'),err=>err.code==='SECRET_UNAVAILABLE');
  const kv=memoryKv({['site:prospect:'+p.id]:p});
  await assert.rejects(()=>inspectMarketingUnsubscribe(kv,'garbage',SECRET),err=>err.code==='INVALID_TOKEN');
  assert.equal(kv.evalCalls,0);
});
