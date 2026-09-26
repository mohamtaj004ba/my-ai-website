const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('lib/site-analytics.js','utf8');

function fixture({injectConflict=false}={}){
  const values=new Map(),index=[],operations=[];
  let conflicts=0,uuids=0;
  const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
  const kv={
    get:async key=>clone(values.get(key)??null),
    eval:async(script,keys,args)=>{
      operations.push({script,keys:[...keys],args:[...args]});
      if(injectConflict&&conflicts++===0)return 0;
      const before=values.has(keys[0])?JSON.stringify(values.get(keys[0])):'';
      if(before!==args[0])return 0;
      if(args[4]==='1'&&(values.get(keys[2])||'')!==args[2])return 0;
      const prev=args[4]==='1'?3:2;
      if(args[5]==='1'&&(values.get(keys[prev])||'')!==args[3])return 0;
      let auditKey,auditEvents;
      if(args[9]==='1'){
        auditKey=keys[2+(args[4]==='1'?1:0)+(args[5]==='1'?1:0)];
        const existing=values.get(auditKey);
        if(existing!=null&&!Array.isArray(existing))return -1;
        auditEvents=[JSON.parse(args[10]),...(existing||[])].slice(0,200);
      }
      values.set(keys[0],JSON.parse(args[1]));
      if(args[4]==='1')values.set(keys[2],args[8]);
      if(args[5]==='1'&&args[6]==='1')values.delete(keys[prev]);
      if(args[7]==='1'){index.unshift(args[8]);index.splice(2000)}
      if(auditKey)values.set(auditKey,auditEvents);
      return 1;
    },
    set:()=>{throw Error('prospect must not write with plain SET')},
    lpush:()=>{throw Error('prospect index must be atomic')},
    ltrim:()=>{throw Error('prospect index trim must be atomic')}
  };
  const module={exports:{}};
  vm.runInNewContext(source,{
    module,exports:module.exports,require:name=>name==='crypto'?{...crypto,randomUUID:()=> 'test-id-'+(++uuids)}:name==='./kv'?{kv}:require(name),
    Date,Math,Number,String,Promise,Set,Error
  });
  return {upsert:module.exports.upsertWebsiteProspect,values,index,operations,kv,emailKey:module.exports.emailKey};
}
test('new prospect publishes record, email match and directory atomically',async()=>{
  const f=fixture();
  const p=await f.upsert({email:'  LEAD@example.test ',name:'First',source:'contact',utmCampaign:'spring'});
  assert.equal(p.id,'test-id-1');
  assert.equal(f.index.length,1);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('lead@example.test')),p.id);
  assert.equal(f.values.get('site:prospect:'+p.id).name,'First');
  assert.equal(f.operations.length,1);
  const script=f.operations[0].script;
  assert.ok(script.indexOf("redis.call('GET',KEYS[1])")<script.indexOf("redis.call('SET',KEYS[1]"));
  assert.ok(script.indexOf("redis.call('SET',KEYS[1]")<script.indexOf("redis.call('LPUSH',KEYS[2]"));
});
test('same email reuses prospect and preserves first attribution without indexing twice',async()=>{
  const f=fixture();
  const first=await f.upsert({email:'lead@example.test',name:'First',source:'contact',utmCampaign:'spring'});
  const second=await f.upsert({email:'lead@example.test',name:'Second',source:'get_started',stage:'checkout_started',utmCampaign:'fall'});
  assert.equal(second.id,first.id);
  assert.equal(second.firstSource,'contact');
  assert.equal(second.firstUtmCampaign,'spring');
  assert.equal(second.utmCampaign,'fall');
  assert.equal(f.index.length,1);
});
test('snapshot conflict re-reads ownership rather than publishing duplicate lead',async()=>{
  const f=fixture({injectConflict:true});
  const item=await f.upsert({email:'lead@example.test',name:'Lead'});
  assert.equal(f.operations.length,2);
  assert.equal(f.index.length,1);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('lead@example.test')),item.id);
});
test('email move removes only owned former lookup within the record transaction',async()=>{
  const f=fixture();
  const first=await f.upsert({email:'old@example.test',name:'Lead'});
  await f.upsert({id:first.id,email:'new@example.test',name:'New'});
  assert.equal(f.values.has('site:prospect:email:'+f.emailKey('old@example.test')),false);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('new@example.test')),first.id);
  assert.equal(f.index.length,1);
});
test('collision and orphaned email mappings fail closed with no extra records',async()=>{
  const f=fixture();
  const existing=await f.upsert({email:'taken@example.test'});
  await assert.rejects(()=>f.upsert({id:'other',email:'taken@example.test'}),/another record/);
  assert.equal(f.values.has('site:prospect:other'),false);
  f.values.set('site:prospect:email:'+f.emailKey('orphan@example.test'),'missing-id');
  await assert.rejects(()=>f.upsert({email:'orphan@example.test'}),/missing record/);
  assert.equal(f.index.length,1);
  assert.equal(f.index[0],existing.id);
});
test('transaction errors never commit partial client index or email lookup writes',async()=>{
  const f=fixture();
  const original=f.kv.eval;f.kv.eval=async()=>{throw Error('upstream down')};
  await assert.rejects(()=>f.upsert({email:'failed@example.test'}),/upstream down/);
  assert.equal(f.index.length,0);
  assert.equal(f.values.size,0);
  f.kv.eval=original;
});

test('manual prospect follow-up, owner, notes and tags commit with original lead',async()=>{
  const f=fixture(),start=Date.now();
  const lead=await f.upsert({email:'manual@example.test',source:'manual',stage:'new',name:'Manual',
    owner:'Agent',campaign:'fall',notes:'Follow up today',tags:[' priority ','service'],
    nextFollowUpAt:null,autoFollowupHours:24,updatedBy:'admin@example.test'});
  assert.equal(f.operations.length,1);
  assert.equal(f.index.length,1);
  assert.equal(lead.owner,'Agent');assert.equal(lead.campaign,'fall');
  assert.equal(lead.notes,'Follow up today');
  assert.deepEqual(Array.from(lead.tags),['priority','service']);
  assert.ok(lead.nextFollowUpAt>=start+24*3600000);
  await f.upsert({id:lead.id,email:lead.email,stage:'checkout_started',source:'get_started'});
  const later=f.values.get('site:prospect:'+lead.id);
  assert.equal(later.owner,'Agent');assert.equal(later.notes,'Follow up today');
  assert.equal(later.nextFollowUpAt,lead.nextFollowUpAt);
  assert.equal(f.index.length,1);
});
test('converted or lost manual prospects do not receive an automatic follow-up',async()=>{
  for(const stage of ['converted','lost']){
    const f=fixture();
    const lead=await f.upsert({email:stage+'@example.test',stage,nextFollowUpAt:null,autoFollowupHours:24});
    assert.equal(lead.nextFollowUpAt,null);
  }
});

test('simultaneous same-email submissions converge on one indexed prospect',async()=>{
  const f=fixture();
  const [contact,checkout]=await Promise.all([
    f.upsert({email:'same@example.test',source:'contact',name:'Lead'}),
    f.upsert({email:'same@example.test',source:'get_started',name:'Lead',stage:'checkout_started'})
  ]);
  assert.equal(contact.id,checkout.id);
  assert.equal(f.index.length,1);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('same@example.test')),contact.id);
  assert.equal(f.values.get('site:prospect:'+contact.id).firstSource,'contact');
});

test('manual new-lead collision does not reset an existing converted customer',async()=>{
 const f=fixture();
 const paid=await f.upsert({email:'customer@example.test',name:'Paid customer',stage:'converted',source:'get_started',convertedAt:1234,workspaceId:'workspace-1',monthlyValue:400});
 const writes=f.operations.length;
 await assert.rejects(()=>f.upsert({email:'customer@example.test',name:'Manual prospect',stage:'new',source:'manual',requireNew:true}),err=>{
   assert.equal(err.code,'PROSPECT_EXISTS');
   assert.equal(err.prospectId,paid.id);
   return true;
 });
 assert.equal(f.operations.length,writes);
 const retained=f.values.get('site:prospect:'+paid.id);
 assert.equal(retained.stage,'converted');
 assert.equal(retained.workspaceId,'workspace-1');
 assert.equal(retained.convertedAt,1234);
 assert.equal(retained.monthlyValue,400);
 assert.equal(f.index.length,1);
});
test('manual new-lead racing a same-email submission rejects after fresh lookup',async()=>{
 const f=fixture({injectConflict:true});
 const original=f.kv.eval;
 let published=false;
 f.kv.eval=async(script,keys,args)=>{
   if(!published){
     published=true;
     const owned='site:prospect:email:'+f.emailKey('same@example.test');
     f.values.set('site:prospect:already',{id:'already',email:'same@example.test',stage:'converted',createdAt:1,updatedAt:2});
     f.values.set(owned,'already');
     f.index.push('already');
     return 0;
   }
   return original(script,keys,args);
 };
 await assert.rejects(()=>f.upsert({email:'same@example.test',requireNew:true,stage:'new'}),err=>err.code==='PROSPECT_EXISTS');
 assert.equal(f.values.get('site:prospect:already').stage,'converted');
 assert.equal(f.index.length,1);
});

test('later website inquiries or checkout starts cannot downgrade a converted lead',async()=>{
 const f=fixture();
 const customer=await f.upsert({email:'paid@example.test',stage:'converted',source:'checkout',workspaceId:'workspace-paid',convertedAt:1234,monthlyValue:500,firstSource:'referral'});
 const contact=await f.upsert({email:'paid@example.test',stage:'inquiry',source:'contact',message:'I have a question'});
 const checkout=await f.upsert({email:'paid@example.test',stage:'checkout_started',source:'get_started'});
 assert.equal(contact.id,customer.id);
 assert.equal(checkout.id,customer.id);
 assert.equal(checkout.stage,'converted');
 assert.equal(checkout.workspaceId,'workspace-paid');
 assert.equal(checkout.convertedAt,1234);
 assert.equal(checkout.monthlyValue,500);
 assert.equal(checkout.firstSource,'checkout');
 assert.equal(f.index.length,1);
});

test('manual create records admin audit in same atomic transaction as prospect and index',async()=>{
  const f=fixture();
  const lead=await f.upsert({email:'audited@example.test',name:'A lead',notes:'Private notes',
    requireNew:true,source:'manual',adminAudit:{workspaceId:'admin-ws',actorEmail:'admin@example.test'}});
  const op=f.operations[0];
  assert.equal(op.args[9],'1');
  assert.equal(op.keys.at(-1),'audit:admin-ws');
  assert.equal(f.index.length,1);
  assert.equal(f.values.get('site:prospect:email:'+f.emailKey('audited@example.test')),lead.id);
  const audit=f.values.get('audit:admin-ws');
  assert.equal(audit.length,1);
  assert.equal(audit[0].action,'sales_prospect_create');
  assert.equal(audit[0].meta.prospectId,lead.id);
  assert.equal(audit[0].actorEmail,'admin@example.test');
  assert.equal(audit[0].before,null);
  assert.equal(audit[0].after.stage,'new');
  assert.ok(!JSON.stringify(audit).includes('Private notes'));
  assert.ok(!JSON.stringify(audit).includes('audited@example.test'));
  assert.ok(op.script.indexOf('auditEncoded=encoded')<op.script.indexOf("redis.call('SET',KEYS[1]"));
});
test('malformed audit history fails before publishing a manual prospect',async()=>{
  const f=fixture();
  f.values.set('audit:admin-ws',{corrupt:true});
  await assert.rejects(()=>f.upsert({email:'broken@example.test',requireNew:true,
    adminAudit:{workspaceId:'admin-ws',actorEmail:'admin@example.test'}}),/audit history is malformed/);
  assert.equal(f.index.length,0);
  assert.equal(f.values.has('site:prospect:email:'+f.emailKey('broken@example.test')),false);
  assert.equal(f.values.has('site:prospect:test-id-1'),false);
});
test('non-manual checkout and contact lead capture do not insert admin audit entries',async()=>{
  const f=fixture();
  await f.upsert({email:'contact@example.test',source:'contact',stage:'inquiry'});
  assert.equal(f.operations[0].args[9],'0');
  assert.equal(f.operations[0].keys.includes('audit:admin-ws'),false);
});
