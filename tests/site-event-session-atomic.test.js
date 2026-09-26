const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('lib/site-analytics.js','utf8');
function fixture({forceConflicts=0,invalidEventDirectory=false,invalidSessionDirectory=false}={}){
  const values=new Map(),events=[],index=[],attempts=[];
  let ids=0,conflicts=0;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const kv={
    get:async key=>clone(values.get(key)??null),
    eval:async(script,keys,args)=>{
      attempts.push({script,keys:[...keys],args:[...args]});
      if(invalidEventDirectory)return -1;
      if(invalidSessionDirectory&&args[0]==='1'&&args[4]==='1')return -2;
      if(conflicts<forceConflicts){conflicts++;return 0}
      if(args[0]==='1'){
        const old=values.has(keys[1])?JSON.stringify(values.get(keys[1])):'';
        if(old!==args[1])return 0;
      }
      events.unshift(JSON.parse(args[2]));events.splice(5000);
      if(args[0]==='1'){
        values.set(keys[1],JSON.parse(args[3]));
        if(args[4]==='1'){index.unshift(args[5]);index.splice(2000)}
      }
      return 1;
    },
    lpush:()=>{throw Error('site event must use atomic append')},
    ltrim:()=>{throw Error('site event must use atomic cap')},
    set:()=>{throw Error('site session must use atomic update')}
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,
    require:name=>name==='crypto'?{...crypto,randomUUID:()=> 'event-'+(++ids)}:name==='./kv'?{kv}:require(name),
    Date,Math,Number,String,Promise,Set,Error,Object});
  return {record:module.exports.recordSiteEvent,values,events,index,attempts,kv};
}
test('event append and session update share a compare-before-write Redis script',async()=>{
  const f=fixture();
  const event=await f.record({type:'page_view',sessionId:'session-1',visitorId:'visitor-1',path:'/contact'});
  assert.equal(event.type,'page_view');
  assert.equal(f.events.length,1);
  assert.equal(f.index.length,1);
  const session=f.values.get('site:session:session-1');
  assert.equal(session.events,1);
  assert.deepEqual(Array.from(session.pages),['/contact']);
  assert.equal(session.visitorId,'visitor-1');
  const script=f.attempts[0].script;
  assert.ok(script.indexOf("redis.call('GET',KEYS[2])")<script.indexOf("redis.call('LPUSH',KEYS[1]"));
  assert.ok(script.indexOf("redis.call('LPUSH',KEYS[1]")<script.indexOf("redis.call('SET',KEYS[2]"));
  assert.match(script,/7776000/);
});
test('simultaneous page views retain both events, both pages and a single session index',async()=>{
  const f=fixture();
  const [a,b]=await Promise.all([
    f.record({type:'page_view',sessionId:'shared',path:'/pricing',visitorId:'visitor'}),
    f.record({type:'page_view',sessionId:'shared',path:'/contact',visitorId:'visitor'})
  ]);
  assert.notEqual(a.id,b.id);
  assert.equal(f.events.length,2);
  assert.equal(f.index.length,1);
  assert.equal(f.index[0],'shared');
  assert.equal(f.values.get('site:session:shared').events,2);
  assert.deepEqual(Array.from(f.values.get('site:session:shared').pages),['/pricing','/contact']);
  assert.ok(f.attempts.length>=3);
});
test('repeat page views and engagement update one bounded session without double-indexing',async()=>{
  const f=fixture();
  await f.record({type:'page_view',sessionId:'s1',path:'/demo'});
  await f.record({type:'page_view',sessionId:'s1',path:'/demo'});
  await f.record({type:'engagement',sessionId:'s1',activeMs:34567});
  const stored=f.values.get('site:session:s1');
  assert.deepEqual(Array.from(stored.pages),['/demo']);
  assert.equal(stored.events,3);
  assert.equal(stored.activeMs,34567);
  assert.equal(f.events.length,3);
  assert.equal(f.index.length,1);
});
test('tracking without session ID still appends its event without a session index',async()=>{
  const f=fixture();
  await f.record({type:'cta_click',label:'demo'});
  assert.equal(f.events.length,1);
  assert.equal(f.index.length,0);
  assert.equal(f.attempts[0].keys.length,1);
});
test('conflicts exhaust before event append and malformed session records fail closed',async()=>{
  const f=fixture({forceConflicts:4});
  await assert.rejects(()=>f.record({type:'page_view',sessionId:'s1',path:'/'}),/changed during tracking/);
  assert.equal(f.events.length,0);assert.equal(f.index.length,0);
  const damaged=fixture();
  damaged.values.set('site:session:s1',{id:'s1'});
  await assert.rejects(()=>damaged.record({type:'page_view',sessionId:'s1',path:'/'}),/session is malformed/);
  assert.equal(damaged.events.length,0);
});
test('invalid engagement times cannot poison session active-time totals',async()=>{
  const f=fixture();
  const event=await f.record({type:'engagement',sessionId:'s1',activeMs:'nonsense'});
  assert.equal(event.activeMs,0);
  const large=await f.record({type:'engagement',sessionId:'s1',activeMs:99999999});
  assert.equal(large.activeMs,3600000);
  assert.equal(f.values.get('site:session:s1').activeMs,3600000);
});

test('malformed stored session counters or pages fail closed without logging the event',async()=>{
  const cases=[
    {id:'s1',firstAt:100,lastAt:200,activeMs:'invalid',events:1,pages:[]},
    {id:'s1',firstAt:100,lastAt:200,activeMs:20,events:'not-a-count',pages:[]},
    {id:'s1',firstAt:100,lastAt:200,activeMs:20,events:1,pages:'not-an-array'},
    {id:'s1',firstAt:100,lastAt:'invalid',activeMs:20,events:1,pages:[]}
  ];
  for(const prior of cases){
    const f=fixture();
    f.values.set('site:session:s1',prior);
    await assert.rejects(()=>f.record({type:'engagement',sessionId:'s1',activeMs:200}),/session is malformed/);
    assert.equal(f.events.length,0);
    assert.equal(f.index.length,0);
    assert.equal(f.values.get('site:session:s1'),prior);
  }
});

test('malformed tracking event or new-session directory cannot leave partially published data',async()=>{
  for(const [options,message] of [
    [{invalidEventDirectory:true},/event directory is malformed/],
    [{invalidSessionDirectory:true},/session directory is malformed/]
  ]){
    const f=fixture(options);
    await assert.rejects(()=>f.record({type:'page_view',sessionId:'new-session',path:'/'}),message);
    assert.equal(f.events.length,0);
    assert.equal(f.values.size,0);
    assert.equal(f.index.length,0);
  }
  const script=fixture().attempts;
  const sourceScript=source.slice(source.indexOf('const SITE_EVENT_ATOMIC_RECORD='),source.indexOf('async function recordSiteEvent('));
  assert.ok(sourceScript.indexOf("redis.call('TYPE',KEYS[1])")<sourceScript.indexOf("redis.call('LPUSH',KEYS[1]"));
  assert.ok(sourceScript.indexOf("redis.call('TYPE',KEYS[3])")<sourceScript.indexOf("redis.call('SET',KEYS[2]"));
});
