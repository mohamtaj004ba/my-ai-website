const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {effectiveFollowup,buildClientFollowupSnapshot}=require('../lib/client-followup-snapshot');
const source=fs.readFileSync('dashboard.js','utf8');
const rules=source.slice(source.indexOf('const CALL_DISPOSITIONS='),source.indexOf('function teamStatusLabel('));
function portal(call,saved){const ctx=vm.createContext({followupState:saved?{[call.id]:saved}:{}});vm.runInContext(rules,ctx);return {status:ctx.teamStatusForCall(call),requires:ctx.callNeedsTeam(call),disposition:ctx.callDispositionKey(call)};}

test('Intelligence counts implicit pending follow-ups instead of interpreting missing saved state as zero',()=>{
  const calls=Array.from({length:32},(_,i)=>({id:String(i),category:'New service',reason:i>=2&&i<12?'No heat / furnace issue':'Furnace replacement estimate'}));
  const snapshot=buildClientFollowupSnapshot(calls,{'0':{status:'completed'},'1':{status:'handled'}});
  assert.deepEqual(snapshot.totals,{pending:30,priority:10,completed:2,dismissed:0,noAction:0,total:32});
  assert.equal(snapshot.calls[2].followup,'pending');assert.equal(snapshot.calls[0].followup,'completed');
});

test('server effective statuses agree with the actual portal classifier for legacy and explicit outcomes',()=>{
  const records=[...['New service','Estimate follow-up','Vendor','Employment','Existing job','Billing','Warranty','Spam','Wrong number','Complaint','General question','Other'].map(category=>({category})),...['Missed','Incomplete','Failed intake','Transferred','Resolved','Answered','Qualified','Request captured','Follow-up','Message taken'].map(outcome=>({category:'General question',outcome})),...['urgent leak','gas odor','carbon monoxide','no heat','Roof estimate'].map(reason=>({reason})),...['resolved_by_ai','request_captured','message_taken','transferred','escalated','incomplete','non_customer'].map(disposition=>({disposition}))];
  for(const record of records)for(const status of [undefined,'open','handled','needs_action','in_progress','completed','dismissed','no_action','unknown']){
    const call={id:'call',...record},saved=status===undefined?undefined:{status},ui=portal(call,saved),server=effectiveFollowup(call,saved);
    assert.equal(server.status,['needs_action','in_progress'].includes(ui.status)?'pending':ui.status,JSON.stringify({record,status}));
    assert.equal(server.requiresFollowup,ui.requires);assert.equal(server.disposition,ui.disposition);
  }
});

test('authoritative follow-up totals cover all calls even when Intelligence samples fifty',()=>{
  const calls=Array.from({length:70},(_,i)=>({id:String(i),category:'New service'})),snapshot=buildClientFollowupSnapshot(calls,{'51':{status:'dismissed'},'60':{status:'completed'}});
  assert.equal(snapshot.calls.length,50);assert.equal(snapshot.totals.pending,68);assert.equal(snapshot.totals.completed,1);assert.equal(snapshot.totals.dismissed,1);
});

test('resolved, transferred and non-customer calls do not inflate the dashboard follow-up queue',()=>{
  const snapshot=buildClientFollowupSnapshot([{id:'a',disposition:'resolved_by_ai'},{id:'b',outcome:'Transferred'},{id:'c',category:'Spam'}],{a:{status:'needs_action'}});
  assert.equal(snapshot.totals.pending,0);assert.equal(snapshot.totals.total,0);
});

test('unverifiable follow-up records fail instead of producing a misleading count',()=>{
  for(const state of [[],{a:null},{a:[]},{a:'completed'}])assert.throws(()=>buildClientFollowupSnapshot([{id:'a'}],state));
  assert.throws(()=>buildClientFollowupSnapshot([{caller:'Missing identity'}],{}));
});

test('client guide sends effective totals to GPT and rejects malformed history before calling the provider',async()=>{
  const api=fs.readFileSync('api/account.js','utf8'),guide=api.slice(api.indexOf('async function clientAiGuide('),api.indexOf('async function adminAiGuide('));
  async function run(state){let payload,calls=0;const ctx=vm.createContext({buildClientFollowupSnapshot,process:{env:{OPENAI_API_KEY:'test-key'}},Date,console,kv:{get:async key=>key.startsWith('calls:')?Array.from({length:60},(_,i)=>({id:String(i),category:'New service'})):key.startsWith('agent:')?{}:state,incr:async()=>1,expire:async()=>{}},intelligenceAccess:async()=>({session:{workspaceId:'test'},workspace:{name:'Test',plan:'Pro'}}),intelligenceTool:{},intelligenceResponseText:()=> 'Test answer',safeError:String,fetch:async(_url,request)=>{calls++;payload=JSON.parse(request.body);return {ok:true,json:async()=>({model:'test-model',output:[]})}}});vm.runInContext(guide,ctx);const result={},res={status(code){result.status=code;return this},json(body){result.body=body;return this}};await ctx.clientAiGuide({body:{question:'How many pending follow-ups?'}},res);return {result,calls,payload};}
  const ok=await run({});assert.equal(ok.result.status,200);const snapshot=JSON.parse(ok.payload.input.split('SERVER SNAPSHOT:\n')[1]);assert.equal(snapshot.followups.totals.pending,60);assert.equal(snapshot.calls.length,50);assert.equal(snapshot.coverage.callsTotal,60);assert.match(ok.payload.instructions,/Use followups\.totals/);
  const bad=await run({'0':[]});assert.equal(bad.result.status,503);assert.equal(bad.calls,0);
});
