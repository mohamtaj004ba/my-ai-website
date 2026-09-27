const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const start=api.indexOf('async function aiFeedbackSubmit(req,res){');
const end=api.indexOf('\nasync function adminAiFeedback(req,res){',start);
assert.ok(start>=0&&end>start,'AI feedback mutation handler found');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function fixture({global=null,workspace=null,fail=false,conflict=false,alwaysConflict=false,deny=false}={}){
  const values=new Map([['workspace:customer',{name:'Sample Customer'}]]);
  if(global!==null)values.set('ai-feedback:index',clone(global));
  if(workspace!==null)values.set('ai-feedback:workspace:customer',clone(workspace));
  let attempts=0,status=0,response,legacyWrites=0;
  const kv={
    get:async key=>clone(values.get(key)??null),
    set:async()=>{legacyWrites++;assert.fail('Feedback must use only atomic audited transaction')}
  };
  const compareAndAuditBatch=async(_kv,updates,auditKey,event)=>{
    attempts++;
    if(fail)throw Error('Redis error');
    if(alwaysConflict)return false;
    if(conflict&&attempts===1){
      values.set('ai-feedback:index',['concurrent',...(values.get('ai-feedback:index')||[])]);
      values.set('ai-feedback:concurrent',{id:'concurrent'});return false;
    }
    for(const x of updates)if(JSON.stringify(values.get(x.key)??null)!==JSON.stringify(x.before??null))return false;
    for(const x of updates)values.set(x.key,clone(x.after));
    const prev=values.get(auditKey)||[];values.set(auditKey,[clone(event),...prev]);return true;
  };
  const ctx=vm.createContext({
    requireWritableSession:async()=>deny?null:{workspaceId:'customer',email:'test@example.invalid',role:'owner'},
    kv,compareAndAuditBatch,crypto:{randomBytes:()=>({toString:()=> '0123456789abcdef'}),randomUUID:()=> 'audit-1'},
    Date:{now:()=>1000},Array,Promise,Set,String,console:{error:()=>{}},safeError:()=>({}),
    req:{body:{source:'receptionist',category:'tone',message:'Please speak more slowly',context:'AI receptionist'}},
    res:{status(code){status=code;return this},json(data){response=data;return data}}
  });
  vm.runInContext(api.slice(start,end),ctx);
  return {values,run:async()=>{await vm.runInContext('aiFeedbackSubmit(req,res)',ctx);return {status,response,attempts,legacyWrites}}};
}
test('feedback submission commits item, both index entries and audit together',async()=>{
  const f=fixture({global:['other-feedback'],workspace:['prior-local']});
  const r=await f.run(),id='fb_0123456789abcdef';
  assert.equal(r.status,201);assert.equal(r.attempts,1);assert.equal(r.legacyWrites,0);
  assert.equal(f.values.get('ai-feedback:'+id).message,'Please speak more slowly');
  assert.deepEqual(f.values.get('ai-feedback:index'),[id,'other-feedback']);
  assert.deepEqual(f.values.get('ai-feedback:workspace:customer'),[id,'prior-local']);
  assert.equal(f.values.get('audit:customer')[0].action,'ai_feedback_submitted');
  assert.equal(f.values.get('audit:customer')[0].meta.feedbackId,id);
});
test('simultaneous feedback index edit retries and retains its new item',async()=>{
  const f=fixture({global:['prior'],workspace:[],conflict:true});
  const r=await f.run(),id='fb_0123456789abcdef';
  assert.equal(r.status,201);assert.equal(r.attempts,2);
  assert.deepEqual(f.values.get('ai-feedback:index'),[id,'concurrent','prior']);
});
test('feedback submission retains existing indexed records beyond previous workspace 250 limit',async()=>{
  const f=fixture({
    global:Array.from({length:1000},(_,i)=>'global-'+i),
    workspace:Array.from({length:249},(_,i)=>'workspace-'+i)
  });
  const r=await f.run(),id='fb_0123456789abcdef';
  assert.equal(r.status,201);
  assert.equal(f.values.get('ai-feedback:index').length,1001);
  assert.equal(f.values.get('ai-feedback:workspace:customer').length,250);
  assert.equal(f.values.get('ai-feedback:workspace:customer')[249],'workspace-248');
  assert.equal(f.values.get('ai-feedback:index')[1000],'global-999');
  assert.equal(f.values.get('ai-feedback:'+id).id,id);
});
test('malformed or full feedback indexes decline submission without creating orphaned records',async()=>{
  const cases=[
    {global:{not:'array'}},
    {workspace:{not:'array'}},
    {global:['same','same']},
    {workspace:['']},
    {global:Array.from({length:1500},(_,i)=>'global-'+i)},
    {workspace:Array.from({length:250},(_,i)=>'workspace-'+i)}
  ];
  for(const options of cases){
    const f=fixture(options),r=await f.run();
    assert.ok([409,503].includes(r.status));
    assert.match(r.response.error,/has not been submitted/);
    assert.equal(r.attempts,0);
    assert.equal(f.values.has('ai-feedback:fb_0123456789abcdef'),false);
    assert.equal(f.values.has('audit:customer'),false);
  }
});
test('ambiguous storage failure or repeated collision cannot claim confirmed feedback',async()=>{
  for(const options of [{fail:true},{global:[],workspace:[],alwaysConflict:true}]){
    const f=fixture(options),r=await f.run();
    assert.ok([409,503].includes(r.status));
    assert.match(r.response.error,/Check feedback history/);
    assert.equal(f.values.has('ai-feedback:fb_0123456789abcdef'),false);
    assert.equal(f.values.has('audit:customer'),false);
    assert.equal(r.attempts,options.alwaysConflict?4:1);
  }
});
test('read-only sessions do not append AI feedback or audit history',async()=>{
  const f=fixture({deny:true}),r=await f.run();
  assert.equal(r.status,0);assert.equal(r.attempts,0);
  assert.equal(f.values.has('audit:customer'),false);
});
