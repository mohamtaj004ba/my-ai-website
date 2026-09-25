const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

test('contact history fetches message bodies on demand and merges only matching tenant results',async()=>{
  const summary={id:'thread-1',name:'Mary Rivera',phone:'(509) 555-0101',messageCount:2},full={...summary,messages:[{text:'First'},{text:'Second'}]},timeline={innerHTML:''};
  const context=vm.createContext({
    conversationsData:[summary],contactHistoryHydratedKeys:new Set(),contactHistoryLoadingKeys:new Set(),activeContactKey:'p:5095550101',
    buildContacts:()=>[{key:'p:5095550101',conversations:context.conversationsData}],renderContactHistoryTimeline:value=>{context.rendered=value},
    fetchJsonRetry:async url=>{context.requestUrl=url;return {conversations:[full]}},document:{getElementById:id=>id==='contactDrawerTimeline'?timeline:null},
    encodeURIComponent,esc:value=>String(value??''),demoMode:false
  });
  const start=source.indexOf('async function hydrateContactHistory('),end=source.indexOf('\nfunction openContact(',start);
  vm.runInContext(source.slice(start,end),context);
  await vm.runInContext("hydrateContactHistory('p:5095550101')",context);
  assert.match(context.requestUrl,/action=contact-conversations/);assert.match(context.requestUrl,/p%3A5095550101/);
  assert.deepEqual(Array.from(context.conversationsData[0].messages,message=>message.text),['First','Second']);
  assert.equal(context.contactHistoryHydratedKeys.has('p:5095550101'),true);assert.equal(context.rendered.key,'p:5095550101');
});

test('contact history does not request message bodies twice after hydration',async()=>{
  let requests=0;const record={id:'thread-1',messageCount:1},context=vm.createContext({
    conversationsData:[record],contactHistoryHydratedKeys:new Set(['p:1']),contactHistoryLoadingKeys:new Set(),activeContactKey:'p:1',
    buildContacts:()=>[{key:'p:1',conversations:context.conversationsData}],renderContactHistoryTimeline:()=>{},fetchJsonRetry:async()=>{requests++;return {conversations:[]}},
    document:{getElementById:()=>null},encodeURIComponent,esc:String,demoMode:false
  });
  const start=source.indexOf('async function hydrateContactHistory('),end=source.indexOf('\nfunction openContact(',start);vm.runInContext(source.slice(start,end),context);
  await vm.runInContext("hydrateContactHistory('p:1')",context);assert.equal(requests,0);
});
