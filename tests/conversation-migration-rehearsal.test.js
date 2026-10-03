const test=require('node:test');
const assert=require('node:assert/strict');
const {legacyKey,indexKey,detailKey}=require('../lib/conversation-store');
const {shadowWorkspaceId,runConversationMigrationRehearsal}=require('../lib/conversation-migration-rehearsal');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function memoryKv(initial={}){
  const data=new Map(Object.entries(initial).map(([k,v])=>[k,clone(v)])),operations=[];
  return {
    data,operations,
    async get(key){operations.push(['get',key]);return data.has(key)?clone(data.get(key)):null},
    async set(key,value){operations.push(['set',key,clone(value)]);data.set(key,clone(value));return 'OK'},
    async del(key){operations.push(['del',key]);const had=data.delete(key);return had?1:0},
    async eval(script,keys,args){
      operations.push(['eval',keys.slice(),args.slice()]);
      const count=Number(args[0]);
      for(let i=0;i<count;i++){
        const key=keys[i],current=data.has(key)?JSON.stringify(data.get(key)):'';
        if(current!==args[i*2+1])return 0;
      }
      for(let i=0;i<count;i++){
        const key=keys[i],next=args[i*2+2];
        if(next==='__CALLERCORE_DELETE__')data.delete(key); else data.set(key,JSON.parse(next));
      }
      return 1;
    }
  };
}
function records(){return [
  {id:'thread-a',name:'Ada',phone:'5095550101',status:'Active',messages:[{text:'hello',at:11}],createdAt:10},
  {id:'thread-b',name:'Ben',phone:'5095550102',status:'Closed',messages:[{text:'done',at:21}],createdAt:20},
  {id:'thread-c',name:'Cara',phone:'5095550103',status:'Needs follow-up',messages:[{text:'call me',at:31}],createdAt:30}
]}

test('Preview migration rehearsal publishes details before index, proves read equivalence, rolls back, and blocks stale rollback',async()=>{
  const source='preview-source',items=records(),kv=memoryKv({[legacyKey(source)]:items}),token='fixed-token',
    shadow=shadowWorkspaceId(source,token);
  const result=await runConversationMigrationRehearsal(kv,source,{token,now:1000});
  assert.equal(result.mode,'preview_rehearsal');
  assert.equal(result.writeScope,'shadow_only');
  assert.equal(result.productionExecutorReachable,false);
  assert.equal(result.migrationExecutorReachable,false);
  assert.equal(result.legacySourcePreserved,true);
  assert.equal(result.publishReadEquivalent,true);
  assert.equal(result.detailFidelityComplete,true);
  assert.equal(result.rollbackApplied,true);
  assert.equal(result.rollbackReadEquivalent,true);
  assert.equal(result.concurrentChangeBlocked,true);
  assert.equal(result.concurrentStatePreserved,true);
  assert.equal(result.shadowCleaned,true);
  assert.equal(result.complete,true);
  assert.deepEqual(kv.data.get(legacyKey(source)),items);
  assert.equal(kv.data.has(legacyKey(shadow)),false);
  assert.equal(kv.data.has(indexKey(shadow)),false);
  for(const item of items)assert.equal(kv.data.has(detailKey(shadow,item.id)),false);

  const firstIndexSet=kv.operations.findIndex(x=>x[0]==='set'&&x[1]===indexKey(shadow));
  assert.ok(firstIndexSet>0);
  for(const item of items){
    const detailSet=kv.operations.findIndex(x=>x[0]==='set'&&x[1]===detailKey(shadow,item.id));
    assert.ok(detailSet>=0&&detailSet<firstIndexSet);
  }
});

test('rehearsal response never exposes source or conversation identities',async()=>{
  const source='super-secret-workspace',items=records(),kv=memoryKv({[legacyKey(source)]:items});
  const result=await runConversationMigrationRehearsal(kv,source,{token:'privacy',now:2000});
  const serialized=JSON.stringify(result);
  assert.equal(serialized.includes(source),false);
  assert.equal(serialized.includes('thread-a'),false);
  assert.equal(serialized.includes('Ada'),false);
  assert.equal(serialized.includes('5095550101'),false);
});

test('partial normalized publication failure cleans every shadow key',async()=>{
  const source='preview-source',items=records(),kv=memoryKv({[legacyKey(source)]:items}),token='partial',
    shadow=shadowWorkspaceId(source,token),originalSet=kv.set.bind(kv),failKey=detailKey(shadow,'thread-b');
  kv.set=async(key,value)=>{
    if(key===failKey)throw new Error('simulated detail write failure');
    return originalSet(key,value);
  };
  await assert.rejects(()=>runConversationMigrationRehearsal(kv,source,{token,now:3000}),/simulated detail write failure/);
  assert.equal(kv.data.has(legacyKey(shadow)),false);
  assert.equal(kv.data.has(indexKey(shadow)),false);
  for(const item of items)assert.equal(kv.data.has(detailKey(shadow,item.id)),false);
  assert.deepEqual(kv.data.get(legacyKey(source)),items);
});

test('rehearsal refuses empty or oversized legacy sources without writing shadow data',async()=>{
  const empty=memoryKv({[legacyKey('empty')]:[]});
  await assert.rejects(()=>runConversationMigrationRehearsal(empty,'empty',{token:'x'}),/at least one conversation/);
  const many=Array.from({length:251},(_,i)=>({id:'t-'+i,messages:[]}));
  const over=memoryKv({[legacyKey('over')]:many});
  await assert.rejects(()=>runConversationMigrationRehearsal(over,'over',{token:'x'}),/exceeds capacity/);
  assert.equal([...empty.data.keys()].some(k=>k.startsWith('conversations:v2:')),false);
  assert.equal([...over.data.keys()].some(k=>k.startsWith('conversations:v2:')),false);
});
