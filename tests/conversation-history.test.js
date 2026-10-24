const test=require('node:test');
const assert=require('node:assert/strict');
const {conversationSummary,conversationContactKey,paginateConversations,paginateMessages}=require('../lib/conversation-history');

function records(count=125){
  return Array.from({length:count},(_,index)=>({id:'thread-'+index,name:'Customer '+index,phone:'555-'+index,status:index%3===0?'Active':index%3===1?'Closed':'Needs follow-up',createdAt:index+1,privateField:'kept',messages:[{text:'Opening '+index,at:index+1},{text:'Needle '+index,at:index+1000}]}));
}

test('conversation pages are stable, bounded summaries with newest activity first',()=>{
  const all=records(),first=paginateConversations(all,{limit:50}),second=paginateConversations(all,{limit:50,cursor:first.nextCursor}),third=paginateConversations(all,{limit:50,cursor:second.nextCursor});
  assert.equal(first.total,125);assert.equal(first.conversations.length,50);assert.equal(second.conversations.length,50);assert.equal(third.conversations.length,25);assert.equal(third.nextCursor,null);
  assert.equal(first.conversations[0].id,'thread-124');assert.equal(first.conversations[0].messageCount,2);assert.equal('privateField' in first.conversations[0],false);assert.equal('messages' in first.conversations[0],false);
  assert.equal(new Set([...first.conversations,...second.conversations,...third.conversations].map(item=>item.id)).size,125);
});

test('conversation filters and search include message history and exact active status',()=>{
  const all=[...records(9),{id:'inactive',status:'Inactive',messages:[{text:'Elsewhere'}]}];
  const active=paginateConversations(all,{filter:'active'});assert.ok(active.conversations.length);assert.ok(active.conversations.every(item=>item.status==='Active'));assert.equal(active.conversations.some(item=>item.id==='inactive'),false);
  const attention=paginateConversations(all,{filter:'attention'});assert.ok(attention.conversations.every(item=>/follow/i.test(item.status)));
  const searched=paginateConversations(all,{q:'needle 4'});assert.deepEqual(searched.conversations.map(item=>item.id),['thread-4']);
  const oldest=paginateConversations(all,{sort:'oldest',limit:1});assert.equal(oldest.conversations[0].id,'inactive');
});

test('conversation cursor cannot be reused with changed filters and limits are capped',()=>{
  const first=paginateConversations(records(),{limit:500});assert.equal(first.limit,100);assert.equal(first.conversations.length,100);
  assert.throws(()=>paginateConversations(records(),{cursor:first.nextCursor,filter:'closed'}),error=>error.code==='INVALID_CURSOR');
  assert.throws(()=>paginateConversations(records(),{cursor:'not-a-cursor'}),error=>error.code==='INVALID_CURSOR');
});

test('message pages walk backward from the newest message without duplication',()=>{
  const conversation={id:'long',messages:Array.from({length:122},(_,index)=>({text:'Message '+index}))};
  const latest=paginateMessages(conversation,{limit:50}),middle=paginateMessages(conversation,{limit:50,cursor:latest.nextCursor}),oldest=paginateMessages(conversation,{limit:50,cursor:middle.nextCursor});
  assert.equal(latest.messages[0].text,'Message 72');assert.equal(latest.messages.at(-1).text,'Message 121');assert.equal(middle.messages[0].text,'Message 22');assert.equal(oldest.messages.length,22);assert.equal(oldest.nextCursor,null);
  assert.equal([...oldest.messages,...middle.messages,...latest.messages].length,122);
  assert.throws(()=>paginateMessages({...conversation,id:'other'},{cursor:latest.nextCursor}),error=>error.code==='INVALID_CURSOR');
});

test('malformed conversation messages become an empty safe summary and page',()=>{
  const conversation={id:'broken',messages:{text:'nope'}};
  assert.deepEqual(conversationSummary(conversation),{id:'broken',name:undefined,phone:undefined,address:undefined,status:undefined,last:undefined,time:undefined,createdAt:undefined,updatedAt:undefined,messageCount:0,activityAt:0});
  assert.deepEqual(paginateMessages(conversation),{messages:[],total:0,nextCursor:null,limit:50});
});

test('contact keys normalize formatted phone numbers and fallback names consistently',()=>{
  assert.equal(conversationContactKey({phone:'+1 (509) 555-0101',name:'Ignored'}),'p:15095550101');
  assert.equal(conversationContactKey({name:'  Mary   Rivera  '}),'n:mary rivera');
  assert.equal(conversationContactKey({caller:'Vendor Desk'}),'n:vendor desk');
});

test('account conversation reads stay tenant scoped and expose bounded history routes',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','api','account.js'),'utf8');
  for(const handler of ['conversations','conversationDetail','conversationMessages','contactConversations']){
    const start=source.indexOf('async function '+handler+'('),end=source.indexOf('\nasync function ',start+20),body=source.slice(start,end<0?source.length:end);
    assert.match(body,/requireFeature\(req,res,'unifiedInbox'\)/);assert.match(body,/access\.session\.workspaceId/);assert.doesNotMatch(body,/req\.query\.workspaceId/);
  }
  assert.match(source,/require\('\.\.\/lib\/conversation-store'\)/);
  assert.match(source,/publishNormalizedConversations\(kv,workspaceId,dataset\.conversations/);
  assert.match(source,/deleteNormalizedConversations\(kv,id\)/);
  assert.match(source,/readAllConversations\(kv,id\)/);
  assert.match(source,/action==='conversation-detail'/);assert.match(source,/action==='conversation-messages'/);
  assert.match(source,/action==='contact-conversations'/);
  assert.match(source,/conversations:conversationDirectory,conversationPage/);
});
