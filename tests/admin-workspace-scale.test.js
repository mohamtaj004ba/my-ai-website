const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');

function fixture(count,{malformed=false,missing=[]}={}){
  const index=malformed?{broken:true}:Array.from({length:count},(_,i)=>'tenant-'+i);
  const records=new Map(Array.isArray(index)?index.map((id,i)=>[id,{id,name:'Business '+i,plan:'Starter',status:'active',updatedAt:i+1}]):[]);
  const absent=new Set(missing),reads=[],context=vm.createContext({
    kv:{get:async key=>{reads.push(key);if(key==='workspace:index')return index;const id=key.slice('workspace:'.length);return absent.has(id)?null:records.get(id)}},
    requireAdmin:async()=>({email:'admin@example.test'}),
    entitlementsFor:plan=>({plan}),
    req:{},res:{status(n){this.code=n;return this},json(data){this.data=data;return data}}
  });
  const loadStart=source.indexOf('async function loadAdminWorkspaces('),loadEnd=source.indexOf('\nfunction currentBillableWorkspaces(',loadStart);
  const listStart=source.indexOf('async function adminClients('),listEnd=source.indexOf('\nasync function adminUpdateClient(',listStart);
  assert.ok(loadStart>=0&&loadEnd>loadStart&&listStart>=0&&listEnd>listStart);
  vm.runInContext(source.slice(loadStart,loadEnd)+'\n'+source.slice(listStart,listEnd),context);
  return {context,reads,run:()=>vm.runInContext('adminClients(req,res)',context),load:()=>vm.runInContext('loadAdminWorkspaces()',context)};
}

test('admin workspace loader returns every account after the old 250-record boundary',async()=>{
  const f=fixture(251);
  const items=await f.load();
  assert.equal(items.length,251);
  assert.equal(items[250].id,'tenant-250');
  assert.equal(f.reads.filter(key=>key.startsWith('workspace:tenant-')).length,251);
});

test('admin client list agrees with the complete workspace directory',async()=>{
  const f=fixture(251,{missing:['tenant-14']});
  const output=await f.run();
  assert.equal(output.clients.length,250);
  assert.equal(output.clients.some(x=>x.id==='tenant-250'),true);
  assert.equal(output.clients.some(x=>x.id==='tenant-14'),false);
});

test('malformed or oversized workspace indexes cannot silently underreport client totals',async()=>{
  await assert.rejects(fixture(1,{malformed:true}).load(),/workspace index/);
  await assert.rejects(fixture(2001).load(),/capacity/);
});
