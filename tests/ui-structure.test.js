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
