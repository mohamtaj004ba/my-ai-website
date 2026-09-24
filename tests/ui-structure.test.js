const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
function html(name){return fs.readFileSync(path.join(root,name),'utf8')}
function ids(src){return [...src.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])}
function duplicateIds(src){const seen=new Set(),dup=[];for(const id of ids(src)){if(seen.has(id))dup.push(id);seen.add(id)}return [...new Set(dup)]}
test('client and admin dashboards contain no duplicate element ids',()=>{
  assert.deepEqual(duplicateIds(html('dashboard.html')),[]);
  assert.deepEqual(duplicateIds(html('admin-dashboard.html')),[]);
});
test('dashboard nav view targets exist',()=>{
  for(const name of ['dashboard.html','admin-dashboard.html']){
    const src=html(name),allIds=new Set(ids(src));
    const targets=[...src.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]);
    const missing=[...new Set(targets)].filter(v=>!allIds.has('view-'+v));
    assert.deepEqual(missing,[],name+' missing view targets');
  }
});
test('security headers include baseline protections',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const headers=(config.headers||[]).flatMap(x=>x.headers||[]);
  const map=Object.fromEntries(headers.map(x=>[x.key.toLowerCase(),x.value]));
  for(const key of ['strict-transport-security','content-security-policy','x-content-type-options','x-frame-options','referrer-policy'])assert.ok(map[key],key+' missing');
  assert.match(map['content-security-policy'],/frame-ancestors 'none'/);
});

test('dashboard JavaScript has no duplicate named function declarations',()=>{
  const src=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
  const names=[...src.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(m=>m[1]);
  const counts={};for(const name of names)counts[name]=(counts[name]||0)+1;
  assert.deepEqual(Object.entries(counts).filter(([,count])=>count>1),[]);
});

test('admin platform settings expose every required launch gate',()=>{
  const src=html('admin-dashboard.html');
  for(const id of ['launchGatePreviewIsolation','launchGateDisposableE2E','launchGateVoiceLifecycle','launchGateProductionEnvScope','launchGateSupportEmail','launchGateBusinessTax','launchGateLegalReview']){
    assert.ok(src.includes('id="'+id+'"'),id+' launch gate missing');
  }
});

test('admin client drawer exposes the recovery drill action',()=>{
  assert.ok(html('admin-dashboard.html').includes('id="adminRecoveryDrillButton"'));
  const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
  assert.match(js,/admin-recovery-drill/);
});


test('client live dashboard bundle applies data without self-recursion',()=>{
  const src=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
  const start=src.indexOf('function applyClientDashboardData(');
  assert.ok(start>=0,'applyClientDashboardData missing');
  const open=src.indexOf('{',start),end=src.indexOf('\nfunction ',open+1);
  const body=src.slice(open+1,end>=0?end:src.length);
  assert.doesNotMatch(body,/applyClientDashboardData\s*\(/,'bundle applicator must not call itself');
  for(const target of ['callsData=','leadsData=','agentData=','settingsData=','phoneRoutingData=','locationsData=','conversationsData=','automationsData=','followupState=']){
    assert.ok(body.includes(target),target+' assignment missing from client bundle applicator');
  }
});
