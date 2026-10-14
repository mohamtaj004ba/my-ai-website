'use strict';
// Independent behavioral tests execute the shipped UI, not a substitute state machine.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../agent-operations-command-center.js'),'utf8');
class Element{
 constructor(tag='div'){this.tag=tag;this.value='';this.textContent='';this.children=[];this.dataset={};this.style={};this.disabled=false;this.hidden=false;this.checked=false;this.open=false;this.listeners={};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 async emit(type,event={preventDefault(){}}){for(const listener of this.listeners[type]||[])await listener(event);}
 querySelectorAll(selector){const all=this.children.flatMap(x=>[x,...x.querySelectorAll('*')]),parts=selector.split(',');return all.filter(x=>parts.some(p=>p==='*'||p==='details[open]'?p==='*'||x.tag==='details'&&x.open:x.tag===p));}
}
const contents=e=>[e.textContent,...e.children.map(contents)].join(' ');
function state(revision=1,{ownerHash='a'.repeat(64),workspaceHash='b'.repeat(64),plans=[]}={}){return{
 version:'internal-operations-v1',revision,at:1700000000000+revision,runtime:{sourceCommit:'c'.repeat(40),release:{digest:'d'.repeat(64)}},scopeIdentity:{ownerHash,workspaceHash},plans,incidents:[],audit:[],permissions:{paidExecution:false,writesEnabled:false},reviewPolicy:{},organization:{templates:[{id:'budget-audit',name:'Budget report',department:'finance-operations'}],departments:[]},monitoring:{status:'observed-r'+revision,budget:{retainedMicros:10600000,pendingMicros:2200000,remainingMicros:4400000},activity:[],attribution:[],alerts:[],dependencies:{provider:{status:'unknown'}}}
};}
function plan(revision=1){return{id:'op_existing',revision,status:'queued',objective:'Existing zero-provider plan',priority:'normal',modelCalls:0,tasks:[{id:'op_existing_one',template:'budget-audit',department:'finance-operations',role:'finance-cost-control',status:'queued',dependsOn:[],recoveryCount:0}]};}
const draftInput=idempotencyKey=>({idempotencyKey,objective:'Cached bounded internal assignment.',priority:'normal',durationMs:600000,subtasks:[{key:'task1',template:'budget-audit',dependsOn:[]}]});
function harness(reply,storage=new Map()){
 const elements=new Map(),calls=[],intervals=[],get=id=>{if(!elements.has(id))elements.set(id,new Element(id==='opsForm'?'form':['opsRefresh','opsCreate','opsEmergency','opsSync','opsRetry','opsEngineeringPreset'].includes(id)?'button':id==='opsObjective'?'textarea':id==='opsPriority'||id==='opsSequence'?'select':'div'));return elements.get(id);};
 get('opsObjective').value='Read owned internal records.';get('opsPriority').value='normal';get('opsSequence').value='ordered';
 get('agentOpsCommandCenter').querySelectorAll=selector=>[...elements.values()].filter(e=>e!==get('agentOpsCommandCenter')).flatMap(e=>[e,...e.querySelectorAll(selector)]).filter(e=>selector.split(',').includes(e.tag));
 const context={window:{},document:{getElementById:get,createElement:tag=>new Element(tag)},crypto:crypto.webcrypto,AbortSignal,Date,setInterval:fn=>intervals.push(fn),sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{assert.equal(url,'/api/agent-operations');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');const body=JSON.parse(options.body);calls.push(body);return{ok:true,json:async()=>({operatingSystem:await reply(body)})};}};
 vm.runInNewContext(source,context);
 return{get,calls,storage,intervals,update:value=>context.window.CallerCoreOperations.update(value===null?null:{operatingSystem:value}),refresh:()=>get('opsRefresh').emit('click'),submit:async()=>{await get('opsForm').emit('submit');await new Promise(setImmediate);},retry:()=>get('opsRetry').emit('click'),run:()=>get('opsPlans').querySelectorAll('button').find(b=>b.textContent==='Run next internal task').emit('click')};
}

test('older main dashboard GET cannot overwrite a newer local operation readback',async()=>{
 const h=harness(async body=>body.action==='operations-read'?state(7,{plans:[plan(3)]}):{completed:true});
 h.update(state(5,{plans:[plan()]}));await h.run();assert.match(contents(h.get('opsOverview')),/observed-r7/);
 h.update(state(6,{plans:[plan(2)]}));assert.match(contents(h.get('opsOverview')),/observed-r7/);assert.doesNotMatch(contents(h.get('opsOverview')),/observed-r6/);
});

test('malformed refresh and operation readback never report confirmed success',async()=>{
 for(const mode of ['refresh','mutation']){const h=harness(async()=>({version:'internal-operations-v1',status:'unavailable'}));h.update(state(1,{plans:[plan()]}));if(mode==='refresh')await h.refresh();else await h.run();
  assert.doesNotMatch(h.get('opsStatus').textContent,/Operation verified|Operational state refreshed/);assert.match(h.get('opsStatus').textContent,/unavailable|unconfirmed|stale/i);assert.equal(h.get('opsCreate').disabled,true);
 }
});

test('session loss invalidates an in-flight refresh response without restoring controls',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.update(state());const pending=h.refresh();await new Promise(setImmediate);h.update(null);resolve(state(2));await pending;
 assert.equal(h.get('agentOpsCommandCenter').hidden,true);assert.equal(h.get('opsCreate').disabled,true);assert.doesNotMatch(h.get('opsStatus').textContent,/Operational state refreshed/);
});

test('session loss during a mutation cannot install its later readback or report verified work',async()=>{
 let resolve;const h=harness(body=>body.action==='operations-run'?new Promise(r=>resolve=r):state(3,{plans:[plan(2)]}));h.update(state(1,{plans:[plan()]}));const pending=h.run();await new Promise(setImmediate);h.update(null);resolve({completed:true});await pending;
 assert.equal(h.get('agentOpsCommandCenter').hidden,true);assert.equal(h.get('opsCreate').disabled,true);assert.doesNotMatch(h.get('opsStatus').textContent,/Operation verified/);
});

test('saved assignment keys are scoped to both owner and workspace and cannot be resent under another session',async()=>{
 for(const foreign of [{ownerHash:'f'.repeat(64),workspaceHash:'b'.repeat(64)},{ownerHash:'a'.repeat(64),workspaceHash:'f'.repeat(64)}]){
  const storage=new Map([['callercore-internal-assignment-pending-v1',JSON.stringify({...foreign,input:draftInput('foreign_assignment_001')})]]),h=harness(async()=>{throw Error('Foreign draft must never dispatch');},storage);h.update(state());assert.equal(h.get('opsRetry').disabled,true);await h.retry();assert.equal(h.calls.length,0);
 }
});

test('uncertain Create preserves its exact key, never retries automatically, and refresh reconciles committed state',async()=>{
 const storage=new Map();let submitted;const h=harness(async body=>{submitted=body.input;throw Error('Response lost after Create commit');},storage);h.update(state());await h.submit();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].action,'operations-create');assert.equal(storage.size,1);assert.match(h.get('opsStatus').textContent,/unconfirmed/i);assert.equal(submitted.subtasks[0].template,'budget-audit');
 const saved=JSON.parse([...storage.values()][0]);assert.deepEqual(saved.input,submitted);assert.equal(saved.ownerHash,'a'.repeat(64));assert.equal(saved.workspaceHash,'b'.repeat(64));
 const resumed=harness(async()=>state(2,{plans:[{...plan(),idempotencyKey:submitted.idempotencyKey}]}),storage);resumed.update(state());await resumed.refresh();assert.equal(storage.size,0);assert.equal(resumed.calls.length,1);assert.equal(resumed.calls[0].action,'operations-read');
});

test('corrupt same-owner journal cannot throw dashboard rendering or resend malformed input',async()=>{
 for(const draft of [{input:null},{},{input:{objective:'Missing idempotency key'}}]){
  const raw=JSON.stringify({ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),...draft}),storage=new Map([['callercore-internal-assignment-pending-v1',raw]]),h=harness(async()=>{throw Error('Corrupt cached input must never dispatch');},storage);
  assert.doesNotThrow(()=>h.update(state(1,{plans:[plan()]})),'local cache damage must not escape through the dashboard update callback');
  assert.equal(h.get('opsRefresh').disabled,false);assert.equal(h.get('opsSync').disabled,false);assert.equal(h.get('opsRetry').disabled,true);await h.retry();assert.equal(h.calls.length,0);
  assert.match(h.get('opsPending').textContent+' '+h.get('opsStatus').textContent,/corrupt|invalid|unusable|quarantin|malformed|damaged/i,'show a local draft warning rather than claiming backend failure');
  assert([...storage.values()].some(value=>value===raw),'preserve the original damaged draft for explicit recovery or quarantine');
 }
});

test('valid main dashboard update clears initial and previously unavailable operational labels',()=>{
 for(const prior of ['initial','unavailable']){const h=harness(async()=>{throw Error('No fetch needed for a valid dashboard snapshot');});if(prior==='initial')h.get('opsStatus').textContent='No operational snapshot loaded.';else h.update(null);
  h.update(state());assert.equal(h.get('agentOpsCommandCenter').hidden,false);assert.equal(h.get('opsCreate').disabled,false);assert.doesNotMatch(h.get('opsStatus').textContent,/No operational snapshot loaded|unavailable|unconfirmed/i);assert(h.get('opsStatus').textContent.trim().length>0);
 }
});

test('malformed JSON or unavailable local storage leaves monitoring usable and never dispatches a draft',async()=>{
 class Unreadable extends Map{get(){throw Error('Storage access denied');}}
 for(const storage of [new Map([['callercore-internal-assignment-pending-v1','{not JSON']]),new Unreadable()]){const h=harness(async()=>{throw Error('No draft dispatch allowed');},storage);assert.doesNotThrow(()=>h.update(state()));assert.equal(h.get('opsCreate').disabled,true);assert.equal(h.get('opsRetry').disabled,true);assert.equal(h.get('opsSync').disabled,false);await h.submit();await h.retry();assert.equal(h.calls.length,0);assert.match(h.get('opsPending').textContent,/invalid|quarantin/i);}
 class Unwritable extends Map{set(){throw Error('Storage quota exceeded');}}
 const h=harness(async()=>{throw Error('Create must not dispatch without durable local key');},new Unwritable());h.update(state());await h.submit();assert.equal(h.calls.length,0);assert.match(h.get('opsStatus').textContent,/not submitted/i);
});

test('failed removal of a reconciled draft keeps it quarantined and disables new submission in the same render',async()=>{
 let deletions=0;class Undeletable extends Map{delete(){deletions++;throw Error('Storage deletion denied');}}
 const raw=JSON.stringify({ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),input:draftInput('pending_saved_key_001')}),storage=new Undeletable([['callercore-internal-assignment-pending-v1',raw]]),h=harness(async()=>{throw Error('Reconciled but uncleared draft must not dispatch');},storage);
 h.update(state(2,{plans:[{...plan(),idempotencyKey:'pending_saved_key_001'}]}));assert.equal(deletions,1,'exercise actual reconciliation rather than rejecting an incomplete fixture');assert.equal(h.get('opsCreate').disabled,true);assert.equal(h.get('opsRetry').disabled,true);assert.equal(h.get('opsSync').disabled,false);assert.match(h.get('opsPending').textContent,/quarantin/i);await h.submit();await h.retry();assert.equal(h.calls.length,0);assert.equal(storage.get('callercore-internal-assignment-pending-v1'),raw);
});

test('present primitive or incomplete cache values are quarantined rather than mistaken for absent drafts',async()=>{
 for(const raw of ['false','0','""','null','[]','{}',JSON.stringify({ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),input:{idempotencyKey:'complete_key_but_missing_task'}})]){
  const storage=new Map([['callercore-internal-assignment-pending-v1',raw]]),h=harness(async()=>{throw Error('Invalid cached draft must not submit');},storage);assert.doesNotThrow(()=>h.update(state()));assert.equal(h.get('opsCreate').disabled,true);assert.equal(h.get('opsRetry').disabled,true);assert.equal(h.get('opsSync').disabled,false);await h.submit();await h.retry();assert.equal(h.calls.length,0);assert.equal(storage.get('callercore-internal-assignment-pending-v1'),raw);assert.match(h.get('opsPending').textContent,/quarantin/i);
 }
});

test('cached idempotency keys must meet backend string and eighty-character limits',async()=>{
 for(const key of [12345678,'x'.repeat(81)]){const raw=JSON.stringify({ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),input:draftInput(key)}),h=harness(async()=>{throw Error('Backend-invalid key must never resend');},new Map([['callercore-internal-assignment-pending-v1',raw]]));h.update(state());assert.equal(h.get('opsRetry').disabled,true);await h.retry();assert.equal(h.calls.length,0);assert.match(h.get('opsPending').textContent,/quarantin/i);}
});

function engineeringState(){const v=state();v.organization=require('../lib/agent-operations-departments').directory();return v;}
test('incomplete engineering checkbox selection is rejected before saving a key or sending Create',async()=>{
 for(const selected of [['engineering-propose'],['engineering-review'],['engineering-draft'],['engineering-inspect','engineering-draft']]){const h=harness(async()=>{throw Error('Invalid DAG must not dispatch');});h.update(engineeringState());for(const checkbox of h.get('opsTemplates').querySelectorAll('input'))checkbox.checked=selected.includes(checkbox.value);await h.submit();assert.equal(h.calls.length,0);assert.equal(h.storage.size,0);assert.match(h.get('opsStatus').textContent,/required.*predecessor/i);assert.equal(h.get('opsCreate').disabled,false);}
});

test('engineering preset constructs the actual five-stage backend-valid fixed-demo chain without hidden state or automatic submission',async()=>{
 let input;const h=harness(async body=>{input=body.input;throw Error('Controlled unconfirmed Create boundary');});h.update(engineeringState());assert.equal(h.get('opsTemplates').querySelectorAll('input').some(i=>i.checked&&i.value.startsWith('engineering-')),false);
 await h.get('opsEngineeringPreset').emit('click');assert.equal(h.calls.length,0);assert.equal(h.storage.size,0);assert.equal(h.get('opsSequence').value,'ordered');
 const stages=['engineering-inspect','engineering-propose','engineering-review','engineering-draft','engineering-prepare-demo'];assert.deepEqual(h.get('opsTemplates').querySelectorAll('input').filter(i=>i.checked).map(i=>i.value),stages);
 await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0].action,'operations-create');assert.deepEqual(input.subtasks.map(t=>t.template),stages);assert.deepEqual(input.subtasks.map(t=>t.dependsOn),[[],['task1'],['task2'],['task3'],['task4']]);assert(input.subtasks.every(t=>Object.keys(t).sort().join(',')==='dependsOn,key,template'));
 assert.doesNotThrow(()=>require('../lib/agent-operations-operating-system').makePlan(input,{origin:'https://ui-fixture.vercel.app',sourceCommit:'a'.repeat(40),branch:'feature/callercore-dashboards',release:{digest:'b'.repeat(64)}},1000000));assert.deepEqual(JSON.parse([...h.storage.values()][0]).input,input);
});

test('explicit engineering dependencies survive parallel mode while ordered mode retains additional selected-task edges',async()=>{
 for(const sequence of ['parallel','ordered']){let input;const h=harness(async body=>{input=body.input;throw Error('Controlled unconfirmed Create boundary');});h.update(engineeringState());for(const i of h.get('opsTemplates').querySelectorAll('input'))i.checked=i.value.startsWith('engineering-')||i.value==='budget-audit';h.get('opsSequence').value=sequence;await h.submit();assert.equal(h.calls.length,1);
  const byTemplate=new Map(input.subtasks.map(t=>[t.template,t]));for(const [template,required] of [['engineering-propose','engineering-inspect'],['engineering-review','engineering-propose'],['engineering-draft','engineering-review'],['engineering-prepare-demo','engineering-draft']])assert(byTemplate.get(template).dependsOn.includes(byTemplate.get(required).key));
  assert.deepEqual(byTemplate.get('budget-audit').dependsOn,sequence==='ordered'?[byTemplate.get('engineering-prepare-demo').key]:[]);assert.doesNotThrow(()=>require('../lib/agent-operations-engineering').routing(input.subtasks));
 }
});

test('empty task selection, whitespace or oversized objectives and invalid priority cannot poison the pending journal',async()=>{
 for(const change of [h=>h.get('opsTemplates').querySelectorAll('input').forEach(i=>i.checked=false),h=>h.get('opsObjective').value='   \n  ',h=>h.get('opsObjective').value='',h=>h.get('opsObjective').value='x'.repeat(1001),h=>h.get('opsPriority').value='elevate-permissions']){const h=harness(async()=>{throw Error('Invalid form must not submit');});h.update(state());change(h);await h.submit();assert.equal(h.calls.length,0);assert.equal(h.storage.size,0);assert.match(h.get('opsStatus').textContent,/No draft was saved or request sent/);assert.equal(h.get('opsCreate').disabled,false);}
});

test('user-opened Chief engineering report survives refreshed snapshots without forcing other details open',()=>{
 const p={...plan(),status:'completed',report:{engineering:{version:'engineering-chief-report-v1',reasoning:'deterministic-consolidation-not-model',acceptedWork:false,businessAcceptance:'not-granted',groups:[]}}},h=harness(async()=>{throw Error('Snapshot rendering must not dispatch');});
 const chief=()=>h.get('opsPlans').querySelectorAll('details').find(d=>d.children[0]?.textContent.startsWith('Chief engineering report'));
 h.update(state(1,{plans:[p]}));const original=chief();assert(original);assert.equal(original.open,false);original.open=true;
 h.update(state(2,{plans:[structuredClone(p)]}));assert.notEqual(chief(),original);assert.equal(chief().open,true);assert.equal(h.get('opsPlans').querySelectorAll('details').filter(d=>d!==chief()).every(d=>!d.open),true);
 chief().open=false;h.update(state(3,{plans:[structuredClone(p)]}));assert.equal(chief().open,false);assert.equal(h.calls.length,0);
});
