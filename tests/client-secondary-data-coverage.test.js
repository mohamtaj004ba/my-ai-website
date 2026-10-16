const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const begin=source.indexOf('let secondaryClientLoadGeneration=0;');
const end=source.indexOf('function renderWorkspaceAccessState()',begin);
assert.ok(begin>=0&&end>begin);

function harness(fetcher,{calendar=true,appointments=true}={}){
  const coverage={textContent:''},notice={hidden:true,querySelector:()=>coverage};
  const context={
    fetchJsonRetry:fetcher,capability:name=>name==='calendar'&&calendar,has:feature=>feature==='appointments'&&appointments,document:{getElementById:id=>id==='clientSecondaryDataHealth'?notice:null},
    console:{warn:()=>{}},leadsData:[],conversationsData:[],conversationThreadsData:[],
    conversationPageTotal:0,conversationNextCursor:null,conversationBackendPaging:false,
    appointmentsData:[],automationsData:[],locationsData:[],locationsLimit:1,
    renderContacts:()=>{},renderConversations:()=>{},renderAppointments:()=>{},
    renderAutomations:()=>{},renderLocations:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(begin,end),context);
  return {context,notice,coverage,load:()=>vm.runInContext('loadSecondaryClientData()',context),clear:()=>vm.runInContext('clearSecondaryClientCoverage()',context)};
}
const actions=['leads','conversations','appointments','automations','locations'];

for(const [calendar,appointments]of [[false,false],[false,true],[true,false],[true,true]])test('secondary appointments require both calendar capability and plan entitlement '+JSON.stringify({calendar,appointments}),async()=>{
  const requested=[],h=harness(async url=>{const action=new URL(url,'https://example.test').searchParams.get('action');requested.push(action);return {[action]:[{id:action+'-fixture'}]};},{calendar,appointments});
  await h.load();
  assert.deepEqual(requested,actions.filter(action=>action!=='appointments'||calendar&&appointments));
  assert.equal(h.notice.hidden,true);
  assert.equal(h.context.leadsData[0].id,'leads-fixture');assert.equal(h.context.conversationThreadsData[0].id,'conversations-fixture');assert.equal(h.context.automationsData[0].id,'automations-fixture');assert.equal(h.context.locationsData[0].id,'locations-fixture');
  assert.equal(h.context.appointmentsData.length,calendar&&appointments?1:0);
});
test('secondary client feeds display explicit coverage warning and preserve last records on failure',async()=>{
  let failed=true;
  const h=harness(async url=>{
    const action=new URL(url,'https://example.test').searchParams.get('action');
    if(failed&&action==='appointments')throw new Error('offline');
    return {[action]:action==='appointments'?[{id:'saved'}]:[]};
  });
  h.context.appointmentsData=[{id:'previous'}];
  await h.load();
  assert.equal(h.notice.hidden,false);
  assert.match(h.coverage.textContent,/appointments/);
  assert.match(h.coverage.textContent,/empty results may be incomplete/);
  assert.equal(h.context.appointmentsData[0].id,'previous');
  failed=false;
  await h.load();
  assert.equal(h.notice.hidden,true);
  assert.equal(h.context.appointmentsData[0].id,'saved');
});
test('secondary client feed rejects invalid success payload rather than showing false empty state',async()=>{
  const h=harness(async url=>{
    const action=new URL(url,'https://example.test').searchParams.get('action');
    return action==='conversations'?{error:'unavailable'}:{[action]:[]};
  });
  await h.load();
  assert.equal(h.notice.hidden,false);
  assert.match(h.coverage.textContent,/conversations/);
});
test('late secondary client response cannot overwrite newer successful reload or warning',async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  let held=true;
  const h=harness(async url=>{
    const action=new URL(url,'https://example.test').searchParams.get('action');
    if(action==='leads'&&held)return pending;
    return {[action]:action==='leads'?[{id:'latest'}]:[]};
  });
  const first=h.load();
  await Promise.resolve();
  held=false;
  await h.load();
  release({leads:[{id:'stale'}]});
  await first;
  assert.equal(h.context.leadsData[0].id,'latest');
  assert.equal(h.notice.hidden,true);
});
test('secondary coverage message and focused retry are connected in client UI',()=>{
  assert.match(html,/id="clientSecondaryDataHealth"[^>]*role="status"/);
  assert.match(html,/data-secondary-coverage/);
  assert.match(html,/id="clientSecondaryRetry"/);
  assert.match(source,/getElementById\('clientSecondaryRetry'\)\?\.addEventListener\('click'/);
});

test('successful bundled refresh clears obsolete secondary failure and invalidates older response',async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  const h=harness(async url=>{
    const action=new URL(url,'https://example.test').searchParams.get('action');
    return action==='leads'?pending:{[action]:[]};
  });
  const old=h.load();
  await Promise.resolve();
  h.clear();
  release({leads:[{id:'obsolete'}]});
  await old;
  assert.equal(h.context.leadsData.length,0);
  assert.equal(h.notice.hidden,true);
  assert.match(source,/applyClientDashboardData\(data\);\s*clearSecondaryClientCoverage\(\);renderClientData\(\)/);
  assert.match(source,/applyClientDashboardData\(data\);\s*clearSecondaryClientCoverage\(\);renderClientData\(\);setClientLoading/);
});


test('client loading state exposes busy and live status semantics while workspace data hydrates',()=>{
  const html=fs.readFileSync('dashboard.html','utf8'),ui=fs.readFileSync('dashboard.js','utf8');
  assert.match(html,/class="dashboard-main" aria-busy="true"/);
  assert.match(html,/id="clientLoadingState" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(ui,/document\.querySelector\('\.dashboard-main'\)\?\.setAttribute\('aria-busy',String\(!!loading\)\)/);
});
