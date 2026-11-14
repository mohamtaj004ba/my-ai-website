const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function response(data,ok=true){return {ok,json:async()=>data}}
function fixture(){
  const requests=new Map(),alerts=[],statuses=[];
  const fetch=async url=>{const id=new URL('https://example.test'+url).searchParams.get('id'),pending=deferred();requests.set(id,pending);return pending.promise};
  const gmailThread={id:'gmail-one',unread:false,messages:[{body:'Newest Gmail'}],prospect:null};
  const context=vm.createContext({
    adminInboxOpenRequest:0,currentInboxItem:null,adminInboxData:{gmail:{threads:[gmailThread],analytics:{unread:0}}},fetch,encodeURIComponent,
    alert:value=>alerts.push(value),setAdminInboxActionStatus:(message,tone='')=>statuses.push({message:String(message||''),tone:String(tone||'')}),renderInboxThread(){},renderAdminInbox(){}
  });
  const start=source.indexOf('async function openInboxItem('),end=source.indexOf('\nfunction inboxContactParts(',start);vm.runInContext(source.slice(start,end),context);
  return {context,requests,alerts,statuses};
}

test('a slower website conversation cannot replace a newer inbox selection',async()=>{
  const {context,requests}=fixture(),first=vm.runInContext("openInboxItem('website','first')",context),second=vm.runInContext("openInboxItem('website','second')",context);
  requests.get('second').resolve(response({prospect:{id:'second'},messages:[{body:'Second'}],coverage:{verified:true,truncated:false,retainedMessages:1,totalMessages:1}}));await second;
  requests.get('first').resolve(response({prospect:{id:'first'},messages:[{body:'First'}],coverage:{verified:true,truncated:false,retainedMessages:1,totalMessages:1}}));await first;
  assert.equal(context.currentInboxItem.id,'second');assert.equal(context.currentInboxItem.messages[0].body,'Second');
});

test('selecting Gmail invalidates an in-flight website request and its stale error',async()=>{
  const {context,requests,alerts}=fixture(),pending=vm.runInContext("openInboxItem('website','first')",context);
  await vm.runInContext("openInboxItem('gmail','gmail-one')",context);
  requests.get('first').resolve(response({error:'Old request failed'},false));await pending;
  assert.equal(context.currentInboxItem.kind,'gmail');assert.equal(context.currentInboxItem.id,'gmail-one');assert.deepEqual(alerts,[]);
});


test('incomplete successful website conversation does not replace the previous inbox item',async()=>{
  const {context,requests,alerts,statuses}=fixture();
  context.currentInboxItem={kind:'gmail',id:'gmail-one',messages:[{body:'Existing'}]};
  const pending=vm.runInContext("openInboxItem('website','first')",context);
  requests.get('first').resolve(response({prospect:{id:'first'},messages:[]}));
  await pending;
  assert.equal(context.currentInboxItem.kind,'gmail');
  assert.equal(context.currentInboxItem.id,'gmail-one');
  assert.deepEqual(alerts,[]);
  assert.ok(statuses.some(item=>item.tone==='error'&&/incomplete/i.test(item.message)));
});

test('website inbox load failures stay inline instead of using browser alerts',async()=>{
  const {context,requests,alerts,statuses}=fixture();
  const pending=vm.runInContext("openInboxItem('website','first')",context);
  requests.get('first').resolve(response({error:'Temporary website inbox outage'},false));
  await pending;
  assert.deepEqual(alerts,[]);
  assert.ok(statuses.some(item=>item.tone==='error'&&/Temporary website inbox outage/.test(item.message)));
});
