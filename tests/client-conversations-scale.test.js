const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','dashboard.js'),'utf8');
function fixture(records){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},value:'',hidden:false,textContent:'',innerHTML:'',scrollTop:0,querySelectorAll:()=>[]});return nodes.get(id)};
  const ctx=vm.createContext({conversationsData:records,conversationFilter:'all',conversationVisibleLimit:50,conversationLastFilterSignature:'',activeConversationId:null,has:()=>true,esc:v=>String(v??'').replace(/</g,'&lt;'),recordTime:x=>Number(x.createdAt||0),contactKey:x=>x.id,document:{getElementById:node,querySelectorAll:()=>[]}});
  vm.runInContext(source.slice(source.indexOf('function conversationActivity('),source.indexOf('function contactKey(')),ctx);
  return {ctx,node,render:()=>vm.runInContext('renderConversations()',ctx)};
}
const records=()=>Array.from({length:125},(_,i)=>({id:String(i),name:'Customer '+i,status:i%2?'Closed':'Needs follow-up',createdAt:i+1,messages:[{text:'Message '+i,at:i+1}]}));
test('125 conversations render in bounded batches and filter changes reset the limit',()=>{
  const {ctx,node,render}=fixture(records());render();
  assert.equal((node('conversationThreads').innerHTML.match(/data-thread-id/g)||[]).length,50);
  assert.equal(node('conversationCount').textContent,'Showing 50 of 125 conversations');
  ctx.conversationVisibleLimit+=50;render();
  assert.equal((node('conversationThreads').innerHTML.match(/data-thread-id/g)||[]).length,100);
  node('conversationSearch').value='Message 1';render();
  assert.equal(ctx.conversationVisibleLimit,50);
  assert.equal(node('conversationCount').textContent,'Showing 36 of 36 conversations matching filters');
  assert.equal(node('loadMoreConversations').hidden,true);
});
test('latest message or update determines order, and sorting keeps selection visible',()=>{
  const {ctx,node,render}=fixture([{id:'a',createdAt:10,messages:[{at:300}]},{id:'b',createdAt:20,updatedAt:200,messages:[]}]);
  render();assert.equal(ctx.activeConversationId,'a');
  assert.ok(node('conversationThreads').innerHTML.indexOf('data-thread-id="a"')<node('conversationThreads').innerHTML.indexOf('data-thread-id="b"'));
  node('conversationSort').value='oldest';render();
  assert.ok(node('conversationThreads').innerHTML.indexOf('data-thread-id="b"')<node('conversationThreads').innerHTML.indexOf('data-thread-id="a"'));
  assert.equal(ctx.activeConversationId,'a');
});
test('empty search clears stale status/contact and recovery restores them',()=>{
  const {ctx,node,render}=fixture(records());render();
  node('conversationSearch').value='unmatched';render();
  assert.equal(ctx.activeConversationId,null);assert.equal(node('conversationStatus').hidden,true);assert.equal(node('conversationContactButton').hidden,true);
  node('conversationSearch').value='';render();
  assert.equal(node('conversationStatus').hidden,false);assert.equal(node('conversationContactButton').hidden,false);
});
test('Active excludes Inactive; malformed message arrays do not crash search',()=>{
  const {ctx,node,render}=fixture([{id:'1',name:'A',status:'Inactive',messages:{}},{id:'2',name:'B',status:'Active',messages:null}]);
  node('conversationSearch').value='a';render();
  node('conversationSearch').value='';ctx.conversationFilter='active';render();
  assert.equal(ctx.activeConversationId,'2');assert.equal(node('conversationCount').textContent,'Showing 1 of 1 conversations matching filters');
});
