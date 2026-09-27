const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'handler source exists: '+start);
  return source.slice(a,b);
}
const handlers=[
  section('async function loadAdminWorkspaces(', '\nfunction currentBillableWorkspaces('),
  section('async function adminProvisioning(', '\nasync function adminSaveProvisioningStage('),
  section('async function adminFleet(', '\nasync function createSupportTicket(')
].join('\n');
function fixture(count,{rawIndex,missing=[],denied=false}={}){
  const ids=rawIndex===undefined?Array.from({length:count},(_,i)=>'tenant-'+i):rawIndex;
  const absent=new Set(missing),reads=[];
  let active=0,peak=0,reply=null;
  const kv={get:async key=>{
    reads.push(key);
    if(key==='workspace:index')return ids;
    active++;peak=Math.max(peak,active);
    await Promise.resolve();
    active--;
    if(key.startsWith('workspace:')){
      const id=key.slice(10),n=Number(id.split('-').at(-1));
      return absent.has(id)?null:{id,name:'Client '+n,plan:'Starter',status:'active',phone:'',createdAt:n,updatedAt:n};
    }
    if(key.startsWith('settings:'))return {};
    if(key.startsWith('agent:'))return null;
    if(key.startsWith('onboarding:workspace:'))return {};
    if(key.startsWith('routing-request:'))return null;
    if(key.startsWith('provisioning:override:'))return null;
    if(key.startsWith('automations:'))return key==='automations:tenant-250'?[{id:'workflow-250',name:'Follow up',enabled:true}]:[];
    throw Error('unexpected key '+key);
  }};
  const context=vm.createContext({
    kv,requireAdmin:async()=>denied?null:{email:'admin@example.test'},
    entitlementsFor:p=>({plan:p}),deriveOnboardingStage:()=>'Payment confirmed',
    ONBOARDING_STAGES:['Payment confirmed'],req:{},
    res:{status(code){this.code=code;return this},json(x){reply=x;return x}},
    Promise,Array,Object,Number,String
  });
  vm.runInContext(handlers,context);
  return {reads,peak:()=>peak,reply:()=>reply,run:name=>vm.runInContext(name+'(req,res)',context)};
}

test('Provisioning includes every indexed workspace beyond former 250 limit, in stable order',async()=>{
  const f=fixture(251);
  await f.run('adminProvisioning');
  const rows=f.reply().provisioning;
  assert.equal(rows.length,251);
  assert.equal(rows[250].id,'tenant-250');
  assert.equal(rows[250].name,'Client 250');
  assert.equal(f.reads.filter(key=>key==='workspace:tenant-250').length,1);
  assert.ok(f.peak()<=200,'five metadata keys per batch of at most 40 workspaces');
});
test('Fleet aligns agents and automation records through the same full directory',async()=>{
  const f=fixture(251);
  await f.run('adminFleet');
  const {agents,automations}=f.reply();
  assert.equal(agents.length,251);
  assert.equal(automations.length,251);
  assert.equal(agents[250].workspaceId,'tenant-250');
  assert.equal(automations[250].workspaceId,'tenant-250');
  assert.equal(automations[250].workflows[0].id,'workflow-250');
  assert.ok(f.peak()<=80,'two metadata keys per batch of at most 40 workspaces');
});
test('missing workspace records do not conceal later provisioning or fleet records',async()=>{
  for(const handler of ['adminProvisioning','adminFleet']){
    const f=fixture(251,{missing:['tenant-10']});
    await f.run(handler);
    const rows=handler==='adminFleet'?f.reply().agents:f.reply().provisioning;
    assert.equal(rows.length,250);
    assert.ok(rows.some(x=>(x.workspaceId||x.id)==='tenant-250'));
    assert.ok(!rows.some(x=>(x.workspaceId||x.id)==='tenant-10'));
  }
});
test('invalid and over-capacity indexes fail without false partial results',async()=>{
  for(const handler of ['adminProvisioning','adminFleet']){
    for(const options of [{rawIndex:{bad:true}},{rawIndex:['tenant-1'],missing:[]},{rawIndex:Array.from({length:2001},(_,i)=>'tenant-'+i)}]){
      if(Array.isArray(options.rawIndex)&&options.rawIndex.length===1)continue;
      const f=fixture(0,options);
      await assert.rejects(f.run(handler),/workspace index|capacity/);
      assert.equal(f.reply(),null);
      assert.equal(f.reads.filter(key=>key.startsWith('workspace:tenant-')).length,0);
    }
  }
});
test('unauthorized operational views never read workspace inventory',async()=>{
  for(const handler of ['adminProvisioning','adminFleet']){
    const f=fixture(251,{denied:true});
    await f.run(handler);
    assert.equal(f.reply(),null);
    assert.equal(f.reads.length,0);
  }
});
