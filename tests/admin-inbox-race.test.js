const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function response(data,ok=true){return {ok,json:async()=>data}}
function fixture(){
  const requests=new Map(),alerts=[];
  const fetch=async url=>{const id=new URL('https://example.test'+url).searchParams.get('id'),pending=deferred();requests.set(id,pending);return pending.promise};
  const gmailThread={id:'gmail-one',unread:false,messages:[{body:'Newest Gmail'}],prospect:null};
  const context=vm.createContext({
    adminInboxOpenRequest:0,currentInboxItem:null,adminInboxData:{gmail:{threads:[gmailThread],analytics:{unread:0}}},fetch,encodeURIComponent,
    alert:value=>alerts.push(value),renderInboxThread(){},renderAdminInbox(){}
  });
  const start=source.indexOf('async function openInboxItem('),end=source.indexOf('\nfunction inboxContactParts(',start);vm.runInContext(source.slice(start,end),context);
  return {context,requests,alerts};
}

test('a slower website conversation cannot replace a newer inbox selection',async()=>{
  const {context,requests}=fixture(),first=vm.runInContext("openInboxItem('website','first')",context),second=vm.runInContext("openInboxItem('website','second')",context);
  requests.get('second').resolve(response({prospect:{id:'second'},messages:[{body:'Second'}]}));await second;
  requests.get('first').resolve(response({prospect:{id:'first'},messages:[{body:'First'}]}));await first;
  assert.equal(context.currentInboxItem.id,'second');assert.equal(context.currentInboxItem.messages[0].body,'Second');
});

test('selecting Gmail invalidates an in-flight website request and its stale error',async()=>{
  const {context,requests,alerts}=fixture(),pending=vm.runInContext("openInboxItem('website','first')",context);
  await vm.runInContext("openInboxItem('gmail','gmail-one')",context);
  requests.get('first').resolve(response({error:'Old request failed'},false));await pending;
  assert.equal(context.currentInboxItem.kind,'gmail');assert.equal(context.currentInboxItem.id,'gmail-one');assert.deepEqual(alerts,[]);
});
