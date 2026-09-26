const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');

function fixture(count,{delayAgreements=false,company=[]}={}){
  const ids=Array.from({length:count},(_,i)=>'workspace-'+i),reads=[];
  let activeAgreementReads=0,peakAgreementReads=0;
  const kv={get:async key=>{
    reads.push(key);
    if(key==='workspace:index')return ids;
    if(key.startsWith('workspace:'))return {id:key.slice('workspace:'.length),name:'Business '+key.slice('workspace:'.length),plan:'Starter',ownerEmail:'owner@example.test'};
    if(key.startsWith('onboarding:')){
      activeAgreementReads++;peakAgreementReads=Math.max(peakAgreementReads,activeAgreementReads);
      if(delayAgreements)await new Promise(resolve=>setImmediate(resolve));
      activeAgreementReads--;
      if(key.startsWith('onboarding:workspace-token:'))return 'preview-agreement-token';
      return {agreementSignedAt:1,agreementVersion:'v1',agreementSignedName:'Owner'};
    }
    if(key==='admin:documents')return company;
    throw Error('Unexpected KV key: '+key);
  }};
  const res={status(n){this.code=n;return this},json(data){this.data=data;return data}};
  const context=vm.createContext({kv,requireAdmin:async()=>({email:'admin@example.test'}),entitlementsFor:plan=>({plan}),encodeURIComponent,req:{},res,Promise,Array,Number,String});
  const start=source.indexOf('async function loadAdminWorkspaces('),end=source.indexOf('\nfunction currentBillableWorkspaces(',start);
  const docStart=source.indexOf('async function adminDocuments('),docEnd=source.indexOf('\nasync function adminDocumentSave(',docStart);
  assert.ok(start>=0&&end>start&&docStart>=0&&docEnd>docStart);
  vm.runInContext(source.slice(start,end)+'\n'+source.slice(docStart,docEnd),context);
  return {context,reads,res,peak:()=>peakAgreementReads,run:()=>vm.runInContext('adminDocuments(req,res)',context)};
}

test('admin agreements include every workspace past the previous 300 limit',async()=>{
  const f=fixture(301);
  const output=await f.run();
  assert.equal(f.res.code,200);
  assert.equal(output.documents.agreements.length,301);
  const last=output.documents.agreements.find(item=>item.workspaceId==='workspace-300');
  assert.ok(last);
  assert.equal(last.signed,true);
  assert.equal(last.downloadUrl,'/api/agreement-pdf?token=preview-agreement-token');
  assert.equal(f.reads.filter(key=>key==='workspace:workspace-300').length,1);
});

test('admin documents no longer bypass common workspace capacity safeguard',async()=>{
  const f=fixture(2001);
  await assert.rejects(f.run(),/capacity/);
  assert.equal(f.reads.filter(key=>key.startsWith('onboarding:')).length,0);
});


test('agreement reads use bounded concurrency instead of a serial N+1 loop',async()=>{
  const f=fixture(41,{delayAgreements:true});
  const result=await f.run();
  assert.equal(result.documents.agreements.length,41);
  assert.ok(f.peak()>2,'agreement reads should not be serial');
  assert.ok(f.peak()<=40,'at most 20 workspaces with 2 agreement reads each');
});


test('malformed company register returns error rather than silently hiding records',async()=>{
  for(const company of [{bad:true},Array.from({length:501},(_,i)=>({id:'doc-'+i})),[null],[{name:'missing id'}]]){
    const f=fixture(0,{company});
    await f.run();
    assert.equal(f.res.code,503);
    assert.match(f.res.data.error,/Company document directory/);
    assert.equal(f.res.data.documents,undefined);
  }
  const valid=fixture(0,{company:[{id:'valid-doc',name:'Policy'}]});
  const response=await valid.run();
  assert.equal(valid.res.code,200);
  assert.equal(response.documents.company[0].id,'valid-doc');
});

test('company document mutations reject malformed records before audited writes',()=>{
  const api=fs.readFileSync('api/account.js','utf8');
  const save=api.slice(api.indexOf('async function adminDocumentSave('),api.indexOf('async function adminDocumentDelete('));
  const remove=api.slice(api.indexOf('async function adminDocumentDelete('),api.indexOf('async function adminTechSupport('));
  for(const body of [save,remove]){
    assert.match(body,/list\.length>500\|\|list\.some\(/);
    assert.ok(body.indexOf('list.some(')<body.indexOf('compareAndAudit('));
  }
});
