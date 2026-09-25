const test=require('node:test');
const assert=require('node:assert/strict');
const {indexKey,detailKey,readConversationDirectory,readConversationPage,readConversation,readContactConversations,readAllConversations,publishNormalizedConversations,deleteNormalizedConversations}=require('../lib/conversation-store');

function memoryKv(initial={}){
  const data=new Map(Object.entries(initial)),operations=[];
  return {data,operations,async get(key){operations.push(['get',key]);return data.has(key)?data.get(key):null},async set(key,value){operations.push(['set',key]);data.set(key,value);return 'OK'},async del(key){operations.push(['del',key]);data.delete(key);return 1}};
}

function records(){return [
  {id:'thread-a',name:'Mary Rivera',phone:'(509) 555-0101',status:'Active',createdAt:10,messages:[{text:'Furnace tuneup',at:11}]},
  {id:'thread-b',name:'Sam Lee',phone:'(509) 555-0102',status:'Closed',createdAt:20,messages:[{text:'Needle in full history',at:21},{text:'Resolved',at:22}]}
]}

test('legacy conversation arrays remain a complete compatibility read path',async()=>{
  const kv=memoryKv({'conversations:ws_1':records()});
  const directory=await readConversationDirectory(kv,'ws_1');
  assert.equal(directory.source,'legacy');assert.equal(directory.conversations.length,2);assert.equal(directory.conversations[1].messageCount,2);
  assert.deepEqual((await readConversationPage(kv,'ws_1',{q:'needle'})).conversations.map(item=>item.id),['thread-b']);
  assert.equal((await readConversation(kv,'ws_1','thread-a')).name,'Mary Rivera');
});

test('normalized publication writes details before the versioned index and preserves legacy data',async()=>{
  const legacy=records(),kv=memoryKv({'conversations:ws_1':legacy});
  await publishNormalizedConversations(kv,'ws_1',legacy,{now:1234});
  const index=kv.data.get(indexKey('ws_1'));
  assert.equal(index.version,2);assert.equal(index.updatedAt,1234);assert.equal(index.conversations[1].messageCount,2);
  assert.equal('messages' in index.conversations[0],false);assert.equal('searchText' in index.conversations[1],false);
  const indexWrite=kv.operations.findIndex(([op,key])=>op==='set'&&key===indexKey('ws_1'));
  for(const item of legacy)assert.ok(kv.operations.findIndex(([op,key])=>op==='set'&&key===detailKey('ws_1',item.id))<indexWrite);
  assert.strictEqual(kv.data.get('conversations:ws_1'),legacy);
});

test('normalized list pages avoid details while full-history search reads normalized details',async()=>{
  const legacy=records(),kv=memoryKv({'conversations:ws_1':legacy});await publishNormalizedConversations(kv,'ws_1',legacy);
  kv.operations.length=0;
  const page=await readConversationPage(kv,'ws_1',{});assert.equal(page.conversations.length,2);
  assert.equal(kv.operations.some(([op,key])=>op==='get'&&key==='conversations:ws_1'),false);
  assert.equal(kv.operations.some(([op,key])=>op==='get'&&key.includes('conversations:v2:detail:')),false);
  const search=await readConversationPage(kv,'ws_1',{q:'needle'});assert.deepEqual(search.conversations.map(item=>item.id),['thread-b']);
  assert.equal(kv.operations.some(([op,key])=>op==='get'&&key==='conversations:ws_1'),false);
  const detail=await readConversation(kv,'ws_1','thread-b');assert.equal(detail.messages.length,2);
});

test('contact reads use the normalized contact index and missing details fall back safely',async()=>{
  const legacy=records(),kv=memoryKv({'conversations:ws_1':legacy});await publishNormalizedConversations(kv,'ws_1',legacy);
  kv.data.delete(detailKey('ws_1','thread-a'));kv.operations.length=0;
  const result=await readContactConversations(kv,'ws_1','p:5095550101');
  assert.deepEqual(result.map(item=>item.id),['thread-a']);
  assert.ok(kv.operations.some(([op,key])=>op==='get'&&key==='conversations:ws_1'));
  assert.equal(kv.operations.some(([op,key])=>op==='get'&&key===detailKey('ws_1','thread-b')),false);
});

test('republishing removes obsolete normalized details only after the new index exists',async()=>{
  const all=records(),kv=memoryKv({'conversations:ws_1':all});await publishNormalizedConversations(kv,'ws_1',all);
  kv.operations.length=0;await publishNormalizedConversations(kv,'ws_1',[all[1]],{now:2000});
  assert.equal(kv.data.has(detailKey('ws_1','thread-a')),false);
  const indexWrite=kv.operations.findIndex(([op,key])=>op==='set'&&key===indexKey('ws_1'));
  const obsoleteDelete=kv.operations.findIndex(([op,key])=>op==='del'&&key===detailKey('ws_1','thread-a'));
  assert.ok(indexWrite>=0&&obsoleteDelete>indexWrite);
});

test('failed detail publication never replaces the readable normalized index',async()=>{
  const original=records(),kv=memoryKv({'conversations:ws_1':original});await publishNormalizedConversations(kv,'ws_1',original,{now:1000});
  const before=kv.data.get(indexKey('ws_1')),set=kv.set.bind(kv);kv.set=async(key,value)=>{if(key===detailKey('ws_1','thread-c'))throw new Error('write failed');return set(key,value)};
  await assert.rejects(()=>publishNormalizedConversations(kv,'ws_1',[...original,{id:'thread-c',messages:[]}],{now:2000}),/write failed/);
  assert.strictEqual(kv.data.get(indexKey('ws_1')),before);
});

test('export reads normalized details and cleanup removes the index and every current detail',async()=>{
  const all=records(),kv=memoryKv({'conversations:ws_1':all});await publishNormalizedConversations(kv,'ws_1',all);
  assert.deepEqual((await readAllConversations(kv,'ws_1')).map(item=>item.id),['thread-a','thread-b']);
  await deleteNormalizedConversations(kv,'ws_1');
  assert.equal(kv.data.has(indexKey('ws_1')),false);for(const item of all)assert.equal(kv.data.has(detailKey('ws_1',item.id)),false);
  assert.deepEqual((await readAllConversations(kv,'ws_1')).map(item=>item.id),['thread-a','thread-b']);
});

test('malformed or duplicate conversation records fail closed',async()=>{
  const kv=memoryKv({'conversations:ws_1':{broken:true}});
  await assert.rejects(()=>readConversationDirectory(kv,'ws_1'),/unavailable/);
  await assert.rejects(()=>publishNormalizedConversations(kv,'ws_1',[{id:'same'},{id:'same'}]),/duplicated/);
});
