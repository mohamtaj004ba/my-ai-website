const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('lib/gmail.js','utf8');
function fixture({list={threads:[{id:'thread',historyId:'history'}],resultSizeEstimate:1},thread,cached,aliases}={}){
  const writes=[],connection={gmailEmail:'primary@test.example'};
  const validThread={id:'thread',historyId:'history',messages:[{id:'message',threadId:'thread',internalDate:'1720000000000',labelIds:['INBOX'],payload:{mimeType:'text/plain',headers:[{name:'From',value:'sender@test.example'}],body:{data:Buffer.from('Hello').toString('base64url')}}}]};
  const kv={get:async key=>key.startsWith('integration:gmail:')?connection:cached||null,set:async(key,value)=>writes.push({key,value})};
  const ctx=vm.createContext({require:name=>name==='./kv'?{kv}:name==='./config-transaction'?require('../lib/config-transaction'):require(name),module:{exports:{}},process:{env:{}},Buffer,URL,URLSearchParams,Date,setTimeout});
  vm.runInContext(source,ctx);
  ctx.gmailFetch=async(_admin,path)=>path.startsWith('/threads?')?list:path.startsWith('/threads/')?(thread===undefined?validThread:thread):path==='/settings/sendAs'?(aliases===undefined?{sendAs:[{sendAsEmail:'primary@test.example',isPrimary:true}]}:aliases):{messages:[]};
  return {ctx,api:ctx.module.exports,writes,kv};
}

test('confirmed Gmail sends survive cache invalidation failure without a duplicate provider request',async()=>{
  const f=fixture();let calls=0;
  f.kv.del=async()=>{throw Error('Cache unavailable')};
  f.ctx.gmailFetch=async()=>{calls++;return {id:'sent-message',threadId:'thread'}};
  const result=await f.api.sendMessage('admin@test.example',{to:'recipient@test.example',subject:'Reply',body:'Hello',threadId:'thread',expectedGmailEmail:'primary@test.example'});
  assert.equal(result.id,'sent-message');assert.equal(result.threadId,'thread');assert.match(result.warning,/message sent.*cached detail/);assert.equal(calls,1);
});
test('confirmed Gmail read receipt survives cache invalidation failure',async()=>{
  const f=fixture();let calls=0;
  f.kv.del=async()=>{throw Error('Cache unavailable')};
  f.ctx.gmailFetch=async()=>{calls++;return {id:'thread'}};
  const result=await f.api.markThreadRead('admin@test.example','thread','primary@test.example');
  assert.equal(result.id,'thread');assert.match(result.warning,/marked this thread as read/);assert.equal(calls,1);
});
test('unverified Gmail mutation receipts still fail before cache cleanup',async()=>{
  const f=fixture();let deletions=0;f.kv.del=async()=>{deletions++};f.ctx.gmailFetch=async()=>({id:'wrong',threadId:'wrong'});
  await assert.rejects(f.api.markThreadRead('admin@test.example','thread','primary@test.example'),/response could not be verified/);
  await assert.rejects(f.api.sendMessage('admin@test.example',{to:'recipient@test.example',subject:'Reply',body:'Hello',threadId:'thread',expectedGmailEmail:'primary@test.example'}),/response could not be verified/);
  assert.equal(deletions,0);
});
test('Gmail API receipts preserve confirmed mutations and independent cache/Growth warnings',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function adminGmailRead('),end=account.indexOf('\nasync function adminWebsiteConversation(',start);
  const ctx=vm.createContext({requireAdmin:async()=>({email:'admin@test.example'}),cleanEmail:value=>String(value||'').trim().toLowerCase(),
    markGmailThreadRead:async()=>({id:'thread',warning:'Read confirmed; cache unavailable.'}),validatedGmailFrom:async()=> 'primary@test.example',
    sendGmailMessage:async()=>({id:'sent',threadId:'thread',warning:'Send confirmed; cache unavailable.'}),kv:{get:async()=>{throw Error('Growth unavailable')}},emailKey:value=>value,safeError:()=> 'Unavailable',console:{error(){}}});
  vm.runInContext(account.slice(start,end),ctx);
  const res=()=>({code:0,body:null,status(code){this.code=code;return this},json(body){this.body=body;return this}});
  const read=res();await ctx.adminGmailRead({body:{threadId:'thread',expectedGmailEmail:'primary@test.example'}},read);
  assert.equal(read.code,200);assert.equal(read.body.ok,true);assert.match(read.body.warning,/Read confirmed/);
  const sent=res();await ctx.adminGmailSend({body:{to:'recipient@test.example',subject:'Reply',body:'Hello',threadId:'thread',expectedGmailEmail:'primary@test.example'}},sent);
  assert.equal(sent.code,200);assert.equal(sent.body.ok,true);assert.equal(sent.body.id,'sent');assert.match(sent.body.warning,/Send confirmed.*lead follow-up status/);
});
test('Gmail transport rejects invalid JSON and non-object successful responses',async()=>{
  for(const body of [null,[], 'unexpected','invalid-json']){
    const f=fixture();f.ctx.accessToken=async()=> 'mock-token';f.ctx.fetch=async()=>({ok:true,json:async()=>{if(body==='invalid-json')throw Error('Invalid JSON');return body}});
    const original=source.slice(source.indexOf('async function gmailFetch('),source.indexOf('\nfunction b64urlDecode('));vm.runInContext(original,f.ctx);
    await assert.rejects(f.ctx.gmailFetch('admin@test.example','/threads'),/response could not be verified/);
  }
});
test('malformed thread collections, identities and coverage cannot become a verified empty inbox',async()=>{
  for(const list of [{threads:null},{threads:{}},{threads:[{}]},{threads:[{id:'thread'},{id:'thread'}]},{threads:[],resultSizeEstimate:'10'},{threads:[],nextPageToken:{}}]){
    const f=fixture({list});await assert.rejects(f.api.listInbox('admin@test.example'),/could not be verified/);assert.equal(f.writes.length,0);
  }
});
test('legitimate empty thread responses remain supported',async()=>{
  for(const list of [{},{resultSizeEstimate:0},{threads:[],resultSizeEstimate:0}]){
    const f=fixture({list}),result=await f.api.listInbox('admin@test.example');assert.equal(result.threads.length,0);assert.equal(result.coverage.verified,true);assert.equal(result.coverage.limited,false);
  }
});
test('incomplete or mismatched thread hydration cannot overwrite cached detail',async()=>{
  for(const thread of [{id:'other',messages:[]},{id:'thread'},{id:'thread',messages:[]},{id:'thread',messages:[null]},{id:'thread',messages:[{id:'message',payload:{headers:'broken'}}]},{id:'thread',messages:[{id:'message',threadId:'other',payload:{}}]}]){
    const f=fixture({thread});await assert.rejects(f.api.listInbox('admin@test.example'),/thread detail could not be verified/);assert.equal(f.writes.length,0);
  }
});
test('malformed matching-history thread cache is rehydrated from verified provider detail',async()=>{
  const f=fixture({cached:{historyId:'history',thread:{id:'other',messages:[{id:'stale'}]}}}),result=await f.api.listInbox('admin@test.example');
  assert.equal(result.threads[0].id,'thread');assert.equal(result.threads[0].messages[0].body,'Hello');assert.equal(f.writes.length,1);
});
test('sender alias responses require primary identity, valid flags and canonical addresses',async()=>{
  for(const aliases of [{},{sendAs:[]},{sendAs:[{sendAsEmail:'custom@test.example'}]},{sendAs:[{sendAsEmail:'primary@test.example',isPrimary:'false'}]},{sendAs:[{sendAsEmail:'bad',isPrimary:true}]},{sendAs:[{sendAsEmail:'primary@test.example',isPrimary:true,verificationStatus:'invented'}]}]){
    const f=fixture({aliases});await assert.rejects(f.api.listAliases('admin@test.example'),/aliases could not be verified/);
  }
});
test('unknown custom-alias verification is retained as unknown instead of accepted',async()=>{
  const f=fixture({aliases:{sendAs:[{sendAsEmail:'primary@test.example',isPrimary:true},{sendAsEmail:'custom@test.example',isDefault:true}]}}),aliases=await f.api.listAliases('admin@test.example');
  assert.equal(aliases[0].verificationStatus,'accepted');assert.equal(aliases[1].verificationStatus,'verificationStatusUnspecified');
});
test('unknown default alias cannot replace the verified primary sender',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function validatedGmailFrom('),end=account.indexOf('\nfunction validGmailAliases(',start);
  const ctx=vm.createContext({getGmailConnection:async()=>({gmailEmail:'primary@test.example',refreshTokenEnc:'encrypted'}),cleanEmail:value=>String(value||'').trim().toLowerCase(),listGmailAliases:async()=>[{email:'unknown@test.example',isDefault:true,verificationStatus:'verificationStatusUnspecified'},{email:'primary@test.example',isPrimary:true}]});
  vm.runInContext(account.slice(start,end),ctx);assert.equal(await ctx.validatedGmailFrom('admin@test.example'),'primary@test.example');
});

test('failed or malformed inbound alias probe remains unverified rather than asserting no inbound mail',async()=>{
  for(const malformed of [false,true]){
    const f=fixture();f.ctx.gmailFetch=async(_admin,path)=>{if(path==='/settings/sendAs')return {sendAs:[{sendAsEmail:'primary@test.example',isPrimary:true}]};if(malformed)return {messages:null};throw Error('Probe unavailable')};
    const aliases=await f.api.listAliases('admin@test.example');assert.equal(aliases[0].inboundVerified,false);assert.equal(aliases[0].inboundSeen,false);
  }
  const f=fixture(),aliases=await f.api.listAliases('admin@test.example');assert.equal(aliases[0].inboundVerified,true);assert.equal(aliases[0].inboundSeen,false);
});

test('alias chips distinguish unknown verification and unavailable inbound evidence',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8'),start=ui.indexOf('function renderAdminInbox('),end=ui.indexOf('\nfunction setAdminInboxActionStatus(',start),nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},querySelector:()=>null,querySelectorAll:()=>[]});return nodes.get(id)};
  const ctx=vm.createContext({adminInboxData:{gmailStatus:{connected:true,gmailEmail:'primary@test.example'},gmail:{analytics:{}},aliases:[{email:'unknown@test.example',verificationStatus:'verificationStatusUnspecified',inboundSeen:false,inboundVerified:false}],search:''},
    websiteInboxItems:()=>[],gmailInboxItems:()=>[],currentInboxItem:null,gmailConnectionMutationPending:false,esc:value=>String(value||''),document:{getElementById:node,querySelectorAll:()=>[]}});
  vm.runInContext(ui.slice(start,end),ctx);ctx.renderAdminInbox();
  const html=node('inboxAliasList').innerHTML||node('gmailAliasList').innerHTML;
  assert.match(html,/Verification unverified/);assert.match(html,/Inbound check unverified/);assert.doesNotMatch(html,/No inbound seen yet/);
});
