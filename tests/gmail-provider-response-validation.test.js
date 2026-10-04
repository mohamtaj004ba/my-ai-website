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
  f.ctx.gmailFetch=async()=>({id:123,threadId:'thread'});
  await assert.rejects(f.api.sendMessage('admin@test.example',{to:'recipient@test.example',subject:'Reply',body:'Hello',threadId:'thread',expectedGmailEmail:'primary@test.example'}),/response could not be verified/);
  assert.equal(deletions,0);
});
test('confirmed send in a different Gmail thread reports linkage uncertainty without retrying mail',async()=>{
  const f=fixture(),keys=[];let calls=0;f.kv.del=async key=>keys.push(key);
  f.ctx.gmailFetch=async()=>{calls++;return {id:'sent-message',threadId:'new-thread'}};
  const result=await f.api.sendMessage('admin@test.example',{to:'recipient@test.example',subject:'Reply',body:'Hello',threadId:'thread',expectedGmailEmail:'primary@test.example'});
  assert.equal(result.id,'sent-message');assert.equal(result.threadId,'new-thread');assert.equal(result.threadMismatch,true);assert.match(result.warning,/message sent.*different thread/);assert.equal(calls,1);assert.equal(keys.length,2);assert.notEqual(keys[0],keys[1]);
});
test('different-thread and cache recovery warnings both survive a confirmed Gmail send',async()=>{
  const f=fixture();f.kv.del=async()=>{throw Error('Cache unavailable')};f.ctx.gmailFetch=async()=>({id:'sent-message',threadId:'new-thread'});
  const result=await f.api.sendMessage('admin@test.example',{to:'recipient@test.example',subject:'Reply',body:'Hello',threadId:'thread',expectedGmailEmail:'primary@test.example'});
  assert.match(result.warning,/different thread.*cached detail/);assert.equal(result.threadMismatch,true);
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
test('Gmail retry rechecks account identity after quota backoff before issuing another request',async()=>{
  const f=fixture();let accountChanged=false,calls=0,tokenChecks=0;
  f.ctx.accessToken=async(_admin,expected)=>{tokenChecks++;assert.equal(expected,'primary@test.example');if(accountChanged)throw Object.assign(Error('Gmail account changed'),{code:'GMAIL_CONNECTION_CHANGED'});return 'token'};
  f.ctx.fetch=async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{message:'Quota exceeded'}}),headers:{get:()=>null}}};
  f.ctx.setTimeout=resolve=>{accountChanged=true;resolve()};
  vm.runInContext(source.slice(source.indexOf('async function gmailFetch('),source.indexOf('\nfunction b64urlDecode(')),f.ctx);
  await assert.rejects(f.ctx.gmailFetch('admin@test.example','/messages/send',{method:'POST'},'primary@test.example'),error=>error.code==='GMAIL_CONNECTION_CHANGED');
  assert.equal(calls,1);assert.equal(tokenChecks,2);
});
test('Gmail quota backoff retains bounded retries for the same verified account',async()=>{
  const f=fixture();let calls=0,tokenChecks=0;
  f.ctx.accessToken=async()=>{tokenChecks++;return 'token'};f.ctx.setTimeout=resolve=>resolve();
  f.ctx.fetch=async()=>{calls++;return calls<3?{ok:false,status:429,json:async()=>({error:{message:'Quota exceeded'}}),headers:{get:()=>null}}:{ok:true,json:async()=>({threads:[]})}};
  vm.runInContext(source.slice(source.indexOf('async function gmailFetch('),source.indexOf('\nfunction b64urlDecode(')),f.ctx);
  assert.equal((await f.ctx.gmailFetch('admin@test.example','/threads',{},'primary@test.example')).threads.length,0);assert.equal(calls,3);assert.equal(tokenChecks,3);
});
test('lost transport, server failure and malformed Gmail send acknowledgements remain uncertain without automatic retry',async()=>{
  for(const mode of ['transport','server','json']){
    const f=fixture();let calls=0;f.ctx.accessToken=async()=> 'token';
    f.ctx.fetch=async()=>{calls++;if(mode==='transport')throw Error('Response lost');return {ok:mode!=='server',status:mode==='server'?503:200,json:async()=>{if(mode==='json')throw Error('Invalid JSON');return {error:{message:'Unavailable'}}}}};
    vm.runInContext(source.slice(source.indexOf('async function gmailFetch('),source.indexOf('\nfunction b64urlDecode(')),f.ctx);
    await assert.rejects(f.ctx.gmailFetch('admin@test.example','/messages/send',{method:'POST'},'primary@test.example'),error=>error.code==='GMAIL_DELIVERY_UNCERTAIN'&&error.deliveryState==='uncertain');assert.equal(calls,1);
  }
});
test('uncertain Gmail API receipt tells the operator to verify delivery before another send',async()=>{
  const account=fs.readFileSync('api/account.js','utf8'),start=account.indexOf('async function adminGmailSend('),end=account.indexOf('\nasync function adminWebsiteConversation(',start);
  const ctx=vm.createContext({requireAdmin:async()=>({email:'admin@test.example'}),cleanEmail:value=>String(value||'').trim().toLowerCase(),validatedGmailFrom:async()=> 'primary@test.example',sendGmailMessage:async()=>{throw Object.assign(Error('Acknowledgement lost'),{deliveryState:'uncertain'})},safeError:()=> 'Unavailable',console:{error(){}}});
  vm.runInContext(account.slice(start,end),ctx);const res={status(code){this.code=code;return this},json(body){this.body=body;return this}};
  await ctx.adminGmailSend({body:{to:'recipient@test.example',subject:'Reply',body:'Hello',expectedGmailEmail:'primary@test.example'}},res);
  assert.equal(res.code,502);assert.equal(res.body.retrySafe,false);assert.equal(res.body.deliveryStatus,'uncertain');assert.match(res.body.error,/Check Gmail Sent.*duplicate mail/);assert.notEqual(res.body.ok,true);
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
test('Gmail MIME extraction ignores binary and named attachments before the actual message body',()=>{
  const f=fixture(),encoded=value=>Buffer.from(value).toString('base64url');
  const payload={mimeType:'multipart/mixed',parts:[{mimeType:'application/pdf',body:{data:encoded('Binary attachment')}},{mimeType:'text/plain',filename:'notes.txt',body:{data:encoded('Attached notes')}},{mimeType:'text/plain',body:{data:encoded('Actual message')}}]};
  assert.equal(f.ctx.extractBody(payload),'Actual message');
});
test('Gmail MIME extraction prefers nested plain text and uses HTML only when no body text is available',()=>{
  const f=fixture(),encoded=value=>Buffer.from(value).toString('base64url');
  const html={mimeType:'text/html',body:{data:encoded('<p>HTML alternative</p>')}};
  assert.equal(f.ctx.extractBody({mimeType:'multipart/alternative',parts:[html,{mimeType:'multipart/related',parts:[{mimeType:'text/plain',body:{data:encoded('Plain alternative')}}]}]}),'Plain alternative');
  assert.equal(f.ctx.extractBody(html),'HTML alternative');
  assert.equal(f.ctx.extractBody({mimeType:'image/png',body:{data:encoded('Binary')}}),'');
});
test('malformed MIME structure cannot be substituted with an empty verified body',()=>{
  const f=fixture();for(const payload of [{mimeType:'multipart/mixed',parts:{}},{mimeType:'multipart/mixed',parts:[null]},{mimeType:'text/plain',body:{data:{}}},{mimeType:'text/plain',body:[]},{mimeType:123,body:{}},{filename:{},body:{}}])assert.throws(()=>f.ctx.extractBody(payload),/body could not be verified/);
});
test('Gmail body limits retain bounded text with explicit truncation metadata',async()=>{
  for(const size of [12000,12001]){
    const payload={mimeType:'text/plain',body:{data:Buffer.from('x'.repeat(size)).toString('base64url')}};
    const f=fixture({thread:{id:'thread',messages:[{id:'message',threadId:'thread',payload}]}}),result=await f.api.listInbox('admin@test.example');
    assert.equal(result.threads[0].messages[0].body.length,12000);assert.equal(result.threads[0].messages[0].bodyTruncated,size>12000);
  }
});
test('Inbox distinguishes shortened bodies, snippet previews and uncertain legacy content from complete body text',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8'),start=ui.indexOf('function renderInboxThread('),end=ui.indexOf('\nasync function sendInboxReply(',start),nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false});return nodes.get(id)};
  const ctx=vm.createContext({currentInboxItem:{kind:'gmail',id:'thread',thread:{subject:'Inquiry'},messages:[]},document:{getElementById:node},renderInboxContext(){},renderInboxFromOptions(){},esc:value=>String(value||'')});
  vm.runInContext(ui.slice(start,end),ctx);
  for(const [message,expected] of [[{body:'Body',bodyTruncated:true},/shortened or shown as a preview/],[{body:'',snippet:'Preview'},/shortened or shown as a preview/],[{body:'x'.repeat(12000)},/Full content cannot be verified/]]){
    ctx.currentInboxItem.messages=[{id:'message',from:'sender@test.example',at:1,...message}];ctx.renderInboxThread();assert.equal(node('inboxThreadCoverage').hidden,false);assert.match(node('inboxThreadCoverage').textContent,expected);
  }
  ctx.currentInboxItem.messages=[{id:'message',body:'x'.repeat(12000),bodyTruncated:false,at:1}];ctx.renderInboxThread();assert.equal(node('inboxThreadCoverage').hidden,true);
  for(const at of [undefined,0,'invalid',Infinity]){ctx.currentInboxItem.messages=[{id:'message',body:'Undated content',at}];ctx.renderInboxThread();assert.match(node('inboxMessages').innerHTML,/Date unavailable/)}
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
test('malformed cached message fields and duplicate identities rehydrate instead of trapping refresh until expiry',async()=>{
  for(const messages of [[{id:'message',body:{}}],[{id:'message',at:'invalid'}],[{id:'message',direction:'invalid'}],[{id:'message',unread:'false'}],[{id:'message',bodyTruncated:'false'}],[{id:'message'},{id:'message'}],[{id:'message'}]]){
    const f=fixture({cached:{historyId:'history',thread:{id:'thread',messages}}}),result=await f.api.listInbox('admin@test.example');
    assert.equal(result.threads[0].messages[0].body,'Hello');assert.equal(result.threads[0].messages.length,1);assert.equal(f.writes.length,1);
  }
});
test('canonical same-history thread cache remains reusable without another provider detail request',async()=>{
  const thread={id:'thread',messages:[{id:'message',threadId:'thread',body:'Verified cached text',direction:'inbound',unread:false,at:1}],subject:'Inquiry',unread:false,lastAt:1};
  const f=fixture({cached:{historyId:'history',thread}}),original=f.ctx.gmailFetch;
  f.ctx.gmailFetch=async(admin,path)=>{if(path.startsWith('/threads/thread?'))assert.fail('Verified cache must not rehydrate');return original(admin,path)};
  const result=await f.api.listInbox('admin@test.example');assert.equal(result.threads[0].messages[0].body,'Verified cached text');assert.equal(f.writes.length,0);
});
test('unverifiable provider message time, snippet or duplicate identity cannot populate thread cache',async()=>{
  const valid={id:'message',payload:{mimeType:'text/plain',body:{data:Buffer.from('Hello').toString('base64url')}}};
  for(const messages of [[{...valid,internalDate:'invalid'}],[{...valid,internalDate:''}],[{...valid,internalDate:-1}],[{...valid,snippet:{}}],[valid,valid]]){
    const f=fixture({thread:{id:'thread',messages}});await assert.rejects(f.api.listInbox('admin@test.example'),/identity, time or preview could not be verified/);assert.equal(f.writes.length,0);
  }
});
test('sender alias responses require primary identity, valid flags and canonical addresses',async()=>{
  for(const aliases of [{},{sendAs:[]},{sendAs:[{sendAsEmail:'custom@test.example'}]},{sendAs:[{sendAsEmail:'primary@test.example',isPrimary:'false'}]},{sendAs:[{sendAsEmail:'bad',isPrimary:true}]},{sendAs:[{sendAsEmail:'primary@test.example',isPrimary:true,verificationStatus:'invented'}]}]){
    const f=fixture({aliases});await assert.rejects(f.api.listAliases('admin@test.example'),/aliases could not be verified/);
  }
});
test('provider sender aliases reject a different primary identity or duplicate normalized address',async()=>{
  for(const sendAs of [[{sendAsEmail:'other@test.example',isPrimary:true}],[{sendAsEmail:'primary@test.example',isPrimary:true},{sendAsEmail:'PRIMARY@test.example',verificationStatus:'accepted'}]]){
    const f=fixture({aliases:{sendAs}});await assert.rejects(f.api.listAliases('admin@test.example'),/alias identity could not be verified/);
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
