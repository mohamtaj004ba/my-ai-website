const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8'),html=fs.readFileSync('dashboard.html','utf8');
const start=source.indexOf('let clientSupportHistoryRequest=0;');
const end=source.indexOf('function snapshotClientSupportThreadUi(wrap){',start);
assert.ok(start>=0&&end>start);

function harness(fetcher){
  const notice={hidden:true},button={disabled:false,textContent:'Retry history'};
  let rendered=0;
  const ctx=vm.createContext({
    document:{getElementById:id=>id==='clientSupportHistoryHealth'?notice:id==='clientSupportHistoryRetry'?button:null},
    fetchJsonRetry:fetcher,supportTicketsData:[{id:'previous'}],renderSupport:()=>{rendered++},
    console:{warn:()=>{}}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,notice,button,rendered:()=>rendered,load:()=>vm.runInContext('refreshClientSupportHistory()',ctx),invalidate:()=>vm.runInContext('invalidateClientSupportHistoryRequest()',ctx)};
}
test('support history error retains saved requests, displays warning and can recover on retry',async()=>{
  let failed=true;
  const h=harness(async()=>{if(failed)throw Error('offline');return {tickets:[{id:'current'}],coverage:{verified:true,incomplete:false}}});
  assert.equal(await h.load(),false);
  assert.equal(h.notice.hidden,false);
  assert.equal(h.ctx.supportTicketsData[0].id,'previous');
  assert.equal(h.button.disabled,false);
  failed=false;
  assert.equal(await h.load(),true);
  assert.equal(h.notice.hidden,true);
  assert.equal(h.ctx.supportTicketsData[0].id,'current');
  assert.equal(h.rendered(),2);
});
test('successful HTTP response without support tickets is not treated as empty history',async()=>{
  const h=harness(async()=>({error:'temporarily unavailable'}));
  assert.equal(await h.load(),false);
  assert.equal(h.notice.hidden,false);
  assert.equal(h.ctx.supportTicketsData[0].id,'previous');
});
test('late support history response cannot replace current records or clear current coverage',async()=>{
  let release,held=true;
  const pending=new Promise(resolve=>{release=resolve});
  const h=harness(async()=>held?pending:{tickets:[{id:'newer'}],coverage:{verified:true,incomplete:false}});
  const old=h.load();await Promise.resolve();
  held=false;assert.equal(await h.load(),true);
  release({tickets:[{id:'stale'}],coverage:{verified:true,incomplete:false}});assert.equal(await old,false);
  assert.equal(h.ctx.supportTicketsData[0].id,'newer');
  assert.equal(h.notice.hidden,true);
});
test('support history warning, empty-state coverage and precise notification retry are wired',()=>{
  assert.match(html,/id="clientSupportHistoryHealth"[^>]*role="status"/);
  assert.match(html,/id="clientSupportHistoryRetry"/);
  assert.match(source,/empty.hidden=supportTicketsData.length!==0\|\|!!\(notice&&!notice.hidden\)/);
  assert.match(source,/if\(await refreshClientSupportHistory\(\)\)thread=document.querySelector/);
  assert.match(source,/getElementById\('clientSupportHistoryRetry'\)\?\.addEventListener/);
});

test('successful support mutation invalidates earlier read and unlocks history retry',async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  const h=harness(async()=>pending);
  const read=h.load();
  await Promise.resolve();
  assert.equal(h.button.disabled,true);
  h.invalidate();
  h.ctx.supportTicketsData.unshift({id:'just-submitted'});
  release({tickets:[],coverage:{verified:true,incomplete:false}});
  assert.equal(await read,false);
  assert.equal(h.ctx.supportTicketsData[0].id,'just-submitted');
  assert.equal(h.button.disabled,false);
  assert.match(source,/invalidateClientSupportHistoryRequest\(\);const i=supportTicketsData.findIndex/);
  assert.match(source,/invalidateClientSupportHistoryRequest\(\);supportTicketsData.unshift\(data.ticket\)/);
});

test('successful support response with incomplete index keeps loaded requests but surfaces coverage warning',async()=>{
  const h=harness(async()=>({tickets:[{id:'known'}],coverage:{verified:true,incomplete:true}}));
  assert.equal(await h.load(),true);
  assert.equal(h.ctx.supportTicketsData[0].id,'known');
  assert.equal(h.notice.hidden,false);
});
