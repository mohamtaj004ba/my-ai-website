const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ui=fs.readFileSync('dashboard.js','utf8');

function persistBlock(){
  const start=ui.indexOf('async function persistTeamStatus(');
  const end=ui.indexOf('\nfunction requestTeamStatusChange(',start);
  assert.ok(start>=0&&end>start);
  return ui.slice(start,end);
}
function noteBlock(){
  const start=ui.indexOf('async function saveCallNote(');
  const end=ui.indexOf('\nasync function moveLead(',start);
  assert.ok(start>=0&&end>start);
  return ui.slice(start,end);
}

test('follow-up status mutation serializes per call and restores controls in finally',()=>{
  const block=persistBlock();
  assert.match(ui,/const followupMutationPending=new Set\(\)/);
  assert.match(block,/if\(followupMutationPending\.has\(key\)\)return false/);
  assert.match(block,/followupMutationPending\.add\(key\)/);
  assert.match(block,/data\.ok!==true/);
  assert.match(block,/String\(confirmed\.status\|\|'\'\)!==String\(status\)/);
  assert.match(block,/Number\.isFinite\(Number\(confirmed\.updatedAt\)\)/);
  assert.match(block,/finally\{followupMutationPending\.delete\(key\)/);
  assert.match(ui,/data-team-status="'\+esc\(x\.id\)\+'" '\+\(followupMutationPending\.has\(String\(x\.id\)\)\?'disabled aria-busy="true"'/);
});

test('call note save and delete share the follow-up per-call mutation lock',()=>{
  const block=noteBlock();
  assert.match(block,/saveCallNote\(\)[\s\S]*followupMutationPending\.has\(key\)/);
  assert.match(block,/deleteCallNote\(noteId\)[\s\S]*followupMutationPending\.has\(key\)/);
  assert.ok((block.match(/followupMutationPending\.add\(key\)/g)||[]).length>=2);
  assert.ok((block.match(/followupMutationPending\.delete\(key\)/g)||[]).length>=2);
  assert.match(ui,/drawerNotesList[\s\S]*pending\?'disabled aria-busy="true"'/);
});

test('second team-status update is rejected while the first request is pending',async()=>{
  const block=persistBlock();
  let release,requests=0;
  const followupState={'call-1':{status:'needs_action',notes:[],updatedAt:1}};
  const ctx=vm.createContext({
    followupMutationPending:new Set(),followupState,callsData:[{id:'call-1'}],activeCallId:'',
    renderLeads(){},renderOverview(){},renderCalls(){},syncDrawerTeamStatus(){},demoMode:false,
    fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({ok:true,state:{'call-1':{status:'in_progress',notes:[],updatedAt:2}}})}},
    console:{error(){}},String,Number,Array,Object,Date,Set,Promise,Error
  });
  vm.runInContext(block,ctx);
  const first=vm.runInContext("persistTeamStatus('call-1','in_progress')",ctx);
  await new Promise(resolve=>setImmediate(resolve));
  const second=await vm.runInContext("persistTeamStatus('call-1','dismissed')",ctx);
  assert.equal(second,false);
  assert.equal(requests,1);
  release();
  assert.equal(await first,true);
  assert.equal(ctx.followupState['call-1'].status,'in_progress');
  assert.equal(vm.runInContext("followupMutationPending.has('call-1')",ctx),false);
});
