const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
function fixture(kind='gmail'){
  let resolve;const held=new Promise(ok=>{resolve=ok}),requests=[],nodes=new Map(),renders=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,readOnly:false});return nodes.get(id)};
  node('inboxReplyText').value='Reviewed reply';node('inboxFromSelect').value='old@test.example';
  const original={kind,id:'thread',thread:{subject:'Inquiry'},prospect:kind==='website'?{email:'customer@test.example'}:null,messages:[{direction:'inbound',from:'customer@test.example',messageId:'message'}]};
  const ctx=vm.createContext({currentInboxItem:original,adminInboxReplyPending:false,adminInboxOpenRequest:1,
    adminInboxData:{connectionRevision:0,gmailStatus:{connected:true,gmailEmail:'old@test.example'},gmail:{threads:[]}},adminWebsiteData:{prospects:[]},
    document:{getElementById:node,querySelector:()=>node('submit')},fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return held},
    loadAdminInbox:async()=>{},setAdminInboxActionStatus:message=>{node('globalStatus').textContent=message},
    renderInboxThread:()=>{renders.push('thread');node('inboxReplyText').value='';node('inboxReplyStatus').textContent=''},renderAdminInbox:()=>renders.push('inbox'),renderWebsiteAnalytics:()=>{},renderAdminFleet:()=>{}});
  const reply=source.slice(source.indexOf('async function sendInboxReply('),source.indexOf('\nlet gmailConnectionMutationPending='));
  const open=source.slice(source.indexOf('async function openInboxItem('),source.indexOf('\nfunction inboxContactParts('));
  vm.runInContext(reply+'\n'+open,ctx);
  return {ctx,node,original,requests,renders,resolve,send:()=>ctx.sendInboxReply()};
}
test('pending reply blocks duplicate sends and inbox selection changes',async()=>{
  const f=fixture(),first=f.send();assert.equal(await f.send(),false);
  assert.equal(await f.ctx.openInboxItem('website','other'),false);assert.equal(f.ctx.adminInboxOpenRequest,1);assert.equal(f.requests.length,1);
  assert.equal(f.node('inboxReplyText').readOnly,true);
  f.resolve({ok:false,json:async()=>({error:'Not sent'})});assert.equal(await first,false);
  assert.equal(f.node('inboxReplyText').value,'Reviewed reply');assert.equal(f.ctx.adminInboxReplyPending,false);
});
test('confirmed Gmail reply with failed refresh reports sent and does not invite a duplicate retry',async()=>{
  const f=fixture();f.ctx.loadAdminInbox=async()=>{throw Error('Offline')};const pending=f.send();
  f.resolve({ok:true,json:async()=>({ok:true,id:'sent',threadId:'thread'})});assert.equal(await pending,true);
  assert.match(f.node('inboxReplyStatus').textContent,/reply was sent.*could not refresh/);assert.equal(f.node('inboxReplyText').value,'');
  assert.equal(f.requests[0].body.expectedGmailEmail,'old@test.example');assert.equal(f.requests.length,1);
});
test('uncertain reply retains the draft and explicit delivery review instructions without retrying',async()=>{
  const f=fixture(),pending=f.send();f.resolve({ok:false,json:async()=>({error:'Gmail delivery could not be confirmed. Check Gmail Sent before retrying; another send could create duplicate mail.',deliveryStatus:'uncertain',retrySafe:false})});
  assert.equal(await pending,false);assert.equal(f.node('inboxReplyText').value,'Reviewed reply');assert.match(f.node('inboxReplyStatus').textContent,/Check Gmail Sent.*duplicate mail/);assert.equal(f.requests.length,1);
});
test('confirmed Gmail send placed in another thread clears the sent draft and preserves reviewed conversation',async()=>{
  const f=fixture();f.ctx.loadAdminInbox=async()=>{f.ctx.adminInboxData.gmail.threads=[{id:'new-thread',messages:[]}]};const pending=f.send();
  f.resolve({ok:true,json:async()=>({ok:true,id:'sent',threadId:'new-thread',warning:'Gmail message sent, but Gmail placed it in a different thread.'})});
  assert.equal(await pending,true);assert.equal(f.ctx.currentInboxItem,f.original);assert.equal(f.node('inboxReplyText').value,'');assert.match(f.node('inboxReplyStatus').textContent,/message sent.*different thread/);assert.equal(f.requests.length,1);
});
test('confirmed Gmail reply after account switch preserves new mailbox and announces original sender',async()=>{
  const f=fixture(),pending=f.send(),newItem={kind:'gmail',id:'thread',messages:[{body:'New mailbox'}]};
  f.ctx.adminInboxData.connectionRevision=1;f.ctx.adminInboxData.gmailStatus.gmailEmail='new@test.example';f.ctx.currentInboxItem=newItem;
  f.resolve({ok:true,json:async()=>({ok:true,id:'sent',threadId:'thread'})});assert.equal(await pending,true);
  assert.equal(f.ctx.currentInboxItem,newItem);assert.equal(newItem.messages.length,1);assert.equal(f.renders.length,0);
  assert.match(f.node('globalStatus').textContent,/Reply sent from old@test.example.*account changed/);
});
test('website reply receipt updates captured conversation without appending to a newer selection',async()=>{
  const f=fixture('website'),pending=f.send(),newItem={kind:'website',id:'new',messages:[]};f.ctx.currentInboxItem=newItem;f.node('inboxReplyText').value='New draft';
  assert.equal(f.requests[0].body.expectedRecipientEmail,'customer@test.example');
  f.resolve({ok:true,json:async()=>({ok:true,message:{id:'sent',body:'Reviewed reply'}})});assert.equal(await pending,true);
  assert.equal(f.original.messages.length,2);assert.equal(newItem.messages.length,0);assert.equal(f.node('inboxReplyText').value,'New draft');
  assert.match(f.node('globalStatus').textContent,/Reply sent.*selected conversation changed/);assert.equal(f.renders.length,0);
});
