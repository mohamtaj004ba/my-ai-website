const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function deferred(){let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve}}
function fixture(){
  const nodes=new Map(),node=id=>{
    if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',disabled:false,title:'',tabIndex:0,dataset:{},className:'',scrollHeight:0,focus(){},classList:{values:new Set(),add(value){this.values.add(value)},remove(value){this.values.delete(value)},contains(value){return this.values.has(value)},toggle(value,on){if(on)this.add(value);else this.remove(value)}},setAttribute(name,value){this[name]=String(value)},removeAttribute(name){delete this[name]},querySelector(){return {disabled:false}}});
    return nodes.get(id);
  };
  const requests=new Map(),fetchJsonRetry=async url=>{const id=new URL('https://example.test'+url).searchParams.get('id'),pending=deferred();requests.set(id,pending);return pending.promise};
  const callsData=[{id:'one',caller:'First'},{id:'two',caller:'Second'}],body={classList:{add(){},remove(){}}},context=vm.createContext({
    callsData,demoMode:false,callDrawerOpenRequest:0,activeCallContactKey:'',activeCallId:'',activeNoteEditId:'',followupState:{},fetchJsonRetry,encodeURIComponent,console:{warn(){}},String,
    contactKey:x=>'p:'+x.id,markCallViewed(){},syncDrawerTeamStatus(){},callNeedsTeam:()=>false,teamStatusForCall:()=> 'no_action',resetNoteComposer(){},renderCallNotes(){},formatFullDateTime:()=>'',callDispositionMeta:()=>({label:'Resolved',copy:'Done'}),TEAM_STATUS_META:{no_action:{label:'No action',tone:'gray'}},callDispositionClass:()=>'',contactForRecord:()=>null,esc:String,resetSurfaceScroll(){},setTimeout:fn=>fn(),document:{body,getElementById:node}
  });
  const start=source.indexOf('async function openCall('),end=source.indexOf('\nfunction money(',start);vm.runInContext(source.slice(start,end),context);
  return {context,node,requests};
}

test('a slower call detail response cannot replace a newer drawer selection',async()=>{
  const {context,node,requests}=fixture(),first=vm.runInContext("openCall('one')",context),second=vm.runInContext("openCall('two')",context);
  requests.get('two').resolve({call:{id:'two',caller:'Second',transcript:[]}});await second;
  requests.get('one').resolve({call:{id:'one',caller:'First',transcript:[]}});await first;
  assert.equal(context.activeCallId,'two');assert.equal(node('drawerCaller').textContent,'Second');assert.equal(node('callDrawer')['aria-hidden'],'false');
  assert.equal(context.callsData.find(call=>call.id==='one').transcript,undefined);
});

test('closing the call drawer invalidates an in-flight detail response',async()=>{
  const {context,node,requests}=fixture(),pending=vm.runInContext("openCall('one')",context);vm.runInContext('closeCall()',context);
  requests.get('one').resolve({call:{id:'one',caller:'First',transcript:[]}});await pending;
  assert.equal(context.activeCallId,'');assert.equal(node('callDrawer')['aria-hidden'],'true');assert.equal(node('callDrawer').classList.contains('open'),false);
});
