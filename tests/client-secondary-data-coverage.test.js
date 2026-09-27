const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const begin=source.indexOf('let secondaryClientLoadGeneration=0;');
const end=source.indexOf('function renderWorkspaceAccessState()',begin);
assert.ok(begin>=0&&end>begin);

function harness(fetcher){
  const coverage={textContent:''},notice={hidden:true,querySelector:()=>coverage};
  const context={
    fetchJsonRetry:fetcher,document:{getElementById:id=>id==='clientSecondaryDataHealth'?notice:null},
    console:{warn:()=>{}},leadsData:[],conversationsData:[],conversationThreadsData:[],
    conversationPageTotal:0,conversationNextCursor:null,conversationBackendPaging:false,
    appointmentsData:[],automationsData:[],locationsData:[],locationsLimit:1,
    renderContacts:()=>{},renderConversations:()=>{},renderAppointments:()=>{},
    renderAutomations:()=>{},renderLocations:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(begin,end),context);
  return {context,notice,coverage,load:()=>vm.runInContext('loadSecondaryClientData()',context)};
}
const actions=['leads','conversations','appointments','automations','locations'];
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
