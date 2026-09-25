const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const code=source.slice(source.indexOf('function serviceRequestStageLabel('),source.indexOf('function openContact('));

function fixture(){
  const timeline={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
  const context=vm.createContext({
    contactHistoryFilter:'all',contactHistoryVisibleLimit:50,contactHistoryLastSignature:'',contactMessageSessionLimits:{},
    recordTime:x=>Number(x.createdAt||0),normalizedCallNotes:()=>[],esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
    document:{getElementById:id=>id==='contactDrawerTimeline'?timeline:null,querySelectorAll:()=>[]},CSS:{escape:x=>x},
    TEAM_STATUS_META:{no_action:{label:'No action',tone:'gray'}},teamStatusForCall:()=> 'no_action',callDispositionMeta:()=>({label:'Resolved'}),callDispositionClass:()=>'',markCallViewed:()=>{},demoMode:true,fetchJsonRetry:async()=>({}),callsData:[],console:{warn:()=>{}}
  });
  vm.runInContext(code,context);return {context,timeline};
}

function contact(count){return {key:'p:1',name:'Customer',calls:[],conversations:[],leads:Array.from({length:count},(_,i)=>({id:String(i),service:'Request '+i,stage:'New',source:'CallerCore',createdAt:count-i}))}}

test('contact activity renders in 50-item batches and exposes accurate counts',()=>{
  const {context,timeline}=fixture();context.item=contact(125);vm.runInContext('renderContactHistoryTimeline(item)',context);
  assert.equal((timeline.innerHTML.match(/contact-history-card request/g)||[]).length,50);assert.match(timeline.innerHTML,/Showing 50 of 125 activity items/);assert.match(timeline.innerHTML,/Load 50 more/);
  context.contactHistoryVisibleLimit=100;vm.runInContext('renderContactHistoryTimeline(item)',context);assert.equal((timeline.innerHTML.match(/contact-history-card request/g)||[]).length,100);
  context.contactHistoryVisibleLimit=150;vm.runInContext('renderContactHistoryTimeline(item)',context);assert.equal((timeline.innerHTML.match(/contact-history-card request/g)||[]).length,125);assert.doesNotMatch(timeline.innerHTML,/Load \d+ more/);
});

test('changing contact or filter resets activity and message limits',()=>{
  const {context}=fixture();context.item=contact(80);context.contactHistoryVisibleLimit=100;context.contactMessageSessionLimits={old:200};vm.runInContext('renderContactHistoryTimeline(item)',context);
  assert.equal(context.contactHistoryVisibleLimit,50);assert.deepEqual(Object.keys(context.contactMessageSessionLimits),[]);
  context.contactHistoryVisibleLimit=100;context.contactHistoryFilter='request';vm.runInContext('renderContactHistoryTimeline(item)',context);assert.equal(context.contactHistoryVisibleLimit,50);
});

test('large contact message sessions show the newest 50 and load older batches',()=>{
  const {context}=fixture();context.session={day:'2026-09-25',firstAt:1,lastAt:1000,messages:Array.from({length:1000},(_,i)=>({text:'Message '+i,at:i+1,dir:i%2?'in':'out'}))};
  const key=vm.runInContext('contactMessageSessionKey(session)',context);let html=vm.runInContext('contactMessageSessionHtml(session,contactMessageSessionKey(session))',context);
  assert.equal((html.match(/class="contact-message /g)||[]).length,50);assert.match(html,/Showing 50 of 1000 messages/);assert.match(html,/Message 999/);assert.doesNotMatch(html,/Message 949</);
  context.contactMessageSessionLimits[key]=100;html=vm.runInContext('contactMessageSessionHtml(session,contactMessageSessionKey(session))',context);assert.equal((html.match(/class="contact-message /g)||[]).length,100);
});

test('malformed conversation message collections are ignored in contact history',()=>{
  const {context}=fixture();context.item={key:'p:1',name:'Customer',calls:[],leads:[],conversations:[{messages:{broken:true}}]};assert.doesNotThrow(()=>vm.runInContext('contactHistoryEvents(item)',context));
});
